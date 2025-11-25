/**
 * Interval Drag Handler Module
 *
 * Provides mouse drag system for horizontally modifying note duration (iT).
 * Creates or edits pairs by dragging on the musical grid.
 *
 * @module libs/interval-sequencer/interval-drag-handler
 */

/**
 * @typedef {Object} DragState
 * @property {boolean} active - Whether drag is currently active
 * @property {number|null} startSpaceIndex - Starting space/cell index
 * @property {number|null} currentSpaceIndex - Current space/cell index during drag
 * @property {number|null} noteIndex - Note row being dragged
 * @property {Object|null} originalPair - Original pair if editing
 * @property {'create'|'edit'|null} mode - Current drag mode
 */

/**
 * @typedef {Object} DragHandlerConfig
 * @property {Object} musicalGrid - Musical grid instance (from createMusicalGrid)
 * @property {Object} gridEditor - Grid editor instance (from createGridEditor)
 * @property {number} totalSpaces - Total number of spaces/cells (e.g., 8)
 * @property {Function} [getPairs] - Function to get current pairs (defaults to gridEditor.getPairs)
 * @property {Function} [setPairs] - Function to set pairs (defaults to gridEditor.setPairs)
 * @property {Function} [getPolyphonyEnabled] - Function to check polyphony mode
 * @property {Function} [onDragStart] - Callback when drag starts
 * @property {Function} [onDragMove] - Callback during drag move
 * @property {Function} [onDragEnd] - Callback when drag ends with new pairs
 * @property {Function} [onNotePreview] - Callback to play note preview (noteIndex, iT)
 * @property {boolean} [autoFillGaps=true] - Auto-fill gaps with silences
 * @property {Function} [fillGaps] - Custom gap filler function
 */

/**
 * Create an interval drag handler for horizontal iT modification
 *
 * @param {DragHandlerConfig} config - Configuration options
 * @returns {Object} Drag handler API
 *
 * @example
 * const dragHandler = createIntervalDragHandler({
 *   musicalGrid,
 *   gridEditor,
 *   totalSpaces: 8,
 *   getPolyphonyEnabled: () => polyphonyEnabled,
 *   onDragEnd: (pairs) => {
 *     syncGridFromPairs(pairs);
 *     saveState();
 *   },
 *   onNotePreview: (noteIndex, iT) => playNote(noteIndex, iT)
 * });
 *
 * // Enable drag mode
 * dragHandler.setEnabled(true);
 *
 * // Later: cleanup
 * dragHandler.destroy();
 */
