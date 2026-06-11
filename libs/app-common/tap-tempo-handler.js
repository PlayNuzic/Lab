/**
 * Tap Tempo Handler shared component for Lab rhythm apps
 * Provides consistent tap tempo behavior with visual feedback
 */

/**
 * Create a tap tempo handler that manages tap detection and BPM updates
 * @param {Object} options - Configuration options
 * @param {Function} options.getAudioInstance - Async function that returns audio instance
 * @param {HTMLElement} [options.tapBtn] - Tap button element
 * @param {HTMLElement} [options.tapHelp] - Help text element showing remaining clicks
 * @param {Function} options.onBpmDetected - Callback when BPM is detected (receives bpm value)
 * @param {Object} [options.messages] - Custom messages
 * @param {string} [options.messages.initial] - Initial help message (default: 'Se necesitan 3 clicks')
 * @param {string} [options.messages.twoMore] - Message for 2 clicks remaining (default: '2 clicks más')
 * @param {string} [options.messages.oneMore] - Message for 1 click remaining (default: '1 click más solamente')
 * @returns {Object} Tap tempo handler with tap method
 */
export function createTapTempoHandler({
  getAudioInstance,
  tapBtn,
  tapHelp,
  onBpmDetected,
  messages = {}
}) {
  const msgs = {
    initial: messages.initial || 'Se necesitan 3 clicks',
    twoMore: messages.twoMore || '2 clicks más',
    oneMore: messages.oneMore || '1 click más solamente'
  };

  const handler = {
    /**
     * Handle tap tempo click
     */
    async tap() {
      try {
        // LA-10: el timestamp es captura ABANS de l'await — el primer tap
        // d'una sessió dispara la init d'àudio sencera (centenars de ms) i
        // capturar-lo després escurçava el primer interval, esbiaixant el
        // BPM detectat cap amunt.
        const tappedAt = performance.now();
        const audioInstance = await getAudioInstance();
        if (!audioInstance || typeof audioInstance.tapTempo !== 'function') {
          console.warn('Audio instance does not support tapTempo');
          return;
        }

        const result = audioInstance.tapTempo(tappedAt);
        if (!result) return;

        // Show feedback for remaining taps
        if (result.remaining > 0) {
          if (tapHelp) {
            tapHelp.textContent = result.remaining === 2 ? msgs.twoMore : msgs.oneMore;
            tapHelp.style.display = 'block';
          }
          return;
        }

        // Hide help text when complete
        if (tapHelp) {
          tapHelp.style.display = 'none';
        }

        // Notify callback with detected BPM
        if (Number.isFinite(result.bpm) && result.bpm > 0) {
          const bpm = Math.round(result.bpm * 100) / 100;
          if (typeof onBpmDetected === 'function') {
            onBpmDetected(bpm, result);
          }
        }
      } catch (error) {
        console.warn('Tap tempo failed', error);
      }
    },

    /**
     * Reset tap tempo state
     */
    reset() {
      if (tapHelp) {
        tapHelp.textContent = msgs.initial;
        tapHelp.style.display = 'none';
      }
    },

    /**
     * Attach event listener to button
     */
    attach() {
      if (tapBtn) {
        tapBtn.addEventListener('click', handler.tap);
      }
      handler.reset();
    },

    /**
     * Remove event listener from button
     */
    detach() {
      if (tapBtn) {
        tapBtn.removeEventListener('click', handler.tap);
      }
    }
  };

  return handler;
}
