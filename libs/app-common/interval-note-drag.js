/**
 * interval-note-drag.js - Drag handler for modifying temporal intervals (iT) in 2D grids
 *
 * Provides drag-to-create and drag-to-edit functionality for notes with temporal intervals.
 * Works with plano-modular grids and grid-editor components.
 *
 * Features:
 * - CREATE mode: Drag on empty cell to create new note with duration
 * - EDIT mode: Drag on existing note to modify its duration
 * - Visual feedback during drag (cell highlighting)
 * - Monophonic mode: New notes cut overlapping existing notes
 * - Preview sound during drag operations
 *
 * @example
 * import { createIntervalNoteDragHandler } from '../../libs/app-common/interval-note-drag.js';
 *
 * const dragHandler = createIntervalNoteDragHandler({
 *   grid,
 *   gridEditor,
 *   getPairs: () => currentPairs,
 *   setPairs: (pairs) => { currentPairs = pairs; },
 *   getTotalPulses: () => compas * cycles,
 *   syncController,  // Optional: grid-2d-sync-controller instance
 *   config: {
 *     defaultRegistry: 4,
 *     monophonic: true
 *   },
 *   onDragComplete: (pairs, mode) => console.log('Drag complete:', mode),
 *   playNotePreview: (note, registry, duration) => audio.play(note, registry, duration)
 * });
 *
 * dragHandler.attach();  // Start listening for drag events
 * dragHandler.detach();  // Stop listening
 */

/**
 * Creates a drag handler for interval note modification
 *
 * @param {Object} config - Configuration object
 * @param {Object} config.grid - plano-modular grid instance
 * @param {Object|Function} [config.gridEditor] - createGridEditor instance or getter function
 * @param {Function} config.getPairs - Function returning current pairs array
 * @param {Function} config.setPairs - Function to update pairs array
 * @param {Function} config.getTotalPulses - Function returning total pulses
 * @param {Object} [config.syncController] - grid-2d-sync-controller instance
 * @param {Object} [config.config={}] - Additional configuration
 * @param {number} [config.config.defaultRegistry=4] - Default registry for notes
 * @param {boolean} [config.config.monophonic=true] - Whether to cut overlapping notes
 * @param {Function} [config.onDragComplete] - Callback after drag completes (pairs, mode)
 * @param {Function} [config.playNotePreview] - Function to play note preview (note, registry, iT)
 * @param {Function} [config.fillGapsWithSilences] - Gap filler for editor sync
 * @returns {Object} Drag handler API
 */
