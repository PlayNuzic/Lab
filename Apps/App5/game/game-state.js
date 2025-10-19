/**
 * Game state management for App5 gamification
 * Handles localStorage persistence and statistics
 */

export class GameState {
  constructor() {
    this.storageKey = 'app5-game-state';
    this.statsKey = 'app5-game-stats';
    this.achievementsKey = 'app5-game-achievements';

    // Current game state
    this.currentLevel = 1;
    this.completedLevels = [];
    this.currentStreak = 0;
    this.lastPlayedDate = null;
    this.totalPlayTime = 0; // in seconds
    this.sessionStartTime = Date.now();

    // Statistics
    this.statistics = {
      totalGames: 0,
      totalAttempts: 0,
      successfulAttempts: 0,
      averageAccuracy: 0,
      bestStreak: 0,
      totalPerfectScores: 0,
      averageResponseTime: 0, // milliseconds
      levelStats: {
        1: { attempts: 0, completions: 0, bestAccuracy: 0, averageTime: 0 },
        2: { attempts: 0, completions: 0, bestAccuracy: 0, averageTime: 0 },
        3: { attempts: 0, completions: 0, bestAccuracy: 0, averageTime: 0 },
        4: { attempts: 0, completions: 0, bestAccuracy: 0, averageTime: 0 }
      }
    };

    // Achievements
    this.achievements = {
      firstStep: false, // Complete level 1
      evenOdd: false, // Complete both level 1 and 2
      adaptive: false, // Complete level 3
      freeSpirit: false, // Complete level 4 with custom pattern
      perfectScore: false, // Get 100% accuracy
      streakMaster: false, // Get 5 wins in a row
      speedDemon: false, // Complete a level in under 10 seconds
      persistent: false, // Play 10 games
      expert: false // Complete all levels
    };

    // Load saved state
    this.load();
  }

  /**
   * Load state from localStorage
   */
  load() {
    try {
      // Load main state
      const savedState = localStorage.getItem(this.storageKey);
      if (savedState) {
        const parsed = JSON.parse(savedState);
        this.currentLevel = parsed.currentLevel || 1;
        this.completedLevels = parsed.completedLevels || [];
        this.currentStreak = parsed.currentStreak || 0;
        this.lastPlayedDate = parsed.lastPlayedDate;
        this.totalPlayTime = parsed.totalPlayTime || 0;
      }

      // Load statistics
      const savedStats = localStorage.getItem(this.statsKey);
      if (savedStats) {
        this.statistics = { ...this.statistics, ...JSON.parse(savedStats) };
      }

      // Load achievements
      const savedAchievements = localStorage.getItem(this.achievementsKey);
      if (savedAchievements) {
        this.achievements = { ...this.achievements, ...JSON.parse(savedAchievements) };
      }

      console.log('Game state loaded:', {
        level: this.currentLevel,
        completed: this.completedLevels,
        streak: this.currentStreak
      });
    } catch (error) {
      console.error('Error loading game state:', error);
    }
  }

  /**
   * Save state to localStorage
   */
  save() {
    try {
      // Update play time
      const sessionTime = Math.floor((Date.now() - this.sessionStartTime) / 1000);
      this.totalPlayTime += sessionTime;
      this.sessionStartTime = Date.now();

      // Save main state
      localStorage.setItem(this.storageKey, JSON.stringify({
        currentLevel: this.currentLevel,
        completedLevels: this.completedLevels,
        currentStreak: this.currentStreak,
        lastPlayedDate: new Date().toISOString(),
        totalPlayTime: this.totalPlayTime
      }));

      // Save statistics
      localStorage.setItem(this.statsKey, JSON.stringify(this.statistics));

      // Save achievements
      localStorage.setItem(this.achievementsKey, JSON.stringify(this.achievements));

      console.log('Game state saved');
    } catch (error) {
      console.error('Error saving game state:', error);
    }
  }

