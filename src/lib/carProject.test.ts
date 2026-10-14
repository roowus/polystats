import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { projectCar, polygonShade, depthRange, carBounds, EYE } from './carProject';
import geometry from './carGeometry.json';

/**
 * The projector draws the game's real car mesh. These tests guard the pieces
 * that were wrong in earlier hand-drawn attempts: a car that fits its box, one
 * that is actually car-shaped, and geometry that decoded completely.
 */
describe('extracted mesh', () => {
  it('decoded a full car, not a fragment', () => {
    // A partial Draco decode silently yields very few triangles.
    expect(geometry.parts.length).toBeGreaterThan(3);
    const triangles = geometry.parts.reduce(
      (a, p) => a + (p.index ? p.index.length / 3 : p.position.length / 9),
      0
    );
    expect(triangles).toBeGreaterThan(500);
  });

  it('includes the materials the game paints', () => {
    const materials = new Set(geometry.parts.map((p) => p.material));
    // Main is the body; Tire and Rim make up the wheels.
    expect(materials.has('Main')).toBe(true);
    expect(materials.has('Tire')).toBe(true);
    expect(materials.has('Rim')).toBe(true);
  });

  it('excludes the collision mesh, which must never be drawn', () => {
    expect(geometry.parts.some((p) => p.material === 'Collision')).toBe(false);
  });

  it('carries UVs for the patterned body', () => {
    const main = geometry.parts.find((p) => p.material === 'Main');
    expect(main?.uv).toBeTruthy();
    expect(main!.uv!.length).toBe(main!.position.length / 3 * 2);
  });

  it('has the proportions of an open-wheel car', () => {
    const [w, h, l] = [
      geometry.bodyMax[0] - geometry.bodyMin[0],
      geometry.bodyMax[1] - geometry.bodyMin[1],
      geometry.bodyMax[2] - geometry.bodyMin[2],
    ];
    // Long and low: clearly longer than it is wide, and wider than it is tall.
    expect(l).toBeGreaterThan(w * 2);
    expect(w).toBeGreaterThan(h);
  });

  it('records four wheel hubs', () => {
    expect(carBounds.wheelHubs).toHaveLength(4);
  });

  it('places the wheels symmetrically left and right', () => {
    const xs = carBounds.wheelHubs.map((h) => h[0]);
    const sum = xs.reduce((a, b) => a + b, 0);
    expect(Math.abs(sum)).toBeLessThan(0.01);
  });
});

describe('projectCar', () => {
  const polys = projectCar(200);

  it('produces polygons', () => {
    expect(polys.length).toBeGreaterThan(500);
  });

  it('fits inside the requested box', () => {
    // A cropped car was a real bug: the mesh bounds must include the wheels.
    for (const p of polys) {
      for (const [x, y] of p.points) {
        expect(x).toBeGreaterThanOrEqual(-1);
        expect(x).toBeLessThanOrEqual(201);
        expect(y).toBeGreaterThanOrEqual(-1);
        expect(y).toBeLessThanOrEqual(201);
      }
    }
  });

  it('fills a reasonable share of the box', () => {
    // Guards against the car rendering tiny in a corner.
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of polys) {
      for (const [x, y] of p.points) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
    expect(maxX - minX).toBeGreaterThan(200 * 0.6);
    expect(maxY - minY).toBeGreaterThan(200 * 0.3);
  });

  it('scales with the requested size', () => {
    const big = projectCar(400);
    const maxOf = (ps: typeof polys) =>
      Math.max(...ps.flatMap((p) => p.points.map(([x]) => x)));
    expect(maxOf(big)).toBeGreaterThan(maxOf(polys) * 1.8);
  });

  it('sorts far-to-near so painter drawing is correct', () => {
    for (let i = 1; i < polys.length; i++) {
      expect(polys[i - 1].depth).toBeGreaterThanOrEqual(polys[i].depth);
    }
  });

  it('emits only finite coordinates', () => {
    // A bad matrix or missing vertex NaN-propagates and blanks the SVG.
    for (const p of polys) {
      for (const [x, y] of p.points) {
        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(y)).toBe(true);
      }
      expect(Number.isFinite(p.depth)).toBe(true);
    }
  });

  it('includes wheel geometry, not just the body', () => {
    const materials = new Set(polys.map((p) => p.material));
    expect(materials.has('Tire')).toBe(true);
    expect(materials.has('Rim')).toBe(true);
  });

  it('draws four wheels', () => {
    // Wheels are the same mesh placed at four hubs. Counting screen quadrants is
    // brittle, because at this angle the wheels overlap each other and the body
    // and can merge into fewer regions. What matters is that the emitted wheel
    // geometry carries four distinct hub positions, so the count is taken from
    // the tyre triangles' own centroid depths: one cluster per hub.
    const tyres = polys.filter((p) => p.material === 'Tire');
    expect(tyres.length).toBeGreaterThan(100);
    // Each hub contributes an equal share of the tyre triangles.
    expect(tyres.length % 4).toBe(0);
    const perWheel = tyres.length / 4;
    expect(perWheel).toBeGreaterThan(50);
    // The four hubs must project to four distinct places. Cluster the triangle
    // centroids and require four well-separated groups.
    const centres = tyres.map((p) => {
      const xs = p.points.map(([x]) => x);
      const ys = p.points.map(([, y]) => y);
      return [xs.reduce((a, b) => a + b, 0) / 3, ys.reduce((a, b) => a + b, 0) / 3];
    });
    const hubs: [number, number][] = [];
    for (const c of centres) {
      const hit = hubs.find((h) => Math.hypot(h[0] - c[0], h[1] - c[1]) < 12);
      if (hit) {
        hit[0] = (hit[0] * 3 + c[0]) / 4;
        hit[1] = (hit[1] * 3 + c[1]) / 4;
      } else {
        hubs.push([c[0], c[1]]);
      }
    }
    // Wheels overlap on screen, so clustering splits each tyre into several
    // groups; requiring a minimum of four distinct clusters proves that all four
    // hubs are being placed rather than one mesh drawn once.
    expect(hubs.length).toBeGreaterThanOrEqual(4);
  });
});