export function createIntervalDragHandler(config) {
  const {
    musicalGrid,
    gridEditor,
    totalSpaces,
    getPairs = () => gridEditor?.getPairs?.() || [],
    setPairs = (pairs) => gridEditor?.setPairs?.(pairs),
    getPolyphonyEnabled = () => false,
    onDragStart,
    onDragMove,
    onDragEnd,
    onNotePreview,
    autoFillGaps = true,
    fillGaps
  } = config;

  // Internal state
  let enabled = true;
  let dragState = createInitialDragState();

  // Event handlers bound to this instance
  let boundMouseMove = null;
  let boundMouseUp = null;

  /**
   * Create initial drag state
   */
  function createInitialDragState() {
    return {
      active: false,
      startSpaceIndex: null,
      currentSpaceIndex: null,
      noteIndex: null,
      originalPair: null,
      mode: null
    };
  }

  /**
   * Calculate space index from mouse X coordinate
   */
  function calculateSpaceFromMouseX(mouseX) {
    const matrixContainer = musicalGrid?.getMatrixContainer?.();
    if (!matrixContainer) return null;

    const rect = matrixContainer.getBoundingClientRect();
    const relativeX = mouseX - rect.left;

    // Calculate which space (cell) the mouse is over
    const cellWidth = rect.width / totalSpaces;
    const spaceIndex = Math.floor(relativeX / cellWidth);

    // Clamp to valid range [0, totalSpaces - 1]
    return Math.max(0, Math.min(totalSpaces - 1, spaceIndex));
  }

  /**
   * Clear visual preview of drag selection
   */
  function clearDragPreview() {
    document.querySelectorAll('.musical-cell.drag-preview').forEach(cell => {
      cell.classList.remove('drag-preview');
    });
  }

  /**
   * Apply drag visual feedback (cursor, body class)
   */
  function applyDragVisuals() {
    document.body.classList.add('dragging-note');
    document.documentElement.style.setProperty('--np-dot-cursor', 'grabbing');
  }

  /**
   * Remove drag visual feedback
   */
  function removeDragVisuals() {
    document.body.classList.remove('dragging-note');
    document.documentElement.style.setProperty('--np-dot-cursor', 'grab');
  }

  /**
   * Reset drag state to initial values
   */
  function resetDragState() {
    clearDragPreview();
    removeDragVisuals();
    dragState = createInitialDragState();
  }

  /**
   * Handle mousedown to start drag
   */
  function handleDotMouseDown(noteIndex, spaceIndex, event) {
    if (!enabled || !gridEditor) return;

    const pairsAtMoment = getPairs();

    // Check if there's an existing pair at this position
    const existingPair = pairsAtMoment.find(p =>
      p.note === noteIndex && p.pulse === spaceIndex
    );

    dragState.active = true;
    dragState.startSpaceIndex = spaceIndex;
    dragState.currentSpaceIndex = spaceIndex;
    dragState.noteIndex = noteIndex;
    dragState.originalPair = existingPair || null;
    dragState.mode = existingPair ? 'edit' : 'create';

    // Visual feedback
    applyDragVisuals();

    // Show preview on initial cell
    const cell = musicalGrid?.getCellElement?.(noteIndex, spaceIndex);
    if (cell) {
      cell.classList.add('drag-preview');
    }

    // Callback
    if (onDragStart) {
      onDragStart({
        noteIndex,
        spaceIndex,
        mode: dragState.mode,
        originalPair: existingPair
      });
    }

    // Prevent default
    event?.preventDefault?.();
    event?.stopPropagation?.();
  }

  /**
   * Handle mousemove during drag
   */
  function handleMouseMove(event) {
    if (!dragState.active || !enabled) return;

    const newSpaceIndex = calculateSpaceFromMouseX(event.clientX);
    if (newSpaceIndex === null || newSpaceIndex === dragState.currentSpaceIndex) return;

    // Clear previous preview
    clearDragPreview();

    dragState.currentSpaceIndex = newSpaceIndex;

    // Show preview of cells that will be occupied
    const startSpace = Math.min(dragState.startSpaceIndex, newSpaceIndex);
    const endSpace = Math.max(dragState.startSpaceIndex, newSpaceIndex);

    for (let space = startSpace; space <= endSpace; space++) {
      const cell = musicalGrid?.getCellElement?.(dragState.noteIndex, space);
      if (cell) {
        cell.classList.add('drag-preview');
      }
    }

    // Callback
    if (onDragMove) {
      onDragMove({
        noteIndex: dragState.noteIndex,
        startSpace,
        endSpace,
        iT: endSpace - startSpace + 1
      });
    }
  }

  /**
   * Handle mouseup to finalize drag
   */
  function handleMouseUp(event) {
    if (!dragState.active || !enabled) return;

    const startSpace = dragState.startSpaceIndex;
    const endSpace = dragState.currentSpaceIndex ?? startSpace;

    // Calculate iT as distance + 1 (inclusive)
    const iT = Math.abs(endSpace - startSpace) + 1;
    const startPulse = Math.min(startSpace, endSpace);

    const pairsAtMoment = getPairs();
    let newPairs;

    if (dragState.mode === 'create') {
      // Creating new pair
      const newPair = {
        note: dragState.noteIndex,
        pulse: startPulse,
        temporalInterval: iT
      };

      const polyphonyEnabled = getPolyphonyEnabled();

      if (!polyphonyEnabled) {
        // Remove overlapping pairs
        newPairs = pairsAtMoment.filter(p => {
          const pEnd = p.pulse + (p.temporalInterval || 1) - 1;
          const newEnd = startPulse + iT - 1;
          return !(p.pulse <= newEnd && pEnd >= startPulse);
        });
        newPairs.push(newPair);
      } else {
        newPairs = [...pairsAtMoment, newPair];
      }

    } else if (dragState.mode === 'edit' && dragState.originalPair) {
      // Edit existing pair
      newPairs = pairsAtMoment.map(p => {
        if (p === dragState.originalPair) {
          return {
            ...p,
            pulse: startPulse,
            temporalInterval: iT
          };
        }
        return p;
      });
    } else {
      newPairs = pairsAtMoment;
    }

    // Auto-fill gaps if configured
    if (autoFillGaps && fillGaps) {
      newPairs = fillGaps(newPairs);
    }

    // Play preview sound
    if (onNotePreview && dragState.mode === 'create') {
      onNotePreview(dragState.noteIndex, iT);
    }

    // Update pairs
    setPairs(newPairs);

    // Callback with final pairs
    if (onDragEnd) {
      onDragEnd(newPairs, {
        noteIndex: dragState.noteIndex,
        pulse: startPulse,
        temporalInterval: iT,
        mode: dragState.mode
      });
    }

    // Reset state
    resetDragState();
  }

  /**
   * Attach event listeners to document
   */
  function attachListeners() {
    if (boundMouseMove || boundMouseUp) return;

    boundMouseMove = handleMouseMove;
    boundMouseUp = handleMouseUp;

    document.addEventListener('mousemove', boundMouseMove);
    document.addEventListener('mouseup', boundMouseUp);
  }

  /**
   * Detach event listeners from document
   */
  function detachListeners() {
    if (boundMouseMove) {
      document.removeEventListener('mousemove', boundMouseMove);
      boundMouseMove = null;
    }
    if (boundMouseUp) {
      document.removeEventListener('mouseup', boundMouseUp);
      boundMouseUp = null;
    }
  }

  // Auto-attach listeners on creation
  attachListeners();

  // Public API
  return {
    /**
     * Start a drag operation (called from dot click)
     */
    startDrag: handleDotMouseDown,

    /**
     * Check if drag is currently active
     */
    isActive: () => dragState.active,

    /**
     * Get current drag state (read-only copy)
     */
    getState: () => ({ ...dragState }),

    /**
     * Enable/disable drag handler
     */
    setEnabled: (value) => {
      enabled = !!value;
      if (!enabled && dragState.active) {
        resetDragState();
      }
    },

    /**
     * Check if drag handler is enabled
     */
    isEnabled: () => enabled,

    /**
     * Cancel current drag operation
     */
    cancel: () => {
      if (dragState.active) {
        resetDragState();
      }
    },

    /**
     * Clean up event listeners
     */
    destroy: () => {
      resetDragState();
      detachListeners();
    }
  };
}

/**
 * Calculate space index from a pair based on its temporalInterval
 * Space index = pulse (the cell where the note starts)
 *
 * @param {Object} pair - Pair object with pulse and temporalInterval
 * @returns {number} Space index
 */
export function getSpaceIndexFromPair(pair) {
  return pair?.pulse ?? 0;
}

/**
 * Calculate the end space index from a pair
 * End space = pulse + temporalInterval - 1
 *
 * @param {Object} pair - Pair object with pulse and temporalInterval
 * @returns {number} End space index
 */
export function getEndSpaceFromPair(pair) {
  const pulse = pair?.pulse ?? 0;
  const iT = pair?.temporalInterval ?? 1;
  return pulse + iT - 1;
}
