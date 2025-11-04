// libs/app-common/plane-cells.js
// Factory patterns for creating different types of cells in musical plane

/**
 * Creates a clickable cell factory for musical plane
 * Cells react to clicks with visual feedback
 *
 * @param {Object} config - Cell appearance and behavior configuration
 * @param {string} [config.className] - Base CSS class for cells
 * @param {string} [config.highlightClass] - Class to add when highlighted
 * @param {number} [config.highlightDuration] - Duration of highlight in ms
 * @param {Function} [config.createContent] - (vIndex, hIndex) => HTMLElement
 * @param {Object} [config.styles] - Additional inline styles to apply
 * @returns {Object} Cell factory compatible with musical-plane
 */
export function createClickableCellFactory(config = {}) {
  const {
    className = 'matrix-cell',
    highlightClass = 'highlight',
    highlightDuration = 500,
    createContent = null,
    styles = {}
  } = config;

  return {
    /**
     * Create a cell element
     */
    create(vIndex, hIndex, bounds) {
      const cell = document.createElement('div');
      cell.className = className;

      // Apply custom styles
      Object.assign(cell.style, styles);

      // Add optional custom content
      if (createContent) {
        try {
          const content = createContent(vIndex, hIndex, bounds);
          if (content instanceof HTMLElement) {
            cell.appendChild(content);
          } else if (typeof content === 'string') {
            cell.textContent = content;
          }
        } catch (error) {
          console.error(`Failed to create content for cell [${vIndex}, ${hIndex}]:`, error);
        }
      }

      return cell;
    },

    /**
     * Handle click on cell
     */
    onClick(vIndex, hIndex, cellElement, event) {
      // Add highlight class
      cellElement.classList.add(highlightClass);

      // Remove after duration
      if (highlightDuration > 0) {
        setTimeout(() => {
          cellElement.classList.remove(highlightClass);
        }, highlightDuration);
      }

      // Trigger custom event for external listeners
      const customEvent = new CustomEvent('cellClick', {
        detail: { vIndex, hIndex, cellElement },
        bubbles: true
      });
      cellElement.dispatchEvent(customEvent);
    }
  };
}

/**
 * Creates a toggle cell factory for musical plane
 * Cells maintain on/off state, useful for step sequencers
 *
 * @param {Object} config - Cell appearance and behavior configuration
 * @param {string} [config.className] - Base CSS class for cells
 * @param {string} [config.activeClass] - Class for active state
 * @param {boolean} [config.defaultState] - Initial state for cells
 * @param {Function} [config.onToggle] - Callback: (vIndex, hIndex, isActive) => void
 * @returns {Object} Cell factory compatible with musical-plane
 */
export function createToggleCellFactory(config = {}) {
  const {
    className = 'toggle-cell',
    activeClass = 'active',
    defaultState = false,
    onToggle = null
  } = config;

  // Track cell states
  const cellStates = new Map();

  return {
    /**
     * Create a toggle cell
     */
    create(vIndex, hIndex, bounds) {
      const cell = document.createElement('div');
      cell.className = className;

      // Initialize state
      const key = `${vIndex}-${hIndex}`;
      const isActive = cellStates.get(key) ?? defaultState;

      if (isActive) {
        cell.classList.add(activeClass);
      }

      cellStates.set(key, isActive);

      return cell;
    },

    /**
     * Handle click to toggle state
     */
    onClick(vIndex, hIndex, cellElement) {
      const key = `${vIndex}-${hIndex}`;
      const currentState = cellStates.get(key) ?? defaultState;
      const newState = !currentState;

      // Update visual state
      if (newState) {
        cellElement.classList.add(activeClass);
      } else {
        cellElement.classList.remove(activeClass);
      }

      // Update internal state
      cellStates.set(key, newState);

      // Trigger callback
      if (onToggle) {
        onToggle(vIndex, hIndex, newState, cellElement);
      }

      // Trigger custom event
      const customEvent = new CustomEvent('cellToggle', {
        detail: { vIndex, hIndex, isActive: newState },
        bubbles: true
      });
      cellElement.dispatchEvent(customEvent);
    },

    /**
     * Get current state of a cell
     */
    getState(vIndex, hIndex) {
      const key = `${vIndex}-${hIndex}`;
      return cellStates.get(key) ?? defaultState;
    },

    /**
     * Set state of a cell programmatically
     */
    setState(vIndex, hIndex, isActive) {
      const key = `${vIndex}-${hIndex}`;
      cellStates.set(key, isActive);
    },

    /**
     * Clear all states
     */
    clearStates() {
      cellStates.clear();
    },

    /**
     * Get all active cells
     */
    getActiveCells() {
      const active = [];
      cellStates.forEach((isActive, key) => {
        if (isActive) {
          const [vIndex, hIndex] = key.split('-').map(Number);
          active.push({ vIndex, hIndex });
        }
      });
      return active;
    }
  };
}

