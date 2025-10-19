/**
 * Validation System
 * Generic validation system for game responses
 */

/**
 * Manages validation of user responses in games
 */
export class ValidationSystem {
  constructor(config = {}) {
    this.tolerance = config.tolerance || 0.1; // Default 10% tolerance
    this.strictMode = config.strictMode || false;
    this.validators = config.validators || {};
    this.history = [];
    this.statistics = {
      total: 0,
      correct: 0,
      incorrect: 0,
      averageAccuracy: 0
    };
  }

  /**
   * Register a custom validator
   * @param {string} type - Validator type name
   * @param {Function} validator - Validation function (input, expected) => {correct, accuracy}
   */
  registerValidator(type, validator) {
    this.validators[type] = validator;
    console.log(`📋 Registered validator: ${type}`);
  }

  /**
   * Validate using a specific validator type
   * @param {string} type - Validator type
   * @param {any} input - User input
   * @param {any} expected - Expected value
   * @returns {Object} Validation result
   */
  validateWithType(type, input, expected) {
    const validator = this.validators[type];
    if (!validator) {
      console.warn(`Validator type "${type}" not found`);
      return this.validateGeneric(input, expected);
    }

    return this.recordValidation(validator(input, expected));
  }

  /**
   * Generic validation for common types
   * @param {any} input
   * @param {any} expected
   * @returns {Object} Validation result
   */
  validateGeneric(input, expected) {
    // Determine type and validate
    if (Array.isArray(expected)) {
      return this.recordValidation(this.validateArray(input, expected));
    } else if (typeof expected === 'number') {
      return this.recordValidation(this.validateNumber(input, expected));
    } else if (typeof expected === 'string') {
      return this.recordValidation(this.validateString(input, expected));
    } else if (typeof expected === 'object') {
      return this.recordValidation(this.validateObject(input, expected));
    }

    // Fallback to exact match
    return this.recordValidation({
      correct: input === expected,
      accuracy: input === expected ? 100 : 0,
      type: 'exact'
    });
  }

  /**
   * Validate numeric values with tolerance
   * @param {number} input
   * @param {number} expected
   * @returns {Object}
   */
  validateNumber(input, expected) {
    const numInput = parseFloat(input);
    const numExpected = parseFloat(expected);

    if (isNaN(numInput) || isNaN(numExpected)) {
      return { correct: false, accuracy: 0, type: 'number' };
    }

    const difference = Math.abs(numInput - numExpected);
    const tolerance = this.strictMode ? 0 : this.tolerance * Math.abs(numExpected);
    const correct = difference <= tolerance;

    // Calculate accuracy (100% at exact, decreasing with distance)
    const accuracy = Math.max(0, 100 * (1 - difference / Math.abs(numExpected || 1)));

    return {
      correct,
      accuracy: Math.min(100, accuracy),
      type: 'number',
      difference,
      tolerance
    };
  }

  /**
   * Validate string values
   * @param {string} input
   * @param {string} expected
   * @returns {Object}
   */
  validateString(input, expected) {
    const strInput = String(input).trim();
    const strExpected = String(expected).trim();

    const exactMatch = strInput === strExpected;
    const caseInsensitiveMatch = strInput.toLowerCase() === strExpected.toLowerCase();

    // Calculate similarity (Levenshtein distance)
    const similarity = this.calculateStringSimilarity(strInput, strExpected);

    return {
      correct: this.strictMode ? exactMatch : caseInsensitiveMatch,
      accuracy: similarity,
      type: 'string',
      exactMatch,
      caseInsensitiveMatch
    };
  }

  /**
   * Validate array values (order matters)
   * @param {Array} input
   * @param {Array} expected
   * @returns {Object}
   */
  validateArray(input, expected) {
    if (!Array.isArray(input)) {
      return { correct: false, accuracy: 0, type: 'array' };
    }

    // Check each element
    let correctCount = 0;
    const maxLength = Math.max(input.length, expected.length);

    for (let i = 0; i < maxLength; i++) {
      if (i < input.length && i < expected.length) {
        if (this.compareValues(input[i], expected[i])) {
          correctCount++;
        }
      }
    }

    const accuracy = maxLength > 0 ? (correctCount / maxLength) * 100 : 0;
    const correct = correctCount === maxLength;

    return {
      correct,
      accuracy,
      type: 'array',
      correctCount,
      total: maxLength,
      inputLength: input.length,
      expectedLength: expected.length
    };
  }

