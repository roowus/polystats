import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { CarPic, carImageUrl, recolourPattern } from './CarPic';

const STYLE = 'AAQAAAAAAI4AU44AUwAAAA';

describe('carImageUrl', () => {
  it('points at the worker render route for any style', () => {
    // Deliberately not gated on a known-styles list: the browser asks for any
    // style and falls back on a 404, so coverage grows without a site deploy.
    expect(carImageUrl(STYLE)).toContain(`/car/${STYLE}.png`);
  });

  it('percent-encodes the style', () => {
    expect(carImageUrl('a/b')).toContain('/car/a%2Fb.png');
  });

  it('returns null when there is no style', () => {
    expect(carImageUrl(null)).toBeNull();
    expect(carImageUrl(undefined)).toBeNull();
    expect(carImageUrl('')).toBeNull();
  });
});

describe('CarPic', () => {
  it('requests the native render for a known style', () => {
    const { container } = render(<CarPic carStyle={STYLE} size={40} />);
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toContain(`/car/${STYLE}.png`);
    expect(img?.getAttribute('width')).toBe('40');
    expect(img?.getAttribute('loading')).toBe('lazy');
  });

  it('falls back to the SVG when the render fails to load', () => {
    // A style with no render yet returns 404; that must not leave a broken image.
    const { container } = render(<CarPic carStyle={STYLE} />);
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    fireEvent.error(img!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders the SVG directly when there is no style', () => {
    const { container } = render(<CarPic carStyle={null} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('retries the image after the style changes', () => {
    const { container, rerender } = render(<CarPic carStyle={STYLE} />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('svg')).toBeTruthy();

    // A different style is a different render, so the image should be attempted
    // again rather than staying on the previous fallback.
    rerender(<CarPic carStyle="AAAAAP___wAAAAAAAP___w" />);
    expect(container.querySelector('img')).toBeTruthy();
  });
});

describe('recolourPattern', () => {
  it('substitutes the three placeholder colours', () => {
    const out = decodeURIComponent(
      recolourPattern('<svg><rect fill="#f00"/><rect fill="#0f0"/><rect fill="#00f"/></svg>', '#123456', '#abcdef', '#000000')
    );
    expect(out).toContain('#123456');
    expect(out).toContain('#abcdef');
    expect(out).not.toMatch(/#f00(?![0-9a-fA-F])/);
    expect(out).not.toMatch(/#0f0(?![0-9a-fA-F])/);
    expect(out).not.toMatch(/#00f(?![0-9a-fA-F])/);
  });

  it('leaves no raw green in the gradient atlas, whatever the palette', () => {
    // The gradient atlas ships opaque green and olive patches (#14ec00, #5a0,
    // #986700) that are not placeholders. Untouched they painted raw green
    // wedges onto the car no matter which colours the player had chosen, which
    // is what showed up on the profile card.
    const atlas = readFileSync('public/patterns/pattern_gradient.svg', 'utf8');
    const out = decodeURIComponent(recolourPattern(atlas, '#ff0000', '#ffffff', '#000000'));
    expect(out).not.toMatch(/#14ec00/i);
    expect(out).not.toMatch(/#5a0(?![0-9a-fA-F])/i);
    expect(out).not.toMatch(/#986700/i);
    // The player's own colours survive the pass.
    expect(out).toMatch(/#ff0000/i);
    expect(out).toMatch(/#ffffff/i);
  });

  it('strips the XML declaration, which is invalid inside a data URI', () => {
    // recolourPattern returns a full data URI, so the SVG is the part after the
    // comma.
    const uri = recolourPattern('<?xml version="1.0"?><svg/>', '#111111', '#222222', '#333333');
    expect(uri.startsWith('data:image/svg+xml;utf8,')).toBe(true);
    const out = decodeURIComponent(uri.slice('data:image/svg+xml;utf8,'.length));
    expect(out).not.toContain('<?xml');
    expect(out.trim().startsWith('<svg')).toBe(true);
  });
});
