/**
 * @jest-environment node
 */

import {
  pairsToIntervals,
  buildPairsFromIntervals,
  validatePairSequence,
  validateIntervalSequence
} from '../interval-converter.js';

describe('interval-converter', () => {
  describe('pairsToIntervals', () => {
    test('returns empty array for empty input', () => {
      expect(pairsToIntervals([])).toEqual([]);
      expect(pairsToIntervals(null)).toEqual([]);
    });

    test('converts single pair to interval from base', () => {
      const pairs = [{ note: 3, pulse: 0, temporalInterval: 2 }];
      const basePair = { note: 0, pulse: 0 };
      const intervals = pairsToIntervals(pairs, basePair);

      expect(intervals).toHaveLength(1);
      expect(intervals[0]).toEqual({
        soundInterval: 3,
        temporalInterval: 2,
        isRest: false
      });
    });

    test('converts consecutive pairs to relative intervals', () => {
      const pairs = [
        { note: 3, pulse: 0, temporalInterval: 2 },
        { note: 5, pulse: 2, temporalInterval: 1 }
      ];
      const intervals = pairsToIntervals(pairs, { note: 0, pulse: 0 });

      expect(intervals).toHaveLength(2);
      expect(intervals[0].soundInterval).toBe(3);
      expect(intervals[1].soundInterval).toBe(2);
    });

    test('handles rests with soundInterval 0', () => {
      const pairs = [
        { note: 3, pulse: 0, temporalInterval: 2, isRest: false },
        { note: 3, pulse: 2, temporalInterval: 1, isRest: true },
        { note: 5, pulse: 3, temporalInterval: 1, isRest: false }
      ];
      const intervals = pairsToIntervals(pairs, { note: 0, pulse: 0 });

      expect(intervals[1].soundInterval).toBe(0);
      expect(intervals[1].isRest).toBe(true);
      // After rest, interval is from last playable note
      expect(intervals[2].soundInterval).toBe(2);
    });

    test('uses default temporalInterval of 1', () => {
      const pairs = [{ note: 5, pulse: 0 }];
      const intervals = pairsToIntervals(pairs, { note: 0, pulse: 0 });

      expect(intervals[0].temporalInterval).toBe(1);
    });

    test('handles negative soundIntervals', () => {
      const pairs = [
        { note: 7, pulse: 0, temporalInterval: 1 },
        { note: 3, pulse: 1, temporalInterval: 1 }
      ];
      const intervals = pairsToIntervals(pairs, { note: 0, pulse: 0 });

      expect(intervals[0].soundInterval).toBe(7);
      expect(intervals[1].soundInterval).toBe(-4);
    });
  });

  describe('buildPairsFromIntervals', () => {
    test('returns empty array for null basePair', () => {
      expect(buildPairsFromIntervals(null)).toEqual([]);
    });

    test('returns base pair when no intervals', () => {
      const basePair = { note: 5, pulse: 0 };
      const pairs = buildPairsFromIntervals(basePair, []);

      expect(pairs).toHaveLength(1);
      expect(pairs[0]).toEqual({ note: 5, pulse: 0, isRest: false });
    });

    test('builds pairs from intervals', () => {
      const basePair = { note: 0, pulse: 0 };
      const intervals = [
        { soundInterval: 3, temporalInterval: 2 },
        { soundInterval: 2, temporalInterval: 1 }
      ];
      const pairs = buildPairsFromIntervals(basePair, intervals);

      expect(pairs).toHaveLength(3);
      expect(pairs[0]).toEqual({ note: 0, pulse: 0, isRest: false });
      expect(pairs[1]).toEqual({ note: 3, pulse: 0, temporalInterval: 2, isRest: false });
      expect(pairs[2]).toEqual({ note: 5, pulse: 2, temporalInterval: 1, isRest: false });
    });

    test('handles rests in intervals', () => {
      const basePair = { note: 3, pulse: 0 };
      const intervals = [
        { soundInterval: 0, temporalInterval: 2, isRest: true }
      ];
      const pairs = buildPairsFromIntervals(basePair, intervals);

      expect(pairs).toHaveLength(2);
      expect(pairs[1]).toEqual({
        note: 3,
        pulse: 0,
        temporalInterval: 2,
        isRest: true
      });
    });

    test('skips intervals with invalid temporalInterval', () => {
      const basePair = { note: 0, pulse: 0 };
      const intervals = [
        { soundInterval: 3, temporalInterval: 2 },
        { soundInterval: 1, temporalInterval: 0 },
        { soundInterval: 2, temporalInterval: 1 }
      ];
      const pairs = buildPairsFromIntervals(basePair, intervals);

      expect(pairs).toHaveLength(3);
      expect(pairs[2].note).toBe(5);
      expect(pairs[2].pulse).toBe(2);
    });

    test('supports wrapAround for note range', () => {
      const basePair = { note: 10, pulse: 0 };
      const intervals = [
        { soundInterval: 5, temporalInterval: 1 }
      ];
      const pairs = buildPairsFromIntervals(basePair, intervals, { wrapAround: true });

      expect(pairs[1].note).toBe(3); // 10 + 5 = 15, wrapped to 3 (mod 12)
    });

    test('supports custom noteRange for wrapAround', () => {
      const basePair = { note: 5, pulse: 0 };
      const intervals = [
        { soundInterval: 4, temporalInterval: 1 }
      ];
      const pairs = buildPairsFromIntervals(basePair, intervals, {
        wrapAround: true,
        noteRange: [0, 7]
      });

      expect(pairs[1].note).toBe(1); // 5 + 4 = 9, wrapped to 1 in [0,7] range
    });

    test('supports temporal property name', () => {
      const basePair = { note: 0, pulse: 0 };
      const intervals = [
        { soundInterval: 3, temporal: 2 }
      ];
      const pairs = buildPairsFromIntervals(basePair, intervals);

      expect(pairs[1].temporalInterval).toBe(2);
    });
  });

  describe('validatePairSequence', () => {
    test('returns valid for empty input', () => {
      const result = validatePairSequence([]);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('validates note range', () => {
      const pairs = [
        { note: 15, pulse: 0, temporalInterval: 1 }
      ];
      const result = validatePairSequence(pairs, { noteRange: [0, 11] });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('out of range');
    });

    test('validates pulse continuity', () => {
      const pairs = [
        { note: 3, pulse: 0, temporalInterval: 2 },
        { note: 5, pulse: 5, temporalInterval: 1 }
      ];
      const result = validatePairSequence(pairs);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('expected pulse 2');
    });

    test('validates max pulse', () => {
      const pairs = [
        { note: 3, pulse: 6, temporalInterval: 3 }
      ];
      const result = validatePairSequence(pairs, { maxPulse: 8 });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('exceeds max');
    });

    test('valid sequence passes all checks', () => {
      const pairs = [
        { note: 3, pulse: 0, temporalInterval: 2 },
        { note: 5, pulse: 2, temporalInterval: 3 }
      ];
      const result = validatePairSequence(pairs);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateIntervalSequence', () => {
    test('returns valid for empty input', () => {
      const result = validateIntervalSequence([], { note: 0, pulse: 0 });
      expect(result.valid).toBe(true);
    });

    test('validates positive iT', () => {
      const intervals = [{ soundInterval: 3, temporalInterval: -1 }];
      const result = validateIntervalSequence(intervals, { note: 0, pulse: 0 });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('iT must be positive');
    });

    test('validates note stays in range', () => {
      const intervals = [{ soundInterval: 15, temporalInterval: 1 }];
      const result = validateIntervalSequence(intervals, { note: 0, pulse: 0 }, {
        noteRange: [0, 11]
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('out of range');
    });

    test('validates pulse stays in range', () => {
      const intervals = [
        { soundInterval: 3, temporalInterval: 5 },
        { soundInterval: 2, temporalInterval: 5 }
      ];
      const result = validateIntervalSequence(intervals, { note: 0, pulse: 0 }, {
        maxPulse: 8
      });

      expect(result.valid).toBe(false);
      expect(result.invalidIndex).toBe(1);
    });

    test('returns invalidIndex for first error', () => {
      const intervals = [
        { soundInterval: 3, temporalInterval: 1 },
        { soundInterval: 20, temporalInterval: 1 }
      ];
      const result = validateIntervalSequence(intervals, { note: 0, pulse: 0 });

      expect(result.invalidIndex).toBe(1);
    });

    test('valid sequence passes all checks', () => {
      const intervals = [
        { soundInterval: 3, temporalInterval: 2 },
        { soundInterval: 2, temporalInterval: 3 }
      ];
      const result = validateIntervalSequence(intervals, { note: 0, pulse: 0 });

      expect(result.valid).toBe(true);
      expect(result.invalidIndex).toBe(null);
    });
  });
});
