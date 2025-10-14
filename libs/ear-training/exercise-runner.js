/**
 * Exercise Runner - Core execution engine for rhythm exercises (Phase 2c)
 *
 * Handles:
 * - Exercise lifecycle (initialize, run, complete)
 * - Rhythm capture using KeyboardCapture
 * - Audio playback (count-in, reference patterns)
 * - Result analysis using RhythmAnalyzer
 * - Score calculation
 * - Integration with gamification system
 */

import { getExerciseDefinition } from './exercise-definitions.js';
import { fromLgAndTempo } from '../app-common/subdivision.js';

/**
 * ExerciseRunner class
 * Executes a single exercise level
 */
export class ExerciseRunner {
  constructor(exerciseId, options = {}) {
    this.exerciseId = exerciseId;
    this.definition = getExerciseDefinition(exerciseId);

    if (!this.definition) {
      throw new Error(`Exercise not found: ${exerciseId}`);
    }

    this.options = options;
    this.captureSystem = null;
    this.analyzer = null;
    this.currentLevel = null;
    this.currentBPM = null;
    this.isInitialized = false;
  }

  /**
   * Initialize exercise (load dependencies, create capture system)
   */
  async initialize() {
    if (this.isInitialized) {
      return true;
    }

    try {
      // Import audio-capture system
      const { createKeyboardCapture, RhythmAnalyzer } = await import('../audio-capture/index.js');

      // Create keyboard capture with event capture phase
      this.keyboard = createKeyboardCapture({
        visualFeedback: this.options.visualFeedback !== false,
        useCapture: true // Priority over other listeners
      });

      // Create rhythm analyzer
      this.analyzer = new RhythmAnalyzer({
        tolerance: 150 // Default, will be overridden per level
      });

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize exercise:', error);
      return false;
    }
  }

