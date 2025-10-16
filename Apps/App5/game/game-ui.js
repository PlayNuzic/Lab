/**
 * Game UI components for App5 gamification
 * Handles popup cards, bubble hints, and UI interactions
 */

import { Character } from './character.js';
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
    this.character = new Character();
    this.bubble = null;
    this.isVisible = false;
    this.callbacks = {};
    this.gameState = new GameState();
    this.helpTimer = null;
    this.helpTimeout = 5000; // 5 seconds for help
    this.countdownInterval = null;
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

    // Character area
    const characterArea = document.createElement('div');
    characterArea.className = 'game-character-area';
    const characterElement = this.character.createElement('neutral');
    characterArea.appendChild(characterElement);
    this.popup.appendChild(characterArea);

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

    // Progress bar
    const progressBar = document.createElement('div');
    progressBar.className = 'game-progress-bar';
    progressBar.innerHTML = `
      <div class="game-progress-fill"></div>
      <span class="game-progress-text">0%</span>
    `;
    this.popup.appendChild(progressBar);

    // Stats area
    const statsArea = document.createElement('div');
    statsArea.className = 'game-stats-area';
    this.popup.appendChild(statsArea);

    this.container.appendChild(this.popup);
  }

  /**
   * Show game UI with level
   * @param {number} levelNumber - Level to display
   */
  show(levelNumber = 1) {
    if (!this.container) {
      this.init();
    }

    const level = getLevel(levelNumber);
    this.currentLevel = level;

    // Update level title
    this.popup.querySelector('.game-level-title').textContent = `Nivel ${levelNumber}`;

    // Show requirement in bubble
    this.showMessage(level.requirement, 'thinking');

    // Update progress
    this.updateProgress();

    // Show phase 1 buttons
    this.showPhase1UI(level);

    // Show container
    this.container.style.display = 'flex';
    this.isVisible = true;

    // Animate entrance
    this.popup.classList.add('game-popup-enter');
    setTimeout(() => {
      this.popup.classList.remove('game-popup-enter');
    }, 500);

    // Start help timer
    this.startHelpTimer(levelNumber);

    // Trigger callback
    if (this.callbacks.onShow) {
      this.callbacks.onShow(levelNumber);
    }
  }

  /**
   * Hide game UI
   */
  hide() {
    if (!this.isVisible) return;

    // Clear timers
    this.clearHelpTimer();

    // Animate exit
    this.popup.classList.add('game-popup-exit');
    setTimeout(() => {
      this.container.style.display = 'none';
      this.popup.classList.remove('game-popup-exit');
      this.isVisible = false;

      // Trigger callback
      if (this.callbacks.onHide) {
        this.callbacks.onHide();
      }
    }, 300);
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
    instructions.textContent = 'Fase 1: Selecciona las posiciones según el requisito';
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
    validateBtn.textContent = 'Validar';
    validateBtn.addEventListener('click', () => this.validatePhase1());

    const skipBtn = document.createElement('button');
    skipBtn.className = 'game-btn game-btn-secondary';
    skipBtn.textContent = 'Saltar';
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
    const actionArea = this.popup.querySelector('.game-action-area');
    actionArea.innerHTML = '';

    // Instructions
    const instructions = document.createElement('p');
    instructions.className = 'game-instructions';
    const inputMode = window.gameForceKeyboard ? 'teclado (Espacio)' : 'micrófono';
    instructions.textContent = `Fase 2: Sincroniza el ritmo con ${inputMode}`;
    actionArea.appendChild(instructions);

    // Pattern info
    const patternInfo = document.createElement('div');
    patternInfo.className = 'game-pattern-info';
    patternInfo.innerHTML = `
      <p>El patrón se reproducirá <strong>2 veces</strong></p>
      <p>BPM: <strong>${config.bpm}</strong></p>
    `;
    actionArea.appendChild(patternInfo);

    // Recording indicator
    const recordingIndicator = document.createElement('div');
    recordingIndicator.className = 'game-recording-indicator';
    recordingIndicator.style.display = 'none';
    recordingIndicator.innerHTML = `
      <span class="recording-dot"></span>
      <span>Grabando...</span>
    `;
    actionArea.appendChild(recordingIndicator);

    // Buttons
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'game-button-group';

    const startBtn = document.createElement('button');
    startBtn.className = 'game-btn game-btn-primary';
    startBtn.textContent = 'Empezar';
    startBtn.addEventListener('click', () => this.startPhase2Recording(config));

    const skipBtn = document.createElement('button');
    skipBtn.className = 'game-btn game-btn-secondary';
    skipBtn.textContent = 'Saltar';
    skipBtn.addEventListener('click', () => this.skipPhase2());

    buttonGroup.appendChild(startBtn);
    buttonGroup.appendChild(skipBtn);
    actionArea.appendChild(buttonGroup);
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

    // Update character mood
    this.character.setMood(mood);

    // Auto-hide after delay
    setTimeout(() => {
      this.bubble.classList.remove('game-bubble-show');
    }, 100);
  }

  /**
   * Update progress bar
   */
  updateProgress() {
    const stats = this.gameState.getStatsSummary();
    const progressFill = this.popup.querySelector('.game-progress-fill');
    const progressText = this.popup.querySelector('.game-progress-text');

    if (progressFill && progressText) {
      progressFill.style.width = `${stats.progress}%`;
      progressText.textContent = `${Math.round(stats.progress)}%`;
    }

    // Update stats area
    const statsArea = this.popup.querySelector('.game-stats-area');
    if (statsArea) {
      statsArea.innerHTML = `
        <div class="game-stat">
          <span class="stat-label">Racha:</span>
          <span class="stat-value">${stats.currentStreak}</span>
        </div>
        <div class="game-stat">
          <span class="stat-label">Precisión:</span>
          <span class="stat-value">${Math.round(stats.averageAccuracy)}%</span>
        </div>
        <div class="game-stat">
          <span class="stat-label">Logros:</span>
          <span class="stat-value">${stats.achievementsUnlocked}/${stats.totalAchievements}</span>
        </div>
      `;
    }
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
    this.character.animate('bounce');

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
    this.clearHelpTimer();
    if (this.callbacks.onValidatePhase1) {
      this.callbacks.onValidatePhase1();
    }
  }

  /**
   * Skip Phase 1
   */
  skipPhase1() {
    this.clearHelpTimer();
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

    // Character mood
    this.character.setMood('focused');

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
    const { success, accuracy, message, achievements } = results;

    // Update character mood
    if (success) {
      this.character.setMood('celebrating');
      this.character.animate('bounce');
    } else {
      this.character.setMood('sad');
      this.character.animate('shake');
    }

    // Show message
    this.showMessage(message, success ? 'celebrating' : 'sad');

    // Update progress
    this.updateProgress();

    // Show achievements if any
    if (achievements && achievements.length > 0) {
      this.showAchievements(achievements);
    }

    // Update action area with results
    const actionArea = this.popup.querySelector('.game-action-area');
    actionArea.innerHTML = `
      <div class="game-results">
        <h4>${success ? '¡Éxito!' : 'Inténtalo de nuevo'}</h4>
        <p class="game-accuracy">Precisión: ${Math.round(accuracy)}%</p>
        <div class="game-button-group">
          <button class="game-btn game-btn-primary" onclick="this.dispatchEvent(new CustomEvent('game-continue'))">
            ${success ? 'Siguiente Nivel' : 'Reintentar'}
          </button>
          <button class="game-btn game-btn-secondary" onclick="this.dispatchEvent(new CustomEvent('game-menu'))">
            Menú
          </button>
        </div>
      </div>
    `;

    // Add event listeners to new buttons
    actionArea.querySelector('[onclick*="game-continue"]').addEventListener('game-continue', () => {
      if (this.callbacks.onContinue) {
        this.callbacks.onContinue();
      }
    });

    actionArea.querySelector('[onclick*="game-menu"]').addEventListener('game-menu', () => {
      this.hide();
    });
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
    this.clearHelpTimer();
    this.character.reset();
    this.showMessage('¡Listo para jugar!', 'neutral');
    this.updateProgress();
  }
}