// Fraction selection and randomization logic unique to App4.
// Encapsulates mutable state for fractional hits along with helpers used by main.js.

export const FRACTION_POSITION_EPSILON = 1e-6;
export const TEXT_NODE_TYPE = (typeof Node !== 'undefined' && Node.TEXT_NODE) || 3;

export const fractionDefaults = {
  numerator: null,
  denominator: null
};

export const randomDefaults = {
  Lg: { enabled: true, range: [2, 30] },
  V: { enabled: true, range: [40, 320] },
  T: { enabled: true, range: [0.1, 20] },
  Pulses: { enabled: true, count: '' },
  n: { enabled: true, range: [1, 9] },
  d: { enabled: true, range: [1, 9] },
  allowComplex: true
};

export function createFractionSelectionStore() {
  return {
    selectionState: new Map(),
    selectedFractionKeys: new Set(),
    hitMap: new Map(),
    markerMap: new Map(),
    labelLookup: new Map(),
    pulseSelections: [],
    pulseSeqEntryOrder: [],
    pulseSeqEntryLookup: new Map(),
    pulseSeqTokenMap: new Map(),
    spacingAdjustHandle: null,
    lastFractionGap: null,
    lastFractionHighlightKey: null,
    lastHighlightType: null,
    lastHighlightIntIndex: null,
    lastHighlightFractionKey: null
  };
}

export function makeFractionKey(base, numerator, denominator) {
  if (!Number.isFinite(base) || !Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return null;
  }
  return `${base}+${numerator}/${denominator}`;
}

export function registerFractionLabel(store, label, info) {
  if (!store || !store.labelLookup) return;
  if (!label || !info || !info.key) return;
  const normalized = String(label).trim();
  if (!normalized) return;
  const bucket = store.labelLookup.get(normalized);
  if (!bucket) {
    store.labelLookup.set(normalized, [info]);
    return;
  }
  if (!bucket.some(entry => entry && entry.key === info.key)) {
    bucket.push(info);
  }
}

export function getFractionInfoByLabel(store, label, opts = {}) {
  if (!store || !store.labelLookup || !label) return null;
  const normalized = String(label).trim();
  if (!normalized) return null;
  const bucket = store.labelLookup.get(normalized);
  if (!bucket || bucket.length === 0) return null;
  if (opts && Number.isFinite(opts.base)) {
    const match = bucket.find(entry => Number.isFinite(entry.base) && entry.base === opts.base);
    if (match) return match;
  }
  return bucket[0] ?? null;
}

export function fractionValue(base, numerator, denominator) {
  if (!Number.isFinite(base) || !Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return NaN;
  }
  return base + numerator / denominator;
}

export function cycleNotationToFraction(cycleIndex, subdivisionIndex, pulsesPerCycle, denominator) {
  if (!(Number.isFinite(cycleIndex) && cycleIndex >= 0)) return null;
  if (!(Number.isFinite(subdivisionIndex) && subdivisionIndex >= 0)) return null;
  if (!(Number.isFinite(pulsesPerCycle) && pulsesPerCycle > 0)) return null;
  if (!(Number.isFinite(denominator) && denominator > 0)) return null;

  const step = pulsesPerCycle / denominator;
  const rawValue = cycleIndex * pulsesPerCycle + subdivisionIndex * step;
  let base = Math.floor(rawValue + FRACTION_POSITION_EPSILON);
  let fractional = rawValue - base;
  if (fractional < FRACTION_POSITION_EPSILON) {
    return null;
  }
  let numerator = Math.round(fractional * denominator);
  if (numerator <= 0) {
    return null;
  }
  while (numerator >= denominator) {
    numerator -= denominator;
    base += 1;
  }
  const value = base + numerator / denominator;
  return { base, numerator, value };
}

