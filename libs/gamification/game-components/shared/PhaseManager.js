/**
 * Phase Manager
 * Manages game phases and transitions
 */

/**
 * Manages different phases within a game level
 */
export class PhaseManager {
  constructor(config = {}) {
    this.phases = config.phases || [];
    this.currentPhase = null;
    this.phaseIndex = -1;
    this.phaseHistory = [];
    this.callbacks = {
      onPhaseStart: config.onPhaseStart || (() => {}),
      onPhaseEnd: config.onPhaseEnd || (() => {}),
      onPhaseTransition: config.onPhaseTransition || (() => {}),
      onAllPhasesComplete: config.onAllPhasesComplete || (() => {})
    };
    this.phaseStartTime = null;
    this.phaseDurations = {};
  }

  /**
   * Define phases for the current level
   * @param {Array} phases - Array of phase configurations
   */
  setPhases(phases) {
    this.phases = phases;
    this.reset();
  }

  /**
   * Start the phase sequence
   * @returns {Object|null} First phase or null if no phases
   */
  start() {
    if (!this.phases || this.phases.length === 0) {
      console.warn('No phases defined');
      return null;
    }

    this.phaseIndex = 0;
    return this.startPhase(this.phases[0]);
  }

  /**
   * Start a specific phase
   * @param {Object} phase - Phase configuration
   * @returns {Object} The started phase
   */
  startPhase(phase) {
    // End previous phase if any
    if (this.currentPhase) {
      this.endCurrentPhase();
    }

    this.currentPhase = phase;
    this.phaseStartTime = Date.now();

    console.log(`▶️ Starting phase: ${phase.name || phase.type || 'Phase ' + (this.phaseIndex + 1)}`);

    // Add to history
    this.phaseHistory.push({
      phase: { ...phase },
      startTime: this.phaseStartTime,
      index: this.phaseIndex
    });

    // Trigger callback
    this.callbacks.onPhaseStart(phase, this.phaseIndex);

    return phase;
  }

  /**
   * End the current phase
   */
  endCurrentPhase() {
    if (!this.currentPhase) return;

    const duration = Date.now() - this.phaseStartTime;
    const phaseName = this.currentPhase.name || this.currentPhase.type || `Phase ${this.phaseIndex + 1}`;

    // Store duration
    this.phaseDurations[phaseName] = duration;

    // Update history
    const lastHistory = this.phaseHistory[this.phaseHistory.length - 1];
    if (lastHistory) {
      lastHistory.endTime = Date.now();
      lastHistory.duration = duration;
    }

    console.log(`✅ Phase "${phaseName}" completed in ${duration}ms`);

    // Trigger callback
    this.callbacks.onPhaseEnd(this.currentPhase, this.phaseIndex, duration);

    this.currentPhase = null;
    this.phaseStartTime = null;
  }

  /**
   * Move to the next phase
   * @returns {Object|null} Next phase or null if all phases complete
   */
  nextPhase() {
    // End current phase
    this.endCurrentPhase();

    // Check if more phases available
    if (this.phaseIndex >= this.phases.length - 1) {
      console.log('🎉 All phases completed!');
      this.callbacks.onAllPhasesComplete(this.getPhaseStatistics());
      return null;
    }

    // Move to next phase
    this.phaseIndex++;
    const nextPhase = this.phases[this.phaseIndex];

    // Trigger transition callback
    const previousPhase = this.phaseIndex > 0 ? this.phases[this.phaseIndex - 1] : null;
    this.callbacks.onPhaseTransition(previousPhase, nextPhase);

    // Start next phase
    return this.startPhase(nextPhase);
  }

  /**
   * Skip to a specific phase
   * @param {number} phaseIndex - Index of phase to skip to
   * @returns {Object|null} The phase or null if invalid index
   */
  skipToPhase(phaseIndex) {
    if (phaseIndex < 0 || phaseIndex >= this.phases.length) {
      console.warn(`Invalid phase index: ${phaseIndex}`);
      return null;
    }

    // End current phase
    this.endCurrentPhase();

    // Set new index and start phase
    this.phaseIndex = phaseIndex;
    return this.startPhase(this.phases[phaseIndex]);
  }

