/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { createGrid2DSyncController } from '../grid-2d-sync-controller.js';

describe('grid-2d-sync-controller', () => {
  let mockGrid;
  let mockGridEditor;
  let currentPairs;
  let syncController;
  let matrixContainer;

  beforeEach(() => {
    // Setup DOM
    matrixContainer = document.createElement('div');
    matrixContainer.className = 'matrix-container';

    // Create mock cells
    for (let row = 0; row < 12; row++) {
      for (let col = 0; col < 8; col++) {
        const cell = document.createElement('div');
        cell.className = 'plano-cell';
        cell.dataset.rowId = `${row}r4`;
        cell.dataset.colIndex = col;
        matrixContainer.appendChild(cell);
      }
    }

    // Mock grid
    mockGrid = {
      getElements: () => ({ matrixContainer }),
      loadSelection: jest.fn(),
      clearSelection: jest.fn(),
      getSelectedArray: jest.fn(() => [])
    };

    // Mock grid editor
    mockGridEditor = {
      getPairs: jest.fn(() => [...currentPairs]),
      setPairs: jest.fn((pairs) => { currentPairs = pairs; }),
      clear: jest.fn()
    };

    currentPairs = [];

    syncController = createGrid2DSyncController({
      grid: mockGrid,
      gridEditor: mockGridEditor,
      getPairs: () => currentPairs,
      setPairs: (pairs) => { currentPairs = pairs; },
      config: {
        defaultRegistry: 4,
        validateNoteRegistry: (note, registry) => {
          if (registry === 2 && note < 7) return { valid: false, message: 'r2: notas 7-11' };
          if (registry === 5 && note > 7) return { valid: false, message: 'r5: notas 0-7' };
          return { valid: true };
        }
      }
    });
  });

  afterEach(() => {
    syncController?.destroy();
  });

  describe('createGrid2DSyncController', () => {
    test('creates controller with all API methods', () => {
      expect(syncController).toBeDefined();
      expect(typeof syncController.syncGridFromPairs).toBe('function');
      expect(typeof syncController.handleCellClick).toBe('function');
      expect(typeof syncController.highlightSingleCell).toBe('function');
      expect(typeof syncController.clearDurationHighlights).toBe('function');
      expect(typeof syncController.highlightDragRange).toBe('function');
      expect(typeof syncController.clearDragHighlight).toBe('function');
      expect(typeof syncController.enableDragMode).toBe('function');
      expect(typeof syncController.addDotsToAllCells).toBe('function');
      expect(typeof syncController.removeDotsFromAllCells).toBe('function');
      expect(typeof syncController.refreshDots).toBe('function');
      expect(typeof syncController.destroy).toBe('function');
    });

    test('handles missing grid gracefully', () => {
      const controller = createGrid2DSyncController({
        grid: null,
        gridEditor: mockGridEditor,
        getPairs: () => [],
        setPairs: () => {}
      });

      // Should not throw
      expect(() => controller.syncGridFromPairs([])).not.toThrow();
      expect(() => controller.addDotsToAllCells()).not.toThrow();
    });
  });

  describe('parseRowId', () => {
    test('parses valid rowId format', () => {
      expect(syncController.parseRowId('5r4')).toEqual({ note: 5, registry: 4 });
      expect(syncController.parseRowId('0r3')).toEqual({ note: 0, registry: 3 });
      expect(syncController.parseRowId('11r5')).toEqual({ note: 11, registry: 5 });
    });

    test('returns null for invalid format', () => {
      expect(syncController.parseRowId('invalid')).toBeNull();
      expect(syncController.parseRowId('')).toBeNull();
      expect(syncController.parseRowId(null)).toBeNull();
      expect(syncController.parseRowId('5-4')).toBeNull();
    });
  });

  describe('buildRowId', () => {
    test('builds correct rowId format', () => {
      expect(syncController.buildRowId(5, 4)).toBe('5r4');
      expect(syncController.buildRowId(0, 3)).toBe('0r3');
      expect(syncController.buildRowId(11, 5)).toBe('11r5');
    });
  });

  describe('syncGridFromPairs', () => {
    test('calls loadSelection with correct keys', () => {
      const pairs = [
        { note: 5, pulse: 0, temporalInterval: 1, registry: 4 },
        { note: 7, pulse: 2, temporalInterval: 2, registry: 4 }
      ];

      syncController.syncGridFromPairs(pairs);

      expect(mockGrid.loadSelection).toHaveBeenCalledWith(['5r4-0', '7r4-2']);
    });

    test('updates internal pairs state', () => {
      const pairs = [
        { note: 3, pulse: 1, temporalInterval: 1, registry: 4 }
      ];

      syncController.syncGridFromPairs(pairs);

      expect(currentPairs).toEqual(pairs);
    });

    test('skips silences (isRest)', () => {
      const pairs = [
        { note: 5, pulse: 0, temporalInterval: 1, registry: 4 },
        { note: null, pulse: 1, temporalInterval: 1, isRest: true }
      ];

      syncController.syncGridFromPairs(pairs);

      expect(mockGrid.loadSelection).toHaveBeenCalledWith(['5r4-0']);
    });

    test('uses default registry when not specified', () => {
      const pairs = [
        { note: 5, pulse: 0, temporalInterval: 1 }  // No registry
      ];

      syncController.syncGridFromPairs(pairs);

      expect(mockGrid.loadSelection).toHaveBeenCalledWith(['5r4-0']);  // Uses default 4
    });

    test('calls onSyncComplete callback', (done) => {
      const onSyncComplete = jest.fn();
      const controller = createGrid2DSyncController({
        grid: mockGrid,
        gridEditor: mockGridEditor,
        getPairs: () => currentPairs,
        setPairs: (p) => { currentPairs = p; },
        onSyncComplete
      });

      const pairs = [{ note: 5, pulse: 0, temporalInterval: 1, registry: 4 }];
      controller.syncGridFromPairs(pairs);

      // Wait for requestAnimationFrame
      requestAnimationFrame(() => {
        expect(onSyncComplete).toHaveBeenCalledWith(pairs);
        done();
      });
    });
  });

  describe('highlightSingleCell', () => {
    test('adds duration-highlight class to cell', () => {
      syncController.highlightSingleCell('5r4', 3);

      const cell = matrixContainer.querySelector('[data-row-id="5r4"][data-col-index="3"]');
      expect(cell.classList.contains('duration-highlight')).toBe(true);
    });

    test('handles non-existent cell gracefully', () => {
      expect(() => syncController.highlightSingleCell('99r9', 99)).not.toThrow();
    });
  });

  describe('clearDurationHighlights', () => {
    test('removes duration-highlight from all cells', () => {
      // Add highlights to multiple cells
      syncController.highlightSingleCell('5r4', 0);
      syncController.highlightSingleCell('5r4', 1);
      syncController.highlightSingleCell('5r4', 2);

      expect(matrixContainer.querySelectorAll('.duration-highlight').length).toBe(3);

      syncController.clearDurationHighlights();

      expect(matrixContainer.querySelectorAll('.duration-highlight').length).toBe(0);
    });
  });

  describe('drag highlight', () => {
    test('highlightDragRange highlights range of cells', () => {
      syncController.highlightDragRange('5r4', 1, 4);

      const highlighted = matrixContainer.querySelectorAll('.drag-highlight');
      expect(highlighted.length).toBe(4);

      // Verify correct cells
      for (let i = 1; i <= 4; i++) {
        const cell = matrixContainer.querySelector(`[data-row-id="5r4"][data-col-index="${i}"]`);
        expect(cell.classList.contains('drag-highlight')).toBe(true);
      }
    });

    test('clearDragHighlight removes all drag highlights', () => {
      syncController.highlightDragRange('5r4', 0, 5);
      expect(matrixContainer.querySelectorAll('.drag-highlight').length).toBe(6);

      syncController.clearDragHighlight();
      expect(matrixContainer.querySelectorAll('.drag-highlight').length).toBe(0);
    });

    test('highlightDragRange clears previous highlights first', () => {
      syncController.highlightDragRange('5r4', 0, 2);
      syncController.highlightDragRange('7r4', 3, 5);

      // Should only have new highlights
      const highlighted = matrixContainer.querySelectorAll('.drag-highlight');
      expect(highlighted.length).toBe(3);

      // Old range should not be highlighted
      const oldCell = matrixContainer.querySelector('[data-row-id="5r4"][data-col-index="0"]');
      expect(oldCell.classList.contains('drag-highlight')).toBe(false);
    });
  });

  describe('dot management', () => {
    test('enableDragMode(true) adds dots to all cells', () => {
      expect(matrixContainer.querySelectorAll('.np-dot').length).toBe(0);

      syncController.enableDragMode(true);

      const dots = matrixContainer.querySelectorAll('.np-dot');
      expect(dots.length).toBe(96);  // 12 rows × 8 cols
    });

    test('enableDragMode(false) removes all dots', () => {
      syncController.enableDragMode(true);
      expect(matrixContainer.querySelectorAll('.np-dot').length).toBe(96);

      syncController.enableDragMode(false);
      expect(matrixContainer.querySelectorAll('.np-dot').length).toBe(0);
    });

    test('addDotsToAllCells does not duplicate dots', () => {
      syncController.addDotsToAllCells();
      syncController.addDotsToAllCells();

      // Should still be one dot per cell
      const cells = matrixContainer.querySelectorAll('.plano-cell');
      cells.forEach(cell => {
        expect(cell.querySelectorAll('.np-dot').length).toBe(1);
      });
    });

    test('dots have correct data attributes', () => {
      syncController.addDotsToAllCells();

      const cell = matrixContainer.querySelector('[data-row-id="5r4"][data-col-index="3"]');
      const dot = cell.querySelector('.np-dot');

      expect(dot.dataset.rowId).toBe('5r4');
      expect(dot.dataset.colIndex).toBe('3');
      expect(dot.classList.contains('np-dot-clickable')).toBe(true);
    });

    test('refreshDots restores dots after grid update', (done) => {
      syncController.enableDragMode(true);

      // Simulate grid refresh (removes dots)
      matrixContainer.querySelectorAll('.np-dot').forEach(d => d.remove());
      expect(matrixContainer.querySelectorAll('.np-dot').length).toBe(0);

      syncController.refreshDots();

      requestAnimationFrame(() => {
        expect(matrixContainer.querySelectorAll('.np-dot').length).toBe(96);
        done();
      });
    });

    test('refreshDots does nothing when drag mode disabled', (done) => {
      syncController.enableDragMode(false);
      syncController.refreshDots();

      requestAnimationFrame(() => {
        expect(matrixContainer.querySelectorAll('.np-dot').length).toBe(0);
        done();
      });
    });
  });

  describe('handleCellClick', () => {
    beforeEach(() => {
      currentPairs = [];
    });

    test('adds new pair when cell selected', async () => {
      await syncController.handleCellClick(
        { id: '5r4', midi: 65 },
        0,
        true
      );

      expect(mockGridEditor.setPairs).toHaveBeenCalled();
      const setPairsCalls = mockGridEditor.setPairs.mock.calls;
      const lastCall = setPairsCalls[setPairsCalls.length - 1][0];
      expect(lastCall).toContainEqual(expect.objectContaining({
        note: 5,
        registry: 4,
        pulse: 0
      }));
    });

    test('removes pair when cell deselected', async () => {
      currentPairs = [
        { note: 5, pulse: 0, temporalInterval: 1, registry: 4 },
        { note: 7, pulse: 2, temporalInterval: 1, registry: 4 }
      ];
      mockGridEditor.getPairs.mockReturnValue([...currentPairs]);

      await syncController.handleCellClick(
        { id: '5r4', midi: 65 },
        0,
        false  // Deselected
      );

      expect(mockGridEditor.setPairs).toHaveBeenCalled();
      const lastCall = mockGridEditor.setPairs.mock.calls.slice(-1)[0][0];
      expect(lastCall.filter(p => !p.isRest)).not.toContainEqual(
        expect.objectContaining({ note: 5, pulse: 0 })
      );
    });

    test('calls playNotePreview when provided', async () => {
      const playPreview = jest.fn();
      const controller = createGrid2DSyncController({
        grid: mockGrid,
        gridEditor: mockGridEditor,
        getPairs: () => currentPairs,
        setPairs: (p) => { currentPairs = p; },
        playNotePreview: playPreview
      });

      await controller.handleCellClick(
        { id: '5r4', midi: 65 },
        0,
        true
      );

      expect(playPreview).toHaveBeenCalledWith(65, 0.3);
    });

    test('uses custom onCellClick handler when provided', async () => {
      const customHandler = jest.fn();
      const controller = createGrid2DSyncController({
        grid: mockGrid,
        gridEditor: mockGridEditor,
        getPairs: () => currentPairs,
        setPairs: (p) => { currentPairs = p; },
        onCellClick: customHandler
      });

      await controller.handleCellClick(
        { id: '5r4', midi: 65 },
        0,
        true
      );

      expect(customHandler).toHaveBeenCalledWith(
        { id: '5r4', midi: 65 },
        0,
        true
      );
      expect(mockGridEditor.setPairs).not.toHaveBeenCalled();
    });

    test('uses fillGapsWithSilences when provided', async () => {
      const fillGaps = jest.fn(pairs => [...pairs, { isRest: true, pulse: 1 }]);
      const controller = createGrid2DSyncController({
        grid: mockGrid,
        gridEditor: mockGridEditor,
        getPairs: () => currentPairs,
        setPairs: (p) => { currentPairs = p; },
        config: { fillGapsWithSilences: fillGaps }
      });

      await controller.handleCellClick(
        { id: '5r4', midi: 65 },
        0,
        true
      );

      expect(fillGaps).toHaveBeenCalled();
    });

    test('handles invalid rowId gracefully', async () => {
      await expect(
        syncController.handleCellClick(
          { id: 'invalid', midi: 65 },
          0,
          true
        )
      ).resolves.not.toThrow();
    });
  });

  describe('destroy', () => {
    test('cleans up all state', () => {
      // Setup some state
      syncController.enableDragMode(true);
      syncController.highlightSingleCell('5r4', 0);
      syncController.highlightDragRange('7r4', 1, 3);

      expect(matrixContainer.querySelectorAll('.np-dot').length).toBeGreaterThan(0);
      expect(matrixContainer.querySelectorAll('.duration-highlight').length).toBeGreaterThan(0);
      expect(matrixContainer.querySelectorAll('.drag-highlight').length).toBeGreaterThan(0);

      syncController.destroy();

      expect(matrixContainer.querySelectorAll('.np-dot').length).toBe(0);
      expect(matrixContainer.querySelectorAll('.duration-highlight').length).toBe(0);
      expect(matrixContainer.querySelectorAll('.drag-highlight').length).toBe(0);
    });
  });

  describe('getMatrixContainer', () => {
    test('returns matrix container from grid', () => {
      expect(syncController.getMatrixContainer()).toBe(matrixContainer);
    });

    test('returns undefined when grid has no elements', () => {
      const controller = createGrid2DSyncController({
        grid: { getElements: () => null },
        gridEditor: mockGridEditor,
        getPairs: () => [],
        setPairs: () => {}
      });

      expect(controller.getMatrixContainer()).toBeUndefined();
    });
  });
});
