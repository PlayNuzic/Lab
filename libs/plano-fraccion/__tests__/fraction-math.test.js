import {
  calculateVariableLg,
  getTotalSubdivisions,
  subdivToPosition,
  formatPulseValue,
  filterInvalidNotes
} from '../fraction-math.js';

describe('fraction-math', () => {
  // ── calculateVariableLg ──────────────────────────

  describe('calculateVariableLg', () => {
    it('returns baseLg when numerator divides evenly', () => {
      expect(calculateVariableLg(2, 12)).toBe(12);  // 6*2
      expect(calculateVariableLg(3, 12)).toBe(12);  // 4*3
      expect(calculateVariableLg(4, 12)).toBe(12);  // 3*4
      expect(calculateVariableLg(6, 12)).toBe(12);  // 2*6
    });

    it('returns largest multiple fitting in baseLg', () => {
      expect(calculateVariableLg(5, 12)).toBe(10);  // 2*5
      expect(calculateVariableLg(7, 12)).toBe(7);   // 1*7
    });

    it('guarantees at least 1 cycle', () => {
      expect(calculateVariableLg(15, 12)).toBe(15);  // 1*15 (single cycle)
    });

    it('defaults baseLg to 12', () => {
      expect(calculateVariableLg(3)).toBe(12);
    });
  });

  // ── getTotalSubdivisions ─────────────────────────

  describe('getTotalSubdivisions', () => {
    it('simple fraction (n=1): lg * d', () => {
      expect(getTotalSubdivisions(12, 1, 2)).toBe(24);
      expect(getTotalSubdivisions(12, 1, 3)).toBe(36);
      expect(getTotalSubdivisions(12, 1, 8)).toBe(96);
    });

    it('complex fraction: (lg * d) / n', () => {
      expect(getTotalSubdivisions(12, 2, 3)).toBe(18);
      expect(getTotalSubdivisions(10, 5, 7)).toBe(14);
      expect(getTotalSubdivisions(12, 3, 4)).toBe(16);
    });
  });

  // ── subdivToPosition ─────────────────────────────

  describe('subdivToPosition', () => {
    it('simple fraction: subdiv * 1 / d', () => {
      expect(subdivToPosition(0, 1, 2)).toBe(0);
      expect(subdivToPosition(4, 1, 2)).toBe(2);
      expect(subdivToPosition(6, 1, 3)).toBe(2);
    });

    it('complex fraction: subdiv * n / d', () => {
      expect(subdivToPosition(0, 2, 3)).toBe(0);
      expect(subdivToPosition(3, 2, 3)).toBe(2);
      expect(subdivToPosition(6, 2, 3)).toBe(4);
    });
  });

  // ── formatPulseValue ─────────────────────────────

  describe('formatPulseValue', () => {
    it('formats integers without decimals', () => {
      expect(formatPulseValue(0)).toBe('0');
      expect(formatPulseValue(5)).toBe('5');
      expect(formatPulseValue(12)).toBe('12');
    });

    it('formats decimals with up to 2 places', () => {
      expect(formatPulseValue(0.5)).toBe('0.5');
      expect(formatPulseValue(2.333333)).toBe('2.33');
      expect(formatPulseValue(1.10)).toBe('1.1');
    });

    it('handles non-finite values', () => {
      expect(formatPulseValue(NaN)).toBe('0');
      expect(formatPulseValue(Infinity)).toBe('0');
    });
  });

  // ── filterInvalidNotes ───────────────────────────

  describe('filterInvalidNotes', () => {
    it('removes notes starting beyond maxSubdiv', () => {
      const notes = [
        { startSubdiv: 0, duration: 2 },
        { startSubdiv: 10, duration: 1 },
        { startSubdiv: 15, duration: 1 }
      ];
      const result = filterInvalidNotes(notes, 12);
      expect(result).toHaveLength(2);
      expect(result[1].startSubdiv).toBe(10);
    });

    it('trims notes that extend beyond maxSubdiv', () => {
      const notes = [{ startSubdiv: 10, duration: 5 }];
      const result = filterInvalidNotes(notes, 12);
      expect(result[0].duration).toBe(2);
    });

    it('does not mutate original array', () => {
      const notes = [{ startSubdiv: 10, duration: 5 }];
      const result = filterInvalidNotes(notes, 12);
      expect(notes[0].duration).toBe(5);
      expect(result[0].duration).toBe(2);
    });

    it('passes through valid notes unchanged', () => {
      const notes = [
        { startSubdiv: 0, duration: 3 },
        { startSubdiv: 5, duration: 2 }
      ];
      const result = filterInvalidNotes(notes, 12);
      expect(result).toEqual(notes);
    });
  });
});