  /**
   * Mark a level as completed
   * @param {number} level - Level number
   * @param {number} accuracy - Accuracy percentage (0-100)
   * @param {number} responseTime - Time taken in milliseconds
   * @param {Object} rhythmData - Optional rhythm analysis data
   */
  markLevelComplete(level, accuracy, responseTime, rhythmData = null) {
    // Update completed levels
    if (!this.completedLevels.includes(level)) {
      this.completedLevels.push(level);
      this.completedLevels.sort((a, b) => a - b);
    }

    // Update statistics
    this.statistics.totalAttempts++;
    if (accuracy >= 50) {
      this.statistics.successfulAttempts++;
      this.currentStreak++;
      if (this.currentStreak > this.statistics.bestStreak) {
        this.statistics.bestStreak = this.currentStreak;
      }
    } else {
      this.currentStreak = 0;
    }

    // Update average accuracy
    const totalAccuracy = (this.statistics.averageAccuracy * (this.statistics.totalAttempts - 1)) + accuracy;
    this.statistics.averageAccuracy = totalAccuracy / this.statistics.totalAttempts;

    // Update level-specific stats
    const levelStats = this.statistics.levelStats[level];
    if (levelStats) {
      levelStats.attempts++;
      if (accuracy >= 50) {
        levelStats.completions++;
      }
      if (accuracy > levelStats.bestAccuracy) {
        levelStats.bestAccuracy = accuracy;
      }
      // Update average time
      const totalTime = (levelStats.averageTime * (levelStats.attempts - 1)) + responseTime;
      levelStats.averageTime = totalTime / levelStats.attempts;
    }

    // Update average response time
    const totalResponseTime = (this.statistics.averageResponseTime * (this.statistics.totalAttempts - 1)) + responseTime;
    this.statistics.averageResponseTime = totalResponseTime / this.statistics.totalAttempts;

    // Check for perfect score
    if (accuracy === 100) {
      this.statistics.totalPerfectScores++;
    }

    // Check achievements
    this.checkAchievements(level, accuracy, responseTime);

    // Auto-advance to next level if successful
    if (accuracy >= 50 && level < 4) {
      this.currentLevel = Math.min(level + 1, 4);
    }

    // Save rhythm data if provided
    if (rhythmData) {
      this.saveRhythmAttempt(level, rhythmData);
    }

    // Save state
    this.save();
  }