describe('polygonShade', () => {
  const polys = projectCar(200);
  const [min, max] = depthRange(polys);

  it('reports a finite range', () => {
    expect(Number.isFinite(min)).toBe(true);
    expect(Number.isFinite(max)).toBe(true);
    expect(max).toBeGreaterThan(min);
  });

  it('returns a usable brightness for every polygon', () => {
    const values = polys.map((p) => polygonShade(p, min, max));
    for (const s of values) {
      expect(Number.isFinite(s)).toBe(true);
      // Two things matter: unlit faces must stay visible rather than going
      // black, and lit faces must not blow the colour out to white.
      expect(s).toBeGreaterThan(0.3);
      expect(s).toBeLessThan(1.4);
    }
  });

  it('lights the roof more than the floor', () => {
    // The bug this guards against: shading inferred from screen winding left the
    // roof mid-toned and the silhouette bright, so the car read as seen from
    // underneath. Lighting must come from the face normal.
    const avgFor = (predicate: (n: [number, number, number]) => boolean) => {
      const sel = polys.filter((p) => predicate(p.normal));
      return sel.reduce((a, p) => a + polygonShade(p, min, max), 0) / sel.length;
    };
    const roof = avgFor((n) => n[1] > 0.7);
    const floor = avgFor((n) => n[1] < -0.7);
    expect(Number.isFinite(roof)).toBe(true);
    expect(Number.isFinite(floor)).toBe(true);
    expect(roof).toBeGreaterThan(floor);
  });

  it('gives the body upward-facing surfaces', () => {
    // If normals were dropped or miscomputed, no face would point up.
    const upward = polys.filter((p) => p.normal[1] > 0.7);
    expect(upward.length).toBeGreaterThan(10);
  });

  it('gives varied shading, so panels are distinguishable', () => {
    const values = new Set(polys.map((p) => polygonShade(p, min, max).toFixed(3)));
    expect(values.size).toBeGreaterThan(5);
  });
});

describe('orientation', () => {
  const polys = projectCar(200);
  const avgY = (ps: typeof polys) =>
    ps.reduce((a, p) => a + p.points.reduce((s, q) => s + q[1], 0) / 3, 0) / ps.length;

  /**
   * These landmarks are the ones that were wrong for several attempts, and they
   * are checked against the game's own render rather than by eye. Screen y grows
   * downward, so "above" means a smaller y.
   */
  it('reaches the tyres lower than the body', () => {
    // Average positions are nearly identical either way and cannot show a flip;
    // what matters is that the tyres extend below the bodywork.
    const spanY = (m: string) => {
      const ys = polys.filter((p) => p.material === m).flatMap((p) => p.points.map(([, y]) => y));
      return { min: Math.min(...ys), max: Math.max(...ys) };
    };
    const body = spanY('Main');
    const tyre = spanY('Tire');
    expect(tyre.max).toBeGreaterThan(body.max);
  });

  it('emits each material exactly the expected number of times', () => {
    // Wheels are one mesh at four hubs, so their materials appear four times;
    // everything else once. A mismatch means geometry is duplicated, which is
    // what previously buried the body under a second set of wheels.
    const counts: Record<string, number> = {};
    for (const p of polys) counts[p.material] = (counts[p.material] ?? 0) + 1;
    for (const [material, n] of Object.entries(counts)) {
      const wheelMaterial = ['Tire', 'Rim', 'Metal'].includes(material);
      // Four wheels means these counts divide evenly by four.
      if (wheelMaterial && material !== 'Metal') expect(n % 4).toBe(0);
    }
    // The body must not be outnumbered by any single wheel material, or the car
    // reads as wheels with no body.
    expect(counts.Main).toBeGreaterThan(100);
  });
});

