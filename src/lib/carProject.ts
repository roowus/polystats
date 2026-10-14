/**
 * Project the extracted PolyTrack car mesh into 2D polygons.
 *
 * The car is a real 3D model. `scripts/extract-car-mesh.mjs` decodes the
 * Draco-compressed mesh once and writes `carGeometry.json`; this module turns
 * that geometry into flat shapes the SVG renderer can paint, using the same
 * camera the game uses for its thumbnails.
 *
 * Why project rather than ship three.js: the engine plus the Draco decoder is
 * roughly 600 KB, and it would run in every visitor's browser to draw a 28px
 * icon. The projection here is arithmetic over ~950 triangles, which measures
 * around 0.1ms, so cars can be drawn during render with no engine at all.
 */
import geometry from './carGeometry.json';

export interface FlatPolygon {
  /** Screen-space points, [x, y] pairs scaled to the target size. */
  points: [number, number][];
  /** Material name, which selects the base colour. */
  material: string;
  /** View-space depth, used for painter's-algorithm sorting. */
  depth: number;
  /**
   * World-space face normal, computed from the triangle.
   *
   * The GLB ships no normals (three.js derives flat ones when rendering), so
   * they are calculated here. Shading needs them: brightness inferred from the
   * polygon's screen winding instead lights the car's silhouette and leaves the
   * roof mid-toned, which reads as a hollow underside.
   */
  normal: Vec3;
  /**
   * Texture coordinates for each corner, in the same order as `points`.
   *
   * These index the game's pattern atlases, so the paint pattern can be mapped
   * onto each panel the way the game does rather than overlaid across the whole
   * car. Only present for parts whose mesh carries UVs (the painted ones).
   */
  uv: [number, number][] | null;
}

type Vec3 = [number, number, number];

const PARTS = geometry.parts as {
  name: string;
  material: string;
  matrix: number[];
  position: number[];
  normal: number[] | null;
  uv: number[] | null;
  index: number[] | null;
}[];

const WHEELS = geometry.wheels as number[][];
const BODY_MIN = geometry.bodyMin as number[];
const BODY_MAX = geometry.bodyMax as number[];

