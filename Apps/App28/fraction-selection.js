// Fraction selection logic for App28 (Simples)
// Simplified version without random config (App28 has fixed parameters)

import { makeFractionKey, FRACTION_POSITION_EPSILON } from '../../libs/app-common/pulse-selectability.js';

// Re-export for use in main.js
export { makeFractionKey, FRACTION_POSITION_EPSILON };
export const TEXT_NODE_TYPE = (typeof Node !== 'undefined' && Node.TEXT_NODE) || 3;

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

export function createFractionSelectionFromValue(value, options = {}) {
  const safeValue = Number(value);
  if (!Number.isFinite(safeValue)) return null;
  const epsilon = Number.isFinite(options.epsilon) ? Number(options.epsilon) : FRACTION_POSITION_EPSILON;
  const denominator = Number.isFinite(options.denominator) && options.denominator > 0
    ? Math.round(options.denominator)
    : null;
  if (!denominator) return null;

  const pulsesPerCycle = Number.isFinite(options.pulsesPerCycle) && options.pulsesPerCycle > 0
    ? Number(options.pulsesPerCycle)
    : null;

  let base = Math.floor(safeValue + epsilon);
  let fractional = safeValue - base;
  if (fractional < epsilon) {
    return null;
  }

  let numerator = Math.round(fractional * denominator);
  while (numerator >= denominator && denominator > 0) {
    numerator -= denominator;
    base += 1;
  }

  if (numerator <= 0 || numerator >= denominator) {
    return null;
  }

  const canonicalValue = base + numerator / denominator;

  let cycleIndex = null;
  let subdivisionIndex = null;
  if (Number.isFinite(pulsesPerCycle) && pulsesPerCycle > 0) {
    const step = pulsesPerCycle / denominator;
    if (step > 0) {
      cycleIndex = Math.floor((canonicalValue + epsilon) / pulsesPerCycle);
      const cycleStart = cycleIndex * pulsesPerCycle;
      const cycleOffset = canonicalValue - cycleStart;
      subdivisionIndex = Math.round(cycleOffset / step);
      if (subdivisionIndex >= denominator) {
        subdivisionIndex = denominator - 1;
      }
      if (subdivisionIndex < 0) {
        subdivisionIndex = 0;
      }
    }
  }

  const key = makeFractionKey(base, numerator, denominator);
  if (!key) return null;

  const display = fractionDisplay(base, numerator, denominator, {
    cycleIndex,
    subdivisionIndex,
    pulsesPerCycle
  });

  return {
    type: 'fraction',
    base,
    numerator,
    denominator,
    value: canonicalValue,
    key,
    cycleIndex,
    subdivisionIndex,
    pulsesPerCycle,
    display
  };
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

  // For App28, use simple base.subdivision format
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

export function applyFractionSelectionClasses(store, cycleMarkers = [], labels = []) {
  if (!store || !store.selectedFractionKeys) return;
  const { selectedFractionKeys, hitMap, pulseSeqTokenMap } = store;
  const isSelected = (key) => key != null && selectedFractionKeys.has(key);

  cycleMarkers.forEach(marker => {
    if (!marker) return;
    const key = marker.dataset?.fractionKey;
    marker.classList.toggle('selected', isSelected(key));
  });

  if (hitMap && typeof hitMap.forEach === 'function') {
    hitMap.forEach((hit, key) => {
      if (!hit) return;
      hit.classList.toggle('selected', isSelected(key));
    });
  }

  if (Array.isArray(labels)) {
    labels.forEach(label => {
      if (!label) return;
      const key = label.dataset?.fractionKey;
      label.classList.toggle('selected', isSelected(key));
    });
  }

  if (pulseSeqTokenMap && typeof pulseSeqTokenMap.forEach === 'function') {
    pulseSeqTokenMap.forEach((token, key) => {
      if (!token) return;
      token.classList.toggle('selected', isSelected(key));
    });
  }
}

export function rebuildFractionSelections(store, { updatePulseSeqField, cycleMarkers = [], cycleLabels = [], skipUpdateField = false } = {}) {
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
      const storedDisplay = typeof item?.display === 'string' ? item.display.trim() : '';
      const fallbackDisplay = fractionDisplay(item.base, item.numerator, item.denominator, {
        cycleIndex,
        subdivisionIndex,
        pulsesPerCycle
      });
      const normalizedDisplay = storedDisplay || fallbackDisplay;
      const rawLabel = typeof item?.rawLabel === 'string' ? item.rawLabel.trim() : '';
      const effectiveRawLabel = rawLabel || normalizedDisplay;
      return {
        ...item,
        rawLabel: effectiveRawLabel,
        display: normalizedDisplay
      };
    })
    .sort((a, b) => a.value - b.value);
  store.pulseSelections.forEach(item => store.selectedFractionKeys.add(item.key));
  applyFractionSelectionClasses(store, cycleMarkers, cycleLabels);
  if (!skipUpdateField && typeof updatePulseSeqField === 'function') {
    updatePulseSeqField();
  }
  return store.pulseSelections;
}

export function setFractionSelected(store, info, shouldSelect, { updatePulseSeqField, cycleMarkers = [], cycleLabels = [] } = {}) {
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
    const displayInput = typeof info.display === 'string' ? info.display.trim() : '';
    const display = displayInput || fractionDisplay(base, numerator, denominator, {
      cycleIndex,
      subdivisionIndex,
      pulsesPerCycle
    });
    const effectiveRawLabel = rawLabel || display;
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
      rawLabel: effectiveRawLabel
    });
  } else {
    store.selectionState.delete(key);
  }
  rebuildFractionSelections(store, { updatePulseSeqField, cycleMarkers, cycleLabels });
}

export function clearFractionSelections(store) {
  if (!store) return;
  store.selectionState.clear();
  store.selectedFractionKeys.clear();
  store.pulseSelections = [];
}
