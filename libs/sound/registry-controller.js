// libs/sound/registry-controller.js
// Shared registry controller for App18 and future apps (plano musical)

/**
 * Creates a registry controller for managing musical note registries.
 *
 * A registry represents an octave range (0-11 notes within each registry).
 * The soundline displays 13 notes: 0-11 of the current registry plus note 0
 * of the next registry at the top. Note 0 is always at the bottom (index 0).
 *
 * @param {Object} config - Configuration object
 * @param {number} [config.min=0] - Minimum registry value
 * @param {number} [config.max=7] - Maximum registry value
 * @param {number} [config.midiOffset=12] - MIDI offset (octave shift)
 * @param {number} [config.notesPerRegistry=12] - Notes per registry (octave)
 * @param {Function} [config.onRegistryChange] - Callback when registry changes
 * @returns {Object} Registry controller API
 */
export function createRegistryController(config = {}) {
  const {
    min = 0,
    max = 7,
    midiOffset = 12,
    notesPerRegistry = 12,
    onRegistryChange
  } = config;

  // Fixed display: 13 notes — 0-11 of current registry + note 0 of next registry
  // Note 0 is at the bottom (index 0)
  const TOTAL_NOTES = 13;
  const ZERO_POSITION = 0;

  let registry = null;

  /**
   * Get current registry value
   * @returns {number|null} Current registry or null if not set
   */
  function getRegistry() {
    return registry;
  }

  /**
   * Set registry value with validation
   * @param {number|string|null} value - New registry value
   * @returns {number|null} Actual set value (clamped)
   */
  function setRegistry(value) {
    const prev = registry;

    if (value === null || value === '' || value === undefined) {
      registry = null;
    } else {
      const num = parseInt(value, 10);
      if (!isNaN(num)) {
        registry = Math.max(min, Math.min(max, num));
      }
    }

    if (registry !== prev && typeof onRegistryChange === 'function') {
      onRegistryChange(registry, prev);
    }

    return registry;
  }

  /**
   * Increment registry by 1
   * @returns {number|null} New registry value
   */
  function increment() {
    if (registry === null) {
      return setRegistry(min);
    } else if (registry < max) {
      return setRegistry(registry + 1);
    }
    return registry;
  }

  /**
   * Decrement registry by 1
   * @returns {number|null} New registry value
   */
  function decrement() {
    if (registry === null) {
      return setRegistry(max);
    } else if (registry > min) {
      return setRegistry(registry - 1);
    }
    return registry;
  }

  /**
   * Get total displayed notes — always 13 (0-11 + next registry's 0)
   * @returns {number} Total notes to display (always 13)
   */
  function getTotalNotes() {
    return TOTAL_NOTES;
  }

  /**
   * Get "outside" note indices (notes not in the current registry).
   * Index 12 is note 0 of the next registry.
   * @returns {number[]} Array of visual note indices that are boundary notes
   */
  function getOutsideNotes() {
    const outside = [];
    for (let i = 0; i < TOTAL_NOTES; i++) {
      if (isBoundaryNote(i)) {
        outside.push(i);
      }
    }
    return outside;
  }

  /**
   * Calculate starting MIDI for display.
   * Index 0 = note 0 of current registry.
   * @returns {number} Starting MIDI note
   */
  function getStartMidi() {
    if (registry === null) return 60;
    return registry * notesPerRegistry + midiOffset;
  }

  /**
   * Get MIDI for a playable note within or adjacent to current registry.
   * noteInRegistry is now a direct offset from 0 (same as visual index).
   * @param {number} noteInRegistry - Note index (0 to 12)
   * @returns {{midi: number, clampedNote: number}} MIDI and clamped note
   */
  function getMidiForNote(noteInRegistry) {
    if (registry === null) return { midi: 60, clampedNote: 0 };

    let effectiveNote = noteInRegistry;

    if (noteInRegistry < 0) {
      // Below note 0 — clamp to 0
      effectiveNote = 0;
    } else if (noteInRegistry >= notesPerRegistry) {
      // Next registry notes (index 12 = note 0 of next registry)
      if (registry === max) {
        effectiveNote = notesPerRegistry - 1;
        return {
          midi: effectiveNote + (registry * notesPerRegistry) + midiOffset,
          clampedNote: effectiveNote
        };
      }
      return {
        midi: (registry + 1) * notesPerRegistry + (noteInRegistry - notesPerRegistry) + midiOffset,
        clampedNote: noteInRegistry
      };
    }

    return {
      midi: effectiveNote + (registry * notesPerRegistry) + midiOffset,
      clampedNote: effectiveNote
    };
  }

  /**
   * Format a note index as registry label (N^r superscript format).
   * Index 0 = note 0 of current registry (bottom).
   * Index 12 = note 0 of next registry (top).
   * @param {number} noteIndex - Visual note index (0 = bottom, 12 = top)
   * @returns {string} Formatted label with HTML superscript
   */
  function formatLabel(noteIndex) {
    if (registry === null) return '';

    const offset = noteIndex - ZERO_POSITION; // Same as noteIndex since ZERO_POSITION=0

    const noteNum = offset % notesPerRegistry;
    const noteRegistry = registry + Math.floor(offset / notesPerRegistry);

    return `${noteNum}<sup>${noteRegistry}</sup>`;
  }

  /**
   * Convert visual note index to note-in-registry offset.
   * With 0 at the bottom, the offset equals the visual index.
   * @param {number} noteIndex - Visual note index
   * @returns {number} Note offset from 0
   */
  function getNoteInRegistry(noteIndex) {
    return noteIndex - ZERO_POSITION;
  }

  /**
   * Convert note-in-registry to visual highlight index.
   * @param {number} noteInRegistry - Note offset from 0
   * @returns {number} Visual highlight index
   */
  function getHighlightIndex(noteInRegistry) {
    return noteInRegistry + ZERO_POSITION;
  }

  /**
   * Check if a note index is a boundary note (outside current registry).
   * Index 12 = note 0 of next registry → boundary.
   * Indices 0-11 = current registry → not boundary.
   * @param {number} noteIndex - Visual note index
   * @returns {boolean} True if boundary note (different registry than current)
   */
  function isBoundaryNote(noteIndex) {
    if (registry === null) return false;

    const offset = noteIndex - ZERO_POSITION;

    // Notes at or above notesPerRegistry are next registry
    if (offset >= notesPerRegistry) {
      return true;
    }

    return false;
  }

  return {
    getRegistry,
    setRegistry,
    increment,
    decrement,
    getTotalNotes,
    getOutsideNotes,
    getStartMidi,
    getMidiForNote,
    formatLabel,
    getNoteInRegistry,
    getHighlightIndex,
    isBoundaryNote,
    get min() { return min; },
    get max() { return max; },
    get midiOffset() { return midiOffset; },
    get notesPerRegistry() { return notesPerRegistry; }
  };
}
