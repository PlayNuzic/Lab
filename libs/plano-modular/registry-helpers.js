/**
 * registry-helpers.js - Registry row building and navigation helpers for plano-modular
 *
 * This module provides functions to build rows for musical grid applications
 * that use registries (octaves) with selectable notes. It includes:
 * - Row building with configurable registry ranges
 * - note0RowMap calculation for scroll positioning
 * - Key format conversion utilities
 * - Default configurations for common use cases
 *
 * @module plano-modular/registry-helpers
 */

/**
 * Default configuration for App19-style grids
 * @type {Object}
 */
export const APP19_CONFIG = {
  // Registry definitions (from highest to lowest)
  registries: [
    { id: 5, notes: { from: 7, to: 0 } },   // r5: notes 7-0 (8 notes)
    { id: 4, notes: { from: 11, to: 0 } },  // r4: notes 11-0 (12 notes)
    { id: 3, notes: { from: 11, to: 0 } },  // r3: notes 11-0 (12 notes)
    { id: 2, notes: { from: 11, to: 5 } }   // r2: notes 11-5 (7 notes for padding)
  ],

  // Scroll configuration
  visibleRows: 15,

  // Selectable registries (external registry selector)
  selectableRegistries: [3, 4, 5],

  // MIDI calculation
  notesPerRegistry: 12,
  midiOffset: 12
};

/**
 * Build row definitions for a musical grid based on registry configuration
 *
 * Each row represents a note in a registry, ordered from highest to lowest pitch.
 * This is the standard layout for piano-roll style grids.
 *
 * @param {Object} config - Configuration object
 * @param {Array<{id: number, notes: {from: number, to: number}}>} config.registries - Registry definitions
 * @returns {Array<{id: string, label: string, data: {registry: number, note: number, noteInReg: number}}>}
 *
 * @example
 * const rows = buildRegistryRows({
 *   registries: [
 *     { id: 5, notes: { from: 7, to: 0 } },
 *     { id: 4, notes: { from: 11, to: 0 } }
 *   ]
 * });
 * // Returns 20 rows: 8 from r5 + 12 from r4
 */
export function buildRegistryRows(config = {}) {
  const { registries = APP19_CONFIG.registries } = config;
  const rows = [];

  for (const registry of registries) {
    const { id, notes } = registry;
    const { from, to } = notes;

    // Iterate from highest note to lowest (descending order for visual layout)
    for (let note = from; note >= to; note--) {
      rows.push({
        id: `${note}r${id}`,
        label: `${note}r${id}`,
        data: {
          registry: id,
          note: note,
          noteInReg: note  // Alias for compatibility
        }
      });
    }
  }

  return rows;
}

/**
 * Calculate the note0RowMap for scroll positioning
 *
 * The note0RowMap maps each registry ID to the row index of note 0 in that registry.
 * This is used for centering the view on a specific registry.
 *
 * @param {Array<{id: string, data: {registry: number, note: number}}>} rows - Row definitions from buildRegistryRows
 * @returns {Object<number, number>} Map of registry ID to row index of note 0
 *
 * @example
 * const rows = buildRegistryRows();
 * const note0RowMap = calculateNote0RowMap(rows);
 * // Returns: { 5: 7, 4: 19, 3: 31 } for App19 default config
 */
export function calculateNote0RowMap(rows) {
  const map = {};

  rows.forEach((row, index) => {
    if (row.data && row.data.note === 0) {
      map[row.data.registry] = index;
    }
  });

  return map;
}

/**
 * Get App19 default configuration
 * Returns the standard App19 grid configuration with 39 rows.
 *
 * @returns {Object} Configuration object ready for createPlanoMusical
 */
export function getApp19DefaultConfig() {
  return {
    registries: APP19_CONFIG.registries,
    visibleRows: APP19_CONFIG.visibleRows,
    selectableRegistries: APP19_CONFIG.selectableRegistries,
    notesPerRegistry: APP19_CONFIG.notesPerRegistry,
    midiOffset: APP19_CONFIG.midiOffset
  };
}

