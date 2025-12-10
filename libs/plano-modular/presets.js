/**
 * presets.js - High-level preset configurations for plano-modular
 *
 * This module provides ready-to-use configurations for common use cases,
 * reducing boilerplate when creating musical grid applications.
 *
 * Main exports:
 * - createPlanoMusical: Generic musical grid with registry support
 * - createApp19Grid: App19-specific configuration with all defaults
 *
 * @module plano-modular/presets
 */

import { createPlanoModular } from './index.js';
import {
  APP19_CONFIG,
  buildRegistryRows,
  calculateNote0RowMap,
  convertToApp19Keys,
  convertFromApp19Keys,
  isBoundaryRow,
  calculateRegistryScrollTop,
  calculateMidi
} from './registry-helpers.js';

/**
 * Create a musical grid with registry-based row building and navigation
 *
 * This is the main high-level API for creating grids that follow the
 * registry pattern (like piano rolls with octaves).
 *
 * @param {Object} config - Configuration object
 * @param {HTMLElement} config.parent - Parent element to render into
 * @param {number} config.columns - Number of columns (pulses)
 * @param {Object} [config.registryConfig] - Registry configuration
 * @param {Array} [config.registryConfig.registries] - Custom registry definitions
 * @param {number} [config.registryConfig.visibleRows=15] - Visible rows
 * @param {Array<number>} [config.registryConfig.selectableRegistries] - Selectable registries
 * @param {Object} [config.cycleConfig] - Cycle display configuration
 * @param {number} [config.cycleConfig.compas] - Pulses per cycle
 * @param {boolean} [config.cycleConfig.showCycle=true] - Show cycle numbers
 * @param {number} [config.bpm=100] - Tempo in BPM
 * @param {'monophonic'|'polyphonic'|'none'} [config.selectionMode='monophonic'] - Selection mode
 * @param {Function} [config.onCellClick] - Cell click callback (rowData, colIndex, isSelected)
 * @param {Function} [config.onSelectionChange] - Selection change callback (selectedCells)
 * @param {boolean} [config.showPlayhead=true] - Show playhead
 * @param {number} [config.playheadOffset=0] - Playhead offset
 * @returns {Object} Extended PlanoModular API with registry helpers
 */
