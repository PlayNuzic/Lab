/**
 * Results Screen Component
 * Displays game results with scores, accuracy, and next actions
 */

/**
 * Creates and manages results screen display
 */
export class ResultsScreen {
  constructor(config = {}) {
    this.containerId = config.containerId || 'results-container';
    this.className = config.className || 'results-screen';
    this.animationDuration = config.animationDuration || 600;
    this.showConfetti = config.showConfetti !== false;

    // Callbacks
    this.onContinue = config.onContinue || (() => {});
    this.onRetry = config.onRetry || (() => {});
    this.onExit = config.onExit || (() => {});

    // Current screen element
    this.currentScreen = null;
    this.container = null;
  }

  /**
   * Show results screen
   * @param {Object} results - Results data
   * @returns {Promise}
   */
  show(results) {
    return new Promise(resolve => {
      // Create container
      this.createContainer();

      // Create screen
      this.currentScreen = this.createResultsScreen(results);
      this.container.appendChild(this.currentScreen);

      // Animate in
      requestAnimationFrame(() => {
        this.currentScreen.classList.add('show');

        // Show confetti for good results
        if (this.showConfetti && results.accuracy >= 80) {
          this.createConfettiEffect();
        }

        setTimeout(resolve, this.animationDuration);
      });
    });
  }

