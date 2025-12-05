// libs/sound/melodic-sequence.js
// Shared melodic sequence generation for App18 and future apps

/**
 * Generates a random melodic sequence within a registry.
 *
 * @param {Object} config - Configuration object
 * @param {number} config.registry - Current registry (0-7)
 * @param {number} [config.length=6] - Number of notes in sequence
 * @param {number} [config.outsideMin=1] - Minimum outside notes
 * @param {number} [config.outsideMax=2] - Maximum outside notes
 * @param {number} [config.notesPerRegistry=12] - Notes per registry
 * @param {number} [config.minRegistry=0] - Minimum registry value
 * @param {number} [config.maxRegistry=7] - Maximum registry value
 * @returns {number[]} Array of note indices (-1 to 13)
 */
export function generateMelodicSequence(config) {
  const {
    registry,
    length = 6,
    outsideMin = 1,
    outsideMax = 2,
    notesPerRegistry = 12,
    minRegistry = 0,
    maxRegistry = 7
  } = config;

  if (registry === null || registry === undefined) {
    return [];
  }

  const notes = [];

  // Decide how many outside notes
  const outsideRange = outsideMax - outsideMin + 1;
  const outsideCount = outsideMin + Math.floor(Math.random() * outsideRange);
  const insideCount = length - outsideCount;

  // Generate inside notes (0 to notesPerRegistry-1)
  for (let i = 0; i < insideCount; i++) {
    notes.push(Math.floor(Math.random() * notesPerRegistry));
  }

  // Get available outside notes
  const outsideOptions = getOutsideNotes(registry, notesPerRegistry, minRegistry, maxRegistry);

  // Generate outside notes
  for (let i = 0; i < outsideCount && outsideOptions.length > 0; i++) {
    const idx = Math.floor(Math.random() * outsideOptions.length);
    notes.push(outsideOptions[idx]);
  }

  // Shuffle the array
  return shuffleArray(notes);
}

/**
 * Get available outside notes for a registry.
 *
 * @param {number} registry - Current registry
 * @param {number} notesPerRegistry - Notes per registry
 * @param {number} minRegistry - Minimum registry
 * @param {number} maxRegistry - Maximum registry
 * @returns {number[]} Array of outside note indices
 */
function getOutsideNotes(registry, notesPerRegistry, minRegistry, maxRegistry) {
  if (registry === minRegistry) {
    // No prev, only next
    return [notesPerRegistry, notesPerRegistry + 1];
  } else if (registry === maxRegistry) {
    // No next, only prev
    return [-1];
  } else {
    // Both prev and next
    return [-1, notesPerRegistry, notesPerRegistry + 1];
  }
}

/**
 * Fisher-Yates shuffle algorithm.
 *
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled array (mutates original)
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Generate a random BPM value.
 *
 * @param {number} [min=75] - Minimum BPM
 * @param {number} [max=200] - Maximum BPM
 * @returns {number} Random BPM value
 */
export function getRandomBPM(min = 75, max = 200) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random registry value.
 *
 * @param {number} [min=0] - Minimum registry
 * @param {number} [max=7] - Maximum registry
 * @returns {number} Random registry value
 */
export function getRandomRegistry(min = 0, max = 7) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random note index within a registry.
 *
 * @param {number} [notesPerRegistry=12] - Notes per registry
 * @returns {number} Random note index (0 to notesPerRegistry-1)
 */
export function getRandomNoteIndex(notesPerRegistry = 12) {
  return Math.floor(Math.random() * notesPerRegistry);
}

/**
 * Create a sequence generator with preset configuration.
 *
 * @param {Object} config - Configuration object
 * @returns {Object} Sequence generator API
 */
export function createSequenceGenerator(config = {}) {
  const {
    length = 6,
    outsideMin = 1,
    outsideMax = 2,
    notesPerRegistry = 12,
    minRegistry = 0,
    maxRegistry = 7,
    minBPM = 75,
    maxBPM = 200
  } = config;

  return {
    /**
     * Generate a melodic sequence for given registry.
     * @param {number} registry - Registry value
     * @returns {number[]} Note indices
     */
    generate(registry) {
      return generateMelodicSequence({
        registry,
        length,
        outsideMin,
        outsideMax,
        notesPerRegistry,
        minRegistry,
        maxRegistry
      });
    },

    /**
     * Generate random BPM.
     * @returns {number} BPM value
     */
    randomBPM() {
      return getRandomBPM(minBPM, maxBPM);
    },

    /**
     * Generate random registry.
     * @returns {number} Registry value
     */
    randomRegistry() {
      return getRandomRegistry(minRegistry, maxRegistry);
    },

    /**
     * Generate random note index.
     * @returns {number} Note index
     */
    randomNote() {
      return getRandomNoteIndex(notesPerRegistry);
    }
  };
}