/**
 * Convert module's selected cells Map to App19 key format array
 *
 * The module uses Map with keys like "7r5-0" (rowId-colIndex).
 * App19 uses keys like "5-7-0" (registry-noteInReg-pulseIndex).
 *
 * @param {Map<string, Object>} selectedMap - Module's selection Map
 * @returns {Array<string>} Array of App19 format keys
 *
 * @example
 * const moduleSelected = new Map([
 *   ['7r5-0', { row: { registry: 5, noteInReg: 7 }, col: 0 }],
 *   ['4r4-3', { row: { registry: 4, noteInReg: 4 }, col: 3 }]
 * ]);
 * const app19Keys = convertToApp19Keys(moduleSelected);
 * // Returns: ['5-7-0', '4-4-3']
 */
export function convertToApp19Keys(selectedMap) {
  const keys = [];

  selectedMap.forEach((value, key) => {
    // Parse the key format: "NrR-P" where N=note, R=registry, P=pulse
    const match = key.match(/^(\d+)r(\d+)-(\d+)$/);
    if (match) {
      const [, note, registry, pulse] = match;
      keys.push(`${registry}-${note}-${pulse}`);
    } else if (value && value.row && value.row.registry !== undefined) {
      // Fallback: use value's row data
      const { registry, noteInReg } = value.row;
      const col = value.col;
      keys.push(`${registry}-${noteInReg}-${col}`);
    }
  });

  return keys;
}

/**
 * Convert App19 key format array to module's selection format
 *
 * @param {Array<string>} app19Keys - Array of App19 format keys (registry-note-pulse)
 * @returns {Array<{rowId: string, colIndex: number, data: {registry: number, noteInReg: number}}>}
 *
 * @example
 * const app19Keys = ['5-7-0', '4-4-3'];
 * const moduleFormat = convertFromApp19Keys(app19Keys);
 * // Returns: [
 * //   { rowId: '7r5', colIndex: 0, data: { registry: 5, noteInReg: 7 } },
 * //   { rowId: '4r4', colIndex: 3, data: { registry: 4, noteInReg: 4 } }
 * // ]
 */
export function convertFromApp19Keys(app19Keys) {
  return app19Keys
    .map(key => {
      const parts = key.split('-');
      if (parts.length !== 3) return null;

      const [registry, noteInReg, pulse] = parts.map(Number);
      if (isNaN(registry) || isNaN(noteInReg) || isNaN(pulse)) return null;

      return {
        rowId: `${noteInReg}r${registry}`,
        colIndex: pulse,
        data: {
          registry,
          noteInReg
        }
      };
    })
    .filter(Boolean);
}

/**
 * Create a cell key in App19 format
 *
 * @param {number} registry - Registry number
 * @param {number} noteInReg - Note index within registry
 * @param {number} pulseIndex - Pulse/column index
 * @returns {string} Key in format "registry-note-pulse"
 */
export function createApp19Key(registry, noteInReg, pulseIndex) {
  return `${registry}-${noteInReg}-${pulseIndex}`;
}

/**
 * Parse an App19 format key
 *
 * @param {string} key - Key in format "registry-note-pulse"
 * @returns {{registry: number, noteInReg: number, pulseIndex: number}|null}
 */
export function parseApp19Key(key) {
  const parts = key.split('-');
  if (parts.length !== 3) return null;

  const [registry, noteInReg, pulseIndex] = parts.map(Number);
  if (isNaN(registry) || isNaN(noteInReg) || isNaN(pulseIndex)) return null;

  return { registry, noteInReg, pulseIndex };
}

/**
 * Create a row ID in module format
 *
 * @param {number} noteInReg - Note index within registry
 * @param {number} registry - Registry number
 * @returns {string} Row ID in format "NrR"
 */
export function createRowId(noteInReg, registry) {
  return `${noteInReg}r${registry}`;
}

/**
 * Parse a row ID in module format
 *
 * @param {string} rowId - Row ID in format "NrR"
 * @returns {{noteInReg: number, registry: number}|null}
 */
export function parseRowId(rowId) {
  const match = rowId.match(/^(\d+)r(\d+)$/);
  if (!match) return null;

  const [, note, registry] = match;
  return {
    noteInReg: parseInt(note, 10),
    registry: parseInt(registry, 10)
  };
}

