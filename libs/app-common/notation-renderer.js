import { createRhythmStaff } from '../notation/rhythm-staff.js';
import { durationValueFromDenominator, buildPulseEvents } from './notation-utils.js';
import { resolveFractionNotation } from './fraction-notation.js';

/**
 * Factory function to create a notation renderer controller for App4.
 * Encapsulates all logic for building, rendering, and interacting with VexFlow notation.
 *
 * @param {Object} config - Configuration object
 * @param {HTMLElement} config.notationContentEl - Container element for notation rendering
 * @param {Object} config.notationPanelController - Panel controller with `isOpen` property
 * @param {Function} config.getFraction - Function returning { numerator, denominator }
 * @param {Function} config.getLg - Function returning current Lg value
 * @param {Object} config.fractionStore - Store with `pulseSelections` and `selectionState`
 * @param {Object} config.pulseMemoryApi - Pulse memory API with `data` array and `ensure` method
 * @param {Function} config.createFractionSelectionFromValue - Factory for creating fraction selections
 * @param {Function} config.onPulseSelected - Callback (pulseValue, shouldSelect) => void
 * @param {Function} config.onFractionSelected - Callback (info, shouldSelect) => void
 * @returns {Object} Controller with render(), getRenderer(), destroy() methods
 */
export function createNotationRenderer({
  notationContentEl,
  notationPanelController,
  getFraction,
  getLg,
  fractionStore,
  pulseMemoryApi,
  createFractionSelectionFromValue,
  onPulseSelected,
  onFractionSelected
}) {
  let notationRenderer = null;

  /**
   * Infers the notation denominator from Lg and current fraction.
   * Used as fallback for duration calculation when fraction doesn't specify denominator.
   */
  function inferNotationDenominator(lgValue, fraction) {
    if (fraction && Number.isFinite(fraction.denominator) && fraction.denominator > 0) {
      return Math.max(1, Math.round(fraction.denominator));
    }
    if (!Number.isFinite(lgValue) || lgValue <= 0) return 4;
    return Math.max(2, Math.round(lgValue));
  }

  /**
   * Builds the complete state object required for notation rendering.
   * Includes selected pulses, fraction events, duration calculations, and positions.
   *
   * @returns {Object|null} Render state or null if invalid
   */
  function buildNotationRenderState() {
    const lgValue = getLg();
    if (!Number.isFinite(lgValue) || lgValue <= 0) {
      return null;
    }

    pulseMemoryApi.ensure(lgValue);
    const pulseMemory = pulseMemoryApi.data;
    const baseSelected = new Set();
    const maxIdx = Math.min(pulseMemory.length - 1, lgValue - 1);
    for (let i = 1; i <= maxIdx; i++) {
      if (pulseMemory[i]) baseSelected.add(i);
    }

    const fractionInfo = typeof getFraction === 'function' ? getFraction() : { numerator: null, denominator: null };
    const fraction = (Number.isFinite(fractionInfo?.numerator) && Number.isFinite(fractionInfo?.denominator))
      ? { numerator: fractionInfo.numerator, denominator: fractionInfo.denominator }
      : null;
    const fractionNotation = fraction
      ? resolveFractionNotation(fraction.numerator, fraction.denominator)
      : null;
    const normalizedFraction = fraction ? { ...fraction, notation: fractionNotation } : null;

    const denominatorValue = inferNotationDenominator(lgValue, fraction);
    let baseDuration = fractionNotation?.duration
      ?? durationValueFromDenominator(denominatorValue);
    let baseDots = Number.isFinite(fractionNotation?.dots) ? Math.max(0, Math.floor(fractionNotation.dots)) : 0;
    const fractionNumeratorValue = Number.isFinite(fraction?.numerator) ? Math.floor(fraction.numerator) : null;
    const fractionDenominatorValue = Number.isFinite(fraction?.denominator) ? Math.floor(fraction.denominator) : null;
    if (fractionNumeratorValue && fractionDenominatorValue && fractionNumeratorValue === fractionDenominatorValue) {
      baseDuration = 'q';
      baseDots = 0;
    }
    const selectedValues = new Set([0]);
    baseSelected.forEach((value) => selectedValues.add(value));

    const fractionSelections = Array.isArray(fractionStore.pulseSelections) ? fractionStore.pulseSelections : [];
    const fractionalEvents = [];
    fractionSelections.forEach((item) => {
      if (!item || !item.key) return;
      const value = Number(item.value);
      if (!Number.isFinite(value) || value <= 0 || value >= lgValue) return;
      const itemDenominator = Number.isFinite(item.denominator) && item.denominator > 0
        ? Math.round(item.denominator)
        : denominatorValue;
      const notationInfo = resolveFractionNotation(item.numerator, itemDenominator);
      const eventDuration = notationInfo.duration;

      fractionalEvents.push({
        pulseIndex: value,
        duration: eventDuration,
        rest: false,
        selectionKey: item.key,
        source: 'fraction',
        dots: notationInfo.dots || 0
      });
      selectedValues.add(value);
    });

    const events = buildPulseEvents({
      lg: lgValue,
      selectedSet: baseSelected,
      duration: baseDuration,
      dots: baseDots,
      fractionalSelections: fractionalEvents,
      numerator: fractionNumeratorValue,
      denominator: fractionDenominatorValue
    });

    events.sort((a, b) => a.pulseIndex - b.pulseIndex);
    const positions = events.map((event) => event.pulseIndex);
    const selectedIndices = Array.from(selectedValues).sort((a, b) => a - b);

    return {
      lg: lgValue,
      fraction: normalizedFraction,
      events,
      positions,
      selectedIndices
    };
  }

  /**
   * Renders notation if the panel is open (or force=true).
   * Creates the VexFlow renderer on first call.
   */
  function renderIfVisible({ force = false, isPlaying = false } = {}) {
    if (!notationContentEl) return;
    if (!notationPanelController) return;
    if (!force && !notationPanelController.isOpen) return;

    if (!notationRenderer) {
      notationRenderer = createRhythmStaff({
        container: notationContentEl,
        pulseFilter: 'all'
      });
    }

    const state = buildNotationRenderState();
    if (!state) {
      notationRenderer.render({ lg: 0, rhythm: [], isPlaying });
      return;
    }

    notationRenderer.render({
      lg: state.lg,
      selectedIndices: state.selectedIndices,
      fraction: state.fraction,
      positions: state.positions,
      rhythm: state.events,
      isPlaying
    });
  }

  /**
   * Handles click events on the notation panel.
   * Toggles selection of integer pulses and fractional subdivisions.
   */
  function handleClick(event) {
    if (!notationPanelController || !notationPanelController.isOpen) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const noteEl = target.closest('[data-pulse-index]');
    if (!noteEl) return;
    if (noteEl.dataset.nonSelectable === 'true') return;
    const pulseValue = Number.parseFloat(noteEl.dataset.pulseIndex);
    if (!Number.isFinite(pulseValue)) return;
    const lgValue = getLg();
    if (!Number.isFinite(lgValue) || lgValue <= 0) return;
    if (pulseValue <= 0 || pulseValue >= lgValue) return;
    const selectionKey = noteEl.dataset.selectionKey;
    if (selectionKey) {
      const info = fractionStore.selectionState.get(selectionKey);
      if (info) {
        const currentlySelected = fractionStore.selectionState.has(selectionKey);
        onFractionSelected(info, !currentlySelected);
        renderIfVisible({ force: true });
      }
      return;
    }
    if (Number.isInteger(pulseValue)) {
      pulseMemoryApi.ensure(lgValue);
      const pulseMemory = pulseMemoryApi.data;
      const shouldSelect = !pulseMemory[pulseValue];
      onPulseSelected(pulseValue, shouldSelect);
      return;
    }

    const { numerator, denominator } = getFraction();
    const denominatorValue = Number.isFinite(denominator) && denominator > 0 ? Math.round(denominator) : null;
    if (!denominatorValue) return;
    const pulsesPerCycle = Number.isFinite(numerator) && numerator > 0 ? Number(numerator) : null;
    const nextSelection = createFractionSelectionFromValue(pulseValue, {
      denominator: denominatorValue,
      pulsesPerCycle
    });
    if (!nextSelection) return;
    if (nextSelection.value <= 0 || nextSelection.value >= lgValue) return;
    const currentlySelected = fractionStore.selectionState.has(nextSelection.key);
    onFractionSelected(nextSelection, !currentlySelected);
  }

  // Setup event listener
  if (notationContentEl) {
    notationContentEl.addEventListener('click', handleClick);
  }

  return {
    render: renderIfVisible,
    getRenderer: () => notationRenderer,
    destroy: () => {
      if (notationContentEl) {
        notationContentEl.removeEventListener('click', handleClick);
      }
    }
  };
}
