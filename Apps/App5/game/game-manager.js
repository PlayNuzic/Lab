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
import { playCountIn } from '../../../libs/ear-training/count-in-controller.js';
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
    this.playStopCount = 0; // Track play/stop button clicks
    this.cycleReproductionCount = 0; // Track cycle reproductions
  }

  /**
   * Initialize game manager
   */
  async init() {
    console.log('🎮 GameManager.init() starting...');

    // Inicializar modo de captura: TECLADO por defecto
    // IMPORTANTE: Siempre resetear a true al iniciar el game manager
    // (puede cambiarse con debugGame.useMicrophone() después de inicializar)
    window.gameForceKeyboard = true;
    console.log('⌨️ Modo de captura: TECLADO (tecla ESPACIO) - default');

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

    // Setup event capture for play/stop and cycle count
    this.setupEventCapture();
    console.log('✅ Event capture setup');

    // Setup event listeners for real app interactions
    this.setupEventListeners();
    console.log('✅ Event listeners setup');

    console.log('✅ GameManager initialized successfully');
  }

  /**
   * Setup event listeners for real app interactions (Enter key, etc.)
   */
  setupEventListeners() {
    // Get the editable element for pulseSeq
    const editEl = this.pulseSeqController?.getEditElement();

    if (editEl) {
      // Listen for Enter key in Phase 1
      editEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && this.currentPhase === 1 && this.isGameActive) {
          e.preventDefault();
          console.log('📝 Enter detected in Phase 1 - auto-validating...');
          this.autoValidatePhase1();
        }
      });

      console.log('✅ Enter listener attached to pulseSeq');
    } else {
      console.warn('⚠️ pulseSeqController.getEditElement() not available yet');
    }
  }

  /**
   * Setup event capture for play/stop and cycle reproduction
   */
  setupEventCapture() {
    // Capture play button clicks
    const playBtn = document.querySelector('.play');
    if (playBtn) {
      playBtn.addEventListener('click', () => {
        if (this.isGameActive) {
          this.playStopCount++;
          console.log('▶️ Play clicked during game. Count:', this.playStopCount);
        }
      });
    }

    // Capture stop button clicks (if exists separately)
    const stopBtn = document.querySelector('.stop');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        if (this.isGameActive) {
          this.playStopCount++;
          console.log('⏹️ Stop clicked during game. Count:', this.playStopCount);
        }
      });
    }

    // Capture cycle reproductions - listen to audio playback events
    // This depends on how App5 triggers playback, we'll track via Tone.js Transport
    if (window.Tone && window.Tone.Transport) {
      window.Tone.Transport.on('start', () => {
        if (this.isGameActive && this.currentPhase === 'phase2') {
          this.cycleReproductionCount++;
          console.log('🔄 Cycle reproduction. Count:', this.cycleReproductionCount);
        }
      });
    }
  }

  /**
   * Setup UI event callbacks
   */
  setupUICallbacks() {
    // Phase 1 callbacks
    this.ui.on('onStartPhase1', () => {
      // Focus en pulseSeq cuando el usuario hace clic en "Continuar"
      console.log('🎯 onStartPhase1 callback - focusing pulseSeq');
      setTimeout(() => {
        const editEl = this.pulseSeqController?.getEditElement();
        if (editEl) {
          editEl.focus();
          // Force cursor visibility
          const range = document.createRange();
          const sel = window.getSelection();
          if (editEl.childNodes.length > 0) {
            range.selectNodeContents(editEl);
            range.collapse(false);
          } else {
            // Empty element, create text node
            const textNode = document.createTextNode('');
            editEl.appendChild(textNode);
            range.setStart(textNode, 0);
            range.setEnd(textNode, 0);
          }
          sel.removeAllRanges();
          sel.addRange(range);
          console.log('✅ PulseSeq focused after Continue click');
        }
      }, 100); // Pequeño delay para que el popup termine de ocultarse
    });
    this.ui.on('onValidatePhase1', () => this.validatePhase1());
    this.ui.on('onSkipPhase1', () => this.skipToPhase2());
    this.ui.on('onShowHint', (positions) => this.flashHintPositions(positions));

    // Phase 2 callbacks
    this.ui.on('onStartPhase2', (config) => this.startPhase2Recording(config));
    this.ui.on('onSkipPhase2', () => this.skipPhase2());

    // Retry/Quit callbacks
    this.ui.on('onRetry', () => {
      console.log('🔄 Retry callback - clearing pulseSeq and refocusing');
      // Clear pulseSeq and refocus
      if (this.pulseSeqController) {
        this.pulseSeqController.setText('');
        setTimeout(() => {
          const editEl = this.pulseSeqController.getEditElement();
          if (editEl) {
            editEl.focus();
            // Force cursor visibility
            const range = document.createRange();
            const sel = window.getSelection();
            if (editEl.childNodes.length > 0) {
              range.selectNodeContents(editEl);
              range.collapse(false);
            } else {
              const textNode = document.createTextNode('');
              editEl.appendChild(textNode);
              range.setStart(textNode, 0);
              range.setEnd(textNode, 0);
            }
            sel.removeAllRanges();
            sel.addRange(range);
            console.log('✅ PulseSeq cleared and refocused for retry');
          }
        }, 100);
      }
    });

    this.ui.on('onQuit', () => {
      console.log('❌ Quit callback - ending game');
      this.endGame();
    });

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

    // IMPORTANTE: Siempre empezar desde nivel 1
    // El progreso se guarda (completedLevels) pero cada sesión empieza desde el principio
    console.log('📋 Starting game - always begin at Level 1');

    // Limpiar PulseSeq - no debe haber posiciones seleccionadas al iniciar
    if (this.pulseSeqController) {
      this.pulseSeqController.setText('');
      console.log('✅ PulseSeq cleared');
    }

    this.ui.showLevelSelector();

    this.ui.show(1); // Always show level 1 UI initially
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
      // CRITICAL: Properly dispose microphone when exiting game
      if (this.audioCapture.dispose) {
        this.audioCapture.dispose();
        console.log('🎤 Micrófono desconectado al salir del juego');
      } else if (this.audioCapture.stop) {
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
   * Set level parameters in the app (Lg, BPM, pulseSeq)
   * @param {Object} level - Level configuration
   */
  setLevelParameters(level) {
    console.log(`📝 Setting level parameters: Lg=${level.lg}, BPM=${level.bpm}`);

    // Get input elements from window (exposed by main.js)
    const inputLg = window.inputLg;
    const inputV = window.inputV;
    const setValue = window.setValue;
    const handleInput = window.handleInput;

    if (!inputLg || !inputV || !setValue || !handleInput) {
      console.warn('⚠️ Input controls not available yet');
      return;
    }

    // Set Lg (longitud)
    if (level.lg) {
      setValue(inputLg, level.lg);
      handleInput({ target: inputLg });
      console.log(`✅ Lg set to ${level.lg}`);
    }

    // Set BPM (velocidad)
    if (level.bpm) {
      setValue(inputV, level.bpm);
      handleInput({ target: inputV });
      console.log(`✅ BPM set to ${level.bpm}`);
    }

    // Clear pulseSeq
    if (this.pulseSeqController) {
      this.pulseSeqController.setText('');
      console.log('✅ PulseSeq cleared');
    }
  }

  /**
   * Load a specific level
   * @param {number} levelNumber - Level to load
   */
  loadLevel(levelNumber) {
    console.log(`Loading level ${levelNumber}`);

    this.currentLevel = getLevel(levelNumber);
    this.currentPhase = 1;

    // Reset event counters for new level
    this.playStopCount = 0;
    this.cycleReproductionCount = 0;

    // Set level parameters (Lg, BPM, pulseSeq)
    this.setLevelParameters(this.currentLevel);

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
      return;
    }

    // Note: Lg and BPM already set by setLevelParameters() in loadLevel()
    // Note: pulseSeq already cleared by setLevelParameters()
    // Note: Focus will be set by onStartPhase1 callback when user clicks Continue
  }

  /**
   * Auto-validate Phase 1 when user presses Enter
   * Uses real data from pulse sequence controller
   */
  async autoValidatePhase1() {
    console.log('🔍 Auto-validating Phase 1 using real app data');

    if (!this.pulseSeqController) {
      console.error('No pulse sequence controller');
      return;
    }

    // Get current text from REAL pulse sequence editable (contains ONLY numbers)
    const text = this.pulseSeqController.getText().trim();
    console.log('📝 Current pulseSeq text:', text);

    if (!text) {
      console.warn('⚠️ No positions entered');
      return;
    }

    // Text editable contains only numbers (e.g., "1 3")
    // Use REAL sanitization from the app with level's Lg
    const lg = this.currentLevel.lg || 4;
    const sanitized = sanitizePulseSequence(text, lg);
    console.log('✨ Sanitized:', sanitized);

    if (!sanitized || sanitized.length === 0) {
      console.warn('⚠️ Invalid format');
      // TODO: Show error message to user
      return;
    }

    // sanitized is already an array of numbers [1, 3]
    const positions = sanitized;
    console.log('🎯 Positions:', positions);

    // Validate using level's validation function
    const isCorrect = this.currentLevel.validate(positions);
    console.log('✅ Is correct?', isCorrect);

    if (isCorrect) {
      // Store pattern for phase 2
      this.playbackPatterns = positions;

      // Show success and play pattern
      this.showSuccessAndPlayPattern();
    } else {
      console.warn('❌ Incorrect pattern');
      // Show retry popup
      this.ui.showRetryPopup();
    }
  }

  /**
   * Show success message and play pattern in LINEAR mode (1 cycle)
   */
  showSuccessAndPlayPattern() {
    console.log('🎉 Pattern correct - playing 1 cycle in LINEAR mode');
    console.log(`📊 Pattern: P(${this.playbackPatterns.join(' ')}) Lg=${this.currentLevel.lg} BPM=${this.currentLevel.bpm}`);

    // Hide popup
    this.ui.hidePopup();

    // Force LINEAR mode (circular = false)
    const circularToggle = window.circularTimelineToggle;
    if (circularToggle && circularToggle.checked) {
      circularToggle.checked = false;
      circularToggle.dispatchEvent(new Event('change'));
      console.log('✅ Timeline set to LINEAR mode');
    }

    // Wait 500ms, then click REAL play button
    setTimeout(() => {
      const playBtn = document.querySelector('.play');
      if (playBtn) {
        console.log('▶️ Playing pattern (1 cycle in linear mode)');
        playBtn.click();
      } else {
        console.error('❌ Play button not found');
        return;
      }
    }, 500);

    // Calculate duration of 1 cycle
    const beatMs = (60 / this.currentLevel.bpm) * 1000; // ms per beat
    const cycleMs = beatMs * this.currentLevel.lg; // ms per cycle
    const totalMs = cycleMs + 1000; // 1 cycle + 1s margin

    console.log(`⏱️ Waiting ${totalMs}ms (1 cycle: ${cycleMs}ms at ${this.currentLevel.bpm} BPM, Lg=${this.currentLevel.lg})`);

    // After 1 cycle, start Phase 2 (which will switch to circular)
    setTimeout(() => {
      console.log('✅ 1 cycle completed, starting Phase 2');
      this.startPhase2();
    }, totalMs);
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
      // this.ui.character.animate('shake'); // DESACTIVADO
      return;
    }

    // sanitized is already an array of numbers from sanitizePulseSequence()
    const positions = sanitized;

    // Check if selection meets level requirements
    const isCorrect = checkLevelCompletion(this.currentLevel.levelNumber, positions);

    if (isCorrect) {
      const phase1Time = Date.now() - this.phase1StartTime;
      this.ui.showMessage('¡Correcto! Preparando Fase 2...', 'happy');
      // this.ui.character.animate('bounce'); // DESACTIVADO

      // Store pattern for phase 2
      this.playbackPatterns = positions;

      // Proceed to Phase 2 after a short delay
      setTimeout(() => {
        this.startPhase2();
      }, 1500);
    } else {
      this.ui.showMessage('Incorrecto. Revisa el requisito.', 'sad');
      // this.ui.character.animate('shake'); // DESACTIVADO

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
      const input = this.pulseSeqController.getEditElement();
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

    // Change timeline to CIRCULAR mode for Phase 2
    const circularToggle = window.circularTimelineToggle;
    if (circularToggle && !circularToggle.checked) {
      circularToggle.checked = true;
      circularToggle.dispatchEvent(new Event('change'));
      console.log('✅ Timeline set to CIRCULAR mode for Phase 2');
    }

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
   * Nueva secuencia: count-in → reproducción app real → captura
   * @param {Object} config - Recording configuration
   */
  async startPhase2Recording(config) {
    console.log('🎯 Starting Phase 2 recording with config:', config);

    try {
      // 1. Ocultar popup Fase 2
      this.ui.hidePopup();
      console.log('✅ Popup oculto');

      // 2. Forzar CIRCULAR mode para reproducción
      const circularToggle = window.circularTimelineToggle;
      if (circularToggle && !circularToggle.checked) {
        circularToggle.checked = true;
        circularToggle.dispatchEvent(new Event('change'));
        console.log('✅ Timeline set to CIRCULAR mode');
      }

      // 3. Inicializar audio capture (sin calibrar aún)
      if (window.gameForceKeyboard) {
        console.log('⌨️ Using keyboard capture mode');
        this.audioCapture = createKeyboardCapture();
      } else {
        console.log('🎤 Using microphone capture mode');
        this.audioCapture = await createMicrophoneCapture();
      }

      // 4. Cálculos de timing
      const beatMs = (60 / config.bpm) * 1000;           // ms por beat
      const countInDuration = config.lg * beatMs;         // duración del count-in
      const calibrationDuration = (config.lg - 0.5) * beatMs; // calibrar un poco menos que el count-in
      const cycleDuration = config.lg * beatMs;           // duración de 1 ciclo
      const captureDuration = 2 * cycleDuration + 500;   // 2 ciclos + 500ms buffer

      console.log(`⏱️ Timing: beatMs=${beatMs.toFixed(0)}ms, countIn=${countInDuration.toFixed(0)}ms, calibration=${calibrationDuration.toFixed(0)}ms, capture=${captureDuration.toFixed(0)}ms`);

      // 5. Disparar count-in Y calibrar micrófono en paralelo
      console.log('🎵 Starting count-in and calibration...');

      const countInPromise = playCountIn({
        beats: config.lg,
        bpm: config.bpm,
        visualFeedback: true,
        audioFeedback: true
      });

      // Calibrar en paralelo (termina antes que el count-in)
      const calibrationPromise = (async () => {
        if (!window.gameForceKeyboard && this.audioCapture.calibrateNoiseFloor) {
          console.log(`🎤 Calibrando micrófono durante ${calibrationDuration.toFixed(0)}ms...`);
          await this.audioCapture.calibrateNoiseFloor(calibrationDuration);
          console.log('✅ Calibración completada');
        }
      })();

      // Esperar a que termine el count-in
      await countInPromise;
      console.log('✅ Count-in terminado');

      // 6. Activar botón LOOP para reproducir 2 veces
      console.log('🔁 Activando loop para reproducir 2 ciclos...');
      const loopBtn = document.querySelector('.loop');
      if (loopBtn && !loopBtn.classList.contains('active')) {
        loopBtn.click();
        console.log('✅ Loop button activated');
      }

      // 7. Reproducir patrón en la app real (timeline circular con loop)
      console.log('▶️ Reproduciendo patrón en app real...');
      const playBtn = document.querySelector('.play');
      if (playBtn && !playBtn.classList.contains('active')) {
        playBtn.click(); // Inicia reproducción en circular mode con loop
        console.log('✅ Play button clicked - reproduciendo en modo circular con loop');
      } else {
        console.warn('⚠️ Play button not found or already active');
      }

      // 8. Iniciar captura del micrófono DESPUÉS del count-in
      console.log('🎤 Iniciando captura de micrófono...');
      this.audioCapture.startRecording();

      // Calculate expected timestamps from pattern
      const fractions = this.patternsToFractions(config.patterns, config.lg);
      const expectedTimestamps = fractionsToTimestamps(fractions, config.bpm);

      // Double the timestamps for 2 repeats
      const allExpectedTimestamps = [
        ...expectedTimestamps,
        ...expectedTimestamps.map(t => t + cycleDuration)
      ];

      console.log('🎯 Expected timestamps:', allExpectedTimestamps);

      // 9. Después de 2 ciclos: detener reproducción y captura
      setTimeout(async () => {
        console.log('⏹️ Deteniendo reproducción y captura...');

        // Detener reproducción
        if (playBtn && playBtn.classList.contains('active')) {
          playBtn.click();
          console.log('✅ Play button clicked again - reproducción detenida');
        }

        // Desactivar loop
        if (loopBtn && loopBtn.classList.contains('active')) {
          loopBtn.click();
          console.log('✅ Loop button deactivated');
        }

        // Detener captura y obtener beats
        const capturedBeats = this.audioCapture.stopRecording();
        console.log('🎵 Captured beats:', capturedBeats);

        // Analyze rhythm
        const analysis = this.rhythmAnalyzer.compareRhythm(
          capturedBeats,
          allExpectedTimestamps,
          { tolerance: 300 } // 300ms tolerance (opción permisiva)
        );

        console.log('📊 Rhythm analysis:', analysis);

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
        const success = accuracy >= 60; // Opción permisiva: 60% en lugar de 80%
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

        // CRITICAL: Dispose microphone after showing results
        if (this.audioCapture && this.audioCapture.dispose) {
          this.audioCapture.dispose();
          console.log('🎤 Micrófono desconectado después de Phase 2');
        }

        console.log('✅ Phase 2 completado');

      }, captureDuration);

    } catch (error) {
      console.error('❌ Error in Phase 2 recording:', error);
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
      // this.ui.character.animate('bounce'); // DESACTIVADO
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