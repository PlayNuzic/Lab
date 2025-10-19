/**
 * Game UI components for App5 gamification
 * Handles popup cards, bubble hints, and UI interactions
 */

// import { Character } from './character.js'; // DESACTIVADO: Personaje a implementar después
import { getLevel, getLevelHint, getHintPositions } from './levels-config.js';
import { GameState } from './game-state.js';

/**
 * Main Game UI class
 * Manages all UI components for the game
 */
export class GameUI {
  constructor() {
    this.container = null;
    this.popup = null;
    // this.character = new Character(); // DESACTIVADO: Personaje a implementar después
    this.bubble = null;
    this.isVisible = false;
    this.callbacks = {};
    this.gameState = new GameState();
    // this.helpTimer = null; // DESACTIVADO: Sin timers de ayuda por ahora
    // this.helpTimeout = 5000; // 5 seconds for help
    // this.countdownInterval = null;
  }

  /**
   * Initialize UI in the DOM
   * @param {HTMLElement} parentElement - Parent element to attach UI
   */
  init(parentElement = document.body) {
    // Create main container
    this.container = document.createElement('div');
    this.container.className = 'game-container';
    this.container.style.display = 'none';
    parentElement.appendChild(this.container);

    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'game-backdrop';
    backdrop.addEventListener('click', () => this.hide());
    this.container.appendChild(backdrop);

    // Create popup card
    this.createPopup();
  }

  /**
   * Create popup card element
   */
  createPopup() {
    this.popup = document.createElement('div');
    this.popup.className = 'game-popup';

    // Header with level and close button
    const header = document.createElement('div');
    header.className = 'game-popup-header';
    header.innerHTML = `
      <h3 class="game-level-title">Nivel 1</h3>
      <button class="game-close-btn" title="Cerrar">&times;</button>
    `;
    this.popup.appendChild(header);

    // Close button handler
    header.querySelector('.game-close-btn').addEventListener('click', () => this.hide());

    // Character area - DESACTIVADO
    // const characterArea = document.createElement('div');
    // characterArea.className = 'game-character-area';
    // const characterElement = this.character.createElement('neutral');
    // characterArea.appendChild(characterElement);
    // this.popup.appendChild(characterArea);

    // Message area with bubble
    const messageArea = document.createElement('div');
    messageArea.className = 'game-message-area';
    this.popup.appendChild(messageArea);

    // Create bubble
    this.bubble = document.createElement('div');
    this.bubble.className = 'game-bubble';
    messageArea.appendChild(this.bubble);

    // Action buttons area
    const actionArea = document.createElement('div');
    actionArea.className = 'game-action-area';
    this.popup.appendChild(actionArea);

    this.container.appendChild(this.popup);
  }

