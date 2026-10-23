/**
 * Rasterise the PolyTrack car mesh with a real depth buffer.
 *
 * Why this replaces the polygon projection
 * ----------------------------------------
 * The car was drawn by projecting every triangle to a polygon, sorting them
 * back-to-front and letting SVG paint them in that order. That is painter's
 * algorithm, and it cannot render this model correctly, because the model's parts
 * interpenetrate rather than sitting one behind another:
 *
 * - `AirIntake` is a closed box inside the body shell, so its outer triangles are
 *   the nearest geometry at the point where they cross the bodywork.
 * - Each wheel's rim is nested inside the tyre, whose side faces are rings with a
 *   hole exactly the rim's radius, so the two sets of triangles interleave.
 * - The four wheels overlap each other and the body on screen.
 *
 * Each of those was patched by special-casing a material's draw order, and each
 * patch fixed one case and left the next. A triangle sort cannot express "this
 * surface is behind that one" when the surfaces cross.
 *
 * A depth buffer settles all of it from first principles: every pixel keeps the
 * depth of the nearest surface drawn so far, and a later triangle only wins where
 * it is genuinely nearer. No draw order is needed and no material is special.
 *
 * Cost is why this is still not three.js. The raster is done into an `ImageData`
 * at the target size and never touches WebGL, so there is no engine, no Draco
 * decoder and no shader compilation: the mesh is already flat JSON and this is
 * arithmetic over a few thousand triangles.
 */
import geometry from './carGeometry.json';

type Vec3 = [number, number, number];

interface MeshPart {
  name: string;
  material: string;
  matrix: number[];
  position: number[];
  uv: number[] | null;
  index: number[] | null;
}

interface WheelVariant {
  index: number;
  parts: MeshPart[];
}

export interface RasterOptions {
  /** Output edge length in pixels. */
  size: number;
  /** The style's `rims` byte, selecting which wheel art to draw. */
  rimsVariant?: number;
  /** The style's `exhaust` byte. */
  exhaustVariant?: number;
  /** Base colour per material, resolved by the caller from the player's paint. */
  colours: Record<string, string>;
  /**
   * Optional paint lookup. Given a triangle's material and its UV centroid, it
   * returns the pattern colour there, or null to use the material colour.
   */
  sample?: (material: string, u: number, v: number) => [number, number, number] | null;
  /**
   * Optional alpha per material, for surfaces that should let the body show
   * through. The model itself has no transparency.
   */
  alpha?: (material: string) => number;
  /** Drop the tyre's side faces, to check what occludes the rim. */
  dropTyreCaps?: boolean;
}

/**
 * Where the camera sits relative to the car.
 *
 * The game's own thumbnail camera, converted rather than approximated: the engine
 * places the eye at (1000.1, 1000.3, 1000) looking at (0.1, 0.3, 0), so the eye
 * offset from the car back to the viewer is an even (+1, +1, +1): 45 degrees of
 * azimuth at 35 degrees of elevation. The nose is at +Z, so an eye on the +Z side
 * looks at the front of the car, which is what the game's thumbnails show.
 *
 * Exported for tests, which assert which end of the car faces the viewer.
 */
export const EYE: Vec3 = (() => {
  const v: Vec3 = [1, 1, 1];
  const len = Math.hypot(...v);
  return [v[0] / len, v[1] / len, v[2] / len];
})();

const PARTS = geometry.parts as unknown as MeshPart[];
const SHARED_TYRE = (geometry.sharedTyre ?? []) as unknown as MeshPart[];
const WHEEL_VARIANTS = (geometry.wheelVariants ?? []) as unknown as WheelVariant[];
const EXHAUST_VARIANTS = (geometry.exhaustVariants ?? []) as unknown as WheelVariant[];
const HUB_POSITIONS = geometry.wheels as number[][];
const BODY_MIN = geometry.bodyMin as number[];
const BODY_MAX = geometry.bodyMax as number[];

