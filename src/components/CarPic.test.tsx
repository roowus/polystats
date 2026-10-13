import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CarPic, carImageUrl } from './CarPic';
import { NATIVE_CAR_STYLES } from '@/lib/nativeCarStyles';

describe('carImageUrl', () => {
  it('returns a static path for a style we have generated', () => {
    const style = NATIVE_CAR_STYLES[0];
    expect(carImageUrl(style)).toBe(`/cars/${style}.png`);
  });

  it('returns null for an unknown or missing style', () => {
    expect(carImageUrl('not-a-real-style')).toBeNull();
    expect(carImageUrl(null)).toBeNull();
    expect(carImageUrl(undefined)).toBeNull();
  });
});

describe('CarPic', () => {
  it('renders the native image when the style is known', () => {
    const style = NATIVE_CAR_STYLES[0];
    const { container } = render(<CarPic carStyle={style} size={40} />);
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe(`/cars/${style}.png`);
    expect(img?.getAttribute('loading')).toBe('lazy');
  });

  it('falls back to the schematic SVG for an unknown style', () => {
    const { container } = render(<CarPic carStyle="unknown-style" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('falls back to the SVG when no style is given', () => {
    const { container } = render(<CarPic carStyle={null} />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
