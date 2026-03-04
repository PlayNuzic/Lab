/**
 * ghost-pulse.js — Renders ghost pulse lines on the plano matrix.
 *
 * Ghost pulses are integer-pulse positions that fall between subdivision
 * boundaries (only relevant for complex fractions where n > 1).
 *
 * Shared by Apps 33, 35.
 */

/**
 * Render vertical dashed "ghost" lines for integer pulses that don't
 * align with subdivision column boundaries.
 *
 * @param {HTMLElement} matrix       — .plano-matrix element
 * @param {object}      opts
 * @param {number}      opts.lg          — total pulse length
 * @param {number}      opts.numerator   — fraction numerator
 * @param {number}      opts.denominator — fraction denominator
 * @param {number}      opts.cellWidth   — pixel width of a cell
 * @returns {Object<number, HTMLElement>} map of pulse → DOM element
 */
export function renderGhostPulseLines(matrix, { lg, numerator: n, denominator: d, cellWidth }) {
  // Remove existing ghost lines
  matrix.querySelectorAll('.ghost-pulse-line').forEach(el => el.remove());

  const ghostLines = {};
  const totalSubdivs = (lg * d) / n;

  for (let pulse = 0; pulse < lg; pulse++) {
    const subdivPos = pulse * d / n;

    // Skip if aligned with a subdivision start (integer position)
    if (subdivPos % 1 === 0) continue;
    // Skip if beyond grid
    if (subdivPos >= totalSubdivs) continue;

    const line = document.createElement('div');
    line.className = 'ghost-pulse-line';
    line.style.left = `${subdivPos * cellWidth}px`;
    line.dataset.pulse = String(pulse);
    matrix.appendChild(line);
    ghostLines[pulse] = line;
  }

  return ghostLines;
}