export function fractionDisplay(base, numerator, denominator, { cycleIndex, subdivisionIndex, pulsesPerCycle } = {}) {
  const safeBaseValue = Number.isFinite(base) ? Number(base) : 0;
  const safeNumeratorValue = Number.isFinite(numerator) ? Number(numerator) : 0;
  const den = Number.isFinite(denominator) && denominator > 0 ? Math.floor(denominator) : null;
  const resolvedPulsesPerCycle = Number.isFinite(pulsesPerCycle) && pulsesPerCycle > 0
    ? Math.floor(pulsesPerCycle)
    : (() => {
      if (Number.isFinite(den) && den > 0) return den;
      if (Number.isFinite(cycleIndex) && Number.isFinite(subdivisionIndex)) return null;
      return den;
    })();

  if (!Number.isFinite(den) || den <= 0) {
    return `${safeBaseValue}.${safeNumeratorValue}`;
  }

  const value = safeBaseValue + (safeNumeratorValue / den);
  if (!Number.isFinite(value)) {
    return `${safeBaseValue}.${safeNumeratorValue}`;
  }

  let resolvedCycle = Number.isFinite(cycleIndex) ? Math.floor(cycleIndex) : null;
  let resolvedSubdivision = Number.isFinite(subdivisionIndex) ? Math.floor(subdivisionIndex) : null;

  if (resolvedPulsesPerCycle && resolvedPulsesPerCycle > 0) {
    if (!Number.isFinite(resolvedCycle)) {
      resolvedCycle = Math.floor(safeBaseValue / resolvedPulsesPerCycle);
    }
    if (!Number.isFinite(resolvedSubdivision) || resolvedSubdivision < 0) {
      resolvedSubdivision = Math.floor((safeNumeratorValue / den) * resolvedPulsesPerCycle);
    }
  }

  const resolvedValue = value - Math.floor(value);
  if (resolvedValue < FRACTION_POSITION_EPSILON) {
    const baseIndex = Math.floor(value + FRACTION_POSITION_EPSILON);
    return String(baseIndex);
  }

  if (!Number.isFinite(resolvedSubdivision) || resolvedSubdivision < 0) {
    resolvedSubdivision = Math.round(resolvedValue * den);
  }

  if (Number.isFinite(resolvedCycle) && resolvedCycle >= 0 && Number.isFinite(resolvedPulsesPerCycle) && resolvedPulsesPerCycle > 0) {
    const baseIndex = resolvedCycle * resolvedPulsesPerCycle;
    const subdivisionStep = Math.max(1, Math.floor(resolvedPulsesPerCycle / den));
    const subdivisionValue = resolvedSubdivision * subdivisionStep;
    if (subdivisionValue > 0) {
      return `${baseIndex}.${subdivisionValue}`;
    }
    return String(baseIndex);
  }

  return `${safeBaseValue}.${safeNumeratorValue}`;
}

export function extractFractionInfoFromElement(el, parseIntFn) {
  if (!el || typeof parseIntFn !== 'function') return null;
  const base = parseIntFn(el.dataset.baseIndex);
  const numerator = parseIntFn(el.dataset.fractionNumerator);
  const denominator = parseIntFn(el.dataset.fractionDenominator);
  if (!Number.isFinite(base) || !Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return null;
  }
  const key = el.dataset.fractionKey || makeFractionKey(base, numerator, denominator);
  if (!key) return null;
  const value = Number.isFinite(parseFloat(el.dataset.value))
    ? parseFloat(el.dataset.value)
    : fractionValue(base, numerator, denominator);
  const rawCycleIndex = parseIntFn(el.dataset.cycleIndex);
  const rawSubdivisionIndex = parseIntFn(el.dataset.subdivision);
  const rawPulsesPerCycle = parseIntFn(el.dataset.pulsesPerCycle);
  const override = {
    cycleIndex: Number.isFinite(rawCycleIndex) ? rawCycleIndex : undefined,
    subdivisionIndex: Number.isFinite(rawSubdivisionIndex) ? rawSubdivisionIndex : undefined,
    pulsesPerCycle: Number.isFinite(rawPulsesPerCycle) && rawPulsesPerCycle > 0
      ? rawPulsesPerCycle
      : undefined
  };
  const display = el.dataset.display || fractionDisplay(base, numerator, denominator, override);
  const rawLabel = typeof el.dataset.rawLabel === 'string' ? el.dataset.rawLabel : null;
  return {
    type: 'fraction',
    base,
    numerator,
    denominator,
    key,
    value,
    display,
    rawLabel,
    cycleIndex: Number.isFinite(rawCycleIndex) ? rawCycleIndex : null,
    subdivisionIndex: Number.isFinite(rawSubdivisionIndex) ? rawSubdivisionIndex : null,
    pulsesPerCycle: Number.isFinite(rawPulsesPerCycle) && rawPulsesPerCycle > 0 ? rawPulsesPerCycle : null
  };
}

