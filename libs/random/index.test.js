import { randomize, DEFAULT_RANGES } from './index.js';

describe('randomize', () => {
  test('returns values within default ranges', () => {
    const result = randomize();
    for (const [key, { min, max }] of Object.entries(DEFAULT_RANGES)) {
      expect(result[key]).toBeGreaterThanOrEqual(min);
      expect(result[key]).toBeLessThanOrEqual(max);
    }
  });

  test('respects custom ranges and adds new keys', () => {
    const result = randomize({ Lg: { min: 3, max: 3 }, X: { min: 5, max: 5 } });
    expect(result.Lg).toBe(3);
    expect(result.X).toBe(5);
  });
});
