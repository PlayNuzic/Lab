/**
 * Scales Module - Mother Scales and Rotations
 *
 * Sistema de escalas madre con sus rotaciones/modos.
 * Importado de Indexlab para Apps 21+
 */

// ============================================================================
// MOTHER SCALES DATA
// ============================================================================

export const motherScalesData = {
  CROM: { name: 'Cromática', ee: Array(12).fill(1), rotNames: ['Único'] },
  DIAT: { name: 'Diatónica', ee: [2,2,1,2,2,2,1], rotNames: ['Mayor','Dórica','Frigia','Lidia','Mixolidia','Eolia','Locria'] },
  ACUS: { name: 'Acústica', ee: [2,2,2,1,2,1,2], rotNames: ['Acústica','Mixol b6','Semidim','Alterada','Menor Mel.','Dórica b2','Lidia Aum'] },
  ARMme: { name: 'Armónica Menor', ee: [2,1,2,2,1,3,1], rotNames: ['Arm Menor','Locria Nat','Mayor Aum','Lidia Dim','Frigia Dom','Aeo Arm','Ultralocr'] },
  ARMma: { name: 'Armónica Mayor', ee: [2,2,1,2,1,3,1], rotNames: ['Arm Mayor','Dórica b5','Frigia b4','Lidia b3','Mixo b9','Lidia #2','Locria bb7'] },
  OCT: { name: 'Octatónica', ee: [1,2,1,2,1,2,1,2], rotNames: ['Modo 1','Modo 2'] },
  HEX: { name: 'Hexatónica', ee: [1,3,1,3,1,3], rotNames: ['Aumentada','Inversa'] },
  TON: { name: 'Tonos', ee: [2,2,2,2,2,2], rotNames: ['Único'] }
};

// ============================================================================
// ACCIDENTALS
// ============================================================================

export const SHARP = '#';
export const FLAT = 'b';
export const DOUBLE_SHARP = '\uD834\uDD2A';
export const DOUBLE_FLAT = '\uD834\uDD2B';
export const BECUADRO = '\u266E';
export const NATURAL = BECUADRO;

// ============================================================================
// SCALE SEMITONES
// ============================================================================

/**
 * Converts a mother scale's EE (interval structure) to semitone positions
 * @param {string} id - Scale ID (e.g., 'DIAT', 'ACUS')
 * @returns {number[]} Array of semitone positions from root
 */
export function scaleSemis(id) {
  if (!scaleSemis.cache) scaleSemis.cache = new Map();
  if (scaleSemis.cache.has(id)) return scaleSemis.cache.get(id);

  let acc = 0;
  const arr = [0];
  motherScalesData[id].ee.forEach(v => {
    acc += v;
    arr.push(acc % 12);
  });
  arr.pop();

  scaleSemis.cache.set(id, arr);
  return arr;
}

// ============================================================================
// KEY SIGNATURES
// ============================================================================

