/**
 * Level System
 * Generic level management system for gamification
 */

/**
 * Manages game levels and progression
 */
export class LevelSystem {
  constructor(config = {}) {
    this.levels = config.levels || [];
    this.currentLevel = 1;
    this.maxLevel = this.levels.length;
    this.unlocked = config.unlocked || [1]; // Level 1 always unlocked
    this.completed = config.completed || [];
    this.scores = config.scores || {};
  }

  /**
   * Get current level configuration
   * @returns {Object} Current level config
   */
  getCurrentLevel() {
    return this.getLevel(this.currentLevel);
  }

  /**
   * Get specific level configuration
   * @param {number} levelNumber
   * @returns {Object} Level config
   */
  getLevel(levelNumber) {
    if (levelNumber < 1 || levelNumber > this.maxLevel) {
      console.warn(`Invalid level number: ${levelNumber}`);
      return null;
    }
    return this.levels[levelNumber - 1];
  }

  /**
   * Check if a level is unlocked
   * @param {number} levelNumber
   * @returns {boolean}
   */
  isUnlocked(levelNumber) {
    return this.unlocked.includes(levelNumber);
  }

  /**
   * Check if a level is completed
   * @param {number} levelNumber
   * @returns {boolean}
   */
  isCompleted(levelNumber) {
    return this.completed.includes(levelNumber);
  }

  /**
   * Unlock a level
   * @param {number} levelNumber
   */
  unlockLevel(levelNumber) {
    if (!this.unlocked.includes(levelNumber)) {
      this.unlocked.push(levelNumber);
      this.unlocked.sort((a, b) => a - b);
      console.log(`🔓 Level ${levelNumber} unlocked!`);
    }
  }

  /**
   * Complete a level
   * @param {number} levelNumber
   * @param {number} score
   */
  completeLevel(levelNumber, score = 0) {
    // Mark as completed
    if (!this.completed.includes(levelNumber)) {
      this.completed.push(levelNumber);
      this.completed.sort((a, b) => a - b);
    }

    // Update high score
    if (!this.scores[levelNumber] || score > this.scores[levelNumber]) {
      this.scores[levelNumber] = score;
      console.log(`🏆 New high score for Level ${levelNumber}: ${score}`);
    }

    // Unlock next level
    if (levelNumber < this.maxLevel) {
      this.unlockLevel(levelNumber + 1);
    }

    // Save progress
    this.saveProgress();
  }

  /**
   * Move to next level
   * @returns {boolean} True if moved to next level, false if at max level
   */
  nextLevel() {
    if (this.currentLevel < this.maxLevel) {
      this.currentLevel++;
      console.log(`📈 Advanced to Level ${this.currentLevel}`);
      return true;
    }
    console.log('🎉 Already at maximum level!');
    return false;
  }

  /**
   * Move to previous level
   * @returns {boolean} True if moved to previous level, false if at level 1
   */
  previousLevel() {
    if (this.currentLevel > 1) {
      this.currentLevel--;
      console.log(`📉 Returned to Level ${this.currentLevel}`);
      return true;
    }
    return false;
  }

  /**
   * Set current level
   * @param {number} levelNumber
   * @returns {boolean} True if level was set, false if invalid or locked
   */
  setLevel(levelNumber) {
    if (levelNumber < 1 || levelNumber > this.maxLevel) {
      console.warn(`Invalid level number: ${levelNumber}`);
      return false;
    }

    if (!this.isUnlocked(levelNumber)) {
      console.warn(`Level ${levelNumber} is locked`);
      return false;
    }

    this.currentLevel = levelNumber;
    console.log(`📍 Current level set to ${levelNumber}`);
    return true;
  }

  /**
   * Get level progress statistics
   * @returns {Object} Progress stats
   */
  getProgress() {
    return {
      current: this.currentLevel,
      completed: this.completed.length,
      total: this.maxLevel,
      percentage: Math.round((this.completed.length / this.maxLevel) * 100),
      unlocked: this.unlocked.length,
      scores: this.scores,
      totalScore: Object.values(this.scores).reduce((sum, score) => sum + score, 0)
    };
  }

  /**
   * Get high score for a level
   * @param {number} levelNumber
   * @returns {number} High score or 0
   */
  getHighScore(levelNumber) {
    return this.scores[levelNumber] || 0;
  }

  /**
   * Get total score across all levels
   * @returns {number} Total score
   */
  getTotalScore() {
    return Object.values(this.scores).reduce((sum, score) => sum + score, 0);
  }

  /**
   * Reset level progress
   */
  reset() {
    this.currentLevel = 1;
    this.unlocked = [1];
    this.completed = [];
    this.scores = {};
    console.log('🔄 Level progress reset');
  }

  /**
   * Save progress to localStorage
   * @param {string} key - Storage key prefix
   */
  saveProgress(key = 'level_progress') {
    const data = {
      currentLevel: this.currentLevel,
      unlocked: this.unlocked,
      completed: this.completed,
      scores: this.scores,
      timestamp: Date.now()
    };

    localStorage.setItem(key, JSON.stringify(data));
    console.log('💾 Level progress saved');
  }

  /**
   * Load progress from localStorage
   * @param {string} key - Storage key prefix
   * @returns {boolean} True if progress was loaded
   */
  loadProgress(key = 'level_progress') {
    const saved = localStorage.getItem(key);
    if (!saved) return false;

    try {
      const data = JSON.parse(saved);
      this.currentLevel = data.currentLevel || 1;
      this.unlocked = data.unlocked || [1];
      this.completed = data.completed || [];
      this.scores = data.scores || {};
      console.log('📂 Level progress loaded');
      return true;
    } catch (e) {
      console.error('Failed to load level progress:', e);
      return false;
    }
  }
}

/**
 * Create a standard 4-level progression system
 * @param {Object} config - Level configurations
 * @returns {LevelSystem}
 */
export function createStandardLevelSystem(config = {}) {
  const defaultLevels = [
    {
      number: 1,
      name: 'Beginner',
      difficulty: 'easy',
      description: 'Learn the basics',
      ...config.level1
    },
    {
      number: 2,
      name: 'Intermediate',
      difficulty: 'medium',
      description: 'Build your skills',
      ...config.level2
    },
    {
      number: 3,
      name: 'Advanced',
      difficulty: 'hard',
      description: 'Master the techniques',
      ...config.level3
    },
    {
      number: 4,
      name: 'Expert',
      difficulty: 'expert',
      description: 'Prove your mastery',
      ...config.level4
    }
  ];

  return new LevelSystem({
    levels: defaultLevels,
    ...config
  });
}