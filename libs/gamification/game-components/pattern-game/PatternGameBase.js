/**
 * Pattern Game Base
 * Base class for pattern creation games (App4)
 */

import { BaseGameManager } from '../shared/BaseGameManager.js';

/**
 * Base manager for pattern creation games
 */
export class PatternGameBase extends BaseGameManager {
  constructor(config = {}) {
    super(config);

    // Pattern game specific configuration
    this.patternType = config.patternType || 'fraction';
    this.gridSize = config.gridSize || 8;
    this.allowedOperations = config.allowedOperations || ['create', 'modify'];

    // Current pattern challenge
    this.currentRequirement = null;
    this.userPattern = null;
    this.targetPattern = null;
  }

  /**
   * Get level configuration for pattern game
   */
  getLevelConfig(levelNumber) {
    const configs = {
      1: {
        name: 'Patrones Simples',
        requirements: [
          { type: 'fixed_n', n: 1, d: [2, 3, 4] },
          { type: 'fixed_d', d: 4, n: [1, 2, 3] }
        ],
        gridSize: 8,
        tolerance: 0.1,
        description: 'Crea patrones con fracciones simples'
      },
      2: {
        name: 'Patrones Medios',
        requirements: [
          { type: 'specific_fraction', n: 3, d: 4 },
          { type: 'total_pulses', count: 5 }
        ],
        gridSize: 12,
        tolerance: 0.08,
        description: 'Crea patrones específicos'
      },
      3: {
        name: 'Patrones Complejos',
        requirements: [
          { type: 'proportion', ratio: 0.75, description: '3/4 del compás' },
          { type: 'pattern_type', pattern: 'syncopated' }
        ],
        gridSize: 16,
        tolerance: 0.05,
        description: 'Crea proporciones específicas'
      },
      4: {
        name: 'Patrones Avanzados',
        requirements: [
          { type: 'multiple_conditions', conditions: [
            { type: 'min_pulses', count: 5 },
            { type: 'max_pulses', count: 8 },
            { type: 'specific_positions', positions: [1, 4, 7] }
          ]}
        ],
        gridSize: 16,
        tolerance: 0.03,
        description: 'Domina patrones con múltiples condiciones'
      }
    };

    return configs[levelNumber] || configs[1];
  }

  /**
   * Initialize level with pattern-specific setup
   */
  initializeLevel(config) {
    this.gridSize = config.gridSize;
    this.tolerance = config.tolerance;
    this.requirements = config.requirements;
    this.currentRequirementIndex = 0;

    console.log(`🎨 Pattern level initialized: ${config.name}`);
  }

  /**
   * Execute phase logic for pattern game
   */
  executePhase(phaseNumber) {
    switch (phaseNumber) {
      case 1: // Show requirement
        this.showRequirement();
        break;
      case 2: // User creation
        this.getUserPattern();
        break;
      case 3: // Validation
        this.validatePattern();
        break;
      default:
        console.warn('Unknown phase:', phaseNumber);
    }
  }

  /**
   * Show current requirement
   * @private
   */
  showRequirement() {
    // Get next requirement
    if (this.currentRequirementIndex >= this.requirements.length) {
      this.completeLevel();
      return;
    }

    this.currentRequirement = this.requirements[this.currentRequirementIndex];
    this.targetPattern = this.generateTargetPattern(this.currentRequirement);

    console.log(`📋 Requirement: ${JSON.stringify(this.currentRequirement)}`);

    // Show requirement UI
    if (this.ui && this.ui.showRequirement) {
      this.ui.showRequirement({
        requirement: this.currentRequirement,
        gridSize: this.gridSize,
        description: this.getRequirementDescription(this.currentRequirement)
      });
    }

    // Move to creation phase
    setTimeout(() => {
      this.handlePhaseTransition(2);
    }, 3000);
  }

