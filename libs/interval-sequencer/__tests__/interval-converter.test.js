/**
 * @jest-environment node
 */

import { pairsToIntervals } from '../interval-converter.js';

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
});
