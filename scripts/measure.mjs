/**
 * Definitive orientation check on the deployed car.
 *
 * The wheels are the dark geometry; the painted body is the patterned/coloured
 * part. Correct orientation means the body's mass sits ABOVE the wheels' on
 * screen, and the wheels extend below the body's lowest point.
 */
import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 440, height: 440 } });
await page.goto('https://polystats.roow.us/user/aa9ac32d409c34590adc20c880cd28380134b840614ca3924bf79de5112f52f5', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(35000);
const r = await page.evaluate(() => {
  const svg = document.querySelector('svg[aria-label="Player car"]');
  const tyre = [], body = [];
  for (const poly of svg.querySelectorAll('polygon')) {
    const fill = poly.getAttribute('fill') || '';
    const pts = poly.getAttribute('points').split(' ').map((s) => s.split(',').map(Number));
    const y = pts.reduce((s, q) => s + q[1], 0) / pts.length;
    // Tyres render near-black (#000000..#1a1a22). Everything else is paint.
    const m = fill.match(/^#(..)(..)(..)$/);
    const dark = m && parseInt(m[1], 16) < 40 && parseInt(m[2], 16) < 40 && parseInt(m[3], 16) < 40;
    (dark ? tyre : body).push(y);
  }
  const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  return { bodyN: body.length, tyreN: tyre.length,
    bodyAvg: +avg(body).toFixed(1), tyreAvg: +avg(tyre).toFixed(1),
    bodyTop: +Math.min(...body).toFixed(1), tyreBottom: +Math.max(...tyre).toFixed(1) };
});
console.log(JSON.stringify(r, null, 2));
console.log();
console.log(`body avg y ${r.bodyAvg} vs tyres ${r.tyreAvg}`);
console.log(r.bodyAvg < r.tyreAvg ? 'PASS: body sits above the wheels' : 'FAIL: body below wheels');
console.log(`tyres reach y ${r.tyreBottom}, body starts at y ${r.bodyTop}`);
await browser.close();
