/**
 * pulse-selectability.js
 *
 * Módulo compartido para determinar selectabilidad de pulsos
 * enteros y fraccionados en timelines rítmicos.
 *
 * Usado por: App2, App4, y futuras apps con timeline fraccionado
 */

export const FRACTION_POSITION_EPSILON = 1e-6;

/**
 * Determina si un pulso entero es seleccionable según la fracción activa.
 * Permite pulsos múltiplos del numerador Y pulsos sobrantes al final.
 *
 * @param {number} index - Índice del pulso (0 a Lg)
 * @param {number} numerator - Numerador de la fracción (n)
 * @param {number} denominator - Denominador de la fracción (d) [reservado para futuro]
 * @param {number} lg - Longitud total (Lg)
 * @returns {boolean} true si el pulso es seleccionable
 *
 * @example
 * // Con n=3, Lg=10:
 * isIntegerPulseSelectable(3, 3, 4, 10)  // true (múltiplo de 3)
 * isIntegerPulseSelectable(6, 3, 4, 10)  // true (múltiplo de 3)
 * isIntegerPulseSelectable(9, 3, 4, 10)  // true (múltiplo de 3)
 * isIntegerPulseSelectable(7, 3, 4, 10)  // true (remainder - sobrante)
 * isIntegerPulseSelectable(8, 3, 4, 10)  // true (remainder - sobrante)
 * isIntegerPulseSelectable(1, 3, 4, 10)  // false (no múltiplo, no sobrante)
 * isIntegerPulseSelectable(2, 3, 4, 10)  // false (no múltiplo, no sobrante)
 */
export function isIntegerPulseSelectable(index, numerator, denominator, lg) {
  // Validar entrada
  if (!Number.isFinite(index) || !Number.isFinite(lg) || lg <= 0) {
    return false;
  }

  // Extremos (0 y Lg) no seleccionables directamente (controlados por Loop)
  if (index === 0 || index === lg) {
    return false;
  }

  // Sin fracción válida: todos los pulsos intermedios son seleccionables
  if (!Number.isFinite(numerator) || numerator <= 0) {
    return true;
  }

  // Pulsos múltiplos del numerador: siempre seleccionables
  if (index % numerator === 0) {
    return true;
  }

  // NUEVO: Pulsos sobrantes al final (cuando Lg % numerator !== 0)
  // Ejemplo: n=3, Lg=10 → lastCycleStart=9, remainder=[10]
  //          Los pulsos 7,8,9 están disponibles (7,8 son remainder, 9 es múltiplo)
  const lastCycleStart = Math.floor(lg / numerator) * numerator;
  return index > lastCycleStart;
}

/**
 * Identifica si un pulso está en la región "remainder" (sobrante).
 * Estos pulsos no son múltiplos del numerador pero caen después del último ciclo completo.
 *
 * @param {number} index - Índice del pulso
 * @param {number} numerator - Numerador de la fracción (n)
 * @param {number} lg - Longitud total (Lg)
 * @returns {boolean} true si el pulso es un remainder
 *
 * @example
 * // Con n=3, Lg=10:
 * isPulseRemainder(7, 3, 10)  // true (sobrante)
 * isPulseRemainder(8, 3, 10)  // true (sobrante)
 * isPulseRemainder(9, 3, 10)  // false (múltiplo de 3)
 * isPulseRemainder(10, 3, 10) // false (endpoint Lg)
 */
export function isPulseRemainder(index, numerator, lg) {
  if (!Number.isFinite(index) || !Number.isFinite(numerator) || !Number.isFinite(lg)) {
    return false;
  }
  if (numerator <= 0 || index <= 0 || index > lg) {
    return false;
  }

  const lastCycleStart = Math.floor(lg / numerator) * numerator;

  // Es remainder si está después del último ciclo Y no es endpoint Y no es múltiplo
  return index > lastCycleStart && index < lg && index % numerator !== 0;
}

/**
 * Crea clave única para identificar una fracción (usado en App4).
 * Formato: "base+numerator/denominator"
 *
 * @param {number} base - Pulso base entero
 * @param {number} numerator - Numerador de la fracción
 * @param {number} denominator - Denominador de la fracción
 * @returns {string|null} Clave única o null si inválido
 *
 * @example
 * makeFractionKey(3, 1, 4)  // "3+1/4"
 * makeFractionKey(5, 2, 3)  // "5+2/3"
 */
export function makeFractionKey(base, numerator, denominator) {
  if (!Number.isFinite(base) || !Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    return null;
  }
  if (denominator <= 0 || numerator <= 0 || numerator >= denominator) {
    return null;
  }
  return `${base}+${numerator}/${denominator}`;
}

/**
 * Valida si una fracción es seleccionable en el contexto actual.
 * Una fracción es seleccionable si su pulso base es seleccionable.
 *
 * @param {number} base - Pulso base de la fracción
 * @param {number} numerator - Numerador de la fracción activa (n)
 * @param {number} denominator - Denominador de la fracción activa (d)
 * @param {number} lg - Longitud total (Lg)
 * @returns {boolean} true si la fracción es seleccionable
 *
 * @example
 * // Con n=3, d=4, Lg=10:
 * isFractionSelectable(3, 3, 4, 10)   // true (base=3 es múltiplo)
 * isFractionSelectable(7, 3, 4, 10)   // true (base=7 es remainder)
 * isFractionSelectable(1, 3, 4, 10)   // false (base=1 no seleccionable)
 */
export function isFractionSelectable(base, numerator, denominator, lg) {
  // Una fracción es seleccionable si su pulso base es seleccionable
  return isIntegerPulseSelectable(base, numerator, denominator, lg);
}

/**
 * Calcula el rango de pulsos sobrantes (remainder range).
 *
 * @param {number} numerator - Numerador de la fracción (n)
 * @param {number} lg - Longitud total (Lg)
 * @returns {{start: number, end: number, count: number} | null} Rango de remainder o null
 *
 * @example
 * getRemainderRange(3, 10)  // { start: 10, end: 10, count: 1 } (10 % 3 = 1)
 * getRemainderRange(4, 10)  // { start: 9, end: 10, count: 2 } (10 % 4 = 2)
 * getRemainderRange(5, 10)  // null (10 % 5 = 0, no remainder)
 */
export function getRemainderRange(numerator, lg) {
  if (!Number.isFinite(numerator) || !Number.isFinite(lg) || numerator <= 0 || lg <= 0) {
    return null;
  }

  const remainder = lg % numerator;
  if (remainder === 0) {
    return null; // No hay remainder
  }

  const lastCycleStart = Math.floor(lg / numerator) * numerator;

  return {
    start: lastCycleStart + 1,
    end: lg,
    count: remainder
  };
}
