/**
 * Game State Manager
 * Manages game state, persistence, and state transitions
 */

/**
 * Manages the state of a game including persistence and restoration
 */
export class GameStateManager {
  constructor(config = {}) {
    this.gameId = config.gameId || 'default_game';
    this.version = config.version || '1.0.0';
    this.autoSave = config.autoSave !== false;
    this.saveInterval = config.saveInterval || 30000; // Auto-save every 30 seconds
    this.maxSnapshots = config.maxSnapshots || 5;

    // State structure
    this.state = this.createInitialState(config.initialState);

    // Snapshots for undo/redo
    this.snapshots = [];
    this.snapshotIndex = -1;

    // State change listeners
    this.listeners = [];

    // Auto-save timer
    this.autoSaveTimer = null;

    // Load saved state if available
    if (config.loadOnInit !== false) {
      this.loadState();
    }

    // Start auto-save if enabled
    if (this.autoSave) {
      this.startAutoSave();
    }
  }

  /**
   * Create initial state structure
   * @private
   */
  createInitialState(customState = {}) {
    return {
      // Meta information
      meta: {
        gameId: this.gameId,
        version: this.version,
        createdAt: Date.now(),
        lastUpdated: Date.now(),
        sessionId: this.generateSessionId()
      },

      // Game progress
      progress: {
        currentLevel: 1,
        currentPhase: null,
        levelsCompleted: [],
        levelsUnlocked: [1],
        highScore: 0,
        totalScore: 0,
        ...customState.progress
      },

      // Player stats
      stats: {
        totalPlays: 0,
        totalTime: 0,
        averageAccuracy: 0,
        bestAccuracy: 0,
        streak: 0,
        bestStreak: 0,
        ...customState.stats
      },

      // Current session
      session: {
        startTime: Date.now(),
        attempts: [],
        score: 0,
        accuracy: 0,
        ...customState.session
      },

      // Game-specific data
      gameData: {
        ...customState.gameData
      },

      // Settings
      settings: {
        difficulty: 'normal',
        soundEnabled: true,
        musicEnabled: true,
        ...customState.settings
      }
    };
  }

