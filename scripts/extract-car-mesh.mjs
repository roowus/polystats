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

page.on('console', (m) => console.log('PAGE:', m.text()));
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
    const wheelMesh = gltf.scene.getObjectByName('Wheel0');

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


    // Hub X: one track width for all four wheels.
    //
    // A car has a single track, not a different one per axle. Deriving it from
    // the body's width at each end (an earlier attempt) gave 0.873 front and
    // 0.672 rear, which made the front wheels look wider than the rear and read
    // as a deformed, backwards-facing car. The Suspension mesh spans the axles,
    // so its X extent is the track.
    const wheelHalfWidth = (() => {
      let mn = Infinity, mx = -Infinity;
      wheelMesh.traverse((o) => {
        if (!o.isMesh) return;
        const p = o.geometry.getAttribute('position');
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i);
          if (x < mn) mn = x;
          if (x > mx) mx = x;
        }
      });
      return (mx - mn) / 2;
    })();
    const suspExtent = (() => {
      if (!susp) return bodyBox.max.x;
      let m = 0;
      susp.traverse((o) => {
        if (!o.isMesh) return;
        const p = o.geometry.getAttribute('position');
        for (let i = 0; i < p.count; i++) m = Math.max(m, Math.abs(p.getX(i)));
      });
      return m;
    })();
    // The hub sits at the axle end, so the tyre's centre is the track half-width.
    const hubX = suspExtent > 0 ? suspExtent : bodyBox.max.x - wheelHalfWidth;

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

    // Hub height: the axle sits level with the body's floor, and the tyre hangs
    // one radius below that to meet the ground.
    //
    // Measured from the assembled model: with the parked wheel library hidden,
    // the body occupies y = -0.3444 .. 0.3801 and the tyre is 0.6613 across with
    // its centre on the body's floor line. The ground is therefore at
    // -0.3444 - 0.3307 = -0.6751.
    //
    // Two earlier attempts were wrong. `bodyBox.min.y + wheelRadius` put the
    // wheels at the body's midline, drawn sunk into the shell. Reading the
    // suspension box's own minimum was worse: its arms hang 0.14 below the
    // contact patch, which pushed the wheels clear of the bodywork entirely.
    const hubY = bodyBox.min.y;

    // The real axle positions come from the Suspension mesh, which is modelled
    // as four axle ends. Parked wheel groups (Wheel0..Wheel13) sit at y=1 and
    // march down -Z purely as storage, so their own transforms are meaningless
    // here and are deliberately ignored.
    const axleZ = susp
      ? [...new Set(
          (() => {
            const zs = [];
            susp.traverse((o) => {
              if (!o.isMesh) return;
              const p = o.geometry.getAttribute('position');
              for (let i = 0; i < p.count; i++) {
                const v2 = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(o.matrixWorld);
                if (Math.abs(v2.x) > 0.2) zs.push(+v2.z.toFixed(3));
              }
            });
            return zs.map((z) => Math.round(z * 2) / 2);
          })()
        )].sort((a, b) => a - b)
      : [rearZ, frontZ];

    const wheelZ = axleZ.length >= 2 ? [axleZ[axleZ.length - 1], axleZ[0]] : [frontZ, rearZ];

    const wheels = [
      [hubX, hubY, wheelZ[0]],
      [-hubX, hubY, wheelZ[0]],
      [hubX, hubY, wheelZ[1]],
      [-hubX, hubY, wheelZ[1]],
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

        // Skip geometry with no thickness. `Body_3` is a flat plane lying exactly
        // on the body's floor height and spanning the whole car: a shadow catcher
        // the game composites under the model. Projected flat it becomes a slab
        // that covers the entire car, which is what made the render read as a
        // shapeless grey mass.
        //
        // The extents are measured by hand: Draco decodes to an interleaved
        // attribute, and `Box3.setFromBufferAttribute` returns an empty box for
        // those.
        const lo = [Infinity, Infinity, Infinity];
        const hi = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < pos.count; i++) {
          const c = [pos.getX(i), pos.getY(i), pos.getZ(i)];
          for (let k = 0; k < 3; k++) {
            if (c[k] < lo[k]) lo[k] = c[k];
            if (c[k] > hi[k]) hi[k] = c[k];
          }
        }
        const dims = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
        // A plane has one dimension of (near) zero and two large ones. The
        // smallest is dims[0]; requiring the other two to be large keeps real
        // parts, whose thinnest axis (a wing, a brake light) is still 0.02+.
        const flat = dims.slice().sort((a, b) => a - b);
        if (flat[0] < 0.005 && flat[2] > 0.5) {
          console.log(`skipping flat plane ${o.name} (${dims.map((d) => d.toFixed(3)).join(' x ')})`);
          return;
        }

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

    // Wheel variants: the style's `rims` byte picks one.
    //
    // Every variant is captured, not just variant 0. They differ in rim art, and
    // a player who chose variant 5 was being drawn with variant 0's wheels, so
    // the car did not match the one in the game.
    //
    // The groups are parked along -Z as storage (Wheel0 at z=0, Wheel1 at z=-1
    // and so on), so each variant is re-centred on the origin before its meshes
    // are read. The app places the result at the four hubs.
    // The tyre is byte-identical in every variant, so it is stored once instead
    // of twelve times. Only the rim and hub art actually varies; storing all
    // three per variant tripled the file for no gain.
    //
    // The tyre's two side faces are dropped. See `dropTyreCaps` below.
    //
    // The tyre is an annulus: its side faces are rings between an inner radius of
    // 0.258 and an outer radius of 0.331, and the rim's radius is exactly 0.258,
    // so the rim fills the hole. Drawn flat, those ring triangles still cover the
    // hole on screen and, being at the same depth as the rim, won the painter's
    // sort and hid it. Only the tread carries the silhouette, so only the tread is
    // kept.
    const dropTyreCaps = (tyreParts) =>
      tyreParts.map((part) => {
        const idx = part.index;
        if (!idx) return part;
        const axis = Math.abs(part.matrix[0]) >= Math.abs(part.matrix[5]) ? 0 : 1;
        const keep = [];
        for (let i = 0; i < idx.length; i += 3) {
          const v = [0, 1, 2].map((k) => {
            const j = idx[i + k];
            return [part.position[j * 3], part.position[j * 3 + 1], part.position[j * 3 + 2]];
          });
          const u = [v[1][0] - v[0][0], v[1][1] - v[0][1], v[1][2] - v[0][2]];
          const w = [v[2][0] - v[0][0], v[2][1] - v[0][1], v[2][2] - v[0][2]];
          const n = [
            u[1] * w[2] - u[2] * w[1],
            u[2] * w[0] - u[0] * w[2],
            u[0] * w[1] - u[1] * w[0],
          ];
          const len = Math.hypot(...n) || 1;
          // A side face points along the wheel axis; the tread points outward.
          if (Math.abs(n[axis] / len) < 0.7) keep.push(idx[i], idx[i + 1], idx[i + 2]);
        }
        return { ...part, index: keep };
      });

    let sharedTyre = null;
    const wheelVariants = [];
    for (let i = 0; i < 14; i++) {
      const name = i === 0 ? 'Wheel0' : `Wheel${i}`;
      const w = gltf.scene.getObjectByName(name);
      if (!w) continue;
      // Re-centre: the group's own translation is a storage slot, not a fitment.
      const saved = w.position.clone();
      w.position.set(0, 0, 0);
      w.updateMatrixWorld(true);
      const start = parts.length;
      collect(w);
      const captured = parts.splice(start);
      w.position.copy(saved);
      w.updateMatrixWorld(true);
      const tyre = captured.filter((p) => p.material === 'Tire');
      if (!sharedTyre && tyre.length) sharedTyre = tyre;
      wheelVariants.push({
        index: i,
        parts: captured.filter((p) => p.material !== 'Tire'),
      });
    }

    // Exhaust options, likewise selected by the style's `exhaust` byte. These sit
    // at the tail and are drawn once, not instanced.
    const exhaustVariants = [];
    for (let i = 0; i < 8; i++) {
      const e = gltf.scene.getObjectByName(`Exhaust${i}`);
      if (!e) continue;
      const saved = e.position.clone();
      e.position.set(0, 0, 0);
      e.updateMatrixWorld(true);
      const start = parts.length;
      collect(e);
      const captured = parts.splice(start);
      e.position.copy(saved);
      e.updateMatrixWorld(true);
      exhaustVariants.push({ index: i, parts: captured });
    }

    const size = bodyBox.getSize(new THREE.Vector3());
    return {
      parts,
      wheels,
      sharedTyre,
      wheelVariants,
      exhaustVariants,
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
    `${result.wheelVariants.length} wheel variants, ${result.exhaustVariants.length} exhausts`
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
