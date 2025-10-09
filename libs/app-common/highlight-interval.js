/**
 * Interval Highlight Controller
 *
 * Highlights interval blocks during playback instead of pulse markers.
 * Used by App5 "Pulsaciones" which focuses on temporal intervals.
 *
 * Key differences from pulse highlighting:
 * - Targets .interval-block elements instead of .pulse
 * - Uses interval numbers (1, 2, 3...) not step indices (0, 1, 2...)
 * - Applies .highlight class for visual flash effect
 */

/**
 * Create an interval highlight controller
 * @param {Object} config - Configuration options
 * @param {Function} config.getIntervalBlocks - Function that returns array of .interval-block elements
 * @param {Function} config.getLoopEnabled - Function that returns current loop state
 * @param {number} config.flashDuration - Duration of highlight in ms (default: 200)
 * @returns {Object} Controller with highlightInterval and clearHighlights methods
 */
export function createIntervalHighlightController(config = {}) {
  const {
    getIntervalBlocks = () => [],
    getLoopEnabled = () => false,
    flashDuration = 200
  } = config;

  let activeHighlights = new Set();
  let highlightTimeouts = new Map();

  /**
   * Highlight a specific interval block
   * @param {number} intervalNumber - The interval to highlight (1-indexed: 1, 2, 3...)
   */
  function highlightInterval(intervalNumber) {
    if (!Number.isFinite(intervalNumber) || intervalNumber < 1) {
      return; // Invalid interval number
    }

    // Find the interval block element
    const blocks = getIntervalBlocks();
    const block = Array.from(blocks).find(el => {
      const dataNum = el.dataset?.intervalNumber;
      return dataNum && parseInt(dataNum, 10) === intervalNumber;
    });

    if (!block) {
      return; // Interval block not found
    }

    // Add highlight class
    block.classList.add('highlight');
    activeHighlights.add(intervalNumber);

    // Clear any existing timeout for this interval
    if (highlightTimeouts.has(intervalNumber)) {
      clearTimeout(highlightTimeouts.get(intervalNumber));
    }

    // Auto-remove highlight after duration
    const timeoutId = setTimeout(() => {
      block.classList.remove('highlight');
      activeHighlights.delete(intervalNumber);
      highlightTimeouts.delete(intervalNumber);
    }, flashDuration);

    highlightTimeouts.set(intervalNumber, timeoutId);
  }

  /**
   * Clear all active highlights immediately
   */
  function clearHighlights() {
    // Clear all pending timeouts
    for (const timeoutId of highlightTimeouts.values()) {
      clearTimeout(timeoutId);
    }
    highlightTimeouts.clear();

    // Remove highlight class from all blocks
    const blocks = getIntervalBlocks();
    Array.from(blocks).forEach(block => {
      block.classList.remove('highlight');
    });

    activeHighlights.clear();
  }

  /**
   * Get currently highlighted interval numbers
   * @returns {Set<number>} Set of active interval numbers
   */
  function getActiveHighlights() {
    return new Set(activeHighlights);
  }

  return {
    highlightInterval,
    clearHighlights,
    getActiveHighlights
  };
}
