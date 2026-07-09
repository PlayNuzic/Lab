/**
 * @jest-environment jsdom
 */
import { describe, test, expect } from '@jest/globals';
import { calculateIntervalComplexity, analyzePatternComplexity } from '../gamification-adapter.js';

describe('calculateIntervalComplexity', () => {
  test('sense intervals retorna low', () => {
    expect(calculateIntervalComplexity([])).toBe('low');
    expect(calculateIntervalComplexity(null)).toBe('low');
  });

  // Amb intervals constants la varianza és 0, per tant complexity === intervals.length
  // exactament: permet verificar els llindars (10/30/50) sense arrodoniments.
  test('llindars low/medium/high/expert amb intervals constants', () => {
    expect(calculateIntervalComplexity(Array(9).fill(4))).toBe('low');
    expect(calculateIntervalComplexity(Array(10).fill(4))).toBe('medium');
    expect(calculateIntervalComplexity(Array(29).fill(4))).toBe('medium');
    expect(calculateIntervalComplexity(Array(30).fill(4))).toBe('high');
    expect(calculateIntervalComplexity(Array(49).fill(4))).toBe('high');
    expect(calculateIntervalComplexity(Array(50).fill(4))).toBe('expert');
  });
});

describe('analyzePatternComplexity', () => {
  // Amb un patró de tot uns, density=1 i irregularity=0, per tant
  // score === pattern.length * 0.5 exactament: permet verificar els llindars (5/15/30).
  test('llindars low/medium/high/expert amb patró de tot uns', () => {
    expect(analyzePatternComplexity('1'.repeat(9))).toBe('low');   // score 4.5
    expect(analyzePatternComplexity('1'.repeat(10))).toBe('medium'); // score 5
    expect(analyzePatternComplexity('1'.repeat(29))).toBe('medium'); // score 14.5
    expect(analyzePatternComplexity('1'.repeat(30))).toBe('high');   // score 15
    expect(analyzePatternComplexity('1'.repeat(59))).toBe('high');   // score 29.5
    expect(analyzePatternComplexity('1'.repeat(60))).toBe('expert'); // score 30
  });
});
