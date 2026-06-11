/**
 * Matrix Highlight Controller
 *
 * Shared controller for highlighting pulses in 2D musical grids
 * Integrates with musical-grid and grid-editor modules
 *
 * Used by: App12/App15/App25/App25B (grids 2D amb musical-grid)
 * LH-05: germans deliberadament separats — highlight-controller.js (App4)
 * i simple-highlight-controller.js (App1/2/9). NO consolidar.
 */

/**
 * Creates a matrix highlight controller for musical grids
 *
 * @param {Object} config - Configuration object
 * @param {Object} config.musicalGrid - Musical grid instance from createMusicalGrid()
 * @param {Object} [config.gridEditor] - Optional grid editor instance from createGridEditor()
 * @param {number} config.totalNotes - Total number of notes (vertical dimension)
 * @param {number} config.currentBPM - BPM inicial per a la durada dels highlights
 * @param {Function} [config.getBPM] - Getter del BPM viu (P-19: el valor per
 *   construcció quedava congelat — després d'un canvi de tempo les durades
 *   dels highlights divergien del pols audible)
 * @returns {Object} Controller with highlightPulse() and clearHighlights() methods
 */
export function createMatrixHighlightController(config) {
  const {
    musicalGrid,
    gridEditor = null,
    totalNotes,
    currentBPM,
    getBPM = null
  } = config;

  if (!musicalGrid) {
    throw new Error('musicalGrid is required for createMatrixHighlightController');
  }

  if (typeof totalNotes !== 'number' || totalNotes <= 0) {
    throw new Error('totalNotes must be a positive number');
  }

  if (typeof currentBPM !== 'number' || currentBPM <= 0) {
    throw new Error('currentBPM must be a positive number');
  }

  let currentPulse = -1;
  // P-19: referència al marcador encès per netejar només aquell en lloc
  // d'un querySelectorAll de document per pas. (El sweep de .pz.number es
  // manté: aquella classe l'afegeixen els editors de les apps, no aquest
  // controller, així que no en podem tenir referència.)
  let lastMarker = null;

  /**
   * Highlights a specific pulse across all grid components
   * @param {number} pulse - Pulse index to highlight
   */
  function highlightPulse(pulse) {
    // Clear previous highlights
    if (lastMarker) {
      lastMarker.classList.remove('highlighted');
      lastMarker = null;
    }
    document.querySelectorAll('.pz.number.highlighted').forEach(el => {
      el.classList.remove('highlighted');
    });

    // Clear grid editor cell highlights
    if (gridEditor) {
      gridEditor.clearHighlights();
    }

    currentPulse = pulse;

    // Highlight pulse marker on timeline
    const pulseMarker = musicalGrid?.containers?.timeline
      ?.querySelector(`.pulse-marker[data-pulse-index="${pulse}"]`);
    if (pulseMarker) {
      pulseMarker.classList.add('highlighted');
      lastMarker = pulseMarker;
    }

    // Use native interval highlighting from musical-grid
    if (musicalGrid) {
      const bpm = (typeof getBPM === 'function' && getBPM()) || currentBPM;
      const intervalSec = 60 / bpm;
      musicalGrid.onPulseStep(pulse, intervalSec * 1000);
    }

    // Highlight grid editor cells for this pulse.
    // `highlightCell` és opcional — el matrix-seq grid-editor original
    // l'implementa, però els editors nuzic per app (App12/15/25/25B) usen
    // un objecte custom sense aquest mètode. Optional chaining evita el
    // TypeError que avortava tot el pulse callback (incloent l'add de
    // `.musical-cell.playing`).
    if (gridEditor && typeof gridEditor.highlightCell === 'function') {
      gridEditor.highlightCell('N', pulse);
      gridEditor.highlightCell('P', pulse);
    }
  }

  /**
   * Clears all highlights from the grid
   */
  function clearHighlights() {
    // Sweep complet expressament: és el camí de reset (stop/re-render),
    // no el hot path, i ha d'agafar marcadors d'un render anterior.
    document.querySelectorAll('.pulse-marker.highlighted').forEach(el => {
      el.classList.remove('highlighted');
    });
    lastMarker = null;
    // Clear interval highlights using native method
    if (musicalGrid) {
      musicalGrid.clearIntervalHighlights('horizontal');
    }
    if (gridEditor) {
      gridEditor.clearHighlights();
    }
    currentPulse = -1;
  }

  /**
   * Gets the currently highlighted pulse
   * @returns {number} Current pulse index (-1 if none)
   */
  function getCurrentPulse() {
    return currentPulse;
  }

  return {
    highlightPulse,
    clearHighlights,
    getCurrentPulse
  };
}