/** The tyre plus the chosen rim and hub art. */
function wheelParts(rimsVariant: number): MeshPart[] {
  const v = WHEEL_VARIANTS.find((w) => w.index === rimsVariant) ?? WHEEL_VARIANTS[0];
  return [...SHARED_TYRE, ...(v?.parts ?? [])];
}

function exhaustParts(exhaustVariant: number): MeshPart[] {
  const v = EXHAUST_VARIANTS.find((e) => e.index === exhaustVariant);
  return v?.parts ?? [];
}

/**
 * The lighting direction, in model space.
 *
 * A single fixed key light from above and slightly in front, with the ambient
 * floor applied at shading time. This is a stand-in for the game's scene lighting
 * rather than a reproduction of it, which is what the flat projection used too,
 * so the car keeps the same sense of form it had before.
 */
const LIGHT_DIR: Vec3 = (() => {
  const v: Vec3 = [0.35, 0.88, 0.32];
  const len = Math.hypot(...v);
  return [v[0] / len, v[1] / len, v[2] / len];
})();

/** Perspective distance, in model units. The car is about 3.6 long. */
const CAMERA_DISTANCE = 14;

/**
 * Build the view transform once.
 *
 * The camera is the game's own thumbnail camera: the engine places the eye at
 * (1000.1, 1000.3, 1000) looking at (0.1, 0.3, 0), so the look direction is an
 * even (-1, -1, -1) and the eye offset, from car back to viewer, is (+1, +1, +1).
 * The basis is the ordinary right-handed one, with no screen-Y flip.
 */
const VIEW = (() => {
  const eye: Vec3 = [...EYE];
  const dir: Vec3 = [-eye[0], -eye[1], -eye[2]];
  const worldUp: Vec3 = [0, 1, 0];
  const right: Vec3 = [
    dir[1] * worldUp[2] - dir[2] * worldUp[1],
    dir[2] * worldUp[0] - dir[0] * worldUp[2],
    dir[0] * worldUp[1] - dir[1] * worldUp[0],
  ];
  const rl = Math.hypot(...right) || 1;
  right[0] /= rl; right[1] /= rl; right[2] /= rl;
  const up: Vec3 = [
    right[1] * dir[2] - right[2] * dir[1],
    right[2] * dir[0] - right[0] * dir[2],
    right[0] * dir[1] - right[1] * dir[0],
  ];
  return { eye, right, up };
})();

/**
 * Framing bounds, including the wheels, measured once from the geometry.
 *
 * Wheels stick out beyond the body, so they must be in the bounds or the car is
 * cropped.
 */
const BOUNDS = (() => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const consider = (x: number, y: number, z: number) => {
    const sx = x * VIEW.right[0] + y * VIEW.right[1] + z * VIEW.right[2];
    const sy = x * VIEW.up[0] + y * VIEW.up[1] + z * VIEW.up[2];
    if (sx < minX) minX = sx;
    if (sx > maxX) maxX = sx;
    if (sy < minY) minY = sy;
    if (sy > maxY) maxY = sy;
  };
  const apply = (m: number[], o: number[]): Vec3 => [
    m[0] * o[0] + m[4] * o[1] + m[8] * o[2] + m[12],
    m[1] * o[0] + m[5] * o[1] + m[9] * o[2] + m[13],
    m[2] * o[0] + m[6] * o[1] + m[10] * o[2] + m[14],
  ];
  const walk = (parts: MeshPart[], off?: Vec3) => {
    for (const p of parts) {
      for (let i = 0; i < p.position.length; i += 3) {
        const w = apply(p.matrix, [p.position[i], p.position[i + 1], p.position[i + 2]]);
        consider(w[0] + (off?.[0] ?? 0), w[1] + (off?.[1] ?? 0), w[2] + (off?.[2] ?? 0));
      }
    }
  };
  walk(PARTS);
  // Only the tyre and rim reach the outside of a wheel, so bounding the hub plus
  // the tyre's radius is enough and avoids walking all twenty variants.
  const r = 0.34;
  for (const [hx, hy, hz] of HUB_POSITIONS) {
    for (const dx of [-r, r]) for (const dy of [-r, r]) for (const dz of [-r, r]) {
      consider(hx + dx, hy + dy, hz + dz);
    }
  }
  return { minX, maxX, minY, maxY };
})();

