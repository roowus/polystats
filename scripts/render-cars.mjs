/**
 * Render native PolyTrack car thumbnails and upload them to R2.
 *
 * PolyTrack draws car images with its own WebGL scene and exposes no image
 * endpoint, so the only way to get the real render is to drive the game client
 * and read the PNGs it produces. `carThumbnail()` only runs while the game
 * builds leaderboard player rows, so this script opens leaderboards, harvests
 * the 200x200 data-URL PNGs, and maps each one back to the car style that
 * produced it (leaderboard API order matches on-screen row order).
 *
 * Where the styles come from
 * --------------------------
 * `--source catalog` (default) asks the worker which car styles players
 * actually use, so we only render cars someone will see. `--source leaderboard`
 * harvests whatever the top of a leaderboard happens to show, which is useful
 * for seeding but covers very little of the real catalog.
 *
 * Cost controls
 * -------------
 * Every one of these is a hard ceiling, so a run cannot run away:
 *   --limit          maximum images to upload this run (default 400)
 *   --max-parallel   concurrent browsers (default 4)
 *   --time-budget    wall-clock seconds before it stops early (default 1500)
 * Objects already in R2 are skipped, so repeated runs do less work, not more.
 *
 * Usage:
 *   node scripts/render-cars.mjs --limit 400
 *   node scripts/render-cars.mjs --dry-run          # report, upload nothing
 *   node scripts/render-cars.mjs --source leaderboard --tracks 6
 */
import { chromium } from 'playwright';
import { createHash, createHmac } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
const hasFlag = (name) => args.includes(name);

const LIMIT = Number(getArg('--limit', 400));
const MAX_PARALLEL = Number(getArg('--max-parallel', 4));
const TIME_BUDGET_S = Number(getArg('--time-budget', 1500));
const SOURCE = getArg('--source', 'catalog');
const TRACK_COUNT = Number(getArg('--tracks', 6));
const PER_TRACK = Number(getArg('--limit-per-track', 12));
const DRY_RUN = hasFlag('--dry-run');

const WORKER = process.env.POLYSTATS_WORKER ?? 'https://polystats-proxy.roowus.workers.dev';
const GAME = process.env.POLYTRACK_GAME ?? 'https://app-polytrack.kodub.com/0.6.3/';

const LOCAL_OUT = path.join(process.cwd(), 'public', 'cars');

// --- R2 (S3-compatible) -----------------------------------------------------
const R2 = {
  account: process.env.R2_ACCOUNT_ID,
  key: process.env.R2_ACCESS_KEY_ID,
  secret: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET ?? 'polystats-cars',
};
const r2Configured = Boolean(R2.account && R2.key && R2.secret);

function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}
function hmac(key, data) {
  return createHmac('sha256', key).update(data).digest();
}

/** Minimal SigV4 PUT. Avoids pulling in the AWS SDK for one operation. */
async function r2Put(objectKey, body) {
  const host = `${R2.account}.r2.cloudflarestorage.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body);
  const canonicalUri = `/${R2.bucket}/${objectKey.split('/').map(encodeURIComponent).join('/')}`;
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = ['PUT', canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
  let k = hmac(`AWS4${R2.secret}`, dateStamp);
  k = hmac(k, 'auto');
  k = hmac(k, 's3');
  k = hmac(k, 'aws4_request');
  const signature = createHmac('sha256', k).update(stringToSign).digest('hex');

  const res = await fetch(`https://${host}${canonicalUri}`, {
    method: 'PUT',
    headers: {
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      Authorization: `AWS4-HMAC-SHA256 Credential=${R2.key}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      'content-type': 'image/png',
    },
    body,
  });
  if (!res.ok) throw new Error(`R2 PUT ${objectKey} failed: ${res.status} ${await res.text()}`);
}

/** Which styles already exist? One HEAD per style, so we never re-render. */
async function alreadyRendered(styles) {
  const present = new Set();
  if (!r2Configured) {
    // Fall back to local files when running without R2 credentials.
    for (const s of styles) {
      if (fs.existsSync(path.join(LOCAL_OUT, `${s}.png`))) present.add(s);
    }
    return present;
  }
  await Promise.all(
    styles.map(async (s) => {
      const res = await fetch(`${WORKER}/car/${encodeURIComponent(s)}.png`, { method: 'HEAD' });
      if (res.ok) present.add(s);
    })
  );
  return present;
}

/** Ask the worker which car styles players actually use. */
async function stylesFromCatalog(want) {
  const out = new Set();
  // The search endpoint caps at 200 rows per call, so page through nicknames
  // that appear frequently rather than trying to read the whole table.
  const queries = 'aeiounrsmtlcdpbg'.split('');
  for (const q of queries) {
    if (out.size >= want) break;
    try {
      const res = await fetch(`${WORKER}/users?q=${q}&limit=200`);
      if (!res.ok) continue;
      const data = await res.json();
      for (const u of data.users ?? []) {
        if (u.car_style) out.add(u.car_style);
        if (out.size >= want) break;
      }
    } catch {
      // A failed page just reduces coverage; keep going.
    }
  }
  return out;
}

/** Boot the game so its renderer is available. */
async function openGame() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(GAME, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(9000);
  await page.getByText('Exit', { exact: false }).first().click().catch(() => {});
  await page.waitForTimeout(2500);
  return { browser, page };
}

/**
 * Harvest the renders on a leaderboard.
 *
 * The DOM order of rendered thumbnails matches leaderboard entry order, so the
 * Nth image is the Nth entry's car style.
 */
async function harvestLeaderboard(page, trackName, trackId, perTrack) {
  const ok = await page.evaluate((name) => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && (el.textContent || '').trim() === name) {
        el.click();
        return true;
      }
    }
    return false;
  }, trackName);
  if (!ok) return new Map();

  await page.waitForTimeout(8000);

  const b64s = await page.evaluate(() =>
    [...document.querySelectorAll('img')]
      .filter((i) => i.src.startsWith('data:image/png;base64,') && i.naturalWidth === 200)
      .map((i) => i.src.split(',')[1])
  );

  const styles = [];
  if (trackId) {
    try {
      const res = await fetch(
        `https://vps.kodub.com/v6/leaderboard?version=0.6.3&trackId=${trackId}&skip=0&amount=${perTrack}&onlyVerified=false`,
        { headers: { Origin: 'https://app-polytrack.kodub.com' } }
      );
      if (res.ok) {
        const json = await res.json();
        for (const e of json.entries ?? []) if (e.carStyle) styles.push(e.carStyle);
      }
    } catch {
      // Without entry order we cannot attribute images to styles.
    }
  }

  const out = new Map();
  b64s.forEach((b64, i) => {
    const style = styles[i];
    if (style && b64 && !out.has(style)) out.set(style, b64);
  });

  await page.getByText('Back', { exact: false }).first().click().catch(() => {});
  await page.waitForTimeout(2000);
  return out;
}

