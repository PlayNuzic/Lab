/**
 * registry-playback-autoscroll.js - Vertical autoscroll during playback based on note registries
 *
 * Manages automatic vertical scrolling during playback to keep the currently playing
 * note visible. Calculates optimal registry for each pulse based on note distribution.
 *
 * Features:
 * - Builds pulse → registry map for optimal viewing
 * - Determines which registries show a given note
 * - Smooth scrolling transitions during playback
 * - Anticipatory registry changes (scroll before note plays)
 *
 * @example
 * import { createRegistryAutoscrollController } from '../../libs/app-common/registry-playback-autoscroll.js';
 *
 * const autoscroll = createRegistryAutoscrollController({
 *   grid,           // plano-modular instance with setRegistry method
 *   getSelectedArray: () => grid.getSelectedArray(),
 *   config: {
 *     minRegistry: 2,
 *     maxRegistry: 5,
 *     notesPerRegistry: 12,
 *     visibleRows: 15,
 *     zeroPosition: 7
 *   }
 * });
 *
 * // During playback setup
 * const pulseRegistryMap = autoscroll.buildPulseRegistryMap();
 *
 * // During playback callback
 * autoscroll.scrollToRegistryForPulse(currentPulse, pulseRegistryMap);
 */

/**
 * Creates a registry autoscroll controller for playback
 *
 * @param {Object} config - Configuration object
 * @param {Object} config.grid - plano-modular grid instance with setRegistry method
 * @param {Function} config.getSelectedArray - Function returning selected notes array
 * @param {Object} [config.config={}] - Additional configuration
 * @param {number} [config.config.minRegistry=2] - Minimum registry value
 * @param {number} [config.config.maxRegistry=5] - Maximum registry value
 * @param {number} [config.config.notesPerRegistry=12] - Notes per registry (octave)
 * @param {number} [config.config.visibleRows=15] - Number of visible rows in grid
 * @param {number} [config.config.zeroPosition=7] - Row index where note 0 appears
 * @param {boolean} [config.config.smoothScroll=true] - Enable smooth scrolling
 * @returns {Object} Autoscroll controller API
 */