  /**
   * Create container element
   * @private
   */
  createContainer() {
    let container = document.getElementById(this.containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = this.containerId;
      container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(5px);
      `;
      document.body.appendChild(container);
    }
    this.container = container;
  }

  /**
   * Create results screen element
   * @private
   */
  createResultsScreen(results) {
    const screen = document.createElement('div');
    screen.className = this.className;
    screen.style.cssText = `
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 20px;
      padding: 40px;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      transform: scale(0.8);
      opacity: 0;
      transition: all ${this.animationDuration}ms cubic-bezier(0.68, -0.55, 0.265, 1.55);
    `;

    // Title
    const title = this.createTitle(results);
    screen.appendChild(title);

    // Stars rating
    const stars = this.createStarsRating(results.accuracy);
    screen.appendChild(stars);

    // Score display
    const scoreDisplay = this.createScoreDisplay(results);
    screen.appendChild(scoreDisplay);

    // Statistics
    const stats = this.createStatistics(results);
    screen.appendChild(stats);

    // Message
    const message = this.createMessage(results);
    screen.appendChild(message);

    // Action buttons
    const buttons = this.createActionButtons(results);
    screen.appendChild(buttons);

    return screen;
  }

  /**
   * Create title element
   * @private
   */
  createTitle(results) {
    const title = document.createElement('h1');
    title.className = 'results-title';
    title.style.cssText = `
      color: white;
      font-size: 36px;
      font-weight: bold;
      text-align: center;
      margin: 0 0 20px 0;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    `;

    // Determine title based on performance
    if (results.accuracy >= 90) {
      title.textContent = '¡Excelente! 🌟';
    } else if (results.accuracy >= 70) {
      title.textContent = '¡Muy bien! 👏';
    } else if (results.accuracy >= 50) {
      title.textContent = 'Bien hecho 👍';
    } else {
      title.textContent = 'Sigue practicando 💪';
    }

    return title;
  }

  /**
   * Create stars rating display
   * @private
   */
  createStarsRating(accuracy) {
    const container = document.createElement('div');
    container.className = 'stars-rating';
    container.style.cssText = `
      display: flex;
      justify-content: center;
      gap: 10px;
      margin-bottom: 30px;
    `;

    const starCount = Math.ceil((accuracy / 100) * 3);

    for (let i = 0; i < 3; i++) {
      const star = document.createElement('span');
      star.style.cssText = `
        font-size: 48px;
        transition: all 0.5s ease;
        animation: ${i < starCount ? 'pulse' : 'none'} 1s ease ${i * 0.2}s;
      `;
      star.textContent = i < starCount ? '⭐' : '☆';
      container.appendChild(star);
    }

    // Add pulse animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.2); }
      }
    `;
    document.head.appendChild(style);

    return container;
  }

  /**
   * Create score display
   * @private
   */
  createScoreDisplay(results) {
    const container = document.createElement('div');
    container.className = 'score-display';
    container.style.cssText = `
      text-align: center;
      margin-bottom: 30px;
    `;

    // Main score
    const score = document.createElement('div');
    score.className = 'main-score';
    score.style.cssText = `
      font-size: 64px;
      font-weight: bold;
      color: white;
      text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.3);
      margin-bottom: 10px;
    `;
    score.textContent = results.score || '0';

    // Score label
    const label = document.createElement('div');
    label.style.cssText = `
      color: rgba(255, 255, 255, 0.9);
      font-size: 18px;
      text-transform: uppercase;
      letter-spacing: 2px;
    `;
    label.textContent = 'Puntos';

    container.appendChild(score);
    container.appendChild(label);

    // Animate score counting
    this.animateScore(score, results.score);

    return container;
  }

  /**
   * Create statistics display
   * @private
   */
  createStatistics(results) {
    const container = document.createElement('div');
    container.className = 'statistics';
    container.style.cssText = `
      background: rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    `;

    const stats = [
      { label: 'Nivel', value: results.level || '1', icon: '📊' },
      { label: 'Precisión', value: `${Math.round(results.accuracy || 0)}%`, icon: '🎯' },
      { label: 'Tiempo', value: this.formatTime(results.duration), icon: '⏱️' },
      { label: 'Intentos', value: results.attempts || '0', icon: '🔄' }
    ];

    stats.forEach(stat => {
      const statElement = this.createStatElement(stat);
      container.appendChild(statElement);
    });

    return container;
  }

  /**
   * Create individual stat element
   * @private
   */
  createStatElement(stat) {
    const element = document.createElement('div');
    element.className = 'stat-item';
    element.style.cssText = `
      text-align: center;
      color: white;
    `;

    const icon = document.createElement('div');
    icon.style.fontSize = '24px';
    icon.style.marginBottom = '4px';
    icon.textContent = stat.icon;

    const value = document.createElement('div');
    value.style.cssText = `
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 2px;
    `;
    value.textContent = stat.value;

    const label = document.createElement('div');
    label.style.cssText = `
      font-size: 12px;
      opacity: 0.8;
      text-transform: uppercase;
    `;
    label.textContent = stat.label;

    element.appendChild(icon);
    element.appendChild(value);
    element.appendChild(label);

    return element;
  }

  /**
   * Create message based on results
   * @private
   */
  createMessage(results) {
    const message = document.createElement('p');
    message.className = 'results-message';
    message.style.cssText = `
      color: rgba(255, 255, 255, 0.95);
      text-align: center;
      font-size: 16px;
      line-height: 1.5;
      margin: 20px 0;
      padding: 0 20px;
    `;

    // Determine message based on performance
    if (results.accuracy >= 90) {
      message.textContent = '¡Increíble! Has dominado este nivel. ¿Listo para el siguiente desafío?';
    } else if (results.accuracy >= 70) {
      message.textContent = 'Buen trabajo. Con un poco más de práctica serás un experto.';
    } else if (results.accuracy >= 50) {
      message.textContent = 'Vas por buen camino. Sigue practicando para mejorar tu precisión.';
    } else {
      message.textContent = 'La práctica hace al maestro. ¡Inténtalo de nuevo!';
    }

    // Add custom message if provided
    if (results.customMessage) {
      message.textContent = results.customMessage;
    }

    return message;
  }

  /**
   * Create action buttons
   * @private
   */
  createActionButtons(results) {
    const container = document.createElement('div');
    container.className = 'action-buttons';
    container.style.cssText = `
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-top: 30px;
    `;

    // Determine which buttons to show
    const buttons = [];

    if (results.nextLevel && results.accuracy >= 60) {
      buttons.push({
        text: 'Siguiente Nivel',
        icon: '➡️',
        primary: true,
        onClick: () => {
          this.hide();
          this.onContinue(results);
        }
      });
    }

    buttons.push({
      text: results.accuracy < 60 ? 'Reintentar' : 'Jugar de Nuevo',
      icon: '🔄',
      primary: results.accuracy < 60,
      onClick: () => {
        this.hide();
        this.onRetry(results);
      }
    });

    buttons.push({
      text: 'Salir',
      icon: '🚪',
      onClick: () => {
        this.hide();
        this.onExit(results);
      }
    });

    buttons.forEach(btnConfig => {
      const button = this.createButton(btnConfig);
      container.appendChild(button);
    });

    return container;
  }

  /**
   * Create button element
   * @private
   */
  createButton(config) {
    const button = document.createElement('button');
    button.className = `action-button ${config.primary ? 'primary' : ''}`;
    button.style.cssText = `
      padding: 12px 24px;
      font-size: 16px;
      font-weight: 600;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 30px;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
      ${config.primary ? `
        background: white;
        color: #667eea;
      ` : `
        background: transparent;
        color: white;
      `}
    `;

    // Icon
    if (config.icon) {
      const icon = document.createElement('span');
      icon.textContent = config.icon;
      button.appendChild(icon);
    }

    // Text
    const text = document.createElement('span');
    text.textContent = config.text;
    button.appendChild(text);

    // Click handler
    button.addEventListener('click', config.onClick);

    // Hover effect
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.05)';
      if (config.primary) {
        button.style.boxShadow = '0 5px 15px rgba(255, 255, 255, 0.3)';
      } else {
        button.style.background = 'rgba(255, 255, 255, 0.1)';
      }
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = 'none';
      if (!config.primary) {
        button.style.background = 'transparent';
      }
    });

    return button;
  }

  /**
   * Animate score counting
   * @private
   */
  animateScore(element, target) {
    const duration = 1500;
    const start = 0;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const current = Math.round(start + (target - start) * easeOutQuart);

      element.textContent = current;

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  /**
   * Format time duration
   * @private
   */
  formatTime(ms) {
    if (!ms) return '0s';

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Create confetti effect
   * @private
   */
  createConfettiEffect() {
    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];

    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement('div');
      confetti.style.cssText = `
        position: fixed;
        width: 10px;
        height: 10px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        left: ${Math.random() * 100}%;
        top: -10px;
        opacity: 1;
        transform: rotate(${Math.random() * 360}deg);
        animation: fall ${2 + Math.random() * 3}s linear;
      `;
      this.container.appendChild(confetti);

      // Remove after animation
      setTimeout(() => confetti.remove(), 5000);
    }

    // Add fall animation
    if (!document.getElementById('confetti-style')) {
      const style = document.createElement('style');
      style.id = 'confetti-style';
      style.textContent = `
        @keyframes fall {
          to {
            top: 100%;
            transform: rotate(${Math.random() * 360 + 360}deg);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * Hide results screen
   * @returns {Promise}
   */
  hide() {
    return new Promise(resolve => {
      if (!this.currentScreen) {
        resolve();
        return;
      }

      // Animate out
      this.currentScreen.classList.remove('show');
      this.currentScreen.style.opacity = '0';
      this.currentScreen.style.transform = 'scale(0.8)';

      // Remove after animation
      setTimeout(() => {
        if (this.container) {
          this.container.remove();
          this.container = null;
        }
        this.currentScreen = null;
        resolve();
      }, this.animationDuration);
    });
  }

  /**
   * Dispose of resources
   */
  dispose() {
    this.hide();
  }
}