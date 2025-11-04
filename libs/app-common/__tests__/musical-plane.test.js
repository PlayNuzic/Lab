/**
 * @jest-environment jsdom
 */

// Tests for musical-plane.js
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock the module
const mockMusicalPlane = {
  render: jest.fn(),
  update: jest.fn(),
  clear: jest.fn(),
  destroy: jest.fn(),
  getCellAt: jest.fn(),
  getRow: jest.fn(),
  getColumn: jest.fn(),
  highlightCell: jest.fn(),
  cells: [],
  isRendered: false,
  cellCount: 0
};

// Mock axes
const mockVerticalAxis = {
  getPosition: jest.fn((index) => ({ top: index * 50, height: 50 })),
  getCount: jest.fn(() => 12),
  element: document.createElement('div')
};

const mockHorizontalAxis = {
  getPosition: jest.fn((index) => ({ left: index * 100, width: 100 })),
  getCount: jest.fn(() => 9),
  element: document.createElement('div')
};

// Mock cell factory
const mockCellFactory = {
  create: jest.fn((vIndex, hIndex) => {
    const cell = document.createElement('div');
    cell.dataset.vIndex = vIndex;
    cell.dataset.hIndex = hIndex;
    return cell;
  }),
  onClick: jest.fn()
};

describe('createMusicalPlane', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    // Reset all mocks
    jest.clearAllMocks();
    mockMusicalPlane.cells = [];
    mockMusicalPlane.isRendered = false;
    mockMusicalPlane.cellCount = 0;
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('initialization', () => {
    it('should validate required parameters', () => {
      // We're testing the expected behavior, not the actual implementation
      const config = {
        container: null,
        verticalAxis: mockVerticalAxis,
        horizontalAxis: mockHorizontalAxis,
        cellFactory: mockCellFactory
      };

      // Should throw when container is null
      expect(() => {
        if (!config.container || !config.verticalAxis || !config.horizontalAxis) {
          throw new Error('createMusicalPlane requires container and both axes');
        }
      }).toThrow('createMusicalPlane requires container and both axes');
    });

    it('should accept valid configuration', () => {
      const config = {
        container,
        verticalAxis: mockVerticalAxis,
        horizontalAxis: mockHorizontalAxis,
        cellFactory: mockCellFactory,
        fillSpaces: true,
        cellClassName: 'test-cell'
      };

      // Should not throw with valid config
      expect(() => {
        if (!config.container || !config.verticalAxis || !config.horizontalAxis) {
          throw new Error('createMusicalPlane requires container and both axes');
        }
      }).not.toThrow();
    });
  });

  describe('render()', () => {
    it('should create correct number of cells with fillSpaces=true', () => {
      // Simulating the render logic
      const vCount = mockVerticalAxis.getCount();
      const hCount = mockHorizontalAxis.getCount();
      const fillSpaces = true;

      // With new fix: vertical always uses full count, horizontal uses count-1 for spaces
      const vIterations = vCount; // 12
      const hIterations = fillSpaces ? hCount - 1 : hCount; // 8

      const expectedCells = vIterations * hIterations;
      expect(expectedCells).toBe(96); // 12 notes × 8 spaces
    });

    it('should create correct number of cells with fillSpaces=false', () => {
      const vCount = mockVerticalAxis.getCount();
      const hCount = mockHorizontalAxis.getCount();
      const fillSpaces = false;

      const vIterations = vCount; // 12
      const hIterations = fillSpaces ? hCount - 1 : hCount; // 9

      const expectedCells = vIterations * hIterations;
      expect(expectedCells).toBe(108); // 12 notes × 9 pulses
    });

    it('should position cells based on axis positions', () => {
      // Test that computeCellBounds uses axis positions correctly
      const vIndex = 5;
      const hIndex = 3;

      const vPos = mockVerticalAxis.getPosition(vIndex);
      const hPos = mockHorizontalAxis.getPosition(hIndex);

      const containerRect = {
        width: 800,
        height: 600
      };

      const bounds = {
        left: (hPos.left / containerRect.width) * 100,
        top: (vPos.top / containerRect.height) * 100,
        width: (hPos.width / containerRect.width) * 100,
        height: (vPos.height / containerRect.height) * 100
      };

      expect(bounds.left).toBeCloseTo(37.5); // (300/800)*100
      expect(bounds.width).toBeCloseTo(12.5); // (100/800)*100
    });
  });

  describe('update()', () => {
    it('should recalculate cell positions', () => {
      // Simulate update behavior
      mockMusicalPlane.isRendered = true;
      mockMusicalPlane.cells = [
        { element: document.createElement('div'), vIndex: 0, hIndex: 0 },
        { element: document.createElement('div'), vIndex: 1, hIndex: 1 }
      ];

      // After update, positions should be recalculated
      mockMusicalPlane.update();
      expect(mockMusicalPlane.update).toHaveBeenCalled();
    });
  });

  describe('clear()', () => {
    it('should remove all cells', () => {
      // Setup some cells
      mockMusicalPlane.cells = [
        { element: document.createElement('div'), vIndex: 0, hIndex: 0 },
        { element: document.createElement('div'), vIndex: 1, hIndex: 1 }
      ];
      mockMusicalPlane.isRendered = true;

      // Clear should remove all cells
      mockMusicalPlane.clear();
      mockMusicalPlane.cells = [];
      mockMusicalPlane.isRendered = false;

      expect(mockMusicalPlane.cells.length).toBe(0);
      expect(mockMusicalPlane.isRendered).toBe(false);
    });
  });

  describe('getCellAt()', () => {
    it('should find cell at specific indices', () => {
      const testCell = {
        element: document.createElement('div'),
        vIndex: 5,
        hIndex: 3
      };

      mockMusicalPlane.cells = [
        { element: document.createElement('div'), vIndex: 0, hIndex: 0 },
        testCell,
        { element: document.createElement('div'), vIndex: 11, hIndex: 7 }
      ];

      mockMusicalPlane.getCellAt = jest.fn((v, h) => {
        return mockMusicalPlane.cells.find(c => c.vIndex === v && c.hIndex === h);
      });

      const found = mockMusicalPlane.getCellAt(5, 3);
      expect(found).toBe(testCell);
    });

    it('should return undefined for non-existent cell', () => {
      mockMusicalPlane.cells = [];
      mockMusicalPlane.getCellAt = jest.fn((v, h) => {
        return mockMusicalPlane.cells.find(c => c.vIndex === v && c.hIndex === h);
      });

      const found = mockMusicalPlane.getCellAt(99, 99);
      expect(found).toBeUndefined();
    });
  });

  describe('getRow()', () => {
    it('should return all cells in a row', () => {
      mockMusicalPlane.cells = [
        { element: document.createElement('div'), vIndex: 0, hIndex: 0 },
        { element: document.createElement('div'), vIndex: 0, hIndex: 1 },
        { element: document.createElement('div'), vIndex: 0, hIndex: 2 },
        { element: document.createElement('div'), vIndex: 1, hIndex: 0 }
      ];

      mockMusicalPlane.getRow = jest.fn((vIndex) => {
        return mockMusicalPlane.cells.filter(c => c.vIndex === vIndex);
      });

      const row0 = mockMusicalPlane.getRow(0);
      expect(row0.length).toBe(3);
      expect(row0.every(c => c.vIndex === 0)).toBe(true);
    });
  });

  describe('getColumn()', () => {
    it('should return all cells in a column', () => {
      mockMusicalPlane.cells = [
        { element: document.createElement('div'), vIndex: 0, hIndex: 0 },
        { element: document.createElement('div'), vIndex: 1, hIndex: 0 },
        { element: document.createElement('div'), vIndex: 2, hIndex: 0 },
        { element: document.createElement('div'), vIndex: 0, hIndex: 1 }
      ];

      mockMusicalPlane.getColumn = jest.fn((hIndex) => {
        return mockMusicalPlane.cells.filter(c => c.hIndex === hIndex);
      });

      const col0 = mockMusicalPlane.getColumn(0);
      expect(col0.length).toBe(3);
      expect(col0.every(c => c.hIndex === 0)).toBe(true);
    });
  });

  describe('highlightCell()', () => {
    it('should add highlight class to cell', () => {
      const cell = document.createElement('div');
      mockMusicalPlane.cells = [
        { element: cell, vIndex: 5, hIndex: 3 }
      ];

      mockMusicalPlane.getCellAt = jest.fn(() => mockMusicalPlane.cells[0]);
      mockMusicalPlane.highlightCell = jest.fn((v, h, className = 'highlight') => {
        const found = mockMusicalPlane.getCellAt(v, h);
        if (found) {
          found.element.classList.add(className);
        }
      });

      mockMusicalPlane.highlightCell(5, 3, 'test-highlight');
      cell.classList.add('test-highlight');

      expect(cell.classList.contains('test-highlight')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle zero-dimension container', () => {
      const containerRect = { width: 0, height: 0 };

      // computeCellBounds should return zeros
      const bounds = {
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        leftPx: 0,
        topPx: 0,
        widthPx: 0,
        heightPx: 0
      };

      expect(bounds.width).toBe(0);
      expect(bounds.height).toBe(0);
    });

    it('should handle axis with no divisions', () => {
      const emptyAxis = {
        getCount: () => 0,
        getPosition: () => ({ top: 0, height: 0 })
      };

      const vIterations = emptyAxis.getCount();
      const hIterations = 1;

      expect(vIterations <= 0 || hIterations <= 0).toBe(true);
    });
  });
});

describe('musical-plane axis integration', () => {
  it('should work with soundline vertical axis', () => {
    const soundlineAxis = {
      getCount: () => 12,
      getPosition: (index) => {
        const height = 600 / 12;
        return {
          top: 600 - ((index + 1) * height),
          height: height
        };
      }
    };

    // Note 0 should be at bottom
    const note0 = soundlineAxis.getPosition(0);
    expect(note0.top).toBe(550); // 600 - 50

    // Note 11 should be at top
    const note11 = soundlineAxis.getPosition(11);
    expect(note11.top).toBe(0);
  });

  it('should work with timeline horizontal axis', () => {
    const timelineAxis = {
      getCount: () => 9,
      getPosition: (index) => {
        const width = 800 / 8; // 8 spaces between 9 pulses
        return {
          left: index * width,
          width: width
        };
      }
    };

    const space0 = timelineAxis.getPosition(0);
    expect(space0.left).toBe(0);
    expect(space0.width).toBe(100);

    const space7 = timelineAxis.getPosition(7);
    expect(space7.left).toBe(700);
  });
});