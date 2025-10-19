/**
 * Level configuration for App5 gamification
 * Defines 4 difficulty levels with progressive complexity
 */

/**
 * Generate random level 3 configuration
 * @returns {Object} Level 3 config with random parameters
 */
function generateLevel3() {
  // Random Lg between 4-8
  const lg = Math.floor(Math.random() * 5) + 4; // 4, 5, 6, 7, or 8

  // Random BPM between 80-120
  const bpm = Math.floor(Math.random() * 5) * 10 + 80; // 80, 90, 100, 110, or 120

  // Random requirement type
  const requirementTypes = [
    {
      type: 'odd',
      count: Math.min(3, Math.floor((lg + 1) / 2)), // Up to 3 odd positions
      description: (count) => `Escribe ${count} P impares`,
      validate: (positions, lg) => {
        const oddPositions = [];
        for (let i = 1; i <= lg; i += 2) {
          oddPositions.push(i);
        }
        return positions.every(p => oddPositions.includes(p));
      }
    },
    {
      type: 'even',
      count: Math.min(3, Math.floor(lg / 2)), // Up to 3 even positions
      description: (count) => `Escribe ${count} P pares`,
      validate: (positions, lg) => {
        const evenPositions = [];
        for (let i = 2; i <= lg; i += 2) {
          evenPositions.push(i);
        }
        return positions.every(p => evenPositions.includes(p));
      }
    },
    {
      type: 'mixed',
      count: 3,
      description: () => `1 P impar y 2 P pares`,
      validate: (positions, lg) => {
        if (positions.length !== 3) return false;
        const oddPositions = positions.filter(p => p % 2 === 1);
        const evenPositions = positions.filter(p => p % 2 === 0);
        return oddPositions.length === 1 && evenPositions.length === 2;
      }
    },
    {
      type: 'extremes',
      count: 2,
      description: (count, lg) => `Escribe primera y última P (1 y ${lg})`,
      validate: (positions, lg) => {
        return positions.length === 2 &&
               positions.includes(1) &&
               positions.includes(lg);
      }
    }
  ];

  const selectedType = requirementTypes[Math.floor(Math.random() * requirementTypes.length)];

  return {
    lg,
    bpm,
    requirement: selectedType.description(selectedType.count, lg),
    requirementType: selectedType.type,
    expectedCount: selectedType.count,
    validate: selectedType.validate,
    dynamic: true,
    phase2Repeats: 2 // Pattern always plays twice
  };
}

/**
 * Level configurations
 * Each level has specific requirements and difficulty
 */
export const LEVELS = {
  1: {
    lg: 4,
    bpm: 90,
    requirement: "Escribe 2 P impares",
    solution: [1, 3], // Expected positions
    hint: "Las posiciones impares son la primera y tercera",
    requirementType: 'odd',
    expectedCount: 2,
    phase2Repeats: 2, // Pattern plays twice in phase 2
    validate: (positions) => {
      return positions.length === 2 &&
             positions.includes(1) &&
             positions.includes(3);
    }
  },

  2: {
    lg: 4,
    bpm: 90,
    requirement: "Escribe 2 P pares",
    solution: [2, 4], // Expected positions
    hint: "Las posiciones pares son la segunda y cuarta",
    requirementType: 'even',
    expectedCount: 2,
    phase2Repeats: 2,
    validate: (positions) => {
      return positions.length === 2 &&
             positions.includes(2) &&
             positions.includes(4);
    }
  },

  3: {
    // Level 3 is dynamically generated
    type: 'dynamic',
    generator: generateLevel3,
    phase2Repeats: 2,
    hint: "Sigue las instrucciones del requisito"
  },

  4: {
    type: 'free',
    libre: true,
    requirement: "Modo libre - Crea tu propio patrón",
    hint: "Escribe cualquier combinación de posiciones",
    minPositions: 2,
    maxPositions: 8,
    defaultLg: 8,
    defaultBpm: 100,
    phase2Repeats: 2,
    validate: (positions) => {
      // In free mode, any selection with at least 2 positions is valid
      return positions.length >= 2 && positions.length <= 8;
    }
  }
};

/**
 * Get level configuration
 * @param {number} levelNumber - Level number (1-4)
 * @returns {Object} Level configuration object
 */
export function getLevel(levelNumber) {
  const level = LEVELS[levelNumber];

  if (!level) {
    throw new Error(`Invalid level number: ${levelNumber}`);
  }

  // For dynamic level 3, generate new configuration
  if (level.type === 'dynamic' && level.generator) {
    const generated = level.generator();
    return {
      ...level,
      ...generated,
      levelNumber
    };
  }

  // For free mode (level 4), copy default values as initial values
  if (level.type === 'free') {
    return {
      ...level,
      lg: level.defaultLg,
      bpm: level.defaultBpm,
      levelNumber
    };
  }

  return {
    ...level,
    levelNumber
  };
}

/**
 * Get all level numbers
 * @returns {number[]} Array of level numbers
 */
export function getAllLevelNumbers() {
  return Object.keys(LEVELS).map(Number);
}

/**
 * Check if level is completed correctly
 * @param {number} levelNumber - Level number
 * @param {number[]} positions - User selected positions
 * @returns {boolean} True if level completed correctly
 */
export function checkLevelCompletion(levelNumber, positions) {
  const level = getLevel(levelNumber);

  if (level.validate) {
    return level.validate(positions, level.lg);
  }

  // Fallback: check against solution if available
  if (level.solution) {
    return positions.length === level.solution.length &&
           level.solution.every(p => positions.includes(p));
  }

  // For free mode, just check if any positions selected
  return positions.length > 0;
}

/**
 * Get hint for level after timeout
 * @param {number} levelNumber - Level number
 * @returns {string} Hint text
 */
export function getLevelHint(levelNumber) {
  const level = getLevel(levelNumber);
  return level.hint || "Revisa el requisito del nivel";
}

/**
 * Get positions to highlight for hint
 * @param {number} levelNumber - Level number
 * @returns {number[]} Positions to highlight
 */
export function getHintPositions(levelNumber) {
  const level = getLevel(levelNumber);

  // Return solution if available
  if (level.solution) {
    return level.solution;
  }

  // For dynamic levels, try to calculate based on requirement type
  if (level.requirementType === 'odd') {
    const positions = [];
    for (let i = 1; i <= level.lg && positions.length < level.expectedCount; i += 2) {
      positions.push(i);
    }
    return positions;
  }

  if (level.requirementType === 'even') {
    const positions = [];
    for (let i = 2; i <= level.lg && positions.length < level.expectedCount; i += 2) {
      positions.push(i);
    }
    return positions;
  }

  if (level.requirementType === 'extremes') {
    return [1, level.lg];
  }

  if (level.requirementType === 'consecutive') {
    // Return first 3 consecutive positions
    return [1, 2, 3];
  }

  // No hint positions for free mode
  return [];
}