export function applyFractionSelectionClasses(store, cycleMarkers = []) {
  if (!store || !store.selectedFractionKeys) return;
  cycleMarkers.forEach(marker => {
    const key = marker?.dataset?.fractionKey;
    if (!key) {
      marker?.classList.remove('selected');
      return;
    }
    marker?.classList.toggle('selected', store.selectedFractionKeys.has(key));
  });
}

export function rebuildFractionSelections(store, { updatePulseSeqField, cycleMarkers = [], skipUpdateField = false } = {}) {
  if (!store) return [];
  store.selectedFractionKeys.clear();
  store.pulseSelections = Array.from(store.selectionState.values())
    .filter(item => item && Number.isFinite(item.value))
    .map(item => {
      const cycleIndex = Number.isFinite(item?.cycleIndex) ? item.cycleIndex : null;
      const subdivisionIndex = Number.isFinite(item?.subdivisionIndex) ? item.subdivisionIndex : null;
      const pulsesPerCycle = Number.isFinite(item?.pulsesPerCycle) && item.pulsesPerCycle > 0
        ? item.pulsesPerCycle
        : null;
      const rawLabel = typeof item?.rawLabel === 'string' ? item.rawLabel.trim() : '';
      return {
        ...item,
        rawLabel,
        display: fractionDisplay(item.base, item.numerator, item.denominator, {
          cycleIndex,
          subdivisionIndex,
          pulsesPerCycle
        })
      };
    })
    .sort((a, b) => a.value - b.value);
  store.pulseSelections.forEach(item => store.selectedFractionKeys.add(item.key));
  applyFractionSelectionClasses(store, cycleMarkers);
  if (!skipUpdateField && typeof updatePulseSeqField === 'function') {
    updatePulseSeqField();
  }
  return store.pulseSelections;
}

export function setFractionSelected(store, info, shouldSelect, { updatePulseSeqField, cycleMarkers = [] } = {}) {
  if (!store || !info || !info.key) return;
  const { key, base, numerator, denominator } = info;
  const value = Number.isFinite(info.value) ? info.value : fractionValue(base, numerator, denominator);
  if (!Number.isFinite(value)) return;
  if (shouldSelect) {
    const cycleIndex = Number.isFinite(info.cycleIndex) && info.cycleIndex >= 0
      ? Math.floor(info.cycleIndex)
      : null;
    const subdivisionIndex = Number.isFinite(info.subdivisionIndex) && info.subdivisionIndex >= 0
      ? Math.floor(info.subdivisionIndex)
      : null;
    const pulsesPerCycle = Number.isFinite(info.pulsesPerCycle) && info.pulsesPerCycle > 0
      ? info.pulsesPerCycle
      : null;
    const rawLabel = typeof info.rawLabel === 'string' ? info.rawLabel.trim() : '';
    const display = info.display || fractionDisplay(base, numerator, denominator, {
      cycleIndex,
      subdivisionIndex,
      pulsesPerCycle
    });
    store.selectionState.set(key, {
      base,
      numerator,
      denominator,
      value,
      display,
      key,
      cycleIndex,
      subdivisionIndex,
      pulsesPerCycle,
      rawLabel
    });
  } else {
    store.selectionState.delete(key);
  }
  rebuildFractionSelections(store, { updatePulseSeqField, cycleMarkers });
}

