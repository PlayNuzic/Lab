/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { createIntervalNoteDragHandler } from '../interval-note-drag.js';

describe('interval-note-drag', () => {
  let mockGrid;
  let mockGridEditor;
  let mockSyncController;
  let currentPairs;
  let dragHandler;
  let matrixContainer;

  beforeEach(() => {
    // Setup DOM
    matrixContainer = document.createElement('div');
    matrixContainer.className = 'matrix-container';
    document.body.appendChild(matrixContainer);

    // Create mock cells with dots
    for (let row = 0; row < 12; row++) {
      for (let col = 0; col < 8; col++) {
        const cell = document.createElement('div');
        cell.className = 'plano-cell';
        cell.dataset.rowId = `${row}r4`;
        cell.dataset.colIndex = col;
        cell.style.width = '50px';  // For position calculations

        // Add dot
        const dot = document.createElement('div');
        dot.className = 'np-dot np-dot-clickable';
        dot.dataset.rowId = `${row}r4`;
        dot.dataset.colIndex = col;
        cell.appendChild(dot);

        matrixContainer.appendChild(cell);
      }
    }

    // Mock getBoundingClientRect for position calculations
    matrixContainer.getBoundingClientRect = jest.fn(() => ({
      left: 0,
      top: 0,
      width: 400,
      height: 600
    }));
    matrixContainer.scrollLeft = 0;

    // Mock grid
    mockGrid = {
      getElements: () => ({ matrixContainer })
    };

    // Mock grid editor
    mockGridEditor = {
      getPairs: jest.fn(() => [...currentPairs]),
      setPairs: jest.fn((pairs) => { currentPairs = pairs; })
    };

    // Mock sync controller
    mockSyncController = {
      syncGridFromPairs: jest.fn(),
      highlightDragRange: jest.fn(),
      clearDragHighlight: jest.fn()
    };

    currentPairs = [];

    dragHandler = createIntervalNoteDragHandler({
      grid: mockGrid,
      gridEditor: mockGridEditor,
      getPairs: () => currentPairs,
      setPairs: (pairs) => { currentPairs = pairs; },
      getTotalPulses: () => 8,
      syncController: mockSyncController,
      config: {
        defaultRegistry: 4,
        monophonic: true
      }
    });
  });

  afterEach(() => {
    dragHandler?.destroy();
    document.body.innerHTML = '';
  });

  describe('createIntervalNoteDragHandler', () => {
    test('creates handler with all API methods', () => {
      expect(dragHandler).toBeDefined();
      expect(typeof dragHandler.attach).toBe('function');
      expect(typeof dragHandler.detach).toBe('function');
      expect(typeof dragHandler.destroy).toBe('function');
      expect(typeof dragHandler.isDragging).toBe('function');
      expect(typeof dragHandler.isFromDrag).toBe('function');
      expect(typeof dragHandler.getDragState).toBe('function');
      expect(typeof dragHandler.cancelDrag).toBe('function');
    });

    test('handles missing grid gracefully', () => {
      const handler = createIntervalNoteDragHandler({
        grid: null,
        getPairs: () => [],
        setPairs: () => {},
        getTotalPulses: () => 8
      });

      expect(() => handler.attach()).not.toThrow();
    });
  });

  describe('attach/detach', () => {
    test('attach adds event listeners', () => {
      const addEventListenerSpy = jest.spyOn(matrixContainer, 'addEventListener');

      dragHandler.attach();

      expect(addEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
    });

    test('detach removes event listeners', () => {
      const removeEventListenerSpy = jest.spyOn(matrixContainer, 'removeEventListener');

      dragHandler.attach();
      dragHandler.detach();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
    });

    test('destroy cleans up completely', () => {
      dragHandler.attach();
      dragHandler.destroy();

      expect(dragHandler.isDragging()).toBe(false);
    });
  });

  describe('drag operations', () => {
    beforeEach(() => {
      dragHandler.attach();
    });

    test('isDragging returns false initially', () => {
      expect(dragHandler.isDragging()).toBe(false);
    });

    test('isFromDrag returns false initially', () => {
      expect(dragHandler.isFromDrag()).toBe(false);
    });

    test('getDragState returns inactive state initially', () => {
      const state = dragHandler.getDragState();
      expect(state.active).toBe(false);
      expect(state.mode).toBeNull();
    });

    test('drag start on dot initiates CREATE mode for empty cell', () => {
      const dot = matrixContainer.querySelector('[data-row-id="5r4"][data-col-index="2"] .np-dot');

      const mousedownEvent = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: 125  // Middle of cell 2
      });

      dot.dispatchEvent(mousedownEvent);

      expect(dragHandler.isDragging()).toBe(true);
      expect(dragHandler.getDragState().mode).toBe('create');
    });

    test('drag start on dot initiates EDIT mode for existing note', () => {
      // Add existing pair
      currentPairs = [
        { note: 5, pulse: 2, temporalInterval: 1, registry: 4 }
      ];

      const dot = matrixContainer.querySelector('[data-row-id="5r4"][data-col-index="2"] .np-dot');

      const mousedownEvent = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: 125
      });

      dot.dispatchEvent(mousedownEvent);

      expect(dragHandler.isDragging()).toBe(true);
      expect(dragHandler.getDragState().mode).toBe('edit');
    });

    test('drag on non-dot element does not start drag', () => {
      const cell = matrixContainer.querySelector('[data-row-id="5r4"][data-col-index="2"]');

      const mousedownEvent = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: 125
      });

      cell.dispatchEvent(mousedownEvent);

      expect(dragHandler.isDragging()).toBe(false);
    });

    test('cancelDrag stops active drag', () => {
      const dot = matrixContainer.querySelector('[data-row-id="5r4"][data-col-index="2"] .np-dot');

      dot.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: 125
      }));

      expect(dragHandler.isDragging()).toBe(true);

      dragHandler.cancelDrag();

      expect(dragHandler.isDragging()).toBe(false);
    });
  });

  describe('CREATE mode', () => {
    beforeEach(() => {
      dragHandler.attach();
    });

    test('creates new note on drag end', () => {
      const dot = matrixContainer.querySelector('[data-row-id="5r4"][data-col-index="2"] .np-dot');

      // Start drag
      dot.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: 100
      }));

      // End drag (same position = iT of 1)
      document.dispatchEvent(new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true
      }));

      expect(currentPairs).toContainEqual(expect.objectContaining({
        note: 5,
        registry: 4,
        pulse: 2,
        temporalInterval: 1
      }));
    });

    test('calls syncController.syncGridFromPairs after create', () => {
      const dot = matrixContainer.querySelector('[data-row-id="5r4"][data-col-index="2"] .np-dot');

      dot.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: 100
      }));

      document.dispatchEvent(new MouseEvent('mouseup'));

      expect(mockSyncController.syncGridFromPairs).toHaveBeenCalled();
    });

    test('replaces existing note at same pulse (monophonic)', () => {
      currentPairs = [
        { note: 7, pulse: 2, temporalInterval: 1, registry: 4 }
      ];

      const dot = matrixContainer.querySelector('[data-row-id="5r4"][data-col-index="2"] .np-dot');

      dot.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: 100
      }));

      document.dispatchEvent(new MouseEvent('mouseup'));

      // Should have replaced note 7 with note 5
      expect(currentPairs.filter(p => p.pulse === 2).length).toBe(1);
      expect(currentPairs.find(p => p.pulse === 2).note).toBe(5);
    });
  });

  describe('EDIT mode', () => {
    beforeEach(() => {
      currentPairs = [
        { note: 5, pulse: 2, temporalInterval: 2, registry: 4 }
      ];
      dragHandler.attach();
    });

    test('updates temporalInterval on drag end', () => {
      const dot = matrixContainer.querySelector('[data-row-id="5r4"][data-col-index="2"] .np-dot');

      // Start drag
      dot.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: 100
      }));

      expect(dragHandler.getDragState().mode).toBe('edit');

      // End drag
      document.dispatchEvent(new MouseEvent('mouseup'));

      // Original pair should be updated
      expect(mockGridEditor.setPairs).toHaveBeenCalled();
    });
  });

  describe('monophonic covered notes removal', () => {
    beforeEach(() => {
      dragHandler.attach();
    });

    test('creates note with iT=1 does not remove distant notes', () => {
      // Setup: notes at pulses 0, 3, 5
      currentPairs = [
        { note: 7, pulse: 0, temporalInterval: 1, registry: 4 },
        { note: 3, pulse: 3, temporalInterval: 1, registry: 4 },
        { note: 9, pulse: 5, temporalInterval: 1, registry: 4 }
      ];

      // Create new note at pulse 2 (no overlap with existing notes)
      const dot = matrixContainer.querySelector('[data-row-id="5r4"][data-col-index="2"] .np-dot');

      dot.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: 125
      }));

      expect(dragHandler.getDragState().mode).toBe('create');

      document.dispatchEvent(new MouseEvent('mouseup'));

      // All original notes should remain
      expect(currentPairs.find(p => p.pulse === 0)).toBeDefined();
      expect(currentPairs.find(p => p.pulse === 3)).toBeDefined();
      expect(currentPairs.find(p => p.pulse === 5)).toBeDefined();
      // New note at pulse 2 should exist
      expect(currentPairs.find(p => p.pulse === 2)).toBeDefined();
    });

    test('cuts note that extends into new note range from before', () => {
      // Setup: note at pulse 0 with iT=4 (covers pulses 0-3)
      currentPairs = [
        { note: 7, pulse: 0, temporalInterval: 4, registry: 4 }
      ];

      // Create new note starting at pulse 2
      const dot = matrixContainer.querySelector('[data-row-id="5r4"][data-col-index="2"] .np-dot');

      dot.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: 100
      }));

      expect(dragHandler.getDragState().mode).toBe('create');

      document.dispatchEvent(new MouseEvent('mouseup'));

      // Note at pulse 0 should be cut to iT=2 (ends at pulse 2)
      const cutNote = currentPairs.find(p => p.pulse === 0);
      expect(cutNote).toBeDefined();
      expect(cutNote.temporalInterval).toBe(2);

      // New note at pulse 2 should exist
      const newNote = currentPairs.find(p => p.pulse === 2);
      expect(newNote).toBeDefined();
    });
  });

  describe('highlight during drag', () => {
    beforeEach(() => {
      dragHandler.attach();
    });

    test('calls syncController.highlightDragRange during drag', () => {
      const dot = matrixContainer.querySelector('[data-row-id="5r4"][data-col-index="2"] .np-dot');

      dot.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: 100
      }));

      expect(mockSyncController.highlightDragRange).toHaveBeenCalledWith('5r4', 2, 2);
    });

    test('calls syncController.clearDragHighlight on drag end', () => {
      const dot = matrixContainer.querySelector('[data-row-id="5r4"][data-col-index="2"] .np-dot');

      dot.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: 100
      }));

      document.dispatchEvent(new MouseEvent('mouseup'));

      expect(mockSyncController.clearDragHighlight).toHaveBeenCalled();
    });
  });

  describe('callbacks', () => {
    test('calls onDragComplete after drag ends', () => {
      const onDragComplete = jest.fn();
      const handler = createIntervalNoteDragHandler({
        grid: mockGrid,
        gridEditor: mockGridEditor,
        getPairs: () => currentPairs,
        setPairs: (pairs) => { currentPairs = pairs; },
        getTotalPulses: () => 8,
        onDragComplete
      });

      handler.attach();

      const dot = matrixContainer.querySelector('[data-row-id="5r4"][data-col-index="2"] .np-dot');

      dot.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: 100
      }));

      document.dispatchEvent(new MouseEvent('mouseup'));

      expect(onDragComplete).toHaveBeenCalledWith(
        expect.any(Array),
        'create'
      );

      handler.destroy();
    });

    test('calls playNotePreview after drag ends', () => {
      const playNotePreview = jest.fn();
      const handler = createIntervalNoteDragHandler({
        grid: mockGrid,
        gridEditor: mockGridEditor,
        getPairs: () => currentPairs,
        setPairs: (pairs) => { currentPairs = pairs; },
        getTotalPulses: () => 8,
        playNotePreview
      });

      handler.attach();

      const dot = matrixContainer.querySelector('[data-row-id="5r4"][data-col-index="2"] .np-dot');

      dot.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: 100
      }));

      document.dispatchEvent(new MouseEvent('mouseup'));

      expect(playNotePreview).toHaveBeenCalledWith(5, 4, 1);

      handler.destroy();
    });
  });

  describe('fillGapsWithSilences integration', () => {
    test('uses fillGapsWithSilences when provided', () => {
      const fillGaps = jest.fn(pairs => [...pairs, { isRest: true, pulse: 10 }]);
      const handler = createIntervalNoteDragHandler({
        grid: mockGrid,
        gridEditor: mockGridEditor,
        getPairs: () => currentPairs,
        setPairs: (pairs) => { currentPairs = pairs; },
        getTotalPulses: () => 8,
        fillGapsWithSilences: fillGaps
      });

      handler.attach();

      const dot = matrixContainer.querySelector('[data-row-id="5r4"][data-col-index="2"] .np-dot');

      dot.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: 100
      }));

      document.dispatchEvent(new MouseEvent('mouseup'));

      expect(fillGaps).toHaveBeenCalled();
      expect(mockGridEditor.setPairs).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ isRest: true })
        ])
      );

      handler.destroy();
    });
  });

  describe('without syncController (fallback)', () => {
    let handlerNoSync;

    beforeEach(() => {
      handlerNoSync = createIntervalNoteDragHandler({
        grid: mockGrid,
        gridEditor: mockGridEditor,
        getPairs: () => currentPairs,
        setPairs: (pairs) => { currentPairs = pairs; },
        getTotalPulses: () => 8
        // No syncController
      });
      handlerNoSync.attach();
    });

    afterEach(() => {
      handlerNoSync.destroy();
    });

    test('adds drag-highlight class directly to cells', () => {
      const dot = matrixContainer.querySelector('[data-row-id="5r4"][data-col-index="2"] .np-dot');

      dot.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: 100
      }));

      const highlightedCells = matrixContainer.querySelectorAll('.drag-highlight');
      expect(highlightedCells.length).toBeGreaterThan(0);
    });

    test('removes drag-highlight on drag end', () => {
      const dot = matrixContainer.querySelector('[data-row-id="5r4"][data-col-index="2"] .np-dot');

      dot.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: 100
      }));

      document.dispatchEvent(new MouseEvent('mouseup'));

      const highlightedCells = matrixContainer.querySelectorAll('.drag-highlight');
      expect(highlightedCells.length).toBe(0);
    });
  });
});