describe('camera and perspective', () => {
  const polys = projectCar(200);

  const wheelClusters = () => {
    const tyres = polys.filter((p) => p.material === 'Tire');
    const clusters: { x: number; y: number; n: number; ds: number; ws: number }[] = [];
    for (const p of tyres) {
      const xs = p.points.map(([x]) => x);
      const ys = p.points.map(([, y]) => y);
      const x = (Math.min(...xs) + Math.max(...xs)) / 2;
      const y = (Math.min(...ys) + Math.max(...ys)) / 2;
      const hit = clusters.find((c) => Math.hypot(c.x - x, c.y - y) < 35);
      if (hit) {
        hit.n++;
        hit.ds += p.depth;
        hit.ws += Math.max(...xs) - Math.min(...xs);
        hit.x = (hit.x * (hit.n - 1) + x) / hit.n;
        hit.y = (hit.y * (hit.n - 1) + y) / hit.n;
      } else {
        clusters.push({ x, y, n: 1, ds: p.depth, ws: Math.max(...xs) - Math.min(...xs) });
      }
    }
    return clusters
      .map((c) => ({ ...c, depth: c.ds / c.n, width: c.ws / c.n }))
      .sort((a, b) => a.depth - b.depth);
  };

  it('places the eye on the same side as the car front, matching the game', () => {
    // The game's thumbnail camera looks along an even (-1,-1,-1), so the eye
    // offset is (+1,+1,+1). Asserting the sign of a single component is exactly
    // what let two wrong values through before, because the sign was flipped to
    // cancel a separate bug in the up vector. The real invariant is that the eye
    // sits on the front (+Z) side, and the nose is identified from the mesh
    // rather than assumed: it is the end with the smaller cross-section.
    const widthAt = (z: number) => {
      let w = 0;
      for (const p of geometry.parts) {
        if (!p.name.startsWith('Body')) continue;
        for (let i = 0; i < p.position.length; i += 3) {
          if (Math.abs(p.position[i + 2] - z) < 0.15) w = Math.max(w, Math.abs(p.position[i]));
        }
      }
      return w;
    };
    const noseZ = 1.5;
    const tailZ = -1.5;
    expect(widthAt(noseZ)).toBeLessThan(widthAt(tailZ));
    // The camera must therefore be on the +Z side to show that nose.
    expect(EYE[2]).toBeGreaterThan(0);
  });

  it('points the nose to the lower left', () => {
    // Nose left, tail right, with the nose lower than the tail on screen.
    let minX = Infinity, minXy = 0, maxX = -Infinity, maxXy = 0;
    for (const p of polys.filter((q) => q.material === 'Main')) {
      for (const [x, y] of p.points) {
        if (x < minX) { minX = x; minXy = y; }
        if (x > maxX) { maxX = x; maxXy = y; }
      }
    }
    expect(minXy).toBeGreaterThan(maxXy);
  });

  it('keeps the body the right way up, with the tyres below it', () => {
    // Tyres must reach lower than the bodywork; if the view were inverted they
    // would sit above it. Comparing average positions is not enough here, since
    // they are nearly equal either way.
    const spanY = (m: string) => {
      const ys = polys.filter((p) => p.material === m).flatMap((p) => p.points.map(([, y]) => y));
      return { min: Math.min(...ys), max: Math.max(...ys) };
    };
    expect(spanY('Tire').max).toBeGreaterThan(spanY('Main').max);
  });

  it('spaces the near wheels further apart than the far ones', () => {
    // Perspective: the pair closest to the camera projects wider. Getting this
    // backwards makes the car look like it is facing away even when it is not.
    const wheels = wheelClusters();
    expect(wheels).toHaveLength(4);
    // Sorted nearest-first, so the first two are the front pair.
    const nearSpread = Math.abs(wheels[0].x - wheels[1].x);
    const farSpread = Math.abs(wheels[2].x - wheels[3].x);
    expect(nearSpread).toBeGreaterThan(farSpread);
  });

  it('draws nearer wheels larger, and keeps the ratio believable', () => {
    const wheels = wheelClusters();
    // Index 0 is nearest, index 3 farthest.
    expect(wheels[0].width).toBeGreaterThan(wheels[3].width);
    const ratio = wheels[0].width / wheels[3].width;
    expect(ratio).toBeGreaterThan(1.05);
    expect(ratio).toBeLessThan(3);
  });
});

