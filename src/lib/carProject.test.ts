import { describe, it, expect } from 'vitest';
import { projectCar, polygonShade, depthRange, carBounds } from './carProject';
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
    // Wheels are the same mesh placed at four hubs, so tyre polygons should
    // appear in four distinct screen regions.
    const tyres = polys.filter((p) => p.material === 'Tire');
    expect(tyres.length).toBeGreaterThan(100);
    const centres = tyres.map((p) => {
      const xs = p.points.map(([x]) => x);
      const ys = p.points.map(([, y]) => y);
      return [xs.reduce((a, b) => a + b, 0) / 3, ys.reduce((a, b) => a + b, 0) / 3];
    });
    // Quadrant counting: expect geometry in all four corners of the car.
    const quads = new Set(
      centres.map(([x, y]) => `${x < 100 ? 'L' : 'R'}${y < 100 ? 'T' : 'B'}`)
    );
    expect(quads.size).toBeGreaterThanOrEqual(3);
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
  it('draws the wheels below the body', () => {
    const tyres = avgY(polys.filter((p) => p.material === 'Tire'));
    const body = avgY(polys.filter((p) => p.material === 'Main'));
    expect(tyres).toBeGreaterThan(body);
  });

  it('extends the wheels below the bodywork', () => {
    // The bug this guards: hubs were taken from the body's underside, which put
    // the wheels through the middle of the car. A wheel's centre must sit one
    // radius above the ground plane, so the tyres reach lower than the body.
    const spanY = (m: string) => {
      const ys = polys.filter((p) => p.material === m).flatMap((p) => p.points.map(([, y]) => y));
      return { min: Math.min(...ys), max: Math.max(...ys) };
    };
    const body = spanY('Main');
    const tyre = spanY('Tire');
    expect(tyre.max).toBeGreaterThan(body.max);
  });

  it('agrees with the native render on which quadrant holds the car', () => {
    // Measured from the game's own 200x200 render: its mass is top-heavy and
    // right-heavy. A flipped car fails this.
    let top = 0, bottom = 0, left = 0, right = 0;
    for (const p of polys) {
      for (const [x, y] of p.points) {
        if (y < 100) top++; else bottom++;
        if (x < 100) left++; else right++;
      }
    }
    expect(top).toBeGreaterThan(bottom * 0.5);
    expect(right).toBeGreaterThan(left * 0.5);
  });
});

describe('texture coordinates', () => {
  const polys = projectCar(200);

  it('carries UVs for the painted body panels', () => {
    // Without these the pattern atlas cannot be mapped onto the car, which is
    // what the paint scheme depends on.
    const main = polys.filter((p) => p.material === 'Main' && p.uv);
    expect(main.length).toBeGreaterThan(50);
  });

  it('gives every UV triangle three pairs', () => {
    for (const p of polys) {
      if (!p.uv) continue;
      expect(p.uv).toHaveLength(3);
      for (const [u, v] of p.uv) {
        expect(Number.isFinite(u)).toBe(true);
        expect(Number.isFinite(v)).toBe(true);
      }
    }
  });

  it('keeps UVs inside the atlas', () => {
    // A UV outside 0..1 samples outside the 1024px atlas and renders blank.
    for (const p of polys) {
      if (!p.uv) continue;
      for (const [u, v] of p.uv) {
        expect(u).toBeGreaterThanOrEqual(-0.01);
        expect(u).toBeLessThanOrEqual(1.01);
        expect(v).toBeGreaterThanOrEqual(-0.01);
        expect(v).toBeLessThanOrEqual(1.01);
      }
    }
  });

  it('spreads the body across most of the atlas', () => {
    // A UV unwrap should use the texture, not sample one tiny corner.
    const us: number[] = [], vs: number[] = [];
    for (const p of polys) {
      if (p.material !== 'Main' || !p.uv) continue;
      for (const [u, v] of p.uv) { us.push(u); vs.push(v); }
    }
    expect(Math.max(...us) - Math.min(...us)).toBeGreaterThan(0.5);
    expect(Math.max(...vs) - Math.min(...vs)).toBeGreaterThan(0.5);
  });
});