  /**
   * Get current state
   * @returns {Object} Current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Get specific state path
   * @param {string} path - Dot-notated path (e.g., 'progress.currentLevel')
   * @returns {any} Value at path
   */
  get(path) {
    const keys = path.split('.');
    let value = this.state;

    for (const key of keys) {
      if (value && typeof value === 'object') {
        value = value[key];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Set state value at path
   * @param {string} path - Dot-notated path
   * @param {any} value - Value to set
   */
  set(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let target = this.state;

    // Navigate to target object
    for (const key of keys) {
      if (!(key in target)) {
        target[key] = {};
      }
      target = target[key];
    }

    // Set value
    const oldValue = target[lastKey];
    target[lastKey] = value;

    // Update metadata
    this.state.meta.lastUpdated = Date.now();

    // Notify listeners
    this.notifyListeners({
      path,
      oldValue,
      newValue: value
    });

    // Auto-save if enabled
    if (this.autoSave) {
      this.scheduleSave();
    }
  }

  /**
   * Update multiple state values
   * @param {Object} updates - Object with paths as keys and values
   */
  update(updates) {
    for (const [path, value] of Object.entries(updates)) {
      this.set(path, value);
    }
  }

  /**
   * Merge state with updates
   * @param {Object} partialState - Partial state to merge
   */
  mergeState(partialState) {
    this.state = this.deepMerge(this.state, partialState);
    this.state.meta.lastUpdated = Date.now();

    // Notify listeners
    this.notifyListeners({
      type: 'merge',
      updates: partialState
    });

    // Auto-save
    if (this.autoSave) {
      this.scheduleSave();
    }
  }

  /**
   * Create a snapshot of current state
   */
  createSnapshot() {
    // Remove future snapshots if we're not at the end
    if (this.snapshotIndex < this.snapshots.length - 1) {
      this.snapshots = this.snapshots.slice(0, this.snapshotIndex + 1);
    }

    // Add new snapshot
    this.snapshots.push({
      state: JSON.parse(JSON.stringify(this.state)),
      timestamp: Date.now()
    });

    // Limit snapshots
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    } else {
      this.snapshotIndex++;
    }

    console.log(`📸 Snapshot created (${this.snapshots.length}/${this.maxSnapshots})`);
  }

  /**
   * Undo to previous snapshot
   * @returns {boolean} True if undo was successful
   */
  undo() {
    if (this.snapshotIndex > 0) {
      this.snapshotIndex--;
      this.state = JSON.parse(JSON.stringify(this.snapshots[this.snapshotIndex].state));

      this.notifyListeners({ type: 'undo' });
      console.log('↩️ State undone');
      return true;
    }
    return false;
  }

  /**
   * Redo to next snapshot
   * @returns {boolean} True if redo was successful
   */
  redo() {
    if (this.snapshotIndex < this.snapshots.length - 1) {
      this.snapshotIndex++;
      this.state = JSON.parse(JSON.stringify(this.snapshots[this.snapshotIndex].state));

      this.notifyListeners({ type: 'redo' });
      console.log('↪️ State redone');
      return true;
    }
    return false;
  }

  /**
   * Save state to localStorage
   */
  saveState() {
    try {
      const key = `game_state_${this.gameId}`;
      const data = {
        state: this.state,
        snapshots: this.snapshots,
        snapshotIndex: this.snapshotIndex,
        savedAt: Date.now()
      };

      localStorage.setItem(key, JSON.stringify(data));
      console.log('💾 Game state saved');
      return true;
    } catch (e) {
      console.error('Failed to save game state:', e);
      return false;
    }
  }

  /**
   * Load state from localStorage
   * @returns {boolean} True if state was loaded
   */
  loadState() {
    try {
      const key = `game_state_${this.gameId}`;
      const saved = localStorage.getItem(key);

      if (!saved) return false;

      const data = JSON.parse(saved);

      // Check version compatibility
      if (data.state.meta.version !== this.version) {
        console.warn(`Version mismatch: ${data.state.meta.version} vs ${this.version}`);
        // Could implement migration here
      }

      this.state = data.state;
      this.snapshots = data.snapshots || [];
      this.snapshotIndex = data.snapshotIndex || -1;

      // Update session info
      this.state.meta.lastUpdated = Date.now();
      this.state.session.startTime = Date.now();

      console.log('📂 Game state loaded');
      this.notifyListeners({ type: 'load' });
      return true;
    } catch (e) {
      console.error('Failed to load game state:', e);
      return false;
    }
  }

  /**
   * Clear saved state
   */
  clearSavedState() {
    const key = `game_state_${this.gameId}`;
    localStorage.removeItem(key);
    console.log('🗑️ Saved state cleared');
  }

  /**
   * Reset to initial state
   */
  reset() {
    this.state = this.createInitialState();
    this.snapshots = [];
    this.snapshotIndex = -1;

    this.notifyListeners({ type: 'reset' });
    console.log('🔄 State reset to initial');

    if (this.autoSave) {
      this.saveState();
    }
  }

  /**
   * Add state change listener
   * @param {Function} listener
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of state change
   * @private
   */
  notifyListeners(change) {
    for (const listener of this.listeners) {
      try {
        listener(this.state, change);
      } catch (e) {
        console.error('State listener error:', e);
      }
    }
  }

  /**
   * Start auto-save timer
   * @private
   */
  startAutoSave() {
    this.stopAutoSave();
    this.autoSaveTimer = setInterval(() => {
      this.saveState();
    }, this.saveInterval);
  }

  /**
   * Stop auto-save timer
   * @private
   */
  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * Schedule a save operation (debounced)
   * @private
   */
  scheduleSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveState();
    }, 1000); // Save 1 second after last change
  }

  /**
   * Deep merge two objects
   * @private
   */
  deepMerge(target, source) {
    const output = { ...target };

    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            output[key] = source[key];
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          output[key] = source[key];
        }
      });
    }

    return output;
  }

  /**
   * Check if value is an object
   * @private
   */
  isObject(item) {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  /**
   * Generate unique session ID
   * @private
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get state statistics
   * @returns {Object}
   */
  getStatistics() {
    return {
      sessionDuration: Date.now() - this.state.session.startTime,
      totalAttempts: this.state.session.attempts.length,
      averageAccuracy: this.state.stats.averageAccuracy,
      currentStreak: this.state.stats.streak,
      levelsCompleted: this.state.progress.levelsCompleted.length,
      totalScore: this.state.progress.totalScore
    };
  }

  /**
   * Export state as JSON
   * @returns {string}
   */
  exportState() {
    return JSON.stringify({
      state: this.state,
      exportedAt: Date.now(),
      version: this.version
    }, null, 2);
  }

  /**
   * Import state from JSON
   * @param {string} json
   * @returns {boolean}
   */
  importState(json) {
    try {
      const data = JSON.parse(json);
      this.state = data.state;
      this.notifyListeners({ type: 'import' });
      return true;
    } catch (e) {
      console.error('Failed to import state:', e);
      return false;
    }
  }

  /**
   * Dispose of resources
   */
  dispose() {
    this.stopAutoSave();
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.listeners = [];
    console.log('🧹 State manager disposed');
  }
}