export const scaleKeySignatures = {
  DIAT: [
    [],
    ['Bb','Eb','Ab','Db','Gb'],
    ['F#','C#'],
    ['Bb','Eb','Ab'],
    ['F#','C#','G#','D#'],
    ['Bb'],
    ['F#','C#','G#','D#','A#','E#'],
    ['F#'],
    ['Bb','Eb','Ab','Db'],
    ['F#','C#','G#'],
    ['Bb','Eb'],
    ['F#','C#','G#','D#','A#']
  ],
  ACUS: [
    ['F#','Bb'],
    ['Bb','Eb','Ab','Db','G' + BECUADRO,'Cb'],
    ['F#','C' + BECUADRO,'G#'],
    ['Bb','Eb','A' + BECUADRO,'Db'],
    ['F#','C#','G#','D' + BECUADRO,'A#'],
    ['B' + BECUADRO,'Eb'],
    ['Bb','Eb','Ab','Db','Gb','C' + BECUADRO,'Fb'],
    ['F' + BECUADRO,'C#'],
    ['Bb','Eb','Ab','D' + BECUADRO,'Gb'],
    ['F#','C#','G' + BECUADRO,'D#'],
    ['Bb','E' + BECUADRO,'Ab'],
    ['F#','C#','G#','D#','A' + BECUADRO,'E#']
  ],
  ARMme: [
    ['B'+BECUADRO,'Eb','Ab'],
    ['F#','C#','G#','D#','A'+BECUADRO,'E'+BECUADRO,'B#'],
    ['F'+BECUADRO,'C#','Bb'],
    ['Bb','Eb','Ab','D'+BECUADRO,'Gb','Cb'],
    ['F#','C'+BECUADRO,'G'+BECUADRO,'D#'],
    ['Bb','E'+BECUADRO,'Ab','Db'],
    ['F#','C#','G#','D'+BECUADRO,'A'+BECUADRO,'E#'],
    ['F#','Bb','Eb'],
    ['Bb','Eb','Ab','Db','G'+BECUADRO,'Cb','Fb'],
    ['F'+BECUADRO,'C'+BECUADRO,'G#'],
    ['Bb','Eb','A'+BECUADRO,'Db','Gb'],
    ['F#','C#','G'+BECUADRO,'D'+BECUADRO,'A#']
  ],
  ARMma: [
    ['B'+BECUADRO,'E'+BECUADRO,'Ab'],
    ['F#','C#','G#','D#','A'+BECUADRO,'E#','B#'],
    ['F#','C#','Bb'],
    ['Bb','Eb','Ab','D'+BECUADRO,'G'+BECUADRO,'Cb'],
    ['F#','C'+BECUADRO,'G#','D#'],
    ['Bb','E'+BECUADRO,'A'+BECUADRO,'Db'],
    ['F#','C#','G#','D'+BECUADRO,'A#','E#'],
    ['F#','B'+BECUADRO,'Eb'],
    ['Bb','Eb','Ab','Db','G'+BECUADRO,'C'+BECUADRO,'Fb'],
    ['F'+BECUADRO,'C#','G#'],
    ['Bb','Eb','A'+BECUADRO,'D'+BECUADRO,'Gb'],
    ['F#','C#','G'+BECUADRO,'D#','A#']
  ]
};

/**
 * Gets key signature accidentals for a scale and root
 * @param {string} scaleId - Scale ID
 * @param {number} root - Root note (0-11)
 * @returns {string[]} Array of accidentals
 */
export function getKeySignature(scaleId, root) {
  const table = scaleKeySignatures[scaleId];
  if (!table) return [];
  const idx = ((root % 12) + 12) % 12;
  return table[idx] || [];
}

// ============================================================================
// INTERVAL COLORS - Nuzic Palette
// ============================================================================

export const intervalCategory = {
  resonant: { color: '#7CD6B3', label: 'Resonante' },   // Verde (V)
  consonant: { color: '#7BB4CD', label: 'Consonante' }, // Azul (Lg)
  dissonant: { color: '#F28AAD', label: 'Disonante' },  // Rosa/Rojo (T)
  neutral: { color: '#FFBB33', label: 'Neutro' }        // Amarillo (selection)
};

export const intervalColorBySemitone = {
  0: intervalCategory.resonant.color,   // Unísono - Verde
  1: intervalCategory.dissonant.color,  // 2m - Rosa
  2: '#E8A090',                          // 2M - Rosa claro
  3: '#9AC8D8',                          // 3m - Azul claro
  4: intervalCategory.consonant.color,  // 3M - Azul
  5: '#8DDBC5',                          // 4J - Verde claro
  6: intervalCategory.neutral.color,    // Tritono - Amarillo
  7: '#8DDBC5',                          // 5J - Verde claro
  8: intervalCategory.consonant.color,  // 6m - Azul
  9: '#9AC8D8',                          // 6M - Azul claro
  10: '#E8A090',                         // 7m - Rosa claro
  11: intervalCategory.dissonant.color  // 7M - Rosa
};

export const intervalTypeBySemitone = {
  0: 'resonant', 1: 'dissonant', 2: 'dissonant',
  3: 'consonant', 4: 'consonant',
  5: 'resonant', 6: 'neutral',
  7: 'resonant', 8: 'consonant', 9: 'consonant',
  10: 'dissonant', 11: 'dissonant'
};

/**
 * Gets interval category for a given interval
 * @param {number} interval - Interval in semitones
 * @param {number} len - Scale length (default 12)
 * @returns {string} Category: 'resonant', 'consonant', 'dissonant', or 'neutral'
 */
export function intervalCategoryFor(interval, len = 12) {
  interval = ((interval % len) + len) % len;
  if (len === 12) return intervalTypeBySemitone[interval];
  if (interval === 0) return 'resonant';
  if (len % 2 === 0 && interval === len / 2) return 'neutral';
  if (interval === 1 || interval === len - 1) return 'dissonant';
  if (interval === 2 || interval === len - 2) return 'consonant';
  return 'resonant';
}

