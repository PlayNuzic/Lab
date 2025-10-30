/**
 * random-fractional.js
 *
 * Módulo de randomización con soporte completo de fracciones.
 * Extrae la lógica de randomización de App4 con soporte para:
 * - Randomización de Lg, V, T
 * - Randomización de fracciones (n/d) con modo simple/complejo
 * - Randomización de pulsos respetando seleccionables según fracción activa
 * - Randomización de fracciones en timeline
 */

import { randomize as randomizeValues } from './core.js';

/**
 * Randomiza parámetros con soporte de fracciones
 */
export function randomizeFractional({
  randomConfig,
  randomDefaults,
  inputs,
  fractionEditor,
  pulseMemoryApi,
  fractionStore,
  randomCount,
  isIntegerPulseSelectable,
  nearestPulseIndex,
  applyRandomFractionSelection,
  getAllowComplexFractions,
  callbacks = {
    onLgChange: null,
    onVChange: null,
    onFractionChange: null,
    onPulsesChange: null,
    renderNotation: null
  }
}) {
  const cfg = randomConfig || randomDefaults;
  const allowComplex = getAllowComplexFractions?.() ?? false;

  const randomRanges = {};

  // 1. Preparar rangos
  prepareRandomRanges(cfg, randomDefaults, randomRanges, allowComplex);

  // 2. Randomizar valores
  const randomized = randomizeValues(randomRanges);

  // 3. Aplicar Lg
  if (cfg.Lg?.enabled && inputs.inputLg) {
    const value = clampToRange(randomized.Lg, cfg.Lg.range, randomDefaults.Lg.range);
    setValue(inputs.inputLg, value);
    callbacks.onLgChange?.({ value, input: inputs.inputLg });
  }

  // 4. Aplicar V
  if (cfg.V?.enabled && inputs.inputV) {
    const value = clampToRange(randomized.V, cfg.V.range, randomDefaults.V.range);
    setValue(inputs.inputV, value);
    callbacks.onVChange?.({ value, input: inputs.inputV });
  }

  // 5. Aplicar n/d
  const fractionUpdates = buildFractionUpdates(cfg, randomized, randomDefaults, allowComplex);
  if (fractionEditor && Object.keys(fractionUpdates).length > 0) {
    fractionEditor.setFraction(fractionUpdates, { cause: 'randomize' });
    callbacks.onFractionChange?.(fractionUpdates);
  }

  // 6. Randomizar pulsos
  if (cfg.Pulses?.enabled) {
    randomizePulses({
      inputs,
      pulseMemoryApi,
      fractionStore,
      randomCount,
      isIntegerPulseSelectable,
      nearestPulseIndex,
      applyRandomFractionSelection,
      fractionEditor,
      callbacks
    });
  }

  // 7. Renderizar notación
  callbacks.renderNotation?.();

  return {
    randomized,
    applied: {
      lg: cfg.Lg?.enabled,
      v: cfg.V?.enabled,
      fraction: Object.keys(fractionUpdates).length > 0,
      pulses: cfg.Pulses?.enabled
    }
  };
}

/**
 * Helper: Prepara rangos de randomización
 */
function prepareRandomRanges(cfg, defaults, ranges, allowComplex) {
  if (cfg.Lg?.enabled) {
    const [lo, hi] = cfg.Lg.range ?? defaults.Lg.range;
    ranges.Lg = { min: lo, max: hi };
  }
  if (cfg.V?.enabled) {
    const [lo, hi] = cfg.V.range ?? defaults.V.range;
    ranges.V = { min: lo, max: hi };
  }
  if (cfg.n?.enabled) {
    let [min, max] = cfg.n.range ?? defaults.n.range;
    if (!allowComplex) {
      min = 1;
      max = 1;
    }
    ranges.n = { min, max };
  }
  if (cfg.d?.enabled) {
    const [min, max] = cfg.d.range ?? defaults.d.range;
    ranges.d = { min, max };
  }
}

/**
 * Helper: Construye objeto de actualizaciones de fracción
 */
function buildFractionUpdates(cfg, randomized, defaults, allowComplex) {
  const updates = {};

  if (cfg.n?.enabled) {
    const [min, max] = cfg.n.range ?? defaults.n.range;
    const bounded = allowComplex ? [min, max] : [1, 1];
    const randomValue = randomized.n ?? bounded[0];
    updates.numerator = Math.max(1, Math.min(bounded[1], randomValue));
  }

  if (cfg.d?.enabled) {
    const [min, max] = cfg.d.range ?? defaults.d.range;
    const randomValue = randomized.d ?? min;
    updates.denominator = Math.max(1, Math.min(max, randomValue));
  }

  return updates;
}

/**
 * Helper: Randomiza selección de pulsos
 */
function randomizePulses(opts) {
  const { inputs, pulseMemoryApi, fractionStore, randomCount,
          isIntegerPulseSelectable, nearestPulseIndex,
          applyRandomFractionSelection, fractionEditor, callbacks } = opts;

  // Limpiar selección
  pulseMemoryApi.clear();
  fractionStore.selectionState.clear();
  fractionStore.selectedFractionKeys.clear();

  const lg = parseInt(inputs.inputLg.value);
  if (isNaN(lg) || lg <= 0) return;

  pulseMemoryApi.ensure(lg);

  // Obtener fracción actual
  const fraction = fractionEditor?.getFraction?.() ?? {};
  const available = [];
  for (let i = 1; i < lg; i++) {
    if (isIntegerPulseSelectable(i, fraction.numerator, fraction.denominator, lg)) {
      available.push(i);
    }
  }

  // Seleccionar aleatoriamente
  const rawCount = randomCount?.value?.trim() || '';
  const selected = selectRandomPulses(available, rawCount);

  // Aplicar a memoria
  for (let i = 1; i < lg; i++) pulseMemoryApi.data[i] = false;
  selected.forEach(i => { pulseMemoryApi.data[i] = true; });

  // Randomizar fracciones
  const applied = applyRandomFractionSelection(fractionStore, {
    lg,
    randomCountValue: rawCount,
    parseIntSafe: parseInt,
    nearestPulseIndex
  });

  callbacks.onPulsesChange?.({ selected, fractionsApplied: applied });
}

/**
 * Helper: Selecciona pulsos aleatorios según densidad o cantidad
 */
function selectRandomPulses(available, rawCount) {
  const selected = new Set();

  if (rawCount === '') {
    const density = 0.5;
    available.forEach(i => { if (Math.random() < density) selected.add(i); });
  } else {
    const parsed = Number.parseInt(rawCount, 10);
    if (Number.isNaN(parsed)) {
      const density = 0.5;
      available.forEach(i => { if (Math.random() < density) selected.add(i); });
    } else if (parsed > 0) {
      const target = Math.min(parsed, available.length);
      while (selected.size < target && available.length > 0) {
        const idx = available[Math.floor(Math.random() * available.length)];
        selected.add(idx);
      }
    }
  }

  return Array.from(selected).sort((a, b) => a - b);
}

/**
 * Helper: Clamp value to range
 */
function clampToRange(value, range, defaultRange) {
  const [lo, hi] = range ?? defaultRange;
  return Math.max(lo, Math.min(hi, value ?? lo));
}

/**
 * Helper: Set value to input element
 */
function setValue(input, value) {
  if (!input) return;
  input.value = String(value);
}