/**
 * Rasterise the car into an RGBA buffer.
 *
 * Returns `ImageData`-compatible data plus its dimensions. The caller wraps it in
 * a canvas or converts it to a data URI; nothing here touches the DOM, so it also
 * runs under test.
 */
export function rasteriseCar(options: RasterOptions): {
  data: Uint8ClampedArray;
  width: number;
  height: number;
} {
  const {
    size,
    rimsVariant = 0,
    exhaustVariant = 0,
    colours,
    sample,
    alpha,
  } = options;

  const width = size;
  const height = size;
  const data = new Uint8ClampedArray(width * height * 4);

  // Colour cache, so parsing happens once per material rather than per triangle.
  const colourCache = new Map<string, [number, number, number]>();
  const colourOf = (material: string): [number, number, number] => {
    let c = colourCache.get(material);
    if (!c) {
      c = parseColour(colours[material] ?? '#ff00ff');
      colourCache.set(material, c);
    }
    return c;
  };

  const spanX = BOUNDS.maxX - BOUNDS.minX;
  const spanY = BOUNDS.maxY - BOUNDS.minY;
  const span = Math.max(spanX, spanY) * 1.08; // small margin so nothing touches the edge
  const cx = (BOUNDS.minX + BOUNDS.maxX) / 2;
  const cy = (BOUNDS.minY + BOUNDS.maxY) / 2;
  const scale = size / span;

  const project = (x: number, y: number, z: number): [number, number, number] => {
    const sx = x * VIEW.right[0] + y * VIEW.right[1] + z * VIEW.right[2];
    const sy = x * VIEW.up[0] + y * VIEW.up[1] + z * VIEW.up[2];
    // Depth along the eye offset: larger means farther from the camera.
    const sz = x * VIEW.eye[0] + y * VIEW.eye[1] + z * VIEW.eye[2];
    // Perspective, so the near wheels draw larger than the far ones. Dividing by
    // a distance that grows with `sz` is what makes that happen; the clamp stops
    // geometry behind the camera inverting.
    const persp =
      CAMERA_DISTANCE / Math.max(CAMERA_DISTANCE + sz, CAMERA_DISTANCE * 0.35);
    return [
      (sx - cx) * scale * persp + size / 2,
      size / 2 - (sy - cy) * scale * persp,
      sz,
    ];
  };

  const apply = (m: number[], x: number, y: number, z: number): Vec3 => [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];

  // The depth buffer. Larger means farther, so a pixel is written when the
  // incoming depth is smaller than what is already there. `Infinity` means empty.
  const depth = new Float32Array(width * height).fill(Infinity);

  /**
   * Rasterise a set of parts, optionally mirrored across X.
   *
   * The wheel mesh is authored for one side of the car only: its rim reaches the
   * outboard face at local x = +0.172 while its hub cap sits inboard at
   * x = -0.133. Placing that same mesh at a hub on the other side puts the cap
   * outboard and buries the rim, so the two sides of the car show the wrong face.
   * Mirroring X for the opposite side is what the game does.
   */
  const emit = (parts: MeshPart[], offset?: Vec3, mirrorX = false) => {
    for (const part of parts) {
      const idx = part.index;
      const count = idx ? idx.length : part.position.length / 3;
      for (let i = 0; i < count; i += 3) {
        const world: Vec3[] = [];
        const view: [number, number, number][] = [];
        for (let k = 0; k < 3; k++) {
          const vi = idx ? idx[i + k] : i + k;
          const w = apply(
            part.matrix,
            (mirrorX ? -1 : 1) * part.position[vi * 3],
            part.position[vi * 3 + 1],
            part.position[vi * 3 + 2]
          );
          if (offset) {
            w[0] += offset[0];
            w[1] += offset[1];
            w[2] += offset[2];
          }
          world.push(w);
          view.push(project(w[0], w[1], w[2]));
        }

        // Face normal, oriented toward the camera. The source mesh's winding
        // yields inward normals, and a face we can see always points at us, so
        // the sign is chosen by flipping when it faces away.
        const u: Vec3 = [
          world[1][0] - world[0][0],
          world[1][1] - world[0][1],
          world[1][2] - world[0][2],
        ];
        const v: Vec3 = [
          world[2][0] - world[0][0],
          world[2][1] - world[0][1],
          world[2][2] - world[0][2],
        ];
        let n: Vec3 = [
          u[1] * v[2] - u[2] * v[1],
          u[2] * v[0] - u[0] * v[2],
          u[0] * v[1] - u[1] * v[0],
        ];
        const nl = Math.hypot(...n) || 1;
        n = [n[0] / nl, n[1] / nl, n[2] / nl];

        // No back-face culling.
        //
        // Every mesh in this model is an open surface rather than a closed solid
        // (the body alone has 101 boundary edges, the rim 96), so there is no
        // consistent winding to cull against. The normals are oriented toward the
        // viewer for shading instead, which is what the flat projection did and
        // what these meshes are authored for.
        const toward =
          n[0] * VIEW.eye[0] + n[1] * VIEW.eye[1] + n[2] * VIEW.eye[2];
        if (toward < 0) n = [-n[0], -n[1], -n[2]];

        // Lambert against the key light, with a generous ambient floor: on a dark
        // car a low floor makes panels read as black holes rather than shadowed
        // paint. `toward` doubles as a facing term so edge-on panels dim slightly.
        const lambert = Math.max(0, n[0] * LIGHT_DIR[0] + n[1] * LIGHT_DIR[1] + n[2] * LIGHT_DIR[2]);
        const facing = Math.min(1, Math.abs(toward) * 1.6);
        const shade = (0.62 + lambert * 0.55) * (0.74 + facing * 0.26);

        const c = colourOf(part.material);
        const a = alpha ? alpha(part.material) : 1;

        // UVs are interpolated per pixel rather than sampled once per triangle.
        // A body triangle spans up to 18% by 31% of the atlas, so a single
        // centroid sample reads the wrong part of the pattern across most of it
        // and the car comes out speckled.
        let uvs: [number, number][] | null = null;
        if (sample && part.uv && part.material === 'Main') {
          const tri: [number, number][] = [];
          for (let k = 0; k < 3; k++) {
            const vi = idx ? idx[i + k] : i + k;
            tri.push([part.uv[vi * 2], part.uv[vi * 2 + 1]]);
          }
          uvs = tri;
        }

        rasterTriangle(
          data, depth, width, height,
          view[0], view[1], view[2],
          uvs,
          sample,
          part.material,
          c[0], c[1], c[2],
          shade,
          a
        );
      }
    }
  };

  for (const p of PARTS) emit([p]);
  emit(exhaustParts(exhaustVariant));
  for (const hub of HUB_POSITIONS) {
    // The mesh is authored so its rim faces +X and its hub cap faces -X. Which
    // side needs mirroring is therefore determined by which face the camera can
    // see at that hub, not by the sign of X alone; `WHEEL_MESH_FLIP` records the
    // side the source mesh already suits.
    emit(wheelParts(rimsVariant), [hub[0], hub[1], hub[2]], hub[0] > 0);
  }

  return { data, width, height };
}

