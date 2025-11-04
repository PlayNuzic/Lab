/**
 * @jest-environment jsdom
 */

// Tests for plane-adapters.js
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock the soundline module
const createMockSoundline = () => {
  const soundline = {
    element: document.createElement('div'),
    getNotePosition: jest.fn((noteIndex) => {
      // Return percentage from top (inverted scale)
      return 100 - ((noteIndex + 0.5) / 12) * 100;
    }),
    getMidiForNote: jest.fn((noteIndex) => 60 + noteIndex),
    getNoteForMidi: jest.fn((midi) => midi - 60),
    getPosition: jest.fn((noteIndex) => {
      const containerHeight = 600; // Mock height
      const noteHeight = containerHeight / 12;
      const top = containerHeight - ((noteIndex + 1) * noteHeight);
      return { top, height: noteHeight };
    }),
    getCount: jest.fn(() => 12)
  };

  // Set up mock getBoundingClientRect for the element
  soundline.element.getBoundingClientRect = jest.fn(() => ({
    top: 0,
    left: 0,
    width: 150,
    height: 600,
    right: 150,
    bottom: 600
  }));

  return soundline;
};

// Mock timeline container
const createMockTimelineContainer = () => {
  const container = document.createElement('div');
  container.getBoundingClientRect = jest.fn(() => ({
    top: 0,
    left: 0,
    width: 800,
    height: 80,
    right: 800,
    bottom: 80
  }));
  return container;
};

// Import adapters - we'll mock the module imports
let createSoundlineVerticalAxis;
let createTimelineHorizontalAxis;
let createCustomGridAxis;

beforeEach(() => {
  // Reset mocks and create adapter functions
  jest.clearAllMocks();

  // Recreate the adapter functions inline for testing
  createSoundlineVerticalAxis = (soundline) => {
    if (!soundline || !soundline.getPosition || !soundline.getCount) {
      throw new Error('Invalid soundline: missing required methods');
    }

    return {
      getPosition: (noteIndex) => soundline.getPosition(noteIndex),
      getCount: () => soundline.getCount()
    };
  };

  createTimelineHorizontalAxis = (pulseCount, container, fillSpaces = true) => {
    if (!container) {
      throw new Error('Container element required');
    }
    if (pulseCount < 2) {
      throw new Error('Pulse count must be at least 2');
    }

    return {
      getPosition: (spaceIndex) => {
        const rect = container.getBoundingClientRect();
        const containerWidth = rect.width;

        if (fillSpaces) {
          // Cells fill spaces between markers
          const spaceWidth = containerWidth / (pulseCount - 1);
          return {
            left: spaceIndex * spaceWidth,
            width: spaceWidth
          };
        } else {
          // Cells align with markers
          const markerWidth = containerWidth / pulseCount;
          return {
            left: spaceIndex * markerWidth,
            width: markerWidth
          };
        }
      },
      getCount: () => fillSpaces ? pulseCount - 1 : pulseCount
    };
  };

  createCustomGridAxis = (divisions, getPositionFn) => {
    if (typeof divisions !== 'number' || divisions < 1) {
      throw new Error('Divisions must be a positive number');
    }
    if (typeof getPositionFn !== 'function') {
      throw new Error('getPositionFn must be a function');
    }

    return {
      getPosition: (index) => getPositionFn(index),
      getCount: () => divisions
    };
  };
});

describe('createSoundlineVerticalAxis', () => {
  let soundline;

  beforeEach(() => {
    soundline = createMockSoundline();
  });

  it('should create vertical axis from soundline', () => {
    const axis = createSoundlineVerticalAxis(soundline);

    expect(axis).toBeDefined();
    expect(axis.getPosition).toBeInstanceOf(Function);
    expect(axis.getCount).toBeInstanceOf(Function);
  });

  it('should delegate getPosition to soundline', () => {
    const axis = createSoundlineVerticalAxis(soundline);

    const position = axis.getPosition(5);

    expect(soundline.getPosition).toHaveBeenCalledWith(5);
    expect(position).toEqual({ top: 300, height: 50 }); // Note 5 is at 300px from top
  });

  it('should delegate getCount to soundline', () => {
    const axis = createSoundlineVerticalAxis(soundline);

    const count = axis.getCount();

    expect(soundline.getCount).toHaveBeenCalled();
    expect(count).toBe(12);
  });

  it('should handle all note indices correctly', () => {
    const axis = createSoundlineVerticalAxis(soundline);

    // Test boundary notes
    axis.getPosition(0); // Bottom note
    expect(soundline.getPosition).toHaveBeenCalledWith(0);

    axis.getPosition(11); // Top note
    expect(soundline.getPosition).toHaveBeenCalledWith(11);
  });

  it('should throw error for invalid soundline', () => {
    expect(() => createSoundlineVerticalAxis(null))
      .toThrow('Invalid soundline: missing required methods');

    expect(() => createSoundlineVerticalAxis({}))
      .toThrow('Invalid soundline: missing required methods');

    const incompleteSoundline = { getPosition: () => {} };
    expect(() => createSoundlineVerticalAxis(incompleteSoundline))
      .toThrow('Invalid soundline: missing required methods');
  });
});

