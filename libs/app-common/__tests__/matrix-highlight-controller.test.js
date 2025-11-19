/**
 * Tests for matrix-highlight-controller.js
 * @jest-environment jsdom
 */

import { createMatrixHighlightController, highlightNoteOnSoundline } from '../matrix-highlight-controller.js';

describe('createMatrixHighlightController', () => {
  let mockMusicalGrid;
  let mockGridEditor;
  let mockTimeline;
  let mockPulseMarker;
  let getCellElementCalls;
  let onPulseStepCalls;
  let clearIntervalHighlightsCalls;
  let getNoteElementCalls;
  let gridEditorHighlightCalls;
  let gridEditorClearCalls;

  beforeEach(() => {
    // Reset call tracking
    getCellElementCalls = [];
    onPulseStepCalls = [];
    clearIntervalHighlightsCalls = [];
    getNoteElementCalls = [];
    gridEditorHighlightCalls = [];
    gridEditorClearCalls = [];

    // Create mock DOM elements
    mockPulseMarker = document.createElement('div');
    mockPulseMarker.setAttribute('data-pulse', '0');
    mockPulseMarker.className = 'pulse-marker';

    mockTimeline = document.createElement('div');
    mockTimeline.appendChild(mockPulseMarker);

    // Mock musical grid
    mockMusicalGrid = {
      containers: {
        timeline: mockTimeline,
        soundline: document.createElement('div')
      },
      getCellElement: (noteIndex, pulse) => {
        getCellElementCalls.push({ noteIndex, pulse });
        const cell = document.createElement('div');
        cell.className = 'musical-cell active';
        return cell;
      },
      onPulseStep: (pulse, intervalMs) => {
        onPulseStepCalls.push({ pulse, intervalMs });
      },
      clearIntervalHighlights: (direction) => {
        clearIntervalHighlightsCalls.push({ direction });
      },
      getNoteElement: (noteIndex) => {
        getNoteElementCalls.push({ noteIndex });
        const note = document.createElement('div');
        return note;
      }
    };

    // Mock grid editor
    mockGridEditor = {
      highlightCell: (type, pulse) => {
        gridEditorHighlightCalls.push({ type, pulse });
      },
      clearHighlights: () => {
        gridEditorClearCalls.push({});
      }
    };

    // Add elements to document for querySelectorAll
    document.body.appendChild(mockTimeline);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('Controller Creation', () => {
    test('should create controller with valid config', () => {
      const controller = createMatrixHighlightController({
        musicalGrid: mockMusicalGrid,
        gridEditor: mockGridEditor,
        totalNotes: 12,
        currentBPM: 120
      });

      expect(controller).toHaveProperty('highlightPulse');
      expect(controller).toHaveProperty('clearHighlights');
      expect(controller).toHaveProperty('getCurrentPulse');
    });

    test('should create controller without gridEditor (optional)', () => {
      const controller = createMatrixHighlightController({
        musicalGrid: mockMusicalGrid,
        totalNotes: 12,
        currentBPM: 120
      });

      expect(controller).toHaveProperty('highlightPulse');
      expect(controller).toHaveProperty('clearHighlights');
    });

    test('should throw error if musicalGrid is missing', () => {
      expect(() => {
        createMatrixHighlightController({
          totalNotes: 12,
          currentBPM: 120
        });
      }).toThrow('musicalGrid is required');
    });

    test('should throw error if totalNotes is invalid', () => {
      expect(() => {
        createMatrixHighlightController({
          musicalGrid: mockMusicalGrid,
          totalNotes: 0,
          currentBPM: 120
        });
      }).toThrow('totalNotes must be a positive number');

      expect(() => {
        createMatrixHighlightController({
          musicalGrid: mockMusicalGrid,
          totalNotes: -5,
          currentBPM: 120
        });
      }).toThrow('totalNotes must be a positive number');
    });

    test('should throw error if currentBPM is invalid', () => {
      expect(() => {
        createMatrixHighlightController({
          musicalGrid: mockMusicalGrid,
          totalNotes: 12,
          currentBPM: 0
        });
      }).toThrow('currentBPM must be a positive number');

      expect(() => {
        createMatrixHighlightController({
          musicalGrid: mockMusicalGrid,
          totalNotes: 12,
          currentBPM: -60
        });
      }).toThrow('currentBPM must be a positive number');
    });
  });

  describe('highlightPulse', () => {
    test('should highlight pulse marker on timeline', () => {
      const controller = createMatrixHighlightController({
        musicalGrid: mockMusicalGrid,
        totalNotes: 12,
        currentBPM: 120
      });

      controller.highlightPulse(0);

      expect(mockPulseMarker.classList.contains('highlighted')).toBe(true);
    });

    test('should highlight active cells in pulse column', () => {
      const controller = createMatrixHighlightController({
        musicalGrid: mockMusicalGrid,
        totalNotes: 3,
        currentBPM: 120
      });

      controller.highlightPulse(0);

      expect(getCellElementCalls.length).toBe(3);
      expect(getCellElementCalls[0]).toEqual({ noteIndex: 0, pulse: 0 });
      expect(getCellElementCalls[1]).toEqual({ noteIndex: 1, pulse: 0 });
      expect(getCellElementCalls[2]).toEqual({ noteIndex: 2, pulse: 0 });
    });

    test('should call musical grid onPulseStep with correct interval', () => {
      const controller = createMatrixHighlightController({
        musicalGrid: mockMusicalGrid,
        totalNotes: 12,
        currentBPM: 60
      });

      controller.highlightPulse(0);

      // BPM 60 = 1 second per beat = 1000ms
      expect(onPulseStepCalls.length).toBe(1);
      expect(onPulseStepCalls[0]).toEqual({ pulse: 0, intervalMs: 1000 });
    });

    test('should highlight grid editor cells when gridEditor is provided', () => {
      const controller = createMatrixHighlightController({
        musicalGrid: mockMusicalGrid,
        gridEditor: mockGridEditor,
        totalNotes: 12,
        currentBPM: 120
      });

      controller.highlightPulse(5);

      expect(gridEditorHighlightCalls.length).toBe(2);
      expect(gridEditorHighlightCalls[0]).toEqual({ type: 'N', pulse: 5 });
      expect(gridEditorHighlightCalls[1]).toEqual({ type: 'P', pulse: 5 });
    });

    test('should not call gridEditor if not provided', () => {
      const controller = createMatrixHighlightController({
        musicalGrid: mockMusicalGrid,
        totalNotes: 12,
        currentBPM: 120
      });

      controller.highlightPulse(0);

      // Should not throw error
      expect(gridEditorHighlightCalls.length).toBe(0);
    });

    test('should clear previous highlights before highlighting new pulse', () => {
      const controller = createMatrixHighlightController({
        musicalGrid: mockMusicalGrid,
        totalNotes: 12,
        currentBPM: 120
      });

      // Highlight pulse 0
      controller.highlightPulse(0);
      expect(mockPulseMarker.classList.contains('highlighted')).toBe(true);

      // Create another pulse marker for pulse 1
      const marker1 = document.createElement('div');
      marker1.setAttribute('data-pulse', '1');
      marker1.className = 'pulse-marker';
      mockTimeline.appendChild(marker1);

      // Highlight pulse 1
      controller.highlightPulse(1);

      // Pulse 0 should be cleared
      expect(mockPulseMarker.classList.contains('highlighted')).toBe(false);
      // Pulse 1 should be highlighted
      expect(marker1.classList.contains('highlighted')).toBe(true);
    });

    test('should update current pulse index', () => {
      const controller = createMatrixHighlightController({
        musicalGrid: mockMusicalGrid,
        totalNotes: 12,
        currentBPM: 120
      });

      expect(controller.getCurrentPulse()).toBe(-1);

      controller.highlightPulse(3);
      expect(controller.getCurrentPulse()).toBe(3);

      controller.highlightPulse(7);
      expect(controller.getCurrentPulse()).toBe(7);
    });
  });

  describe('clearHighlights', () => {
    test('should remove all pulse-marker highlights', () => {
      const controller = createMatrixHighlightController({
        musicalGrid: mockMusicalGrid,
        totalNotes: 12,
        currentBPM: 120
      });

      controller.highlightPulse(0);
      expect(mockPulseMarker.classList.contains('highlighted')).toBe(true);

      controller.clearHighlights();
      expect(mockPulseMarker.classList.contains('highlighted')).toBe(false);
    });

    test('should remove all musical-cell highlights', () => {
      const cell = document.createElement('div');
      cell.className = 'musical-cell pulse-highlight';
      document.body.appendChild(cell);

      const controller = createMatrixHighlightController({
        musicalGrid: mockMusicalGrid,
        totalNotes: 12,
        currentBPM: 120
      });

      controller.clearHighlights();
      expect(cell.classList.contains('pulse-highlight')).toBe(false);
    });

    test('should clear musical grid interval highlights', () => {
      const controller = createMatrixHighlightController({
        musicalGrid: mockMusicalGrid,
        totalNotes: 12,
        currentBPM: 120
      });

      controller.clearHighlights();
      expect(clearIntervalHighlightsCalls.length).toBe(1);
      expect(clearIntervalHighlightsCalls[0]).toEqual({ direction: 'horizontal' });
    });

    test('should clear grid editor highlights when provided', () => {
      const controller = createMatrixHighlightController({
        musicalGrid: mockMusicalGrid,
        gridEditor: mockGridEditor,
        totalNotes: 12,
        currentBPM: 120
      });

      controller.clearHighlights();
      expect(gridEditorClearCalls.length).toBe(1);
    });

    test('should reset current pulse to -1', () => {
      const controller = createMatrixHighlightController({
        musicalGrid: mockMusicalGrid,
        totalNotes: 12,
        currentBPM: 120
      });

      controller.highlightPulse(5);
      expect(controller.getCurrentPulse()).toBe(5);

      controller.clearHighlights();
      expect(controller.getCurrentPulse()).toBe(-1);
    });
  });

  describe('getCurrentPulse', () => {
    test('should return -1 initially', () => {
      const controller = createMatrixHighlightController({
        musicalGrid: mockMusicalGrid,
        totalNotes: 12,
        currentBPM: 120
      });

      expect(controller.getCurrentPulse()).toBe(-1);
    });

    test('should return current pulse after highlighting', () => {
      const controller = createMatrixHighlightController({
        musicalGrid: mockMusicalGrid,
        totalNotes: 12,
        currentBPM: 120
      });

      controller.highlightPulse(10);
      expect(controller.getCurrentPulse()).toBe(10);
    });
  });
});

describe('highlightNoteOnSoundline', () => {
  let mockMusicalGrid;
  let mockSoundline;
  let mockNoteElement;

  beforeEach(() => {
    mockNoteElement = document.createElement('div');
    Object.defineProperty(mockNoteElement, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        top: 100,
        left: 50,
        width: 200,
        height: 30
      })
    });

    mockSoundline = document.createElement('div');
    Object.defineProperty(mockSoundline, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        top: 50,
        left: 50,
        width: 200,
        height: 500
      })
    });

    mockMusicalGrid = {
      getNoteElement: () => mockNoteElement,
      containers: {
        soundline: mockSoundline
      }
    };

    document.body.appendChild(mockSoundline);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('should create highlight rectangle on soundline', () => {
    highlightNoteOnSoundline(mockMusicalGrid, 5, 500);

    const highlight = mockSoundline.querySelector('.soundline-highlight');
    expect(highlight).toBeTruthy();
    expect(highlight.className).toBe('soundline-highlight');
  });

  test('should position highlight correctly relative to soundline', () => {
    highlightNoteOnSoundline(mockMusicalGrid, 5, 500);

    const highlight = mockSoundline.querySelector('.soundline-highlight');

    // top should be noteElement.top (100) - soundline.top (50) = 50px
    expect(highlight.style.top).toBe('50px');
    // Browser normalizes '0' to '0px' in computed style
    expect(highlight.style.left).toMatch(/^0(px)?$/);
    expect(highlight.style.width).toBe('100%');
    expect(highlight.style.height).toBe('30px'); // noteElement height
  });

  test('should remove highlight after specified duration', (done) => {
    highlightNoteOnSoundline(mockMusicalGrid, 5, 100);

    const highlight = mockSoundline.querySelector('.soundline-highlight');
    expect(highlight).toBeTruthy();

    setTimeout(() => {
      const highlightAfter = mockSoundline.querySelector('.soundline-highlight');
      expect(highlightAfter).toBeNull();
      done();
    }, 150);
  });

  test('should handle missing musicalGrid gracefully', () => {
    expect(() => {
      highlightNoteOnSoundline(null, 5, 500);
    }).not.toThrow();

    const highlight = mockSoundline.querySelector('.soundline-highlight');
    expect(highlight).toBeNull();
  });

  test('should handle missing noteElement gracefully', () => {
    mockMusicalGrid.getNoteElement = () => null;

    expect(() => {
      highlightNoteOnSoundline(mockMusicalGrid, 5, 500);
    }).not.toThrow();

    const highlight = mockSoundline.querySelector('.soundline-highlight');
    expect(highlight).toBeNull();
  });

  test('should handle missing soundline container gracefully', () => {
    mockMusicalGrid.containers = {};

    expect(() => {
      highlightNoteOnSoundline(mockMusicalGrid, 5, 500);
    }).not.toThrow();

    const highlight = mockSoundline.querySelector('.soundline-highlight');
    expect(highlight).toBeNull();
  });

  test('should apply correct visual styles', () => {
    highlightNoteOnSoundline(mockMusicalGrid, 5, 500);

    const highlight = mockSoundline.querySelector('.soundline-highlight');
    expect(highlight.style.position).toBe('absolute');
    expect(highlight.style.backgroundColor).toBe('rgba(255, 255, 0, 0.3)');
    expect(highlight.style.pointerEvents).toBe('none');
    expect(highlight.style.zIndex).toBe('10');
  });
});
