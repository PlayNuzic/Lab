/**
 * plano-modular - Reusable 2D grid module for musical applications
 *
 * Features:
 * - Grid 2D with soundline (Y) + timeline (X) + matrix
 * - Vertical scroll blocked for user, controllable programmatically
 * - Horizontal scroll free
 * - Synchronized playhead
 * - Cell selection (monophonic/polyphonic)
 *
 * @module plano-modular
 */

import {
  buildGridDOM,
  updateSoundline,
  updateMatrix,
  updateTimeline,
  updateCellSelection,
  highlightCell,
  highlightTimelineNumber,
  clearCellHighlights,
  getCellWidth,
  getCellHeight
} from './plano-grid.js';

import {
  setupScrollSync,
  blockVerticalWheel,
  scrollToRow,
  scrollToColumn,
  scrollToRegistry,
  smoothScrollTo
} from './plano-scroll.js';

import { createSelectionManager } from './plano-selection.js';

import { createPlayheadController } from './plano-playhead.js';

/**
 * Create a PlanoModular instance
 * @param {Object} config - Configuration object
 * @param {HTMLElement} config.parent - Parent element to render into
 * @param {Array<{id, label, data}>} [config.rows] - Row definitions
 * @param {Function} [config.buildRows] - Function to build rows dynamically
 * @param {number} config.columns - Number of columns (pulses)
 * @param {Object} [config.cycleConfig] - Cycle configuration
 * @param {number} [config.cycleConfig.compas=4] - Pulses per cycle
 * @param {boolean} [config.cycleConfig.showCycle=true] - Show cycle superscript
 * @param {number} [config.bpm=100] - Tempo in BPM
 * @param {Object} [config.scrollConfig] - Scroll configuration
 * @param {boolean} [config.scrollConfig.blockVerticalWheel=true] - Block vertical wheel scroll
 * @param {number} [config.scrollConfig.visibleRows=15] - Number of visible rows
 * @param {Object} [config.scrollConfig.note0RowMap] - Map of registry to row index
 * @param {'monophonic'|'polyphonic'|'none'} [config.selectionMode='monophonic'] - Selection mode
 * @param {Function} [config.onCellClick] - Cell click callback (rowData, colIndex, isSelected)
 * @param {Function} [config.onSelectionChange] - Selection change callback (selectedCells)
 * @param {boolean} [config.showPlayhead=true] - Whether to show playhead
 * @param {number} [config.playheadOffset=0] - Horizontal offset for playhead alignment
 * @returns {Object} PlanoModular API
 */