  /**
   * Generate target pattern based on requirement
   * @private
   */
  generateTargetPattern(requirement) {
    const pattern = new Array(this.gridSize).fill(0);

    switch (requirement.type) {
      case 'fixed_n':
        // Create pattern with fixed numerator
        for (let i = 0; i < requirement.n; i++) {
          const pos = Math.floor((i + 1) * (this.gridSize / (requirement.n + 1)));
          pattern[pos] = 1;
        }
        break;

      case 'fixed_d':
        // Create pattern with fixed denominator
        for (let i = 0; i < this.gridSize; i += requirement.d) {
          pattern[i] = 1;
        }
        break;

      case 'specific_fraction':
        // Create specific fraction pattern
        const interval = Math.floor(this.gridSize * requirement.d / requirement.n);
        for (let i = 0; i < requirement.n; i++) {
          pattern[i * interval] = 1;
        }
        break;

      case 'total_pulses':
        // Create pattern with specific number of pulses
        const positions = new Set();
        while (positions.size < requirement.count) {
          positions.add(Math.floor(Math.random() * this.gridSize));
        }
        positions.forEach(pos => pattern[pos] = 1);
        break;

      case 'proportion':
        // Create pattern with specific proportion
        const pulseCount = Math.round(this.gridSize * requirement.ratio);
        for (let i = 0; i < pulseCount; i++) {
          pattern[Math.floor(i * this.gridSize / pulseCount)] = 1;
        }
        break;

      default:
        // Default pattern
        pattern[0] = 1;
        pattern[Math.floor(this.gridSize / 2)] = 1;
    }

    return pattern;
  }

  /**
   * Get human-readable requirement description
   * @private
   */
  getRequirementDescription(requirement) {
    switch (requirement.type) {
      case 'fixed_n':
        return `Crea un patrón con numerador ${requirement.n}`;
      case 'fixed_d':
        return `Crea un patrón con denominador ${requirement.d}`;
      case 'specific_fraction':
        return `Crea la fracción ${requirement.n}/${requirement.d}`;
      case 'total_pulses':
        return `Crea un patrón con exactamente ${requirement.count} pulsos`;
      case 'proportion':
        return requirement.description || `Crea una proporción de ${requirement.ratio}`;
      case 'pattern_type':
        return `Crea un patrón ${requirement.pattern}`;
      default:
        return 'Crea el patrón indicado';
    }
  }

  /**
   * Get user pattern creation
   * @private
   */
  getUserPattern() {
    console.log('🎨 User creating pattern...');

    // Initialize empty pattern
    this.userPattern = new Array(this.gridSize).fill(0);

    // Show pattern editor UI
    if (this.ui && this.ui.showPatternEditor) {
      this.ui.showPatternEditor({
        gridSize: this.gridSize,
        initialPattern: this.userPattern,
        requirement: this.currentRequirement,
        onPatternChange: (pattern) => {
          this.userPattern = pattern;
        },
        onSubmit: () => {
          this.handlePhaseTransition(3);
        },
        onHint: () => {
          this.showHint();
        }
      });
    }
  }

  /**
   * Show hint for current requirement
   * @private
   */
  showHint() {
    if (this.ui && this.ui.showHint) {
      this.ui.showHint({
        requirement: this.currentRequirement,
        targetPattern: this.targetPattern,
        currentPattern: this.userPattern
      });
    }
  }

