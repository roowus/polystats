import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { CarPic, carImageUrl } from './CarPic';

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