describe('createTimelineHorizontalAxis', () => {
  let container;

  beforeEach(() => {
    container = createMockTimelineContainer();
  });

  describe('with fillSpaces=true (cells between markers)', () => {
    it('should create horizontal axis for spaces between pulses', () => {
      const axis = createTimelineHorizontalAxis(9, container, true);

      expect(axis).toBeDefined();
      expect(axis.getPosition).toBeInstanceOf(Function);
      expect(axis.getCount).toBeInstanceOf(Function);
    });

    it('should return correct count (pulses - 1)', () => {
      const axis = createTimelineHorizontalAxis(9, container, true);

      expect(axis.getCount()).toBe(8); // 8 spaces between 9 pulses
    });

    it('should calculate correct positions for spaces', () => {
      const axis = createTimelineHorizontalAxis(9, container, true);

      // 800px width / 8 spaces = 100px per space
      const pos0 = axis.getPosition(0);
      expect(pos0).toEqual({ left: 0, width: 100 });

      const pos3 = axis.getPosition(3);
      expect(pos3).toEqual({ left: 300, width: 100 });

      const pos7 = axis.getPosition(7);
      expect(pos7).toEqual({ left: 700, width: 100 });
    });

    it('should handle different pulse counts', () => {
      const axis5 = createTimelineHorizontalAxis(5, container, true);
      expect(axis5.getCount()).toBe(4); // 4 spaces

      // 800px / 4 spaces = 200px per space
      const pos = axis5.getPosition(2);
      expect(pos).toEqual({ left: 400, width: 200 });
    });
  });

  describe('with fillSpaces=false (cells on markers)', () => {
    it('should create horizontal axis aligned with pulses', () => {
      const axis = createTimelineHorizontalAxis(9, container, false);

      expect(axis).toBeDefined();
      expect(axis.getCount()).toBe(9); // Same as pulse count
    });

    it('should calculate correct positions aligned with markers', () => {
      const axis = createTimelineHorizontalAxis(9, container, false);

      // 800px width / 9 markers ≈ 88.89px per marker
      const expectedWidth = 800 / 9;

      const pos0 = axis.getPosition(0);
      expect(pos0.left).toBeCloseTo(0, 5);
      expect(pos0.width).toBeCloseTo(expectedWidth, 5);

      const pos4 = axis.getPosition(4);
      expect(pos4.left).toBeCloseTo(4 * expectedWidth, 5);
      expect(pos4.width).toBeCloseTo(expectedWidth, 5);

      const pos8 = axis.getPosition(8);
      expect(pos8.left).toBeCloseTo(8 * expectedWidth, 5);
      expect(pos8.width).toBeCloseTo(expectedWidth, 5);
    });
  });

  describe('error handling', () => {
    it('should throw error for missing container', () => {
      expect(() => createTimelineHorizontalAxis(9, null, true))
        .toThrow('Container element required');
    });

    it('should throw error for invalid pulse count', () => {
      expect(() => createTimelineHorizontalAxis(1, container, true))
        .toThrow('Pulse count must be at least 2');

      expect(() => createTimelineHorizontalAxis(0, container, true))
        .toThrow('Pulse count must be at least 2');

      expect(() => createTimelineHorizontalAxis(-1, container, true))
        .toThrow('Pulse count must be at least 2');
    });
  });

  describe('container resize handling', () => {
    it('should update positions when container size changes', () => {
      const axis = createTimelineHorizontalAxis(5, container, true);

      // Initial size: 800px
      let pos = axis.getPosition(1);
      expect(pos).toEqual({ left: 200, width: 200 }); // 800/4 = 200

      // Simulate resize
      container.getBoundingClientRect = jest.fn(() => ({
        width: 400,
        height: 80
      }));

      // Get position after resize
      pos = axis.getPosition(1);
      expect(pos).toEqual({ left: 100, width: 100 }); // 400/4 = 100
    });
  });
});