/**
 * Fill one triangle with a depth test and 4x supersampled coverage.
 *
 * Supersampling is what keeps the silhouette clean at card sizes: at 56px a
 * single-sample edge on this mesh is visibly jagged, and the car is small enough
 * that most of what a viewer sees is edges.
 */
function rasterTriangle(
  data: Uint8ClampedArray,
  depth: Float32Array,
  width: number,
  height: number,
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
  uvs: [number, number][] | null,
  sample: RasterOptions['sample'],
  material: string,
  baseR: number,
  baseG: number,
  baseB: number,
  shade: number,
  alpha: number
): void {
  const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
  const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
  if (minX > maxX || minY > maxY) return;

  const area = edge(a, b, c);
  if (Math.abs(area) < 1e-9) return;
  const invArea = 1 / area;

  // Sample grid: 2x2 within each pixel, for coverage at the silhouette.
  const SUB = 2;
  const step = 1 / SUB;

  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      let covered = 0;
      let depthSum = 0;
      let uSum = 0;
      let vSum = 0;
      let uvN = 0;
      for (let sy = 0; sy < SUB; sy++) {
        for (let sx = 0; sx < SUB; sx++) {
          const x = px + (sx + 0.5) * step;
          const y = py + (sy + 0.5) * step;
          const w0 = edge(b, c, [x, y, 0]) * invArea;
          const w1 = edge(c, a, [x, y, 0]) * invArea;
          const w2 = edge(a, b, [x, y, 0]) * invArea;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          covered++;
          depthSum += w0 * a[2] + w1 * b[2] + w2 * c[2];
          if (uvs) {
            uSum += w0 * uvs[0][0] + w1 * uvs[1][0] + w2 * uvs[2][0];
            vSum += w0 * uvs[0][1] + w1 * uvs[1][1] + w2 * uvs[2][1];
            uvN++;
          }
        }
      }
      if (!covered) continue;

      const centreDepth = depthSum / covered;
      const o = py * width + px;
      if (centreDepth >= depth[o]) continue;

      const cov = (covered / (SUB * SUB)) * alpha;
      if (cov <= 0) continue;

      // The painted material starts from the pattern where there is one, and
      // from the flat material colour otherwise. Either way the same shading is
      // applied, so the paint and the trim stay lit consistently.
      let cr = baseR, cg = baseG, cb = baseB;
      if (uvs && sample) {
        // The pattern is smooth across a triangle, so sampling once at the
        // pixel's covered centre is accurate enough and much cheaper than
        // resampling every subsample.
        const painted = sample(material, uSum / uvN, vSum / uvN);
        if (painted) {
          cr = painted[0];
          cg = painted[1];
          cb = painted[2];
        }
      }
      cr *= shade;
      cg *= shade;
      cb *= shade;

      // A nearer surface takes the depth slot; a partially covered one keeps the
      // nearer of the two so a later far triangle cannot win.
      depth[o] = cov >= 0.999 ? centreDepth : Math.min(depth[o], centreDepth);
      blend(data, o * 4, cr, cg, cb, cov);
    }
  }
}

