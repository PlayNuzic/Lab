/**
 * plano-selection.js - Cell selection manager for plano-modular
 * Supports monophonic (1 cell per column) and polyphonic (multiple cells) modes
 */

/**
 * Create a selection manager
 * @param {'monophonic' | 'polyphonic' | 'none'} mode - Selection mode
 * @returns {Object} Selection manager API
 */
export function createSelectionManager(mode = 'monophonic') {
  // Map<string, {rowId, colIndex, data}>
  const selected = new Map();

  /**
   * Generate key for cell
   * @param {string} rowId - Row identifier
   * @param {number} colIndex - Column index
   * @returns {string} Unique key
   */
  function getKey(rowId, colIndex) {
    return `${rowId}-${colIndex}`;
  }

  /**
   * Select a cell
   * @param {string} rowId - Row identifier
   * @param {number} colIndex - Column index
   * @param {Object} data - Optional data to store with selection
   * @returns {Array<string>} Keys that were deselected (for monophonic mode)
   */
  function select(rowId, colIndex, data = {}) {
    if (mode === 'none') return [];

    const key = getKey(rowId, colIndex);
    const deselected = [];

    // In monophonic mode, deselect any existing cell in this column
    if (mode === 'monophonic') {
      for (const [existingKey, existingData] of selected.entries()) {
        if (existingData.colIndex === colIndex && existingKey !== key) {
          selected.delete(existingKey);
          deselected.push(existingKey);
        }
      }
    }

    selected.set(key, { rowId, colIndex, ...data });
    return deselected;
  }

  /**
   * Deselect a cell
   * @param {string} rowId - Row identifier
   * @param {number} colIndex - Column index
   * @returns {boolean} True if cell was deselected
   */
  function deselect(rowId, colIndex) {
    const key = getKey(rowId, colIndex);
    return selected.delete(key);
  }

  /**
   * Toggle cell selection
   * @param {string} rowId - Row identifier
   * @param {number} colIndex - Column index
   * @param {Object} data - Optional data for selection
   * @returns {{isSelected: boolean, deselected: Array<string>}}
   */
  function toggle(rowId, colIndex, data = {}) {
    const key = getKey(rowId, colIndex);

    if (selected.has(key)) {
      deselect(rowId, colIndex);
      return { isSelected: false, deselected: [] };
    } else {
      const deselected = select(rowId, colIndex, data);
      return { isSelected: true, deselected };
    }
  }

  /**
   * Clear all selections
   * @returns {Array<string>} Keys that were deselected
   */
  function clear() {
    const keys = [...selected.keys()];
    selected.clear();
    return keys;
  }

  /**
   * Get all selected cells
   * @returns {Map<string, {rowId, colIndex, data}>}
   */
  function getSelected() {
    return new Map(selected);
  }

  /**
   * Get selected cells as array
   * @returns {Array<{rowId, colIndex, data}>}
   */
  function getSelectedArray() {
    return [...selected.values()];
  }

  /**
   * Check if a cell is selected
   * @param {string} rowId - Row identifier
   * @param {number} colIndex - Column index
   * @returns {boolean}
   */
  function isSelected(rowId, colIndex) {
    return selected.has(getKey(rowId, colIndex));
  }

  /**
   * Get selection at column (for monophonic mode)
   * @param {number} colIndex - Column index
   * @returns {Object|null} Selection data or null
   */
  function getAtColumn(colIndex) {
    for (const data of selected.values()) {
      if (data.colIndex === colIndex) {
        return data;
      }
    }
    return null;
  }

  /**
   * Load selections from array of keys
   * @param {Array<string>} keys - Array of "rowId-colIndex" keys
   * @param {Function} dataExtractor - Optional function to extract data from key
   */
  function loadFromKeys(keys, dataExtractor = null) {
    clear();
    for (const key of keys) {
      const parts = key.split('-');
      if (parts.length >= 2) {
        const colIndex = parseInt(parts[parts.length - 1], 10);
        const rowId = parts.slice(0, -1).join('-');
        const data = dataExtractor ? dataExtractor(key) : {};
        selected.set(key, { rowId, colIndex, ...data });
      }
    }
  }

  /**
   * Export selections as array of keys
   * @returns {Array<string>}
   */
  function exportKeys() {
    return [...selected.keys()];
  }

  /**
   * Get selection mode
   * @returns {'monophonic' | 'polyphonic' | 'none'}
   */
  function getMode() {
    return mode;
  }

  /**
   * Get count of selected cells
   * @returns {number}
   */
  function count() {
    return selected.size;
  }

  return {
    select,
    deselect,
    toggle,
    clear,
    getSelected,
    getSelectedArray,
    isSelected,
    getAtColumn,
    loadFromKeys,
    exportKeys,
    getMode,
    count,
    getKey
  };
}