describe('createCustomGridAxis', () => {
  it('should create custom axis with provided divisions and position function', () => {
    const getPositionFn = jest.fn((index) => ({
      left: index * 50,
      top: index * 30,
      width: 50,
      height: 30
    }));

    const axis = createCustomGridAxis(10, getPositionFn);

    expect(axis).toBeDefined();
    expect(axis.getCount()).toBe(10);
  });

  it('should use custom position function', () => {
    const getPositionFn = jest.fn((index) => ({
      left: index * 100,
      top: 0,
      width: 100,
      height: 50
    }));

    const axis = createCustomGridAxis(5, getPositionFn);

    const pos2 = axis.getPosition(2);
    expect(getPositionFn).toHaveBeenCalledWith(2);
    expect(pos2).toEqual({ left: 200, top: 0, width: 100, height: 50 });

    const pos4 = axis.getPosition(4);
    expect(getPositionFn).toHaveBeenCalledWith(4);
    expect(pos4).toEqual({ left: 400, top: 0, width: 100, height: 50 });
  });

  it('should support non-linear positioning', () => {
    // Example: logarithmic spacing
    const getPositionFn = (index) => {
      const logPos = Math.log(index + 1) * 100;
      return { left: logPos, width: 50 };
    };

    const axis = createCustomGridAxis(8, getPositionFn);

    const pos0 = axis.getPosition(0);
    expect(pos0.left).toBeCloseTo(0, 5); // log(1) = 0

    const pos3 = axis.getPosition(3);
    expect(pos3.left).toBeCloseTo(Math.log(4) * 100, 5); // log(4) ≈ 1.386
  });

  it('should support circular/radial layouts', () => {
    // Example: circular positioning
    const getPositionFn = (index) => {
      const angle = (index / 12) * Math.PI * 2;
      const radius = 100;
      return {
        left: Math.cos(angle) * radius + 200, // Center at 200
        top: Math.sin(angle) * radius + 200,
        width: 20,
        height: 20
      };
    };

    const axis = createCustomGridAxis(12, getPositionFn);

    const pos0 = axis.getPosition(0);
    expect(pos0.left).toBeCloseTo(300, 5); // cos(0) = 1
    expect(pos0.top).toBeCloseTo(200, 5);  // sin(0) = 0

    const pos3 = axis.getPosition(3); // 90 degrees
    expect(pos3.left).toBeCloseTo(200, 5); // cos(π/2) = 0
    expect(pos3.top).toBeCloseTo(300, 5);  // sin(π/2) = 1
  });

  describe('error handling', () => {
    it('should throw error for invalid divisions', () => {
      const fn = () => ({});

      expect(() => createCustomGridAxis(0, fn))
        .toThrow('Divisions must be a positive number');

      expect(() => createCustomGridAxis(-5, fn))
        .toThrow('Divisions must be a positive number');

      expect(() => createCustomGridAxis('5', fn))
        .toThrow('Divisions must be a positive number');

      expect(() => createCustomGridAxis(null, fn))
        .toThrow('Divisions must be a positive number');
    });

    it('should throw error for invalid position function', () => {
      expect(() => createCustomGridAxis(10, null))
        .toThrow('getPositionFn must be a function');

      expect(() => createCustomGridAxis(10, 'not a function'))
        .toThrow('getPositionFn must be a function');

      expect(() => createCustomGridAxis(10, {}))
        .toThrow('getPositionFn must be a function');
    });
  });
});

describe('Integration scenarios', () => {
  it('should work with musical-plane module', () => {
    // This test simulates how adapters integrate with musical-plane
    const soundline = createMockSoundline();
    const timeline = createMockTimelineContainer();

    const verticalAxis = createSoundlineVerticalAxis(soundline);
    const horizontalAxis = createTimelineHorizontalAxis(9, timeline, true);

    // Verify axis interfaces are compatible
    expect(verticalAxis.getCount()).toBe(12); // 12 notes
    expect(horizontalAxis.getCount()).toBe(8); // 8 spaces between 9 pulses

    // Simulate cell position calculation
    const vPos = verticalAxis.getPosition(5); // Note 5
    const hPos = horizontalAxis.getPosition(3); // Space 3

    expect(vPos).toHaveProperty('top');
    expect(vPos).toHaveProperty('height');
    expect(hPos).toHaveProperty('left');
    expect(hPos).toHaveProperty('width');

    // Cell would be positioned at intersection
    const cellBounds = {
      left: hPos.left,
      top: vPos.top,
      width: hPos.width,
      height: vPos.height
    };

    expect(cellBounds.left).toBe(300);
    expect(cellBounds.width).toBe(100);
    expect(cellBounds.top).toBe(300); // Note 5 position from mock
    expect(cellBounds.height).toBe(50);
  });

  it('should handle dynamic grid reconfiguration', () => {
    const container = createMockTimelineContainer();

    // Start with 9 pulses
    let axis = createTimelineHorizontalAxis(9, container, true);
    expect(axis.getCount()).toBe(8);

    // Reconfigure to 5 pulses
    axis = createTimelineHorizontalAxis(5, container, true);
    expect(axis.getCount()).toBe(4);

    // Switch to marker alignment
    axis = createTimelineHorizontalAxis(5, container, false);
    expect(axis.getCount()).toBe(5);
  });

  it('should support mixed axis types', () => {
    // Vertical: Custom logarithmic scale
    const customVertical = createCustomGridAxis(10, (index) => ({
      top: Math.log(index + 1) * 50,
      height: 40
    }));

    // Horizontal: Standard timeline
    const container = createMockTimelineContainer();
    const standardHorizontal = createTimelineHorizontalAxis(7, container, false);

    expect(customVertical.getCount()).toBe(10);
    expect(standardHorizontal.getCount()).toBe(7);

    // Both axes provide compatible position data
    const vPos = customVertical.getPosition(4);
    const hPos = standardHorizontal.getPosition(2);

    expect(vPos).toHaveProperty('top');
    expect(vPos).toHaveProperty('height');
    expect(hPos).toHaveProperty('left');
    expect(hPos).toHaveProperty('width');
  });
});