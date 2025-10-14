/**
 * Exercise Definitions for Rhythm Training (Phase 2c)
 *
 * Defines 4 exercises with their levels, configurations, and scoring parameters.
 *
 * Terminology:
 * - Lg: Total number of pulses (length)
 * - Positions: Pulse positions to tap (0-indexed)
 * - Par (even): Positions 0, 2, 4, 6, 8...
 * - Impar (odd): Positions 1, 3, 5, 7, 9...
 * - BPM: Beats per minute
 * - Tolerance: Timing tolerance in milliseconds
 */

/**
 * Exercise 1: Sequence Entry
 * Type: Free rhythm capture (no reference audio)
 * Linked with: Exercise 2 (Rhythm Sync)
 *
 * User taps a pattern freely (without audio reference).
 * System analyzes timing proportions and consistency.
 */
export const EXERCISE_1_SEQUENCE_ENTRY = {
  id: 'sequence-entry',
  title: 'Entrada de Secuencia',
  description: 'Captura libre de patrones rítmicos',
  type: 'rhythm-capture',
  captureMethod: 'keyboard', // Uses KeyboardCapture from audio-capture
  linked: true,
  linkedExercise: 'rhythm-sync',

  levels: [
    {
      level: 1,
      description: '2 golpes impares',
      lg: 4,
      positions: [1, 3], // Odd positions in Lg 4
      tolerance: 150, // ±150ms
      minAccuracy: 70, // 70% to pass
      instructions: 'Toca 2 veces en las posiciones impares (1, 3) del patrón de 4 pulsos'
    },
    {
      level: 2,
      description: '2 golpes pares',
      lg: 4,
      positions: [0, 2], // Even positions in Lg 4
      tolerance: 150,
      minAccuracy: 75,
      instructions: 'Toca 2 veces en las posiciones pares (0, 2) del patrón de 4 pulsos'
    },
    {
      level: 3,
      description: '2 pares + 1 impar',
      lg: 10,
      positions: [0, 2, 5], // 2 even + 1 odd in Lg 10
      tolerance: 120,
      minAccuracy: 80,
      instructions: 'Toca 3 veces: posiciones pares (0, 2) e impar (5) del patrón de 10 pulsos'
    },
    {
      level: 4,
      description: '2 impares + 1 par',
      lg: 10,
      positions: [1, 3, 6], // 2 odd + 1 even in Lg 10
      tolerance: 100,
      minAccuracy: 85,
      instructions: 'Toca 3 veces: posiciones impares (1, 3) y par (6) del patrón de 10 pulsos'
    }
  ],

  scoring: {
    base: 100,
    timingWeight: 0.4,      // 40% weight on timing accuracy
    consistencyWeight: 0.3, // 30% weight on consistency
    tempoWeight: 0.3        // 30% weight on tempo accuracy
  }
};

/**
 * Exercise 2: Rhythm Sync
 * Type: Rhythm synchronization with audio reference
 * Linked with: Exercise 1 (Sequence Entry)
 *
 * Uses same patterns as Exercise 1, but with audio reference.
 * User must synchronize taps with the audio.
 * Includes count-in (4 beats) before each attempt.
 * Repeats 3 times at increasing BPMs.
 */
export const EXERCISE_2_RHYTHM_SYNC = {
  id: 'rhythm-sync',
  title: 'Sincronización Rítmica',
  description: 'Sincroniza tus taps con el audio de referencia',
  type: 'rhythm-sync',
  captureMethod: 'keyboard', // KeyboardCapture with useCapture: true
  linked: true,
  linkedExercise: 'sequence-entry',

  // Uses same levels as Exercise 1, but with audio reference
  useLevelsFrom: 'sequence-entry',

  bpmRange: [60, 240], // Random BPM between 60 and 240
  repetitionsPerLevel: 3, // Repeat 3 times at increasing BPMs

  countIn: {
    beats: 4,              // 4 beat count-in
    visualFeedback: true,  // Show visual countdown (4, 3, 2, 1)
    audioFeedback: true,   // Play click on each beat
    clickNote: 76          // E5 - high pitch for count-in
  },

  referenceAudio: {
    enabled: true,
    clickNote: 60,   // C4 - base pitch for reference pattern
    duration: 0.1    // 100ms click duration
  },

  scoring: {
    base: 100,
    timingWeight: 0.5,      // 50% - More weight on timing (sync is key)
    consistencyWeight: 0.3, // 30%
    tempoWeight: 0.2        // 20%
  }
};

/**
 * Exercise 3: Tap Tempo Sync
 * Type: Simple tempo synchronization
 * Independent exercise (not linked)
 *
 * User taps 8 beats synchronized with audio reference.
 * Similar to existing tap tempo test, but integrated into exercise system.
 * Repeats 3 times at increasing BPMs.
 */
export const EXERCISE_3_TAP_TEMPO = {
  id: 'tap-tempo',
  title: 'Tap Tempo Sync',
  description: 'Sincroniza tus taps con el tempo constante',
  type: 'rhythm-sync',
  captureMethod: 'keyboard',
  linked: false,

  levels: [
    {
      level: 1,
      description: 'Tap 8 beats sincronizado',
      lg: 8,
      positions: [0, 1, 2, 3, 4, 5, 6, 7], // All positions (every beat)
      tolerance: 100, // ±100ms
      minAccuracy: 80,
      repetitions: 3, // 3 repetitions at increasing BPMs
      instructions: 'Toca 8 veces siguiendo el ritmo constante del audio'
    }
  ],

  bpmRange: [60, 240],

  countIn: {
    beats: 4,
    visualFeedback: true,
    audioFeedback: true,
    clickNote: 76
  },

  referenceAudio: {
    enabled: true,
    clickNote: 60,
    duration: 0.1
  },

  scoring: {
    base: 100,
    timingWeight: 0.6,      // 60% - Timing is most important
    consistencyWeight: 0.4, // 40%
    tempoWeight: 0           // 0% - Not applicable (constant tempo)
  }
};

