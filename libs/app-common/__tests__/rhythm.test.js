import { createDurationMetadata, generatePulsePermutations, getRhythmPattern } from '../rhythm.js';

describe('generatePulsePermutations', () => {
  test('limits the number of generated patterns', () => {
    const patterns = generatePulsePermutations(8, { maxPatterns: 3 });
    expect(patterns).toHaveLength(3);
    patterns.forEach(pattern => {
      expect(pattern.reduce((acc, value) => acc + value, 0)).toBe(8);
    });
  });
});

describe('createDurationMetadata', () => {
  test('computes metadata for standard denominators', () => {
    const metadata = createDurationMetadata({ pulses: 8, numerator: 4, denominator: 4 });
    expect(metadata.baseNoteName).toBe('corchea');
    expect(metadata.baseRestName).toBe('silencio de corchea');
    expect(metadata.tupletRatio).toBeNull();
    expect(metadata.durations.some(item => item.noteName === 'negra')).toBe(true);
  });
});

describe('getRhythmPattern', () => {
  test('produces note names for denominator 2', () => {
    const { metadata, sequence } = getRhythmPattern({ pulses: 8, numerator: 4, denominator: 2 });
    expect(metadata.baseNoteName).toBe('negra');
    expect(sequence[0].noteName).toBe('negra');
  });

  test('produces note names for denominator 4', () => {
    const { metadata, sequence } = getRhythmPattern({ pulses: 8, numerator: 4, denominator: 4 });
    expect(metadata.baseNoteName).toBe('corchea');
    expect(sequence[0].noteName).toBe('corchea');
  });

  test('produces note names for denominator 8', () => {
    const { metadata, sequence } = getRhythmPattern({ pulses: 12, numerator: 3, denominator: 8 });
    expect(metadata.baseNoteName).toBe('fusa');
    expect(sequence[0].noteName).toBe('fusa');
  });

  test('produces note names for denominator 16', () => {
    const { metadata, sequence } = getRhythmPattern({ pulses: 16, numerator: 4, denominator: 16 });
    expect(metadata.baseNoteName).toBe('semifusa');
    expect(sequence[0].noteName).toBe('semifusa');
  });

  test('handles tuplet ratio such as 3/5', () => {
    const { metadata, sequence } = getRhythmPattern({ pulses: 3, numerator: 3, denominator: 5 });
    expect(metadata.tupletRatio).toMatchObject({ numerator: 3, denominator: 5, text: '3:5' });
    expect(sequence[0].ratio).toMatchObject({ numerator: 3, denominator: 5, text: '3:5' });
    expect(sequence[0].noteName).toBe('figura 1/5');
  });
});
