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

interface MeshPart {
  name: string;
  material: string;
  matrix: number[];
  position: number[];
  normal: number[] | null;
  uv: number[] | null;
  index: number[] | null;
}

/** Body and suspension, drawn once at the origin. */
const PARTS = geometry.parts as MeshPart[];

/**
 * The tyre, shared by every wheel variant.
 *
 * The twelve variants differ only in rim and hub art, so the tyre is stored once
 * in the geometry file rather than twelve times.
 */
const SHARED_TYRE = (geometry.sharedTyre ?? []) as MeshPart[];

/** Rim and hub art per `rims` byte, indexed by the variant's own index. */
const WHEEL_VARIANTS = (geometry.wheelVariants ?? []) as { index: number; parts: MeshPart[] }[];

/** Exhaust art per `exhaust` byte. */
const EXHAUST_VARIANTS = (geometry.exhaustVariants ?? []) as { index: number; parts: MeshPart[] }[];

/** The parts a given wheel variant draws: the shared tyre plus its own art. */
function wheelParts(rimsVariant: number): MeshPart[] {
  const v = WHEEL_VARIANTS.find((w) => w.index === rimsVariant) ?? WHEEL_VARIANTS[0];
  return [...SHARED_TYRE, ...(v?.parts ?? [])];
}

/** The parts a given exhaust variant draws, or none if the byte is unknown. */
function exhaustParts(exhaustVariant: number): MeshPart[] {
  const v = EXHAUST_VARIANTS.find((e) => e.index === exhaustVariant);
  return v?.parts ?? [];
}

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
 * Where the camera sits relative to the car.
 *
 * This is the game's own thumbnail camera, converted rather than approximated.
 * The engine places the eye at (1000.1, 1000.3, 1000) looking at (0.1, 0.3, 0),
 * so the view direction is an even (-1, -1, -1) and the eye offset, pointing from
 * the car back to the viewer, is (+1, +1, +1): 45 degrees of azimuth on the +Z
 * side at 35 degrees of elevation.
 *
 * The nose is at +Z (the narrow, low end; the tail carries the wide rear wing),
 * so an eye on the +Z side looks at the car's front, which is what the game's own
 * thumbnails show. Earlier versions had a negative Z here. That was compensating
 * for an inverted up vector rather than fixing it, and it is why the car rendered
 * back-to-front and, once the up vector was corrected, upside down.
 *
 * Exported for tests, which assert which end of the car faces the viewer.
 */
export const EYE: Vec3 = (() => {
  const v: Vec3 = [1, 1, 1];
  const len = Math.hypot(...v);
  return [v[0] / len, v[1] / len, v[2] / len];
})();

/** The eye offset, used as the depth axis. */
const EYE_OFFSET: Vec3 = EYE;

const VIEW_DIR: Vec3 = [-EYE_OFFSET[0], -EYE_OFFSET[1], -EYE_OFFSET[2]];

/**
 * Camera distance in model units, for the perspective divide.
 *
 * The car is roughly 3.6 units long. A larger value flattens the view toward
 * orthographic; this one keeps the near wheel visibly larger than the far one
 * without distorting the body the way a very close camera would.
 */
const CAMERA_DISTANCE = 14;

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
  // right = cross(dir, worldUp), which is the usual right-handed camera basis.
  const right: Vec3 = [
    dir[1] * worldUp[2] - dir[2] * worldUp[1],
    dir[2] * worldUp[0] - dir[0] * worldUp[2],
    dir[0] * worldUp[1] - dir[1] * worldUp[0],
  ];
  const rl = Math.hypot(...right) || 1;
  right[0] /= rl; right[1] /= rl; right[2] /= rl;
  // up = cross(right, dir).
  //
  // This sign is the one that puts the wheels BELOW the body. An earlier version
  // negated it and then flipped the eye's Z to compensate; the two errors
  // cancelled for the silhouette but left the car mirrored and inverted, so a
  // car facing left had its nose on the wrong side and its paint mirrored.
  // Deriving both from the game's camera keeps them consistent.
  const up: Vec3 = [
    right[1] * dir[2] - right[2] * dir[1],
    right[2] * dir[0] - right[0] * dir[2],
    right[0] * dir[1] - right[1] * dir[0],
  ];
  return { right, up };
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

