/**
 * Game Manager for App5 gamification
 * Orchestrates game flow, phases, and audio capture
 */

import {
  createMicrophoneCapture,
  createKeyboardCapture,
  createRhythmAnalyzer,
  fractionsToTimestamps,
  recordAttempt
} from '../../../libs/gamification/index.js';

import { sanitizePulseSequence } from '../../../libs/app-common/pulse-seq-intervals.js';
import { GameUI } from './game-ui.js';
import { GameState } from './game-state.js';
import { getLevel, checkLevelCompletion, getHintPositions } from './levels-config.js';

/**
 * Main game manager class
 * Coordinates all game components and phases
 */
export class GameManager {
  constructor() {
    this.ui = new GameUI();
    this.gameState = new GameState();
    this.pulseSeqController = null; // Will be set from App5
    this.audioCapture = null;
    this.rhythmAnalyzer = createRhythmAnalyzer();
    this.currentLevel = null;
    this.phase1StartTime = null;
    this.phase2StartTime = null;
    this.isGameActive = false;
    this.currentPhase = null;
    this.synth = null; // Will be set from App5
    this.playbackPatterns = []; // Store patterns for phase 2 playback
  }

  /**
   * Initialize game manager
   */
  async init() {
    console.log('🎮 GameManager.init() starting...');

    // Initialize UI
    this.ui.init();
    console.log('✅ UI initialized');

    // Setup UI callbacks
    this.setupUICallbacks();
    console.log('✅ UI callbacks setup');

    // Listen for gamification toggle event
    document.addEventListener('gamification_toggled', (e) => {
      console.log('🎮 gamification_toggled event received:', e.detail);
      if (e.detail.enabled) {
        this.startGame();
      } else {
        this.endGame();
      }
    });
    console.log('✅ Event listener registered for gamification_toggled');

    // ALSO attach directly to the button as a backup
    const gamificationBtn = document.getElementById('gamificationToggleBtn');
    if (gamificationBtn) {
      // Remove any existing game listener (in case of re-initialization)
      gamificationBtn.removeEventListener('click', this._boundButtonHandler);

      // Create bound handler
      this._boundButtonHandler = (e) => {
        console.log('🎮 Direct button click detected');
        const isActive = gamificationBtn.getAttribute('aria-pressed') === 'true';
        console.log('Button state:', isActive ? 'active' : 'inactive');

        // The button's aria-pressed is updated by the gamification-adapter
        // So we need to check the NEXT state after the click
        setTimeout(() => {
          const newState = gamificationBtn.getAttribute('aria-pressed') === 'true';
          console.log('New button state:', newState ? 'active' : 'inactive');

          if (newState && !this.isGameActive) {
            console.log('Starting game from direct button click');
            this.startGame();
          } else if (!newState && this.isGameActive) {
            console.log('Ending game from direct button click');
            this.endGame();
          }
        }, 10);
      };

      gamificationBtn.addEventListener('click', this._boundButtonHandler);
      console.log('✅ Direct button listener attached to gamificationToggleBtn');
    } else {
      console.warn('⚠️ gamificationToggleBtn not found in DOM');
    }

    // Get reference to pulse sequence controller from App5
    // This will be set by App5 after initialization
    this.pulseSeqController = window.pulseSeqController;
    console.log('✅ pulseSeqController reference:', this.pulseSeqController ? 'found' : 'not found');

    // Get reference to synth if available
    this.synth = window.synth;
    console.log('✅ synth reference:', this.synth ? 'found' : 'not found');

    console.log('✅ GameManager initialized successfully');
  }

