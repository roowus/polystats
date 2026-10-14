import { describe, it, expect } from 'vitest';
import { recolourPattern, patternPath, uvTransform, patternDataUri } from './CarPic';

describe('recolourPattern', () => {
  it('substitutes the atlas placeholder colours', () => {
    // The game's pattern files paint in placeholders and substitute them in the
    // engine: red is the body, green the accent, blue the frame.
    const atlas = '<svg><rect fill="#f00"/><path fill="#0f0"/><rect fill="#00f"/></svg>';
    const out = recolourPattern(atlas, '#112233', '#445566', '#778899');
    expect(out).toContain('%23112233');
    expect(out).toContain('%23445566');
    expect(out).toContain('%23778899');
    expect(out).not.toContain('%23f00');
    expect(out).not.toContain('%230f0');
  });

  it('does not corrupt similar colours', () => {
    // `#f00` must not match inside `#f00f00`, and a 6-digit red must survive.
    const atlas = '<svg><rect fill="#f00f00"/><rect fill="#00ff00"/></svg>';
    const out = recolourPattern(atlas, '#111111', '#222222', '#333333');
    expect(out).toContain('%23f00f00');
    expect(out).toContain('%2300ff00');
  });

  it('strips the XML declaration so the data URI parses', () => {
    const atlas = '<?xml version="1.0" encoding="UTF-8"?><svg><rect fill="#f00"/></svg>';
    expect(recolourPattern(atlas, '#123456', '#123456', '#123456')).not.toContain('<?xml');
  });

  it('returns a usable data URI', () => {
    expect(recolourPattern('<svg/>', '#000', '#000', '#000')).toMatch(/^data:image\/svg\+xml/);
  });
});

describe('patternPath', () => {
  it('maps every one of the 16 pattern indices to a file', () => {
    for (let i = 0; i < 16; i++) {
      expect(patternPath(i)).toMatch(/^\/patterns\/pattern_.+\.svg$/);
    }
  });

  it('returns null for an out-of-range index', () => {
    // A style byte could exceed the table; that must not throw.
    expect(patternPath(99)).toBeNull();
  });
});

describe('uvTransform', () => {
  const apply = (m: number[], u: number, v: number) => [
    m[0] * u + m[2] * v + m[4],
    m[1] * u + m[3] * v + m[5],
  ];

  it('maps UV corners onto their screen points', () => {
    const m = uvTransform([[0, 0], [1, 0], [0, 1]], [[10, 20], [110, 20], [10, 120]], 1024);
    expect(apply(m, 0, 0).map(Math.round)).toEqual([10, 20]);
    expect(apply(m, 1024, 0).map(Math.round)).toEqual([110, 20]);
    expect(apply(m, 0, 1024).map(Math.round)).toEqual([10, 120]);
  });

  it('handles a degenerate UV triangle without NaN', () => {
    const m = uvTransform([[0.5, 0.5], [0.5, 0.5], [0.5, 0.5]], [[1, 2], [3, 4], [5, 6]], 1024);
    expect(m.every(Number.isFinite)).toBe(true);
  });

  it('keeps a rotated UV triangle consistent', () => {
    // Same triangle, UVs cycled: the map must still send each corner home.
    const uv: [number, number][] = [[0.25, 0.5], [0.75, 0.5], [0.5, 0.9]];
    const pts: [number, number][] = [[30, 40], [130, 60], [80, 140]];
    const m = uvTransform(uv, pts, 1024);
    for (let i = 0; i < 3; i++) {
      const [x, y] = apply(m, uv[i][0] * 1024, uv[i][1] * 1024);
      expect(Math.abs(x - pts[i][0])).toBeLessThan(0.01);
      expect(Math.abs(y - pts[i][1])).toBeLessThan(0.01);
    }
  });
});

describe('patternDataUri', () => {
  it('produces a gradient fallback in the player colours', () => {
    const uri = patternDataUri(0, '#ff0000', '#00ff00');
    expect(uri).toMatch(/^data:image\/svg\+xml/);
    expect(decodeURIComponent(uri)).toContain('#ff0000');
  });

  it('returns empty for an unknown pattern', () => {
    expect(patternDataUri(42, '#fff', '#000')).toBe('');
  });
});
