/**
 * grid-2d-sync-controller.js - Bidirectional sync between Grid 2D and Grid Editor
 *
 * Manages synchronization between a 2D grid (plano-modular) and a grid editor (matrix-seq)
 * for N-iT (Note-IntervalTemporal) or NrX-iT (Note-Registry-IntervalTemporal) sequences.
 *
 * Features:
 * - Editor → Grid 2D sync (syncGridFromPairs)
 * - Grid 2D → Editor sync (handleCellClick)
 * - Duration highlighting for multi-pulse notes
 * - Dot placement for drag-to-create functionality
 * - Registry-based note validation
 *
 * @example
 * import { createGrid2DSyncController } from '../../libs/app-common/grid-2d-sync-controller.js';
 *
 * const syncController = createGrid2DSyncController({
 *   grid,           // plano-modular instance
 *   gridEditor,     // createGridEditor instance
 *   getPairs: () => currentPairs,
 *   setPairs: (pairs) => { currentPairs = pairs; },
 *   config: {
 *     defaultRegistry: 4,
 *     validateNoteRegistry: (note, registry) => ({ valid: true })
 *   },
 *   onSyncComplete: (pairs) => console.log('Synced:', pairs)
 * });
 *
 * // Sync editor changes to grid
 * syncController.syncGridFromPairs(pairs);
 *
 * // Enable drag mode (adds dots to cells)
 * syncController.enableDragMode(true);
 */

/**
 * Creates a bidirectional sync controller for Grid 2D and Grid Editor
 *
 * @param {Object} config - Configuration object
 * @param {Object} config.grid - plano-modular grid instance
 * @param {Object} config.gridEditor - createGridEditor instance
 * @param {Function} config.getPairs - Function returning current pairs array
 * @param {Function} config.setPairs - Function to update pairs array
 * @param {Object} [config.config={}] - Additional configuration
 * @param {number} [config.config.defaultRegistry=4] - Default registry for notes
 * @param {Function} [config.config.validateNoteRegistry] - Validation function (note, registry) => { valid, message }
 * @param {Function} [config.config.fillGapsWithSilences] - Gap filler function
 * @param {Function} [config.onSyncComplete] - Callback after sync completes
 * @param {Function} [config.onCellClick] - Custom cell click handler
 * @param {Function} [config.playNotePreview] - Function to play note preview (midi, duration)
 * @returns {Object} Sync controller API
 */
