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
 * @param {number} domOffset - Extra offset applied ONLY in DOM-based mode
 *   (`cellWidth = 0`, i.e. 1fr columns). Defaults to 7 for retro-compat
 *   with App19/App20 which depend on this legacy offset. Apps that align
 *   the playhead with cell.offsetLeft (e.g. App32+) should pass 0 to
 *   `createPlayheadController`.
 */
// LP-04: cache cel·la-per-columna en mode DOM — l'attribute-selector
// escanejava TOTES les cel·les (milers als grids de registre) a cada pas
// de playback. La cel·la cachejada es revalida amb isConnected: quan
// updateMatrix reconstrueix el grid, les velles queden desconnectades i
// es re-consulta una sola vegada per columna.
const cellCacheByMatrix = new WeakMap();

function getColumnCell(matrix, colIndex) {
  let cache = cellCacheByMatrix.get(matrix);
  if (!cache) {
    cache = new Map();
    cellCacheByMatrix.set(matrix, cache);
  }
  let cell = cache.get(colIndex);
  if (!cell || !cell.isConnected) {
    cell = matrix.querySelector(`.plano-cell[data-col-index="${colIndex}"]`);
    if (cell) cache.set(colIndex, cell);
    else cache.delete(colIndex);
  }
  return cell;
}

export function updatePlayhead(playhead, colIndex, cellWidth, offset = 0, domOffset = 7) {
  if (!playhead) return;

  // When cellWidth is falsy (0 or null), use DOM-based positioning for flexible layouts (1fr columns)
  if (!cellWidth) {
    const matrix = playhead.closest('.plano-matrix') || playhead.parentElement;
    if (matrix) {
      const cell = getColumnCell(matrix, colIndex);
      if (cell) {
        playhead.style.left = `${cell.offsetLeft + offset + domOffset}px`;
        playhead.classList.remove('plano-playhead--hidden');
        return;
      }
    }
  }

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
 * @param {number} domOffset - Extra offset for DOM-based mode (default 7
 *   per retro-compat amb App19/App20; passar 0 a apps que volen el
 *   playhead exactament a `cell.offsetLeft`).
 * @returns {Object} Playhead controller API
 */
export function createPlayheadController(matrix, getCellWidth, offset = 0, domOffset = 7) {
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
      updatePlayhead(playhead, colIndex, cellWidth, offset, domOffset);
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
