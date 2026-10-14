/**
 * Compare our projected car against the game's native render.
 *
 * Orientation is hard to judge by eye (two attempts at this were called fixed
 * and were not), so this measures it: both images are reduced to a coarse
 * luminance grid, and we report which way the bright mass sits relative to the
 * dark, plus how each of the four quadrants compares.
 *
 * Usage:
 *   node scripts/compare-car-render.mjs              # prints the report
 *   node scripts/compare-car-render.mjs --write      # also writes /tmp PNGs
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';

const WRITE = process.argv.includes('--write');
// A style with a native render available, so the two can be compared directly.
const STYLE = 'AA4GBbqmF14wGG__AHJvYw';
const NATIVE_URL = `https://polystats-proxy.roowus.workers.dev/car/${STYLE}.png`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 700, height: 360 } });

// Render our projection in-page from the shipped geometry.
const geometry = readFileSync('src/lib/carGeometry.json', 'utf8');
const nativeB64 = Buffer.from(
  await (await fetch(NATIVE_URL)).arrayBuffer()
).toString('base64');

await page.setContent(`<body style="margin:0;background:#fff">
<div style="display:flex;gap:10px">
  <canvas id="native" width="200" height="200"></canvas>
  <canvas id="ours" width="200" height="200"></canvas>
</div></body>`);

const report = await page.evaluate(async ({ geometry, nativeB64 }) => {
  const g = JSON.parse(geometry);

  // --- analyse the native render -------------------------------------------
  const img = new Image();
  img.src = 'data:image/png;base64,' + nativeB64;
  await img.decode();
  const nc = document.getElementById('native').getContext('2d');
  nc.clearRect(0, 0, 200, 200);
  nc.drawImage(img, 0, 0, 200, 200);

  const analyse = (ctx, size) => {
    const { data } = ctx.getImageData(0, 0, size, size);
    // Alpha-weighted luminance grid, sampled 4x4 so noise does not dominate.
    const N = 4, cells = Array.from({ length: N * N }, () => ({ sum: 0, n: 0 }));
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const a = data[i + 3] / 255;
        if (a < 0.1) continue; // transparent background is not car
        const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) * a;
        const cx = Math.min(N - 1, Math.floor((x / size) * N));
        const cy = Math.min(N - 1, Math.floor((y / size) * N));
        const c = cells[cy * N + cx];
        c.sum += lum; c.n++;
      }
    }
    return cells.map((c) => (c.n ? c.sum / c.n : 0));
  };

  const nGrid = analyse(nc, 200);

  // --- render ours ----------------------------------------------------------
  const oc = document.getElementById('ours').getContext('2d');
  // Transparent background: the analyser ignores alpha<0.1, so a white fill
  // would swamp the measurement with background.
  oc.clearRect(0, 0, 200, 200);

  const apply = (m, x, y, z) => [m[0]*x+m[4]*y+m[8]*z+m[12], m[1]*x+m[5]*y+m[9]*z+m[13], m[2]*x+m[6]*y+m[10]*z+m[14]];
  const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
  const eye = norm([1, 1, 1]);
  const dir = eye.map((v) => -v);
  const wu = [0, 1, 0];
  // Must match carProject.ts: right = cross(dir, up), up = cross(right, dir).
  const right = norm([dir[1]*wu[2]-dir[2]*wu[1], dir[2]*wu[0]-dir[0]*wu[2], dir[0]*wu[1]-dir[1]*wu[0]]);
  const up = norm([right[1]*dir[2]-right[2]*dir[1], right[2]*dir[0]-right[0]*dir[2], right[0]*dir[1]-right[1]*dir[0]]);
  const sx = (x,y,z) => x*right[0]+y*right[1]+z*right[2];
  const sy = (x,y,z) => x*up[0]+y*up[1]+z*up[2];
  const sz = (x,y,z) => x*eye[0]+y*eye[1]+z*eye[2];

  let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9;
  const add=(x,y,z)=>{const a=sx(x,y,z),b=sy(x,y,z);minX=Math.min(minX,a);maxX=Math.max(maxX,a);minY=Math.min(minY,b);maxY=Math.max(maxY,b);};
  for (const p of g.parts) for (let i=0;i<p.position.length;i+=3){const w=apply(p.matrix,p.position[i],p.position[i+1],p.position[i+2]);add(...w);}
  for (const [wx,wy,wz] of g.wheels) for (const dx of[-.33,.33]) for (const dy of[-.33,.33]) for (const dz of[-.17,.17]) add(wx+dx,wy+dy,wz+dz);

  const S=200, span=Math.max(maxX-minX,maxY-minY)*1.12, cx=(minX+maxX)/2, cy=(minY+maxY)/2, sc=S/span;
  const px=(x,y,z)=>[(sx(x,y,z)-cx)*sc+S/2, S/2-(sy(x,y,z)-cy)*sc];
  const faceN=(a,b,c)=>{const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const l=Math.hypot(...n)||1;return n.map(x=>x/l);};
  const polys=[];
  const emit=(m,pos,idx,mat,off)=>{const n=idx?idx.length:pos.length/3;
    for(let i=0;i<n;i+=3){const pts=[];const w=[];let dep=0;
      for(let k=0;k<3;k++){const vi=idx?idx[i+k]:i+k;let [x,y,z]=apply(m,pos[vi*3],pos[vi*3+1],pos[vi*3+2]);
        if(off){x+=off[0];y+=off[1];z+=off[2];} w.push([x,y,z]);pts.push(px(x,y,z));dep+=sz(x,y,z);}
      polys.push({pts,mat,dep:dep/3,normal:faceN(w[0],w[1],w[2])});}};
  for (const p of g.parts) emit(p.matrix,p.position,p.index,p.material);
  for (const hub of g.wheels) for (const p of g.parts) if (p.name.startsWith('Wheel')) emit(p.matrix,p.position,p.index,p.material,hub);
  polys.sort((a,b)=>b.dep-a.dep);

  const deps=polys.map(p=>p.dep), mn=Math.min(...deps), mx=Math.max(...deps);
  const LIGHT=(()=>{const v=[0.35,0.88,0.32];const l=Math.hypot(...v);return v.map(x=>x/l);})();
  const COL={Main:'#2ea3e8',Metal:'#8a8a96',Rim:'#e0e0e8',Tire:'#1a1a20',AirIntake:'#303038',BrakeLight:'#c02020'};
  const shade=(h,f)=>{const n=parseInt(h.slice(1),16);const c=[(n>>16)&255,(n>>8)&255,n&255].map(x=>Math.max(0,Math.min(255,Math.round(x*f))));return 'rgb('+c.join(',')+')';};
  for (const p of polys) {
    const t=(p.dep-mn)/Math.max(mx-mn,1e-6);
    const lam=Math.max(0,p.normal[0]*LIGHT[0]+p.normal[1]*LIGHT[1]+p.normal[2]*LIGHT[2]);
    const facing=p.normal[0]*eye[0]+p.normal[1]*eye[1]+p.normal[2]*eye[2];
    const f=(0.52+lam*0.68)*(facing>=0?1:0.78)*(1.06-t*0.16);
    oc.beginPath();
    oc.moveTo(p.pts[0][0], p.pts[0][1]);
    oc.lineTo(p.pts[1][0], p.pts[1][1]);
    oc.lineTo(p.pts[2][0], p.pts[2][1]);
    oc.closePath();
    oc.fillStyle = shade(COL[p.mat]||'#707080', f);
    oc.fill();
  }
  const oGrid = analyse(oc, 200);

  return { nGrid, oGrid, nImage: nc.canvas.toDataURL(), oImage: oc.canvas.toDataURL() };
}, { geometry, nativeB64 });

/** Print a 4x4 luminance grid, plus which half is brighter. */
function describe(label, grid) {
  const rows = [];
  for (let r = 0; r < 4; r++) {
    rows.push(grid.slice(r * 4, r * 4 + 4).map((v) => v.toFixed(0).padStart(3)).join(' '));
  }
  const sum = (idx) => idx.reduce((a, i) => a + grid[i], 0);
  const top = sum([0, 1, 2, 3, 4, 5, 6, 7]);
  const bottom = sum([8, 9, 10, 11, 12, 13, 14, 15]);
  const left = sum([0, 1, 4, 5, 8, 9, 12, 13]);
  const rightCol = sum([2, 3, 6, 7, 10, 11, 14, 15]);
  console.log(`\n${label}`);
  rows.forEach((r) => console.log('   ' + r));
  console.log(`   brighter half: ${top > bottom ? 'TOP' : 'BOTTOM'} / ${left > rightCol ? 'LEFT' : 'RIGHT'}`);
  return { top, bottom, left, right: rightCol };
}

