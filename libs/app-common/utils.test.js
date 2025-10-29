/**
 * @jest-environment jsdom
 */
import { describe, test, expect, beforeAll } from '@jest/globals';
import { computeHitSizePx, solidMenuBackground, computeNumberFontRem } from './utils.js';

describe('Common utils', () => {
  beforeAll(() => {
    // Mock window.matchMedia for jsdom
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => {},
      }),
    });
  });

  test('computeHitSizePx scales and clamps values', () => {
    expect(computeHitSizePx(30)).toBe(32);
    expect(computeHitSizePx(1)).toBe(44);
    expect(computeHitSizePx(1000)).toBe(14);
  });

  test('computeNumberFontRem returns size between 1 and 2.4 rem', () => {
    expect(computeNumberFontRem(30)).toBeCloseTo(1.3);
    expect(computeNumberFontRem(1)).toBe(2.4);
    expect(computeNumberFontRem(1000)).toBe(1.0);
  });

  test('solidMenuBackground applies theme colors', () => {
    document.body.dataset.theme = 'dark';
    document.documentElement.style.setProperty('--bg-dark', 'red');
    document.documentElement.style.setProperty('--text-dark', 'blue');
    const panel = document.createElement('div');
    solidMenuBackground(panel);
    expect(panel.style.backgroundColor).toBe('red');
    expect(panel.style.color).toBe('blue');
    expect(panel.style.backgroundImage).toBe('none');
  });
});