export function loadRandomConfig(readValue) {
  if (typeof readValue !== 'function') return {};
  try {
    const raw = readValue();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveRandomConfig(writeValue, cfg) {
  if (typeof writeValue !== 'function') return;
  try {
    writeValue(JSON.stringify(cfg));
  } catch {}
}

export function applyRandomConfig(cfg, controls = {}) {
  if (!cfg) return;
  const {
    randLgToggle,
    randLgMin,
    randLgMax,
    randVToggle,
    randVMin,
    randVMax,
    randTToggle,
    randTMin,
    randTMax,
    randNToggle,
    randNMin,
    randNMax,
    randDToggle,
    randDMin,
    randDMax,
    randComplexToggle,
    randPulsesToggle,
    randomCount
  } = controls;
  if (cfg.Lg) {
    if (randLgToggle) randLgToggle.checked = cfg.Lg.enabled;
    if (randLgMin) randLgMin.value = cfg.Lg.range[0];
    if (randLgMax) randLgMax.value = cfg.Lg.range[1];
  }
  if (cfg.V) {
    if (randVToggle) randVToggle.checked = cfg.V.enabled;
    if (randVMin) randVMin.value = cfg.V.range[0];
    if (randVMax) randVMax.value = cfg.V.range[1];
  }
  if (cfg.T) {
    if (randTToggle) randTToggle.checked = cfg.T.enabled;
    if (randTMin) randTMin.value = cfg.T.range[0];
    if (randTMax) randTMax.value = cfg.T.range[1];
  }
  if (cfg.n) {
    if (randNToggle) randNToggle.checked = cfg.n.enabled;
    if (randNMin) randNMin.value = cfg.n.range[0];
    if (randNMax) randNMax.value = cfg.n.range[1];
  }
  if (cfg.d) {
    if (randDToggle) randDToggle.checked = cfg.d.enabled;
    if (randDMin) randDMin.value = cfg.d.range[0];
    if (randDMax) randDMax.value = cfg.d.range[1];
  }
  if (typeof cfg.allowComplex === 'boolean' && randComplexToggle) {
    randComplexToggle.checked = cfg.allowComplex;
  }
  if (cfg.Pulses && randPulsesToggle && randomCount) {
    randPulsesToggle.checked = cfg.Pulses.enabled;
    randomCount.value = cfg.Pulses.count ?? '';
  }
}

export function toIntRange(minInput, maxInput, fallback) {
  const fallbackRange = Array.isArray(fallback) ? fallback : [1, 1];
  const [lo, hi] = toRange(minInput, maxInput, fallbackRange);
  const normalizedLo = Number.isFinite(lo) ? Math.max(1, Math.round(lo)) : fallbackRange[0];
  const normalizedHiRaw = Number.isFinite(hi) ? Math.round(hi) : fallbackRange[1];
  const normalizedHi = Math.max(normalizedLo, Math.max(1, normalizedHiRaw));
  return [normalizedLo, normalizedHi];
}

function toRange(minInput, maxInput, fallbackRange) {
  const min = Number.parseFloat(minInput);
  const max = Number.parseFloat(maxInput);
  if (!Number.isFinite(min) && !Number.isFinite(max)) {
    return fallbackRange;
  }
  if (!Number.isFinite(min)) return [fallbackRange[0], Math.max(fallbackRange[0], max)];
  if (!Number.isFinite(max)) return [Math.max(fallbackRange[0], min), fallbackRange[1]];
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return [lo, hi];
}

export function updateRandomConfig(randomConfig, controls = {}, defaults = randomDefaults) {
  if (!randomConfig) return randomConfig;
  const {
    randLgToggle,
    randLgMin,
    randLgMax,
    randVToggle,
    randVMin,
    randVMax,
    randTToggle,
    randTMin,
    randTMax,
    randNToggle,
    randNMin,
    randNMax,
    randDToggle,
    randDMin,
    randDMax,
    randComplexToggle,
    randPulsesToggle,
    randomCount
  } = controls;

  randomConfig.Lg = {
    enabled: !!randLgToggle?.checked,
    range: toRange(randLgMin?.value, randLgMax?.value, defaults.Lg.range)
  };
  randomConfig.V = {
    enabled: !!randVToggle?.checked,
    range: toRange(randVMin?.value, randVMax?.value, defaults.V.range)
  };
  const previousTRange = randomConfig.T?.range ?? defaults.T.range;
  const previousTEnabled = randomConfig.T?.enabled ?? defaults.T.enabled;
  randomConfig.T = {
    enabled: randTToggle ? randTToggle.checked : previousTEnabled,
    range: (randTMin && randTMax)
      ? toRange(randTMin.value, randTMax.value, previousTRange)
      : previousTRange
  };
  const previousNRange = randomConfig.n?.range ?? defaults.n.range;
  randomConfig.n = {
    enabled: randNToggle ? randNToggle.checked : (randomConfig.n?.enabled ?? defaults.n.enabled),
    range: (randNMin && randNMax)
      ? toIntRange(randNMin.value, randNMax.value, previousNRange)
      : previousNRange
  };
  const previousDRange = randomConfig.d?.range ?? defaults.d.range;
  randomConfig.d = {
    enabled: randDToggle ? randDToggle.checked : (randomConfig.d?.enabled ?? defaults.d.enabled),
    range: (randDMin && randDMax)
      ? toIntRange(randDMin.value, randDMax.value, previousDRange)
      : previousDRange
  };
  if (randComplexToggle) {
    randomConfig.allowComplex = randComplexToggle.checked;
  } else if (typeof randomConfig.allowComplex !== 'boolean') {
    randomConfig.allowComplex = defaults.allowComplex;
  }
  if (randPulsesToggle && randomCount) {
    randomConfig.Pulses = {
      enabled: randPulsesToggle.checked,
      count: randomCount.value
    };
  }
  return randomConfig;
}

export function applyRandomFractionSelection(store, {
  lg,
  randomCountValue,
  parseIntSafe,
  nearestPulseIndex
}) {
  if (!store || !(store.hitMap instanceof Map) || !Number.isFinite(lg) || lg <= 0) {
    store?.selectionState?.clear();
    return false;
  }
  const fractionOptions = [];
  store.hitMap.forEach((el, key) => {
    if (!el || !key) return;
    const base = parseIntSafe(el.dataset.baseIndex);
    const numerator = parseIntSafe(el.dataset.fractionNumerator);
    const denominator = parseIntSafe(el.dataset.fractionDenominator);
    const value = Number.parseFloat(el.dataset.value);
    if (!Number.isFinite(base) || !Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return;
    if (!Number.isFinite(value) || value <= 0 || value >= lg) return;
    if (typeof nearestPulseIndex === 'function' && nearestPulseIndex(value) != null) return;
    const cycleIndex = parseIntSafe(el.dataset.cycleIndex);
    const subdivisionIndex = parseIntSafe(el.dataset.subdivision);
    const pulsesPerCycle = parseIntSafe(el.dataset.pulsesPerCycle);
    const rawLabel = typeof el.dataset.rawLabel === 'string' ? el.dataset.rawLabel : '';
    const display = el.dataset.display || null;
    fractionOptions.push({
      key,
      base,
      numerator,
      denominator,
      value,
      display,
      cycleIndex: Number.isFinite(cycleIndex) ? cycleIndex : null,
      subdivisionIndex: Number.isFinite(subdivisionIndex) ? subdivisionIndex : null,
      pulsesPerCycle: Number.isFinite(pulsesPerCycle) && pulsesPerCycle > 0 ? pulsesPerCycle : null,
      rawLabel
    });
  });

  const fractionSelection = [];
  if (fractionOptions.length) {
    if (randomCountValue === '') {
      const density = 0.5;
      fractionOptions.forEach(info => { if (Math.random() < density) fractionSelection.push(info); });
    } else {
      const parsed = Number.parseInt(randomCountValue, 10);
      if (Number.isNaN(parsed)) {
        const density = 0.5;
        fractionOptions.forEach(info => { if (Math.random() < density) fractionSelection.push(info); });
      } else if (parsed > 0) {
        const pool = [...fractionOptions];
        const targetFractions = Math.min(parsed, pool.length);
        while (fractionSelection.length < targetFractions && pool.length) {
          const idx = Math.floor(Math.random() * pool.length);
          fractionSelection.push(pool.splice(idx, 1)[0]);
        }
      }
    }
  }

  store.selectionState.clear();
  fractionSelection.forEach(info => {
    const value = Number.isFinite(info.value) ? info.value : fractionValue(info.base, info.numerator, info.denominator);
    if (!Number.isFinite(value) || value <= 0 || value >= lg) return;
    const cycleIndex = Number.isFinite(info.cycleIndex) && info.cycleIndex >= 0 ? Math.floor(info.cycleIndex) : null;
    const subdivisionIndex = Number.isFinite(info.subdivisionIndex) && info.subdivisionIndex >= 0
      ? Math.floor(info.subdivisionIndex)
      : null;
    const pulsesPerCycle = Number.isFinite(info.pulsesPerCycle) && info.pulsesPerCycle > 0 ? info.pulsesPerCycle : null;
    const rawLabel = typeof info.rawLabel === 'string' ? info.rawLabel.trim() : '';
    const display = info.display || fractionDisplay(info.base, info.numerator, info.denominator, {
      cycleIndex,
      subdivisionIndex,
      pulsesPerCycle
    });
    store.selectionState.set(info.key, {
      base: info.base,
      numerator: info.numerator,
      denominator: info.denominator,
      value,
      display,
      key: info.key,
      cycleIndex,
      subdivisionIndex,
      pulsesPerCycle,
      rawLabel
    });
  });
  return fractionSelection.length > 0;
}