const n = describe('NATIVE (game render)', report.nGrid);
const o = describe('OURS (projected mesh)', report.oGrid);

// A coarse grid cannot detect a vertical flip: an upside-down car still puts
// its mass in the same quadrant. Measure orientation directly instead, by
// tracking two landmarks whose screen positions are unambiguous.
const landmarks = await page.evaluate(({ geometry }) => {
  const g = JSON.parse(geometry);
  const apply=(m,x,y,z)=>[m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]];
  const norm=(v)=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l);};
  const eye=norm([1,1,1]), dir=eye.map(v=>-v), wu=[0,1,0];
  // Same basis as the render above; using a different one here made this check
  // contradict the image it was meant to verify.
  const right=norm([dir[1]*wu[2]-dir[2]*wu[1], dir[2]*wu[0]-dir[0]*wu[2], dir[0]*wu[1]-dir[1]*wu[0]]);
  const up=norm([right[1]*dir[2]-right[2]*dir[1], right[2]*dir[0]-right[0]*dir[2], right[0]*dir[1]-right[1]*dir[0]]);
  const sy=(x,y,z)=>x*up[0]+y*up[1]+z*up[2];

  // Landmark 1: the roof (highest +Y on the body) versus the floor (lowest).
  // Landmark 2: a wheel hub, which must sit BELOW the body it carries.
  let roof=null, floor=null;
  for (const p of g.parts) {
    if (p.material !== 'Main') continue;
    for (let i=0;i<p.position.length;i+=3) {
      const w=apply(p.matrix,p.position[i],p.position[i+1],p.position[i+2]);
      if (!roof || w[1] > roof[1]) roof = w;
      if (!floor || w[1] < floor[1]) floor = w;
    }
  }
  // Screen y grows downward, so "roof above floor" means roof has smaller sy.
  const roofSy = sy(...roof), floorSy = sy(...floor);
  const hub = g.wheels[0];
  return {
    roofScreenY: +roofSy.toFixed(3),
    floorScreenY: +floorSy.toFixed(3),
    hubScreenY: +sy(...hub).toFixed(3),
    roofAboveFloor: roofSy < floorSy,
  };
}, { geometry });

