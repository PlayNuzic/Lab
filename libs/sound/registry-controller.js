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
   * Get total displayed notes based on registry
   * - Registry 0: 14 notes (no prev: 12 current + 2 next)
   * - Registry 1-6: 15 notes (1 prev + 12 current + 2 next)
   * - Registry max: 13 notes (no next: 1 prev + 12 current)
   * @returns {number} Total notes to display
   */
  function getTotalNotes() {
    if (registry === null) return 15;
    if (registry === min) return notesPerRegistry + 2;  // 14
    if (registry === max) return notesPerRegistry + 1;  // 13
    return notesPerRegistry + 3;  // 15
  }

  /**
   * Get available "outside" notes based on current registry
   * @returns {number[]} Array of outside note indices
   */
  function getOutsideNotes() {
    if (registry === min) {
      return [notesPerRegistry, notesPerRegistry + 1];  // [12, 13]
    } else if (registry === max) {
      return [-1];  // prev note 11
    } else {
      return [-1, notesPerRegistry, notesPerRegistry + 1];  // [-1, 12, 13]
    }
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
   * @param {number} noteIndex - Visual note index
   * @returns {string} Formatted label
   */
  function formatLabel(noteIndex) {
    if (registry === null) return '';

    // Registry 0: No previous registry
    if (registry === min) {
      if (noteIndex < notesPerRegistry) {
        return `${noteIndex}r${registry}`;
      } else {
        const note = noteIndex - notesPerRegistry;
        return `${note}r${registry + 1}`;
      }
    }

    // Registry max: No next registry
    if (registry === max) {
      if (noteIndex === 0) {
        return `${notesPerRegistry - 1}r${registry - 1}`;  // 11r(n-1)
      } else {
        const note = noteIndex - 1;
        return `${note}r${registry}`;
      }
    }

    // Registry 1 to max-1: Full range
    if (noteIndex === 0) {
      return `${notesPerRegistry - 1}r${registry - 1}`;  // 11r(n-1)
    } else if (noteIndex >= notesPerRegistry + 1) {
      const note = noteIndex - (notesPerRegistry + 1);
      return `${note}r${registry + 1}`;
    } else {
      const note = noteIndex - 1;
      return `${note}r${registry}`;
    }
  }

  /**
   * Convert visual note index to note-in-registry
   * @param {number} noteIndex - Visual note index
   * @returns {number} Note in registry (-1 to 13)
   */
  function getNoteInRegistry(noteIndex) {
    if (registry === min) {
      return noteIndex;
    } else {
      return noteIndex - 1;
    }
  }

  /**
   * Convert note-in-registry to visual highlight index
   * @param {number} noteInRegistry - Note in registry (-1 to 13)
   * @returns {number} Visual highlight index
   */
  function getHighlightIndex(noteInRegistry) {
    if (registry === min) {
      return noteInRegistry;
    } else {
      return noteInRegistry + 1;
    }
  }

  /**
   * Check if a note index is a boundary note (outside current registry)
   * @param {number} noteIndex - Visual note index
   * @returns {boolean} True if boundary note
   */
  function isBoundaryNote(noteIndex) {
    if (registry === min) {
      return noteIndex >= notesPerRegistry;
    } else if (registry === max) {
      return noteIndex === 0;
    } else {
      return noteIndex === 0 || noteIndex >= notesPerRegistry + 1;
    }
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
