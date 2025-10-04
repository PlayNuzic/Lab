const DEFAULT_DURATION = '8';

export function durationValueFromDenominator(denominator) {
  const value = Number.isFinite(denominator) ? Math.max(1, Math.round(denominator)) : null;
  if (value == null) return DEFAULT_DURATION;
  if (value <= 3) return '8';
  if (value <= 7) return '16';
  if (value <= 16) return '32';
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
