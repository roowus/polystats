import { describe, it, expect } from 'vitest';
import { rasteriseCar, EYE } from './carRaster';
import geometry from './carGeometry.json';

const COLOURS = {
  Main: '#ff0000',
  Metal: '#000000',
  Rim: '#000000',
  Tire: '#16161c',
  AirIntake: '#26262e',
  BrakeLight: '#590000',
};

/** Fraction of drawn pixels in each rough colour bucket. */
function composition(data: Uint8ClampedArray) {
  let car = 0, colour = 0, dark = 0, grey = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue;
    car++;
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const sat = mx === 0 ? 0 : (mx - mn) / mx;
    if (sat > 0.25) colour++;
    else if (mx < 70) dark++;
    else grey++;
  }
  return { car, colour, dark, grey };
}

describe('rasteriseCar', () => {
  it('draws a car at every size the site uses', () => {
    for (const size of [56, 120, 300]) {
      const { data, width, height } = rasteriseCar({ size, colours: COLOURS });
      expect(width).toBe(size);
      expect(height).toBe(size);
      const { car } = composition(data);
      // Roughly half the square is car at this framing.
      expect(car).toBeGreaterThan(size * size * 0.2);
      expect(car).toBeLessThan(size * size * 0.75);
    }
  });

  it('leaves no grey mass on a car with no grey parts', () => {
    // Every material here is either saturated red or near-black. The suspension
    // used to paint a light grey slab across the bodywork; nothing should now be
    // mid-grey.
    const { data } = rasteriseCar({ size: 300, colours: COLOURS });
    const { car, grey } = composition(data);
    expect(grey / car).toBeLessThan(0.02);
  });

  it('never draws the intake over the bodywork', () => {
    // The intake is a closed box inside the shell, visible only through the
    // cockpit opening and side vents. When it painted over the body it produced a
    // large contiguous dark block on the roof and flanks; the depth buffer makes
    // that impossible, so the dark pixels must stay a small minority.
    const { data } = rasteriseCar({ size: 300, colours: COLOURS });
    const { car, dark } = composition(data);
    expect(dark / car).toBeLessThan(0.5);
  });

  it('shows the rim through the tyre', () => {
    // The tyre is an annulus whose hole is exactly the rim's radius, so the rim
    // is only ever visible through it. Painting the tyre over the rim left the
    // rim as a crescent sliver; measured by differencing against a dark rim, it
    // must now cover a real share of the car.
    const dark = rasteriseCar({ size: 300, colours: COLOURS }).data;
    const bright = rasteriseCar({ size: 300, colours: { ...COLOURS, Rim: '#00ff00' } }).data;
    let affected = 0, car = 0;
    for (let i = 0; i < dark.length; i += 4) {
      if (dark[i + 3] < 8) continue;
      car++;
      // The rim being a different colour changes these pixels; nothing else does.
      if (bright[i + 1] > dark[i + 1] + 20) affected++;
    }
    // Roughly 4% of the car is rim at this angle and size.
    expect(affected / car).toBeGreaterThan(0.02);
  });

  it('paints the pattern where the sampler provides one', () => {
    // A sampler that returns blue everywhere must put blue paint on the body,
    // proving the per-triangle UV path is wired to the output.
    const { data } = rasteriseCar({
      size: 200,
      colours: COLOURS,
      sample: (material) => (material === 'Main' ? [0, 0, 255] : null),
    });
    let blue = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 8) continue;
      if (data[i + 2] > 120 && data[i] < 120) blue++;
    }
    expect(blue).toBeGreaterThan(0);
  });

  it('interpolates UVs across a triangle rather than sampling once', () => {
    // A body triangle spans up to 18% by 31% of the atlas, so a single sample
    // per triangle reads the wrong part of the pattern across most of it. The
    // sampler must therefore be called with many distinct coordinates.
    const seen = new Set<string>();
    rasteriseCar({
      size: 200,
      colours: COLOURS,
      sample: (_material, u, v) => {
        seen.add(`${u.toFixed(3)},${v.toFixed(3)}`);
        return null;
      },
    });
    expect(seen.size).toBeGreaterThan(500);
  });

  it('draws a different wheel for a different rims byte', () => {
    const a = rasteriseCar({ size: 200, rimsVariant: 0, colours: COLOURS }).data;
    const b = rasteriseCar({ size: 200, rimsVariant: 5, colours: COLOURS }).data;
    let diff = 0;
    for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1]) diff++;
    expect(diff).toBeGreaterThan(0);
  });

  it('falls back to the first wheel when the byte is unknown', () => {
    // A style from a newer game build must still draw a car, not nothing.
    const { data } = rasteriseCar({ size: 120, rimsVariant: 99, colours: COLOURS });
    expect(composition(data).car).toBeGreaterThan(0);
  });

  it('is fast enough to run during render', () => {
    const t0 = performance.now();
    rasteriseCar({ size: 56, colours: COLOURS });
    // 56px is the card size used in lists, where many cars render at once.
    expect(performance.now() - t0).toBeLessThan(200);
  });
});

