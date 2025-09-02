import { describe, expect, test, beforeAll } from '@jest/globals';

let utils;

beforeAll(async () => {
  utils = await import('./index.js');
});

describe('utils', () => {
  test('randInt returns value within range', () => {
    for (let i = 0; i < 100; i++) {
      const val = utils.randInt(1, 5);
      expect(val).toBeGreaterThanOrEqual(1);
      expect(val).toBeLessThanOrEqual(5);
    }
  });

  test('clamp restricts numbers to range', () => {
    expect(utils.clamp(5, 0, 10)).toBe(5);
    expect(utils.clamp(-2, 0, 10)).toBe(0);
    expect(utils.clamp(15, 0, 10)).toBe(10);
  });

  test('wrapSym wraps symmetrically around zero', () => {
    expect(utils.wrapSym(5, 10)).toBe(-5);
    expect(utils.wrapSym(6, 10)).toBe(-4);
    expect(utils.wrapSym(-6, 10)).toBe(4);
  });
});

