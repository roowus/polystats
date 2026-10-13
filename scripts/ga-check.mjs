import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const gtagRequests = [];
const consoleErrors = [];
page.on('request', (r) => { if (r.url().includes('googletagmanager') || r.url().includes('google-analytics')) gtagRequests.push(`${r.method()} ${r.url()}`); });
page.on('requestfailed', (r) => { if (r.url().includes('google')) gtagRequests.push(`FAILED ${r.url()} (${r.failure()?.errorText})`); });
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));

await page.goto('https://polystats.roow.us/', { waitUntil: 'networkidle', timeout: 45000 }).catch((e) => console.log('goto:', e.message));
await page.waitForTimeout(3000);

const dataLayer = await page.evaluate(() => (window.dataLayer ? window.dataLayer.map((e) => JSON.stringify(e)).slice(0, 10) : null));
const gtagFn = await page.evaluate(() => typeof window.gtag);

console.log('=== gtag network requests ===');
gtagRequests.forEach((r) => console.log(' ', r));
console.log('=== window.gtag type:', gtagFn, '===');
console.log('=== dataLayer ===');
(dataLayer ?? ['NO dataLayer']).forEach((d) => console.log(' ', d?.slice(0, 140)));
console.log('=== console errors ===');
consoleErrors.forEach((e) => console.log(' ', e.slice(0, 120)));

// navigate to another route and check page_view push
await page.goto('https://polystats.roow.us/wr', { waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(1500);
const dl2 = await page.evaluate(() => (window.dataLayer ? window.dataLayer.filter((e) => e.event === 'page_view').map((e) => e.page_path) : []));
console.log('=== page_views after navigating to /wr ===', JSON.stringify(dl2));

await browser.close();