export function createGrid2DSyncController(config = {}) {
  const {
    grid,
    gridEditor,
    getPairs,
    setPairs,
    config: syncConfig = {},
    onSyncComplete,
    onCellClick,
    playNotePreview
  } = config;

  const {
    defaultRegistry = 4,
    validateNoteRegistry = () => ({ valid: true }),
    fillGapsWithSilences = null,
    notesPerRegistry = 12
  } = syncConfig;

  let dotsEnabled = false;

  // ========== INTERNAL HELPERS ==========

  /**
   * Get matrix container from grid
   */
  function getMatrixContainer() {
    return grid?.getElements?.()?.matrixContainer;
  }

  /**
   * Parse rowId to extract note and registry
   * @param {string} rowId - Format "NrR" e.g., "5r4"
   * @returns {{ note: number, registry: number } | null}
   */
  function parseRowId(rowId) {
    const match = rowId?.match(/^(\d+)r(\d+)$/);
    if (!match) return null;
    return {
      note: parseInt(match[1]),
      registry: parseInt(match[2])
    };
  }

  /**
   * Build rowId from note and registry
   * @param {number} note - Note value (0-11)
   * @param {number} registry - Registry value
   * @returns {string} Format "NrR"
   */
  function buildRowId(note, registry) {
    return `${note}r${registry}`;
  }

  // ========== SYNC: EDITOR → GRID 2D ==========

  /**
   * Sync Grid 2D from grid-editor pairs (Editor → Grid 2D)
   * Each note illuminates `temporalInterval` cells starting from `pulse`
   *
   * @param {Array} pairs - Array of { note, pulse, temporalInterval, registry, isRest }
   */
  function syncGridFromPairs(pairs) {
    if (!grid) return;

    // Update internal state
    setPairs([...pairs]);

    // Clear duration highlights
    clearDurationHighlights();

    // Build selection keys and duration cells
    const selectionKeys = [];
    const durationCells = [];

    pairs.forEach((pair) => {
      // Skip silences
      if (pair.isRest) return;
      if (pair.note === null || pair.note === undefined) return;

      const registry = pair.registry ?? defaultRegistry;
      const rowId = buildRowId(pair.note, registry);
      const iT = pair.temporalInterval || 1;
      const startPulse = pair.pulse;

      // First cell: selection key (note start position)
      selectionKeys.push(`${rowId}-${startPulse}`);

      // Additional cells: duration highlights
      for (let pulse = startPulse + 1; pulse < startPulse + iT; pulse++) {
        durationCells.push({ rowId, pulse });
      }
    });

    // Load selection (clears existing, loads new, calls refresh)
    grid.loadSelection(selectionKeys);

    // Apply duration highlights and restore dots after refresh
    requestAnimationFrame(() => {
      durationCells.forEach(({ rowId, pulse }) => {
        highlightSingleCell(rowId, pulse);
      });

      // Re-add dots if enabled
      if (dotsEnabled) {
        addDotsToAllCells();
      }

      // Callback
      if (onSyncComplete) {
        onSyncComplete(pairs);
      }
    });
  }

  /**
   * Highlight a single cell with duration-highlight class
   * Used for cells that extend a note's duration (not the starting cell)
   *
   * @param {string} rowId - Row ID in format "NrR"
   * @param {number} pulse - Pulse index
   */
  function highlightSingleCell(rowId, pulse) {
    const matrixContainer = getMatrixContainer();
    if (!matrixContainer) return;

    const cell = matrixContainer.querySelector(
      `.plano-cell[data-row-id="${rowId}"][data-col-index="${pulse}"]`
    );
    if (cell) {
      cell.classList.add('duration-highlight');
    }
  }

  /**
   * Clear all duration highlights from the grid
   */
  function clearDurationHighlights() {
    const matrixContainer = getMatrixContainer();
    if (!matrixContainer) return;

    matrixContainer.querySelectorAll('.plano-cell.duration-highlight').forEach(cell => {
      cell.classList.remove('duration-highlight');
    });
  }

  // ========== SYNC: GRID 2D → EDITOR ==========

  /**
   * Handle cell click from grid (Grid 2D → Editor sync)
   * When user clicks on Grid 2D, update the grid-editor
   *
   * @param {Object} rowData - Row data from grid { id, midi, ... }
   * @param {number} colIndex - Column (pulse) index
   * @param {boolean} isSelected - Whether cell is now selected
   */
  async function handleCellClick(rowData, colIndex, isSelected) {
    // Custom handler takes priority
    if (onCellClick) {
      onCellClick(rowData, colIndex, isSelected);
      return;
    }

    if (!gridEditor) return;

    // Parse note and registry from rowId
    const parsed = parseRowId(rowData.id);
    if (!parsed) return;

    const { note, registry } = parsed;

    // Validate note+registry combination
    const validation = validateNoteRegistry(note, registry);
    if (!validation.valid) {
      console.warn('Invalid note+registry:', validation.message);
      return;
    }

    if (isSelected) {
      // Play the note preview
      if (playNotePreview && rowData.midi) {
        playNotePreview(rowData.midi, 0.3);
      }

      // Get current pairs from editor
      const currentPairs = gridEditor.getPairs();

      // Check if this pulse already has a note
      const existingIndex = currentPairs.findIndex(p => p.pulse === colIndex);

      if (existingIndex >= 0) {
        // Update existing pair
        currentPairs[existingIndex] = {
          ...currentPairs[existingIndex],
          note,
          registry
        };
      } else {
        // Add new pair - calculate temporalInterval from previous note
        let temporalInterval = 1;
        if (currentPairs.length > 0) {
          const lastPair = currentPairs[currentPairs.length - 1];
          const lastPulse = lastPair.pulse + (lastPair.temporalInterval || 1);
          temporalInterval = colIndex - lastPulse + 1;
          if (temporalInterval < 1) temporalInterval = 1;
        }

        currentPairs.push({
          note,
          registry,
          pulse: colIndex,
          temporalInterval
        });
      }

      // Sort by pulse
      currentPairs.sort((a, b) => a.pulse - b.pulse);

      // Update editor (with silences if fillGapsWithSilences provided)
      const pairsForEditor = fillGapsWithSilences
        ? fillGapsWithSilences(currentPairs)
        : currentPairs;
      gridEditor.setPairs(pairsForEditor);

    } else {
      // Cell was deselected - remove from grid-editor
      const currentPairs = gridEditor.getPairs().filter(p => !p.isRest);
      const updatedPairs = currentPairs.filter(p => p.pulse !== colIndex);

      const pairsForEditor = fillGapsWithSilences
        ? fillGapsWithSilences(updatedPairs)
        : updatedPairs;
      gridEditor.setPairs(pairsForEditor);
    }
  }

  // ========== DRAG MODE: DOT MANAGEMENT ==========

  /**
   * Enable or disable drag mode (adds/removes dots from cells)
   *
   * @param {boolean} enabled - Whether drag mode is enabled
   */
  function enableDragMode(enabled) {
    dotsEnabled = enabled;
    if (enabled) {
      addDotsToAllCells();
    } else {
      removeDotsFromAllCells();
    }
  }

  /**
   * Add np-dot elements to ALL cells in the grid (bottom-left corner)
   * This enables drag-to-create functionality
   */
  function addDotsToAllCells() {
    const matrixContainer = getMatrixContainer();
    if (!matrixContainer) return;

    const cells = matrixContainer.querySelectorAll('.plano-cell');

    cells.forEach(cell => {
      // Skip if dot already exists
      if (cell.querySelector('.np-dot')) return;

      // Create dot element
      const dot = document.createElement('div');
      dot.className = 'np-dot np-dot-clickable';
      dot.dataset.rowId = cell.dataset.rowId;
      dot.dataset.colIndex = cell.dataset.colIndex;

      cell.appendChild(dot);
    });
  }

  /**
   * Remove all dots from cells
   */
  function removeDotsFromAllCells() {
    const matrixContainer = getMatrixContainer();
    if (!matrixContainer) return;

    matrixContainer.querySelectorAll('.np-dot').forEach(dot => {
      dot.remove();
    });
  }

  /**
   * Refresh dots after grid update
   * Call this after grid refresh/update operations
   */
  function refreshDots() {
    if (dotsEnabled) {
      requestAnimationFrame(() => {
        addDotsToAllCells();
      });
    }
  }

  // ========== HIGHLIGHT UTILITIES ==========

  /**
   * Highlight cells during drag operation
   *
   * @param {string} rowId - Row ID
   * @param {number} startPulse - Start pulse index
   * @param {number} endPulse - End pulse index
   */
  function highlightDragRange(rowId, startPulse, endPulse) {
    clearDragHighlight();

    const matrixContainer = getMatrixContainer();
    if (!matrixContainer) return;

    for (let pulse = startPulse; pulse <= endPulse; pulse++) {
      const cell = matrixContainer.querySelector(
        `.plano-cell[data-row-id="${rowId}"][data-col-index="${pulse}"]`
      );
      if (cell) {
        cell.classList.add('drag-highlight');
      }
    }
  }

  /**
   * Clear drag highlight from all cells
   */
  function clearDragHighlight() {
    const matrixContainer = getMatrixContainer();
    if (!matrixContainer) return;

    matrixContainer.querySelectorAll('.plano-cell.drag-highlight').forEach(cell => {
      cell.classList.remove('drag-highlight');
    });
  }

  // ========== CLEANUP ==========

  /**
   * Destroy the sync controller and clean up
   */
  function destroy() {
    dotsEnabled = false;
    removeDotsFromAllCells();
    clearDurationHighlights();
    clearDragHighlight();
  }

  // ========== PUBLIC API ==========

  return {
    // Sync operations
    syncGridFromPairs,
    handleCellClick,

    // Highlight operations
    highlightSingleCell,
    clearDurationHighlights,
    highlightDragRange,
    clearDragHighlight,

    // Dot management
    enableDragMode,
    addDotsToAllCells,
    removeDotsFromAllCells,
    refreshDots,

    // Utilities
    parseRowId,
    buildRowId,
    getMatrixContainer,

    // Cleanup
    destroy
  };
}
