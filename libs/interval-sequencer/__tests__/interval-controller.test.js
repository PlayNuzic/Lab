/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { createIntervalSequencer } from '../interval-controller.js';

describe('interval-controller', () => {
  let mockMusicalGrid;
  let mockGridEditor;
  let timelineContainer;
  let matrixContainer;
  let sequencer;

  beforeEach(() => {
    // Create containers
    timelineContainer = document.createElement('div');
    timelineContainer.id = 'timeline';
    document.body.appendChild(timelineContainer);

    matrixContainer = document.createElement('div');
    matrixContainer.id = 'matrix';
    matrixContainer.style.width = '400px';
    document.body.appendChild(matrixContainer);

    // Mock getBoundingClientRect
    matrixContainer.getBoundingClientRect = () => ({
      width: 400,
      height: 200,
      left: 0,
      top: 0,
      right: 400,
      bottom: 200
    });

    // Create mock cells
    for (let note = 0; note < 12; note++) {
      for (let pulse = 0; pulse < 8; pulse++) {
        const cell = document.createElement('div');
        cell.className = 'musical-cell';
        cell.dataset.note = note;
        cell.dataset.pulse = pulse;
        matrixContainer.appendChild(cell);
      }
    }

    // Mock musical grid
    mockMusicalGrid = {
      getTimelineContainer: () => timelineContainer,
      getMatrixContainer: () => matrixContainer,
      getCellElement: (note, pulse) => {
        return matrixContainer.querySelector(
          `[data-note="${note}"][data-pulse="${pulse}"]`
        );
      }
    };

    // Mock grid editor
    mockGridEditor = {
      getPairs: jest.fn(() => []),
      setPairs: jest.fn()
    };
  });

  afterEach(() => {
    if (sequencer) {
      sequencer.destroy();
      sequencer = null;
    }
    document.body.innerHTML = '';
  });

  describe('createIntervalSequencer', () => {
    test('creates sequencer with default config', () => {
      sequencer = createIntervalSequencer({
        musicalGrid: mockMusicalGrid,
        totalSpaces: 8
      });

      expect(sequencer).toBeDefined();
      expect(typeof sequencer.setPairs).toBe('function');
      expect(typeof sequencer.getPairs).toBe('function');
      expect(typeof sequencer.getIntervals).toBe('function');
    });

    test('setPairs stores pairs', () => {
      sequencer = createIntervalSequencer({
        musicalGrid: mockMusicalGrid,
        totalSpaces: 8,
        autoFillGaps: false
      });

      const pairs = [
        { note: 3, pulse: 0, temporalInterval: 2 },
        { note: 5, pulse: 2, temporalInterval: 3 }
      ];
      sequencer.setPairs(pairs);

      expect(sequencer.getPairs()).toEqual(pairs);
    });

    test('setPairs with autoFillGaps fills gaps', () => {
      sequencer = createIntervalSequencer({
        musicalGrid: mockMusicalGrid,
        totalSpaces: 8,
        autoFillGaps: true,
        basePair: { note: 0, pulse: 0 }
      });

      const pairs = [
        { note: 5, pulse: 3, temporalInterval: 2 }
      ];
      sequencer.setPairs(pairs);

      const storedPairs = sequencer.getPairs();
      expect(storedPairs.length).toBeGreaterThan(1);
      expect(storedPairs[0].isRest).toBe(true);
    });

    test('setPairs triggers onPairsChange callback', () => {
      const onPairsChange = jest.fn();
      sequencer = createIntervalSequencer({
        musicalGrid: mockMusicalGrid,
        totalSpaces: 8,
        onPairsChange,
        autoFillGaps: false
      });

      const pairs = [{ note: 3, pulse: 0, temporalInterval: 2 }];
      sequencer.setPairs(pairs);

      expect(onPairsChange).toHaveBeenCalledWith(pairs);
    });

    test('setPairs triggers onIntervalsChange callback', () => {
      const onIntervalsChange = jest.fn();
      sequencer = createIntervalSequencer({
        musicalGrid: mockMusicalGrid,
        totalSpaces: 8,
        onIntervalsChange,
        autoFillGaps: false
      });

      const pairs = [{ note: 3, pulse: 0, temporalInterval: 2 }];
      sequencer.setPairs(pairs);

      expect(onIntervalsChange).toHaveBeenCalled();
      const [intervals, receivedPairs] = onIntervalsChange.mock.calls[0];
      expect(intervals).toHaveLength(1);
      expect(receivedPairs).toEqual(pairs);
    });

    test('getIntervals returns converted intervals', () => {
      sequencer = createIntervalSequencer({
        musicalGrid: mockMusicalGrid,
        totalSpaces: 8,
        basePair: { note: 0, pulse: 0 },
        autoFillGaps: false
      });

      sequencer.setPairs([
        { note: 3, pulse: 0, temporalInterval: 2 },
        { note: 5, pulse: 2, temporalInterval: 1 }
      ]);

      const intervals = sequencer.getIntervals();
      expect(intervals).toHaveLength(2);
      expect(intervals[0].soundInterval).toBe(3);
      expect(intervals[1].soundInterval).toBe(2);
    });

    test('setIntervals converts to pairs', () => {
      sequencer = createIntervalSequencer({
        musicalGrid: mockMusicalGrid,
        totalSpaces: 8,
        basePair: { note: 0, pulse: 0 },
        autoFillGaps: false
      });

      sequencer.setIntervals([
        { soundInterval: 3, temporalInterval: 2 },
        { soundInterval: 2, temporalInterval: 1 }
      ]);

      const pairs = sequencer.getPairs();
      expect(pairs).toHaveLength(3); // base + 2 intervals
      expect(pairs[1].note).toBe(3);
      expect(pairs[2].note).toBe(5);
    });

    test('addPair adds new pair', () => {
      sequencer = createIntervalSequencer({
        musicalGrid: mockMusicalGrid,
        totalSpaces: 8,
        autoFillGaps: false
      });

      sequencer.setPairs([]);
      sequencer.addPair({ note: 5, pulse: 2, temporalInterval: 2 });

      const pairs = sequencer.getPairs();
      expect(pairs).toHaveLength(1);
      expect(pairs[0].note).toBe(5);
    });

    test('addPair removes overlapping when polyphony disabled', () => {
      sequencer = createIntervalSequencer({
        musicalGrid: mockMusicalGrid,
        totalSpaces: 8,
        polyphonyEnabled: false,
        autoFillGaps: false
      });

      sequencer.setPairs([
        { note: 3, pulse: 1, temporalInterval: 3 }
      ]);

      sequencer.addPair({ note: 5, pulse: 2, temporalInterval: 2 });

      const pairs = sequencer.getPairs();
      expect(pairs).toHaveLength(1);
      expect(pairs[0].note).toBe(5);
    });

    test('addPair keeps overlapping when polyphony enabled', () => {
      sequencer = createIntervalSequencer({
        musicalGrid: mockMusicalGrid,
        totalSpaces: 8,
        polyphonyEnabled: true,
        autoFillGaps: false
      });

      sequencer.setPairs([
        { note: 3, pulse: 1, temporalInterval: 3 }
      ]);

      sequencer.addPair({ note: 5, pulse: 2, temporalInterval: 2 });

      const pairs = sequencer.getPairs();
      expect(pairs).toHaveLength(2);
    });

    test('removePair removes by index', () => {
      sequencer = createIntervalSequencer({
        musicalGrid: mockMusicalGrid,
        totalSpaces: 8,
        autoFillGaps: false
      });

      sequencer.setPairs([
        { note: 3, pulse: 0, temporalInterval: 2 },
        { note: 5, pulse: 2, temporalInterval: 1 }
      ]);

      sequencer.removePair(0);

      const pairs = sequencer.getPairs();
      expect(pairs).toHaveLength(1);
      expect(pairs[0].note).toBe(5);
    });

    test('removePairAt removes by position', () => {
      sequencer = createIntervalSequencer({
        musicalGrid: mockMusicalGrid,
        totalSpaces: 8,
        autoFillGaps: false
      });

      sequencer.setPairs([
        { note: 3, pulse: 0, temporalInterval: 2 },
        { note: 5, pulse: 2, temporalInterval: 1 }
      ]);

      sequencer.removePairAt(3, 0);

      const pairs = sequencer.getPairs();
      expect(pairs).toHaveLength(1);
      expect(pairs[0].note).toBe(5);
    });

    test('clear removes all pairs', () => {
      sequencer = createIntervalSequencer({
        musicalGrid: mockMusicalGrid,
        totalSpaces: 8,
        autoFillGaps: false
      });

      sequencer.setPairs([
        { note: 3, pulse: 0, temporalInterval: 2 }
      ]);

      sequencer.clear();

      expect(sequencer.getPairs()).toEqual([]);
    });

    test('setPolyphony changes polyphony mode', () => {
      sequencer = createIntervalSequencer({
        musicalGrid: mockMusicalGrid,
        totalSpaces: 8,
        polyphonyEnabled: false
      });

      expect(sequencer.isPolyphonyEnabled()).toBe(false);

      sequencer.setPolyphony(true);
      expect(sequencer.isPolyphonyEnabled()).toBe(true);
    });

    test('checkGaps returns gap status', () => {
      sequencer = createIntervalSequencer({
        musicalGrid: mockMusicalGrid,
        totalSpaces: 8,
        basePair: { note: 0, pulse: 0 },
        autoFillGaps: false
      });

      sequencer.setPairs([
        { note: 3, pulse: 0, temporalInterval: 2 },
        { note: 5, pulse: 5, temporalInterval: 1 }
      ]);

      expect(sequencer.checkGaps()).toBe(true);
    });

    test('getGaps returns gap information', () => {
      sequencer = createIntervalSequencer({
        musicalGrid: mockMusicalGrid,
        totalSpaces: 8,
        basePair: { note: 0, pulse: 0 },
        autoFillGaps: false
      });

      sequencer.setPairs([
        { note: 3, pulse: 0, temporalInterval: 2 },
        { note: 5, pulse: 5, temporalInterval: 1 }
      ]);

      const gaps = sequencer.getGaps();
      expect(gaps).toHaveLength(1);
      expect(gaps[0]).toEqual({ startPulse: 2, size: 3 });
    });

    test('fillCurrentGaps fills gaps in current sequence', () => {
      sequencer = createIntervalSequencer({
        musicalGrid: mockMusicalGrid,
        totalSpaces: 8,
        basePair: { note: 0, pulse: 0 },
        autoFillGaps: false
      });

      sequencer.setPairs([
        { note: 3, pulse: 0, temporalInterval: 2 },
        { note: 5, pulse: 5, temporalInterval: 1 }
      ]);

      sequencer.fillCurrentGaps();

      const pairs = sequencer.getPairs();
      expect(pairs).toHaveLength(3);
      expect(pairs[1].isRest).toBe(true);
    });

    test('setDragEnabled controls drag handler', () => {
      sequencer = createIntervalSequencer({
        musicalGrid: mockMusicalGrid,
        totalSpaces: 8
      });

      sequencer.setDragEnabled(false);
      expect(sequencer.isDragging()).toBe(false);
    });

    test('destroy cleans up', () => {
      sequencer = createIntervalSequencer({
        musicalGrid: mockMusicalGrid,
        totalSpaces: 8
      });

      sequencer.setPairs([{ note: 3, pulse: 0, temporalInterval: 2 }]);
      sequencer.destroy();

      expect(sequencer.getPairs()).toEqual([]);
    });

    test('getRenderer returns renderer instance', () => {
      sequencer = createIntervalSequencer({
        musicalGrid: mockMusicalGrid,
        totalSpaces: 8
      });

      const renderer = sequencer.getRenderer();
      expect(renderer).toBeDefined();
      expect(typeof renderer.render).toBe('function');
    });

    test('getDragHandler returns drag handler instance', () => {
      sequencer = createIntervalSequencer({
        musicalGrid: mockMusicalGrid,
        totalSpaces: 8
      });

      const dragHandler = sequencer.getDragHandler();
      expect(dragHandler).toBeDefined();
      expect(typeof dragHandler.startDrag).toBe('function');
    });

    test('refresh re-renders intervals', () => {
      sequencer = createIntervalSequencer({
        musicalGrid: mockMusicalGrid,
        totalSpaces: 8,
        autoFillGaps: false
      });

      sequencer.setPairs([{ note: 3, pulse: 0, temporalInterval: 2 }]);

      // Verify bars exist
      const barsBefore = timelineContainer.querySelectorAll('.it-bar');
      expect(barsBefore).toHaveLength(1);

      sequencer.refresh();

      const barsAfter = timelineContainer.querySelectorAll('.it-bar');
      expect(barsAfter).toHaveLength(1);
    });

    test('highlightInterval highlights bar', () => {
      jest.useFakeTimers();

      sequencer = createIntervalSequencer({
        musicalGrid: mockMusicalGrid,
        totalSpaces: 8,
        autoFillGaps: false
      });

      sequencer.setPairs([{ note: 3, pulse: 0, temporalInterval: 2 }]);
      sequencer.highlightInterval(1, 100);

      const bar = timelineContainer.querySelector('.it-bar');
      expect(bar.classList.contains('it-bar--highlight')).toBe(true);

      jest.advanceTimersByTime(100);
      expect(bar.classList.contains('it-bar--highlight')).toBe(false);

      jest.useRealTimers();
    });
  });
});
