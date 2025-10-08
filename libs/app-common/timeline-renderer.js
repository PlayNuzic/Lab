/**
 * timeline-renderer.js
 *
 * Renderizador modular de timeline con soporte de fracciones, pulsos y ciclos.
 * Extrae la lógica completa de renderTimeline() de App4 en un módulo reutilizable.
 */

import { gridFromOrigin } from './subdivision.js';
import { nearestPulseIndex } from './pulse-seq-parser.js';
import { makeFractionKey, FRACTION_POSITION_EPSILON, isIntegerPulseSelectable, isPulseRemainder } from './pulse-selectability.js';

/**
 * Crea renderizador de timeline con soporte de fracciones
 *
 * @param {object} config
 * @param {HTMLElement} config.timeline - Elemento DOM contenedor
 * @param {Function} config.getLg - Función que devuelve Lg actual
 * @param {Function} config.getFraction - Función que devuelve {numerator, denominator}
 * @param {object} config.fractionStore - Store con selectionState, hitMap, markerMap, labelLookup
 * @param {Map} config.fractionMemory - Map con memoria de fracciones suspendidas
 * @param {Function} config.computeHitSizePx - Función de cálculo de tamaño de hit
 * @param {Function} config.computeNumberFontRem - Función de cálculo de fuente de números
 * @param {Function} config.computeSubdivisionFontRem - Función de cálculo de fuente de subdivisiones
 * @param {Function} config.attachSelectionListeners - Función para adjuntar eventos de selección
 * @param {Function} config.isIntegerPulseSelectable - Función que determina si un pulso es seleccionable
 * @param {Function} config.fractionValue - Función que calcula valor de fracción
 * @param {Function} config.fractionDisplay - Función que formatea display de fracción
 * @param {Function} config.registerFractionLabel - Función que registra label de fracción
 * @param {Function} config.markFractionSuspended - Función que marca fracción como suspendida
 * @param {Function} config.rememberFractionSelectionInMemory - Función que recuerda fracción en memoria
 * @param {HTMLElement} [config.tIndicator] - Indicador T a preservar
 * @param {object} config.constants - Constantes
 * @param {number} config.constants.SUBDIVISION_HIDE_THRESHOLD - Umbral para ocultar labels de subdivisión
 * @param {number} config.constants.PULSE_NUMBER_HIDE_THRESHOLD - Umbral para ocultar números de pulso
 * @returns {object} - API del renderizador
 */
