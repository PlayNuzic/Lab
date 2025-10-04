const DEFAULT_DURATION = '8';

export function durationValueFromDenominator(denominator) {
  const value = Number.isFinite(denominator) ? Math.max(1, Math.round(denominator)) : null;
  if (value == null) return DEFAULT_DURATION;

  // Mapeo correcto: denominador → duración VexFlow
  if (value === 1) return 'w';   // redonda
  if (value === 2) return 'h';   // blanca
  if (value === 4) return 'q';   // negra
  if (value === 8) return '8';   // corchea
  if (value === 16) return '16'; // semicorchea
  if (value === 32) return '32'; // fusa
  if (value === 64) return '64'; // semifusa

  // Para valores intermedios, usar la duración más cercana
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
