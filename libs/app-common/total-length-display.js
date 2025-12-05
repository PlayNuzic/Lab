/**
 * total-length-display.js
 *
 * Total length display with flip animation and playback counter.
 * Shows total (pulses × cycles) when stopped, global step when playing.
 *
 * @module libs/app-common/total-length-display
 */

/**
 * Creates a total length display controller
 *
 * @param {Object} config - Configuration options
 * @param {HTMLElement} config.digitElement - Element to display the digit/number
 * @param {Function} config.getTotal - Returns total length (e.g., pulses × cycles)
 * @param {Function} config.getPulsosPerCycle - Returns pulses per cycle
 * @param {string} [config.playingZeroClass='playing-zero'] - CSS class for first step
 * @param {string} [config.playingActiveClass='playing-active'] - CSS class for other steps
 * @param {string} [config.emptyValue='--'] - Value to show when total is invalid
 * @returns {Object} Total length display controller API
 *
 * @example
 * const totalDisplay = createTotalLengthDisplay({
 *   digitElement: document.getElementById('totalLengthDigit'),
 *   getTotal: () => pulsosCompas * cycles,
 *   getPulsosPerCycle: () => pulsosCompas
 * });
 *
 * // Show total when values change
 * totalDisplay.showTotal();
 *
 * // During playback (in onPulse callback)
 * totalDisplay.updateGlobalStep(localStep, cycleNumber);
 *
 * // When playback stops
 * totalDisplay.reset();
 */
export function createTotalLengthDisplay({
  digitElement,
  getTotal,
  getPulsosPerCycle,
  playingZeroClass = 'playing-zero',
  playingActiveClass = 'playing-active',
  emptyValue = '--'
}) {
  // Return no-op controller if element missing
  if (!digitElement) {
    return {
      update: () => {},
      updateWithAnimation: () => {},
      updateGlobalStep: () => {},
      showTotal: () => {},
      reset: () => {},
      setPlaying: () => {},
      getGlobalStep: () => 0,
      isPlaying: () => false
    };
  }

  let globalStep = 0;
  let playing = false;

  /**
   * Update display value without animation
   * @param {number|string} value - Value to display
   */
  function update(value) {
    digitElement.textContent = String(value);
  }

  /**
   * Update display with flip animation
   * @param {number|string} newValue - New value to display
   */
  function updateWithAnimation(newValue) {
    const currentValue = digitElement.textContent;
    if (currentValue === String(newValue)) return;

    digitElement.classList.add('flip-out');

    setTimeout(() => {
      digitElement.textContent = String(newValue);
      digitElement.classList.remove('flip-out');
      digitElement.classList.add('flip-in');

      setTimeout(() => {
        digitElement.classList.remove('flip-in');
      }, 150);
    }, 150);
  }

  /**
   * Update global step during playback
   * @param {number} localStep - Step within current cycle (0-indexed)
   * @param {number} cycleNumber - Current cycle (1-indexed)
   */
  function updateGlobalStep(localStep, cycleNumber) {
    const pulsosPerCycle = getPulsosPerCycle();
    if (!pulsosPerCycle) return;

    playing = true;
    globalStep = (cycleNumber - 1) * pulsosPerCycle + localStep + 1;
    updateWithAnimation(globalStep);

    // Apply color classes
    digitElement.classList.remove(playingZeroClass, playingActiveClass);
    if (globalStep === 1) {
      digitElement.classList.add(playingZeroClass);
    } else {
      digitElement.classList.add(playingActiveClass);
    }
  }

  /**
   * Show total length (when stopped)
   */
  function showTotal() {
    if (playing) return; // Don't update during playback

    const total = getTotal();
    if (total === null || total === undefined || isNaN(total) || total === 0) {
      update(emptyValue);
    } else {
      updateWithAnimation(total);
    }
  }

  /**
   * Reset display after playback stops
   */
  function reset() {
    playing = false;
    globalStep = 0;
    digitElement.classList.remove(playingZeroClass, playingActiveClass);
    showTotal();
  }

  /**
   * Set playing state
   * @param {boolean} isPlaying - Whether playback is active
   */
  function setPlaying(isPlaying) {
    playing = isPlaying;
    if (!playing) {
      reset();
    }
  }

  /**
   * Clear playing colors without resetting
   */
  function clearPlayingColors() {
    digitElement.classList.remove(playingZeroClass, playingActiveClass);
  }

  return {
    update,
    updateWithAnimation,
    updateGlobalStep,
    showTotal,
    reset,
    setPlaying,
    clearPlayingColors,
    getGlobalStep: () => globalStep,
    isPlaying: () => playing
  };
}