/**
 * Exercise 4: Fraction Recognition
 * Type: Ear training for rhythmic subdivisions
 * Independent exercise (not linked)
 *
 * System plays a rhythmic subdivision (n/d fraction).
 * User must identify the correct fraction by listening.
 * Can replay audio unlimited times.
 *
 * Level 1: Simple fractions (n=1, d varies)
 * Level 2: Complex fractions (n varies, d varies)
 */
export const EXERCISE_4_FRACTION_RECOGNITION = {
  id: 'fraction-recognition',
  title: 'Reconocimiento de Fracciones',
  description: 'Identifica fracciones rítmicas escuchando',
  type: 'fraction-ear-training',
  captureMethod: 'input', // User inputs n/d values
  linked: false,

  levels: [
    {
      level: 1,
      description: 'Fracciones simples (n=1)',
      numeratorRange: [1, 1],      // Fixed n=1
      denominatorRange: [1, 12],   // d from 1 to 12
      lgRange: [6, 16],            // Lg between 6 and 16
      minAccuracy: 80,             // 80% correct to pass
      questionsPerLevel: 10,       // 10 questions per level
      instructions: 'Escucha la subdivisión y entra el denominador (n siempre es 1)'
    },
    {
      level: 2,
      description: 'Fracciones complejas',
      numeratorRange: [1, 7],      // n from 1 to 7
      denominatorRange: [1, 12],   // d from 1 to 12
      lgRange: [6, 20],            // Lg between 6 and 20
      minAccuracy: 85,             // 85% correct to pass
      questionsPerLevel: 15,       // 15 questions per level
      instructions: 'Escucha la subdivisión y entra el numerador y denominador'
    }
  ],

  audioConfig: {
    cycleSound: 'accent',      // Accent sound for pulse 0 (cycle start)
    subdivisionSound: 'base',  // Base sound for subdivisions
    bpm: 120,                  // Fixed BPM for all fraction recognition
    loopCount: 2               // Play pattern 2 times (2 full cycles)
  },

  scoring: {
    base: 100,
    correctWeight: 1.0,   // 100% correct/incorrect (no partial credit)
    attemptsBonus: -10    // -10 points per replay (listening again)
  },

  ui: {
    showNumeratorInput: true,    // Level 2 shows n input
    showDenominatorInput: true,  // Both levels show d input
    unlimitedListens: true,      // Can replay audio unlimited times
    showProgress: true           // Show "Question X / Y"
  }
};

/**
 * All exercise definitions indexed by ID
 */
export const EXERCISE_DEFINITIONS = {
  'sequence-entry': EXERCISE_1_SEQUENCE_ENTRY,
  'rhythm-sync': EXERCISE_2_RHYTHM_SYNC,
  'tap-tempo': EXERCISE_3_TAP_TEMPO,
  'fraction-recognition': EXERCISE_4_FRACTION_RECOGNITION
};

/**
 * Get exercise definition by ID
 * @param {string} exerciseId - Exercise ID
 * @returns {object|null} Exercise definition or null if not found
 */
export function getExerciseDefinition(exerciseId) {
  return EXERCISE_DEFINITIONS[exerciseId] || null;
}

/**
 * Get all available exercise IDs
 * @returns {string[]} Array of exercise IDs
 */
export function getExerciseIds() {
  return Object.keys(EXERCISE_DEFINITIONS);
}

/**
 * Check if an exercise is linked to another
 * @param {string} exerciseId - Exercise ID
 * @returns {boolean} True if exercise is linked
 */
export function isLinkedExercise(exerciseId) {
  const def = getExerciseDefinition(exerciseId);
  return def ? def.linked === true : false;
}

/**
 * Get linked exercise ID for a given exercise
 * @param {string} exerciseId - Exercise ID
 * @returns {string|null} Linked exercise ID or null
 */
export function getLinkedExerciseId(exerciseId) {
  const def = getExerciseDefinition(exerciseId);
  return def && def.linked ? def.linkedExercise : null;
}

/**
 * Validate exercise configuration
 * @param {object} definition - Exercise definition
 * @returns {object} Validation result { valid: boolean, errors: string[] }
 */
export function validateExerciseDefinition(definition) {
  const errors = [];

  if (!definition.id) {
    errors.push('Missing exercise id');
  }

  if (!definition.title) {
    errors.push('Missing exercise title');
  }

  if (!definition.type) {
    errors.push('Missing exercise type');
  }

  if (!definition.levels || !Array.isArray(definition.levels) || definition.levels.length === 0) {
    errors.push('Missing or empty levels array');
  } else {
    definition.levels.forEach((level, index) => {
      if (typeof level.level !== 'number') {
        errors.push(`Level ${index}: missing level number`);
      }
      if (!level.description) {
        errors.push(`Level ${index}: missing description`);
      }
    });
  }

  if (!definition.scoring) {
    errors.push('Missing scoring configuration');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
