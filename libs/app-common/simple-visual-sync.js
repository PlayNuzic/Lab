/**
 * simple-visual-sync.js
 *
 * Simplified visual synchronization manager using requestAnimationFrame
 * For apps that only need basic pulse highlighting without complex resolution/cycle logic
 *
 * @module libs/app-common/simple-visual-sync
 */

/**
 * Creates a simple visual sync manager
 *
 * @param {Object} config - Configuration options
 * @param {Function} config.getAudio - Returns audio instance
 * @param {Function} config.getIsPlaying - Returns playback state (boolean)
 * @param {Function} config.onStep - Callback when step changes (receives step index)
 * @returns {Object} Visual sync API with start/stop methods
 *
 * @example
 * const visualSync = createSimpleVisualSync({
 *   getAudio: () => audio,
 *   getIsPlaying: () => isPlaying,
 *   onStep: (step) => highlightPulse(step)
 * });
 *
 * visualSync.start();  // Start sync loop
 * visualSync.stop();   // Stop sync loop
 */
export function createSimpleVisualSync({ getAudio, getIsPlaying, onStep }) {
  let rafHandle = null;
  let lastVisualStep = null;

  /**
   * Synchronize visual state with audio
   * Calls onStep callback when step changes
   */
  function syncVisualState() {
    const isPlaying = getIsPlaying();
    const audio = getAudio();

    if (!isPlaying || !audio || typeof audio.getVisualState !== 'function') {
      return;
    }

    const state = audio.getVisualState();
    if (!state || !Number.isFinite(state.step)) {
      return;
    }

    // Avoid duplicate calls for same step
    if (lastVisualStep === state.step) {
      return;
    }

    lastVisualStep = state.step;
    onStep(state.step);
  }

  /**
   * Start the visual synchronization loop
   * Uses requestAnimationFrame for smooth 60fps updates
   */
  function start() {
    stop();

    const step = () => {
      rafHandle = null;
      if (!getIsPlaying()) return;

      syncVisualState();
      rafHandle = requestAnimationFrame(step);
    };

    rafHandle = requestAnimationFrame(step);
  }

  /**
   * Stop the visual synchronization loop
   * Cleans up requestAnimationFrame handle
   */
  function stop() {
    if (rafHandle != null) {
      cancelAnimationFrame(rafHandle);
      rafHandle = null;
    }
    lastVisualStep = null;
  }

  return {
    start,
    stop,
    syncVisualState
  };
}