export function createPlanoModular(config) {
  const {
    parent,
    rows: initialRows,
    buildRows,
    columns: initialColumns,
    cycleConfig: initialCycleConfig = {},
    bpm: initialBpm = 100,
    scrollConfig = {},
    selectionMode = 'monophonic',
    onCellClick,
    onSelectionChange,
    showPlayhead = true,
    playheadOffset = 0
  } = config;

  // State
  let rows = initialRows || (buildRows ? buildRows() : []);
  let columns = initialColumns;
  let cycleConfig = { compas: 4, showCycle: true, ...initialCycleConfig };
  let bpm = initialBpm;
  let isDestroyed = false;

  // Scroll config
  const {
    blockVerticalWheel: shouldBlockWheel = true,
    visibleRows = 15,
    visibleColumns = 12,
    note0RowMap = {}
  } = scrollConfig;

  // Dynamic cell width calculation based on visible columns
  function getCellWidthDynamic() {
    if (!matrixContainer) return 50;
    const containerWidth = matrixContainer.clientWidth;
    if (containerWidth <= 0) return 50;
    return Math.floor(containerWidth / visibleColumns);
  }

  // Build DOM
  const elements = buildGridDOM(parent);
  if (!elements) {
    throw new Error('PlanoModular: Failed to build grid DOM');
  }

  const {
    container,
    soundlineContainer,
    matrixContainer,
    timelineContainer
  } = elements;

  // Initialize selection manager
  const selectionManager = createSelectionManager(selectionMode);

  // Playhead controller will be initialized AFTER refresh() creates .plano-matrix
  let playheadController = null;

  // Cleanup functions
  const cleanupFunctions = [];

  // Setup scroll sync
  const cleanupScrollSync = setupScrollSync(matrixContainer, soundlineContainer, timelineContainer);
  cleanupFunctions.push(cleanupScrollSync);

  // Block vertical wheel if configured
  if (shouldBlockWheel) {
    const cleanupWheelBlock = blockVerticalWheel(matrixContainer, soundlineContainer);
    cleanupFunctions.push(cleanupWheelBlock);
  }

  /**
   * Handle cell click
   * @param {Object} rowData - Row data
   * @param {number} colIndex - Column index
   * @param {HTMLElement} cellEl - Cell element
   */
  function handleCellClick(rowData, colIndex, cellEl) {
    if (selectionMode === 'none') {
      if (onCellClick) {
        onCellClick(rowData, colIndex, false);
      }
      return;
    }

    const { isSelected, deselected } = selectionManager.toggle(rowData.id, colIndex, rowData.data);

    // Options with compas for modular pulse calculation
    const selectionOptions = { compas: cycleConfig.compas };

    // Update visual state for toggled cell
    updateCellSelection(matrixContainer, rowData.id, colIndex, isSelected, rowData.label, selectionOptions);

    // Update visual state for deselected cells (monophonic mode)
    for (const key of deselected) {
      const [rowId, col] = [key.split('-').slice(0, -1).join('-'), parseInt(key.split('-').pop(), 10)];
      updateCellSelection(matrixContainer, rowId, col, false, '', selectionOptions);
    }

    // Callbacks
    if (onCellClick) {
      onCellClick(rowData, colIndex, isSelected);
    }

    if (onSelectionChange) {
      onSelectionChange(selectionManager.getSelected());
    }
  }

  /**
   * Refresh the entire grid
   */
  function refresh() {
    if (isDestroyed) return;

    const cellWidth = getCellWidthDynamic();

    // Update soundline
    updateSoundline(soundlineContainer, rows, {
      onBoundary: (row) => row.data && row.data.note === 0
    });

    // Update matrix
    updateMatrix(matrixContainer, rows, columns, {
      cellWidth,
      isSelected: (rowId, colIndex) => selectionManager.isSelected(rowId, colIndex),
      cellFormatter: (row) => row.label,
      onCellClick: handleCellClick
    });

    // Update timeline
    updateTimeline(timelineContainer, columns, {
      cellWidth,
      cycleConfig
    });
  }

  // Initial render - creates .plano-matrix
  refresh();

  // Initialize playhead controller AFTER refresh() creates .plano-matrix
  // This ensures .plano-matrix exists and has position: relative
  if (showPlayhead) {
    playheadController = createPlayheadController(
      matrixContainer,
      getCellWidthDynamic,
      playheadOffset
    );
  }

  // Public API
  return {
    // Configuration updates
    updateColumns(newColumns) {
      columns = newColumns;
      refresh();
    },

    updateRows(newRows) {
      rows = newRows;
      refresh();
    },

    setBpm(newBpm) {
      bpm = newBpm;
    },

    getBpm() {
      return bpm;
    },

    setCompas(newCompas) {
      cycleConfig.compas = newCompas;
      refresh();
    },

    getCompas() {
      return cycleConfig.compas;
    },

    refresh,

    // Selection API
    selectCell(rowId, colIndex) {
      const selectionOptions = { compas: cycleConfig.compas };
      const deselected = selectionManager.select(rowId, colIndex);
      updateCellSelection(matrixContainer, rowId, colIndex, true, '', selectionOptions);
      for (const key of deselected) {
        const parts = key.split('-');
        const col = parseInt(parts.pop(), 10);
        const rId = parts.join('-');
        updateCellSelection(matrixContainer, rId, col, false, '', selectionOptions);
      }
      if (onSelectionChange) {
        onSelectionChange(selectionManager.getSelected());
      }
    },

    deselectCell(rowId, colIndex) {
      const selectionOptions = { compas: cycleConfig.compas };
      selectionManager.deselect(rowId, colIndex);
      updateCellSelection(matrixContainer, rowId, colIndex, false, '', selectionOptions);
      if (onSelectionChange) {
        onSelectionChange(selectionManager.getSelected());
      }
    },

    clearSelection() {
      const selectionOptions = { compas: cycleConfig.compas };
      const cleared = selectionManager.clear();
      for (const key of cleared) {
        const parts = key.split('-');
        const col = parseInt(parts.pop(), 10);
        const rId = parts.join('-');
        updateCellSelection(matrixContainer, rId, col, false, '', selectionOptions);
      }
      if (onSelectionChange) {
        onSelectionChange(selectionManager.getSelected());
      }
    },

    getSelectedCells() {
      return selectionManager.getSelected();
    },

    getSelectedArray() {
      return selectionManager.getSelectedArray();
    },

    isSelected(rowId, colIndex) {
      return selectionManager.isSelected(rowId, colIndex);
    },

    loadSelection(keys) {
      selectionManager.loadFromKeys(keys);
      refresh();
    },

    exportSelection() {
      return selectionManager.exportKeys();
    },

    // Scroll API
    scrollToRow(rowIndex, animated = false) {
      const cellHeight = getCellHeight(container);
      return Promise.all([
        scrollToRow(matrixContainer, rowIndex, cellHeight, visibleRows, animated),
        scrollToRow(soundlineContainer, rowIndex, cellHeight, visibleRows, animated)
      ]);
    },

    scrollToColumn(colIndex, animated = false) {
      const cellWidth = getCellWidthDynamic();
      return Promise.all([
        scrollToColumn(matrixContainer, colIndex, cellWidth, animated),
        scrollToColumn(timelineContainer, colIndex, cellWidth, animated)
      ]);
    },

    scrollToRegistry(registryId, animated = false) {
      const cellHeight = getCellHeight(container);
      return Promise.all([
        scrollToRegistry(matrixContainer, registryId, note0RowMap, cellHeight, visibleRows, animated),
        scrollToRegistry(soundlineContainer, registryId, note0RowMap, cellHeight, visibleRows, animated)
      ]);
    },

    // Playhead API
    updatePlayhead(colIndex) {
      if (playheadController) {
        playheadController.update(colIndex);
      }
    },

    hidePlayhead() {
      if (playheadController) {
        playheadController.hide();
      }
    },

    isPlayheadVisible() {
      return playheadController ? playheadController.isVisible() : false;
    },

    // Highlight API (for playback)
    highlightCell(rowId, colIndex, duration = 0, options = {}) {
      // Include cycleConfig.compas for modular pulse calculation
      const highlightOptions = {
        compas: cycleConfig.compas,
        ...options
      };
      return highlightCell(matrixContainer, rowId, colIndex, duration, highlightOptions);
    },

    highlightTimelineNumber(colIndex, duration = 0) {
      return highlightTimelineNumber(timelineContainer, colIndex, duration);
    },

    clearHighlights() {
      clearCellHighlights(matrixContainer);
      clearCellHighlights(timelineContainer);
    },

    // Element access
    getContainer() {
      return container;
    },

    getElements() {
      return elements;
    },

    // Utilities
    getCellWidth() {
      return getCellWidthDynamic();
    },

    getCellHeight() {
      return getCellHeight(container);
    },

    getRows() {
      return rows;
    },

    getColumns() {
      return columns;
    },

    // Destructor
    destroy() {
      if (isDestroyed) return;

      isDestroyed = true;

      // Run cleanup functions
      for (const cleanup of cleanupFunctions) {
        cleanup();
      }

      // Destroy playhead
      if (playheadController) {
        playheadController.destroy();
      }

      // Clear selection
      selectionManager.clear();

      // Remove DOM
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }
  };
}

// Re-export submodules for advanced usage
export { createSelectionManager } from './plano-selection.js';
export { setupScrollSync, blockVerticalWheel, smoothScrollTo, scrollToRegistry } from './plano-scroll.js';
export { createPlayheadController, updatePlayhead, hidePlayhead } from './plano-playhead.js';
export {
  buildGridDOM,
  updateSoundline,
  updateMatrix,
  updateTimeline,
  updateCellSelection,
  highlightCell,
  getCellWidth,
  getCellHeight
} from './plano-grid.js';

// High-level presets (out of the box)
export {
  createPlanoMusical,
  createApp19Grid,
  createSimpleGrid,
  PRESETS
} from './presets.js';

// Registry helpers
export {
  APP19_CONFIG,
  buildRegistryRows,
  calculateNote0RowMap,
  getApp19DefaultConfig,
  convertToApp19Keys,
  convertFromApp19Keys,
  createApp19Key,
  parseApp19Key,
  createRowId,
  parseRowId,
  calculateMidi,
  calculateRegistryScrollTop,
  buildSimpleRegistryRows,
  isBoundaryRow,
  getVisibleRegistries
} from './registry-helpers.js';