  /**
   * Setup UI event callbacks
   */
  setupUICallbacks() {
    // Phase 1 callbacks
    this.ui.on('onValidatePhase1', () => this.validatePhase1());
    this.ui.on('onSkipPhase1', () => this.skipToPhase2());
    this.ui.on('onShowHint', (positions) => this.flashHintPositions(positions));

    // Phase 2 callbacks
    this.ui.on('onStartPhase2', (config) => this.startPhase2Recording(config));
    this.ui.on('onSkipPhase2', () => this.skipPhase2());

    // Navigation callbacks
    this.ui.on('onSelectLevel', (level) => this.loadLevel(level));
    this.ui.on('onContinue', () => this.continueGame());
    // When UI is hidden (X button or backdrop click), end the game completely
    this.ui.on('onHide', () => {
      console.log('🎮 UI hidden, ending game and deactivating button');
      this.isGameActive = false;
      this.gameState.save();
      this.deactivateGameButton();
    });
  }

  /**
   * Start the game
   */
  startGame() {
    console.log('🎮 startGame() called, isGameActive:', this.isGameActive);

    if (this.isGameActive) {
      console.log('⚠️ Game already active, ignoring');
      return;
    }

    this.isGameActive = true;
    console.log('✅ Game activated, currentLevel:', this.gameState.currentLevel);

    // Show level selector or continue from saved state
    if (this.gameState.currentLevel) {
      console.log('📍 Loading saved level:', this.gameState.currentLevel);
      this.loadLevel(this.gameState.currentLevel);
    } else {
      console.log('📋 Showing level selector');
      this.ui.showLevelSelector();
    }

    this.ui.show(this.gameState.currentLevel);
    console.log('✅ UI shown');
  }

  /**
   * End the game
   */
  endGame() {
    if (!this.isGameActive) return;

    this.isGameActive = false;
    console.log('Ending game');

    // Clean up audio capture if active
    if (this.audioCapture) {
      if (this.audioCapture.stop) {
        this.audioCapture.stop();
      }
      this.audioCapture = null;
    }

    // Save state
    this.gameState.save();

    // Hide UI
    this.ui.hide();

    // Desactivar el botón de gamificación
    this.deactivateGameButton();
  }

  /**
   * Deactivate the gamification button
   */
  deactivateGameButton() {
    const gamificationBtn = document.getElementById('gamificationToggleBtn');
    if (gamificationBtn) {
      const isActive = gamificationBtn.getAttribute('aria-pressed') === 'true';
      if (isActive) {
        console.log('🔘 Deactivating game button');
        gamificationBtn.setAttribute('aria-pressed', 'false');
        gamificationBtn.classList.remove('active');

        // Dispatch event to notify other systems
        const event = new CustomEvent('gamification_toggled', {
          detail: {
            enabled: false,
            timestamp: Date.now()
          }
        });
        document.dispatchEvent(event);
      }
    }
  }

  /**
   * Pause the game
   */
  pauseGame() {
    if (!this.isGameActive) return;

    console.log('Game paused');
    this.gameState.save();
  }

  /**
   * Load a specific level
   * @param {number} levelNumber - Level to load
   */
  loadLevel(levelNumber) {
    console.log(`Loading level ${levelNumber}`);

    this.currentLevel = getLevel(levelNumber);
    this.currentPhase = 1;

    // Update UI for level
    this.ui.show(levelNumber);

    // Start Phase 1
    this.startPhase1();
  }

  /**
   * Start Phase 1 (position selection)
   */
  async startPhase1() {
    console.log('Starting Phase 1');
    this.currentPhase = 1;
    this.phase1StartTime = Date.now();

    // Get pulse sequence controller
    if (!this.pulseSeqController) {
      this.pulseSeqController = window.pulseSeqController;
    }

    if (!this.pulseSeqController) {
      console.error('Pulse sequence controller not available');
      this.ui.showMessage('Error: Controller no disponible', 'confused');
      return;
    }

    // Set Lg value if needed
    if (this.currentLevel.lg) {
      // Get current text and update Lg portion
      let currentText = this.pulseSeqController.getText();
      const lgMatch = currentText.match(/Lg\s*=\s*(\d+)/);

      if (lgMatch) {
        // Replace existing Lg value
        currentText = currentText.replace(/Lg\s*=\s*\d+/, `Lg = ${this.currentLevel.lg}`);
      } else {
        // Add Lg at the end
        currentText = currentText.trim() + ` Lg = ${this.currentLevel.lg}`;
      }

      this.pulseSeqController.setText(currentText);
    }

    // Clear any existing selection for fresh start
    const pulseMatch = this.pulseSeqController.getText().match(/P\s*\((.*?)\)/);
    if (!pulseMatch || pulseMatch[1].trim() === '') {
      // No existing selection, prompt user to select
      this.ui.showMessage(this.currentLevel.requirement, 'thinking');
    }

    // For free mode (level 4), set default Lg
    if (this.currentLevel.libre) {
      const text = `P ( ) Lg = ${this.currentLevel.defaultLg || 8}`;
      this.pulseSeqController.setText(text);
    }
  }

