/**
 * Fraction Game Base
 * Base class for fraction-based games (App3)
 */

import { BaseGameManager } from '../shared/BaseGameManager.js';

/**
 * Base manager for fraction recognition games
 */
export class FractionGameBase extends BaseGameManager {
  constructor(config = {}) {
    super(config);

    // Fraction game specific configuration
    this.fractionRange = config.fractionRange || { n: [1], d: [2, 3, 4] };
    this.bpm = config.bpm || 120;
    this.cycleLength = config.cycleLength || 2000; // ms

    // Current fraction
    this.currentFraction = null;
    this.userAnswer = { n: null, d: null };
  }

  /**
   * Get level configuration for fraction game
   */
  getLevelConfig(levelNumber) {
    const configs = {
      1: {
        name: 'Fracciones Simples',
        fractionRange: { n: [1], d: [2, 3, 4] },
        questionsPerLevel: 5,
        bpm: 120,
        description: 'Identifica fracciones simples (n=1)'
      },
      2: {
        name: 'Fracciones Medias',
        fractionRange: { n: [1, 2], d: [2, 3, 4, 5, 6] },
        questionsPerLevel: 8,
        bpm: 100,
        description: 'Identifica fracciones con n=1-2'
      },
      3: {
        name: 'Fracciones Complejas',
        fractionRange: { n: [1, 2, 3], d: [2, 3, 4, 5, 6, 7, 8] },
        questionsPerLevel: 10,
        bpm: 90,
        description: 'Identifica fracciones complejas'
      },
      4: {
        name: 'Fracciones Avanzadas',
        fractionRange: { n: [1, 2, 3, 4, 5], d: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
        questionsPerLevel: 12,
        bpm: 80,
        description: 'Domina todas las fracciones'
      }
    };

    return configs[levelNumber] || configs[1];
  }

  /**
   * Initialize level with fraction-specific setup
   */
  initializeLevel(config) {
    this.fractionRange = config.fractionRange;
    this.bpm = config.bpm;
    this.questionsRemaining = config.questionsPerLevel;
    this.currentQuestionNumber = 0;
    this.levelQuestions = [];

    console.log(`🎵 Fraction level initialized: ${config.name}`);
  }

  /**
   * Execute phase logic for fraction game
   */
  executePhase(phaseNumber) {
    switch (phaseNumber) {
      case 1: // Generate and play fraction
        this.generateAndPlayFraction();
        break;
      case 2: // User input
        this.getUserInput();
        break;
      case 3: // Validation
        this.validateFractionAnswer();
        break;
      default:
        console.warn('Unknown phase:', phaseNumber);
    }
  }

  /**
   * Generate a random fraction based on level
   * @private
   */
  generateRandomFraction() {
    const { n: nRange, d: dRange } = this.fractionRange;

    const n = nRange[Math.floor(Math.random() * nRange.length)];
    const d = dRange[Math.floor(Math.random() * dRange.length)];

    // Ensure n < d (proper fraction)
    if (n >= d) {
      return this.generateRandomFraction();
    }

    return { n, d };
  }

  /**
   * Generate and play a fraction
   * @private
   */
  async generateAndPlayFraction() {
    // Generate new fraction
    this.currentFraction = this.generateRandomFraction();
    this.currentQuestionNumber++;

    console.log(`🎲 Generated fraction: ${this.currentFraction.n}/${this.currentFraction.d}`);

    // Show playing UI
    if (this.ui && this.ui.showPlaying) {
      this.ui.showPlaying({
        questionNumber: this.currentQuestionNumber,
        totalQuestions: this.questionsRemaining
      });
    }

    // Play fraction audio (to be implemented by app)
    await this.playFractionAudio(this.currentFraction);

    // Move to input phase
    this.handlePhaseTransition(2);
  }

  /**
   * Play fraction audio (stub - implement in app)
   * @private
   */
  async playFractionAudio(fraction) {
    console.log(`🔊 Playing fraction ${fraction.n}/${fraction.d}`);

    // This should be implemented by the specific app
    // as it needs access to the app's audio system

    // Simulate playback
    const duration = this.cycleLength;
    await new Promise(resolve => setTimeout(resolve, duration));
  }

  /**
   * Get user input for fraction
   * @private
   */
  getUserInput() {
    console.log('⌨️ Waiting for user input...');

    // Show input UI
    if (this.ui && this.ui.showFractionInput) {
      this.ui.showFractionInput({
        onSubmit: (n, d) => {
          this.userAnswer = { n, d };
          this.handlePhaseTransition(3);
        },
        onPlayAgain: () => {
          this.playFractionAudio(this.currentFraction);
        }
      });
    }
  }

  /**
   * Validate fraction answer
   * @private
   */
  validateFractionAnswer() {
    const correct = this.userAnswer.n === this.currentFraction.n &&
                   this.userAnswer.d === this.currentFraction.d;

    const accuracy = correct ? 100 : 0;

    // Record attempt
    const result = this.validateAttempt(
      this.userAnswer,
      this.currentFraction
    );

    // Show feedback
    if (this.ui && this.ui.showFeedback) {
      this.ui.showFeedback({
        correct,
        userAnswer: this.userAnswer,
        correctAnswer: this.currentFraction,
        accuracy
      });
    }

    // Update questions remaining
    this.questionsRemaining--;

    // Check if level complete
    if (this.questionsRemaining <= 0) {
      setTimeout(() => {
        this.completeLevel();
      }, 2000);
    } else {
      // Continue to next question
      setTimeout(() => {
        this.startPhase(1);
      }, 2000);
    }
  }

  /**
   * Calculate accuracy for fraction answers
   */
  calculateAccuracy(userAnswer, correctAnswer) {
    if (!userAnswer || !correctAnswer) {
      return { correct: false, accuracy: 0 };
    }

    const correct = userAnswer.n === correctAnswer.n &&
                   userAnswer.d === correctAnswer.d;

    // Partial credit for close answers
    let accuracy = 0;
    if (correct) {
      accuracy = 100;
    } else if (userAnswer.n === correctAnswer.n) {
      accuracy = 50; // Correct numerator
    } else if (userAnswer.d === correctAnswer.d) {
      accuracy = 30; // Correct denominator
    }

    return {
      correct,
      accuracy,
      partialCredit: accuracy > 0 && accuracy < 100
    };
  }
}

/**
 * Create a fraction game with standard configuration
 * @param {Object} config
 * @returns {FractionGameBase}
 */
export function createFractionGame(config = {}) {
  return new FractionGameBase({
    appId: config.appId || 'fraction_game',
    gameName: config.gameName || 'Fraction Recognition',
    maxLevels: 4,
    ...config
  });
}