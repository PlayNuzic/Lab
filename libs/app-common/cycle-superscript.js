/**
 * cycle-superscript.js
 *
 * Adds cycle superscripts to timeline pulse numbers.
 * Supports both circular (all same) and linear (position-based) modes.
 *
 * @module libs/app-common/cycle-superscript
 */

/**
 * Creates a cycle superscript controller for timeline numbers
 *
 * @param {Object} config - Configuration options
 * @param {HTMLElement} config.timeline - Timeline container element
 * @param {Function} [config.getPulsosPerCycle] - Returns pulses per cycle (for linear mode)
 * @param {string} [config.mode='circular'] - 'circular' (all same) or 'linear' (position-based)
 * @param {string} [config.numberSelector='.pulse-number'] - CSS selector for number elements
 * @returns {Object} Superscript controller API
 *
 * @example
 * // Circular mode (App17) - all numbers share same superscript
 * const superscripts = createCycleSuperscript({
 *   timeline: document.getElementById('timeline'),
 *   mode: 'circular'
 * });
 * superscripts.updateAll(2); // All show ²
 *
 * @example
 * // Linear mode (App16) - each number has position-based superscript
 * const superscripts = createCycleSuperscript({
 *   timeline: document.getElementById('timeline'),
 *   getPulsosPerCycle: () => compas,
 *   mode: 'linear'
 * });
 * superscripts.updateAll(); // 0¹, 1¹, 2¹, 0², 1², 2², etc.
 */
export function createCycleSuperscript({
  timeline,
  getPulsosPerCycle = () => 1,
  mode = 'circular',
  numberSelector = '.pulse-number'
}) {
  // Return no-op controller if timeline missing
  if (!timeline) {
    return {
      updateAll: () => {},
      updateAfterRender: () => {},
      reset: () => {},
      getMode: () => mode
    };
  }

  /**
   * Update all pulse number superscripts
   * In circular mode: all numbers show the same cycle number
   * In linear mode: each number shows its cycle based on position
   *
   * @param {number} [cycleNumber=1] - Current cycle (1-indexed), used in circular mode
   */
  function updateAll(cycleNumber = 1) {
    const pulseNumbers = timeline.querySelectorAll(numberSelector);

    if (mode === 'circular') {
      // Circular: all numbers show same superscript
      pulseNumbers.forEach((el) => {
        const index = parseInt(el.dataset.index, 10);
        if (!isNaN(index)) {
          el.innerHTML = `${index}<sup>${cycleNumber}</sup>`;
        }
      });
    } else {
      // Linear: each number shows cycle based on its absolute position
      const pulsosPerCycle = getPulsosPerCycle();
      if (!pulsosPerCycle || pulsosPerCycle < 1) return;

      pulseNumbers.forEach((el) => {
        const index = parseInt(el.dataset.index, 10);
        if (!isNaN(index)) {
          const cycle = Math.floor(index / pulsosPerCycle) + 1;
          const posInCycle = index % pulsosPerCycle;
          el.innerHTML = `${posInCycle}<sup>${cycle}</sup>`;
        }
      });
    }
  }

  /**
   * Update superscripts after rendering new numbers
   * Uses requestAnimationFrame to ensure DOM is ready
   *
   * @param {number} [cycleNumber=1] - Cycle number to show (circular mode)
   * @param {Function} [callback] - Optional callback after update
   */
  function updateAfterRender(cycleNumber = 1, callback) {
    requestAnimationFrame(() => {
      updateAll(cycleNumber);
      if (typeof callback === 'function') {
        callback();
      }
    });
  }

  /**
   * Reset superscripts to cycle 1
   */
  function reset() {
    updateAll(1);
  }

  /**
   * Create a pulse number element with superscript already applied
   * Useful for linear mode where superscript is static
   *
   * @param {number} index - Absolute pulse index
   * @param {Object} [options] - Creation options
   * @param {string} [options.className='pulse-number'] - CSS class name
   * @param {boolean} [options.markCycleStart=true] - Add 'cycle-start' class to position 0
   * @returns {HTMLElement} The created label element
   */
  function createNumberElement(index, options = {}) {
    const { className = 'pulse-number', markCycleStart = true } = options;
    const pulsosPerCycle = getPulsosPerCycle();

    const label = document.createElement('div');
    label.className = className;
    label.dataset.index = String(index);

    if (mode === 'circular') {
      // Circular: show index with cycle 1 (will be updated dynamically)
      label.innerHTML = `${index}<sup>1</sup>`;
    } else {
      // Linear: calculate cycle from position
      const cycle = Math.floor(index / pulsosPerCycle) + 1;
      const posInCycle = index % pulsosPerCycle;
      label.innerHTML = `${posInCycle}<sup>${cycle}</sup>`;

      // Mark cycle start (position 0 within each cycle)
      if (markCycleStart && posInCycle === 0) {
        label.classList.add('cycle-start');
      }
    }

    return label;
  }

  return {
    updateAll,
    updateAfterRender,
    reset,
    createNumberElement,
    getMode: () => mode
  };
}
