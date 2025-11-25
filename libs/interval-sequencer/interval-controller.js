/**
 * Interval Controller Module
 *
 * Main orchestrator for the interval sequencer system.
 * Coordinates drag handler, renderer, converter, and gap filler.
 *
 * @module libs/interval-sequencer/interval-controller
 */

import { createIntervalDragHandler } from './interval-drag-handler.js';
import { createIntervalRenderer } from './interval-renderer.js';
import { pairsToIntervals, buildPairsFromIntervals } from './interval-converter.js';
import { fillGapsWithSilences, detectGaps, hasGaps } from './gap-filler.js';

/**
 * @typedef {Object} IntervalSequencerConfig
 * @property {Object} musicalGrid - Musical grid instance (from createMusicalGrid)
 * @property {Object} [gridEditor] - Optional grid editor instance (from createGridEditor)
 * @property {number} totalSpaces - Total spaces/cells (e.g., 8 for 9 pulses)
 * @property {Object} [basePair={note: 0, pulse: 0}] - Base pair for interval calculations
 * @property {boolean} [autoFillGaps=true] - Auto-fill gaps with silences
 * @property {boolean} [polyphonyEnabled=false] - Allow overlapping notes
 * @property {Function} [onIntervalsChange] - Callback when intervals change (intervals, pairs)
 * @property {Function} [onPairsChange] - Callback when pairs change (pairs)
 * @property {Function} [onNotePreview] - Callback to play note preview (noteIndex, iT)
 * @property {Function} [onDragStart] - Callback when drag starts
 * @property {Function} [onDragEnd] - Callback when drag ends
 */

/**
 * Create an interval sequencer controller
 *
 * Orchestrates all interval-related functionality:
 * - Drag handler for iT modification
 * - Renderer for iT bars visualization
 * - Converter for pairs ↔ intervals
 * - Gap filler for automatic silences
 *
 * @param {IntervalSequencerConfig} config - Configuration options
 * @returns {Object} Interval sequencer API
 *
 * @example
 * const sequencer = createIntervalSequencer({
 *   musicalGrid,
 *   gridEditor,
 *   totalSpaces: 8,
 *   basePair: { note: 0, pulse: 0 },
 *   autoFillGaps: true,
 *   onIntervalsChange: (intervals, pairs) => {
 *     console.log('Intervals:', intervals);
 *     updateGridEditor(pairs);
 *   },
 *   onNotePreview: (noteIndex, iT) => playNote(noteIndex, iT)
 * });
 *
 * // Set initial pairs
 * sequencer.setPairs(initialPairs);
 *
 * // Get current intervals
 * const intervals = sequencer.getIntervals();
 *
 * // Enable/disable drag mode
 * sequencer.setDragEnabled(true);
 *
 * // Cleanup
 * sequencer.destroy();
 */