  /**
   * Save rhythm attempt data
   * @param {number} level - Level number
   * @param {Object} rhythmData - Rhythm analysis data
   */
  saveRhythmAttempt(level, rhythmData) {
    const attemptKey = `app5-rhythm-attempts`;
    let attempts = [];

    try {
      const saved = localStorage.getItem(attemptKey);
      if (saved) {
        attempts = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading rhythm attempts:', error);
    }

    // Add new attempt
    attempts.push({
      level,
      timestamp: new Date().toISOString(),
      ...rhythmData
    });

    // Keep only last 100 attempts
    if (attempts.length > 100) {
      attempts = attempts.slice(-100);
    }

    try {
      localStorage.setItem(attemptKey, JSON.stringify(attempts));
    } catch (error) {
      console.error('Error saving rhythm attempts:', error);
    }
  }

  /**
   * Check and unlock achievements
   * @param {number} level - Level completed
   * @param {number} accuracy - Accuracy achieved
   * @param {number} responseTime - Time taken
   */
  checkAchievements(level, accuracy, responseTime) {
    const wasUnlocked = { ...this.achievements };

    // First Step - Complete level 1
    if (level === 1 && accuracy >= 50) {
      this.achievements.firstStep = true;
    }

    // Even Odd - Complete both level 1 and 2
    if (this.completedLevels.includes(1) && this.completedLevels.includes(2)) {
      this.achievements.evenOdd = true;
    }

    // Adaptive - Complete level 3
    if (level === 3 && accuracy >= 50) {
      this.achievements.adaptive = true;
    }

    // Free Spirit - Complete level 4
    if (level === 4 && accuracy >= 50) {
      this.achievements.freeSpirit = true;
    }

    // Perfect Score
    if (accuracy === 100) {
      this.achievements.perfectScore = true;
    }

    // Streak Master - 5 wins in a row
    if (this.currentStreak >= 5) {
      this.achievements.streakMaster = true;
    }

    // Speed Demon - Complete in under 10 seconds
    if (responseTime < 10000 && accuracy >= 50) {
      this.achievements.speedDemon = true;
    }

    // Persistent - Play 10 games
    if (this.statistics.totalAttempts >= 10) {
      this.achievements.persistent = true;
    }

    // Expert - Complete all levels
    if (this.completedLevels.length === 4) {
      this.achievements.expert = true;
    }

    // Return newly unlocked achievements
    const newlyUnlocked = [];
    for (const [key, value] of Object.entries(this.achievements)) {
      if (value && !wasUnlocked[key]) {
        newlyUnlocked.push(key);
      }
    }

    return newlyUnlocked;
  }

  /**
   * Get current progress percentage
   * @returns {number} Progress percentage (0-100)
   */
  getProgress() {
    const totalLevels = 4;
    return (this.completedLevels.length / totalLevels) * 100;
  }

  /**
   * Get statistics summary
   * @returns {Object} Statistics summary
   */
  getStatsSummary() {
    return {
      progress: this.getProgress(),
      currentLevel: this.currentLevel,
      completedLevels: this.completedLevels.length,
      totalAttempts: this.statistics.totalAttempts,
      successRate: this.statistics.totalAttempts > 0
        ? (this.statistics.successfulAttempts / this.statistics.totalAttempts) * 100
        : 0,
      averageAccuracy: this.statistics.averageAccuracy,
      currentStreak: this.currentStreak,
      bestStreak: this.statistics.bestStreak,
      perfectScores: this.statistics.totalPerfectScores,
      totalPlayTime: this.totalPlayTime,
      achievementsUnlocked: Object.values(this.achievements).filter(a => a).length,
      totalAchievements: Object.keys(this.achievements).length
    };
  }

  /**
   * Reset game state
   * @param {boolean} keepStats - Whether to keep statistics
   */
  reset(keepStats = false) {
    this.currentLevel = 1;
    this.completedLevels = [];
    this.currentStreak = 0;

    if (!keepStats) {
      // Reset statistics
      this.statistics = {
        totalGames: 0,
        totalAttempts: 0,
        successfulAttempts: 0,
        averageAccuracy: 0,
        bestStreak: 0,
        totalPerfectScores: 0,
        averageResponseTime: 0,
        levelStats: {
          1: { attempts: 0, completions: 0, bestAccuracy: 0, averageTime: 0 },
          2: { attempts: 0, completions: 0, bestAccuracy: 0, averageTime: 0 },
          3: { attempts: 0, completions: 0, bestAccuracy: 0, averageTime: 0 },
          4: { attempts: 0, completions: 0, bestAccuracy: 0, averageTime: 0 }
        }
      };

      // Reset achievements
      for (const key in this.achievements) {
        this.achievements[key] = false;
      }
    }

    this.save();
  }

  /**
   * Export game data
   * @returns {Object} Complete game data
   */
  export() {
    return {
      state: {
        currentLevel: this.currentLevel,
        completedLevels: this.completedLevels,
        currentStreak: this.currentStreak,
        lastPlayedDate: this.lastPlayedDate,
        totalPlayTime: this.totalPlayTime
      },
      statistics: this.statistics,
      achievements: this.achievements,
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Import game data
   * @param {Object} data - Game data to import
   */
  import(data) {
    if (data.state) {
      this.currentLevel = data.state.currentLevel || 1;
      this.completedLevels = data.state.completedLevels || [];
      this.currentStreak = data.state.currentStreak || 0;
      this.lastPlayedDate = data.state.lastPlayedDate;
      this.totalPlayTime = data.state.totalPlayTime || 0;
    }

    if (data.statistics) {
      this.statistics = { ...this.statistics, ...data.statistics };
    }

    if (data.achievements) {
      this.achievements = { ...this.achievements, ...data.achievements };
    }

    this.save();
  }
}