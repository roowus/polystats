/**
 * Render the app's own CarPic output and save it as an image, so what is
 * inspected is the shipped projection rather than a reimplementation.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

execSync('npx vitest run src/lib/_emit.test.ts --no-cache', { stdio: 'pipe' });
const polys = JSON.parse(readFileSync('/tmp/polys.json', 'utf8'));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 300, height: 300 } });
await page.setContent('<body style="margin:0;background:#102052"><canvas id="c" width="300" height="300"></canvas></body>');
await page.evaluate(({ polys }) => {
  const ctx = document.getElementById('c').getContext('2d');
  const LIGHT = (() => { const v = [0.35, 0.88, 0.32]; const l = Math.hypot(...v); return v.map((x) => x / l); })();
  const COL = { Main: '#2ea3e8', Metal: '#8a8a96', Rim: '#e0e0e8', Tire: '#1a1a20', AirIntake: '#303038', BrakeLight: '#c02020' };
  const deps = polys.map((p) => p.depth), mn = Math.min(...deps), mx = Math.max(...deps);
  const shade = (h, f) => { const n = parseInt(h.slice(1), 16); const c = [(n>>16)&255,(n>>8)&255,n&255].map((x) => Math.max(0, Math.min(255, Math.round(x*f)))); return '#' + c.map((x) => x.toString(16).padStart(2, '0')).join(''); };
  const s = 300 / 200;
  ctx.scale(s, s);
  for (const p of polys) {
    const t = (p.depth - mn) / Math.max(mx - mn, 1e-6);
    const lam = Math.max(0, p.normal[0]*LIGHT[0] + p.normal[1]*LIGHT[1] + p.normal[2]*LIGHT[2]);
    ctx.beginPath();
    ctx.moveTo(p.points[0][0], p.points[0][1]);
    ctx.lineTo(p.points[1][0], p.points[1][1]);
    ctx.lineTo(p.points[2][0], p.points[2][1]);
    ctx.closePath();
    ctx.fillStyle = shade(COL[p.material] || '#707080', (0.74 + lam * 0.52) * (1.06 - t * 0.16));
    ctx.fill();
  }
}, { polys });

await page.waitForTimeout(400);
writeFileSync('/tmp/car-shot.png', await page.locator('#c').screenshot());

// Report the landmark that decides orientation, from the same data.
const ys = (m) => {
  const a = polys.filter((p) => p.material === m).flatMap((p) => p.points.map(([, y]) => y));
  return { min: Math.min(...a), max: Math.max(...a) };
};
const body = ys('Main'), tyre = ys('Tire');
console.log(`body y ${body.min.toFixed(0)}..${body.max.toFixed(0)}  tyre y ${tyre.min.toFixed(0)}..${tyre.max.toFixed(0)}`);
console.log(`wheels below body? ${tyre.max > body.max}`);
await browser.close();
