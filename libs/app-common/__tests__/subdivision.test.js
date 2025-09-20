import { computeSubdivisionFontRem, fromLgAndTempo, gridFromOrigin, toPlaybackPulseCount, __testing__ } from '../subdivision.js';

const { toFiniteNumber } = __testing__;

describe('fromLgAndTempo', () => {
  test('returns nulls for invalid values', () => {
    expect(fromLgAndTempo('foo', -20)).toEqual({
      pulses: null,
      tempo: null,
      interval: null,
      duration: null
    });
  });

  test('computes interval and duration', () => {
    const result = fromLgAndTempo(8, 120);
    expect(result).toMatchObject({
      pulses: 8,
      tempo: 120,
      interval: 0.5,
      duration: 4
    });
  });
});

describe('gridFromOrigin', () => {
  test('returns empty grid when inputs invalid', () => {
    expect(gridFromOrigin({ lg: 0, numerator: 2, denominator: 3 })).toEqual({
      cycles: 0,
      subdivisions: [],
      numerator: 2,
      denominator: 3
    });
  });

  test('builds subdivision positions', () => {
    const grid = gridFromOrigin({ lg: 12, numerator: 3, denominator: 2 });
    expect(grid.cycles).toBe(4);
    expect(grid.subdivisions).toHaveLength(8);
    expect(grid.subdivisions[0]).toMatchObject({ cycleIndex: 0, subdivisionIndex: 0, position: 0 });
    expect(grid.subdivisions[1]).toMatchObject({ cycleIndex: 0, subdivisionIndex: 1, position: 1.5 });
    expect(grid.subdivisions[7]).toMatchObject({ cycleIndex: 3, subdivisionIndex: 1, position: 10.5 });
  });
});

describe('computeSubdivisionFontRem', () => {
  test('keeps base size for small lg', () => {
    expect(computeSubdivisionFontRem(8)).toBeCloseTo(1.2);
  });

  test('scales down for large lg', () => {
    const rem = computeSubdivisionFontRem(128);
    expect(rem).toBeLessThan(1.2);
    expect(rem).toBeGreaterThanOrEqual(0.75);
  });
});

describe('toFiniteNumber', () => {
  test('returns null for NaN values', () => {
    expect(toFiniteNumber('not-a-number')).toBeNull();
    expect(toFiniteNumber(Infinity)).toBeNull();
  });

  test('returns number when finite', () => {
    expect(toFiniteNumber('12')).toBe(12);
  });
});

describe('toPlaybackPulseCount', () => {
  test('returns null when pulses are invalid', () => {
    expect(toPlaybackPulseCount(null, true)).toBeNull();
    expect(toPlaybackPulseCount(undefined, false)).toBeNull();
    expect(toPlaybackPulseCount(-1, false)).toBeNull();
  });

  test('preserves total pulses when loop is enabled', () => {
    expect(toPlaybackPulseCount(8, true)).toBe(8);
    expect(toPlaybackPulseCount(3, true)).toBe(3);
  });

  test('adds the terminal pulse when loop is disabled', () => {
    expect(toPlaybackPulseCount(8, false)).toBe(9);
    expect(toPlaybackPulseCount(1, false)).toBe(2);
  });
});