/**
 * Calculate MIDI note number from registry and note
 *
 * @param {number} registry - Registry number
 * @param {number} noteInReg - Note index within registry
 * @param {Object} config - Configuration with notesPerRegistry and midiOffset
 * @returns {number} MIDI note number
 */
export function calculateMidi(registry, noteInReg, config = {}) {
  const { notesPerRegistry = 12, midiOffset = 12 } = config;
  return registry * notesPerRegistry + noteInReg + midiOffset;
}

/**
 * Calculate the scroll target for centering a registry
 *
 * @param {number} registryId - Registry to center on
 * @param {Object} note0RowMap - Map of registry to note 0 row index
 * @param {number} cellHeight - Height of each cell in pixels
 * @param {number} visibleRows - Number of visible rows (default: 15)
 * @returns {number} Target scrollTop value
 */
export function calculateRegistryScrollTop(registryId, note0RowMap, cellHeight, visibleRows = 15) {
  const note0Row = note0RowMap[registryId];
  if (note0Row === undefined) return 0;

  const centerOffset = Math.floor(visibleRows / 2);
  return Math.max(0, (note0Row - centerOffset) * cellHeight);
}

/**
 * Build rows for a simple registry configuration (all notes from 11-0)
 *
 * @param {Object} config - Configuration
 * @param {number} config.minRegistry - Minimum registry (default: 3)
 * @param {number} config.maxRegistry - Maximum registry (default: 5)
 * @param {number} config.notesPerRegistry - Notes per registry (default: 12)
 * @returns {Array<{id, label, data}>} Row definitions
 */
export function buildSimpleRegistryRows(config = {}) {
  const {
    minRegistry = 3,
    maxRegistry = 5,
    notesPerRegistry = 12
  } = config;

  const registries = [];

  // Build from highest to lowest registry
  for (let reg = maxRegistry; reg >= minRegistry; reg--) {
    registries.push({
      id: reg,
      notes: { from: notesPerRegistry - 1, to: 0 }
    });
  }

  return buildRegistryRows({ registries });
}

/**
 * Check if a row is a boundary (note 0 of its registry)
 *
 * @param {Object} row - Row object with data.note or data.noteInReg
 * @returns {boolean} True if row is note 0
 */
export function isBoundaryRow(row) {
  if (!row || !row.data) return false;
  const note = row.data.note ?? row.data.noteInReg;
  return note === 0;
}

/**
 * Get the visible registries for a cell given the current scroll position
 * (Utility for advanced playback features like App19's registry switching)
 *
 * @param {number} noteInReg - Note within registry
 * @param {number} registry - Registry number
 * @param {Object} config - Configuration
 * @param {number} config.minRegistry - Minimum selectable registry
 * @param {number} config.maxRegistry - Maximum selectable registry
 * @param {number} config.visibleRows - Number of visible rows
 * @param {number} config.notesPerRegistry - Notes per registry
 * @returns {Array<number>} Array of registry IDs where this note would be visible
 */
export function getVisibleRegistries(noteInReg, registry, config = {}) {
  const {
    minRegistry = 3,
    maxRegistry = 5,
    visibleRows = 15,
    notesPerRegistry = 12
  } = config;

  const visibleIn = [];
  const zeroPos = Math.floor(visibleRows / 2); // Center position (7 for 15 visible)

  // Check each selectable registry
  for (let testReg = minRegistry; testReg <= maxRegistry; testReg++) {
    // For each visual position, check if it would show our note
    for (let visualIdx = 0; visualIdx < visibleRows; visualIdx++) {
      const offset = visualIdx - zeroPos;
      let checkNote, checkReg;

      if (offset < 0) {
        const absOffset = Math.abs(offset);
        checkNote = (notesPerRegistry - absOffset % notesPerRegistry) % notesPerRegistry;
        checkReg = testReg - Math.ceil(absOffset / notesPerRegistry);
        if (absOffset % notesPerRegistry === 0) {
          checkNote = 0;
          checkReg = testReg - (absOffset / notesPerRegistry) + 1;
        }
      } else {
        checkNote = offset % notesPerRegistry;
        checkReg = testReg + Math.floor(offset / notesPerRegistry);
      }

      if (checkNote === noteInReg && checkReg === registry) {
        visibleIn.push(testReg);
        break; // Found in this registry
      }
    }
  }

  return visibleIn;
}
