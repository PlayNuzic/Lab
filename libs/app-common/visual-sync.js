/**
 * visual-sync.js
 *
 * Gestor de sincronización visual con requestAnimationFrame.
 * Sincroniza highlighting de pulsos/ciclos con el estado del audio.
 */

/**
 * Crea gestor de sincronización visual
 * @param {object} config
 * @param {Function} config.getAudio - Devuelve instancia de audio
 * @param {Function} config.getIsPlaying - Devuelve estado de reproducción
 * @param {Function} config.getLoopEnabled - Devuelve estado de loop
 * @param {object} config.highlightController - Controlador de highlighting
 * @param {object} [config.notationRenderer] - Renderer de notación (opcional)
 * @param {Function} [config.getPulses] - Devuelve array de pulsos para calcular baseCount
 * @param {Function} [config.onResolutionChange] - Callback cuando cambia la resolución
 * @returns {object} - API del gestor
 */
export function createVisualSyncManager({
  getAudio,
  getIsPlaying,
  getLoopEnabled,
  highlightController,
  notationRenderer = null,
  getPulses = null,
  onResolutionChange = null
}) {

  let rafHandle = null;
  let lastVisualStep = null;
  let currentAudioResolution = 1;

  /**
   * Sincroniza estado visual con el audio
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

    // Protección contra llamadas duplicadas
    if (lastVisualStep === state.step) {
      return;
    }
    lastVisualStep = state.step;

    // Actualizar resolution
    if (Number.isFinite(state.resolution) && state.resolution > 0) {
      const newResolution = Math.max(1, Math.round(state.resolution));
      if (newResolution !== currentAudioResolution) {
        currentAudioResolution = newResolution;
        if (onResolutionChange) {
          onResolutionChange(newResolution);
        }
      }
    }

    // Actualizar cursor de notación si existe
    if (notationRenderer && typeof notationRenderer.updateCursor === 'function') {
      const resolution = currentAudioResolution;
      const currentPulse = Number.isFinite(state.step) && resolution > 0
        ? state.step / resolution
        : 0;
      notationRenderer.updateCursor(currentPulse, isPlaying);
    }

    // Highlighting de pulsos - siempre usar highlightPulse que maneja ambos casos
    // (la función internamente detecta si es entero o fracción)
    highlightController.highlightPulse(state, {
      loopEnabled: getLoopEnabled(),
      isPlaying: true
    });

    // Highlighting de ciclos
    if (state.cycle && Number.isFinite(state.cycle.cycleIndex) && Number.isFinite(state.cycle.subdivisionIndex)) {
      highlightController.highlightCycle(state.cycle);
    }
  }

  /**
   * Inicia el loop de sincronización
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
   * Detiene el loop de sincronización
   */
  function stop() {
    if (rafHandle != null) {
      cancelAnimationFrame(rafHandle);
      rafHandle = null;
    }
    lastVisualStep = null;
  }

  // API pública
  return {
    start,
    stop,
    syncVisualState
  };
}
