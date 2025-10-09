// it-calculator.js
// Calcula intervalos temporales entre pulsos consecutivos seleccionados

/**
 * Calcula los intervalos entre pulsos consecutivos seleccionados
 * @param {Set<number>} selectedPulses - Conjunto de pulsos seleccionados
 * @param {number} lg - Longitud total de la secuencia
 * @returns {Array<{start: number, end: number, duration: number}>} - Array de intervalos
 */
export function calculateIntervals(selectedPulses, lg) {
  if (!selectedPulses || selectedPulses.size === 0) return [];
  if (!Number.isFinite(lg) || lg <= 0) return [];

  // Convertir Set a array ordenado
  const sorted = Array.from(selectedPulses).sort((a, b) => a - b);

  const intervals = [];

  // Calcular intervalos entre pulsos consecutivos
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    const duration = end - start;

    if (duration > 0) {
      intervals.push({ start, end, duration });
    }
  }

  return intervals;
}

/**
 * Calcula la duración total de todos los intervalos
 * @param {Array<{start: number, end: number, duration: number}>} intervals
 * @returns {number}
 */
export function getTotalDuration(intervals) {
  if (!Array.isArray(intervals)) return 0;
  return intervals.reduce((sum, interval) => sum + (interval.duration || 0), 0);
}

/**
 * Encuentra el intervalo que contiene una posición dada
 * @param {Array<{start: number, end: number, duration: number}>} intervals
 * @param {number} position
 * @returns {{start: number, end: number, duration: number} | null}
 */
export function findIntervalAtPosition(intervals, position) {
  if (!Array.isArray(intervals)) return null;
  if (!Number.isFinite(position)) return null;

  return intervals.find(interval =>
    position >= interval.start && position <= interval.end
  ) || null;
}

/**
 * Verifica si dos pulsos son consecutivos en la secuencia de seleccionados
 * @param {number} pulse1
 * @param {number} pulse2
 * @param {Set<number>} selectedPulses
 * @returns {boolean}
 */
export function areConsecutiveSelected(pulse1, pulse2, selectedPulses) {
  if (!selectedPulses) return false;
  if (!selectedPulses.has(pulse1) || !selectedPulses.has(pulse2)) return false;

  const sorted = Array.from(selectedPulses).sort((a, b) => a - b);
  const idx1 = sorted.indexOf(pulse1);
  const idx2 = sorted.indexOf(pulse2);

  return Math.abs(idx1 - idx2) === 1;
}
