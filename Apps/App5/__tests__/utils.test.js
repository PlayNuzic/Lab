/**
 * @jest-environment jsdom
 */
import { describe, test, expect, beforeAll } from '@jest/globals';
import { computeHitSizePx, computeNumberFontRem, solidMenuBackground } from '../utils.js';

// App5/utils.js reexporta d'app-common/utils.js; aquest test verifica el
// cablejat del reexport (regressió si algun nom canvia o es trenca l'enllaç).
describe('App5 utils (reexports d\'app-common/utils.js)', () => {
  beforeAll(() => {
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

  test('computeHitSizePx està disponible i escala valors', () => {
    expect(typeof computeHitSizePx).toBe('function');
    expect(computeHitSizePx(30)).toBe(32);
  });

  test('computeNumberFontRem està disponible i retorna un rang vàlid', () => {
    expect(typeof computeNumberFontRem).toBe('function');
    expect(computeNumberFontRem(1)).toBe(2.4);
  });

  test('solidMenuBackground està disponible i aplica colors de tema', () => {
    expect(typeof solidMenuBackground).toBe('function');
    document.body.dataset.theme = 'dark';
    document.documentElement.style.setProperty('--bg-dark', 'red');
    document.documentElement.style.setProperty('--text-dark', 'blue');
    const panel = document.createElement('div');
    solidMenuBackground(panel);
    expect(panel.style.backgroundColor).toBe('red');
    expect(panel.style.color).toBe('blue');
  });
});
