// libs/sound/registry-controller.js
// Shared registry controller for App18 and future apps (plano musical)

/**
 * Creates a registry controller for managing musical note registries.
 *
 * A registry represents an octave range (0-11 notes within each registry).
 * Notes can extend to adjacent registries (prev note 11, next notes 0-1).
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

  // Fixed display configuration: 15 notes with 0 centered at position 8 (index 7)
  const TOTAL_NOTES = 15;
  const ZERO_POSITION = 7;

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
   * Get total displayed notes - always 15 with 0 centered at position 8
   * @returns {number} Total notes to display (always 15)
   */
  function getTotalNotes() {
    return TOTAL_NOTES;
  }

  /**
   * Get available "outside" notes based on current registry
   * With 0 centered, returns indices of notes outside current registry
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
   * Calculate starting MIDI for display
   * @returns {number} Starting MIDI note
   */
  function getStartMidi() {
    if (registry === null) return 60;
    if (registry === min) return 0;
    return (registry * notesPerRegistry) - 1;
  }

  /**
   * Get MIDI for a playable note within or adjacent to current registry
   * @param {number} noteInRegistry - Note index (-1 to 13)
   * @returns {{midi: number, clampedNote: number}} MIDI and clamped note
   */
  function getMidiForNote(noteInRegistry) {
    if (registry === null) return { midi: 60, clampedNote: 0 };

    let effectiveNote = noteInRegistry;

    if (noteInRegistry === -1) {
      // Previous registry note 11
      if (registry === min) {
        effectiveNote = 0;
      } else {
        return {
          midi: (registry - 1) * notesPerRegistry + (notesPerRegistry - 1) + midiOffset,
          clampedNote: -1
        };
      }
    } else if (noteInRegistry >= notesPerRegistry) {
      // Next registry notes
      if (registry === max) {
        effectiveNote = notesPerRegistry - 1;
      } else {
        return {
          midi: (registry + 1) * notesPerRegistry + (noteInRegistry - notesPerRegistry) + midiOffset,
          clampedNote: noteInRegistry
        };
      }
    }

    return {
      midi: effectiveNote + (registry * notesPerRegistry) + midiOffset,
      clampedNote: effectiveNote
    };
  }

  /**
   * Format a note index as registry label (Nr format)
   * Note 0 of current registry is always at ZERO_POSITION (index 7)
   * @param {number} noteIndex - Visual note index (0 = top, 14 = bottom)
   * @returns {string} Formatted label
   */
  function formatLabel(noteIndex) {
    if (registry === null) return '';

    // Calculate offset from ZERO_POSITION
    // Negative offset = notes above 0 (higher pitch, previous registry)
    // Positive offset = notes below 0 (lower pitch, same/next registry)
    const offset = noteIndex - ZERO_POSITION;

    let noteNum, noteRegistry;

    if (offset < 0) {
      // Notes above 0 (toward previous registry)
      // offset = -1 → note 11 of current registry
      // offset = -2 → note 10 of current registry
      // ...
      // offset = -12 → note 0 of previous registry
      const absOffset = Math.abs(offset);
      noteNum = (notesPerRegistry - absOffset % notesPerRegistry) % notesPerRegistry;
      noteRegistry = registry - Math.ceil(absOffset / notesPerRegistry);
      // Adjust for when absOffset is exact multiple of 12
      if (absOffset % notesPerRegistry === 0) {
        noteNum = 0;
        noteRegistry = registry - (absOffset / notesPerRegistry) + 1;
      }
    } else {
      // Notes at 0 and below (same registry or next)
      // offset = 0 → note 0 of current registry
      // offset = 1 → note 1 of current registry
      // ...
      // offset = 12 → note 0 of next registry
      noteNum = offset % notesPerRegistry;
      noteRegistry = registry + Math.floor(offset / notesPerRegistry);
    }

    return `${noteNum}<sup>${noteRegistry}</sup>`;
  }

  /**
   * Convert visual note index to note-in-registry
   * With 0 at ZERO_POSITION, this returns the offset from 0
   * @param {number} noteIndex - Visual note index
   * @returns {number} Note offset from 0 (negative = above, positive = below)
   */
  function getNoteInRegistry(noteIndex) {
    return noteIndex - ZERO_POSITION;
  }

  /**
   * Convert note-in-registry to visual highlight index
   * @param {number} noteInRegistry - Note offset from 0
   * @returns {number} Visual highlight index
   */
  function getHighlightIndex(noteInRegistry) {
    return noteInRegistry + ZERO_POSITION;
  }

  /**
   * Check if a note index is a boundary note (outside current registry)
   * With 0 of current registry centered at ZERO_POSITION:
   * - Indices above ZERO_POSITION (higher noteIndex, higher pitch) are notes 1-7 of current registry
   * - Index ZERO_POSITION is note 0 of current registry
   * - Indices below ZERO_POSITION (lower noteIndex, lower pitch) are notes from previous registry
   *
   * Note: 0rN is the LOWEST note of registry N, so notes below 0rN belong to registry N-1
   *
   * @param {number} noteIndex - Visual note index
   * @returns {boolean} True if boundary note (different registry than current)
   */
  function isBoundaryNote(noteIndex) {
    if (registry === null) return false;

    const offset = noteIndex - ZERO_POSITION;

    // Notes with negative offset are below 0rN (lower pitch) = previous registry
    if (offset < 0) {
      return true; // All notes below 0 are from previous registry
    }

    // Notes with positive offset > 11 would be next registry, but with 15 notes centered,
    // max offset is +7 which is still in current registry (note 7)
    if (offset >= notesPerRegistry) {
      return true; // Notes 12+ would be next registry
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
