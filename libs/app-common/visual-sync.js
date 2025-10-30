/**
 * visual-sync.js
 *
 * Unified visual synchronization manager with requestAnimationFrame
 * Supports both full-featured and simple modes via feature detection
 *
 * - Full mode: Resolution tracking, notation cursor, highlight controller
 * - Simple mode: Basic step callback only
 *
 * @module libs/app-common/visual-sync
 */

/**
 * Creates a visual sync manager
 * @param {object} config
 * @param {Function} config.getAudio - Returns audio instance
 * @param {Function} config.getIsPlaying - Returns playback state
 * @param {Function} [config.getLoopEnabled] - Returns loop state (full mode)
 * @param {object} [config.highlightController] - Highlight controller (full mode)
 * @param {Function} [config.getNotationRenderer] - Returns notation renderer (full mode)
 * @param {Function} [config.getPulses] - Returns pulses array (full mode)
 * @param {Function} [config.onResolutionChange] - Callback when resolution changes (full mode)
 * @param {Function} [config.onStepChange] - Callback when step changes (simple mode)
 * @returns {object} - API: { start, stop, syncVisualState }
 */
export function createVisualSyncManager({
  getAudio,
  getIsPlaying,
  getLoopEnabled = null,
  highlightController = null,
  getNotationRenderer = null,
  getPulses = null,
  onResolutionChange = null,
  onStepChange = null
}) {
  let rafHandle = null;
  let lastVisualStep = null;
  let currentAudioResolution = 1;

  // Detect mode based on provided config
  const isSimpleMode = Boolean(onStepChange && !highlightController);

  function resolveAudioResolution(state, audio) {
    if (state && Number.isFinite(state.resolution) && state.resolution > 0) {
      return Math.max(1, Math.round(state.resolution));
    }
    if (audio && typeof audio.getBaseResolution === 'function') {
      const baseResolution = audio.getBaseResolution();
      if (Number.isFinite(baseResolution) && baseResolution > 0) {
        return Math.max(1, Math.round(baseResolution));
      }
    }
    return null;
  }

  /**
   * Synchronize visual state with audio
   * Handles both simple and full modes
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

    // Simple mode: just call the step callback
    if (isSimpleMode) {
      onStepChange(state.step);
      return;
    }

    // Full mode: resolution tracking + highlighting + notation
    const resolvedResolution = resolveAudioResolution(state, audio);
    if (resolvedResolution != null && resolvedResolution !== currentAudioResolution) {
      currentAudioResolution = resolvedResolution;
      if (onResolutionChange) {
        onResolutionChange(resolvedResolution);
      }
    }

    const highlightPayload = resolvedResolution != null
      ? { ...state, resolution: resolvedResolution }
      : state;

    // Update notation cursor if available
    const notationRenderer = typeof getNotationRenderer === 'function'
      ? getNotationRenderer()
      : null;
    if (notationRenderer && typeof notationRenderer.updateCursor === 'function') {
      const resolution = currentAudioResolution > 0 ? currentAudioResolution : 1;
      const currentPulse = Number.isFinite(state.step)
        ? state.step / resolution
        : 0;
      notationRenderer.updateCursor(currentPulse, isPlaying);
    }

    // Pulse highlighting (highlightPulse handles both integer and fraction cases)
    if (highlightController) {
      highlightController.highlightPulse(highlightPayload, {
        loopEnabled: getLoopEnabled ? getLoopEnabled() : false,
        isPlaying: true
      });

      // Cycle highlighting
      if (state.cycle && Number.isFinite(state.cycle.cycleIndex) && Number.isFinite(state.cycle.subdivisionIndex)) {
        highlightController.highlightCycle(state.cycle);
      }
    }
  }

  /**
   * Start the synchronization loop
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
   * Stop the synchronization loop
   * Cleans up requestAnimationFrame handle
   */
  function stop() {
    if (rafHandle != null) {
      cancelAnimationFrame(rafHandle);
      rafHandle = null;
    }
    lastVisualStep = null;
  }

  // Public API
  return {
    start,
    stop,
    syncVisualState
  };
}

/**
 * Convenience factory for simple mode (backward compatibility)
 * Creates a simple visual sync manager with just a step callback
 *
 * @param {Object} config
 * @param {Function} config.getAudio - Returns audio instance
 * @param {Function} config.getIsPlaying - Returns playback state
 * @param {Function} config.onStep - Callback when step changes (receives step index)
 * @returns {Object} Visual sync API with start/stop methods
 *
 * @example
 * const visualSync = createSimpleVisualSync({
 *   getAudio: () => audio,
 *   getIsPlaying: () => isPlaying,
 *   onStep: (step) => highlightPulse(step)
 * });
 */
export function createSimpleVisualSync({ getAudio, getIsPlaying, onStep }) {
  return createVisualSyncManager({
    getAudio,
    getIsPlaying,
    onStepChange: onStep
  });
}
