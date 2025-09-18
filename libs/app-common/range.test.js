import { describe, test, expect } from '@jest/globals';
import { toNumber, toRange } from './range.js';

describe('range helpers', () => {
  test('toNumber falls back when value is not finite', () => {
    expect(toNumber('12', 5)).toBe(12);
    expect(toNumber('bad', 7)).toBe(7);
    expect(toNumber(Infinity, 3)).toBe(3);
  });

  test('toRange returns ordered tuple', () => {
    expect(toRange('10', '20', [0, 1])).toEqual([10, 20]);
    expect(toRange('30', '5', [0, 1])).toEqual([5, 30]);
  });
});