export function createIntervalNoteDragHandler(config = {}) {
  const {
    grid,
    gridEditor: gridEditorOrGetter,
    getPairs,
    setPairs,
    getTotalPulses,
    syncController,
    config: dragConfig = {},
    onDragComplete,
    playNotePreview,
    fillGapsWithSilences
  } = config;

  // Support both direct reference and getter function
  const getGridEditor = () => {
    if (typeof gridEditorOrGetter === 'function') {
      return gridEditorOrGetter();
    }
    return gridEditorOrGetter;
  };

  const {
    defaultRegistry = 4,
    monophonic = true
  } = dragConfig;

  // Drag state
  let dragState = {
    active: false,
    startSpaceIndex: null,
    currentSpaceIndex: null,
    noteIndex: null,
    registryIndex: null,
    rowId: null,
    originalPair: null,
    mode: null  // 'create' | 'edit'
  };

  // Flag to prevent sync loops during drag
  let isUpdatingFromDrag = false;

  // Event handler references for cleanup
  let boundHandleDragStart = null;
  let boundHandleDragMove = null;
  let boundHandleDragEnd = null;

  // ========== INTERNAL HELPERS ==========

  /**
   * Get matrix container from grid
   */
  function getMatrixContainer() {
    return grid?.getElements?.()?.matrixContainer;
  }

  /**
   * Parse rowId to extract note and registry
   */
  function parseRowId(rowId) {
    const match = rowId?.match(/^(\d+)r(\d+)$/);
    if (!match) return null;
    return {
      note: parseInt(match[1]),
      registry: parseInt(match[2])
    };
  }

  // ========== DRAG HANDLERS ==========

  /**
   * Handle drag start - initiate dragging on a dot
   */
  function handleDragStart(e) {
    // Only start drag from dots
    const dot = e.target.closest('.np-dot');
    if (!dot) return;

    const cell = dot.closest('.plano-cell');
    if (!cell) return;

    const rowId = cell.dataset.rowId;
    const colIndex = parseInt(cell.dataset.colIndex);

    if (!rowId || isNaN(colIndex)) return;

    const parsed = parseRowId(rowId);
    if (!parsed) return;

    const { note, registry } = parsed;
    const pairs = getPairs();

    // Find existing pair at this position
    const existingPair = pairs.find(p =>
      p.note === note &&
      (p.registry ?? defaultRegistry) === registry &&
      p.pulse === colIndex
    );

    // Determine mode: edit existing or create new
    const mode = existingPair ? 'edit' : 'create';
    const pair = existingPair || {
      note,
      registry,
      pulse: colIndex,
      temporalInterval: 1
    };

    dragState = {
      active: true,
      startSpaceIndex: colIndex,
      currentSpaceIndex: colIndex,
      noteIndex: note,
      registryIndex: registry,
      rowId: rowId,
      originalPair: { ...pair },
      mode: mode
    };

    // Change cursor
    document.documentElement.style.setProperty('--np-dot-cursor', 'grabbing');
    document.body.style.cursor = 'grabbing';

    // Prevent text selection
    e.preventDefault();

    // Initial highlight
    updateDragHighlight();
  }

  /**
   * Handle drag move - update duration preview
   */
  function handleDragMove(e) {
    if (!dragState.active) return;

    const matrixContainer = getMatrixContainer();
    if (!matrixContainer) return;

    // Calculate current space index from mouse position
    const rect = matrixContainer.getBoundingClientRect();
    const relativeX = e.clientX - rect.left + matrixContainer.scrollLeft;

    const firstCell = matrixContainer.querySelector('.plano-cell');
    if (!firstCell) return;

    const cellWidth = firstCell.offsetWidth;
    const totalPulses = getTotalPulses();
    const newSpaceIndex = Math.max(
      dragState.startSpaceIndex,
      Math.min(totalPulses - 1, Math.floor(relativeX / cellWidth))
    );

    // Only update if space changed
    if (newSpaceIndex !== dragState.currentSpaceIndex) {
      dragState.currentSpaceIndex = newSpaceIndex;
      updateDragHighlight();
    }
  }

  /**
   * Handle drag end - finalize the duration change
   */
  function handleDragEnd() {
    if (!dragState.active) return;

    const originalPair = dragState.originalPair;
    const newEndPulse = dragState.currentSpaceIndex;
    const mode = dragState.mode;

    // Calculate new temporal interval
    const newIT = Math.max(1, newEndPulse - originalPair.pulse + 1);

    // Clear drag highlight
    clearDragHighlight();

    // Restore cursor
    document.documentElement.style.setProperty('--np-dot-cursor', 'grab');
    document.body.style.cursor = '';

    // Get current pairs
    let pairs = [...getPairs()];

    if (mode === 'create') {
      // CREATE MODE: Add new note
      const newPair = {
        note: originalPair.note,
        registry: originalPair.registry,
        pulse: originalPair.pulse,
        temporalInterval: newIT
      };

      const targetPulse = originalPair.pulse;

      if (monophonic) {
        // Check for exact match (note starts at this pulse)
        const exactMatchIndex = pairs.findIndex(p => p.pulse === targetPulse);

        if (exactMatchIndex >= 0) {
          // Replace existing note
          pairs[exactMatchIndex] = newPair;
        } else {
          // Check for overlap (clicking in middle of existing note's duration)
          const overlappingIndex = pairs.findIndex(p => {
            const noteStart = p.pulse;
            const noteEnd = noteStart + (p.temporalInterval || 1);
            return targetPulse > noteStart && targetPulse < noteEnd;
          });

          if (overlappingIndex >= 0) {
            // Cut overlapping note at targetPulse
            const overlappingNote = pairs[overlappingIndex];
            overlappingNote.temporalInterval = targetPulse - overlappingNote.pulse;
            pairs.push(newPair);
          } else {
            // No overlap - just add
            pairs.push(newPair);
          }

          // Sort by pulse
          pairs.sort((a, b) => a.pulse - b.pulse);
        }
      } else {
        // Polyphonic mode - just add
        pairs.push(newPair);
        pairs.sort((a, b) => a.pulse - b.pulse);
      }

    } else {
      // EDIT MODE: Update existing pair's temporalInterval
      const pairIndex = pairs.findIndex(p =>
        p.note === originalPair.note &&
        p.pulse === originalPair.pulse
      );

      if (pairIndex >= 0) {
        pairs[pairIndex].temporalInterval = newIT;
      }
    }

    // MONOPHONIC: Remove notes that get "covered" by the new/extended duration
    if (monophonic) {
      const noteStart = originalPair.pulse;
      const noteEnd = noteStart + newIT;

      // Filter out notes that START within the new note's range (but not the note itself)
      pairs = pairs.filter(p => {
        // Keep the note we just created/edited
        if (p.pulse === noteStart) return true;
        // Remove notes that start within our range
        if (p.pulse > noteStart && p.pulse < noteEnd) return false;
        return true;
      });

      // Also cut any note that EXTENDS into our range from before
      pairs.forEach(p => {
        if (p.pulse < noteStart) {
          const pEnd = p.pulse + (p.temporalInterval || 1);
          if (pEnd > noteStart) {
            // Cut this note to end at our start
            p.temporalInterval = noteStart - p.pulse;
          }
        }
      });

      // Sort by pulse
      pairs.sort((a, b) => a.pulse - b.pulse);
    }

    // Set flag to prevent sync loops
    isUpdatingFromDrag = true;

    // Update state
    setPairs(pairs);

    // Sync grid if controller provided
    if (syncController) {
      syncController.syncGridFromPairs(pairs);
    }

    // Update grid editor
    const editor = getGridEditor();
    if (editor) {
      const pairsForEditor = fillGapsWithSilences
        ? fillGapsWithSilences(pairs)
        : pairs;
      editor.setPairs(pairsForEditor);
    }

    // Play preview sound
    if (playNotePreview && !originalPair.isRest) {
      playNotePreview(originalPair.note, originalPair.registry, newIT);
    }

    // Callback
    if (onDragComplete) {
      onDragComplete(pairs, mode);
    }

    // Reset flag after next frame
    requestAnimationFrame(() => {
      isUpdatingFromDrag = false;
    });

    // Reset drag state
    dragState = {
      active: false,
      startSpaceIndex: null,
      currentSpaceIndex: null,
      noteIndex: null,
      registryIndex: null,
      rowId: null,
      originalPair: null,
      mode: null
    };
  }

  // ========== HIGHLIGHT ==========

  /**
   * Update drag highlight - illuminate cells being stretched
   */
  function updateDragHighlight() {
    if (!dragState.active) return;

    // Use sync controller if available
    if (syncController) {
      syncController.highlightDragRange(
        dragState.rowId,
        dragState.startSpaceIndex,
        dragState.currentSpaceIndex
      );
      return;
    }

    // Fallback: direct DOM manipulation
    clearDragHighlight();

    const matrixContainer = getMatrixContainer();
    if (!matrixContainer) return;

    const rowId = dragState.rowId;
    const startPulse = dragState.startSpaceIndex;
    const endPulse = dragState.currentSpaceIndex;

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
    // Use sync controller if available
    if (syncController) {
      syncController.clearDragHighlight();
      return;
    }

    // Fallback: direct DOM manipulation
    const matrixContainer = getMatrixContainer();
    if (!matrixContainer) return;

    matrixContainer.querySelectorAll('.plano-cell.drag-highlight').forEach(cell => {
      cell.classList.remove('drag-highlight');
    });
  }

  // ========== ATTACH/DETACH ==========

  /**
   * Attach drag event listeners
   */
  function attach() {
    const matrixContainer = getMatrixContainer();
    if (!matrixContainer) {
      console.warn('interval-note-drag: No matrix container found');
      return;
    }

    // Create bound handlers
    boundHandleDragStart = handleDragStart.bind(this);
    boundHandleDragMove = handleDragMove.bind(this);
    boundHandleDragEnd = handleDragEnd.bind(this);

    // Attach listeners
    matrixContainer.addEventListener('mousedown', boundHandleDragStart);
    document.addEventListener('mousemove', boundHandleDragMove);
    document.addEventListener('mouseup', boundHandleDragEnd);

    // Set initial cursor style
    document.documentElement.style.setProperty('--np-dot-cursor', 'grab');
  }

  /**
   * Detach drag event listeners
   */
  function detach() {
    const matrixContainer = getMatrixContainer();

    if (matrixContainer && boundHandleDragStart) {
      matrixContainer.removeEventListener('mousedown', boundHandleDragStart);
    }

    if (boundHandleDragMove) {
      document.removeEventListener('mousemove', boundHandleDragMove);
    }

    if (boundHandleDragEnd) {
      document.removeEventListener('mouseup', boundHandleDragEnd);
    }

    boundHandleDragStart = null;
    boundHandleDragMove = null;
    boundHandleDragEnd = null;
  }

  /**
   * Check if currently in a drag operation
   */
  function isDragging() {
    return dragState.active;
  }

  /**
   * Check if update came from drag (to prevent loops)
   */
  function isFromDrag() {
    return isUpdatingFromDrag;
  }

  /**
   * Get current drag state (for debugging)
   */
  function getDragState() {
    return { ...dragState };
  }

  /**
   * Cancel current drag operation
   */
  function cancelDrag() {
    if (!dragState.active) return;

    clearDragHighlight();

    document.documentElement.style.setProperty('--np-dot-cursor', 'grab');
    document.body.style.cursor = '';

    dragState = {
      active: false,
      startSpaceIndex: null,
      currentSpaceIndex: null,
      noteIndex: null,
      registryIndex: null,
      rowId: null,
      originalPair: null,
      mode: null
    };

    isUpdatingFromDrag = false;
  }

  /**
   * Destroy the drag handler
   */
  function destroy() {
    cancelDrag();
    detach();
  }

  // ========== PUBLIC API ==========

  return {
    // Lifecycle
    attach,
    detach,
    destroy,

    // State
    isDragging,
    isFromDrag,
    getDragState,
    cancelDrag,

    // Manual highlight control
    updateDragHighlight,
    clearDragHighlight
  };
}
