import { describe, test, expect } from '@jest/globals';
import { computePolyrhythmInfo } from '../polyrhythm-info.js';

describe('computePolyrhythmInfo', () => {
  test('sense fraccions: cicle gran 1, ciclos = lg, proporció [1]', () => {
    const r = computePolyrhythmInfo({ lg: 3, v: 90, fractions: [] });
    expect(r.bigCycle).toBe(1);
    expect(r.cycles).toBe(3);
    expect(r.lcmDenominators).toBe(1);
    expect(r.ratio).toEqual([1]);
    expect(r.durationSec).toBeCloseTo(2); // 3·60/90
    expect(r.fractions).toEqual([]);
  });

  test('una fracció 3/4 (lg=9, v=90)', () => {
    const r = computePolyrhythmInfo({ lg: 9, v: 90, fractions: [{ numerator: 3, denominator: 4 }] });
    expect(r.bigCycle).toBe(3);          // mcm(3)
    expect(r.cycles).toBe(3);            // 9/3
    expect(r.lcmDenominators).toBe(4);
    expect(r.durationSec).toBeCloseTo(6); // 9·60/90
    const f = r.fractions[0];
    expect(f.velocity).toBeCloseTo(120); // 90·4/3
    expect(f.pulsesPerCycle).toBe(4);    // 3·4/3
    expect(f.reducible).toBe(false);
    expect(r.ratio).toEqual([3, 4]);     // pols:3/4 = 1 : 4/3 = 3:4
  });

  test('dues fraccions 3/4 + 2/3 → proporció 6:8:9', () => {
    const r = computePolyrhythmInfo({
      lg: 6, v: 120,
      fractions: [{ numerator: 3, denominator: 4 }, { numerator: 2, denominator: 3 }]
    });
    expect(r.bigCycle).toBe(6);          // mcm(3,2)
    expect(r.lcmDenominators).toBe(12);  // mcm(4,3)
    expect(r.ratio).toEqual([6, 8, 9]);  // pols : 4/3 : 3/2 → ×6 → 6:8:9
    expect(r.fractions[0].pulsesPerCycle).toBe(8);  // 6·4/3
    expect(r.fractions[1].pulsesPerCycle).toBe(9);  // 6·3/2
  });

  test('fracció reduïble 2/4 → reduïda 1/2', () => {
    const r = computePolyrhythmInfo({ lg: 2, v: 60, fractions: [{ numerator: 2, denominator: 4 }] });
    const f = r.fractions[0];
    expect(f.reducedNumerator).toBe(1);
    expect(f.reducedDenominator).toBe(2);
    expect(f.reducible).toBe(true);
    expect(f.velocity).toBeCloseTo(120); // 60·4/2
    expect(r.bigCycle).toBe(1);          // mcm(1)
    expect(r.ratio).toEqual([1, 2]);     // pols : 1/2 (vel 2) = 1:2
  });

  test('sense V vàlida: velocity i durada null', () => {
    const r = computePolyrhythmInfo({ lg: 9, fractions: [{ numerator: 3, denominator: 4 }] });
    expect(r.durationSec).toBeNull();
    expect(r.fractions[0].velocity).toBeNull();
    expect(r.fractions[0].pulsesPerCycle).toBe(4); // no depèn de V
  });

  test('ignora fraccions invàlides', () => {
    const r = computePolyrhythmInfo({ lg: 4, v: 90, fractions: [{ numerator: 0, denominator: 4 }, { numerator: 2, denominator: 2 }] });
    expect(r.fractions).toHaveLength(1);
    expect(r.fractions[0].numerator).toBe(2);
  });
});
