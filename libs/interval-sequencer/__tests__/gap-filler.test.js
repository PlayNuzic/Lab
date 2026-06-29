/**
 * @jest-environment node
 */

import { fillGapsWithSilences } from '../gap-filler.js';

describe('gap-filler', () => {
  describe('fillGapsWithSilences', () => {
    test('returns empty array for empty input', () => {
      expect(fillGapsWithSilences([])).toEqual([]);
      expect(fillGapsWithSilences(null)).toEqual([]);
      expect(fillGapsWithSilences(undefined)).toEqual([]);
    });

    test('returns pairs unchanged when no gaps', () => {
      const pairs = [
        { note: 3, pulse: 0, temporalInterval: 2 },
        { note: 5, pulse: 2, temporalInterval: 3 }
      ];
      const result = fillGapsWithSilences(pairs);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(pairs[0]);
      expect(result[1]).toEqual(pairs[1]);
    });

    test('fills gap between non-adjacent pairs', () => {
      const pairs = [
        { note: 3, pulse: 0, temporalInterval: 2 },
        { note: 5, pulse: 5, temporalInterval: 1 }
      ];
      const result = fillGapsWithSilences(pairs);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ note: 3, pulse: 0, temporalInterval: 2 });
      expect(result[1]).toEqual({
        note: 3,
        pulse: 2,
        temporalInterval: 3,
        isRest: true
      });
      expect(result[2]).toEqual({ note: 5, pulse: 5, temporalInterval: 1 });
    });

    test('fills gap from base pair position', () => {
      const pairs = [
        { note: 5, pulse: 3, temporalInterval: 2 }
      ];
      const basePair = { note: 0, pulse: 0 };
      const result = fillGapsWithSilences(pairs, basePair);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        note: 0,
        pulse: 0,
        temporalInterval: 3,
        isRest: true
      });
      expect(result[1]).toEqual(pairs[0]);
    });

    test('uses previous note for rest when filling mid-sequence gap', () => {
      const pairs = [
        { note: 7, pulse: 0, temporalInterval: 1 },
        { note: 3, pulse: 4, temporalInterval: 1 }
      ];
      const result = fillGapsWithSilences(pairs);

      expect(result).toHaveLength(3);
      expect(result[1].note).toBe(7); // Previous note
      expect(result[1].isRest).toBe(true);
    });

    test('handles pairs with default temporalInterval of 1', () => {
      const pairs = [
        { note: 3, pulse: 0 },
        { note: 5, pulse: 3 }
      ];
      const result = fillGapsWithSilences(pairs);

      expect(result).toHaveLength(3);
      expect(result[1]).toEqual({
        note: 3,
        pulse: 1,
        temporalInterval: 2,
        isRest: true
      });
    });

    test('sorts pairs by pulse before filling', () => {
      const pairs = [
        { note: 5, pulse: 5, temporalInterval: 1 },
        { note: 3, pulse: 0, temporalInterval: 2 }
      ];
      const result = fillGapsWithSilences(pairs);

      expect(result[0].pulse).toBe(0);
      expect(result[1].pulse).toBe(2);
      expect(result[2].pulse).toBe(5);
    });

    test('handles custom base pair', () => {
      const pairs = [
        { note: 3, pulse: 2, temporalInterval: 1 }
      ];
      const basePair = { note: 5, pulse: 1 };
      const result = fillGapsWithSilences(pairs, basePair);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        note: 5,
        pulse: 1,
        temporalInterval: 1,
        isRest: true
      });
    });
  });
});
