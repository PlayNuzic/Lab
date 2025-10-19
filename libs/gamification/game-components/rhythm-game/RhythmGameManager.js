/**
 * Rhythm Game Manager
 * Specialized game manager for rhythm-based games (App2, App5)
 */

import { BaseGameManager } from '../shared/BaseGameManager.js';
import {
  createKeyboardCapture,
  createMicrophoneCapture,
  createRhythmAnalyzer,
  generateExpectedPattern
} from '../../../audio-capture/index.js';

/**
 * Manager for rhythm-based games
 */
export class RhythmGameManager extends BaseGameManager {
  constructor(config = {}) {
    super(config);

    // Rhythm-specific configuration
    this.captureMode = config.captureMode || 'keyboard'; // 'keyboard', 'microphone', 'combined'
    this.bpm = config.bpm || 90;
    this.lgValue = config.lgValue || 4;
    this.vValue = config.vValue || null;

    // Audio capture components
    this.audioCapture = null;
    this.rhythmAnalyzer = createRhythmAnalyzer();

    // Pattern configuration
    this.expectedPattern = [];
    this.recordedPattern = [];

    // Phase configuration
    this.phases = [
      { type: 'instruction', name: 'Instrucciones' },
      { type: 'listen', name: 'Escuchar Patrón' },
      { type: 'capture', name: 'Captura de Ritmo' },
      { type: 'validation', name: 'Validación' }
    ];
  }

  /**
   * Initialize rhythm game
   */
  async init() {
    await super.init();

    // Initialize audio capture based on mode
    await this.initializeAudioCapture();

    console.log('🎵 Rhythm game initialized');
    return true;
  }

  /**
   * Initialize audio capture
   * @private
   */
  async initializeAudioCapture() {
    try {
      if (this.captureMode === 'microphone') {
        this.audioCapture = await createMicrophoneCapture({
          threshold: 0.1,
          onBeatDetected: (timestamp) => this.onBeatDetected(timestamp)
        });
        await this.audioCapture.initialize();
      } else {
        // Default to keyboard
        this.audioCapture = createKeyboardCapture({
          targetKey: ' ',
          onTapDetected: (timestamp) => this.onBeatDetected(timestamp)
        });
      }

      console.log(`🎤 Audio capture initialized: ${this.captureMode}`);
    } catch (error) {
      console.error('Failed to initialize audio capture:', error);
      // Fallback to keyboard
      this.captureMode = 'keyboard';
      this.audioCapture = createKeyboardCapture({
        targetKey: ' ',
        onTapDetected: (timestamp) => this.onBeatDetected(timestamp)
      });
    }
  }

  /**
   * Get level configuration for rhythm game
   */
  getLevelConfig(levelNumber) {
    // Default rhythm level configurations
    const configs = {
      1: {
        lg: 4,
        bpm: 90,
        positions: [1, 3],
        requirement: 'Identifica 2 posiciones impares',
        tolerance: 100 // ms
      },
      2: {
        lg: 5,
        bpm: 100,
        positions: [2, 4],
        requirement: 'Identifica 2 posiciones pares',
        tolerance: 80
      },
      3: {
        lg: 6,
        bpm: 110,
        positions: 'random',
        requirement: 'Identifica el patrón completo',
        tolerance: 60
      },
      4: {
        lg: 8,
        bpm: 120,
        positions: 'complex',
        requirement: 'Domina el ritmo complejo',
        tolerance: 50
      }
    };

    return configs[levelNumber] || configs[1];
  }

  /**
   * Initialize level with rhythm-specific setup
   */
  initializeLevel(config) {
    this.lgValue = config.lg;
    this.bpm = config.bpm;

    // Generate expected pattern
    const positions = this.generatePositions(config);
    this.expectedPattern = generateExpectedPattern(
      config.lg,
      positions,
      config.bpm
    );

    // Store tolerance
    this.tolerance = config.tolerance || 100;

    console.log(`🎼 Level initialized: Lg=${config.lg}, BPM=${config.bpm}`);
    console.log(`   Expected positions: ${positions.join(', ')}`);
  }

  /**
   * Generate positions based on level config
   * @private
   */
  generatePositions(config) {
    if (Array.isArray(config.positions)) {
      return config.positions;
    }

    if (config.positions === 'random') {
      // Generate random positions
      const count = Math.floor(config.lg / 2);
      const positions = [];
      while (positions.length < count) {
        const pos = Math.floor(Math.random() * config.lg) + 1;
        if (!positions.includes(pos)) {
          positions.push(pos);
        }
      }
      return positions.sort((a, b) => a - b);
    }

    if (config.positions === 'complex') {
      // Generate complex pattern
      const positions = [];
      for (let i = 1; i <= config.lg; i++) {
        if (i % 2 === 1 || i % 3 === 0) {
          positions.push(i);
        }
      }
      return positions;
    }

    return [1];
  }

  /**
   * Execute phase logic for rhythm game
   */
  executePhase(phaseNumber) {
    const phases = ['instruction', 'listen', 'capture', 'validation'];
    const phaseType = phases[phaseNumber - 1];

    switch (phaseType) {
      case 'instruction':
        this.showInstructions();
        break;
      case 'listen':
        this.playPattern();
        break;
      case 'capture':
        this.startCapture();
        break;
      case 'validation':
        this.validateRhythm();
        break;
      default:
        console.warn('Unknown phase:', phaseType);
    }
  }

