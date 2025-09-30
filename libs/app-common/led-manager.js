/**
 * LED Manager for complex LED state management in rhythm apps
 * Handles auto/manual states and visual feedback
 */

export class LEDManager {
  constructor(element, param = '') {
    this.element = element;
    this.param = param;
    this.isAuto = false;
    this.isActive = false;
  }

  /**
   * Set LED to auto mode (calculated value)
   * @param {boolean} isAuto - Whether LED should be in auto mode
   */
  setAuto(isAuto) {
    this.isAuto = isAuto;

    if (isAuto) {
      this.element.dataset.auto = 'true';
      this.element.classList.add('led-auto');
    } else {
      delete this.element.dataset.auto;
      this.element.classList.remove('led-auto');
    }
  }

  /**
   * Set LED active state (visual feedback)
   * @param {boolean} isActive - Whether LED should appear active
   */
  setActive(isActive) {
    this.isActive = isActive;
    this.element.classList.toggle('led-active', isActive);
    this.element.classList.toggle('on', isActive);
  }

  /**
   * Get current auto state
   * @returns {boolean} Whether LED is in auto mode
   */
  getAuto() {
    return this.isAuto;
  }

  /**
   * Get current active state
   * @returns {boolean} Whether LED is active
   */
  getActive() {
    return this.isActive;
  }

  /**
   * Set LED state based on input element state
   * @param {HTMLElement} inputElement - Associated input element
   */
  syncWithInput(inputElement) {
    if (!inputElement) return;

    const hasAutoDataset = inputElement.hasAttribute('data-auto');
    this.setAuto(hasAutoDataset);
    this.setActive(!hasAutoDataset);
  }

  /**
   * Add click handler to toggle auto/manual state
   * @param {Function} onToggle - Callback when LED is clicked
   */
  addClickToggle(onToggle) {
    if (this.element && typeof onToggle === 'function') {
      this.element.addEventListener('click', () => {
        onToggle(this.param, !this.isAuto);
      });

      // Add visual feedback that LED is clickable
      this.element.style.cursor = 'pointer';
      this.element.title = `Click to toggle ${this.param} auto/manual`;
    }
  }
}

/**
 * Create LED managers for rhythm app parameters (Lg, V, T)
 * @param {Object} leds - LED elements from bindElements
 * @returns {Object} LED managers keyed by parameter
 */
export function createRhythmLEDManagers(leds) {
  const managers = {};

  const params = ['Lg', 'V', 'T'];
  params.forEach(param => {
    const ledKey = `led${param}`;
    if (leds[ledKey]) {
      managers[param] = new LEDManager(leds[ledKey], param);
    }
  });

  return managers;
}

/**
 * Sync all LED states with their corresponding input elements
 * @param {Object} managers - LED managers
 * @param {Object} elements - Input elements
 */
export function syncLEDsWithInputs(managers, elements) {
  Object.keys(managers).forEach(param => {
    const manager = managers[param];
    const input = elements[`input${param}`];
    if (manager && input) {
      manager.syncWithInput(input);
    }
  });
}