/**
 * simple-highlight-controller.js
 *
 * Simplified pulse highlighting controller for timeline apps
 * Handles basic pulse highlighting with loop support
 *
 * @module libs/app-common/simple-highlight-controller
 */

/**
 * Creates a simple highlight controller for pulse elements
 *
 * @param {Object} config - Configuration options
 * @param {Function} config.getPulses - Returns array of pulse DOM elements
 * @param {Function} config.getLoopEnabled - Returns loop state (boolean)
 * @param {string} [config.highlightClass='active'] - CSS class for highlighted pulses
 * @returns {Object} Highlight controller API
 *
 * @example
 * const highlightController = createSimpleHighlightController({
 *   getPulses: () => pulses,
 *   getLoopEnabled: () => loopEnabled
 * });
 *
 * highlightController.highlightPulse(5);  // Highlight pulse at index 5
 * highlightController.clearHighlights();   // Clear all highlights
 */
export function createSimpleHighlightController({
  getPulses,
  getLoopEnabled,
  highlightClass = 'active'
}) {
  // LP-01: com a màxim 2 elements porten la classe alhora (actual +
  // l'últim quan hi ha loop) — netegem només aquests en lloc d'escombrar
  // els Lg+1 nodes a cada pas del hot path.
  let lastHighlighted = [];

  function clearLast() {
    for (const el of lastHighlighted) {
      el?.classList?.remove(highlightClass);
    }
    lastHighlighted = [];
  }

  /**
   * Highlight a pulse at the given index
   * Automatically wraps around for large indices
   * When loop is enabled and index is 0, also highlights the last pulse
   *
   * @param {number} index - Index of pulse to highlight
   */
  function highlightPulse(index) {
    const pulses = getPulses();
    const loopEnabled = getLoopEnabled();

    clearLast();

    if (!pulses || pulses.length === 0) return;

    // Highlight current pulse
    const idx = index % pulses.length;
    const current = pulses[idx];

    if (current) {
      // Force reflow to restart animation even if same pulse
      void current.offsetWidth;
      current.classList.add(highlightClass);
      lastHighlighted.push(current);
    }

    // If loop enabled and at first pulse, also highlight last pulse
    if (loopEnabled && idx === 0) {
      const last = pulses[pulses.length - 1];
      if (last) {
        last.classList.add(highlightClass);
        lastHighlighted.push(last);
      }
    }
  }

  /**
   * Clear all pulse highlights
   * (escombrada completa expressament: és el camí de reset, no el hot path,
   * i ha de netejar classes que puguin venir d'un render anterior)
   */
  function clearHighlights() {
    const pulses = getPulses();
    if (pulses && pulses.length > 0) {
      pulses.forEach(p => p?.classList?.remove(highlightClass));
    }
    lastHighlighted = [];
  }

  return {
    highlightPulse,
    clearHighlights
  };
}