  /**
   * Show instructions for current level
   * @private
   */
  showInstructions() {
    const config = this.getLevelConfig(this.currentLevel);

    if (this.ui && this.ui.showInstructions) {
      this.ui.showInstructions({
        level: this.currentLevel,
        requirement: config.requirement,
        lg: config.lg,
        bpm: config.bpm
      });
    }

    // Auto-advance to next phase after delay
    setTimeout(() => {
      this.handlePhaseTransition(2);
    }, 3000);
  }

  /**
   * Play the expected pattern
   * @private
   */
  async playPattern() {
    console.log('🔊 Playing pattern...');

    if (this.ui && this.ui.showListening) {
      this.ui.showListening();
    }

    // Play pattern using audio system
    // This would integrate with the app's audio system
    await this.playExpectedPattern();

    // Advance to capture phase
    setTimeout(() => {
      this.handlePhaseTransition(3);
    }, 1000);
  }

  /**
   * Play expected pattern (to be implemented by app)
   * @private
   */
  async playExpectedPattern() {
    // This should be implemented by the specific app
    // as it needs access to the app's audio system
    console.log('📻 Pattern playback (implement in app)');

    // Simulate playback duration
    const duration = (60000 / this.bpm) * this.lgValue;
    await new Promise(resolve => setTimeout(resolve, duration));
  }

  /**
   * Start rhythm capture
   * @private
   */
  startCapture() {
    console.log('🎤 Starting rhythm capture...');

    // Reset recorded pattern
    this.recordedPattern = [];

    // Show capture UI
    if (this.ui && this.ui.showCapture) {
      this.ui.showCapture({
        mode: this.captureMode,
        instruction: this.captureMode === 'keyboard'
          ? 'Presiona ESPACIO en cada pulso'
          : 'Haz sonidos en cada pulso'
      });
    }

    // Start recording
    this.audioCapture.startRecording((timestamp) => {
      this.onBeatDetected(timestamp);
    });

    // Auto-stop after expected duration + buffer
    const duration = (60000 / this.bpm) * this.lgValue + 2000;
    setTimeout(() => {
      this.stopCapture();
    }, duration);
  }

  /**
   * Handle detected beat
   * @private
   */
  onBeatDetected(timestamp) {
    console.log('🥁 Beat detected at', timestamp);

    // Visual feedback
    if (this.ui && this.ui.showBeatFeedback) {
      this.ui.showBeatFeedback();
    }

    // Store timestamp (will be processed on stop)
  }

  /**
   * Stop capture and move to validation
   * @private
   */
  stopCapture() {
    console.log('⏹️ Stopping capture');

    // Get recorded timestamps
    this.recordedPattern = this.audioCapture.stopRecording();

    // Move to validation phase
    this.handlePhaseTransition(4);
  }

  /**
   * Validate captured rhythm
   * @private
   */
  validateRhythm() {
    console.log('🔍 Validating rhythm...');

    // Analyze rhythm accuracy
    const result = this.rhythmAnalyzer.compareRhythm(
      this.recordedPattern,
      this.expectedPattern,
      this.tolerance
    );

    console.log(`   Accuracy: ${result.accuracy.toFixed(1)}%`);
    console.log(`   Matched: ${result.matched}/${result.total}`);

    // Record attempt
    const validationResult = this.validateAttempt(
      this.recordedPattern,
      this.expectedPattern
    );

    // Show result
    if (this.ui && this.ui.showValidationResult) {
      this.ui.showValidationResult({
        ...result,
        passed: result.accuracy >= 60
      });
    }

    // Complete level if passed
    if (result.accuracy >= 60) {
      setTimeout(() => {
        this.completeLevel();
      }, 2000);
    } else {
      // Allow retry
      setTimeout(() => {
        if (this.ui && this.ui.showRetry) {
          this.ui.showRetry(() => {
            this.startPhase(2); // Restart from listen phase
          });
        }
      }, 2000);
    }
  }

  /**
   * Calculate accuracy for rhythm patterns
   */
  calculateAccuracy(recordedPattern, expectedPattern) {
    if (!Array.isArray(recordedPattern) || !Array.isArray(expectedPattern)) {
      return { correct: false, accuracy: 0 };
    }

    const result = this.rhythmAnalyzer.compareRhythm(
      recordedPattern,
      expectedPattern,
      this.tolerance
    );

    return {
      correct: result.accuracy >= 60,
      accuracy: result.accuracy,
      matched: result.matched,
      total: result.total,
      averageError: result.averageError
    };
  }

  /**
   * Switch capture mode
   * @param {string} mode - 'keyboard', 'microphone', or 'combined'
   */
  async switchCaptureMode(mode) {
    // Dispose current capture
    if (this.audioCapture && this.audioCapture.dispose) {
      this.audioCapture.dispose();
    }

    // Switch mode
    this.captureMode = mode;
    await this.initializeAudioCapture();

    console.log(`🔄 Switched capture mode to: ${mode}`);
  }

  /**
   * Set BPM for rhythm game
   * @param {number} bpm
   */
  setBPM(bpm) {
    this.bpm = bpm;
    console.log(`🎵 BPM set to: ${bpm}`);
  }

  /**
   * Clean up resources
   */
  dispose() {
    super.dispose();

    // Dispose audio capture
    if (this.audioCapture && this.audioCapture.dispose) {
      this.audioCapture.dispose();
    }

    console.log('🧹 Rhythm game manager disposed');
  }
}

/**
 * Create a rhythm game with standard configuration
 * @param {Object} config
 * @returns {RhythmGameManager}
 */
export function createRhythmGame(config = {}) {
  return new RhythmGameManager({
    appId: config.appId || 'rhythm_game',
    gameName: config.gameName || 'Rhythm Challenge',
    maxLevels: 4,
    captureMode: config.captureMode || 'keyboard',
    ...config
  });
}