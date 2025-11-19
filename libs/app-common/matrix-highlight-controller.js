/**
 * Matrix Highlight Controller
 *
 * Shared controller for highlighting pulses in 2D musical grids
 * Integrates with musical-grid and grid-editor modules
 *
 * Used by: App12 (Plano-Sucesión)
 * Future use: Any app with musical-grid + grid-editor combination
 */

/**
 * Creates a matrix highlight controller for musical grids
 *
 * @param {Object} config - Configuration object
 * @param {Object} config.musicalGrid - Musical grid instance from createMusicalGrid()
 * @param {Object} [config.gridEditor] - Optional grid editor instance from createGridEditor()
 * @param {number} config.totalNotes - Total number of notes (vertical dimension)
 * @param {number} config.currentBPM - Current BPM for interval highlighting
 * @returns {Object} Controller with highlightPulse() and clearHighlights() methods
 */
export function createMatrixHighlightController(config) {
  const {
    musicalGrid,
    gridEditor = null,
    totalNotes,
    currentBPM
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

  /**
   * Highlights a specific pulse across all grid components
   * @param {number} pulse - Pulse index to highlight
   */
  function highlightPulse(pulse) {
    // Clear previous highlights
    document.querySelectorAll('.pulse-marker.highlighted').forEach(el => {
      el.classList.remove('highlighted');
    });
    document.querySelectorAll('.musical-cell.pulse-highlight').forEach(el => {
      el.classList.remove('pulse-highlight');
    });
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
      ?.querySelector(`[data-pulse="${pulse}"]`);
    if (pulseMarker) {
      pulseMarker.classList.add('highlighted');
    }

    // Highlight all active cells in this pulse column
    if (musicalGrid) {
      for (let noteIndex = 0; noteIndex < totalNotes; noteIndex++) {
        const cell = musicalGrid.getCellElement(noteIndex, pulse);
        if (cell && cell.classList.contains('active')) {
          cell.classList.add('pulse-highlight');
        }
      }
    }

    // Use native interval highlighting from musical-grid
    if (musicalGrid) {
      const intervalSec = 60 / currentBPM;
      musicalGrid.onPulseStep(pulse, intervalSec * 1000);
    }

    // Highlight grid editor cells for this pulse
    if (gridEditor) {
      // Highlight all cells in this pulse column
      gridEditor.highlightCell('N', pulse);
      gridEditor.highlightCell('P', pulse);
    }
  }

  /**
   * Clears all highlights from the grid
   */
  function clearHighlights() {
    document.querySelectorAll('.pulse-marker.highlighted').forEach(el => {
      el.classList.remove('highlighted');
    });
    document.querySelectorAll('.musical-cell.pulse-highlight').forEach(el => {
      el.classList.remove('pulse-highlight');
    });
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

/**
 * Helper function to highlight a note on the soundline temporarily
 *
 * @param {Object} musicalGrid - Musical grid instance
 * @param {number} noteIndex - Note index to highlight (0-11 typically)
 * @param {number} durationMs - Duration of highlight in milliseconds
 */
export function highlightNoteOnSoundline(musicalGrid, noteIndex, durationMs) {
  if (!musicalGrid) return;

  const noteElement = musicalGrid.getNoteElement?.(noteIndex);
  if (!noteElement) return;

  const soundlineEl = musicalGrid.containers?.soundline;
  if (!soundlineEl) return;

  const rect = document.createElement('div');
  rect.className = 'soundline-highlight';

  const bounds = noteElement.getBoundingClientRect();
  const soundlineBounds = soundlineEl.getBoundingClientRect();

  rect.style.position = 'absolute';
  rect.style.top = `${bounds.top - soundlineBounds.top}px`;
  rect.style.left = '0';
  rect.style.width = '100%';
  rect.style.height = `${bounds.height}px`;
  rect.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
  rect.style.pointerEvents = 'none';
  rect.style.zIndex = '10';

  soundlineEl.appendChild(rect);

  setTimeout(() => {
    rect.remove();
  }, durationMs);
}