  /**
   * Validate Phase 1 selection
   */
  async validatePhase1() {
    console.log('Validating Phase 1');

    if (!this.pulseSeqController) {
      console.error('No pulse sequence controller');
      return;
    }

    // Get current selection from pulse sequence
    const text = this.pulseSeqController.getText();
    const pulseMatch = text.match(/P\s*\((.*?)\)/);
    const lgMatch = text.match(/Lg\s*=\s*(\d+)/);

    if (!pulseMatch) {
      this.ui.showMessage('No se encontró ninguna selección', 'confused');
      return;
    }

    const lg = lgMatch ? parseInt(lgMatch[1]) : this.currentLevel.lg || 8;
    const selectedText = pulseMatch[1].trim();

    // Sanitize the selection
    const sanitized = sanitizePulseSequence(selectedText, lg);

    if (!sanitized || sanitized.length === 0) {
      this.ui.showMessage('Selección inválida. Intenta de nuevo.', 'sad');
      this.ui.character.animate('shake');
      return;
    }

    // Convert sanitized string to array of numbers
    const positions = sanitized.split(/\s+/).map(Number).filter(n => !isNaN(n));

    // Check if selection meets level requirements
    const isCorrect = checkLevelCompletion(this.currentLevel.levelNumber, positions);

    if (isCorrect) {
      const phase1Time = Date.now() - this.phase1StartTime;
      this.ui.showMessage('¡Correcto! Preparando Fase 2...', 'happy');
      this.ui.character.animate('bounce');

      // Store pattern for phase 2
      this.playbackPatterns = positions;

      // Proceed to Phase 2 after a short delay
      setTimeout(() => {
        this.startPhase2();
      }, 1500);
    } else {
      this.ui.showMessage('Incorrecto. Revisa el requisito.', 'sad');
      this.ui.character.animate('shake');

      // Show hint after wrong attempt
      setTimeout(() => {
        const hint = this.currentLevel.hint || 'Intenta de nuevo';
        this.ui.showMessage(hint, 'thinking');
      }, 2000);
    }
  }

  /**
   * Flash hint positions in the pulse sequence
   * @param {number[]} positions - Positions to highlight
   */
  flashHintPositions(positions) {
    console.log('Flashing hint positions:', positions);

    // Use the overlay system to highlight positions
    if (window.pulseSeqHighlight) {
      // Flash each position
      positions.forEach((pos, index) => {
        setTimeout(() => {
          // Create a temporary highlight effect
          const element = document.querySelector(`.pulse-item-${pos}`);
          if (element) {
            element.classList.add('hint-flash');
            setTimeout(() => {
              element.classList.remove('hint-flash');
            }, 500);
          }
        }, index * 200);
      });
    }

    // Also update the pulse sequence text to show hint
    if (this.pulseSeqController && this.currentLevel.solution) {
      const hintText = `P ( ${this.currentLevel.solution.join(' ')} )`;
      // Temporarily show the solution
      const originalText = this.pulseSeqController.getText();
      const lgMatch = originalText.match(/Lg\s*=\s*(\d+)/);
      const lgPart = lgMatch ? ` Lg = ${lgMatch[1]}` : '';

      this.pulseSeqController.setText(hintText + lgPart);

      // Flash the text input
      const input = this.pulseSeqController.getElement();
      if (input) {
        input.classList.add('hint-flash');
        setTimeout(() => {
          input.classList.remove('hint-flash');
        }, 1000);
      }
    }
  }

