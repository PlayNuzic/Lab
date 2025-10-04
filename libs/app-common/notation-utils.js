const DEFAULT_DURATION = '8';

/**
 * Mapea un denominador de fracción a una duración VexFlow.
 * Para fracciones musicales estándar (potencias de 2): denominador → duración exacta
 * Para tuplets (3, 5, 6, 7, 9, etc.): usa la figura base más cercana
 *
 * Ejemplos:
 * - 1 → 'w' (redonda)
 * - 2 → 'h' (blanca)
 * - 3 → '8' (corchea - se usará con tuplet 3:2 para tresillo)
 * - 4 → 'q' (negra)
 * - 5 → '16' (semicorchea - se usará con tuplet 5:4 para cinquillo)
 * - 6 → '16' (semicorchea - se usará con tuplet 6:4 para seisillo)
 */
export function durationValueFromDenominator(denominator) {
  const value = Number.isFinite(denominator) ? Math.max(1, Math.round(denominator)) : null;
  if (value == null) return DEFAULT_DURATION;

  // Mapeo exacto para potencias de 2 (fracciones simples)
  if (value === 1) return 'w';   // redonda
  if (value === 2) return 'h';   // blanca
  if (value === 4) return 'q';   // negra
  if (value === 8) return '8';   // corchea
  if (value === 16) return '16'; // semicorchea
  if (value === 32) return '32'; // fusa
  if (value === 64) return '64'; // semifusa

  // Para tuplets (no potencias de 2), usar la figura base correspondiente:
  // 3 → corchea (para tresillo de corchea)
  // 5, 6, 7 → semicorchea (para cinquillo, seisillo, septillo)
  // 9 → fusa (para nonillo)

  if (value === 3) return '8';   // tresillo de corchea
  if (value >= 5 && value <= 7) return '16'; // cinquillo, seisillo, septillo
  if (value === 9) return '32';  // nonillo de fusa

  // Para valores intermedios, usar la duración más cercana por arriba
  if (value < 2) return 'h';
  if (value < 4) return 'q';
  if (value < 8) return '8';
  if (value < 16) return '16';
  if (value < 32) return '32';
  return '64';
}

export function buildPulseEvents({ lg, selectedSet = new Set(), duration = DEFAULT_DURATION, includeZero = true } = {}) {
  const events = [];
  const safeLg = Number.isFinite(lg) && lg > 0 ? Math.floor(lg) : 0;
  if (safeLg <= 0) return events;
  const resolvedDuration = typeof duration === 'string' && duration.trim() ? duration.trim() : DEFAULT_DURATION;

  for (let i = 0; i < safeLg; i++) {
    const isZero = i === 0;
    const shouldRenderNote = (includeZero && isZero) || selectedSet.has(i);
    events.push({
      pulseIndex: i,
      duration: resolvedDuration,
      rest: !shouldRenderNote
    });
  }

  return events;
}