/**
 * Creates a velocity-sensitive cell factory
 * Cells respond to click force/speed with varying intensity
 *
 * @param {Object} config - Cell appearance and behavior configuration
 * @param {string} [config.className] - Base CSS class for cells
 * @param {number} [config.minVelocity] - Minimum velocity value (0-1)
 * @param {number} [config.maxVelocity] - Maximum velocity value (0-1)
 * @param {Function} [config.onVelocityClick] - Callback: (vIndex, hIndex, velocity) => void
 * @returns {Object} Cell factory compatible with musical-plane
 */
export function createVelocityCellFactory(config = {}) {
  const {
    className = 'velocity-cell',
    minVelocity = 0.1,
    maxVelocity = 1.0,
    onVelocityClick = null
  } = config;

  let lastClickTime = 0;
  let clickSpeed = 0;

  return {
    /**
     * Create a velocity-sensitive cell
     */
    create(vIndex, hIndex, bounds) {
      const cell = document.createElement('div');
      cell.className = className;

      // Add velocity indicator (visual feedback element)
      const indicator = document.createElement('div');
      indicator.className = 'velocity-indicator';
      cell.appendChild(indicator);

      return cell;
    },

    /**
     * Handle click with velocity calculation
     */
    onClick(vIndex, hIndex, cellElement, event) {
      // Calculate click speed (time between clicks)
      const currentTime = Date.now();
      const timeDelta = currentTime - lastClickTime;
      lastClickTime = currentTime;

      // Convert time delta to velocity (faster clicks = higher velocity)
      let velocity;
      if (timeDelta < 100) {
        velocity = maxVelocity;
      } else if (timeDelta > 1000) {
        velocity = minVelocity;
      } else {
        // Linear interpolation
        velocity = maxVelocity - ((timeDelta - 100) / 900) * (maxVelocity - minVelocity);
      }

      // Visual feedback based on velocity
      const indicator = cellElement.querySelector('.velocity-indicator');
      if (indicator) {
        indicator.style.transform = `scale(${0.5 + velocity * 0.5})`;
        indicator.style.opacity = velocity;

        // Reset after animation
        setTimeout(() => {
          indicator.style.transform = '';
          indicator.style.opacity = '';
        }, 300);
      }

      // Apply velocity-based styling
      cellElement.style.setProperty('--velocity', velocity);

      // Trigger callback
      if (onVelocityClick) {
        onVelocityClick(vIndex, hIndex, velocity, cellElement);
      }

      // Trigger custom event
      const customEvent = new CustomEvent('velocityClick', {
        detail: { vIndex, hIndex, velocity },
        bubbles: true
      });
      cellElement.dispatchEvent(customEvent);
    }
  };
}

/**
 * Creates a draggable selection cell factory
 * Allows drag-to-select multiple cells
 *
 * @param {Object} config - Cell appearance and behavior configuration
 * @param {string} [config.className] - Base CSS class for cells
 * @param {string} [config.selectedClass] - Class for selected state
 * @param {Function} [config.onSelectionChange] - Callback: (selectedCells) => void
 * @returns {Object} Cell factory compatible with musical-plane
 */
