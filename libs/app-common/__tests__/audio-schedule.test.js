import { computeNextZero, __testing__ } from '../audio-schedule.js';

const { normalizeNumber } = __testing__;

describe('computeNextZero', () => {
  test('returns null for invalid period', () => {
    expect(computeNextZero({ now: 1, period: 0 })).toBeNull();
    expect(computeNextZero({ now: 1, period: NaN })).toBeNull();
  });

  test('computes next zero and schedule time', () => {
    const info = computeNextZero({ now: 1.25, period: 2, lookAhead: 0.5 });
    expect(info.previousTime).toBeCloseTo(0);
    expect(info.eventTime).toBeCloseTo(2);
    expect(info.scheduleTime).toBeCloseTo(1.5);
  });

  test('skips past event when scheduling window elapsed', () => {
    const info = computeNextZero({ now: 1.9, period: 2, lookAhead: 0.5 });
    expect(info.eventTime).toBeCloseTo(4);
    expect(info.scheduleTime).toBeGreaterThan(info.previousTime);
    expect(info.scheduleTime).toBeGreaterThanOrEqual(1.9);
  });

  test('handles exact multiples without lookAhead', () => {
    const info = computeNextZero({ now: 4, period: 2, lookAhead: 0 });
    expect(info.previousTime).toBeCloseTo(4);
    expect(info.eventTime).toBeCloseTo(4);
    expect(info.scheduleTime).toBeCloseTo(4);
  });
});

describe('normalizeNumber', () => {
  test('returns fallback when not finite', () => {
    expect(normalizeNumber('foo', 3)).toBe(3);
  });

  test('returns finite number', () => {
    expect(normalizeNumber('4.5')).toBe(4.5);
  });
});
