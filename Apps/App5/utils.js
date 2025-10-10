export { computeHitSizePx, computeNumberFontRem, solidMenuBackground } from '../../libs/app-common/utils.js';

/**
 * Calcula el tamaño de fuente adaptativo para números de intervalos temporales (iT).
 * Los números de intervalos deben ser grandes (como pulsos antes de reducción 25%)
 * pero adaptarse cuando Lg es muy grande.
 *
 * @param {number} lg - Valor de Lg (número total de intervalos)
 * @returns {number} Tamaño de fuente en rem
 */
export function computeIntervalNumberFontRem(lg) {
  const BASE_REM = 1.6;   // Tamaño base grande (como pulsos antes de reducir)
  const TARGET   = 15;    // Lg de referencia óptimo
  const K        = 0.4;   // Escala más suave que pulsos (menos agresivo)

  // Detect mobile screen
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 600px)').matches;

  // Adjust limits based on screen size
  const MIN_REM  = isMobile ? 0.7 : 0.9;   // Mínimo más grande que CSS actual (0.65/0.75)
  const MAX_REM  = isMobile ? 1.2 : 1.8;   // Máximo generoso para Lg pequeños

  const safeLg   = Math.max(1, Number(lg) || 1);
  const scale    = Math.pow(TARGET / safeLg, K);
  return Math.max(MIN_REM, Math.min(MAX_REM, BASE_REM * scale));
}