  /**
   * Show game UI with level - SIMPLIFICADO
   * @param {number} levelNumber - Level to display
   */
  show(levelNumber = 1) {
    if (!this.container) {
      this.init();
    }

    const level = getLevel(levelNumber);
    this.currentLevel = level;

    // Popup simple: requisito + botón continuar
    this.popup.innerHTML = `
      <div class="game-popup-content">
        <button class="game-close-btn" title="Cerrar">&times;</button>
        <h3>Nivel ${levelNumber}</h3>
        <p class="game-requirement">${level.requirement}</p>
        <div class="game-button-group">
          <button class="game-btn game-btn-primary" data-action="start-phase1">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5 3l6 5-6 5V3z"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    // Close button handler
    this.popup.querySelector('.game-close-btn').addEventListener('click', () => this.hide());

    // Start Phase 1 button handler
    this.popup.querySelector('[data-action="start-phase1"]').addEventListener('click', () => {
      console.log('🎯 User clicked Continue - starting Phase 1');
      this.hidePopup(); // Ocultar popup SIN terminar el juego
      document.body.classList.add('game-phase-1'); // Activar fase 1

      if (this.callbacks.onStartPhase1) {
        this.callbacks.onStartPhase1();
      }
    });

    // Show container
    this.container.style.display = 'flex';
    this.isVisible = true;

    // Animate entrance
    this.popup.classList.add('game-popup-enter');
    setTimeout(() => {
      this.popup.classList.remove('game-popup-enter');
    }, 500);

    // Trigger callback
    if (this.callbacks.onShow) {
      this.callbacks.onShow(levelNumber);
    }
  }

  /**
   * Hide popup visually but keep game active
   * Used when transitioning between phases
   */
  hidePopup() {
    if (!this.container) return;

    // Animate exit
    this.popup.classList.add('game-popup-exit');
    setTimeout(() => {
      this.container.style.display = 'none';
      this.popup.classList.remove('game-popup-exit');
      // NOTE: isVisible stays true, game remains active
      // NOTE: phase classes remain active
    }, 300);
  }

  /**
   * Hide game UI completely and end game
   * Used when clicking X button
   */
  hide() {
    if (!this.isVisible) return;

    // Animate exit
    this.popup.classList.add('game-popup-exit');
    setTimeout(() => {
      this.container.style.display = 'none';
      this.popup.classList.remove('game-popup-exit');
      this.isVisible = false;

      // Remove ALL game classes from body
      document.body.classList.remove('game-active', 'game-phase-1', 'game-phase-2');

      // Trigger callback - this will end the game
      if (this.callbacks.onHide) {
        this.callbacks.onHide();
      }
    }, 300);
  }

  /**
   * Show retry popup when pattern is incorrect
   */
  showRetryPopup() {
    if (!this.container) {
      this.init();
    }

    this.popup.innerHTML = `
      <div class="game-popup-content">
        <button class="game-close-btn" title="Cerrar">&times;</button>
        <h3>Patrón incorrecto</h3>
        <p>Intenta de nuevo o abandona el nivel</p>
        <div class="game-button-group">
          <button class="game-btn game-btn-primary" data-action="retry">
            Reintentar
          </button>
          <button class="game-btn game-btn-secondary" data-action="quit">
            Abandonar
          </button>
        </div>
      </div>
    `;

    // Handlers
    this.popup.querySelector('.game-close-btn').addEventListener('click', () => this.hide());

    this.popup.querySelector('[data-action="retry"]').addEventListener('click', () => {
      console.log('🔄 User clicked Retry');
      this.hidePopup();
      document.body.classList.add('game-phase-1');
      if (this.callbacks.onRetry) {
        this.callbacks.onRetry();
      }
    });

    this.popup.querySelector('[data-action="quit"]').addEventListener('click', () => {
      console.log('❌ User clicked Quit');
      if (this.callbacks.onQuit) {
        this.callbacks.onQuit();
      }
      this.hide();
    });

    // Show
    this.container.style.display = 'flex';
    this.isVisible = true;
  }

  /**
   * Show Phase 1 UI (position selection)
   * @param {Object} level - Level configuration
   */
  showPhase1UI(level) {
    const actionArea = this.popup.querySelector('.game-action-area');
    actionArea.innerHTML = '';

    // Instructions
    const instructions = document.createElement('p');
    instructions.className = 'game-instructions';
    instructions.textContent = 'Fase 1: Escribe las posiciones según el requisito';
    actionArea.appendChild(instructions);

    // Help countdown
    const countdown = document.createElement('div');
    countdown.className = 'game-countdown';
    countdown.innerHTML = `
      <span>Ayuda en: </span>
      <span class="game-countdown-number">5</span>
      <span>s</span>
    `;
    actionArea.appendChild(countdown);

    // Buttons
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'game-button-group';

    const validateBtn = document.createElement('button');
    validateBtn.className = 'game-btn game-btn-primary';
    validateBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/></svg>';
    validateBtn.title = 'Validar';
    validateBtn.addEventListener('click', () => this.validatePhase1());

    const skipBtn = document.createElement('button');
    skipBtn.className = 'game-btn game-btn-secondary';
    skipBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M5 3l6 5-6 5V3z"/></svg>';
    skipBtn.title = 'Saltar';
    skipBtn.addEventListener('click', () => this.skipPhase1());

    buttonGroup.appendChild(validateBtn);
    buttonGroup.appendChild(skipBtn);
    actionArea.appendChild(buttonGroup);
  }

  /**
   * Show Phase 2 UI (rhythm synchronization)
   * @param {Object} config - Phase 2 configuration
   */
  showPhase2UI(config) {
    // Recrear popup con estructura simplificada para Fase 2
    // Por defecto: teclado (true si undefined o true, false solo si explícitamente false)
    const isKeyboard = window.gameForceKeyboard !== false;
    const inputIcon = isKeyboard ? '⌨️' : '🎤';
    const inputTitle = isKeyboard ? 'Teclado' : 'Micrófono';
    const inputInstructions = isKeyboard
      ? 'Presiona <strong>ESPACIO</strong> al ritmo del patrón'
      : 'Haz sonidos (palmadas, taps) al ritmo del patrón';

    this.popup.innerHTML = `
      <div class="game-popup-content">
        <button class="game-close-btn" title="Cerrar">&times;</button>
        <h3>Fase 2: Sincronización</h3>
        <div style="margin: 15px 0; padding: 12px; background: rgba(74, 144, 226, 0.1); border-radius: 8px; border-left: 3px solid #4a90e2;">
          <p style="margin: 0 0 8px 0; font-weight: 600;">
            ${inputIcon} Modo: ${inputTitle}
          </p>
          <p style="margin: 0; font-size: 0.9em; opacity: 0.9;">
            ${inputInstructions}
          </p>
        </div>
        <p>El patrón se reproducirá <strong>2 veces</strong> en bucle.</p>
        <p style="font-size: 0.9em; opacity: 0.8;">BPM: <strong>${config.bpm}</strong></p>
        <div class="game-button-group">
          <button class="game-btn game-btn-primary" data-action="start-phase2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5 3l6 5-6 5V3z"/>
            </svg>
            Comenzar
          </button>
        </div>
      </div>
    `;

    // Attach listeners
    this.popup.querySelector('.game-close-btn').addEventListener('click', () => this.hide());
    this.popup.querySelector('[data-action="start-phase2"]').addEventListener('click', () => {
      console.log('🎯 User clicked Start Phase 2');
      if (this.callbacks.onStartPhase2) {
        this.callbacks.onStartPhase2(config);
      }
    });

    // Show container
    this.container.style.display = 'flex';
    this.isVisible = true;
  }

  /**
   * Show message in bubble
   * @param {string} message - Message text
   * @param {string} mood - Character mood
   */
  showMessage(message, mood = 'neutral') {
    if (!this.bubble) return;

    this.bubble.textContent = message;
    this.bubble.classList.add('game-bubble-show');

    // Update character mood - DESACTIVADO
    // this.character.setMood(mood);

    // Auto-hide after delay
    setTimeout(() => {
      this.bubble.classList.remove('game-bubble-show');
    }, 100);
  }

  /**
   * Update progress bar (disabled - no progress shown in popup)
   */
  updateProgress() {
    // Progress and stats removed from popup - only shown in final results
  }

  /**
   * Start help timer
   * @param {number} levelNumber - Current level
   */
  startHelpTimer(levelNumber) {
    this.clearHelpTimer();

    let timeLeft = 5;
    const countdownEl = this.popup.querySelector('.game-countdown-number');

    this.countdownInterval = setInterval(() => {
      timeLeft--;
      if (countdownEl) {
        countdownEl.textContent = timeLeft;
      }

      if (timeLeft <= 0) {
        this.clearHelpTimer();
        this.showHelp(levelNumber);
      }
    }, 1000);

    this.helpTimer = setTimeout(() => {
      this.showHelp(levelNumber);
    }, this.helpTimeout);
  }

  /**
   * Clear help timer
   */
  clearHelpTimer() {
    if (this.helpTimer) {
      clearTimeout(this.helpTimer);
      this.helpTimer = null;
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  /**
   * Show help for current level
   * @param {number} levelNumber - Current level
   */
  showHelp(levelNumber) {
    const hint = getLevelHint(levelNumber);
    const positions = getHintPositions(levelNumber);

    // Show hint message
    this.showMessage(hint, 'happy');
    // this.character.animate('bounce'); // DESACTIVADO

    // Flash hint positions
    if (positions.length > 0 && this.callbacks.onShowHint) {
      this.callbacks.onShowHint(positions);
    }

    // Hide countdown
    const countdown = this.popup.querySelector('.game-countdown');
    if (countdown) {
      countdown.style.display = 'none';
    }
  }

  /**
   * Validate Phase 1 selection
   */
  validatePhase1() {
    // this.clearHelpTimer(); // DESACTIVADO
    if (this.callbacks.onValidatePhase1) {
      this.callbacks.onValidatePhase1();
    }
  }

  /**
   * Skip Phase 1
   */
  skipPhase1() {
    // this.clearHelpTimer(); // DESACTIVADO
    if (this.callbacks.onSkipPhase1) {
      this.callbacks.onSkipPhase1();
    }
  }

  /**
   * Start Phase 2 recording
   * @param {Object} config - Recording configuration
   */
  startPhase2Recording(config) {
    // Show recording indicator
    const indicator = this.popup.querySelector('.game-recording-indicator');
    if (indicator) {
      indicator.style.display = 'flex';
    }

    // Disable buttons during recording
    const buttons = this.popup.querySelectorAll('.game-btn');
    buttons.forEach(btn => btn.disabled = true);

    // Character mood - DESACTIVADO
    // this.character.setMood('focused');

    if (this.callbacks.onStartPhase2) {
      this.callbacks.onStartPhase2(config);
    }
  }

  /**
   * Stop Phase 2 recording
   */
  stopPhase2Recording() {
    // Hide recording indicator
    const indicator = this.popup.querySelector('.game-recording-indicator');
    if (indicator) {
      indicator.style.display = 'none';
    }

    // Enable buttons
    const buttons = this.popup.querySelectorAll('.game-btn');
    buttons.forEach(btn => btn.disabled = false);
  }

  /**
   * Skip Phase 2
   */
  skipPhase2() {
    if (this.callbacks.onSkipPhase2) {
      this.callbacks.onSkipPhase2();
    }
  }

  /**
   * Show results
   * @param {Object} results - Game results
   */
  showResults(results) {
    const { success, accuracy, message } = results;
    const passed = accuracy >= 40; // Opción permisiva: 40% en lugar de 60%

    // Encouraging messages based on performance
    let encouragingMessage = '';
    if (passed) {
      encouragingMessage = accuracy >= 90 ? '¡Excelente trabajo!' : accuracy >= 75 ? '¡Muy bien!' : '¡Buen trabajo!';
    } else {
      encouragingMessage = accuracy >= 50 ? 'Casi lo consigues. ¡Sigue practicando!' : '¡No te rindas! Puedes mejorar.';
    }

    // Recrear popup con estructura simplificada
    this.popup.innerHTML = `
      <div class="game-popup-content">
        <button class="game-close-btn" title="Cerrar">&times;</button>
        <h3>Resultados</h3>
        <div class="game-results">
          <p class="game-accuracy">Precisión: ${Math.round(accuracy)}%</p>
          <p class="game-encouraging-message">${encouragingMessage}</p>
          <div class="game-button-group">
            <button class="game-btn game-btn-primary ${!passed ? 'game-btn-disabled' : ''}"
                    data-action="continue" ${!passed ? 'disabled' : ''}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M5 3l6 5-6 5V3z"/>
              </svg>
              Siguiente Nivel
            </button>
            <button class="game-btn game-btn-secondary" data-action="retry">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 3v2.5L11 3 8 .5V3c-3.9 0-7 3.1-7 7s3.1 7 7 7 7-3.1 7-7h-2c0 2.8-2.2 5-5 5s-5-2.2-5-5 2.2-5 5-5z"/>
              </svg>
              Reintentar
            </button>
            <button class="game-btn game-btn-secondary" data-action="menu">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="2" y="3" width="12" height="2" rx="1"/>
                <rect x="2" y="7" width="12" height="2" rx="1"/>
                <rect x="2" y="11" width="12" height="2" rx="1"/>
              </svg>
              Menú
            </button>
          </div>
        </div>
      </div>
    `;

    // Event listeners
    this.popup.querySelector('.game-close-btn').addEventListener('click', () => this.hide());

    const continueBtn = this.popup.querySelector('[data-action="continue"]');
    if (continueBtn && !continueBtn.disabled) {
      continueBtn.addEventListener('click', () => {
        if (this.callbacks.onContinue) {
          this.callbacks.onContinue();
        }
      });
    }

    this.popup.querySelector('[data-action="retry"]').addEventListener('click', () => {
      console.log('🔄 Retry button clicked - reloading same level');
      if (this.currentLevel && this.callbacks.onSelectLevel) {
        // Pass levelNumber (number) instead of level object
        this.callbacks.onSelectLevel(this.currentLevel.levelNumber);
      }
    });

    this.popup.querySelector('[data-action="menu"]').addEventListener('click', () => {
      this.hide();
    });

    // Mostrar container si está oculto
    this.container.style.display = 'flex';
    this.isVisible = true;
  }

  /**
   * Show achievements notification
   * @param {string[]} achievements - Achievement keys
   */
  showAchievements(achievements) {
    const achievementNames = {
      firstStep: 'Primeros Pasos',
      evenOdd: 'Par e Impar',
      adaptive: 'Adaptable',
      freeSpirit: 'Espíritu Libre',
      perfectScore: 'Puntuación Perfecta',
      streakMaster: 'Maestro de Rachas',
      speedDemon: 'Demonio de Velocidad',
      persistent: 'Persistente',
      expert: 'Experto'
    };

    achievements.forEach((achievement, index) => {
      setTimeout(() => {
        const notification = document.createElement('div');
        notification.className = 'game-achievement-notification';
        notification.innerHTML = `
          <span class="achievement-icon">🏆</span>
          <span class="achievement-name">${achievementNames[achievement] || achievement}</span>
        `;
        document.body.appendChild(notification);

        setTimeout(() => {
          notification.classList.add('show');
        }, 100);

        setTimeout(() => {
          notification.classList.remove('show');
          setTimeout(() => {
            notification.remove();
          }, 300);
        }, 3000);
      }, index * 500);
    });
  }

  /**
   * Set callback functions
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    this.callbacks[event] = callback;
  }

  /**
   * Show level selector
   */
  showLevelSelector() {
    const actionArea = this.popup.querySelector('.game-action-area');
    actionArea.innerHTML = '';

    const title = document.createElement('h4');
    title.textContent = 'Selecciona un nivel';
    actionArea.appendChild(title);

    const levelGrid = document.createElement('div');
    levelGrid.className = 'game-level-grid';

    for (let i = 1; i <= 4; i++) {
      const levelBtn = document.createElement('button');
      levelBtn.className = 'game-level-btn';

      const isCompleted = this.gameState.completedLevels.includes(i);
      const isLocked = i > 1 && !this.gameState.completedLevels.includes(i - 1) && i !== 4; // Level 4 always unlocked

      if (isCompleted) {
        levelBtn.classList.add('completed');
      }
      if (isLocked) {
        levelBtn.classList.add('locked');
        levelBtn.disabled = true;
      }

      levelBtn.innerHTML = `
        <span class="level-number">${i}</span>
        <span class="level-status">
          ${isCompleted ? '✓' : isLocked ? '🔒' : ''}
        </span>
      `;

      levelBtn.addEventListener('click', () => {
        if (!isLocked && this.callbacks.onSelectLevel) {
          this.callbacks.onSelectLevel(i);
        }
      });

      levelGrid.appendChild(levelBtn);
    }

    actionArea.appendChild(levelGrid);

    // Add stats summary
    const stats = this.gameState.getStatsSummary();
    const statsDiv = document.createElement('div');
    statsDiv.className = 'game-level-stats';
    statsDiv.innerHTML = `
      <p>Progreso total: ${Math.round(stats.progress)}%</p>
      <p>Mejor racha: ${stats.bestStreak}</p>
    `;
    actionArea.appendChild(statsDiv);
  }

  /**
   * Reset UI to initial state
   */
  reset() {
    // this.clearHelpTimer(); // DESACTIVADO: Sin timers
    // this.character.reset(); // DESACTIVADO
    this.showMessage('¡Listo para jugar!', 'neutral');
    // this.updateProgress(); // Ya desactivado antes
  }

  /**
   * Show success message before playback with continue button
   */
  showSuccessBeforePlayback(callback) {
    this.popup.innerHTML = `
      <div class="game-popup-content">
        <button class="game-close-btn" title="Cerrar">&times;</button>
        <h3>¡Muy bien!</h3>
        <p class="game-message">Ahora escucha cómo suena.</p>
        <div class="game-button-group">
          <button class="game-btn game-btn-primary" data-action="continue">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5 3l6 5-6 5V3z"/>
            </svg>
            Continuar
          </button>
        </div>
      </div>
    `;

    this.popup.querySelector('.game-close-btn').addEventListener('click', () => this.hide());

    this.popup.querySelector('[data-action="continue"]').addEventListener('click', () => {
      this.hidePopup();
      if (callback) callback();
    });

    this.show();
  }

  /**
   * Show confirmation for free mode (level 4)
   */
  showFreeModeContinue(callback) {
    this.popup.innerHTML = `
      <div class="game-popup-content">
        <button class="game-close-btn" title="Cerrar">&times;</button>
        <h3>¡Perfecto!</h3>
        <p class="game-message">Ahora escuchemos tu patrón.</p>
        <div class="game-button-group">
          <button class="game-btn game-btn-primary" data-action="continue">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5 3l6 5-6 5V3z"/>
            </svg>
            Continuar
          </button>
        </div>
      </div>
    `;

    this.popup.querySelector('.game-close-btn').addEventListener('click', () => this.hide());

    this.popup.querySelector('[data-action="continue"]').addEventListener('click', () => {
      this.hidePopup();
      if (callback) callback();
    });

    this.show();
  }
}