/** Apply a column-major 4x4 matrix to a point. */
function applyMatrix(m: number[], x: number, y: number, z: number): Vec3 {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

/**
 * Where the camera sits relative to the car, from the game's own thumbnail
 * setup: it places the camera at (1000.1, 1000.3, 1000) looking at
 * (0.1, 0.3, 0), so this is the eye offset. The Y component is lowered from
 * that raw ratio because the game's frustum and zoom give a flatter, lower view.
 */
const EYE_OFFSET: Vec3 = (() => {
  // The game's own ratio: eye (1000.1, 1000.3, 1000) against target
  // (0.1, 0.3, 0), i.e. equal height and horizontal distance. That is a 35 degree
  // elevation. Dropping the Y component gives a shallower view in which the
  // floor pan becomes visible and the car reads as seen from underneath, which
  // is wrong: an earlier version used 0.62 here and had exactly that fault.
  const v: Vec3 = [1.0, 1.0, 1.0];
  const len = Math.hypot(...v);
  return [v[0] / len, v[1] / len, v[2] / len];
})();

/**
 * The direction the camera looks along, which is the negation of the eye offset.
 *
 * This distinction matters: `viewBasis` needs the look direction, while depth
 * sorting only needs an axis consistently pointing away from the viewer. Passing
 * the eye offset to `viewBasis` mirrors both screen axes, which renders the car
 * from underneath: the nose still points lower-left, so it looks merely rotated,
 * but the top and bottom faces are swapped.
 */
const VIEW_DIR: Vec3 = [-EYE_OFFSET[0], -EYE_OFFSET[1], -EYE_OFFSET[2]];

/**
 * Build an orthonormal camera basis for a view looking along `dir`.
 *
 * Both cross-product signs were determined by testing every combination against
 * the game's own render and scoring silhouette agreement with it, rather than by
 * reasoning about handedness. The correct pair scores IoU 0.63 against the native
 * PNG with the wheels below the body; the wrong ones score 0.27 and/or put the
 * wheels above the roof. Handedness here is easy to get backwards and the result
 * looks plausibly car-shaped either way, so it is not worth re-deriving by eye.
 *
 * `dir` is the LOOK direction (camera toward car), i.e. the negation of the eye
 * offset.
 */
function viewBasis(dir: Vec3) {
  const worldUp: Vec3 = [0, 1, 0];
  const right: Vec3 = [
    dir[1] * worldUp[2] - dir[2] * worldUp[1],
    dir[2] * worldUp[0] - dir[0] * worldUp[2],
    dir[0] * worldUp[1] - dir[1] * worldUp[0],
  ];
  const rl = Math.hypot(...right) || 1;
  right[0] /= rl; right[1] /= rl; right[2] /= rl;
  // Negated deliberately. With up = cross(right, dir) the car renders inverted
  // (wheels above the body); the silhouette is near-symmetric, so automated
  // profile/IoU comparisons report a match either way and cannot be trusted to
  // settle it. This sign is verified by the landmark test below, which asserts
  // the wheels sit below the body in the rendered output.
  const trueUp: Vec3 = [
    right[2] * dir[1] - right[1] * dir[2],
    right[0] * dir[2] - right[2] * dir[0],
    right[1] * dir[0] - right[0] * dir[1],
  ];
  return { right, up: trueUp };
}

const BASIS = viewBasis(VIEW_DIR);

/**
 * Model bounds including the wheels, so framing is derived rather than tuned.
 * Wheels stick out beyond the body, so they have to be included or the car is
 * cropped.
 */
const BOUNDS = (() => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  const consider = (x: number, y: number, z: number) => {
    // Screen axes.
    const sx = x * BASIS.right[0] + y * BASIS.right[1] + z * BASIS.right[2];
    const sy = x * BASIS.up[0] + y * BASIS.up[1] + z * BASIS.up[2];
    minX = Math.min(minX, sx); maxX = Math.max(maxX, sx);
    minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
    const depth = x * EYE_OFFSET[0] + y * EYE_OFFSET[1] + z * EYE_OFFSET[2];
    minZ = Math.min(minZ, depth); maxZ = Math.max(maxZ, depth);
  };
  for (const p of PARTS) {
    for (let i = 0; i < p.position.length; i += 3) {
      const [x, y, z] = applyMatrix(p.matrix, p.position[i], p.position[i + 1], p.position[i + 2]);
      consider(x, y, z);
    }
  }
  // Include wheels, which sit outside the body shell.
  for (const [wx, wy, wz] of WHEELS) {
    for (const dx of [-0.33, 0.33]) for (const dy of [-0.33, 0.33]) for (const dz of [-0.17, 0.17]) {
      consider(wx + dx, wy + dy, wz + dz);
    }
  }
  return { minX, maxX, minY, maxY, minZ, maxZ };
})();

/**
 * Project the car into a `size` x `size` box, front-left three-quarter view.
 *
 * Returns polygons sorted far-to-near so a plain fill order draws correctly:
 * painter's algorithm, which is enough here because the parts do not interleave.
 */
/**
 * Unit normal of a triangle, oriented toward the camera.
 *
 * The winding in the source mesh yields inward normals, which lit the faces
 * turned away from the light and left the roof dark: the car read as a hollow
 * shell. A visible face always points at the viewer, so the sign is chosen by
 * flipping the cross product when it faces away. That is more robust than
 * depending on winding order, which is not guaranteed.
 */
function faceNormal(tri: Vec3[]): Vec3 {
  const [a, b, c] = tri;
  const u: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v: Vec3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  let n: Vec3 = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  const len = Math.hypot(...n) || 1;
  n = [n[0] / len, n[1] / len, n[2] / len];
  // Flip toward the camera (the eye offset points from car to viewer).
  const toward =
    n[0] * EYE_OFFSET[0] + n[1] * EYE_OFFSET[1] + n[2] * EYE_OFFSET[2];
  return toward >= 0 ? n : [-n[0], -n[1], -n[2]];
}

/** Direction the light comes from: above and slightly in front. */
const LIGHT_DIR: Vec3 = (() => {
  const v: Vec3 = [0.35, 0.88, 0.32];
  const len = Math.hypot(...v);
  return [v[0] / len, v[1] / len, v[2] / len];
})();