const TRACKS = [
  ['Summer 1', '5803f9e963625804e3de3246d043dc7dde847aa32e991f7f7326b0453f1fa038'],
  ['Summer 2', '7eac4fee1111152cfba4d3737410264ca0f22c7f5a2211e79f0099589b8b48c0'],
  ['Summer 3', '148826aa16ffaa23dbc453b32cff05e025ddbce1773fc7733cc13d218926515a'],
  ['Winter 1', '7239b17057127936907a805b0caa5d8c6f6c97eca9bdabf1a5312dce479629b7'],
  ['Desert 1', 'c20b4ee3cd517ca6cae7e43f047548757287fbd08ba81b97892a3ef520159a34'],
  ['Summer 4', '93c7363dfea7fb09ca1d23b72cad5df43a30841d41c8ff25fb544c85bb03c7ae'],
];

async function main() {
  const started = Date.now();
  const elapsed = () => (Date.now() - started) / 1000;
  const overBudget = () => elapsed() > TIME_BUDGET_S;

  console.log(`render-cars: limit=${LIMIT} parallel=${MAX_PARALLEL} budget=${TIME_BUDGET_S}s dry-run=${DRY_RUN}`);
  console.log(`R2 configured: ${r2Configured ? 'yes' : 'no (writing to public/cars only)'}`);

  // Which styles do we need?
  let wanted;
  if (SOURCE === 'catalog') {
    wanted = await stylesFromCatalog(LIMIT * 2);
    console.log(`catalog returned ${wanted.size} distinct styles`);
  } else {
    wanted = null; // leaderboard mode discovers styles as it renders
  }

  if (wanted && wanted.size === 0) {
    console.log('no styles reported by the catalog; nothing to do');
    return;
  }

  const have = wanted ? await alreadyRendered([...wanted]) : new Set();
  if (wanted) console.log(`${have.size} already rendered, ${wanted.size - have.size} missing`);

  const browsers = [];
  const uploads = [];
  let rendered = 0;

  try {
    // One browser per parallel slot; the renderer is CPU-bound, so this is what
    // actually raises throughput.
    for (let i = 0; i < MAX_PARALLEL; i++) {
      browsers.push(await openGame());
      if (overBudget()) break;
    }
    console.log(`opened ${browsers.length} browser(s) in ${elapsed().toFixed(0)}s`);

    // Distribute the leaderboards across the parallel browsers.
    const queue = TRACKS.slice(0, TRACK_COUNT);
    const workers = browsers.map(async (b, idx) => {
      for (let t = idx; t < queue.length; t += browsers.length) {
        if (overBudget() || rendered >= LIMIT) return;
        const [name, id] = queue[t];
        try {
          const found = await harvestLeaderboard(b.page, name, id, PER_TRACK);
          for (const [style, b64] of found) {
            if (rendered >= LIMIT || overBudget()) return;
            if (wanted && !wanted.has(style)) continue;
            if (have.has(style)) continue;
            const buf = Buffer.from(b64, 'base64');
            have.add(style);
            rendered++;
            if (DRY_RUN) {
              uploads.push({ style, bytes: buf.length, skipped: true });
              continue;
            }
            if (r2Configured) {
              await r2Put(`cars/${style}.png`, buf);
            } else {
              fs.mkdirSync(LOCAL_OUT, { recursive: true });
              fs.writeFileSync(path.join(LOCAL_OUT, `${style}.png`), buf);
            }
            uploads.push({ style, bytes: buf.length });
          }
        } catch (err) {
          console.warn(`  ${name}: ${String(err).slice(0, 120)}`);
        }
      }
    });
    await Promise.all(workers);
  } finally {
    for (const b of browsers) await b.browser.close().catch(() => {});
  }

  const bytes = uploads.reduce((a, u) => a + u.bytes, 0);
  console.log(`\nrendered ${uploads.length} car(s), ${(bytes / 1024).toFixed(0)} KB in ${elapsed().toFixed(0)}s`);
  if (DRY_RUN) console.log('dry run: nothing uploaded');
  if (overBudget()) console.log(`stopped early at the ${TIME_BUDGET_S}s time budget`);
}

await main();