export function createPlanoMusical(config) {
  const {
    parent,
    columns,
    registryConfig = {},
    cycleConfig = {},
    bpm = 100,
    selectionMode = 'monophonic',
    onCellClick,
    onSelectionChange,
    showPlayhead = true,
    playheadOffset = 0
  } = config;

  // Build registry configuration
  const {
    registries = APP19_CONFIG.registries,
    visibleRows = APP19_CONFIG.visibleRows,
    selectableRegistries = APP19_CONFIG.selectableRegistries,
    notesPerRegistry = APP19_CONFIG.notesPerRegistry,
    midiOffset = APP19_CONFIG.midiOffset
  } = registryConfig;

  // Build rows from registry config
  const rows = buildRegistryRows({ registries });

  // Calculate note0RowMap for scroll positioning
  const note0RowMap = calculateNote0RowMap(rows);

  // Track current registry for external controls
  let currentRegistry = selectableRegistries[Math.floor(selectableRegistries.length / 2)];

  // Create the base plano-modular instance
  const plano = createPlanoModular({
    parent,
    rows,
    columns,
    cycleConfig,
    bpm,
    scrollConfig: {
      blockVerticalWheel: true,
      visibleRows,
      visibleColumns: 12,  // 12 columns visible, scroll for more
      note0RowMap
    },
    selectionMode,
    onCellClick: (rowData, colIndex, isSelected) => {
      if (onCellClick) {
        // Enrich with MIDI information
        const enrichedRowData = {
          ...rowData,
          midi: calculateMidi(rowData.data.registry, rowData.data.noteInReg, { notesPerRegistry, midiOffset })
        };
        onCellClick(enrichedRowData, colIndex, isSelected);
      }
    },
    onSelectionChange,
    showPlayhead,
    playheadOffset
  });

  // Extended API
  return {
    // All base API methods
    ...plano,

    // Registry navigation
    /**
     * Get current registry
     * @returns {number} Current registry ID
     */
    getCurrentRegistry() {
      return currentRegistry;
    },

    /**
     * Set current registry and scroll to it
     * @param {number} registryId - Registry to scroll to
     * @param {boolean} [animated=false] - Use animation
     * @returns {Promise} Resolves when scroll completes
     */
    setRegistry(registryId, animated = false) {
      if (!selectableRegistries.includes(registryId)) {
        console.warn(`Registry ${registryId} is not selectable`);
        return Promise.resolve();
      }
      currentRegistry = registryId;
      return plano.scrollToRegistry(registryId, animated);
    },

    /**
     * Navigate to next registry (higher pitch)
     * selectableRegistries is [3, 4, 5] - higher pitch = higher number
     * @param {boolean} [animated=false] - Use animation
     * @returns {Promise} Resolves when scroll completes
     */
    nextRegistry(animated = false) {
      const idx = selectableRegistries.indexOf(currentRegistry);
      if (idx < selectableRegistries.length - 1) {
        return this.setRegistry(selectableRegistries[idx + 1], animated);
      }
      return Promise.resolve();
    },

    /**
     * Navigate to previous registry (lower pitch)
     * selectableRegistries is [3, 4, 5] - lower pitch = lower number
     * @param {boolean} [animated=false] - Use animation
     * @returns {Promise} Resolves when scroll completes
     */
    prevRegistry(animated = false) {
      const idx = selectableRegistries.indexOf(currentRegistry);
      if (idx > 0) {
        return this.setRegistry(selectableRegistries[idx - 1], animated);
      }
      return Promise.resolve();
    },

    /**
     * Get selectable registries
     * @returns {Array<number>} Array of registry IDs
     */
    getSelectableRegistries() {
      return [...selectableRegistries];
    },

    // App19 format helpers
    /**
     * Export selection in App19 key format
     * @returns {Array<string>} Keys in "registry-note-pulse" format
     */
    exportApp19Selection() {
      return convertToApp19Keys(plano.getSelectedCells());
    },

    /**
     * Load selection from App19 key format
     * @param {Array<string>} keys - Keys in "registry-note-pulse" format
     */
    loadApp19Selection(keys) {
      const items = convertFromApp19Keys(keys);
      plano.clearSelection();
      items.forEach(item => {
        plano.selectCell(item.rowId, item.colIndex);
      });
    },

    // MIDI helpers
    /**
     * Get MIDI note for a cell
     * @param {number} registry - Registry number
     * @param {number} noteInReg - Note within registry
     * @returns {number} MIDI note number
     */
    getMidi(registry, noteInReg) {
      return calculateMidi(registry, noteInReg, { notesPerRegistry, midiOffset });
    },

    /**
     * Get MIDI notes for all selected cells
     * @returns {Map<number, number>} Map of pulse index to MIDI note
     */
    getSelectedMidiNotes() {
      const selected = plano.getSelectedCells();
      const midiMap = new Map();

      selected.forEach((value, key) => {
        if (value && value.row) {
          const { registry, noteInReg } = value.row;
          const midi = calculateMidi(registry, noteInReg, { notesPerRegistry, midiOffset });
          midiMap.set(value.col, midi);
        } else {
          // Parse from key
          const match = key.match(/^(\d+)r(\d+)-(\d+)$/);
          if (match) {
            const [, note, reg, pulse] = match.map(Number);
            const midi = calculateMidi(reg, note, { notesPerRegistry, midiOffset });
            midiMap.set(pulse, midi);
          }
        }
      });

      return midiMap;
    },

    // Configuration access
    /**
     * Get the note0RowMap for external use
     * @returns {Object} Map of registry to row index
     */
    getNote0RowMap() {
      return { ...note0RowMap };
    },

    /**
     * Get rows configuration
     * @returns {Array} Row definitions
     */
    getRowDefinitions() {
      return plano.getRows();
    },

    /**
     * Get registry configuration
     * @returns {Object} Registry config
     */
    getRegistryConfig() {
      return {
        registries,
        visibleRows,
        selectableRegistries,
        notesPerRegistry,
        midiOffset
      };
    }
  };
}

/**
 * Create an App19-specific grid with all defaults preconfigured
 *
 * This is the "out of the box" function for creating grids exactly like App19.
 * It handles:
 * - 39 rows (r5: 0-7, r4: 0-11, r3: 0-11, r2: 5-11)
 * - 15 visible rows with blocked vertical scroll
 * - Registry navigation (3, 4, 5)
 * - Monophonic selection (1 note per pulse)
 * - Soundline, timeline, matrix, playhead
 *
 * @param {Object} config - Configuration object
 * @param {HTMLElement} config.parent - Parent element to render into
 * @param {number} config.columns - Number of columns (totalPulses)
 * @param {Object} [config.cycleConfig] - Cycle configuration
 * @param {number} [config.cycleConfig.compas] - Pulses per cycle
 * @param {boolean} [config.cycleConfig.showCycle=true] - Show cycle numbers
 * @param {number} [config.bpm=100] - Initial BPM
 * @param {Function} [config.onCellClick] - Cell click callback
 * @param {Function} [config.onSelectionChange] - Selection change callback
 * @param {number} [config.defaultRegistry=4] - Default registry to scroll to
 * @returns {Object} Extended PlanoModular API
 *
 * @example
 * const grid = createApp19Grid({
 *   parent: document.getElementById('gridContainer'),
 *   columns: 16,
 *   cycleConfig: { compas: 4 },
 *   bpm: 100,
 *   onCellClick: (rowData, colIndex, isSelected) => {
 *     console.log('Clicked:', rowData.label, 'at pulse', colIndex);
 *     if (isSelected) {
 *       playNote(rowData.midi, 0.3);
 *     }
 *   }
 * });
 *
 * // Load saved selection
 * grid.loadApp19Selection(savedKeys);
 *
 * // Navigate registry
 * grid.setRegistry(5);
 *
 * // Export for saving
 * const keys = grid.exportApp19Selection();
 */
