/**
 * Base Game Manager
 * Abstract class that provides common functionality for all gamification games
 */

import {
  trackEvent,
  EVENT_TYPES,
  recordAttempt
} from '../../index.js';

/**
 * Base class for all game managers
 * Provides common game flow, state management, and score calculation
 */
export class BaseGameManager {
  constructor(config = {}) {
    // Configuration
    this.appId = config.appId || 'unknown';
    this.gameName = config.gameName || 'Base Game';
    this.maxLevels = config.maxLevels || 4;

    // State
    this.currentLevel = 1;
    this.isGameActive = false;
    this.currentPhase = null;
    this.score = 0;
    this.attempts = [];

    // Timing
    this.gameStartTime = null;
    this.levelStartTime = null;
    this.phaseStartTime = null;

    // Callbacks
    this.onLevelComplete = config.onLevelComplete || (() => {});
    this.onGameComplete = config.onGameComplete || (() => {});
    this.onPhaseChange = config.onPhaseChange || (() => {});

    // UI References (to be set by subclasses)
    this.ui = null;
    this.state = null;
  }

  /**
   * Initialize the game manager
   * @abstract
   */
  async init() {
    console.log(`🎮 Initializing ${this.gameName}...`);
    this.gameStartTime = Date.now();

    // Track game initialization
    trackEvent(EVENT_TYPES.GAMIFICATION_ENABLED, {
      app_id: this.appId,
      game_name: this.gameName
    });

    return true;
  }

  /**
   * Start the game
   */
  startGame() {
    if (this.isGameActive) {
      console.warn('Game already active');
      return;
    }

    this.isGameActive = true;
    this.currentLevel = 1;
    this.score = 0;
    this.attempts = [];
    this.gameStartTime = Date.now();

    console.log(`🎮 Starting ${this.gameName}`);

    // Start first level
    this.startLevel(1);
  }

  /**
   * Start a specific level
   * @param {number} levelNumber
   */
  startLevel(levelNumber) {
    if (levelNumber > this.maxLevels) {
      console.log('🎉 All levels completed!');
      this.endGame(true);
      return;
    }

    this.currentLevel = levelNumber;
    this.levelStartTime = Date.now();

    console.log(`📊 Starting Level ${levelNumber}`);

    // Get level configuration
    const levelConfig = this.getLevelConfig(levelNumber);

    // Track level start
    trackEvent(EVENT_TYPES.LEVEL_STARTED, {
      app_id: this.appId,
      level: levelNumber,
      config: levelConfig
    });

    // Initialize level (to be implemented by subclasses)
    this.initializeLevel(levelConfig);

    // Start first phase
    this.startPhase(1);
  }

  /**
   * Get configuration for a specific level
   * @abstract
   * @param {number} levelNumber
   * @returns {Object} Level configuration
   */
  getLevelConfig(levelNumber) {
    // To be implemented by subclasses
    throw new Error('getLevelConfig must be implemented by subclass');
  }

  /**
   * Initialize level with specific configuration
   * @abstract
   * @param {Object} config
   */
  initializeLevel(config) {
    // To be implemented by subclasses
    throw new Error('initializeLevel must be implemented by subclass');
  }

  /**
   * Start a game phase
   * @param {number} phaseNumber
   */
  startPhase(phaseNumber) {
    this.currentPhase = phaseNumber;
    this.phaseStartTime = Date.now();

    console.log(`▶️ Starting Phase ${phaseNumber}`);

    // Notify phase change
    this.onPhaseChange(phaseNumber);

    // Execute phase logic (to be implemented by subclasses)
    this.executePhase(phaseNumber);
  }

  /**
   * Execute phase logic
   * @abstract
   * @param {number} phaseNumber
   */
  executePhase(phaseNumber) {
    // To be implemented by subclasses
    throw new Error('executePhase must be implemented by subclass');
  }

  /**
   * Handle phase transition
   * @param {number} nextPhase
   */
  handlePhaseTransition(nextPhase) {
    const phaseDuration = Date.now() - this.phaseStartTime;

    console.log(`✅ Phase ${this.currentPhase} completed in ${phaseDuration}ms`);

    // Track phase completion
    trackEvent(EVENT_TYPES.PHASE_COMPLETED, {
      app_id: this.appId,
      level: this.currentLevel,
      phase: this.currentPhase,
      duration: phaseDuration,
      next_phase: nextPhase
    });

    // Start next phase or complete level
    if (nextPhase) {
      this.startPhase(nextPhase);
    } else {
      this.completeLevel();
    }
  }

  /**
   * Validate user attempt
   * @param {any} userInput
   * @param {any} expected
   * @returns {Object} Validation result
   */
  validateAttempt(userInput, expected) {
    const attempt = {
      timestamp: Date.now(),
      level: this.currentLevel,
      phase: this.currentPhase,
      userInput,
      expected,
      correct: false,
      accuracy: 0
    };

    // Calculate accuracy (to be implemented by subclasses)
    const result = this.calculateAccuracy(userInput, expected);
    attempt.correct = result.correct;
    attempt.accuracy = result.accuracy;

    // Store attempt
    this.attempts.push(attempt);

    // Track attempt
    recordAttempt(this.appId, this.currentLevel, result.accuracy, {
      phase: this.currentPhase,
      attempt_number: this.attempts.length
    });

    return result;
  }

