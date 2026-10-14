import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
const reqs = [];
const resp = [];
page.on('request', r => { if (r.url().includes('google')) reqs.push(r.url()); });
page.on('response', async r => {
  if (r.url().includes('/g/collect') || r.url().includes('collect')) {
    let body = '';
    try { body = (await r.text()).slice(0, 200); } catch {}
    resp.push({ status: r.status(), url: r.url().slice(0, 90), body });
  }
});
await page.goto('https://polystats.roow.us/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(9000);
console.log('=== collect responses (what Google said) ===');
for (const r of resp) console.log(JSON.stringify(r, null, 2));
if (!resp.length) console.log('(no collect response captured)');
await browser.close();
