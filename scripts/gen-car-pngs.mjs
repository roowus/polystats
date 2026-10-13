/**
 * Generate native PolyTrack car thumbnails as static PNG files, keyed by car style.
 *
 * PolyTrack has no public endpoint for car images. It renders them internally
 * with `carThumbnail(carStyle, game)` -> a 200x200 data-URL PNG, and only calls
 * that for the player rows of a leaderboard. So this script drives the real game
 * client headlessly, opens a few public leaderboards (they carry a `carStyle`
 * per entry), and saves the PNGs the game itself produced.
 *
 * Output is keyed by car style, so one file serves every player using that car.
 * This is an OFFLINE build step: it never runs at request time, so serving the
 * images costs nothing beyond normal static-file bandwidth.
 *
 * Usage: node scripts/gen-car-pngs.mjs [--tracks N] [--limit N] [--pages N]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? Number(args[i + 1]) : d; };
const MAX_TRACKS = getArg('--tracks', 5);
const PER_TRACK = getArg('--limit', 20);
const PAGES = getArg('--pages', 1);
const OUT = path.join(process.cwd(), 'public', 'cars');
fs.mkdirSync(OUT, { recursive: true });

const GAME = 'https://app-polytrack.kodub.com/0.6.3/';
const TRACKS = ['Summer 1', 'Summer 2', 'Summer 3', 'Winter 1', 'Desert 1'].slice(0, MAX_TRACKS);

const api = 'https://vps.kodub.com/v6/leaderboard?version=0.6.3&skip=0&amount=1&onlyVerified=false&trackId=';
const HEADERS = { Origin: 'https://app-polytrack.kodub.com' };

// Map track name -> id so we can pair an observed render with its exact style.
const TRACK_IDS = {
  'Summer 1': '5803f9e963625804e3de3246d043dc7dde847aa32e991f7f7326b0453f1fa038',
  'Summer 2': '7eac4fee1111152cfba4d3737410264ca0f22c7f5a2211e79f0099589b8b48c0',
  'Summer 3': '148826aa16ffaa23dbc453b32cff05e025ddbce1773fc7733cc13d218926515a',
  'Winter 1': '7239b17057127936907a805b0caa5d8c6f6c97eca9bdabf1a5312dce479629b7',
  'Desert 1': 'c20b4ee3cd517ca6cae7e43f047548757287fbd08ba81b97892a3ef520159a34',
};

/** Fetch the ordered car styles for a track, so row N maps to entry N. */
async function stylesFor(trackId, amount) {
  const res = await fetch(api.replace('amount=1', `amount=${amount}`) + trackId, { headers: HEADERS });
  if (!res.ok) throw new Error(`leaderboard ${res.status}`);
  const json = await res.json();
  return (json.entries || []).map((e) => e.carStyle);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const started = Date.now();
await page.goto(GAME, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(10000);
await page.getByText('Exit', { exact: false }).first().click().catch(() => {});
await page.waitForTimeout(2500);
console.log(`game booted in ${((Date.now() - started) / 1000).toFixed(1)}s`);

const saved = new Map(); // style -> file

for (const track of TRACKS) {
  const trackId = TRACK_IDS[track];
  let styles = [];
  try { styles = await stylesFor(trackId, PER_TRACK); } catch (e) { console.log(`skip ${track}: ${e.message}`); continue; }

  const ok = await page.evaluate((name) => {
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length === 0 && (el.textContent || '').trim() === name) { el.click(); return true; }
    }
    return false;
  }, track);
  if (!ok) { console.log(`skip ${track}: not on screen`); continue; }

  let lastCount = 0;
  for (let p = 0; p < PAGES; p++) {
    await page.waitForTimeout(8000);
    // The DOM order of rendered thumbs matches the leaderboard entry order.
    const thumbs = await page.evaluate(() => [...document.querySelectorAll('img')]
      .filter((i) => i.src.startsWith('data:image/png;base64,') && i.naturalWidth === 200)
      .map((i) => i.src.split(',')[1]));

    lastCount = thumbs.length;
    thumbs.forEach((b64, i) => {
      const style = styles[i];
      if (!style || !b64 || saved.has(style)) return;
      const file = `${style.replace(/[^A-Za-z0-9_-]/g, '_')}.png`;
      fs.writeFileSync(path.join(OUT, file), Buffer.from(b64, 'base64'));
      saved.set(style, file);
    });

    if (p < PAGES - 1) {
      await page.locator('.leaderboard-ui .page-button, [class*=pagination] button').last().click().catch(() => {});
    }
  }
  console.log(`${track}: ${lastCount} rendered, ${saved.size} unique total`);

  await page.getByText('Back', { exact: false }).first().click().catch(() => {});
  await page.waitForTimeout(2500);
}

const bytes = fs.readdirSync(OUT).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`\nsaved ${saved.size} unique car PNGs (${(bytes / 1024).toFixed(0)} KB total)`);
console.log(`avg ${(bytes / Math.max(saved.size, 1) / 1024).toFixed(1)} KB per car`);
console.log(`wall time: ${((Date.now() - started) / 1000).toFixed(1)}s`);
await browser.close();

// Keep the app's known-style list in sync with what is on disk, so CarPic can
// resolve a native PNG without probing (and 404-ing) for styles we lack.
const styles = fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)).sort();
const manifest = `/**
 * Generated by scripts/gen-car-pngs.mjs. Do not edit by hand.
 *
 * Car styles that have a native PolyTrack render in public/cars/<style>.png.
 */
export const NATIVE_CAR_STYLES: readonly string[] = [
${styles.map((s) => `  '${s}',`).join('\n')}
];
`;
fs.writeFileSync(path.join(process.cwd(), 'src', 'lib', 'nativeCarStyles.ts'), manifest);
console.log(`wrote src/lib/nativeCarStyles.ts (${styles.length} styles)`);