export function createFractionalTimelineRenderer(config) {
  const {
    timeline,
    getLg,
    getFraction,
    fractionStore,
    fractionMemory,
    computeHitSizePx,
    computeNumberFontRem,
    computeSubdivisionFontRem,
    attachSelectionListeners,
    isIntegerPulseSelectable,
    fractionValue,
    fractionDisplay,
    registerFractionLabel,
    markFractionSuspended,
    rememberFractionSelectionInMemory,
    constants = {}
  } = config;

  const {
    SUBDIVISION_HIDE_THRESHOLD = 41,
    PULSE_NUMBER_HIDE_THRESHOLD = 71
  } = constants;

  // Arrays de elementos renderizados
  let pulses = [];
  let pulseHits = [];
  let cycleMarkers = [];
  let cycleMarkerHits = [];
  let cycleLabels = [];
  let pulseNumberLabels = [];
  let lastStructureSignature = { lg: null, numerator: null, denominator: null };

  /**
   * Renderiza pulsos enteros (0 a lg)
   */
  function renderIntegerPulses({ lg, numerator, denominator }) {
    for (let i = 0; i <= lg; i++) {
      const pulse = document.createElement('div');
      pulse.className = 'pulse';
      if (i === 0) pulse.classList.add('zero');
      else if (i === lg) pulse.classList.add('lg');
      pulse.dataset.index = String(i);

      // Aplicar clase si el pulso no es seleccionable según la fracción activa
      const selectable = isIntegerPulseSelectable(i, numerator, denominator, lg);
      if (i !== 0 && i !== lg && !selectable) {
        pulse.classList.add('non-selectable');
      }

      // Marcar pulsos sobrantes visualmente (remainder)
      if (isPulseRemainder(i, numerator, lg)) {
        pulse.classList.add('remainder');
      }

      timeline.appendChild(pulse);
      pulses.push(pulse);

      // Crear hit área para el pulso
      const hit = createPulseHit({ index: i, lg, selectable });
      timeline.appendChild(hit);
      pulseHits.push(hit);
    }
  }

  /**
   * Crea hit área para pulso entero
   */
  function createPulseHit({ index, lg, selectable }) {
    const hit = document.createElement('div');
    hit.className = 'pulse-hit';
    hit.dataset.index = String(index);
    hit.dataset.selectionKey = `pulse:${index}`;
    hit.style.position = 'absolute';
    hit.style.borderRadius = '50%';
    hit.style.background = 'transparent';
    hit.style.zIndex = '6';

    const hitSize = computeHitSizePx(lg);
    hit.style.width = `${hitSize}px`;
    hit.style.height = `${hitSize}px`;

    if (index === 0 || index === lg) {
      hit.style.pointerEvents = 'none';
      hit.style.cursor = 'default';
    } else if (!selectable) {
      // Pulsos no seleccionables: deshabilitar interacciones
      hit.style.pointerEvents = 'none';
      hit.style.cursor = 'not-allowed';
      hit.classList.add('non-selectable');
    } else {
      hit.style.pointerEvents = 'auto';
      hit.style.cursor = 'pointer';
      attachSelectionListeners(hit);
    }

    return hit;
  }

  /**
   * Renderiza subdivisiones fraccionarias
   */
  function renderFractionalSubdivisions({ lg, numerator, denominator, grid }) {
    const validFractionKeys = new Set();

    if (grid.cycles <= 0 || !grid.subdivisions.length) {
      return validFractionKeys;
    }

    const hideFractionLabels = lg >= SUBDIVISION_HIDE_THRESHOLD;
    const numeratorPerCycle = numerator ?? 0;
    const denominatorValue = denominator ?? 0;
    const subdivisionFontRem = computeSubdivisionFontRem(lg);

    // Label formatter
    const labelFormatter = ({ cycleIndex, subdivisionIndex, position }) => {
      const normalizedPositionBase = Number.isFinite(position)
        ? Math.floor(position + FRACTION_POSITION_EPSILON)
        : null;
      const normalizedCycle = Number.isFinite(cycleIndex) ? Math.floor(cycleIndex) : null;
      const hasCycleBase = normalizedCycle != null && Number.isFinite(numeratorPerCycle);
      const cycleBase = hasCycleBase ? normalizedCycle * numeratorPerCycle : null;

      if (subdivisionIndex === 0) {
        if (Number.isFinite(cycleBase)) return String(cycleBase);
        return Number.isFinite(normalizedPositionBase) ? String(normalizedPositionBase) : null;
      }

      if (Number.isFinite(cycleBase)) {
        return `${cycleBase}.${subdivisionIndex}`;
      }

      if (Number.isFinite(normalizedPositionBase)) {
        return `${normalizedPositionBase}.${subdivisionIndex}`;
      }

      return `${cycleIndex}.${subdivisionIndex}`;
    };

    grid.subdivisions.forEach(({ cycleIndex, subdivisionIndex, position }) => {
      let fractionKey = null;
      const formattedLabel = labelFormatter({ cycleIndex, subdivisionIndex, position });
      let normalizedDisplay = null;

      // Crear marcador de ciclo
      const marker = createCycleMarker({
        cycleIndex,
        subdivisionIndex,
        position,
        lg,
        numeratorPerCycle,
        denominatorValue,
        formattedLabel,
        hideFractionLabels,
        subdivisionFontRem
      });

      timeline.appendChild(marker.element);
      cycleMarkers.push(marker.element);

      if (marker.fractionKey) {
        validFractionKeys.add(marker.fractionKey);
        fractionStore.markerMap.set(marker.fractionKey, marker.element);

        // Crear hit área para fracción
        const hit = createFractionHit(marker, lg);
        timeline.appendChild(hit);
        cycleMarkerHits.push(hit);
        fractionStore.hitMap.set(marker.fractionKey, hit);

        // Registrar labels
        registerAllLabels(marker);
      }

      // Crear label si no está oculto
      if (!hideFractionLabels) {
        const formatted = formattedLabel != null
          ? formattedLabel
          : (marker.normalizedDisplay != null ? marker.normalizedDisplay : labelFormatter({ cycleIndex, subdivisionIndex, position }));

        if (formatted != null) {
          const label = createFractionLabel({
            formatted,
            cycleIndex,
            subdivisionIndex,
            position,
            fractionKey: marker.fractionKey,
            lg,
            subdivisionFontRem
          });
          timeline.appendChild(label);
          cycleLabels.push(label);
        }
      }
    });

    return validFractionKeys;
  }

  /**
   * Crea marcador de ciclo/fracción
   */
  function createCycleMarker({
    cycleIndex,
    subdivisionIndex,
    position,
    lg,
    numeratorPerCycle,
    denominatorValue,
    formattedLabel,
    hideFractionLabels,
    subdivisionFontRem
  }) {
    const marker = document.createElement('div');
    marker.className = 'cycle-marker';
    if (subdivisionIndex === 0) marker.classList.add('start');
    marker.dataset.cycleIndex = String(cycleIndex);
    marker.dataset.subdivision = String(subdivisionIndex);
    marker.dataset.position = String(position);

    if (Number.isFinite(numeratorPerCycle) && numeratorPerCycle > 0) {
      marker.dataset.pulsesPerCycle = String(numeratorPerCycle);
    }

    if (Number.isFinite(lg) && lg > 0) {
      const percent = (position / lg) * 100;
      marker.style.left = `${percent}%`;
      marker.style.top = '50%';
      marker.style.transform = 'translate(-50%, -50%)';
    }

    // Asignar index
    if (subdivisionIndex === 0) {
      const baseIndex = cycleIndex * numeratorPerCycle;
      if (Number.isFinite(baseIndex)) marker.dataset.index = String(baseIndex);
    } else {
      const snapPulse = nearestPulseIndex(position);
      if (snapPulse != null) {
        marker.dataset.index = String(snapPulse);
      }
    }

    let fractionKey = null;
    let normalizedDisplay = null;

    // Calcular datos de fracción si es subdivisión
    if (subdivisionIndex > 0 && denominatorValue > 0) {
      let baseIndex = Math.floor(position);
      let fracNumerator = Math.round((position - baseIndex) * denominatorValue);

      if (fracNumerator >= denominatorValue) {
        const carry = Math.floor(fracNumerator / denominatorValue);
        baseIndex += carry;
        fracNumerator -= carry * denominatorValue;
      }

      if (fracNumerator > 0) {
        const key = makeFractionKey(baseIndex, fracNumerator, denominatorValue);
        if (key) {
          fractionKey = key;
          const value = fractionValue(baseIndex, fracNumerator, denominatorValue);
          const formattedDisplay = typeof formattedLabel === 'string'
            ? formattedLabel.trim()
            : (formattedLabel != null ? String(formattedLabel).trim() : '');
          const fallbackDisplay = fractionDisplay(baseIndex, fracNumerator, denominatorValue, {
            cycleIndex,
            subdivisionIndex,
            pulsesPerCycle: numeratorPerCycle
          });
          normalizedDisplay = formattedDisplay || (typeof fallbackDisplay === 'string'
            ? fallbackDisplay
            : String(fallbackDisplay ?? ''));

          marker.dataset.baseIndex = String(baseIndex);
          marker.dataset.fractionNumerator = String(fracNumerator);
          marker.dataset.fractionDenominator = String(denominatorValue);
          marker.dataset.fractionKey = key;
          marker.dataset.selectionKey = `fraction:${key}`;
          marker.dataset.value = String(value);
          marker.dataset.display = normalizedDisplay;
          marker.style.cursor = 'pointer';
          attachSelectionListeners(marker);

          // Raw label from stored selection
          const storedSelection = fractionStore.selectionState.get(key);
          const storedRawLabel = typeof storedSelection?.rawLabel === 'string'
            ? storedSelection.rawLabel.trim()
            : '';
          const effectiveRawLabel = storedRawLabel || normalizedDisplay;
          if (effectiveRawLabel) {
            marker.dataset.rawLabel = effectiveRawLabel;
          }
        }
      }
    }

    return {
      element: marker,
      fractionKey,
      normalizedDisplay,
      cycleIndex,
      subdivisionIndex,
      numeratorPerCycle,
      baseIndex: marker.dataset.baseIndex ? parseInt(marker.dataset.baseIndex) : null,
      fracNumerator: marker.dataset.fractionNumerator ? parseInt(marker.dataset.fractionNumerator) : null,
      denominatorValue: marker.dataset.fractionDenominator ? parseInt(marker.dataset.fractionDenominator) : null,
      value: marker.dataset.value ? parseFloat(marker.dataset.value) : null,
      rawLabel: marker.dataset.rawLabel
    };
  }

  /**
   * Crea hit área para fracción
   */
  function createFractionHit(markerInfo, lg) {
    const { element: marker, fractionKey, normalizedDisplay, value, numeratorPerCycle } = markerInfo;
    const position = parseFloat(marker.dataset.position);

    const hit = document.createElement('div');
    hit.className = 'fraction-hit';
    hit.dataset.baseIndex = marker.dataset.baseIndex;
    hit.dataset.cycleIndex = marker.dataset.cycleIndex;
    hit.dataset.subdivision = marker.dataset.subdivision;
    hit.dataset.fractionNumerator = marker.dataset.fractionNumerator;
    hit.dataset.fractionDenominator = marker.dataset.fractionDenominator;
    hit.dataset.fractionKey = fractionKey;
    hit.dataset.selectionKey = `fraction:${fractionKey}`;
    hit.dataset.value = String(value);
    hit.dataset.display = normalizedDisplay;

    if (Number.isFinite(numeratorPerCycle) && numeratorPerCycle > 0) {
      hit.dataset.pulsesPerCycle = String(numeratorPerCycle);
    }

    hit.style.position = 'absolute';
    hit.style.borderRadius = '50%';
    hit.style.background = 'transparent';
    hit.style.zIndex = '6';

    const fracHitSize = computeHitSizePx(lg) * 0.75;
    hit.style.width = `${fracHitSize}px`;
    hit.style.height = `${fracHitSize}px`;

    if (Number.isFinite(lg) && lg > 0) {
      const percent = (position / lg) * 100;
      hit.style.left = `${percent}%`;
      hit.style.top = '50%';
      hit.style.transform = 'translate(-50%, -50%)';
    }

    hit.style.pointerEvents = 'auto';
    hit.style.cursor = 'pointer';
    attachSelectionListeners(hit);

    if (marker.dataset.rawLabel) {
      hit.dataset.rawLabel = marker.dataset.rawLabel;
    }

    return hit;
  }

  /**
   * Crea label de fracción
   */
  function createFractionLabel({
    formatted,
    cycleIndex,
    subdivisionIndex,
    position,
    fractionKey,
    lg,
    subdivisionFontRem
  }) {
    const label = document.createElement('div');
    label.className = 'cycle-label';
    if (subdivisionIndex === 0) label.classList.add('cycle-label--integer');
    if (cycleIndex === 0 && subdivisionIndex === 0) label.classList.add('cycle-label--origin');
    label.dataset.cycleIndex = String(cycleIndex);
    label.dataset.subdivision = String(subdivisionIndex);
    label.dataset.position = String(position);

    if (fractionKey) {
      label.dataset.fractionKey = fractionKey;
    }

    label.textContent = formatted;
    label.dataset.fullText = String(formatted);

    // Detectar parte decimal para compactar
    const decimalIndex = typeof formatted === 'string' ? formatted.indexOf('.') : -1;
    if (decimalIndex > -1 && decimalIndex < formatted.length - 1) {
      const fractionalPart = formatted.slice(decimalIndex + 1);
      if (fractionalPart.length > 0) {
        label.dataset.isDecimal = '1';
        label.dataset.compactText = `.${fractionalPart}`;
      }
    }

    label.style.fontSize = `${subdivisionFontRem}rem`;

    if (Number.isFinite(lg) && lg > 0) {
      const percent = (position / lg) * 100;
      label.style.left = `${percent}%`;
      label.style.top = 'calc(100% + 12px)';
      label.style.transform = 'translate(-50%, 0)';
    }

    return label;
  }

  /**
   * Registra todos los labels de una fracción
   */
  function registerAllLabels(markerInfo) {
    const {
      fractionKey,
      normalizedDisplay,
      cycleIndex,
      subdivisionIndex,
      numeratorPerCycle,
      baseIndex,
      fracNumerator,
      denominatorValue,
      value,
      rawLabel
    } = markerInfo;

    if (!fractionKey) return;

    const labelInfo = {
      key: fractionKey,
      base: baseIndex,
      numerator: fracNumerator,
      denominator: denominatorValue,
      value,
      display: normalizedDisplay,
      cycleIndex,
      subdivisionIndex,
      pulsesPerCycle: numeratorPerCycle,
      rawLabel
    };

    registerFractionLabel(normalizedDisplay, labelInfo);

    if (rawLabel) {
      registerFractionLabel(rawLabel, labelInfo);
    }

    const cycleLabel = Number.isFinite(cycleIndex) && cycleIndex >= 0
      ? `${Math.floor(cycleIndex)}.${subdivisionIndex}`
      : null;
    if (cycleLabel) {
      registerFractionLabel(cycleLabel, labelInfo);
    }

    const absoluteLabel = Number.isFinite(labelInfo.base) && Number.isFinite(labelInfo.numerator)
      ? `${labelInfo.base}.${labelInfo.numerator}`
      : null;
    if (absoluteLabel) {
      registerFractionLabel(absoluteLabel, labelInfo);
    }

    if (Number.isFinite(cycleIndex) && Number.isFinite(subdivisionIndex) && subdivisionIndex >= 0) {
      registerFractionLabel(`${cycleIndex}.${subdivisionIndex}`, labelInfo);
    }
  }

  /**
   * Gestiona memoria de fracciones (suspender/restaurar)
   */
  function manageFractionMemory(validFractionKeys) {
    // Suspender fracciones inválidas
    const invalidFractionEntries = [];
    fractionStore.selectionState.forEach((entry, key) => {
      if (!validFractionKeys.has(key)) {
        invalidFractionEntries.push({ key, entry });
      }
    });

    if (invalidFractionEntries.length > 0) {
      invalidFractionEntries.forEach(({ key, entry }) => {
        fractionStore.selectionState.delete(key);
        markFractionSuspended({ ...entry, key });
      });
    }

    // Restaurar fracciones válidas desde memoria
    let restoredFraction = false;
    validFractionKeys.forEach((key) => {
      if (fractionStore.selectionState.has(key)) return;

      const memoryEntry = fractionMemory.get(key);
      if (!memoryEntry || memoryEntry.suspended !== true) return;

      const restoredEntry = {
        base: memoryEntry.base,
        numerator: memoryEntry.numerator,
        denominator: memoryEntry.denominator,
        value: memoryEntry.value,
        display: memoryEntry.display,
        key,
        cycleIndex: memoryEntry.cycleIndex,
        subdivisionIndex: memoryEntry.subdivisionIndex,
        pulsesPerCycle: memoryEntry.pulsesPerCycle,
        rawLabel: memoryEntry.rawLabel
      };

      fractionStore.selectionState.set(key, restoredEntry);
      rememberFractionSelectionInMemory({ ...restoredEntry, key }, { suspended: false });
      restoredFraction = true;
    });

    return {
      invalidCount: invalidFractionEntries.length,
      restoredFraction
    };
  }

  /**
   * Renderiza timeline completo
   */
  function render() {
    // Reset state
    pulses = [];
    pulseHits = [];
    cycleMarkers = [];
    cycleMarkerHits = [];
    cycleLabels = [];
    pulseNumberLabels = [];

    fractionStore.hitMap.clear();
    fractionStore.markerMap.clear();
    fractionStore.labelLookup.clear();

    timeline.innerHTML = '';

    const lg = getLg();
    if (!Number.isFinite(lg) || lg <= 0) {
      return {
        pulses,
        pulseHits,
        cycleMarkers,
        cycleMarkerHits,
        cycleLabels,
        pulseNumberLabels,
        structureChanged: false
      };
    }

    // Obtener fracción actual
    const { numerator, denominator } = getFraction();

    // 1. Renderizar pulsos enteros
    renderIntegerPulses({ lg, numerator, denominator });

    // 2. Renderizar subdivisiones fraccionarias
    const grid = gridFromOrigin({ lg, numerator, denominator });
    const validFractionKeys = renderFractionalSubdivisions({ lg, numerator, denominator, grid });

    // 3. Actualizar signature de estructura
    const normalizedLg = Number.isFinite(lg) && lg > 0 ? lg : null;
    const normalizedNumerator = Number.isFinite(grid?.numerator) && grid.numerator > 0
      ? grid.numerator
      : (Number.isFinite(numerator) && numerator > 0 ? numerator : null);
    const normalizedDenominator = Number.isFinite(grid?.denominator) && grid.denominator > 0
      ? grid.denominator
      : (Number.isFinite(denominator) && denominator > 0 ? denominator : null);

    const structureChanged =
      lastStructureSignature.lg !== normalizedLg ||
      lastStructureSignature.numerator !== normalizedNumerator ||
      lastStructureSignature.denominator !== normalizedDenominator;

    lastStructureSignature = {
      lg: normalizedLg,
      numerator: normalizedNumerator,
      denominator: normalizedDenominator
    };

    // 4. Gestionar memoria de fracciones
    const { invalidCount, restoredFraction } = manageFractionMemory(validFractionKeys);

    return {
      pulses,
      pulseHits,
      cycleMarkers,
      cycleMarkerHits,
      cycleLabels,
      pulseNumberLabels,
      structureChanged,
      memoryChanges: {
        invalidCount,
        restoredFraction
      }
    };
  }

  // API pública
  return {
    render,
    getPulses: () => pulses,
    getPulseHits: () => pulseHits,
    getCycleMarkers: () => cycleMarkers,
    getCycleMarkerHits: () => cycleMarkerHits,
    getCycleLabels: () => cycleLabels,
    getPulseNumberLabels: () => pulseNumberLabels,
    getLastStructureSignature: () => ({ ...lastStructureSignature })
  };
}