  /**
   * Skip to Phase 2
   */
  skipToPhase2() {
    console.log('Skipping to Phase 2');

    // Use default or solution positions
    if (this.currentLevel.solution) {
      this.playbackPatterns = this.currentLevel.solution;
    } else if (this.currentLevel.libre) {
      // For free mode, use a default pattern
      this.playbackPatterns = [1, 3, 5, 7];
    } else {
      // Generate a valid pattern based on requirements
      this.playbackPatterns = getHintPositions(this.currentLevel.levelNumber);
    }

    this.startPhase2();
  }

  /**
   * Start Phase 2 (rhythm synchronization)
   */
  async startPhase2() {
    console.log('Starting Phase 2');
    this.currentPhase = 2;
    this.phase2StartTime = Date.now();

    const config = {
      bpm: this.currentLevel.bpm || 90,
      patterns: this.playbackPatterns,
      repeats: this.currentLevel.phase2Repeats || 2,
      lg: this.currentLevel.lg || 8
    };

    // Show Phase 2 UI
    this.ui.showPhase2UI(config);
    this.ui.showMessage('Prepárate para sincronizar el ritmo', 'focused');
  }

  /**
   * Start Phase 2 recording
   * @param {Object} config - Recording configuration
   */
  async startPhase2Recording(config) {
    console.log('Starting Phase 2 recording', config);

    try {
      // Initialize audio capture based on mode
      if (window.gameForceKeyboard) {
        console.log('Using keyboard capture mode');
        this.audioCapture = createKeyboardCapture();
        this.ui.showMessage('Usa la barra espaciadora para marcar el ritmo', 'focused');
      } else {
        console.log('Using microphone capture mode');
        this.audioCapture = createMicrophoneCapture();

        // Calibrate noise floor
        this.ui.showMessage('Calibrando micrófono...', 'thinking');
        await this.audioCapture.calibrateNoiseFloor(2000);
        this.ui.showMessage('¡Listo! El patrón comenzará en breve', 'happy');
      }

      // Calculate expected timestamps from pattern
      const fractions = this.patternsToFractions(config.patterns, config.lg);
      const expectedTimestamps = fractionsToTimestamps(fractions, config.bpm);

      // Double the timestamps for 2 repeats
      const allExpectedTimestamps = [
        ...expectedTimestamps,
        ...expectedTimestamps.map(t => t + (60000 / config.bpm) * config.lg)
      ];

      console.log('Expected timestamps:', allExpectedTimestamps);

      // Play pattern twice with count-in if available
      await this.playPatternWithCountIn(config);

      // Start capture
      const capturePromise = this.audioCapture.startCapture();

      // Calculate total duration (2 patterns + some buffer)
      const patternDuration = (60000 / config.bpm) * config.lg;
      const totalDuration = patternDuration * config.repeats + 1000; // Add 1 second buffer

      // Stop capture after duration
      setTimeout(async () => {
        const capturedBeats = await this.audioCapture.stopCapture();
        console.log('Captured beats:', capturedBeats);

        // Analyze rhythm
        const analysis = this.rhythmAnalyzer.compareRhythm(
          capturedBeats,
          allExpectedTimestamps,
          { tolerance: 200 } // 200ms tolerance
        );

        console.log('Rhythm analysis:', analysis);

        // Calculate accuracy
        const accuracy = analysis.accuracy * 100;

        // Record attempt
        recordAttempt({
          exerciseId: `app5-level-${this.currentLevel.levelNumber}`,
          pattern: config.patterns,
          userBeats: capturedBeats,
          expectedBeats: allExpectedTimestamps,
          analysis,
          timestamp: Date.now()
        });

        // Mark level complete
        const phase2Time = Date.now() - this.phase2StartTime;
        const totalTime = Date.now() - this.phase1StartTime;

        this.gameState.markLevelComplete(
          this.currentLevel.levelNumber,
          accuracy,
          totalTime,
          analysis
        );

        // Show results
        const success = accuracy >= 80;
        const achievements = this.gameState.checkAchievements(
          this.currentLevel.levelNumber,
          accuracy,
          totalTime
        );

        this.ui.stopPhase2Recording();
        this.ui.showResults({
          success,
          accuracy,
          message: success
            ? `¡Excelente! Precisión: ${Math.round(accuracy)}%`
            : `Sigue practicando. Precisión: ${Math.round(accuracy)}%`,
          achievements
        });

      }, totalDuration);

    } catch (error) {
      console.error('Error in Phase 2 recording:', error);
      this.ui.showMessage('Error al capturar audio', 'confused');
      this.ui.stopPhase2Recording();
    }
  }