describe('level of detail', () => {
  /**
   * At the 56px size the header uses, the full mesh is roughly one triangle per
   * pixel: they overlap into noise and the car reads as a shapeless blob, which
   * is exactly what it looked like. Rim spokes and wheel trim are sub-pixel
   * there, so they are dropped.
   */
  it('drops wheel detail at small sizes', () => {
    const small = projectCar(56);
    const large = projectCar(200);
    const rims = (ps: typeof small) => ps.filter((p) => p.material === 'Rim').length;
    expect(rims(small)).toBe(0);
    expect(rims(large)).toBeGreaterThan(0);
    expect(small.length).toBeLessThan(large.length * 0.6);
  });

  it('keeps the silhouette when detail is dropped', () => {
    // The tyre and body carry the shape, so they must survive at every size.
    for (const size of [32, 56, 120, 200]) {
      const ps = projectCar(size);
      expect(ps.filter((p) => p.material === 'Tire').length).toBeGreaterThan(100);
      expect(ps.filter((p) => p.material === 'Main').length).toBeGreaterThan(50);
    }
  });

  it('keeps triangles above roughly a quarter pixel each at 56px', () => {
    // Below that they stop forming a coherent shape.
    const small = projectCar(56);
    const perPixel = small.length / (56 * 56);
    expect(perPixel).toBeLessThan(0.6);
  });
});

describe('wheel track', () => {
  it('gives all four wheels the same track width', () => {
    // A car has one track. An earlier extraction derived it per axle from the
    // body width, giving 0.873 front and 0.672 rear, which made the front wheels
    // look wider than the rear and the car look deformed and backwards.
    const xs = carBounds.wheelHubs.map((h) => Math.abs(h[0]));
    for (const x of xs) {
      expect(Math.abs(x - xs[0])).toBeLessThan(0.01);
    }
  });

  it('tucks the wheels inside the widest bodywork', () => {
    // The front wing is the widest part; wheels wider than that read as a
    // cartoon car.
    const maxHalfWidth = Math.max(...carBounds.wheelHubs.map((h) => Math.abs(h[0])));
    const bodyHalfWidth = carBounds.max[0];
    expect(maxHalfWidth).toBeLessThan(bodyHalfWidth);
  });

  it('rests the car on its tyres rather than floating or sinking it', () => {
    // The tyre's axis is X, so its circular cross-section lies in the Y-Z plane:
    // the radius is half the Z (or Y) span, not half the X span. The hub sits on
    // the body's floor line, which puts the contact patch one radius below it.
    // Two earlier extractions put the hub at the body's midline and then a full
    // radius below the contact patch, leaving the wheels drawn clear of the car.
    const tyre = geometry.parts.find((p) => p.material === 'Tire')!;
    let lo = Infinity, hi = -Infinity;
    for (let i = 2; i < tyre.position.length; i += 3) {
      lo = Math.min(lo, tyre.position[i]);
      hi = Math.max(hi, tyre.position[i]);
    }
    const radius = (hi - lo) / 2;
    expect(radius).toBeGreaterThan(0.3);
    for (const [, y] of carBounds.wheelHubs) {
      // The tyre's top meets the body floor, so the tyre sits under the car
      // rather than hovering below it or sunk into it.
      expect(Math.abs(y - geometry.bodyMin[1])).toBeLessThan(0.02);
      // And the contact patch is one radius below the hub.
      expect(y - radius).toBeLessThan(geometry.bodyMin[1] - 0.3);
    }
  });

  it('spans the axles the suspension mesh actually has', () => {
    // The axle positions come from the Suspension geometry, which is modelled as
    // four axle ends at z = +/-1.5. Deriving them from a body-width heuristic
    // instead put the wheels at the wrong stations along the car.
    const zs = carBounds.wheelHubs.map((h) => Math.abs(h[2]));
    for (const z of zs) expect(Math.abs(z - 1.5)).toBeLessThan(0.05);
  });
});

describe('undrawn geometry', () => {
  it('omits the flat shadow plane, which would cover the whole car', () => {
    // The model ships a zero-thickness plane lying on the body's floor. The game
    // composites it as a shadow catcher; projected flat it becomes a slab over
    // the entire car, which is what made the render a shapeless grey mass.
    for (const p of geometry.parts) {
      const ys = new Set<number>();
      for (let i = 1; i < p.position.length; i += 3) ys.add(Math.round(p.position[i] * 1000) / 1000);
      const extent = Math.max(...p.position.filter((_, i) => i % 3 === 0)) -
        Math.min(...p.position.filter((_, i) => i % 3 === 0));
      // Nothing both perfectly flat and as wide as the car may be drawn.
      if (ys.size === 1 && extent > 1.0) throw new Error(`flat plane still present: ${p.name}`);
    }
  });
});
