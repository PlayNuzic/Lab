/**
 * @jest-environment jsdom
 */
import { describe, test, expect, beforeAll } from '@jest/globals';
import { computeIntervalNumberFontRem } from '../it-renderer.js';

describe('computeIntervalNumberFontRem', () => {
  beforeAll(() => {
    // Mock window.matchMedia per jsdom (desktop: max-width 600px no coincideix)
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

  test('retorna el màxim (1.8) per Lg petits en desktop', () => {
    expect(computeIntervalNumberFontRem(1)).toBe(1.8);
  });

  test('retorna 1.6 exacte quan Lg coincideix amb el TARGET (15)', () => {
    expect(computeIntervalNumberFontRem(15)).toBeCloseTo(1.6);
  });

  test('retorna el mínim (0.9) per Lg grans en desktop', () => {
    expect(computeIntervalNumberFontRem(10000)).toBe(0.9);
  });

  test('tracta Lg invàlid (<=0, NaN) com a 1', () => {
    expect(computeIntervalNumberFontRem(0)).toBe(computeIntervalNumberFontRem(1));
    expect(computeIntervalNumberFontRem(-5)).toBe(computeIntervalNumberFontRem(1));
    expect(computeIntervalNumberFontRem(NaN)).toBe(computeIntervalNumberFontRem(1));
  });
});