export function createApp19Grid(config) {
  const {
    parent,
    columns,
    cycleConfig = {},
    bpm = 100,
    onCellClick,
    onSelectionChange,
    defaultRegistry = 4
  } = config;

  // Create with App19 defaults
  const grid = createPlanoMusical({
    parent,
    columns,
    registryConfig: {
      registries: APP19_CONFIG.registries,
      visibleRows: APP19_CONFIG.visibleRows,
      selectableRegistries: APP19_CONFIG.selectableRegistries,
      notesPerRegistry: APP19_CONFIG.notesPerRegistry,
      midiOffset: APP19_CONFIG.midiOffset
    },
    cycleConfig,
    bpm,
    selectionMode: 'monophonic',
    onCellClick,
    onSelectionChange,
    showPlayhead: true
  });

  // Scroll to default registry after creation
  // Use requestAnimationFrame inside setTimeout to ensure DOM is fully rendered
  // This is necessary because the grid elements need to be in the DOM before scrollTop works
  setTimeout(() => {
    requestAnimationFrame(() => {
      grid.setRegistry(defaultRegistry, false);
    });
  }, 0);

  return grid;
}

/**
 * Create a simple grid without registry features
 *
 * For use cases that don't need the registry/octave pattern.
 * Just a basic 2D grid with configurable rows.
 *
 * @param {Object} config - Configuration object
 * @param {HTMLElement} config.parent - Parent element
 * @param {number} config.rows - Number of rows
 * @param {number} config.columns - Number of columns
 * @param {Function} [config.rowLabelFormatter] - Format row label (rowIndex) => string
 * @param {Object} [config.cycleConfig] - Cycle configuration
 * @param {'monophonic'|'polyphonic'|'none'} [config.selectionMode='none'] - Selection mode
 * @param {Function} [config.onCellClick] - Cell click callback
 * @returns {Object} PlanoModular API
 */
export function createSimpleGrid(config) {
  const {
    parent,
    rows: rowCount,
    columns,
    rowLabelFormatter = (i) => String(i),
    cycleConfig = {},
    selectionMode = 'none',
    onCellClick,
    onSelectionChange,
    showPlayhead = false
  } = config;

  // Build simple rows
  const rows = [];
  for (let i = 0; i < rowCount; i++) {
    rows.push({
      id: `row-${i}`,
      label: rowLabelFormatter(i),
      data: { index: i }
    });
  }

  return createPlanoModular({
    parent,
    rows,
    columns,
    cycleConfig,
    scrollConfig: {
      blockVerticalWheel: false,
      visibleRows: rowCount
    },
    selectionMode,
    onCellClick,
    onSelectionChange,
    showPlayhead
  });
}

/**
 * Preset configurations for common use cases
 */
export const PRESETS = {
  /**
   * App19 default preset
   */
  APP19: {
    registries: APP19_CONFIG.registries,
    visibleRows: 15,
    selectableRegistries: [3, 4, 5],
    selectionMode: 'monophonic',
    blockVerticalWheel: true
  },

  /**
   * Full piano roll (all notes visible)
   */
  PIANO_ROLL: {
    registries: [
      { id: 5, notes: { from: 11, to: 0 } },
      { id: 4, notes: { from: 11, to: 0 } },
      { id: 3, notes: { from: 11, to: 0 } },
      { id: 2, notes: { from: 11, to: 0 } }
    ],
    visibleRows: 24,
    selectableRegistries: [2, 3, 4, 5],
    selectionMode: 'polyphonic',
    blockVerticalWheel: false
  },

  /**
   * Single octave (12 notes)
   */
  SINGLE_OCTAVE: {
    registries: [
      { id: 4, notes: { from: 11, to: 0 } }
    ],
    visibleRows: 12,
    selectableRegistries: [4],
    selectionMode: 'monophonic',
    blockVerticalWheel: false
  }
};
