/**
 * Converts incoming values to finite numbers with a fallback.
 * @param {unknown} value Valor a normalitzar.
 * @param {number} fallback Valor de retorn si no és possible convertir.
 * @returns {number} Nombre normalitzat preparat per càlculs.
 * @remarks Útil per als rangs de configuració persistida.
 */
export function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Normalitza un parell mínim/màxim assegurant ordre i valors vàlids.
 * @param {unknown} minValue Valor mínim d'entrada (pot ser text).
 * @param {unknown} maxValue Valor màxim d'entrada (pot ser text).
 * @param {[number, number]} defaults Parell de reserva quan l'entrada no és vàlida.
 * @returns {[number, number]} Rang normalitzat `[min, max]`.
 * @remarks Garanteix que el mínim sempre sigui menor o igual que el màxim.
 */
export function toRange(minValue, maxValue, defaults) {
  const min = toNumber(minValue, defaults[0]);
  const max = toNumber(maxValue, defaults[1]);
  return min <= max ? [min, max] : [max, min];
}

// TODO[audit]: reason=App2/main.js manté una còpia pròpia; consolidar quan es validi aquest helper compartit