  /**
   * Calculate accuracy of user input
   * @abstract
   * @param {any} userInput
   * @param {any} expected
   * @returns {Object} {correct: boolean, accuracy: number}
   */
  calculateAccuracy(userInput, expected) {
    // To be implemented by subclasses
    throw new Error('calculateAccuracy must be implemented by subclass');
  }

  /**
   * Calculate score based on accuracy and time
   * @param {number} accuracy
   * @param {number} timeSpent
   * @returns {number} Score
   */
  calculateScore(accuracy, timeSpent) {
    // Base score from accuracy (0-100)
    let score = Math.round(accuracy * 100);

    // Time bonus (faster = more points)
    const timeBonus = Math.max(0, 100 - Math.floor(timeSpent / 1000));
    score += timeBonus;

    // Level multiplier
    score *= this.currentLevel;

    return Math.round(score);
  }

  /**
   * Complete the current level
   */
  completeLevel() {
    const levelDuration = Date.now() - this.levelStartTime;

    // Calculate level statistics
    const levelAttempts = this.attempts.filter(a => a.level === this.currentLevel);
    const avgAccuracy = levelAttempts.reduce((sum, a) => sum + a.accuracy, 0) / levelAttempts.length;
    const levelScore = this.calculateScore(avgAccuracy, levelDuration);

    this.score += levelScore;

    console.log(`🏆 Level ${this.currentLevel} completed!`);
    console.log(`   Score: ${levelScore}, Total: ${this.score}`);
    console.log(`   Accuracy: ${avgAccuracy.toFixed(1)}%`);

    // Track level completion
    trackEvent(EVENT_TYPES.LEVEL_COMPLETED, {
      app_id: this.appId,
      level: this.currentLevel,
      score: levelScore,
      total_score: this.score,
      accuracy: avgAccuracy,
      duration: levelDuration,
      attempts: levelAttempts.length
    });

    // Notify level completion
    this.onLevelComplete({
      level: this.currentLevel,
      score: levelScore,
      totalScore: this.score,
      accuracy: avgAccuracy,
      duration: levelDuration
    });

    // Show results
    this.showResults({
      level: this.currentLevel,
      score: levelScore,
      totalScore: this.score,
      accuracy: avgAccuracy,
      nextLevel: this.currentLevel < this.maxLevels ? this.currentLevel + 1 : null
    });
  }

  /**
   * Show results screen
   * @param {Object} results
   */
  showResults(results) {
    // To be implemented by subclasses or UI components
    console.log('📊 Results:', results);

    if (this.ui && this.ui.showResults) {
      this.ui.showResults(results);
    }
  }

  /**
   * Get next level or end game
   */
  getNextLevel() {
    if (this.currentLevel >= this.maxLevels) {
      return null;
    }
    return this.currentLevel + 1;
  }

  /**
   * Continue to next level
   */
  continueToNextLevel() {
    const nextLevel = this.getNextLevel();
    if (nextLevel) {
      this.startLevel(nextLevel);
    } else {
      this.endGame(true);
    }
  }

  /**
   * End the game
   * @param {boolean} completed - Whether all levels were completed
   */
  endGame(completed = false) {
    if (!this.isGameActive) return;

    this.isGameActive = false;
    const gameDuration = Date.now() - this.gameStartTime;

    console.log(`🎮 Game ended - ${completed ? 'Completed!' : 'Exited'}`);
    console.log(`   Final Score: ${this.score}`);
    console.log(`   Duration: ${(gameDuration / 1000).toFixed(1)}s`);

    // Calculate final statistics
    const avgAccuracy = this.attempts.reduce((sum, a) => sum + a.accuracy, 0) / this.attempts.length || 0;

    // Track game end
    trackEvent(completed ? EVENT_TYPES.GAME_COMPLETED : EVENT_TYPES.GAME_ABANDONED, {
      app_id: this.appId,
      final_score: this.score,
      levels_completed: this.currentLevel,
      total_attempts: this.attempts.length,
      avg_accuracy: avgAccuracy,
      duration: gameDuration
    });

    // Notify game completion
    this.onGameComplete({
      completed,
      score: this.score,
      levelsCompleted: this.currentLevel,
      avgAccuracy,
      duration: gameDuration
    });

    // Save progress
    this.saveProgress();
  }

  /**
   * Save game progress
   */
  saveProgress() {
    const progress = {
      appId: this.appId,
      gameName: this.gameName,
      lastLevel: this.currentLevel,
      highScore: this.score,
      attempts: this.attempts.length,
      timestamp: Date.now()
    };

    // Save to localStorage
    const key = `game_progress_${this.appId}`;
    localStorage.setItem(key, JSON.stringify(progress));

    console.log('💾 Progress saved');
  }

  /**
   * Load saved progress
   * @returns {Object|null} Saved progress or null
   */
  loadProgress() {
    const key = `game_progress_${this.appId}`;
    const saved = localStorage.getItem(key);

    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to load progress:', e);
      }
    }

    return null;
  }

  /**
   * Reset game state
   */
  reset() {
    this.currentLevel = 1;
    this.score = 0;
    this.attempts = [];
    this.currentPhase = null;
    this.isGameActive = false;

    console.log('🔄 Game reset');
  }

  /**
   * Cleanup resources
   */
  dispose() {
    this.reset();

    if (this.ui && this.ui.dispose) {
      this.ui.dispose();
    }

    console.log('🧹 Game manager disposed');
  }
}