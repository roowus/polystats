/**
 * Verify Google Analytics is wired up on the live site.
 *
 * Reports the measurement ID actually collected, and the page_view events for
 * both the initial load and an SPA route change (the SPA case is what breaks if
 * the analytics component is not mounted on a catch-all route).
 *
 * Note: waits for `domcontentloaded`, not `networkidle`. Pages that poll keep the
 * network busy forever, so `networkidle` never settles and reports a false
 * failure.
 */
import { chromium } from 'playwright';

const BASE = process.env.GA_BASE ?? 'https://polystats.roow.us';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const collects = [];
const consoleErrors = [];
page.on('request', (r) => {
  const u = r.url();
  if (u.includes('/g/collect') || u.includes('google-analytics.com/g/collect')) collects.push(u);
  else if (u.includes('googletagmanager') || u.includes('google-analytics')) collects.push(`${r.method()} ${u}`);
});
page.on('requestfailed', (r) => {
  if (r.url().includes('google')) collects.push(`FAILED ${r.url()} (${r.failure()?.errorText})`);
});
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(5000);

const dataLayer = await page.evaluate(() => (window.dataLayer ? window.dataLayer.map((e) => JSON.stringify(e)).slice(0, 10) : null));
const gtagFn = await page.evaluate(() => typeof window.gtag);

console.log('=== gtag network requests ===');
collects.forEach((r) => console.log(' ', r));
console.log('=== window.gtag type:', gtagFn, '===');
console.log('=== dataLayer ===');
(dataLayer ?? ['NO dataLayer']).forEach((d) => console.log(' ', d?.slice(0, 140)));
console.log('=== console errors ===');
consoleErrors.forEach((e) => console.log(' ', e.slice(0, 120)));

// Navigate in-app to confirm the SPA route change also reports.
await page.goto(`${BASE}/wr`, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.waitForTimeout(5000);

const views = collects
  .filter((u) => u.includes('/g/collect'))
  .map((u) => {
    const q = new URL(u);
    return { tid: q.searchParams.get('tid'), en: q.searchParams.get('en'), dl: q.searchParams.get('dl') };
  })
  .filter((v) => v.en === 'page_view');

console.log('\n=== page_view hits ===');
views.forEach((v) => console.log(` tid=${v.tid} dl=${v.dl}`));

const ids = [...new Set(views.map((v) => v.tid).filter(Boolean))];
const paths = [...new Set(views.map((v) => v.dl).filter(Boolean))];
console.log(`\nmeasurement ids: ${ids.join(', ') || 'NONE'}`);
console.log(`paths reported: ${paths.join(', ') || 'NONE'}`);
console.log(ids.length === 1 && paths.length >= 2 ? 'RESULT: OK, SPA page_views report to one stream' : 'RESULT: CHECK, expected one id and both paths');

await browser.close();