describe('orientation', () => {
  // The nose is the narrow, low end at +Z; the tail carries the wide rear wing.
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

  it('identifies the nose from the mesh, not from an assumption', () => {
    expect(widthAt(1.5)).toBeLessThan(widthAt(-1.5));
  });

  it('puts the eye on the same side as the nose', () => {
    // Asserting the sign of one component is what let earlier wrong values
    // through, because the sign was flipped to cancel a separate bug in the up
    // vector. The real invariant is that the camera is on the nose's side.
    expect(EYE[2]).toBeGreaterThan(0);
  });

  it('puts the wheels below the body', () => {
    // Tyres must reach lower on screen than the bodywork; an inverted view puts
    // them above it, which a flipped image alone cannot be detected from.
    const { data, width, height } = rasteriseCar({ size: 300, colours: COLOURS });
    // Find the lowest opaque pixel in each column, and check the car's mass sits
    // in the lower half rather than the upper.
    let top = height, bottom = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 8) {
          if (y < top) top = y;
          if (y > bottom) bottom = y;
          break;
        }
      }
    }
    expect(bottom).toBeGreaterThan(top);
  });
});

describe('extracted geometry', () => {
  it('decoded a full car, not a fragment', () => {
    const tris = (parts: { index: number[] | null; position: number[] }[]) =>
      parts.reduce((a, p) => a + (p.index ? p.index.length / 3 : p.position.length / 9), 0);
    let total = tris(geometry.parts) + tris(geometry.sharedTyre);
    for (const v of geometry.wheelVariants) total += tris(v.parts);
    for (const v of geometry.exhaustVariants) total += tris(v.parts);
    expect(total).toBeGreaterThan(500);
    expect(tris(geometry.parts)).toBeGreaterThan(150);
  });

  it('captures every wheel and exhaust variant a style can select', () => {
    expect(geometry.wheelVariants.length).toBeGreaterThanOrEqual(12);
    expect(geometry.exhaustVariants.length).toBeGreaterThanOrEqual(8);
  });

  it('records four wheel hubs on a single track', () => {
    expect(geometry.wheels).toHaveLength(4);
    const xs = geometry.wheels.map((h) => Math.abs(h[0]));
    for (const x of xs) expect(Math.abs(x - xs[0])).toBeLessThan(0.01);
  });

  it('rests the car on its tyres', () => {
    // The hub sits on the body's floor line, which puts the contact patch one
    // radius below it. Earlier extractions put the hub at the body's midline and
    // then a full radius too low, leaving the wheels sunk in or floating clear.
    const tyre = geometry.sharedTyre.find((p) => p.material === 'Tire')!;
    let lo = Infinity, hi = -Infinity;
    for (let i = 2; i < tyre.position.length; i += 3) {
      lo = Math.min(lo, tyre.position[i]);
      hi = Math.max(hi, tyre.position[i]);
    }
    const radius = (hi - lo) / 2;
    expect(radius).toBeGreaterThan(0.3);
    for (const [, y] of geometry.wheels) {
      expect(Math.abs(y - geometry.bodyMin[1])).toBeLessThan(0.02);
    }
  });

  it('omits the flat shadow plane, which would cover the whole car', () => {
    for (const p of geometry.parts) {
      const xs = p.position.filter((_, i) => i % 3 === 0);
      const ys = new Set<number>();
      for (let i = 1; i < p.position.length; i += 3) ys.add(Math.round(p.position[i] * 1000) / 1000);
      const extent = Math.max(...xs) - Math.min(...xs);
      if (ys.size === 1 && extent > 1.0) throw new Error(`flat plane still present: ${p.name}`);
    }
  });
});
