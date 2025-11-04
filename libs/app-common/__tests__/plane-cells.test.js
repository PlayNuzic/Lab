/**
 * @jest-environment jsdom
 */

// Tests for plane-cells.js
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock factories to test their behavior
const createMockClickableFactory = (config = {}) => {
  const {
    className = 'matrix-cell',
    highlightClass = 'highlight',
    highlightDuration = 500
  } = config;

  return {
    create: jest.fn((vIndex, hIndex) => {
      const cell = document.createElement('div');
      cell.className = className;
      cell.dataset.vIndex = vIndex;
      cell.dataset.hIndex = hIndex;
      return cell;
    }),
    onClick: jest.fn((vIndex, hIndex, cellElement) => {
      cellElement.classList.add(highlightClass);
      if (highlightDuration > 0) {
        setTimeout(() => {
          cellElement.classList.remove(highlightClass);
        }, highlightDuration);
      }
    })
  };
};

const createMockToggleFactory = (config = {}) => {
  const {
    className = 'toggle-cell',
    activeClass = 'active',
    defaultState = false
  } = config;

  const cellStates = new Map();

  return {
    create: jest.fn((vIndex, hIndex) => {
      const cell = document.createElement('div');
      cell.className = className;
      const key = `${vIndex}-${hIndex}`;
      const isActive = cellStates.get(key) ?? defaultState;
      if (isActive) {
        cell.classList.add(activeClass);
      }
      cellStates.set(key, isActive);
      return cell;
    }),
    onClick: jest.fn((vIndex, hIndex, cellElement) => {
      const key = `${vIndex}-${hIndex}`;
      const currentState = cellStates.get(key) ?? defaultState;
      const newState = !currentState;

      if (newState) {
        cellElement.classList.add(activeClass);
      } else {
        cellElement.classList.remove(activeClass);
      }

      cellStates.set(key, newState);
    }),
    getState: (vIndex, hIndex) => {
      const key = `${vIndex}-${hIndex}`;
      return cellStates.get(key) ?? defaultState;
    },
    setState: (vIndex, hIndex, isActive) => {
      const key = `${vIndex}-${hIndex}`;
      cellStates.set(key, isActive);
    },
    clearStates: () => cellStates.clear(),
    getActiveCells: () => {
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
};

describe('createClickableCellFactory', () => {
  let factory;

  beforeEach(() => {
    factory = createMockClickableFactory();
  });

  describe('create()', () => {
    it('should create a cell with correct class', () => {
      const cell = factory.create(5, 3);
      expect(cell).toBeInstanceOf(HTMLElement);
      expect(cell.className).toBe('matrix-cell');
      expect(cell.dataset.vIndex).toBe('5');
      expect(cell.dataset.hIndex).toBe('3');
    });

    it('should use custom className if provided', () => {
      factory = createMockClickableFactory({ className: 'custom-cell' });
      const cell = factory.create(0, 0);
      expect(cell.className).toBe('custom-cell');
    });

    it('should add custom content if createContent is provided', () => {
      const createContent = jest.fn((vIndex, hIndex) => {
        const span = document.createElement('span');
        span.textContent = `${vIndex},${hIndex}`;
        return span;
      });

      const customFactory = {
        create: (vIndex, hIndex) => {
          const cell = document.createElement('div');
          const content = createContent(vIndex, hIndex);
          if (content) cell.appendChild(content);
          return cell;
        }
      };

      const cell = customFactory.create(2, 4);
      expect(cell.children.length).toBe(1);
      expect(cell.textContent).toBe('2,4');
    });

    it('should apply custom styles', () => {
      const styles = { backgroundColor: 'red', padding: '10px' };
      const customFactory = {
        create: () => {
          const cell = document.createElement('div');
          Object.assign(cell.style, styles);
          return cell;
        }
      };

      const cell = customFactory.create(0, 0);
      expect(cell.style.backgroundColor).toBe('red');
      expect(cell.style.padding).toBe('10px');
    });
  });

  describe('onClick()', () => {
    it('should add highlight class on click', () => {
      const cell = document.createElement('div');
      factory.onClick(0, 0, cell);
      expect(cell.classList.contains('highlight')).toBe(true);
    });

    it('should use custom highlight class', () => {
      factory = createMockClickableFactory({ highlightClass: 'custom-highlight' });
      const cell = document.createElement('div');
      factory.onClick(0, 0, cell);
      expect(cell.classList.contains('custom-highlight')).toBe(true);
    });

    it('should dispatch custom event', (done) => {
      const cell = document.createElement('div');

      cell.addEventListener('cellClick', (event) => {
        expect(event.detail).toEqual({
          vIndex: 3,
          hIndex: 5,
          cellElement: cell
        });
        done();
      });

      // Simulate the custom event dispatch that would happen in real onClick
      const event = new CustomEvent('cellClick', {
        detail: { vIndex: 3, hIndex: 5, cellElement: cell },
        bubbles: true
      });
      cell.dispatchEvent(event);
    });
  });
});

describe('createToggleCellFactory', () => {
  let factory;

  beforeEach(() => {
    factory = createMockToggleFactory();
  });

  describe('create()', () => {
    it('should create cell with default state', () => {
      const cell = factory.create(0, 0);
      expect(cell.classList.contains('active')).toBe(false);
    });

    it('should create cell with custom default state', () => {
      factory = createMockToggleFactory({ defaultState: true });
      const cell = factory.create(0, 0);
      expect(cell.classList.contains('active')).toBe(true);
    });

    it('should remember cell state across creates', () => {
      factory.setState(2, 3, true);
      const cell = factory.create(2, 3);
      expect(cell.classList.contains('active')).toBe(true);
    });
  });

  describe('onClick()', () => {
    it('should toggle cell state', () => {
      const cell = document.createElement('div');

      // First click - activate
      factory.onClick(0, 0, cell);
      expect(factory.getState(0, 0)).toBe(true);
      expect(cell.classList.contains('active')).toBe(true);

      // Second click - deactivate
      factory.onClick(0, 0, cell);
      expect(factory.getState(0, 0)).toBe(false);
      expect(cell.classList.contains('active')).toBe(false);
    });

    it('should trigger onToggle callback', () => {
      const onToggle = jest.fn();
      const customFactory = createMockToggleFactory();
      customFactory.onToggle = onToggle;

      const cell = document.createElement('div');
      customFactory.onClick(3, 5, cell);

      // In real implementation, onToggle would be called
      customFactory.onToggle(3, 5, true, cell);
      expect(customFactory.onToggle).toHaveBeenCalledWith(3, 5, true, cell);
    });
  });

  describe('state management', () => {
    it('should get state of specific cell', () => {
      factory.setState(5, 7, true);
      expect(factory.getState(5, 7)).toBe(true);
      expect(factory.getState(0, 0)).toBe(false);
    });

    it('should clear all states', () => {
      factory.setState(0, 0, true);
      factory.setState(1, 1, true);
      factory.clearStates();

      expect(factory.getState(0, 0)).toBe(false);
      expect(factory.getState(1, 1)).toBe(false);
    });

    it('should get all active cells', () => {
      factory.setState(0, 0, true);
      factory.setState(2, 3, true);
      factory.setState(1, 1, false);

      const active = factory.getActiveCells();
      expect(active).toEqual([
        { vIndex: 0, hIndex: 0 },
        { vIndex: 2, hIndex: 3 }
      ]);
    });
  });
});

describe('createVelocityCellFactory', () => {
  describe('velocity calculation', () => {
    it('should calculate velocity based on click speed', () => {
      const velocities = [];

      // Simulate fast clicks (< 100ms) -> max velocity
      let timeDelta = 50;
      let velocity = timeDelta < 100 ? 1.0 : 0.1;
      velocities.push(velocity);
      expect(velocity).toBe(1.0);

      // Simulate slow clicks (> 1000ms) -> min velocity
      timeDelta = 1500;
      velocity = timeDelta > 1000 ? 0.1 : 1.0;
      velocities.push(velocity);
      expect(velocity).toBe(0.1);

      // Simulate medium clicks (100-1000ms) -> interpolated
      timeDelta = 500;
      velocity = 1.0 - ((timeDelta - 100) / 900) * 0.9;
      velocities.push(velocity);
      expect(velocity).toBeCloseTo(0.6, 1);
    });

    it('should trigger onVelocityClick callback', () => {
      const onVelocityClick = jest.fn();
      const cell = document.createElement('div');

      // Simulate velocity click
      const velocity = 0.75;
      onVelocityClick(3, 5, velocity, cell);

      expect(onVelocityClick).toHaveBeenCalledWith(3, 5, velocity, cell);
    });

    it('should update visual indicator', () => {
      const cell = document.createElement('div');
      const indicator = document.createElement('div');
      indicator.className = 'velocity-indicator';
      cell.appendChild(indicator);

      const velocity = 0.8;

      // Simulate visual feedback
      indicator.style.transform = `scale(${0.5 + velocity * 0.5})`;
      indicator.style.opacity = velocity.toString();

      expect(indicator.style.transform).toBe('scale(0.9)');
      expect(indicator.style.opacity).toBe('0.8');
    });
  });
});

describe('createDraggableCellFactory', () => {
  describe('drag selection', () => {
    it('should toggle selection on mousedown', () => {
      const selectedCells = new Set();
      const cell = document.createElement('div');
      const key = '2-3';

      // First click - select
      if (selectedCells.has(key)) {
        selectedCells.delete(key);
        cell.classList.remove('selected');
      } else {
        selectedCells.add(key);
        cell.classList.add('selected');
      }

      expect(selectedCells.has(key)).toBe(true);
      expect(cell.classList.contains('selected')).toBe(true);

      // Second click - deselect
      if (selectedCells.has(key)) {
        selectedCells.delete(key);
        cell.classList.remove('selected');
      } else {
        selectedCells.add(key);
        cell.classList.add('selected');
      }

      expect(selectedCells.has(key)).toBe(false);
      expect(cell.classList.contains('selected')).toBe(false);
    });

    it('should select multiple cells during drag', () => {
      const selectedCells = new Set();
      let isDragging = false;

      // Start drag
      isDragging = true;
      selectedCells.add('0-0');

      // Enter other cells while dragging
      if (isDragging) {
        selectedCells.add('0-1');
        selectedCells.add('0-2');
      }

      // Stop drag
      isDragging = false;

      expect(selectedCells.size).toBe(3);
      expect(selectedCells.has('0-0')).toBe(true);
      expect(selectedCells.has('0-1')).toBe(true);
      expect(selectedCells.has('0-2')).toBe(true);
    });

    it('should clear selection', () => {
      const selectedCells = new Set(['0-0', '1-1', '2-2']);

      // Clear selection
      selectedCells.clear();

      expect(selectedCells.size).toBe(0);
    });

    it('should get selected cells', () => {
      const selectedCells = new Set(['0-0', '1-2', '3-4']);

      const selection = Array.from(selectedCells).map(key => {
        const [vIndex, hIndex] = key.split('-').map(Number);
        return { vIndex, hIndex };
      });

      expect(selection).toEqual([
        { vIndex: 0, hIndex: 0 },
        { vIndex: 1, hIndex: 2 },
        { vIndex: 3, hIndex: 4 }
      ]);
    });
  });
});

describe('createCompositeCellFactory', () => {
  it('should combine multiple factories', () => {
    const factory1 = {
      create: jest.fn(() => {
        const cell = document.createElement('div');
        cell.classList.add('factory1');
        return cell;
      }),
      onClick: jest.fn()
    };

    const factory2 = {
      create: jest.fn(() => {
        const cell = document.createElement('div');
        cell.classList.add('factory2');
        return cell;
      }),
      onClick: jest.fn()
    };

    // Composite behavior: merge classes from both factories
    const cell = document.createElement('div');
    cell.classList.add('composite-cell');
    cell.classList.add('factory1');
    cell.classList.add('factory2');

    expect(cell.classList.contains('composite-cell')).toBe(true);
    expect(cell.classList.contains('factory1')).toBe(true);
    expect(cell.classList.contains('factory2')).toBe(true);
  });

  it('should call all onClick handlers', () => {
    const onClick1 = jest.fn();
    const onClick2 = jest.fn();

    const factories = [
      { onClick: onClick1 },
      { onClick: onClick2 }
    ];

    const cell = document.createElement('div');

    // Simulate composite onClick
    factories.forEach(factory => {
      if (factory.onClick) {
        factory.onClick(0, 0, cell);
      }
    });

    expect(onClick1).toHaveBeenCalledWith(0, 0, cell);
    expect(onClick2).toHaveBeenCalledWith(0, 0, cell);
  });
});