  /**
   * Run a specific level of the exercise
   * @param {number} levelNumber - Level number (1-indexed)
   * @returns {Promise<object>} Exercise result
   */
  async runLevel(levelNumber) {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize exercise');
      }
    }

    // Get level configuration
    const level = this.definition.levels.find(l => l.level === levelNumber);
    if (!level) {
      throw new Error(`Level ${levelNumber} not found in exercise ${this.exerciseId}`);
    }

    this.currentLevel = level;

    console.log(`🎯 Starting ${this.definition.title} - Level ${levelNumber}`);
    console.log(`📝 ${level.description}`);
    console.log(`ℹ️  ${level.instructions || 'No instructions'}`);

    try {
      // Execute exercise based on type
      if (this.definition.type === 'rhythm-capture') {
        return await this.runRhythmCapture(level);
      } else if (this.definition.type === 'rhythm-sync') {
        return await this.runRhythmSync(level);
      } else if (this.definition.type === 'fraction-ear-training') {
        // Fraction recognition uses different runner
        throw new Error('Use FractionRecognitionExercise for fraction-ear-training type');
      } else {
        throw new Error(`Unknown exercise type: ${this.definition.type}`);
      }
    } catch (error) {
      console.error('❌ Exercise error:', error);
      throw error;
    }
  }

  /**
   * Run rhythm capture exercise (free timing, no audio reference)
   * @param {object} level - Level configuration
   * @returns {Promise<object>} Result
   */
  async runRhythmCapture(level) {
    const expectedTapCount = level.positions.length;

    console.log(`⌨️  Presiona ESPACIO ${expectedTapCount} veces cuando quieras`);

    // Capture rhythm
    const taps = await this.captureRhythm(expectedTapCount);

    console.log(`✅ Capturados ${taps.length} taps:`, taps);

    // Analyze proportions (no BPM, just relative timing)
    const analysis = this.analyzeProportions(taps, level.positions, level.lg);

    // Calculate score
    const score = this.calculateScore(analysis, this.definition.scoring, level);

    // Build result object
    const result = {
      exerciseId: this.exerciseId,
      level: level.level,
      timestamp: Date.now(),
      config: {
        lg: level.lg,
        bpm: null, // No BPM for free capture
        positions: level.positions,
        tolerance: level.tolerance
      },
      capture: {
        taps,
        expected: null, // No expected timestamps for free capture
        count: taps.length
      },
      analysis: {
        timingAccuracy: analysis.proportionScore || 0,
        consistencyScore: analysis.consistency || 0,
        tempoAccuracy: 0, // Not applicable for free capture
        details: analysis
      },
      score: {
        total: score,
        breakdown: {
          timing: Math.round((analysis.proportionScore || 0) * 100),
          consistency: Math.round((analysis.consistency || 0) * 100),
          tempo: 0
        },
        passed: score >= level.minAccuracy
      },
      metadata: {
        attempts: 1,
        duration_ms: taps[taps.length - 1] || 0
      }
    };

    // Submit to gamification
    await this.submitResult(result);

    // Display result
    this.displayResult(result);

    return result;
  }

  /**
   * Run rhythm sync exercise (with audio reference and count-in)
   * @param {object} level - Level configuration
   * @param {number} bpm - BPM for this attempt (optional, will generate random if not provided)
   * @returns {Promise<object>} Result
   */
  async runRhythmSync(level, bpm = null) {
    // Generate or use provided BPM
    this.currentBPM = bpm || this.generateRandomBPM();

    console.log(`🎵 BPM: ${this.currentBPM}`);

    // Calculate timestamps for reference pattern
    const timestamps = this.calculateTimestamps(level.lg, this.currentBPM);
    const selectedTimestamps = this.selectPositions(timestamps, level.positions);

    console.log(`⏱️  Expected timestamps (ms):`, selectedTimestamps);

    // Play count-in
    await this.playCountIn(this.currentBPM);

    // Play reference pattern audio
    const audioStartTime = await this.playReferencePattern(selectedTimestamps, this.currentBPM);

    // Capture rhythm synchronized with audio
    const taps = await this.captureRhythmSynchronized(
      level.positions.length,
      selectedTimestamps[selectedTimestamps.length - 1] + 500 // Timeout after last expected tap + 500ms
    );

    console.log(`✅ Capturados ${taps.length} taps:`, taps);

    // Normalize taps relative to audio start
    const normalizedTaps = taps.map(t => t - audioStartTime);

    // Analyze rhythm using RhythmAnalyzer
    this.analyzer.config.tolerance = level.tolerance;
    const analysis = this.analyzer.compareRhythm(normalizedTaps, selectedTimestamps);

    // Calculate score
    const score = this.calculateScore(analysis, this.definition.scoring, level);

    // Build result object
    const result = {
      exerciseId: this.exerciseId,
      level: level.level,
      timestamp: Date.now(),
      config: {
        lg: level.lg,
        bpm: this.currentBPM,
        positions: level.positions,
        tolerance: level.tolerance
      },
      capture: {
        taps: normalizedTaps,
        expected: selectedTimestamps,
        count: normalizedTaps.length
      },
      analysis: {
        timingAccuracy: analysis.timingAccuracy || 0,
        consistencyScore: analysis.consistencyScore || 0,
        tempoAccuracy: analysis.tempoAccuracy || 0,
        matches: analysis.matches || []
      },
      score: {
        total: score,
        breakdown: {
          timing: Math.round((analysis.timingAccuracy || 0) * 100),
          consistency: Math.round((analysis.consistencyScore || 0) * 100),
          tempo: Math.round((analysis.tempoAccuracy || 0) * 100)
        },
        passed: score >= level.minAccuracy
      },
      metadata: {
        attempts: 1,
        duration_ms: normalizedTaps[normalizedTaps.length - 1] || 0
      }
    };

    // Submit to gamification
    await this.submitResult(result);

    // Display result
    this.displayResult(result);

    return result;
  }

  /**
   * Calculate timestamps for all pulses given Lg and BPM
   * Formula: Lg / V = T / 60  →  T = (Lg * 60) / BPM
   * @param {number} lg - Total pulses
   * @param {number} bpm - Beats per minute
   * @returns {number[]} Array of timestamps in milliseconds
   */
  calculateTimestamps(lg, bpm) {
    const timing = fromLgAndTempo(lg, bpm);
    if (!timing.interval) {
      throw new Error(`Cannot calculate timestamps: invalid Lg=${lg} or BPM=${bpm}`);
    }

    const timestamps = [];
    for (let i = 0; i < lg; i++) {
      timestamps.push(Math.round(i * timing.interval * 1000)); // Convert to ms
    }

    return timestamps;
  }

  /**
   * Select timestamps at specific positions
   * @param {number[]} timestamps - All timestamps
   * @param {number[]} positions - Positions to select (0-indexed)
   * @returns {number[]} Selected timestamps
   */
  selectPositions(timestamps, positions) {
    return positions.map(pos => timestamps[pos]);
  }

  /**
   * Generate random BPM within exercise range
   * @returns {number} Random BPM
   */
  generateRandomBPM() {
    const [min, max] = this.definition.bpmRange || [60, 240];
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Capture rhythm (keyboard taps)
   * @param {number} expectedCount - Expected number of taps
   * @returns {Promise<number[]>} Array of tap timestamps
   */
  captureRhythm(expectedCount) {
    return new Promise((resolve) => {
      let tapCount = 0;

      // Save and configure callback BEFORE startRecording
      const originalCallback = this.keyboard.onTapDetected;

      this.keyboard.onTapDetected = (tap) => {
        if (originalCallback) originalCallback(tap);

        tapCount++;
        console.log(`  Tap ${tapCount}/${expectedCount}`);

        if (tapCount >= expectedCount) {
          setTimeout(() => {
            const taps = this.keyboard.stopRecording();
            this.keyboard.onTapDetected = originalCallback; // Restore
            resolve(taps);
          }, 300); // Wait 300ms after last tap
        }
      };

      // NOW start recording (callback already configured)
      this.keyboard.startRecording();
    });
  }

  /**
   * Capture rhythm synchronized with audio (with timeout)
   * @param {number} expectedCount - Expected number of taps
   * @param {number} timeout - Timeout in ms
   * @returns {Promise<number[]>} Array of tap timestamps
   */
  captureRhythmSynchronized(expectedCount, timeout) {
    return new Promise((resolve) => {
      let tapCount = 0;
      let timeoutId = null;

      // Save and configure callback BEFORE startRecording
      const originalCallback = this.keyboard.onTapDetected;

      const finish = () => {
        if (timeoutId) clearTimeout(timeoutId);
        const taps = this.keyboard.stopRecording();
        this.keyboard.onTapDetected = originalCallback; // Restore
        resolve(taps);
      };

      this.keyboard.onTapDetected = (tap) => {
        if (originalCallback) originalCallback(tap);

        tapCount++;
        console.log(`  Tap ${tapCount}/${expectedCount}`);

        if (tapCount >= expectedCount) {
          setTimeout(finish, 200); // Wait 200ms after expected count reached
        }
      };

      // NOW start recording (callback already configured)
      this.keyboard.startRecording();

      // Timeout fallback
      timeoutId = setTimeout(() => {
        console.log(`⏱️  Timeout reached (${timeout}ms)`);
        finish();
      }, timeout);
    });
  }

  /**
   * Play count-in (4 beats visual + audio)
   * @param {number} bpm - BPM for count-in
   * @returns {Promise<void>}
   */
  async playCountIn(bpm) {
    const { CountInController } = await import('./count-in-controller.js');

    const countIn = new CountInController({
      beats: this.definition.countIn?.beats || 4,
      bpm,
      visualFeedback: this.definition.countIn?.visualFeedback !== false,
      audioFeedback: this.definition.countIn?.audioFeedback !== false,
      clickNote: this.definition.countIn?.clickNote || 76
    });

    await countIn.play();
  }

  /**
   * Play reference pattern audio
   * @param {number[]} timestamps - Timestamps to play (in ms)
   * @param {number} bpm - BPM
   * @returns {Promise<number>} Audio start time (performance.now())
   */
  async playReferencePattern(timestamps, bpm) {
    const { init, scheduleNote } = await import('../sound/index.js');
    await init();

    const clickNote = this.definition.referenceAudio?.clickNote || 60;
    const duration = this.definition.referenceAudio?.duration || 0.1;

    const startTime = performance.now();

    timestamps.forEach(ts => {
      setTimeout(() => {
        scheduleNote({
          note: clickNote,
          time: 0, // Immediate
          duration
        });
      }, ts);
    });

    return startTime;
  }

  /**
   * Analyze rhythm proportions (for free capture without BPM)
   * @param {number[]} taps - Tap timestamps
   * @param {number[]} positions - Expected positions
   * @param {number} lg - Total Lg
   * @returns {object} Analysis result
   */
  analyzeProportions(taps, positions, lg) {
    if (taps.length < 2) {
      return { proportionScore: 0, consistency: 0 };
    }

    // Calculate intervals between taps
    const intervals = [];
    for (let i = 1; i < taps.length; i++) {
      intervals.push(taps[i] - taps[i - 1]);
    }

    // Expected proportions based on positions
    const expectedIntervals = [];
    for (let i = 1; i < positions.length; i++) {
      expectedIntervals.push(positions[i] - positions[i - 1]);
    }

    // Calculate ratios
    const actualRatios = [];
    for (let i = 1; i < intervals.length; i++) {
      actualRatios.push(intervals[i] / intervals[i - 1]);
    }

    const expectedRatios = [];
    for (let i = 1; i < expectedIntervals.length; i++) {
      expectedRatios.push(expectedIntervals[i] / expectedIntervals[i - 1]);
    }

    // Compare ratios (proportion accuracy)
    let proportionScore = 1.0;
    if (actualRatios.length > 0 && expectedRatios.length > 0) {
      const minLength = Math.min(actualRatios.length, expectedRatios.length);
      let totalError = 0;
      for (let i = 0; i < minLength; i++) {
        const error = Math.abs(actualRatios[i] - expectedRatios[i]);
        totalError += error;
      }
      const avgError = totalError / minLength;
      proportionScore = Math.max(0, 1 - avgError);
    }

    // Consistency (standard deviation of intervals)
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    const consistency = Math.max(0, 1 - (stdDev / avgInterval));

    return {
      proportionScore,
      consistency,
      intervals,
      expectedIntervals,
      actualRatios,
      expectedRatios
    };
  }

  /**
   * Calculate final score from analysis
   * @param {object} analysis - Analysis result
   * @param {object} scoring - Scoring configuration
   * @param {object} level - Level configuration
   * @returns {number} Score (0-100)
   */
  calculateScore(analysis, scoring, level) {
    const timing = analysis.timingAccuracy || analysis.proportionScore || 0;
    const consistency = analysis.consistencyScore || 0;
    const tempo = analysis.tempoAccuracy || 0;

    // If tempo is 0 (free capture), redistribute its weight to timing and consistency
    let timingWeight = scoring.timingWeight || 0;
    let consistencyWeight = scoring.consistencyWeight || 0;
    let tempoWeight = scoring.tempoWeight || 0;

    if (tempo < 0.01 && tempoWeight > 0) {
      // Redistribute tempo weight proportionally (using threshold for float comparison)
      const totalWeight = timingWeight + consistencyWeight;
      if (totalWeight > 0) {
        const redistribution = tempoWeight;
        timingWeight += redistribution * (timingWeight / totalWeight);
        consistencyWeight += redistribution * (consistencyWeight / totalWeight);
        tempoWeight = 0;
      }
    }

    const score =
      timing * timingWeight +
      consistency * consistencyWeight +
      tempo * tempoWeight;

    return Math.round(score * 100);
  }

  /**
   * Submit result to gamification system
   * @param {object} result - Exercise result
   */
  async submitResult(result) {
    try {
      const { recordAttempt } = await import('../gamification/index.js');

      await recordAttempt({
        exercise_type: `${this.exerciseId}_level_${result.level}`,
        exercise_title: `${this.definition.title} - Nivel ${result.level}`,
        score: result.score.total,
        accuracy: result.score.total,
        metadata: {
          level: result.level,
          lg: result.config.lg,
          bpm: result.config.bpm,
          positions: result.config.positions,
          taps_count: result.capture.count,
          timing_accuracy: result.score.breakdown.timing,
          consistency: result.score.breakdown.consistency,
          tempo_accuracy: result.score.breakdown.tempo,
          passed: result.score.passed
        }
      });

      console.log('✅ Result saved to database');
    } catch (error) {
      console.error('⚠️  Failed to save result to database:', error);
    }
  }

  /**
   * Display result in console
   * @param {object} result - Exercise result
   */
  displayResult(result) {
    console.log('\n' + '='.repeat(50));
    console.log(result.score.passed ? '✅ LEVEL PASSED!' : '❌ Level not passed');
    console.log('='.repeat(50));
    console.log(`Score: ${result.score.total} / 100`);
    console.log(`Min required: ${this.currentLevel.minAccuracy}`);
    console.log('\nBreakdown:');
    console.log(`  Timing:      ${result.score.breakdown.timing}%`);
    console.log(`  Consistency: ${result.score.breakdown.consistency}%`);
    console.log(`  Tempo:       ${result.score.breakdown.tempo}%`);

    if (result.analysis.matches && result.analysis.matches.length > 0) {
      console.log('\nTap Analysis:');
      result.analysis.matches.forEach((match, i) => {
        const delta = match.delta >= 0 ? `+${match.delta}` : `${match.delta}`;
        const symbol = match.withinTolerance ? '✓' : '✗';
        console.log(`  Tap ${i + 1}: ${delta}ms ${symbol}`);
      });
    }

    console.log('='.repeat(50) + '\n');
  }

  /**
   * Dispose of resources
   */
  dispose() {
    if (this.keyboard) {
      this.keyboard.dispose();
    }
    this.keyboard = null;
    this.analyzer = null;
    this.isInitialized = false;
  }
}
