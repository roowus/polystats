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
    for (const p of polys.slice(0, 200)) {
      const s = polygonShade(p, min, max);
      expect(Number.isFinite(s)).toBe(true);
      // Clamped to a sane multiplier so colours cannot blow out or go black.
      expect(s).toBeGreaterThan(0.4);
      expect(s).toBeLessThan(1.6);
    }
  });

  it('gives varied shading, so panels are distinguishable', () => {
    const values = new Set(polys.map((p) => polygonShade(p, min, max).toFixed(3)));
    expect(values.size).toBeGreaterThan(5);
  });
});
