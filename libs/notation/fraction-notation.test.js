import { resolveFractionNotation } from './fraction-notation.js';

describe('resolveFractionNotation', () => {
  test('maps simple fractions with numerator 1 without ratio', () => {
    const quarter = resolveFractionNotation(1, 1);
    expect(quarter.duration).toBe('q');
    expect(quarter.tuplet.show).toBe(false);
    expect(quarter.tuplet.ratioed).toBe(false);

    const triplet = resolveFractionNotation(1, 3);
    expect(triplet.duration).toBe('8');
    expect(triplet.tuplet.show).toBe(true);
    expect(triplet.tuplet.ratioed).toBe(false);
  });

  test('maps complex fractions with numerator 2 using ratio', () => {
    const twoOverTwo = resolveFractionNotation(2, 2);
    expect(twoOverTwo.duration).toBe('q');
    expect(twoOverTwo.tuplet.show).toBe(false);

    const twoOverFive = resolveFractionNotation(2, 5);
    expect(twoOverFive.duration).toBe('8');
    expect(twoOverFive.tuplet.show).toBe(true);
    expect(twoOverFive.tuplet.ratioed).toBe(true);
  });

  test('includes dotted durations when required', () => {
    const threeOverTwo = resolveFractionNotation(3, 2);
    expect(threeOverTwo.duration).toBe('q');
    expect(threeOverTwo.dots).toBe(1);
    expect(threeOverTwo.tuplet.ratioed).toBe(true);
  });

  test('omits tuplets when numerator and denominator match', () => {
    const threeOverThree = resolveFractionNotation(3, 3);
    expect(threeOverThree.duration).toBe('q');
    expect(threeOverThree.tuplet.show).toBe(false);
    expect(threeOverThree.tuplet.ratioed).toBe(false);
  });

  test('supports higher numerators', () => {
    const sevenOverOne = resolveFractionNotation(7, 1);
    expect(sevenOverOne.duration).toBe('w');
    expect(sevenOverOne.dots).toBe(2);
    expect(sevenOverOne.tuplet.show).toBe(false);

    const eightOverThree = resolveFractionNotation(8, 3);
    expect(eightOverThree.duration).toBe('w');
    expect(eightOverThree.tuplet.show).toBe(true);
    expect(eightOverThree.tuplet.ratioed).toBe(true);
  });

  test('falls back gracefully for invalid values', () => {
    const invalid = resolveFractionNotation(null, 0);
    expect(invalid.duration).toBe('16');
    expect(invalid.tuplet.show).toBeNull();
  });
});