  /**
   * Restart current phase
   * @returns {Object|null} Current phase or null
   */
  restartCurrentPhase() {
    if (!this.currentPhase) {
      console.warn('No current phase to restart');
      return null;
    }

    const phase = { ...this.currentPhase };
    this.endCurrentPhase();
    return this.startPhase(phase);
  }

  /**
   * Get current phase info
   * @returns {Object} Current phase information
   */
  getCurrentPhaseInfo() {
    return {
      phase: this.currentPhase,
      index: this.phaseIndex,
      name: this.currentPhase?.name || this.currentPhase?.type || null,
      elapsed: this.phaseStartTime ? Date.now() - this.phaseStartTime : 0,
      isActive: !!this.currentPhase
    };
  }

  /**
   * Get progress through phases
   * @returns {Object} Progress information
   */
  getProgress() {
    return {
      current: this.phaseIndex + 1,
      total: this.phases.length,
      percentage: this.phases.length > 0
        ? Math.round(((this.phaseIndex + 1) / this.phases.length) * 100)
        : 0,
      completed: this.phaseIndex >= this.phases.length - 1,
      history: this.phaseHistory
    };
  }

  /**
   * Get phase statistics
   * @returns {Object} Statistics about phases
   */
  getPhaseStatistics() {
    const totalDuration = Object.values(this.phaseDurations).reduce((sum, d) => sum + d, 0);
    const avgDuration = this.phaseHistory.length > 0
      ? totalDuration / this.phaseHistory.length
      : 0;

    return {
      totalPhases: this.phases.length,
      completedPhases: this.phaseHistory.length,
      totalDuration,
      averageDuration: Math.round(avgDuration),
      phaseDurations: { ...this.phaseDurations },
      history: this.phaseHistory.map(h => ({
        name: h.phase.name || h.phase.type,
        duration: h.duration || 0
      }))
    };
  }

  /**
   * Check if all phases are complete
   * @returns {boolean}
   */
  isComplete() {
    return this.phaseIndex >= this.phases.length - 1 && !this.currentPhase;
  }

  /**
   * Check if a specific phase type exists
   * @param {string} phaseType
   * @returns {boolean}
   */
  hasPhaseType(phaseType) {
    return this.phases.some(p => p.type === phaseType);
  }

  /**
   * Get phase by type
   * @param {string} phaseType
   * @returns {Object|null}
   */
  getPhaseByType(phaseType) {
    return this.phases.find(p => p.type === phaseType) || null;
  }

  /**
   * Reset phase manager
   */
  reset() {
    this.currentPhase = null;
    this.phaseIndex = -1;
    this.phaseHistory = [];
    this.phaseStartTime = null;
    this.phaseDurations = {};
    console.log('🔄 Phase manager reset');
  }

  /**
   * Dispose of resources
   */
  dispose() {
    this.reset();
    this.phases = [];
    this.callbacks = {
      onPhaseStart: () => {},
      onPhaseEnd: () => {},
      onPhaseTransition: () => {},
      onAllPhasesComplete: () => {}
    };
  }
}

/**
 * Create a standard 2-phase system (input → validation)
 * @param {Object} config
 * @returns {PhaseManager}
 */
export function createStandardPhaseManager(config = {}) {
  const phases = [
    {
      type: 'input',
      name: 'Input Phase',
      description: 'User provides input',
      ...config.inputPhase
    },
    {
      type: 'validation',
      name: 'Validation Phase',
      description: 'System validates input',
      ...config.validationPhase
    }
  ];

  return new PhaseManager({
    phases,
    ...config
  });
}

/**
 * Create a 3-phase system (instruction → practice → test)
 * @param {Object} config
 * @returns {PhaseManager}
 */
export function createThreePhaseManager(config = {}) {
  const phases = [
    {
      type: 'instruction',
      name: 'Instruction Phase',
      description: 'Show instructions',
      ...config.instructionPhase
    },
    {
      type: 'practice',
      name: 'Practice Phase',
      description: 'Practice with feedback',
      ...config.practicePhase
    },
    {
      type: 'test',
      name: 'Test Phase',
      description: 'Final test',
      ...config.testPhase
    }
  ];

  return new PhaseManager({
    phases,
    ...config
  });
}