export function createIntervalSequencer(config) {
  const {
    musicalGrid,
    gridEditor,
    totalSpaces,
    basePair = { note: 0, pulse: 0 },
    autoFillGaps = true,
    polyphonyEnabled = false,
    onIntervalsChange,
    onPairsChange,
    onNotePreview,
    onDragStart,
    onDragEnd
  } = config;

  // Internal state
  let currentPairs = [];
  let currentIntervals = [];
  let isPolyphonyEnabled = polyphonyEnabled;

  // Create sub-components
  const renderer = createIntervalRenderer({
    getTimelineContainer: () => musicalGrid?.getTimelineContainer?.(),
    getMatrixContainer: () => musicalGrid?.getMatrixContainer?.(),
    totalSpaces
  });

  const dragHandler = createIntervalDragHandler({
    musicalGrid,
    gridEditor,
    totalSpaces,
    getPairs: () => currentPairs,
    setPairs: (pairs) => handlePairsUpdate(pairs),
    getPolyphonyEnabled: () => isPolyphonyEnabled,
    autoFillGaps,
    fillGaps: autoFillGaps ? (pairs) => fillGapsWithSilences(pairs, basePair) : null,
    onDragStart: (info) => {
      if (onDragStart) onDragStart(info);
    },
    onDragEnd: (pairs, info) => {
      if (onDragEnd) onDragEnd(pairs, info);
    },
    onNotePreview
  });

  /**
   * Handle pairs update from drag or external source
   */
  function handlePairsUpdate(pairs) {
    currentPairs = pairs;

    // Convert to intervals
    currentIntervals = pairsToIntervals(pairs, basePair);

    // Render iT bars
    renderer.render(currentIntervals);

    // Callbacks
    if (onPairsChange) onPairsChange(pairs);
    if (onIntervalsChange) onIntervalsChange(currentIntervals, pairs);
  }

  /**
   * Set pairs and update visualization
   *
   * @param {Array<{note: number, pulse: number, temporalInterval?: number, isRest?: boolean}>} pairs - Note-pulse pairs
   */
  function setPairs(pairs) {
    let processedPairs = pairs || [];

    // Auto-fill gaps if enabled
    if (autoFillGaps) {
      processedPairs = fillGapsWithSilences(processedPairs, basePair);
    }

    handlePairsUpdate(processedPairs);
  }

  /**
   * Set intervals and convert to pairs
   *
   * @param {Array<{soundInterval: number, temporalInterval: number, isRest?: boolean}>} intervals - Interval array
   */
  function setIntervals(intervals) {
    const pairs = buildPairsFromIntervals(basePair, intervals);
    handlePairsUpdate(pairs);
  }

  /**
   * Get current pairs
   *
   * @returns {Array} Current pairs
   */
  function getPairs() {
    return [...currentPairs];
  }

  /**
   * Get current intervals
   *
   * @returns {Array} Current intervals
   */
  function getIntervals() {
    return [...currentIntervals];
  }

  /**
   * Add a single pair at position
   *
   * @param {Object} pair - Pair to add {note, pulse, temporalInterval}
   * @returns {Array} Updated pairs
   */
  function addPair(pair) {
    let newPairs;

    if (!isPolyphonyEnabled) {
      // Remove overlapping pairs
      const pairEnd = pair.pulse + (pair.temporalInterval || 1) - 1;
      newPairs = currentPairs.filter(p => {
        const pEnd = p.pulse + (p.temporalInterval || 1) - 1;
        return !(p.pulse <= pairEnd && pEnd >= pair.pulse);
      });
      newPairs.push(pair);
    } else {
      newPairs = [...currentPairs, pair];
    }

    setPairs(newPairs);
    return currentPairs;
  }

  /**
   * Remove pair at index
   *
   * @param {number} index - Pair index to remove
   * @returns {Array} Updated pairs
   */
  function removePair(index) {
    const newPairs = currentPairs.filter((_, i) => i !== index);
    setPairs(newPairs);
    return currentPairs;
  }

  /**
   * Remove pair at position
   *
   * @param {number} noteIndex - Note row
   * @param {number} pulse - Pulse position
   * @returns {Array} Updated pairs
   */
  function removePairAt(noteIndex, pulse) {
    const newPairs = currentPairs.filter(p =>
      !(p.note === noteIndex && p.pulse === pulse)
    );
    setPairs(newPairs);
    return currentPairs;
  }

  /**
   * Clear all pairs
   */
  function clear() {
    setPairs([]);
  }

  /**
   * Enable/disable drag mode
   *
   * @param {boolean} enabled - Whether drag is enabled
   */
  function setDragEnabled(enabled) {
    dragHandler.setEnabled(enabled);
  }

  /**
   * Check if drag is currently active
   *
   * @returns {boolean} Whether drag is active
   */
  function isDragging() {
    return dragHandler.isActive();
  }

  /**
   * Set polyphony mode
   *
   * @param {boolean} enabled - Whether polyphony is enabled
   */
  function setPolyphony(enabled) {
    isPolyphonyEnabled = enabled;
  }

  /**
   * Check if sequence has gaps
   *
   * @returns {boolean} Whether there are gaps in the sequence
   */
  function checkGaps() {
    return hasGaps(currentPairs, basePair);
  }

  /**
   * Get gap information
   *
   * @returns {Array<{startPulse: number, size: number}>} Gap positions and sizes
   */
  function getGaps() {
    return detectGaps(currentPairs, basePair);
  }

  /**
   * Fill gaps in current sequence
   *
   * @returns {Array} Updated pairs with gaps filled
   */
  function fillCurrentGaps() {
    const filled = fillGapsWithSilences(currentPairs, basePair);
    handlePairsUpdate(filled);
    return currentPairs;
  }

  /**
   * Highlight interval bar by index
   *
   * @param {number} index - Bar index (1-based)
   * @param {number} [duration=300] - Highlight duration in ms
   */
  function highlightInterval(index, duration = 300) {
    renderer.highlightBar(index, duration);
  }

  /**
   * Re-render after resize or layout change
   */
  function refresh() {
    renderer.render(currentIntervals);
  }

  /**
   * Start a drag operation programmatically
   *
   * @param {number} noteIndex - Note row
   * @param {number} spaceIndex - Space/cell index
   * @param {Event} [event] - Optional event object
   */
  function startDrag(noteIndex, spaceIndex, event) {
    dragHandler.startDrag(noteIndex, spaceIndex, event);
  }

  /**
   * Cancel current drag operation
   */
  function cancelDrag() {
    dragHandler.cancel();
  }

  /**
   * Destroy the sequencer and cleanup
   */
  function destroy() {
    dragHandler.destroy();
    renderer.destroy();
    currentPairs = [];
    currentIntervals = [];
  }

  // Public API
  return {
    // Pair management
    setPairs,
    getPairs,
    addPair,
    removePair,
    removePairAt,
    clear,

    // Interval management
    setIntervals,
    getIntervals,

    // Drag control
    setDragEnabled,
    isDragging,
    startDrag,
    cancelDrag,

    // Polyphony
    setPolyphony,
    isPolyphonyEnabled: () => isPolyphonyEnabled,

    // Gap management
    checkGaps,
    getGaps,
    fillCurrentGaps,

    // Visualization
    highlightInterval,
    refresh,

    // Lifecycle
    destroy,

    // Access to sub-components (advanced usage)
    getRenderer: () => renderer,
    getDragHandler: () => dragHandler
  };
}
