/**
 * Loop Control shared component for Lab rhythm apps
 * Provides consistent loop toggle behavior with proper audio engine synchronization
 */

/**
 * Create a loop controller that handles UI state and audio synchronization
 * @param {Object} options - Configuration options
 * @param {Object} options.audio - Audio engine instance (should have setLoop method)
 * @param {HTMLElement} options.loopBtn - Loop button element
 * @param {Function} options.getLoopState - Function that returns current loop state
 * @param {Function} options.setLoopState - Function that updates loop state
 * @param {Function} [options.onToggle] - Optional callback when loop state changes
 * @param {Function} [options.isPlaying] - Function that returns if audio is currently playing
 * @returns {Object} Loop controller with toggle method
 */
export function createLoopController({
  audio,
  loopBtn,
  getLoopState,
  setLoopState,
  onToggle,
  isPlaying
}) {
  const controller = {
    /**
     * Toggle loop state with proper audio engine synchronization
     * Fixes bug where loop toggle during playback caused audio desync
     */
    toggle() {
      const currentState = getLoopState();
      const newState = !currentState;

      // Update internal state
      setLoopState(newState);

      // Update UI
      if (loopBtn) {
        loopBtn.classList.toggle('active', newState);
      }

      // CRITICAL: Synchronize with audio engine when playing
      // This fixes the "repeated pulse 0" bug in App2 and App4
      if (audio && typeof audio.setLoop === 'function') {
        audio.setLoop(newState);
      }

      // Call optional callback
      if (typeof onToggle === 'function') {
        onToggle(newState, {
          wasPlaying: typeof isPlaying === 'function' ? isPlaying() : false
        });
      }

      return newState;
    },

    /**
     * Set loop state programmatically (for resets, etc.)
     * @param {boolean} state - Desired loop state
     * @param {Object} options - Additional options
     * @param {boolean} options.syncAudio - Whether to sync with audio engine (default: true)
     */
    setState(state, { syncAudio = true } = {}) {
      setLoopState(state);

      if (loopBtn) {
        loopBtn.classList.toggle('active', state);
      }

      if (syncAudio && audio && typeof audio.setLoop === 'function') {
        audio.setLoop(state);
      }

      if (typeof onToggle === 'function') {
        onToggle(state, { programmatic: true });
      }
    },

    /**
     * Get current loop state
     * @returns {boolean} Current loop state
     */
    getState() {
      return getLoopState();
    },

    /**
     * Attach event listener to button
     */
    attach() {
      if (loopBtn) {
        loopBtn.addEventListener('click', controller.toggle);
      }
    },

    /**
     * Remove event listener from button
     */
    detach() {
      if (loopBtn) {
        loopBtn.removeEventListener('click', controller.toggle);
      }
    }
  };

  return controller;
}

/**
 * Create loop controller for standard rhythm apps
 * Provides common pattern for Apps 1-4
 * @param {Object} options - Configuration options
 * @param {Object} options.audio - Audio engine instance
 * @param {HTMLElement} options.loopBtn - Loop button element
 * @param {Object} options.state - State object with loopEnabled property
 * @param {Function} [options.onToggle] - Optional callback
 * @param {Function} [options.isPlaying] - Function that returns playing state
 * @returns {Object} Loop controller
 */
export function createRhythmLoopController({
  audio,
  loopBtn,
  state,
  onToggle,
  isPlaying
}) {
  return createLoopController({
    audio,
    loopBtn,
    getLoopState: () => state.loopEnabled || false,
    setLoopState: (enabled) => { state.loopEnabled = enabled; },
    onToggle,
    isPlaying
  });
}

/**
 * Enhanced loop controller that also handles memory persistence (for App2/App4)
 * @param {Object} options - Configuration options
 * @param {Object} options.audio - Audio engine instance
 * @param {HTMLElement} options.loopBtn - Loop button element
 * @param {Object} options.state - State object with loopEnabled property
 * @param {Function} options.ensurePulseMemory - Function to ensure pulse memory
 * @param {Function} options.getLg - Function to get current Lg value
 * @param {Function} [options.onToggle] - Optional callback
 * @param {Function} [options.isPlaying] - Function that returns playing state
 * @returns {Object} Enhanced loop controller
 */
export function createPulseMemoryLoopController({
  audio,
  loopBtn,
  state,
  ensurePulseMemory,
  getLg,
  onToggle,
  isPlaying
}) {
  return createLoopController({
    audio,
    loopBtn,
    getLoopState: () => state.loopEnabled || false,
    setLoopState: (enabled) => { state.loopEnabled = enabled; },
    onToggle: (enabled, context) => {
      // Ensure pulse memory when loop is toggled
      const lg = getLg();
      if (!isNaN(lg)) {
        ensurePulseMemory(lg);
      }

      // Call original callback if provided
      if (typeof onToggle === 'function') {
        onToggle(enabled, context);
      }
    },
    isPlaying
  });
}