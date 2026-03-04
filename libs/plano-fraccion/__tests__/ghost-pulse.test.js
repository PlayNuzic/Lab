/**
 * @jest-environment jsdom
 */
import { renderGhostPulseLines } from '../ghost-pulse.js';

function createMatrix() {
  const matrix = document.createElement('div');
  matrix.className = 'plano-matrix';
  return matrix;
}

describe('renderGhostPulseLines', () => {
  it('creates ghost lines for non-aligned integer pulses', () => {
    const matrix = createMatrix();
    // Fraction 2/3, Lg=12 → subdivs = 18
    // Pulse 1 at subdiv 1.5 (non-integer) → ghost
    // Pulse 2 at subdiv 3.0 (integer)     → skip
    // Pulse 3 at subdiv 4.5 (non-integer) → ghost
    const result = renderGhostPulseLines(matrix, {
      lg: 12, numerator: 2, denominator: 3, cellWidth: 40
    });

    // Pulses 1, 3, 5, 7, 9, 11 are non-aligned (odd pulses)
    const ghostLines = matrix.querySelectorAll('.ghost-pulse-line');
    expect(ghostLines.length).toBe(6);
    expect(result[1]).toBeDefined();
    expect(result[2]).toBeUndefined(); // pulse 2 aligns
  });

  it('returns empty for simple fractions (n=1)', () => {
    const matrix = createMatrix();
    // n=1 → every pulse at subdiv = p * d/1 = integer
    const result = renderGhostPulseLines(matrix, {
      lg: 12, numerator: 1, denominator: 3, cellWidth: 40
    });

    expect(matrix.querySelectorAll('.ghost-pulse-line').length).toBe(0);
    expect(Object.keys(result).length).toBe(0);
  });

  it('clears existing ghost lines before re-rendering', () => {
    const matrix = createMatrix();
    const existing = document.createElement('div');
    existing.className = 'ghost-pulse-line';
    matrix.appendChild(existing);

    renderGhostPulseLines(matrix, {
      lg: 12, numerator: 1, denominator: 2, cellWidth: 40
    });

    // Should have removed the existing one
    // n=1 so no new ghost lines
    expect(matrix.querySelectorAll('.ghost-pulse-line').length).toBe(0);
  });

  it('positions ghost lines correctly', () => {
    const matrix = createMatrix();
    const result = renderGhostPulseLines(matrix, {
      lg: 12, numerator: 2, denominator: 3, cellWidth: 50
    });

    // Pulse 1: subdivPos = 1 * 3/2 = 1.5, left = 1.5 * 50 = 75px
    expect(result[1].style.left).toBe('75px');
  });
});