/**
 * Gets color for an interval
 * @param {number} interval - Interval in semitones
 * @param {number} len - Scale length (default 12)
 * @returns {string} Hex color string
 */
export function intervalColor(interval, len = 12) {
  interval = ((interval % len) + len) % len;
  if (len === 12) {
    return intervalColorBySemitone[interval];
  }
  // For non-12 scales, return category color
  const cat = intervalCategoryFor(interval, len);
  return intervalCategory[cat].color;
}

// ============================================================================
// SCALE CALCULATIONS
// ============================================================================

/**
 * Converts a degree to semitone value
 * @param {Object} scale - Scale state { id, rot, root }
 * @param {number} d - Degree
 * @returns {number} Semitone value (0-11)
 */
export function degToSemi(scale, d) {
  const sems = scaleSemis(scale.id);
  const len = sems.length;
  const idx = ((d + scale.rot) % len + len) % len;
  return (sems[idx] + scale.root) % 12;
}

/**
 * Gets semitone difference between two degrees
 * @param {Object} scale - Scale state { id, rot, root }
 * @param {number} start - Start degree
 * @param {number} diff - Degree difference
 * @returns {number} Semitone difference (0-11)
 */
export function degDiffToSemi(scale, start, diff) {
  const sems = scaleSemis(scale.id);
  const len = sems.length;
  const startIdx = ((start + scale.rot) % len + len) % len;
  const targetIdx = ((start + diff + scale.rot) % len + len) % len;
  const sem1 = (sems[startIdx] + scale.root) % 12;
  const sem2 = (sems[targetIdx] + scale.root) % 12;
  let out = sem2 - sem1;
  if (out < 0) out += 12;
  return out;
}

/**
 * Gets semitone span between two degrees (can exceed octave)
 * @param {Object} scale - Scale state { id, rot, root }
 * @param {number} start - Start degree
 * @param {number} diff - Degree difference
 * @returns {number} Semitone span
 */
export function degDiffToSemiSpan(scale, start, diff) {
  const len = scaleSemis(scale.id).length;
  const base = degDiffToSemi(scale, start, diff);
  const octs = Math.floor((start + diff + scale.rot) / len) - Math.floor((start + scale.rot) / len);
  return base + 12 * octs;
}

/**
 * Gets semitone values for given degrees
 * @param {Object} scale - Scale state { id, rot, root }
 * @param {number[]} degrees - Array of degrees
 * @param {number[]} shifts - Optional octave shifts per degree
 * @returns {number[]} Array of semitone values
 */
export function currentSemis(scale, degrees, shifts = []) {
  const semsArr = scaleSemis(scale.id);
  const len = semsArr.length;
  return degrees.map((d, i) => {
    const idx = ((d + scale.rot) % len + len) % len;
    const base = (semsArr[idx] + scale.root) % 12;
    return base + 12 * (shifts[i] || 0);
  });
}

// ============================================================================
// SCALE UTILITIES
// ============================================================================

/**
 * Checks if a scale is symmetric (has only 1-2 unique rotations)
 * @param {string} id - Scale ID
 * @returns {boolean}
 */
export function isSymmetricScale(id) {
  return id === 'CROM' || id === 'OCT' || id === 'HEX' || id === 'TON';
}

/**
 * Changes mode/rotation of a scale
 * @param {Object} scale - Scale state { id, rot, root } - mutated in place
 * @param {number} newRot - New rotation index
 * @param {boolean} lockRoot - If true, adjusts root to maintain same pitch set (parallel mode)
 */
export function changeMode(scale, newRot, lockRoot = false) {
  const sems = scaleSemis(scale.id);
  const len = sems.length;
  newRot = ((newRot % len) + len) % len;

  if (lockRoot) {
    const curr = sems[((scale.rot % len) + len) % len];
    const next = sems[newRot];
    scale.root = ((scale.root + curr - next) % 12 + 12) % 12;
  }
  scale.rot = newRot;
}

/**
 * Gets all scale IDs
 * @returns {string[]}
 */
export function getScaleIds() {
  return Object.keys(motherScalesData);
}

/**
 * Gets scale info by ID
 * @param {string} id - Scale ID
 * @returns {Object|null} Scale data or null if not found
 */
export function getScaleInfo(id) {
  return motherScalesData[id] || null;
}