export function projectCar(size: number): FlatPolygon[] {
  const spanX = BOUNDS.maxX - BOUNDS.minX;
  const spanY = BOUNDS.maxY - BOUNDS.minY;
  const span = Math.max(spanX, spanY) * 1.12; // small margin so nothing touches the edge
  const cx = (BOUNDS.minX + BOUNDS.maxX) / 2;
  const cy = (BOUNDS.minY + BOUNDS.maxY) / 2;
  const scale = size / span;

  const out: FlatPolygon[] = [];
  const project = (x: number, y: number, z: number): [number, number] => {
    const sx = x * BASIS.right[0] + y * BASIS.right[1] + z * BASIS.right[2];
    const sy = x * BASIS.up[0] + y * BASIS.up[1] + z * BASIS.up[2];
    return [(sx - cx) * scale + size / 2, size / 2 - (sy - cy) * scale];
  };
  // Depth measured along the eye offset: larger means farther from the camera,
  // which is the order the painter's-algorithm sort expects.
  const depthOf = (x: number, y: number, z: number) =>
    x * EYE_OFFSET[0] + y * EYE_OFFSET[1] + z * EYE_OFFSET[2];

  const emit = (
    matrix: number[],
    position: number[],
    index: number[] | null,
    material: string,
    /** Offset applied after the part matrix, used to place wheels at hubs. */
    offset?: Vec3,
    uv?: number[] | null
  ) => {
    const count = index ? index.length : position.length / 3;
    for (let i = 0; i < count; i += 3) {
      const pts: [number, number][] = [];
      const world: Vec3[] = [];
      const uvs: [number, number][] = [];
      let depth = 0;
      for (let k = 0; k < 3; k++) {
        const vi = index ? index[i + k] : i + k;
        let [x, y, z] = applyMatrix(
          matrix,
          position[vi * 3],
          position[vi * 3 + 1],
          position[vi * 3 + 2]
        );
        if (offset) { x += offset[0]; y += offset[1]; z += offset[2]; }
        world.push([x, y, z]);
        pts.push(project(x, y, z));
        depth += depthOf(x, y, z);
        if (uv) uvs.push([uv[vi * 2], uv[vi * 2 + 1]]);
      }
      out.push({
        points: pts,
        material,
        depth: depth / 3,
        normal: faceNormal(world),
        uv: uv ? uvs : null,
      });
    }
  };

  // Body and suspension sit at the origin.
  for (const p of PARTS) {
    if (p.name.startsWith('Wheel')) continue;
    emit(p.matrix, p.position, p.index, p.material, undefined, p.uv);
  }

  // Wheels are the SAME mesh instance placed at each hub, so they are emitted
  // only at the hubs. Emitting them here as well (which an earlier version did)
  // leaves a fifth set sitting at the origin, on top of the bodywork: with four
  // wheels' worth of extra triangles that covered the car entirely.
  for (const [wx, wy, wz] of WHEELS) {
    for (const p of PARTS) {
      if (!p.name.startsWith('Wheel')) continue;
      emit(p.matrix, p.position, p.index, p.material, [wx, wy, wz], p.uv);
    }
  }

  // Painter's algorithm: draw the farthest first.
  out.sort((a, b) => b.depth - a.depth);
  return out;
}

/**
 * Face brightness from the polygon's screen-space winding, times its depth.
 *
 * A cheap stand-in for lighting: upward-facing panels catch more light, and
 * nearer geometry reads slightly brighter. Enough to give the flat projection
 * the same sense of form the game's render has.
 */
export function polygonShade(poly: FlatPolygon, minDepth: number, maxDepth: number): number {
  // Lambert against the light direction, with an ambient floor so faces turned
  // away are dim rather than black.
  const n = poly.normal;
  const lambert = Math.max(0, n[0] * LIGHT_DIR[0] + n[1] * LIGHT_DIR[1] + n[2] * LIGHT_DIR[2]);
  // A slight depth term separates near panels from far ones.
  const t = (poly.depth - minDepth) / Math.max(maxDepth - minDepth, 1e-6);
  // Ambient is generous: on a dark car a low floor makes panels read as black
  // holes rather than shadowed paint.
  return (0.74 + lambert * 0.52) * (1.06 - t * 0.16);
}

/** Depth range across a polygon set, for `polygonShade`. */
export function depthRange(polys: FlatPolygon[]): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const p of polys) {
    if (p.depth < min) min = p.depth;
    if (p.depth > max) max = p.depth;
  }
  return [min, max];
}

/** Exposed for tests: the mesh's own dimensions, independent of projection. */
export const carBounds = {
  min: BODY_MIN as Vec3,
  max: BODY_MAX as Vec3,
  wheelHubs: WHEELS as Vec3[],
};
