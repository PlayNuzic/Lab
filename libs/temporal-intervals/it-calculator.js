// it-calculator.js
// Calcula intervalos temporales - SIEMPRE todos los Lg intervalos

/**
 * Calcula TODOS los intervalos para un Lg dado.
 * Siempre retorna Lg intervalos, cada uno conectando pulsos consecutivos.
 *
 * @param {number} lg - El parámetro Lg (número del último pulso = cantidad de intervalos)
 * @returns {Array<{number: number, startPulse: number, endPulse: number}>} Array de intervalos
 *
 * Ejemplo: lg = 3
 * Retorna: [
 *   { number: 1, startPulse: 0, endPulse: 1 },  // Intervalo 1: pulso 0 → pulso 1
 *   { number: 2, startPulse: 1, endPulse: 2 },  // Intervalo 2: pulso 1 → pulso 2
 *   { number: 3, startPulse: 2, endPulse: 3 }   // Intervalo 3: pulso 2 → pulso 3
 * ]
 *
 * Fundamento matemático:
 * - Pulsos: 0, 1, 2, ..., Lg
 * - Intervalos: Lg total, numerados 1 a Lg
 * - Intervalo k conecta pulso (k-1) con pulso k
 */
export function calculateAllIntervals(lg) {
  if (!Number.isFinite(lg) || lg <= 0) return [];

  const intervals = [];

  // Crear Lg intervalos numerados 1 a Lg
  for (let i = 1; i <= lg; i++) {
    intervals.push({
      number: i,           // Número del intervalo: 1, 2, 3, ..., Lg
      startPulse: i - 1,   // Pulso inicial: 0, 1, 2, ..., Lg-1
      endPulse: i          // Pulso final: 1, 2, 3, ..., Lg
    });
  }

  return intervals;
}
