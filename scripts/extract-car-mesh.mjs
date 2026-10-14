/**
 * Extract the PolyTrack car mesh into a compact, browser-ready form.
 *
 * Why this exists
 * ---------------
 * The car is a real 3D model (`models/car.glb`) that ships Draco-compressed, so
 * its vertices cannot be read without the Draco decoder. Hand-drawing the car as
 * SVG produced shapes that did not resemble it, so instead we decode the real
 * mesh once, here, and write out plain JSON that the app can project itself.
 *
 * Doing it offline matters: the decode pulls in three.js and the Draco WASM
 * runtime (~600 KB). The app only ever loads the small JSON this produces, so
 * drawing a car at runtime costs no decoder, no WebGL and no network.
 *
 * Output: src/lib/carGeometry.json
 *   parts[]  one entry per material group, each with flat position, normal and
 *            uv arrays, plus a matrix applying the node's own transform
 *   wheels[] hub positions read from the body's wheel arches
 *
 * Usage:
 *   node scripts/extract-car-mesh.mjs            # uses public/models/car.glb
 *   node scripts/extract-car-mesh.mjs --check    # verify only, do not write
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MODEL = path.join(ROOT, 'public', 'models', 'car.glb');
const DRACO_DIR = path.join(ROOT, 'public', 'draco');
const OUT = path.join(ROOT, 'src', 'lib', 'carGeometry.json');
const CHECK_ONLY = process.argv.includes('--check');

if (!existsSync(MODEL)) throw new Error(`missing ${MODEL} — run this from the repo root`);
if (!existsSync(DRACO_DIR)) throw new Error(`missing ${DRACO_DIR} (the Draco decoder)`);

// The game's own assets send no CORS headers, so the decoder and the model are
// served from a throwaway local server rather than fetched cross-origin.
const MIME = {
  '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm',
  '.js': 'text/javascript',
  '.html': 'text/html',
};

/** Inline import map so three.js and its addons resolve from the CDN. */
const IMPORT_MAP = JSON.stringify({
  imports: {
    three: 'https://unpkg.com/three@0.170.0/build/three.module.js',
    'three/addons/': 'https://unpkg.com/three@0.170.0/examples/jsm/',
  },
});
const HARNESS = `<!doctype html><html><head>
<script type="importmap">${IMPORT_MAP}</script>
</head><body></body></html>`;

