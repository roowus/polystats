/**
 * Build one SVG per pattern, mapping the atlas onto the body via the mesh UVs,
 * then screenshot the set so pattern support can be judged visually.
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const polys = JSON.parse(readFileSync('/tmp/polys.json', 'utf8'));
const PATTERNS = ['stripe','stripe2','stripe3','double_stripe','edge','half','arrow',
  'circle','horseshoe','needle','triangle','diamonds','zigzag','circles','gradient','outline'];

const LIGHT = [0.35, 0.88, 0.32];
const LL = Math.hypot(...LIGHT);
const L = LIGHT.map((v) => v / LL);
const COL = { Main:'#2ea3e8', Metal:'#8a8a96', Rim:'#e0e0e8', Tire:'#1a1a20', AirIntake:'#303038', BrakeLight:'#c02020' };
const shade = (h, f) => { const n = parseInt(h.slice(1), 16); const c = [(n>>16)&255,(n>>8)&255,n&255].map((x) => Math.max(0, Math.min(255, Math.round(x*f)))); return '#' + c.map((x) => x.toString(16).padStart(2, '0')).join(''); };

const deps = polys.map((p) => p.depth);
const mn = Math.min(...deps), mx = Math.max(...deps);

function buildSvg(patternName) {
  let atlas = readFileSync(`public/patterns/pattern_${patternName}.svg`, 'utf8')
    .replace(/<\?xml[^>]*\?>/, '')
    .replace(/#f00\b/g, '#2ea3e8')
    .replace(/#0f0\b/g, '#f4f4ff');
  const atlasUri = `data:image/svg+xml;utf8,${encodeURIComponent(atlas)}`;

  let out = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="200" height="200" viewBox="0 0 200 200">';
  out += `<defs><image id="tex" xlink:href="${atlasUri}" width="1024" height="1024"/></defs>`;
  let clipN = 0;
  for (const p of polys) {
    const pts = p.points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
    if (p.material === 'Main' && p.uv) {
      const [u0,v0]=p.uv[0], [u1,v1]=p.uv[1], [u2,v2]=p.uv[2];
      const [x0,y0]=p.points[0], [x1,y1]=p.points[1], [x2,y2]=p.points[2];
      const U0=u0*1024, V0=v0*1024, U1=u1*1024, V1=v1*1024, U2=u2*1024, V2=v2*1024;
      const det = (U1-U0)*(V2-V0) - (U2-U0)*(V1-V0);
      let tr;
      if (Math.abs(det) < 1e-9) tr = [1,0,0,1,x0-U0,y0-V0];
      else {
        const a = ((x1-x0)*(V2-V0) - (x2-x0)*(V1-V0)) / det;
        const b = ((y1-y0)*(V2-V0) - (y2-y0)*(V1-V0)) / det;
        const c = ((x2-x0)*(U1-U0) - (x1-x0)*(U2-U0)) / det;
        const d = ((y2-y0)*(U1-U0) - (y1-y0)*(U2-U0)) / det;
        tr = [a,b,c,d, x0-a*U0-c*V0, y0-b*U0-d*V0];
      }
      const id = 'k' + (clipN++);
      out += `<clipPath id="${id}"><polygon points="${pts}"/></clipPath>`;
      out += `<g clip-path="url(#${id})"><use xlink:href="#tex" transform="matrix(${tr.join(' ')})"/></g>`;
      const t0 = (p.depth - mn) / Math.max(mx - mn, 1e-6);
      const lam0 = Math.max(0, p.normal[0]*L[0] + p.normal[1]*L[1] + p.normal[2]*L[2]);
      const tint0 = (0.74 + lam0*0.52) * (1.06 - t0*0.16);
      out += `<polygon points="${pts}" fill="#000" opacity="${Math.max(0, 0.34 - tint0*0.24).toFixed(3)}"/>`;
    } else {
      const t = (p.depth - mn) / Math.max(mx - mn, 1e-6);
      const lam = Math.max(0, p.normal[0]*L[0] + p.normal[1]*L[1] + p.normal[2]*L[2]);
      out += `<polygon points="${pts}" fill="${shade(COL[p.material] || '#707080', (0.74 + lam*0.52) * (1.06 - t*0.16))}"/>`;
    }
  }
  out += '</svg>';
  return out;
}

const cells = PATTERNS.map((name, i) =>
  `<div style="text-align:center"><img src="data:image/svg+xml;utf8,${encodeURIComponent(buildSvg(name))}" width="170" height="170"><div>${i}: ${name}</div></div>`
).join('');

writeFileSync('/tmp/patterns.html', `<!doctype html><meta charset="utf-8">
<body style="margin:0;background:#102052;color:#fff;font:12px monospace">
<div style="display:flex;flex-wrap:wrap;gap:4px;padding:10px">${cells}</div></body>`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1120, height: 800 } });
await page.goto('file:///tmp/patterns.html', { waitUntil: 'load' });
await page.waitForTimeout(1500);
writeFileSync('/tmp/patterns.png', await page.screenshot({ fullPage: true }));
console.log('rendered all 16 patterns');
await browser.close();
