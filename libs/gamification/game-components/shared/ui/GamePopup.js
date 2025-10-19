/**
 * Game Popup Component
 * Reusable popup for game instructions, requirements, and messages
 */

/**
 * Creates and manages game popups
 */
export class GamePopup {
  constructor(config = {}) {
    this.containerId = config.containerId || 'game-popup-container';
    this.className = config.className || 'game-popup';
    this.backdropClassName = config.backdropClassName || 'game-backdrop';
    this.animationDuration = config.animationDuration || 400;
    this.autoClose = config.autoClose || false;
    this.autoCloseDelay = config.autoCloseDelay || 3000;

    // Create container if it doesn't exist
    this.ensureContainer();

    // Current popup element
    this.currentPopup = null;
    this.currentBackdrop = null;
    this.autoCloseTimer = null;
  }

  /**
   * Ensure popup container exists
   * @private
   */
  ensureContainer() {
    let container = document.getElementById(this.containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = this.containerId;
      container.className = 'game-popup-container';
      container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 10000;
      `;
      document.body.appendChild(container);
    }
    this.container = container;
  }

  /**
   * Show a popup with content
   * @param {Object} options - Popup options
   * @returns {Promise} Resolves when popup is shown
   */
  show(options = {}) {
    return new Promise(resolve => {
      // Hide any existing popup
      if (this.currentPopup) {
        this.hide();
      }

      // Create backdrop
      this.currentBackdrop = this.createBackdrop(options);
      this.container.appendChild(this.currentBackdrop);

      // Create popup
      this.currentPopup = this.createPopup(options);
      this.container.appendChild(this.currentPopup);

      // Enable pointer events
      this.container.style.pointerEvents = 'auto';

      // Add show animation
      requestAnimationFrame(() => {
        this.currentBackdrop.classList.add('show');
        this.currentPopup.classList.add('show');

        // Setup auto-close if enabled
        if (this.autoClose || options.autoClose) {
          const delay = options.autoCloseDelay || this.autoCloseDelay;
          this.autoCloseTimer = setTimeout(() => {
            this.hide();
          }, delay);
        }

        // Resolve after animation
        setTimeout(resolve, this.animationDuration);
      });
    });
  }

  /**
   * Create backdrop element
   * @private
   */
  createBackdrop(options) {
    const backdrop = document.createElement('div');
    backdrop.className = this.backdropClassName;
    backdrop.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      opacity: 0;
      transition: opacity ${this.animationDuration}ms ease;
    `;

    // Add custom styles
    if (options.backdropStyle) {
      Object.assign(backdrop.style, options.backdropStyle);
    }

    // Handle backdrop click
    if (options.closeOnBackdrop !== false) {
      backdrop.addEventListener('click', () => {
        if (options.onBackdropClick) {
          options.onBackdropClick();
        }
        this.hide();
      });
    }

    // Add show class styles
    backdrop.classList.add('game-backdrop');
    setTimeout(() => backdrop.classList.add('show'), 10);

    return backdrop;
  }

  /**
   * Create popup element
   * @private
   */
  createPopup(options) {
    const popup = document.createElement('div');
    popup.className = `${this.className} ${options.className || ''}`;

    // Base styles
    popup.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.9);
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 90%;
      max-height: 90%;
      overflow: auto;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      opacity: 0;
      transition: all ${this.animationDuration}ms cubic-bezier(0.68, -0.55, 0.265, 1.55);
    `;

    // Apply custom styles
    if (options.style) {
      Object.assign(popup.style, options.style);
    }

    // Add content
    this.populateContent(popup, options);

    return popup;
  }

  /**
   * Populate popup content
   * @private
   */
  populateContent(popup, options) {
    // Title
    if (options.title) {
      const title = document.createElement('h2');
      title.className = 'popup-title';
      title.textContent = options.title;
      title.style.cssText = `
        margin: 0 0 16px 0;
        font-size: 24px;
        font-weight: bold;
        color: #333;
      `;
      popup.appendChild(title);
    }

    // Content
    if (options.content) {
      const content = document.createElement('div');
      content.className = 'popup-content';
      content.style.cssText = `
        margin-bottom: 20px;
        font-size: 16px;
        line-height: 1.5;
        color: #666;
      `;

      if (typeof options.content === 'string') {
        content.innerHTML = options.content;
      } else if (options.content instanceof HTMLElement) {
        content.appendChild(options.content);
      }

      popup.appendChild(content);
    }

    // Requirements list
    if (options.requirements && Array.isArray(options.requirements)) {
      const reqList = document.createElement('ul');
      reqList.className = 'popup-requirements';
      reqList.style.cssText = `
        margin: 16px 0;
        padding-left: 24px;
        color: #555;
      `;

      options.requirements.forEach(req => {
        const li = document.createElement('li');
        li.textContent = req;
        li.style.marginBottom = '8px';
        reqList.appendChild(li);
      });

      popup.appendChild(reqList);
    }

    // Buttons
    if (options.buttons && options.buttons.length > 0) {
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'popup-buttons';
      buttonContainer.style.cssText = `
        display: flex;
        gap: 12px;
        justify-content: center;
        margin-top: 20px;
      `;

      options.buttons.forEach((btnConfig, index) => {
        const button = this.createButton(btnConfig, index === 0);
        buttonContainer.appendChild(button);
      });

      popup.appendChild(buttonContainer);
    } else if (options.showCloseButton !== false) {
      // Default close button
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'popup-buttons';
      buttonContainer.style.cssText = `
        display: flex;
        justify-content: center;
        margin-top: 20px;
      `;

      const closeButton = this.createButton({
        text: 'Continuar',
        onClick: () => this.hide()
      }, true);

      buttonContainer.appendChild(closeButton);
      popup.appendChild(buttonContainer);
    }
  }

  /**
   * Create a button
   * @private
   */
  createButton(config, isPrimary = false) {
    const button = document.createElement('button');
    button.className = `popup-button ${isPrimary ? 'primary' : 'secondary'}`;
    button.style.cssText = `
      padding: 10px 24px;
      font-size: 16px;
      font-weight: 600;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      ${isPrimary ? `
        background: #4CAF50;
        color: white;
      ` : `
        background: #f0f0f0;
        color: #333;
      `}
    `;

    // Add icon if provided
    if (config.icon) {
      const icon = document.createElement('span');
      icon.innerHTML = config.icon;
      icon.style.marginRight = '8px';
      button.appendChild(icon);
    }

    // Add text
    const text = document.createElement('span');
    text.textContent = config.text || 'Button';
    button.appendChild(text);

    // Add click handler
    button.addEventListener('click', () => {
      if (config.onClick) {
        config.onClick();
      }
      if (config.closeOnClick !== false) {
        this.hide();
      }
    });

    // Hover effect
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.05)';
      if (isPrimary) {
        button.style.background = '#45a049';
      } else {
        button.style.background = '#e0e0e0';
      }
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      if (isPrimary) {
        button.style.background = '#4CAF50';
      } else {
        button.style.background = '#f0f0f0';
      }
    });

    return button;
  }

  /**
   * Hide the current popup
   * @returns {Promise} Resolves when popup is hidden
   */
  hide() {
    return new Promise(resolve => {
      if (!this.currentPopup) {
        resolve();
        return;
      }

      // Clear auto-close timer
      if (this.autoCloseTimer) {
        clearTimeout(this.autoCloseTimer);
        this.autoCloseTimer = null;
      }

      // Remove show classes
      if (this.currentBackdrop) {
        this.currentBackdrop.classList.remove('show');
        this.currentBackdrop.style.opacity = '0';
      }
      if (this.currentPopup) {
        this.currentPopup.classList.remove('show');
        this.currentPopup.style.opacity = '0';
        this.currentPopup.style.transform = 'translate(-50%, -50%) scale(0.9)';
      }

      // Remove elements after animation
      setTimeout(() => {
        if (this.currentBackdrop) {
          this.currentBackdrop.remove();
          this.currentBackdrop = null;
        }
        if (this.currentPopup) {
          this.currentPopup.remove();
          this.currentPopup = null;
        }

        // Disable pointer events
        this.container.style.pointerEvents = 'none';

        resolve();
      }, this.animationDuration);
    });
  }

  /**
   * Show a simple message popup
   * @param {string} message
   * @param {string} title
   * @returns {Promise}
   */
  showMessage(message, title = '') {
    return this.show({
      title,
      content: message,
      autoClose: true,
      autoCloseDelay: 3000
    });
  }

  /**
   * Show a confirmation dialog
   * @param {Object} options
   * @returns {Promise<boolean>} Resolves with user's choice
   */
  showConfirm(options) {
    return new Promise(resolve => {
      this.show({
        title: options.title || 'Confirmar',
        content: options.content || '¿Estás seguro?',
        buttons: [
          {
            text: options.confirmText || 'Sí',
            onClick: () => resolve(true),
            closeOnClick: true
          },
          {
            text: options.cancelText || 'No',
            onClick: () => resolve(false),
            closeOnClick: true
          }
        ],
        closeOnBackdrop: false
      });
    });
  }

  /**
   * Show level requirements popup
   * @param {Object} levelConfig
   * @returns {Promise}
   */
  showLevelRequirements(levelConfig) {
    return this.show({
      title: `Nivel ${levelConfig.number || ''}`,
      content: levelConfig.description || '',
      requirements: levelConfig.requirements || [],
      buttons: [{
        text: 'Empezar',
        icon: '▶️',
        closeOnClick: true
      }],
      className: 'level-requirements-popup'
    });
  }

  /**
   * Dispose of resources
   */
  dispose() {
    this.hide();
    if (this.container && this.container.parentNode) {
      this.container.remove();
    }
  }
}

/**
 * Create a singleton game popup instance
 */
let globalPopup = null;

export function getGamePopup(config) {
  if (!globalPopup) {
    globalPopup = new GamePopup(config);
  }
  return globalPopup;
}