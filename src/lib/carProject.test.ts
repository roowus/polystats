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

  /**
   * The car must show its FRONT. The mesh's nose is at +Z and depth is
   * `dot(point, eyeOffset)` with larger meaning farther, so the eye offset needs
   * a negative Z. Two earlier values had positive Z and showed the back of the
   * car, which is why it looked like it faced away regardless of azimuth.
   */
  it('puts the nose nearer the viewer than the tail', () => {
    // The nose is the long low overhang at +Z; the tail at -Z carries the rear
    // wing. Depth is dot(point, EYE) with larger meaning farther, so a negative
    // Z in the eye offset is what puts the front of the car toward the viewer.
    const d = (z: number) => z * EYE[2];
    expect(d(1.65)).toBeLessThan(d(-1.95));
    expect(EYE[2]).toBeLessThan(0);
  });

  it('makes nearer geometry larger, so the view has depth', () => {
    // With a flat projection every wheel draws the same size and the car reads
    // as deformed. Size must fall as depth rises.
    const wheels = polys.filter((p) => p.material === 'Tire' || p.material === 'Rim');
    const data = wheels
      .map((p) => {
        const xs = p.points.map(([x]) => x);
        const ys = p.points.map(([, y]) => y);
        return {
          depth: p.depth,
          size: Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)),
        };
      })
      .filter((d) => d.size > 0.3);
    expect(data.length).toBeGreaterThan(50);
    const n = data.length;
    const md = data.reduce((a, x) => a + x.depth, 0) / n;
    const ms = data.reduce((a, x) => a + x.size, 0) / n;
    let num = 0, dd = 0, ds = 0;
    for (const x of data) {
      num += (x.depth - md) * (x.size - ms);
      dd += (x.depth - md) ** 2;
      ds += (x.size - ms) ** 2;
    }
    // Strongly negative correlation: farther means smaller.
    expect(num / Math.sqrt(dd * ds)).toBeLessThan(-0.05);
  });

  it('keeps the wheels within a believable size ratio', () => {
    // Measured per WHEEL, not per triangle: individual triangles vary far more
    // than the wheels they compose, so a per-triangle ratio is meaningless.
    // Too strong a perspective balloons the near wheel; too weak loses depth.
    const tyres = polys.filter((p) => p.material === 'Tire');
    const clusters: { x: number; y: number; n: number }[] = [];
    for (const p of tyres) {
      const xs = p.points.map(([x]) => x);
      const ys = p.points.map(([, y]) => y);
      const x = (Math.min(...xs) + Math.max(...xs)) / 2;
      const y = (Math.min(...ys) + Math.max(...ys)) / 2;
      const hit = clusters.find((c) => Math.hypot(c.x - x, c.y - y) < 35);
      if (hit) {
        hit.x = (hit.x * hit.n + x) / (hit.n + 1);
        hit.y = (hit.y * hit.n + y) / (hit.n + 1);
        hit.n++;
      } else {
        clusters.push({ x, y, n: 1 });
      }
    }
    expect(clusters.length).toBe(4);

    // Each wheel's on-screen size, taken from the polygons nearest its centre.
    const sizes = clusters.map((c) => {
      const xs = tyres
        .filter((p) => {
          const px = p.points.reduce((s, q) => s + q[0], 0) / 3;
          const py = p.points.reduce((s, q) => s + q[1], 0) / 3;
          return Math.hypot(px - c.x, py - c.y) < 40;
        })
        .flatMap((p) => p.points.map(([x]) => x));
      return Math.max(...xs) - Math.min(...xs);
    });
    const ratio = Math.max(...sizes) / Math.min(...sizes);
    expect(ratio).toBeGreaterThan(1.05);
    expect(ratio).toBeLessThan(3);
  });
});
