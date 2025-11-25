/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import {
  createIntervalDragHandler,
  getSpaceIndexFromPair,
  getEndSpaceFromPair
} from '../interval-drag-handler.js';

describe('interval-drag-handler', () => {
  let mockMusicalGrid;
  let mockGridEditor;
  let matrixContainer;
  let dragHandler;

  beforeEach(() => {
    // Create mock matrix container
    matrixContainer = document.createElement('div');
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
    if (dragHandler) {
      dragHandler.destroy();
      dragHandler = null;
    }
    document.body.innerHTML = '';
  });

  describe('createIntervalDragHandler', () => {
    test('creates handler with default state', () => {
      dragHandler = createIntervalDragHandler({
        musicalGrid: mockMusicalGrid,
        gridEditor: mockGridEditor,
        totalSpaces: 8
      });

      expect(dragHandler.isActive()).toBe(false);
      expect(dragHandler.isEnabled()).toBe(true);
    });

    test('can be enabled/disabled', () => {
      dragHandler = createIntervalDragHandler({
        musicalGrid: mockMusicalGrid,
        gridEditor: mockGridEditor,
        totalSpaces: 8
      });

      dragHandler.setEnabled(false);
      expect(dragHandler.isEnabled()).toBe(false);

      dragHandler.setEnabled(true);
      expect(dragHandler.isEnabled()).toBe(true);
    });

    test('startDrag activates drag state', () => {
      const onDragStart = jest.fn();
      dragHandler = createIntervalDragHandler({
        musicalGrid: mockMusicalGrid,
        gridEditor: mockGridEditor,
        totalSpaces: 8,
        onDragStart
      });

      const mockEvent = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
      dragHandler.startDrag(5, 2, mockEvent);

      expect(dragHandler.isActive()).toBe(true);
      expect(onDragStart).toHaveBeenCalledWith({
        noteIndex: 5,
        spaceIndex: 2,
        mode: 'create',
        originalPair: undefined
      });
    });

    test('startDrag in edit mode when existing pair found', () => {
      const existingPair = { note: 5, pulse: 2, temporalInterval: 2 };
      mockGridEditor.getPairs = () => [existingPair];

      const onDragStart = jest.fn();
      dragHandler = createIntervalDragHandler({
        musicalGrid: mockMusicalGrid,
        gridEditor: mockGridEditor,
        totalSpaces: 8,
        onDragStart
      });

      const mockEvent = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
      dragHandler.startDrag(5, 2, mockEvent);

      expect(onDragStart).toHaveBeenCalledWith({
        noteIndex: 5,
        spaceIndex: 2,
        mode: 'edit',
        originalPair: existingPair
      });
    });

    test('cancel resets drag state', () => {
      dragHandler = createIntervalDragHandler({
        musicalGrid: mockMusicalGrid,
        gridEditor: mockGridEditor,
        totalSpaces: 8
      });

      const mockEvent = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
      dragHandler.startDrag(5, 2, mockEvent);
      expect(dragHandler.isActive()).toBe(true);

      dragHandler.cancel();
      expect(dragHandler.isActive()).toBe(false);
    });

    test('disabled handler does not start drag', () => {
      const onDragStart = jest.fn();
      dragHandler = createIntervalDragHandler({
        musicalGrid: mockMusicalGrid,
        gridEditor: mockGridEditor,
        totalSpaces: 8,
        onDragStart
      });

      dragHandler.setEnabled(false);
      const mockEvent = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
      dragHandler.startDrag(5, 2, mockEvent);

      expect(dragHandler.isActive()).toBe(false);
      expect(onDragStart).not.toHaveBeenCalled();
    });

    test('getState returns current state copy', () => {
      dragHandler = createIntervalDragHandler({
        musicalGrid: mockMusicalGrid,
        gridEditor: mockGridEditor,
        totalSpaces: 8
      });

      const mockEvent = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
      dragHandler.startDrag(5, 2, mockEvent);

      const state = dragHandler.getState();
      expect(state.active).toBe(true);
      expect(state.noteIndex).toBe(5);
      expect(state.startSpaceIndex).toBe(2);
    });

    test('destroy cleans up event listeners', () => {
      dragHandler = createIntervalDragHandler({
        musicalGrid: mockMusicalGrid,
        gridEditor: mockGridEditor,
        totalSpaces: 8
      });

      dragHandler.destroy();
      expect(dragHandler.isActive()).toBe(false);
    });
  });

  describe('getSpaceIndexFromPair', () => {
    test('returns pulse from pair', () => {
      expect(getSpaceIndexFromPair({ pulse: 3 })).toBe(3);
      expect(getSpaceIndexFromPair({ pulse: 0 })).toBe(0);
    });

    test('returns 0 for null/undefined', () => {
      expect(getSpaceIndexFromPair(null)).toBe(0);
      expect(getSpaceIndexFromPair(undefined)).toBe(0);
      expect(getSpaceIndexFromPair({})).toBe(0);
    });
  });

  describe('getEndSpaceFromPair', () => {
    test('calculates end space from pulse and iT', () => {
      expect(getEndSpaceFromPair({ pulse: 2, temporalInterval: 3 })).toBe(4);
      expect(getEndSpaceFromPair({ pulse: 0, temporalInterval: 1 })).toBe(0);
    });

    test('uses default iT of 1', () => {
      expect(getEndSpaceFromPair({ pulse: 5 })).toBe(5);
    });

    test('handles null/undefined', () => {
      expect(getEndSpaceFromPair(null)).toBe(0);
      expect(getEndSpaceFromPair(undefined)).toBe(0);
    });
  });

  describe('drag visual feedback', () => {
    test('adds drag-preview class to cell on startDrag', () => {
      dragHandler = createIntervalDragHandler({
        musicalGrid: mockMusicalGrid,
        gridEditor: mockGridEditor,
        totalSpaces: 8
      });

      const mockEvent = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
      dragHandler.startDrag(5, 2, mockEvent);

      const cell = mockMusicalGrid.getCellElement(5, 2);
      expect(cell.classList.contains('drag-preview')).toBe(true);
    });

    test('clears drag-preview on cancel', () => {
      dragHandler = createIntervalDragHandler({
        musicalGrid: mockMusicalGrid,
        gridEditor: mockGridEditor,
        totalSpaces: 8
      });

      const mockEvent = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
      dragHandler.startDrag(5, 2, mockEvent);
      dragHandler.cancel();

      const cell = mockMusicalGrid.getCellElement(5, 2);
      expect(cell.classList.contains('drag-preview')).toBe(false);
    });

    test('adds dragging-note class to body on startDrag', () => {
      dragHandler = createIntervalDragHandler({
        musicalGrid: mockMusicalGrid,
        gridEditor: mockGridEditor,
        totalSpaces: 8
      });

      const mockEvent = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
      dragHandler.startDrag(5, 2, mockEvent);

      expect(document.body.classList.contains('dragging-note')).toBe(true);
    });
  });

  describe('polyphony mode', () => {
    test('removes overlapping pairs when polyphony disabled', () => {
      // Original pair at pulse 1, iT=3 (occupies pulses 1, 2, 3)
      mockGridEditor.getPairs = () => [
        { note: 3, pulse: 1, temporalInterval: 3 }
      ];

      dragHandler = createIntervalDragHandler({
        musicalGrid: mockMusicalGrid,
        gridEditor: mockGridEditor,
        totalSpaces: 8,
        getPolyphonyEnabled: () => false
      });

      // New drag at pulse 2 - this overlaps with the original (pulses 1-3)
      const mockEvent = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
      dragHandler.startDrag(5, 2, mockEvent);

      // Simulate mouseup
      document.dispatchEvent(new MouseEvent('mouseup'));

      // Check that setPairs was called
      expect(mockGridEditor.setPairs).toHaveBeenCalled();
      const newPairs = mockGridEditor.setPairs.mock.calls[0][0];

      // Original pair at pulse 1-3 should be removed because new pair at pulse 2 overlaps
      const originalPairExists = newPairs.some(p => p.note === 3 && p.pulse === 1);
      expect(originalPairExists).toBe(false);
    });

    test('keeps all pairs when polyphony enabled', () => {
      mockGridEditor.getPairs = () => [
        { note: 3, pulse: 2, temporalInterval: 2 }
      ];

      dragHandler = createIntervalDragHandler({
        musicalGrid: mockMusicalGrid,
        gridEditor: mockGridEditor,
        totalSpaces: 8,
        getPolyphonyEnabled: () => true
      });

      const mockEvent = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
      dragHandler.startDrag(5, 1, mockEvent);

      document.dispatchEvent(new MouseEvent('mouseup'));

      expect(mockGridEditor.setPairs).toHaveBeenCalled();
      const newPairs = mockGridEditor.setPairs.mock.calls[0][0];

      expect(newPairs).toHaveLength(2);
    });
  });

  describe('callbacks', () => {
    test('calls onNotePreview on create mode mouseup', () => {
      const onNotePreview = jest.fn();
      dragHandler = createIntervalDragHandler({
        musicalGrid: mockMusicalGrid,
        gridEditor: mockGridEditor,
        totalSpaces: 8,
        onNotePreview
      });

      const mockEvent = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
      dragHandler.startDrag(5, 2, mockEvent);
      document.dispatchEvent(new MouseEvent('mouseup'));

      expect(onNotePreview).toHaveBeenCalledWith(5, 1);
    });

    test('calls onDragEnd with pairs and info', () => {
      const onDragEnd = jest.fn();
      dragHandler = createIntervalDragHandler({
        musicalGrid: mockMusicalGrid,
        gridEditor: mockGridEditor,
        totalSpaces: 8,
        onDragEnd
      });

      const mockEvent = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
      dragHandler.startDrag(5, 2, mockEvent);
      document.dispatchEvent(new MouseEvent('mouseup'));

      expect(onDragEnd).toHaveBeenCalled();
      const [pairs, info] = onDragEnd.mock.calls[0];
      expect(info.noteIndex).toBe(5);
      expect(info.mode).toBe('create');
    });
  });
});
