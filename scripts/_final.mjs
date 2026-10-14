import { chromium } from 'playwright';
const url = 'https://polystats.roow.us/user/aa9ac32d409c34590adc20c880cd28380134b840614ca3924bf79de5112f52f5';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 4 });
await p.goto(url, { waitUntil: 'networkidle' });
await p.waitForTimeout(4000);
const svg = p.locator('svg').filter({ has: p.locator('polygon') }).first();
const box = await svg.boundingBox();
console.log('car element box:', box);
await svg.screenshot({ path: '/tmp/final_56.png' });
// Blow it up in place so the eye can judge the shape at the card's real size.
await svg.evaluate(e => { e.style.width = '380px'; e.style.height = '380px'; });
await p.waitForTimeout(300);
await svg.screenshot({ path: '/tmp/final_380.png' });
await p.screenshot({ path: '/tmp/final_page.png', fullPage: false });
await b.close();
