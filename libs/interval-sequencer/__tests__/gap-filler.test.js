/**
 * @jest-environment node
 */

import {
  fillGapsWithSilences,
  detectGaps,
  hasGaps,
  calculateTotalDuration,
  removeSilences
} from '../gap-filler.js';

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

  describe('detectGaps', () => {
    test('returns empty array for empty input', () => {
      expect(detectGaps([])).toEqual([]);
      expect(detectGaps(null)).toEqual([]);
    });

    test('returns empty array when no gaps', () => {
      const pairs = [
        { pulse: 0, temporalInterval: 3 },
        { pulse: 3, temporalInterval: 2 }
      ];
      expect(detectGaps(pairs)).toEqual([]);
    });

    test('detects single gap', () => {
      const pairs = [
        { pulse: 0, temporalInterval: 2 },
        { pulse: 5, temporalInterval: 1 }
      ];
      const gaps = detectGaps(pairs);

      expect(gaps).toHaveLength(1);
      expect(gaps[0]).toEqual({ startPulse: 2, size: 3 });
    });

    test('detects multiple gaps', () => {
      const pairs = [
        { pulse: 0, temporalInterval: 1 },
        { pulse: 3, temporalInterval: 1 },
        { pulse: 6, temporalInterval: 1 }
      ];
      const gaps = detectGaps(pairs);

      expect(gaps).toHaveLength(2);
      expect(gaps[0]).toEqual({ startPulse: 1, size: 2 });
      expect(gaps[1]).toEqual({ startPulse: 4, size: 2 });
    });

    test('detects gap from base pair position', () => {
      const pairs = [{ pulse: 3, temporalInterval: 1 }];
      const basePair = { pulse: 0 };
      const gaps = detectGaps(pairs, basePair);

      expect(gaps).toHaveLength(1);
      expect(gaps[0]).toEqual({ startPulse: 0, size: 3 });
    });
  });

  describe('hasGaps', () => {
    test('returns false for empty input', () => {
      expect(hasGaps([])).toBe(false);
    });

    test('returns false when no gaps', () => {
      const pairs = [
        { pulse: 0, temporalInterval: 2 },
        { pulse: 2, temporalInterval: 3 }
      ];
      expect(hasGaps(pairs)).toBe(false);
    });

    test('returns true when gaps exist', () => {
      const pairs = [
        { pulse: 0, temporalInterval: 1 },
        { pulse: 3, temporalInterval: 1 }
      ];
      expect(hasGaps(pairs)).toBe(true);
    });
  });

  describe('calculateTotalDuration', () => {
    test('returns 0 for empty input', () => {
      expect(calculateTotalDuration([])).toBe(0);
      expect(calculateTotalDuration(null)).toBe(0);
    });

    test('sums all temporalIntervals', () => {
      const pairs = [
        { temporalInterval: 2 },
        { temporalInterval: 3 },
        { temporalInterval: 1 }
      ];
      expect(calculateTotalDuration(pairs)).toBe(6);
    });

    test('uses default of 1 for missing temporalInterval', () => {
      const pairs = [
        { note: 1 },
        { note: 2, temporalInterval: 3 }
      ];
      expect(calculateTotalDuration(pairs)).toBe(4);
    });
  });

  describe('removeSilences', () => {
    test('returns empty array for null/undefined', () => {
      expect(removeSilences(null)).toEqual([]);
      expect(removeSilences(undefined)).toEqual([]);
    });

    test('removes pairs with isRest true', () => {
      const pairs = [
        { note: 3, pulse: 0, isRest: false },
        { note: 3, pulse: 1, isRest: true },
        { note: 5, pulse: 2, isRest: false }
      ];
      const result = removeSilences(pairs);

      expect(result).toHaveLength(2);
      expect(result[0].pulse).toBe(0);
      expect(result[1].pulse).toBe(2);
    });

    test('keeps pairs without isRest property', () => {
      const pairs = [
        { note: 3, pulse: 0 },
        { note: 5, pulse: 1 }
      ];
      expect(removeSilences(pairs)).toHaveLength(2);
    });
  });
});
