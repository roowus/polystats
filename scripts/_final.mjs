import { chromium } from 'playwright';
const url = 'https://polystats.roow.us/user/aa9ac32d409c34590adc20c880cd28380134b840614ca3924bf79de5112f52f5';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1100, height: 950 }, deviceScaleFactor: 4 });
const p = await ctx.newPage();
p.on('pageerror', e => console.log('PAGEERROR:', e.message));
await p.goto(url, { waitUntil: 'networkidle' });
await p.waitForTimeout(6000);
console.log('bundle:', await p.evaluate(() => [...document.scripts].map(s=>s.src).find(s=>s.includes('/assets/')) ?? ''));
console.log('canvases:', await p.evaluate(() => document.querySelectorAll('canvas').length));
const h = await p.$('canvas');
if (h) {
  console.log('box:', await h.boundingBox());
  await h.screenshot({ path: '/tmp/f_card.png' });
  await p.evaluate(() => { const c = document.querySelector('canvas'); c.style.width='340px'; c.style.height='340px'; });
  await p.waitForTimeout(400);
  await (await p.$('canvas')).screenshot({ path: '/tmp/f_big.png' });
}
await b.close();
