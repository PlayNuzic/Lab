const DEFAULT_DURATION = '8';
const PULSE_INDEX_KEY_SCALE = 1e6;

function makePulseIndexKey(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.round(numeric * PULSE_INDEX_KEY_SCALE);
}

function normalizeSelectedSet(selectedSet) {
  const normalized = new Set();
  if (!selectedSet) return normalized;
  if (selectedSet instanceof Set || typeof selectedSet[Symbol.iterator] === 'function') {
    for (const value of selectedSet) {
      const key = makePulseIndexKey(value);
      if (key != null) normalized.add(key);
    }
  }
  return normalized;
}

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

export function buildPulseEvents({
  lg,
  selectedSet = new Set(),
  duration = DEFAULT_DURATION,
  dots = 0,
  includeZero = true,
  fractionalSelections = [],
  numerator = null,
  denominator = null
} = {}) {
  const events = [];
  const safeLg = Number.isFinite(lg) && lg > 0 ? Math.floor(lg) : 0;
  if (safeLg <= 0) return events;
  const resolvedDuration = typeof duration === 'string' && duration.trim() ? duration.trim() : DEFAULT_DURATION;
  const resolvedDots = Number.isFinite(dots) ? Math.max(0, Math.floor(dots)) : 0;
  const normalizedSelected = normalizeSelectedSet(selectedSet);
  const entryLookup = new Map();

  // Determinar qué pulsos deben aparecer en la partitura
  const shouldIncludePulse = (i) => {
    // Siempre incluir pulso 0 si está habilitado
    if (i === 0) return includeZero;

    // Excluir el pulso Lg (marca final, no seleccionable)
    if (i === safeLg) return false;

    // Si no hay fracción válida, incluir todos los pulsos seleccionados
    if (!Number.isFinite(numerator) || numerator <= 0) {
      return normalizedSelected.has(makePulseIndexKey(i));
    }

    // Con fracción: incluir TODOS los múltiplos del numerador Y todos los pulsos remainder
    const isMultiple = i % numerator === 0;
    const lastCycleStart = Math.floor(safeLg / numerator) * numerator;
    const isRemainder = i > lastCycleStart && i < safeLg;

    // Incluir TODOS los múltiplos (para crear estructura de tuplets, seleccionados como nota, no seleccionados como silencio)
    if (isMultiple) {
      return true;
    }

    // Incluir TODOS los pulsos remainder (seleccionados como nota, no seleccionados como silencio)
    return isRemainder;
  };

  for (let i = 0; i < safeLg; i++) {
    const key = makePulseIndexKey(i);
    const shouldInclude = shouldIncludePulse(i);

    // Solo crear evento si debe aparecer en la partitura
    if (!shouldInclude) continue;

    const isZero = i === 0;
    const isSelected = normalizedSelected.has(key);
    const entry = {
      pulseIndex: i,
      duration: resolvedDuration,
      rest: !isZero && !isSelected, // Pulso 0 nunca es silencio, resto según selección
      dots: resolvedDots
    };
    events.push(entry);
    if (key != null) {
      entryLookup.set(key, entry);
    }
  }

  if (Array.isArray(fractionalSelections) && fractionalSelections.length > 0) {
    fractionalSelections.forEach((raw) => {
      const value = Number.isFinite(raw?.pulseIndex) ? Number(raw.pulseIndex)
        : (Number.isFinite(raw?.value) ? Number(raw.value) : NaN);
      if (!Number.isFinite(value)) return;
      const key = makePulseIndexKey(value);
      if (key == null) return;
      const target = entryLookup.get(key);
      if (target) {
        target.rest = Boolean(raw?.rest);
        if (raw?.duration != null) {
          target.duration = raw.duration;
        }
        if (Number.isFinite(raw?.dots)) {
          target.dots = Math.max(0, Math.floor(raw.dots));
        }
        if (raw?.selectionKey != null) {
          target.selectionKey = raw.selectionKey;
        }
        if (raw?.source != null) {
          target.source = raw.source;
        }
        return;
      }

      const extra = {
        pulseIndex: value,
        duration: raw?.duration != null ? raw.duration : resolvedDuration,
        rest: Boolean(raw?.rest),
        dots: Number.isFinite(raw?.dots)
          ? Math.max(0, Math.floor(raw.dots))
          : resolvedDots,
      };
      if (raw?.selectionKey != null) {
        extra.selectionKey = raw.selectionKey;
      }
      if (raw?.source != null) {
        extra.source = raw.source;
      }
      events.push(extra);
      entryLookup.set(key, extra);
    });

    events.sort((a, b) => a.pulseIndex - b.pulseIndex);
  }

  return events;
}

export function makeFractionPulseKey(value) {
  return makePulseIndexKey(value);
}