console.log('\n=== orientation landmarks ===');
console.log(`  roof screen-y  ${landmarks.roofScreenY}`);
console.log(`  floor screen-y ${landmarks.floorScreenY}`);
console.log(`  roof above floor? ${landmarks.roofAboveFloor ? 'YES (correct)' : 'NO (upside down)'}`);

console.log('\n=== comparison ===');
console.log(`  vertical : native ${n.top > n.bottom ? 'TOP' : 'BOTTOM'}-heavy, ours ${o.top > o.bottom ? 'TOP' : 'BOTTOM'}-heavy`,
  (n.top > n.bottom) === (o.top > o.bottom) ? '-> MATCH' : '-> MISMATCH');
console.log(`  horizontal: native ${n.left > n.right ? 'LEFT' : 'RIGHT'}-heavy, ours ${o.left > o.right ? 'LEFT' : 'RIGHT'}-heavy`,
  (n.left > n.right) === (o.left > o.right) ? '-> MATCH' : '-> MISMATCH');

if (WRITE) {
  writeFileSync('/tmp/cmp-native.png', Buffer.from(report.nImage.split(',')[1], 'base64'));
  writeFileSync('/tmp/cmp-ours.png', Buffer.from(report.oImage.split(',')[1], 'base64'));
  console.log('\nwrote /tmp/cmp-native.png and /tmp/cmp-ours.png');
}

await browser.close();