  /**
   * Validate user pattern
   * @private
   */
  validatePattern() {
    console.log('🔍 Validating pattern...');

    // Calculate accuracy
    const result = this.calculatePatternAccuracy(
      this.userPattern,
      this.currentRequirement,
      this.targetPattern
    );

    // Record attempt
    this.validateAttempt(this.userPattern, this.targetPattern);

    // Show feedback
    if (this.ui && this.ui.showPatternFeedback) {
      this.ui.showPatternFeedback({
        correct: result.correct,
        accuracy: result.accuracy,
        userPattern: this.userPattern,
        targetPattern: this.targetPattern,
        feedback: result.feedback
      });
    }

    // Move to next requirement or complete level
    this.currentRequirementIndex++;

    if (result.correct) {
      setTimeout(() => {
        if (this.currentRequirementIndex >= this.requirements.length) {
          this.completeLevel();
        } else {
          this.startPhase(1);
        }
      }, 2000);
    } else {
      // Allow retry
      setTimeout(() => {
        if (this.ui && this.ui.showRetry) {
          this.ui.showRetry(() => {
            this.startPhase(2);
          });
        }
      }, 2000);
    }
  }

  /**
   * Calculate pattern accuracy
   * @private
   */
  calculatePatternAccuracy(userPattern, requirement, targetPattern) {
    let accuracy = 0;
    let correct = false;
    let feedback = '';

    // Count active pulses
    const userPulseCount = userPattern.filter(p => p === 1).length;
    const targetPulseCount = targetPattern.filter(p => p === 1).length;

    switch (requirement.type) {
      case 'total_pulses':
        correct = userPulseCount === requirement.count;
        accuracy = correct ? 100 :
          Math.max(0, 100 - Math.abs(userPulseCount - requirement.count) * 20);
        feedback = `Pulsos: ${userPulseCount}/${requirement.count}`;
        break;

      case 'specific_fraction':
        const userFraction = this.detectFraction(userPattern);
        correct = userFraction.n === requirement.n && userFraction.d === requirement.d;
        accuracy = correct ? 100 : 0;
        feedback = `Fracción: ${userFraction.n}/${userFraction.d}`;
        break;

      case 'proportion':
        const userRatio = userPulseCount / this.gridSize;
        const diff = Math.abs(userRatio - requirement.ratio);
        correct = diff <= this.tolerance;
        accuracy = Math.max(0, 100 * (1 - diff / requirement.ratio));
        feedback = `Proporción: ${(userRatio * 100).toFixed(1)}%`;
        break;

      default:
        // Compare patterns directly
        let matches = 0;
        for (let i = 0; i < this.gridSize; i++) {
          if (userPattern[i] === targetPattern[i]) matches++;
        }
        accuracy = (matches / this.gridSize) * 100;
        correct = accuracy >= 80;
        feedback = `Coincidencia: ${accuracy.toFixed(1)}%`;
    }

    return { correct, accuracy, feedback };
  }

  /**
   * Detect fraction from pattern
   * @private
   */
  detectFraction(pattern) {
    const pulses = [];
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] === 1) pulses.push(i);
    }

    if (pulses.length === 0) return { n: 0, d: 1 };
    if (pulses.length === 1) return { n: 1, d: pattern.length };

    // Find common interval
    const intervals = [];
    for (let i = 1; i < pulses.length; i++) {
      intervals.push(pulses[i] - pulses[i - 1]);
    }

    // Find GCD of intervals
    const gcd = intervals.reduce((a, b) => this.gcd(a, b));

    return {
      n: pulses.length,
      d: Math.floor(pattern.length / gcd)
    };
  }

  /**
   * Greatest common divisor
   * @private
   */
  gcd(a, b) {
    return b === 0 ? a : this.gcd(b, a % b);
  }

  /**
   * Calculate accuracy (override for pattern-specific logic)
   */
  calculateAccuracy(userPattern, targetPattern) {
    if (!this.currentRequirement) {
      return { correct: false, accuracy: 0 };
    }

    return this.calculatePatternAccuracy(
      userPattern,
      this.currentRequirement,
      targetPattern
    );
  }
}

/**
 * Create a pattern game with standard configuration
 * @param {Object} config
 * @returns {PatternGameBase}
 */
export function createPatternGame(config = {}) {
  return new PatternGameBase({
    appId: config.appId || 'pattern_game',
    gameName: config.gameName || 'Pattern Creation',
    maxLevels: 4,
    ...config
  });
}