/**
 * @jest-environment jsdom
 */
import { describe, test, expect } from '@jest/globals';
import { computeHitSizePx, solidMenuBackground } from './utils.js';

describe('App1 utils', () => {
  test('computeHitSizePx scales and clamps values', () => {
    expect(computeHitSizePx(30)).toBe(32);
    expect(computeHitSizePx(1)).toBe(44);
    expect(computeHitSizePx(1000)).toBe(14);
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
