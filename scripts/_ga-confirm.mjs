import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
let accepted = [];
page.on('response', async r => {
  if (r.url().includes('/g/collect')) accepted.push(r.status());
});
await page.goto('https://polystats.roow.us/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);
await page.goto('https://polystats.roow.us/wr', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);
console.log('collect responses:', accepted, accepted.every(c => c === 204) ? '-> ALL ACCEPTED' : '-> CHECK');
await browser.close();