export function createRegistryAutoscrollController(config = {}) {
  const {
    grid,
    getSelectedArray,
    config: scrollConfig = {}
  } = config;

  const {
    minRegistry = 2,
    maxRegistry = 5,
    notesPerRegistry = 12,
    visibleRows = 15,
    zeroPosition = 7,
    smoothScroll = true
  } = scrollConfig;

  // ========== INTERNAL HELPERS ==========

  /**
   * Get all registries where a note+registry combination would be visible
   *
   * @param {number} noteNum - Note value (0-11)
   * @param {number} noteReg - Registry where note is placed
   * @returns {number[]} Array of registry IDs where this note is visible
   */
  function getVisibleRegistries(noteNum, noteReg) {
    const visibleIn = [];

    for (let testReg = minRegistry; testReg <= maxRegistry; testReg++) {
      for (let visualIdx = 0; visualIdx < visibleRows; visualIdx++) {
        const offset = visualIdx - zeroPosition;
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

        if (checkNote === noteNum && checkReg === noteReg) {
          visibleIn.push(testReg);
          break;
        }
      }
    }

    return visibleIn;
  }

  /**
   * Parse rowId to extract note and registry
   *
   * @param {string} rowId - Format "NrR" e.g., "5r4"
   * @returns {{ note: number, registry: number } | null}
   */
  function parseRowId(rowId) {
    const match = rowId?.match(/^(\d+)r(\d+)$/);
    if (!match) return null;
    return {
      note: parseInt(match[1]),
      registry: parseInt(match[2])
    };
  }

  // ========== PUBLIC METHODS ==========

  /**
   * Build a map of pulse → optimal registry for vertical autoscroll
   * During playback, this determines which registry to show for each note
   *
   * @param {Array} [selectedArray] - Optional array of selected items, defaults to getSelectedArray()
   * @returns {Object} Map of pulseIndex → registryId
   */
  function buildPulseRegistryMap(selectedArray = null) {
    const items = selectedArray || (getSelectedArray ? getSelectedArray() : []);
    const pulseRegistry = {};

    // Count notes visible per registry (for optimization)
    const registryCounts = {};
    for (let r = minRegistry; r <= maxRegistry; r++) {
      registryCounts[r] = 0;
    }

    // Parse all notes and calculate visibility
    const notesInfo = items.map(item => {
      const parsed = parseRowId(item.rowId);
      if (!parsed) return null;

      const { note: noteNum, registry: noteReg } = parsed;
      const visibleIn = getVisibleRegistries(noteNum, noteReg);

      // Count for each visible registry
      for (const r of visibleIn) {
        if (registryCounts[r] !== undefined) {
          registryCounts[r]++;
        }
      }

      return {
        noteNum,
        noteReg,
        pulseIndex: item.colIndex,
        visibleIn
      };
    }).filter(Boolean);

    // For each note, pick the registry with most visible notes
    for (const info of notesInfo) {
      if (info.visibleIn.length === 0) {
        // Not visible in any registry - use note's own registry
        pulseRegistry[info.pulseIndex] = info.noteReg;
      } else if (info.visibleIn.length === 1) {
        // Only visible in one registry
        pulseRegistry[info.pulseIndex] = info.visibleIn[0];
      } else {
        // Visible in multiple registries - choose one with most notes
        let bestReg = info.visibleIn[0];
        let bestCount = registryCounts[bestReg] || 0;

        for (const r of info.visibleIn) {
          const count = registryCounts[r] || 0;
          if (count > bestCount) {
            bestCount = count;
            bestReg = r;
          }
        }

        pulseRegistry[info.pulseIndex] = bestReg;
      }
    }

    return pulseRegistry;
  }

  /**
   * Scroll to the optimal registry for a given pulse
   *
   * @param {number} pulse - Current pulse index
   * @param {Object} pulseRegistryMap - Map from buildPulseRegistryMap()
   * @param {boolean} [animated] - Override smooth scroll setting
   */
  function scrollToRegistryForPulse(pulse, pulseRegistryMap, animated = null) {
    if (!grid || !pulseRegistryMap) return;

    const registry = pulseRegistryMap[pulse];
    if (registry === undefined) return;

    const useAnimation = animated !== null ? animated : smoothScroll;
    grid.setRegistry(registry, useAnimation);
  }

  /**
   * Get the optimal registry for a pulse (without scrolling)
   *
   * @param {number} pulse - Pulse index
   * @param {Object} pulseRegistryMap - Map from buildPulseRegistryMap()
   * @returns {number | undefined} Registry ID or undefined if no note at pulse
   */
  function getRegistryForPulse(pulse, pulseRegistryMap) {
    return pulseRegistryMap?.[pulse];
  }

  /**
   * Schedule anticipatory registry change
   * Scrolls to next note's registry slightly before it plays
   *
   * @param {number} nextPulse - Next pulse index
   * @param {Object} pulseRegistryMap - Map from buildPulseRegistryMap()
   * @param {number} delayMs - Delay in milliseconds before scrolling
   * @param {Function} isPlayingCheck - Function returning whether playback is still active
   * @returns {number} Timeout ID for cancellation
   */
  function scheduleAnticipatedScroll(nextPulse, pulseRegistryMap, delayMs, isPlayingCheck) {
    const registry = pulseRegistryMap?.[nextPulse];
    if (registry === undefined) return null;

    return setTimeout(() => {
      if (isPlayingCheck && !isPlayingCheck()) return;

      if (grid) {
        grid.setRegistry(registry, smoothScroll);
      }
    }, delayMs);
  }

  /**
   * Manually scroll to a specific registry
   *
   * @param {number} registry - Target registry ID
   * @param {boolean} [animated] - Use smooth scroll
   */
  function scrollToRegistry(registry, animated = null) {
    if (!grid) return;

    const useAnimation = animated !== null ? animated : smoothScroll;
    grid.setRegistry(registry, useAnimation);
  }

  /**
   * Get the visible registries for a note+registry combination
   * Useful for debugging or UI feedback
   *
   * @param {number} note - Note value (0-11)
   * @param {number} registry - Registry value
   * @returns {number[]} Array of registry IDs
   */
  function getVisibleRegistriesForNote(note, registry) {
    return getVisibleRegistries(note, registry);
  }

  // ========== PUBLIC API ==========

  return {
    // Core functionality
    buildPulseRegistryMap,
    scrollToRegistryForPulse,
    getRegistryForPulse,

    // Anticipation
    scheduleAnticipatedScroll,

    // Manual control
    scrollToRegistry,

    // Utilities
    getVisibleRegistriesForNote,
    parseRowId
  };
}
