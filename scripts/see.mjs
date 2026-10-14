/** Screenshot the real CarPic component from a running dev server. */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const url = process.argv[2] ?? 'http://localhost:4400/preview.html';
const out = process.argv[3] ?? '/tmp/see.png';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 880, height: 220 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 180)));
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);
const n = await page.evaluate(() => document.querySelectorAll('svg[aria-label="Player car"]').length);
console.log('cars rendered:', n, errs.length ? 'errors: ' + errs[0] : '');
writeFileSync(out, await page.screenshot());
await browser.close();
