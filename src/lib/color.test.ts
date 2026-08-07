import { describe, expect, it } from 'vitest';
import { isLight, luminance } from './color';

describe('luminance', () => {
  it('los extremos son los que dice WCAG', () => {
    expect(luminance('#000000')).toBeCloseTo(0, 5);
    expect(luminance('#ffffff')).toBeCloseTo(1, 5);
  });

  it('el verde pesa más que el rojo y que el azul', () => {
    expect(luminance('#00ff00')).toBeGreaterThan(luminance('#ff0000'));
    expect(luminance('#00ff00')).toBeGreaterThan(luminance('#0000ff'));
  });

  it('entiende `#rgb` y no se cae con basura', () => {
    expect(luminance('#fff')).toBeCloseTo(luminance('#ffffff'), 5);
    expect(luminance('rojo')).toBe(0);
    expect(luminance('')).toBe(0);
  });
});

describe('isLight', () => {
  it('parte por donde el ojo deja de ver oscuro', () => {
    expect(isLight('#ffffff')).toBe(true);
    expect(isLight('#f4f4f7')).toBe(true);
    expect(isLight('#000000')).toBe(false);
    expect(isLight('#101018')).toBe(false);
  });

  it('un color mal escrito cuenta como oscuro, no revienta', () => {
    expect(isLight('rojo')).toBe(false);
  });
});