/** Twice the signed area of the triangle `abc` in screen space. */
function edge(a: [number, number, number], b: [number, number, number], c: [number, number, number]): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/** Compose a source colour over an existing pixel, given coverage in 0..1. */
function blend(
  data: Uint8ClampedArray,
  o: number,
  r: number,
  g: number,
  b: number,
  a: number
): void {
  if (a >= 0.999) {
    data[o] = r;
    data[o + 1] = g;
    data[o + 2] = b;
    data[o + 3] = 255;
    return;
  }
  const dstA = data[o + 3] / 255;
  const outA = a + dstA * (1 - a);
  if (outA <= 0) return;
  data[o] = (r * a + data[o] * dstA * (1 - a)) / outA;
  data[o + 1] = (g * a + data[o + 1] * dstA * (1 - a)) / outA;
  data[o + 2] = (b * a + data[o + 2] * dstA * (1 - a)) / outA;
  data[o + 3] = outA * 255;
}

/** Parse `#rgb` or `#rrggbb` into 0-255 components. */
function parseColour(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = Number.parseInt(h, 16);
  if (!Number.isFinite(n)) return [255, 0, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Framing bounds in view space, for tests. */
export const rasterBounds = { BODY_MIN, BODY_MAX, BOUNDS, HUB_POSITIONS };