  /**
   * Validate object values
   * @param {Object} input
   * @param {Object} expected
   * @returns {Object}
   */
  validateObject(input, expected) {
    if (!input || typeof input !== 'object') {
      return { correct: false, accuracy: 0, type: 'object' };
    }

    const expectedKeys = Object.keys(expected);
    const inputKeys = Object.keys(input);
    const allKeys = new Set([...expectedKeys, ...inputKeys]);

    let correctCount = 0;
    let totalFields = allKeys.size;

    for (const key of allKeys) {
      if (key in expected && key in input) {
        if (this.compareValues(input[key], expected[key])) {
          correctCount++;
        }
      }
    }

    const accuracy = totalFields > 0 ? (correctCount / totalFields) * 100 : 0;
    const correct = correctCount === totalFields;

    return {
      correct,
      accuracy,
      type: 'object',
      correctFields: correctCount,
      totalFields,
      missingFields: expectedKeys.filter(k => !(k in input)),
      extraFields: inputKeys.filter(k => !(k in expected))
    };
  }

  /**
   * Validate rhythm/timing patterns
   * @param {Array<number>} inputTimestamps
   * @param {Array<number>} expectedTimestamps
   * @param {number} toleranceMs - Timing tolerance in milliseconds
   * @returns {Object}
   */
  validateRhythm(inputTimestamps, expectedTimestamps, toleranceMs = 50) {
    if (!Array.isArray(inputTimestamps) || !Array.isArray(expectedTimestamps)) {
      return { correct: false, accuracy: 0, type: 'rhythm' };
    }

    let matched = 0;
    let totalError = 0;

    // Match each expected timestamp to nearest input
    for (const expected of expectedTimestamps) {
      const nearest = this.findNearestTimestamp(expected, inputTimestamps);
      if (nearest !== null && Math.abs(nearest - expected) <= toleranceMs) {
        matched++;
        totalError += Math.abs(nearest - expected);
      }
    }

    const accuracy = expectedTimestamps.length > 0
      ? (matched / expectedTimestamps.length) * 100
      : 0;

    const avgError = matched > 0 ? totalError / matched : 0;

    return {
      correct: matched === expectedTimestamps.length,
      accuracy,
      type: 'rhythm',
      matched,
      total: expectedTimestamps.length,
      averageError: avgError,
      toleranceMs
    };
  }

  /**
   * Find nearest timestamp
   * @private
   */
  findNearestTimestamp(target, timestamps) {
    if (timestamps.length === 0) return null;

    let nearest = timestamps[0];
    let minDiff = Math.abs(target - timestamps[0]);

    for (const ts of timestamps) {
      const diff = Math.abs(target - ts);
      if (diff < minDiff) {
        minDiff = diff;
        nearest = ts;
      }
    }

    return nearest;
  }

  /**
   * Compare two values with tolerance
   * @private
   */
  compareValues(a, b) {
    if (typeof a === 'number' && typeof b === 'number') {
      const diff = Math.abs(a - b);
      const tolerance = this.strictMode ? 0 : this.tolerance * Math.abs(b);
      return diff <= tolerance;
    }
    return a === b;
  }

  /**
   * Calculate string similarity (simple algorithm)
   * @private
   */
  calculateStringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 100;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return ((longer.length - editDistance) / longer.length) * 100;
  }

  /**
   * Levenshtein distance algorithm
   * @private
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Record validation result
   * @private
   */
  recordValidation(result) {
    // Add timestamp
    result.timestamp = Date.now();

    // Update history
    this.history.push(result);

    // Update statistics
    this.statistics.total++;
    if (result.correct) {
      this.statistics.correct++;
    } else {
      this.statistics.incorrect++;
    }

    // Update average accuracy
    const totalAccuracy = this.history.reduce((sum, h) => sum + h.accuracy, 0);
    this.statistics.averageAccuracy = totalAccuracy / this.history.length;

    return result;
  }

  /**
   * Get validation statistics
   * @returns {Object}
   */
  getStatistics() {
    return {
      ...this.statistics,
      successRate: this.statistics.total > 0
        ? (this.statistics.correct / this.statistics.total) * 100
        : 0,
      recentHistory: this.history.slice(-10)
    };
  }

  /**
   * Reset validation system
   */
  reset() {
    this.history = [];
    this.statistics = {
      total: 0,
      correct: 0,
      incorrect: 0,
      averageAccuracy: 0
    };
    console.log('🔄 Validation system reset');
  }
}