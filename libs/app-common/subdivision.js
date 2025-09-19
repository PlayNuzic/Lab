const EPSILON = 1e-9;

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Compute pulse timing information from length (Lg) and tempo.
 *
 * @param {number} lg total number of pulses.
 * @param {number} tempo beats per minute.
 * @returns {{ pulses: number|null, tempo: number|null, interval: number|null, duration: number|null }}
 * @remarks PulseMemory = 1..Lg-1; 0/Lg derivats; re-sync a 0 amb `computeNextZero`. No depèn de DOM ni Audio; sense efectes laterals.
 */
export function fromLgAndTempo(lg, tempo) {
  const pulses = toFiniteNumber(lg);
  const tempoValue = toFiniteNumber(tempo);
  const validPulses = pulses != null && pulses > 0 ? pulses : null;
  const validTempo = tempoValue != null && tempoValue > 0 ? tempoValue : null;
  const interval = validTempo != null ? 60 / validTempo : null;
  const duration = interval != null && validPulses != null ? interval * validPulses : null;
  return {
    pulses: validPulses,
    tempo: validTempo,
    interval,
    duration
  };
}

/**
 * Build subdivision positions starting from the origin.
 *
 * @param {{ lg: number, numerator: number, denominator: number, offset?: number }} params
 * @returns {{ cycles: number, subdivisions: Array<{ cycleIndex: number, subdivisionIndex: number, position: number, absoluteIndex: number }>, numerator: number|null, denominator: number|null }}
 * @remarks PulseMemory = 1..Lg-1; 0/Lg derivats; combina amb `gridFromOrigin` + `computeNextZero` per sincronitzar visuals. No DOM; només càlcul pur.
 */
export function gridFromOrigin({ lg, numerator, denominator, offset = 0 }) {
  const totalPulses = toFiniteNumber(lg);
  const num = toFiniteNumber(numerator);
  const den = toFiniteNumber(denominator);
  const baseOffset = toFiniteNumber(offset) || 0;
  const validTotal = totalPulses != null && totalPulses > 0 ? totalPulses : null;
  const validNum = num != null && num > 0 ? num : null;
  const validDen = den != null && den > 0 ? den : null;

  if (validTotal == null || validNum == null || validDen == null) {
    return { cycles: 0, subdivisions: [], numerator: validNum, denominator: validDen };
  }

  const cycles = Math.floor(validTotal / validNum);
  if (cycles <= 0) {
    return { cycles: 0, subdivisions: [], numerator: validNum, denominator: validDen };
  }

  const subdivisions = [];
  const step = validNum / validDen;
  for (let cycleIndex = 0; cycleIndex < cycles; cycleIndex++) {
    const cycleStart = cycleIndex * validNum + baseOffset;
    for (let subdivisionIndex = 0; subdivisionIndex < validDen; subdivisionIndex++) {
      const position = cycleStart + subdivisionIndex * step;
      subdivisions.push({
        cycleIndex,
        subdivisionIndex,
        position,
        absoluteIndex: cycleIndex * validDen + subdivisionIndex
      });
    }
  }

  return { cycles, subdivisions, numerator: validNum, denominator: validDen };
}

/**
 * Scale subdivision labels so they remain legible for large Lg values.
 *
 * @param {number} lg total pulses (Lg) que controlen la mida.
 * @returns {number} mida de font en rem adaptada al nombre de pulsos.
 * @remarks Sense dependències (DOM només per consumir el valor retornat); cap efecte lateral.
 */
export function computeSubdivisionFontRem(lg) {
  const BASE_REM = 1.2;
  const TARGET = 24;
  const K = 0.75;
  const MIN_REM = 0.75;
  const safeLg = Math.max(1, Number(lg) || 1);
  if (safeLg <= TARGET) return BASE_REM;
  const scale = Math.pow(TARGET / safeLg, K);
  return Math.max(MIN_REM, BASE_REM * scale);
}

export const __testing__ = { toFiniteNumber, EPSILON };