  /**
   * Convert pattern positions to fractions
   * @param {number[]} patterns - Position numbers (1-based)
   * @param {number} lg - Length of pattern
   * @returns {number[]} Fractions (0-1)
   */
  patternsToFractions(patterns, lg) {
    return patterns.map(pos => (pos - 1) / lg);
  }

  /**
   * Play pattern with count-in
   * @param {Object} config - Playback configuration
   */
  async playPatternWithCountIn(config) {
    console.log('Playing pattern with config:', config);

    // Check if count-in controller is available
    const hasCountIn = window.countInController && typeof window.countInController.play === 'function';

    if (hasCountIn) {
      // Use count-in if available
      await window.countInController.play(config.bpm, 4); // 4 beat count-in
    } else {
      // Simple delay if no count-in
      this.ui.showMessage('3...', 'neutral');
      await this.delay(1000);
      this.ui.showMessage('2...', 'neutral');
      await this.delay(1000);
      this.ui.showMessage('1...', 'neutral');
      await this.delay(1000);
      this.ui.showMessage('¡Ya!', 'happy');
    }

    // Play the pattern using synth if available
    if (this.synth && this.synth.playPattern) {
      const notes = config.patterns.map(p => 60 + p); // Convert to MIDI notes
      const duration = 60 / config.bpm; // Duration per beat in seconds

      // Play pattern twice
      for (let i = 0; i < config.repeats; i++) {
        await this.synth.playPattern(notes, duration);
      }
    } else {
      // Fallback: visual indication only
      const beatDuration = 60000 / config.bpm;

      for (let repeat = 0; repeat < config.repeats; repeat++) {
        for (const position of config.patterns) {
          this.ui.showMessage(`Beat ${position}`, 'focused');
          await this.delay(beatDuration);
        }
      }
    }
  }

  /**
   * Skip Phase 2
   */
  skipPhase2() {
    console.log('Skipping Phase 2');

    // Mark as incomplete
    this.gameState.markLevelComplete(
      this.currentLevel.levelNumber,
      0, // 0% accuracy for skip
      0
    );

    // Show next level or menu
    this.continueGame();
  }

  /**
   * Continue to next level or menu
   */
  continueGame() {
    const nextLevel = this.currentLevel.levelNumber + 1;

    if (nextLevel <= 4) {
      // Load next level
      this.loadLevel(nextLevel);
    } else {
      // All levels complete, show level selector
      this.ui.showLevelSelector();
      this.ui.showMessage('¡Has completado todos los niveles!', 'celebrating');
      this.ui.character.animate('bounce');
    }
  }

  /**
   * Utility delay function
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Promise that resolves after delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.audioCapture) {
      if (this.audioCapture.stop) {
        this.audioCapture.stop();
      }
      this.audioCapture = null;
    }

    this.gameState.save();
    this.ui.hide();
    this.isGameActive = false;
  }
}

// Export for use in App5
export default GameManager;