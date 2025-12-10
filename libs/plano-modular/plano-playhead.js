/**
 * plano-playhead.js - Playhead positioning and visibility for plano-modular
 * Manages the vertical indicator line during playback
 */

/**
 * Create a playhead element inside the matrix
 * @param {HTMLElement} container - Matrix container element (will find .plano-matrix inside)
 * @returns {HTMLElement} The created playhead element
 */
export function createPlayhead(container) {
  if (!container) return null;

  // Find the actual matrix grid (has position: relative in CSS)
  // This handles both: passing the container or passing the matrix directly
  const matrix = container.querySelector('.plano-matrix') || container;

  // Check if playhead already exists
  let playhead = matrix.querySelector('.plano-playhead');
  if (playhead) return playhead;

  playhead = document.createElement('div');
  playhead.className = 'plano-playhead plano-playhead--hidden';
  playhead.style.marginLeft = '-4px';  // Align with timeline numbers

  // matrix already has position: relative from CSS (.plano-matrix)
  matrix.appendChild(playhead);
  return playhead;
}

/**
 * Update playhead position
 * @param {HTMLElement} playhead - Playhead element
 * @param {number} colIndex - Current column index
 * @param {number} cellWidth - Width of each cell
 * @param {number} offset - Optional horizontal offset (default 0)
 */
export function updatePlayhead(playhead, colIndex, cellWidth, offset = 0) {
  if (!playhead) return;

  const leftPosition = (colIndex * cellWidth) + offset;
  playhead.style.left = `${leftPosition}px`;
  playhead.classList.remove('plano-playhead--hidden');
}

/**
 * Hide the playhead
 * @param {HTMLElement} playhead - Playhead element
 */
export function hidePlayhead(playhead) {
  if (!playhead) return;
  playhead.classList.add('plano-playhead--hidden');
}

/**
 * Show the playhead
 * @param {HTMLElement} playhead - Playhead element
 */
export function showPlayhead(playhead) {
  if (!playhead) return;
  playhead.classList.remove('plano-playhead--hidden');
}

/**
 * Remove playhead from DOM
 * @param {HTMLElement} playhead - Playhead element
 */
export function removePlayhead(playhead) {
  if (playhead && playhead.parentNode) {
    playhead.parentNode.removeChild(playhead);
  }
}

/**
 * Create a playhead controller with bound state
 * @param {HTMLElement} matrix - Matrix container element
 * @param {Function} getCellWidth - Function to get current cell width
 * @param {number} offset - Horizontal offset for playhead alignment
 * @returns {Object} Playhead controller API
 */
export function createPlayheadController(matrix, getCellWidth, offset = 0) {
  const playhead = createPlayhead(matrix);
  let currentCol = -1;
  let isVisible = false;

  return {
    /**
     * Update playhead to a specific column
     * @param {number} colIndex - Column index
     */
    update(colIndex) {
      if (!playhead) return;
      currentCol = colIndex;
      const cellWidth = typeof getCellWidth === 'function' ? getCellWidth() : getCellWidth;
      updatePlayhead(playhead, colIndex, cellWidth, offset);
      isVisible = true;
    },

    /**
     * Hide the playhead
     */
    hide() {
      hidePlayhead(playhead);
      isVisible = false;
      currentCol = -1;
    },

    /**
     * Show the playhead at last known position
     */
    show() {
      if (currentCol >= 0) {
        showPlayhead(playhead);
        isVisible = true;
      }
    },

    /**
     * Check if playhead is visible
     * @returns {boolean}
     */
    isVisible() {
      return isVisible;
    },

    /**
     * Get current column
     * @returns {number}
     */
    getCurrentColumn() {
      return currentCol;
    },

    /**
     * Get playhead element
     * @returns {HTMLElement}
     */
    getElement() {
      return playhead;
    },

    /**
     * Destroy playhead and cleanup
     */
    destroy() {
      removePlayhead(playhead);
      currentCol = -1;
      isVisible = false;
    }
  };
}