export function createDraggableCellFactory(config = {}) {
  const {
    className = 'draggable-cell',
    selectedClass = 'selected',
    onSelectionChange = null
  } = config;

  const selectedCells = new Set();
  let isDragging = false;
  let dragStartCell = null;

  return {
    /**
     * Create a draggable cell
     */
    create(vIndex, hIndex, bounds) {
      const cell = document.createElement('div');
      cell.className = className;

      // Prevent text selection during drag
      cell.style.userSelect = 'none';
      cell.style.webkitUserSelect = 'none';

      // Mouse event handlers for drag selection
      cell.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isDragging = true;
        dragStartCell = { vIndex, hIndex };

        // Toggle selection
        const key = `${vIndex}-${hIndex}`;
        if (selectedCells.has(key)) {
          selectedCells.delete(key);
          cell.classList.remove(selectedClass);
        } else {
          selectedCells.add(key);
          cell.classList.add(selectedClass);
        }

        // Trigger change event
        if (onSelectionChange) {
          onSelectionChange(Array.from(selectedCells).map(k => {
            const [v, h] = k.split('-').map(Number);
            return { vIndex: v, hIndex: h };
          }));
        }
      });

      cell.addEventListener('mouseenter', () => {
        if (isDragging) {
          const key = `${vIndex}-${hIndex}`;
          if (!selectedCells.has(key)) {
            selectedCells.add(key);
            cell.classList.add(selectedClass);

            // Trigger change event
            if (onSelectionChange) {
              onSelectionChange(Array.from(selectedCells).map(k => {
                const [v, h] = k.split('-').map(Number);
                return { vIndex: v, hIndex: h };
              }));
            }
          }
        }
      });

      // Global mouse up to stop dragging
      document.addEventListener('mouseup', () => {
        isDragging = false;
        dragStartCell = null;
      });

      return cell;
    },

    /**
     * Clear all selections
     */
    clearSelection() {
      selectedCells.clear();
      document.querySelectorAll(`.${selectedClass}`).forEach(cell => {
        cell.classList.remove(selectedClass);
      });

      if (onSelectionChange) {
        onSelectionChange([]);
      }
    },

    /**
     * Get selected cells
     */
    getSelection() {
      return Array.from(selectedCells).map(key => {
        const [vIndex, hIndex] = key.split('-').map(Number);
        return { vIndex, hIndex };
      });
    },

    /**
     * Set selection programmatically
     */
    setSelection(cells) {
      this.clearSelection();
      cells.forEach(({ vIndex, hIndex }) => {
        const key = `${vIndex}-${hIndex}`;
        selectedCells.add(key);
      });
    }
  };
}

/**
 * Creates a composite factory that combines multiple behaviors
 *
 * @param {Array} factories - Array of cell factories to combine
 * @returns {Object} Combined cell factory
 */
export function createCompositeCellFactory(factories) {
  return {
    create(vIndex, hIndex, bounds) {
      // Create base cell
      let cell = document.createElement('div');
      cell.className = 'composite-cell';

      // Apply each factory's create method
      factories.forEach(factory => {
        if (factory.create) {
          const factoryCell = factory.create(vIndex, hIndex, bounds);
          if (factoryCell) {
            // Merge classes
            factoryCell.classList.forEach(cls => cell.classList.add(cls));
            // Merge children
            while (factoryCell.firstChild) {
              cell.appendChild(factoryCell.firstChild);
            }
            // Merge styles
            Array.from(factoryCell.style).forEach(prop => {
              if (!cell.style[prop]) {
                cell.style[prop] = factoryCell.style[prop];
              }
            });
          }
        }
      });

      return cell;
    },

    onClick(vIndex, hIndex, cellElement, event) {
      // Apply all onClick handlers
      factories.forEach(factory => {
        if (factory.onClick) {
          factory.onClick(vIndex, hIndex, cellElement, event);
        }
      });
    }
  };
}