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

    // Actualizar cursor de notación si existe
    if (notationRenderer && typeof notationRenderer.updateCursor === 'function') {
      const resolution = currentAudioResolution > 0 ? currentAudioResolution : 1;
      const currentPulse = Number.isFinite(state.step)
        ? state.step / resolution
        : 0;
      notationRenderer.updateCursor(currentPulse, isPlaying);
    }

    // Highlighting de pulsos - siempre usar highlightPulse que maneja ambos casos
    // (la función internamente detecta si es entero o fracción)
    highlightController.highlightPulse(highlightPayload, {
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