/**
 * Project the car into a `size` x `size` box.
 *
 * `rimsVariant` and `exhaustVariant` are the style's `rims` and `exhaust` bytes.
 * They select which wheel art and exhaust the car wears, so a player's car looks
 * the same here as it does in the game.
 */
export function projectCar(size: number, rimsVariant = 0, exhaustVariant = 0): FlatPolygon[] {
  // Detail that contributes nothing at small sizes but costs a great deal.
  //
  // At 56px the full mesh is one triangle per pixel: they overlap into noise and
  // the car reads as a shapeless blob. The rim spokes and the metal trim inside
  // the wheels are the largest group and are sub-pixel below about 48px, so they
  // are dropped there. The tyre, body and wings are always kept, since those
  // carry the silhouette.
  const dropFineDetail = size <= 64;

  // Frame the car by its projected footprint rather than by its axis-aligned
  // size. At a 45 degree view the car's diagonal is much longer than either
  // spanX or spanY, so scaling by those left a wide empty margin and the car
  // sat small in its box.
  const spanX = BOUNDS.maxX - BOUNDS.minX;
  const spanY = BOUNDS.maxY - BOUNDS.minY;
  const span = Math.max(spanX, spanY) * 1.08;
  const cx = (BOUNDS.minX + BOUNDS.maxX) / 2;
  const cy = (BOUNDS.minY + BOUNDS.maxY) / 2;
  const scale = size / span;

  const out: FlatPolygon[] = [];
  /**
   * Project a world point to the canvas.
   *
   * Perspective, not orthographic: dividing by distance makes nearer geometry
   * larger. A flat projection draws the far wheels the same size as the near
   * ones, which reads as a deformed car and destroys the sense of depth.
   *
   * `CAMERA_DISTANCE` is in model units, where the car is about 3.6 long. The
   * value is a compromise: too small and the near wing balloons, too large and
   * the effect disappears.
   */
  const project = (x: number, y: number, z: number): [number, number] => {
    const sx = x * BASIS.right[0] + y * BASIS.right[1] + z * BASIS.right[2];
    const sy = x * BASIS.up[0] + y * BASIS.up[1] + z * BASIS.up[2];
    // Distance along the view axis; clamped so geometry behind the camera cannot
    // invert.
    // `sz` grows with distance from the camera (the same convention the depth
    // sort uses), so the divisor ADDS it: far geometry gets a smaller factor and
    // therefore draws smaller. Subtracting here inverted the effect, making the
    // far wheels larger than the near ones.
    const sz = x * EYE_OFFSET[0] + y * EYE_OFFSET[1] + z * EYE_OFFSET[2];
    const persp = CAMERA_DISTANCE / Math.max(CAMERA_DISTANCE + sz, CAMERA_DISTANCE * 0.35);
    return [
      (sx - cx) * scale * persp + size / 2,
      size / 2 - (sy - cy) * scale * persp,
    ];
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
  for (const p of PARTS) emit(p.matrix, p.position, p.index, p.material, undefined, p.uv);

  // Exhaust: the style's `exhaust` byte picks one set, drawn once at the tail.
  for (const p of exhaustParts(exhaustVariant)) {
    emit(p.matrix, p.position, p.index, p.material, undefined, p.uv);
  }

  // Wheels are the SAME mesh instance placed at each hub, so they are emitted
  // only at the hubs. Emitting them here as well (which an earlier version did)
  // leaves a fifth set sitting at the origin, on top of the bodywork: with four
  // wheels' worth of extra triangles that covered the car entirely.
  //
  // Each wheel is projected and sorted as its own closed object, then inserted at
  // its own depth. Sorting all four wheels' triangles in one global list let a
  // triangle from one wheel paint over another wheel's rim: the tyre's side faces
  // span the whole depth range of the wheel, so they landed on top of rims at
  // entirely different hubs. Grouping keeps each wheel's internal order correct,
  // which is all that matters for a convex-ish object of this size.
  type WheelGroup = { depth: number; polys: FlatPolygon[] };
  const wheelGroups: WheelGroup[] = [];
  for (const [wx, wy, wz] of WHEELS) {
    const before = out.length;
    for (const p of wheelParts(rimsVariant)) {
      // Keep the tyre for the silhouette; skip the rim and metal when small.
      if (dropFineDetail && p.material !== 'Tire') continue;
      emit(p.matrix, p.position, p.index, p.material, [wx, wy, wz], p.uv);
    }
    const polys = out.splice(before);
    if (!polys.length) continue;
    let sum = 0;
    for (const q of polys) sum += q.depth;
    wheelGroups.push({ depth: sum / polys.length, polys });
  }

  // Within a wheel the draw order is: the tyre's FAR side face, then the rim,
  // then the tyre's NEAR side face.
  //
  // The tyre is an annulus whose hole (radius 0.258) is exactly the rim's radius,
  // so the rim is only ever visible through it. Depth-sorting the tyre and rim
  // against each other interleaves them — the order alternated over a thousand
  // times in a single wheel — which left the rim as a crescent sliver around the
  // edge instead of a disc. Ordering by material instead drew the rim over the
  // whole tyre, spilling a bright disc outside the wheel.
  //
  // What is actually true is that the tyre's two side faces straddle the rim:
  // one is nearer the camera than the rim, the other farther. So they are told
  // apart by which way they face and the rim is drawn between them. The tread
  // needs no special case: it is the wheel's outer surface and never overlaps the
  // rim on screen.
  const wheelOrder = (p: FlatPolygon): number => {
    if (p.material === 'Rim' || p.material === 'Metal') return 1;
    if (p.material !== 'Tire') return 0;
    // A side face points along the wheel axis (X); the tread points outward.
    if (Math.abs(p.normal[0]) <= 0.7) return 0;
    // A side face pointing away from the camera is the far one.
    const toward =
      p.normal[0] * EYE_OFFSET[0] + p.normal[1] * EYE_OFFSET[1] + p.normal[2] * EYE_OFFSET[2];
    return toward < 0 ? 0 : 2;
  };

  // Painter's algorithm: draw the farthest first.
  out.sort((a, b) => b.depth - a.depth);

  // Slot each wheel in whole, at its own depth, with its own far-to-near order.
  for (const g of wheelGroups.sort((a, b) => b.depth - a.depth)) {
    let at = out.findIndex((q) => q.depth < g.depth);
    if (at === -1) at = out.length;
    const inner = g.polys
      .slice()
      .sort((a, b) => wheelOrder(a) - wheelOrder(b) || b.depth - a.depth);
    out.splice(at, 0, ...inner);
  }

  // Interior geometry is drawn before the bodywork, not sorted against it.
  //
  // `AirIntake` is a closed black box sitting entirely inside the body shell: its
  // bounds are within the body's on every axis. The body mesh has genuine holes
  // where the cockpit opening and the side vents are, and the game shows the dark
  // intake through them. Sorted purely by depth, the intake's outermost triangles
  // legitimately land in front of the body at that point, so painter's algorithm
  // painted a black slab across the roof and flanks, which is what made the car
  // look like its internals were on the outside.
  //
  // Painting it first reproduces the game exactly: the openings stay dark because
  // nothing covers them, and everywhere else the body paints over the box.
  const interior = new Set(['AirIntake']);
  const isInterior = (p: FlatPolygon) => interior.has(p.material);
  if (out.some(isInterior)) {
    const inner = out.filter(isInterior);
    const shell = out.filter((p) => !isInterior(p));
    // Each group keeps its own back-to-front order. SVG paints in document
    // order, so the interior is emitted FIRST and the bodywork paints over it.
    out.length = 0;
    out.push(...inner, ...shell);
  }
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