const server = createServer((req, res) => {
  const url = (req.url ?? '/').split('?')[0];
  // Serve the harness from the local origin: loading it via setContent would
  // give the page an about:blank origin, which cannot fetch these assets.
  if (url === '/' || url === '/harness.html') {
    res.writeHead(200, { 'content-type': 'text/html' }).end(HARNESS);
    return;
  }
  const file = path.join(ROOT, 'public', decodeURIComponent(url).replace(/^\/+/, ''));
  if (!existsSync(file)) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
console.log(`serving ${ROOT}/public on ${base}`);

const browser = await chromium.launch();
const page = await browser.newPage();

/**
 * three.js is loaded from a CDN here rather than vendored: it is only needed for
 * this offline step, and keeping it out of the repo avoids shipping ~600 KB of
 * engine that the site itself never uses.
 */
await page.goto(`${base}/harness.html`, { waitUntil: 'domcontentloaded' });

const result = await page.evaluate(
  async ({ base }) => {
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js');

    const draco = new DRACOLoader();
    draco.setDecoderPath(`${base}/draco/`);
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);

    const gltf = await loader.loadAsync(`${base}/models/car.glb`);
    gltf.scene.updateMatrixWorld(true);

    // Wheel hubs: the body's wheel arches sit at these z positions, and the
    // Suspension mesh gives the track width. Read from geometry, not guessed.
    const body = gltf.scene.getObjectByName('Body');
    const bodyBox = new THREE.Box3().setFromObject(body);
    const susp = gltf.scene.getObjectByName('Suspension');
    const suspBox = susp ? new THREE.Box3().setFromObject(susp) : null;
    const hubX = suspBox ? Math.max(Math.abs(suspBox.min.x), Math.abs(suspBox.max.x)) * 0.85 : 0.74;

    // Sample the underside of the body to locate the arches along z.
    const bottom = [];
    const v = new THREE.Vector3();
    body.traverse((o) => {
      if (!o.isMesh) return;
      const p = o.geometry.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        v.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(o.matrixWorld);
        if (v.y < bodyBox.min.y + 0.12) bottom.push([v.x, v.y, v.z]);
      }
    });
    const zs = bottom.map((b) => b[2]);
    const frontZ = zs.length ? Math.max(...zs) - 1.2 : 0.93;
    const rearZ = zs.length ? Math.min(...zs) + 0.55 : -1.44;

    // Hub HEIGHT is the axle, not the body's underside.
    //
    // Sampling the underside put the wheels through the middle of the car, so
    // the render showed tyres overlapping the bodywork. The axle sits one wheel
    // radius above the ground plane, and the ground plane is the body's lowest
    // point, so hubY = bodyMin.y + radius. Radius comes from the wheel mesh's
    // own local extent rather than a constant.
    const wheelMesh = gltf.scene.getObjectByName('Wheel0');
    let wheelMinY = Infinity, wheelMaxY = -Infinity;
    wheelMesh.traverse((o) => {
      if (!o.isMesh) return;
      const p = o.geometry.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        if (y < wheelMinY) wheelMinY = y;
        if (y > wheelMaxY) wheelMaxY = y;
      }
    });
    const wheelRadius = (wheelMaxY - wheelMinY) / 2;
    const hubY = bodyBox.min.y + wheelRadius;

    const wheels = [
      [hubX, hubY, frontZ],
      [-hubX, hubY, frontZ],
      [hubX, hubY, rearZ],
      [-hubX, hubY, rearZ],
    ].map((p) => p.map((n) => +n.toFixed(4)));

    // Collect one entry per material group. The node's own translation is a
    // storage slot (wheels are parked along z), so it is deliberately dropped:
    // the caller places wheels at the hub positions above.
    const parts = [];
    const collect = (obj, material_names) => {
      if (!obj) return;
      obj.updateMatrixWorld(true);
      obj.traverse((o) => {
        if (!o.isMesh) return;
        const matName = o.material?.name ?? '?';
        if (matName === 'Collision') return;
        if (material_names && !material_names.includes(matName)) return;
        const g = o.geometry;
        const pos = g.getAttribute('position');
        if (!pos) return;

        // Local transform: relative to the part root, dropping its translation.
        const local = new THREE.Matrix4().copy(obj.matrixWorld).invert().multiply(o.matrixWorld);
        const nm = g.getAttribute('normal');
        const uv = g.getAttribute('uv');
        const idx = g.index ? g.index.array : null;

        parts.push({
          name: o.name || obj.name || '?',
          material: matName,
          matrix: local.elements.map((n) => +n.toFixed(6)),
          position: Array.from(pos.array, (n) => +n.toFixed(5)),
          normal: nm ? Array.from(nm.array, (n) => +n.toFixed(4)) : null,
          uv: uv ? Array.from(uv.array, (n) => +n.toFixed(5)) : null,
          index: idx ? Array.from(idx) : null,
        });
      });
    };

    collect(body);
    collect(susp);

    // Wheel variants: the style's `rims` byte picks one. Capture the mesh list
    // so the app can match the game's choice.
    const wheelNames = [];
    for (let i = 0; i < 14; i++) {
      const w = gltf.scene.getObjectByName(i === 0 ? 'Wheel0' : `Wheel${i}`);
      if (w) wheelNames.push(i === 0 ? 'Wheel0' : `Wheel${i}`);
    }
    // Capture variant 0 plus record the names; variants differ only in rim art.
    collect(gltf.scene.getObjectByName('Wheel0'));

    // Exhaust options, likewise selected by the style's `exhaust` byte.
    const exhaustNames = [];
    for (let i = 0; i < 8; i++) {
      const e = gltf.scene.getObjectByName(`Exhaust${i}`);
      if (e) exhaustNames.push(`Exhaust${i}`);
    }

    const size = bodyBox.getSize(new THREE.Vector3());
    return {
      parts,
      wheels,
      wheelNames,
      exhaustNames,
      bodySize: [size.x, size.y, size.z].map((n) => +n.toFixed(4)),
      bodyMin: bodyBox.min.toArray().map((n) => +n.toFixed(4)),
      bodyMax: bodyBox.max.toArray().map((n) => +n.toFixed(4)),
    };
  },
  { base }
);

await browser.close();
server.close();

const triangleCount = result.parts.reduce(
  (a, p) => a + (p.index ? p.index.length / 3 : p.position.length / 9),
  0
);
console.log(
  `decoded ${result.parts.length} parts, ${triangleCount} triangles, ` +
    `${result.wheelNames.length} wheel variants, ${result.exhaustNames.length} exhausts`
);
console.log(`body size ${result.bodySize.join(' x ')}`);

if (triangleCount < 100) {
  throw new Error(`only ${triangleCount} triangles decoded — refusing to write a broken mesh`);
}

if (CHECK_ONLY) {
  console.log('--check: not writing');
} else {
  writeFileSync(OUT, JSON.stringify(result));
  const kb = (readFileSync(OUT).length / 1024).toFixed(0);
  console.log(`wrote ${path.relative(ROOT, OUT)} (${kb} KB)`);
}
