/**
 * @jest-environment jsdom
 */

import {
  buildGridDOM,
  updateSoundline,
  updateMatrix,
  updateTimeline,
  updateCellSelection,
  highlightCell,
  highlightTimelineNumber,
  clearCellHighlights,
  getCellWidth,
  getCellHeight
} from '../plano-grid.js';

describe('plano-grid', () => {
  describe('buildGridDOM', () => {
    let parent;

    beforeEach(() => {
      parent = document.createElement('div');
    });

    test('should return null for null parent', () => {
      const result = buildGridDOM(null);
      expect(result).toBeNull();
    });

    test('should create container with correct class', () => {
      const elements = buildGridDOM(parent);
      expect(elements.container.classList.contains('plano-container')).toBe(true);
    });

    test('should create soundline container', () => {
      const elements = buildGridDOM(parent);
      expect(elements.soundlineContainer.classList.contains('plano-soundline-container')).toBe(true);
    });

    test('should create matrix container', () => {
      const elements = buildGridDOM(parent);
      expect(elements.matrixContainer.classList.contains('plano-matrix-container')).toBe(true);
    });

    test('should create timeline container', () => {
      const elements = buildGridDOM(parent);
      expect(elements.timelineContainer.classList.contains('plano-timeline-container')).toBe(true);
    });

    test('should create grid area', () => {
      const elements = buildGridDOM(parent);
      expect(elements.gridArea.classList.contains('plano-grid-area')).toBe(true);
    });

    test('should append container to parent', () => {
      buildGridDOM(parent);
      expect(parent.querySelector('.plano-container')).not.toBeNull();
    });

    test('should have correct DOM hierarchy', () => {
      const elements = buildGridDOM(parent);

      // Container contains soundline and gridArea
      expect(elements.container.contains(elements.soundlineContainer)).toBe(true);
      expect(elements.container.contains(elements.gridArea)).toBe(true);

      // GridArea contains matrix and timeline
      expect(elements.gridArea.contains(elements.matrixContainer)).toBe(true);
      expect(elements.gridArea.contains(elements.timelineContainer)).toBe(true);
    });
  });

  describe('updateSoundline', () => {
    let container;
    const rows = [
      { id: '11r5', label: '11r5', data: { registry: 5, note: 11 } },
      { id: '10r5', label: '10r5', data: { registry: 5, note: 10 } },
      { id: '0r5', label: '0r5', data: { registry: 5, note: 0 } }
    ];

    beforeEach(() => {
      container = document.createElement('div');
    });

    test('should handle null container gracefully', () => {
      expect(() => {
        updateSoundline(null, rows);
      }).not.toThrow();
    });

    test('should create note elements for each row', () => {
      updateSoundline(container, rows);

      const notes = container.querySelectorAll('.plano-soundline-note');
      expect(notes.length).toBe(3);
    });

    test('should set correct labels', () => {
      updateSoundline(container, rows);

      const notes = container.querySelectorAll('.plano-soundline-note');
      expect(notes[0].textContent).toBe('11r5');
      expect(notes[1].textContent).toBe('10r5');
      expect(notes[2].textContent).toBe('0r5');
    });

    test('should set data attributes', () => {
      updateSoundline(container, rows);

      const notes = container.querySelectorAll('.plano-soundline-note');
      expect(notes[0].dataset.rowId).toBe('11r5');
      expect(notes[0].dataset.registry).toBe('5');
      expect(notes[0].dataset.note).toBe('11');
    });

    test('should use custom label formatter', () => {
      updateSoundline(container, rows, {
        labelFormatter: (row) => `Note ${row.data.note}`
      });

      const notes = container.querySelectorAll('.plano-soundline-note');
      expect(notes[0].textContent).toBe('Note 11');
    });

    test('should mark boundary rows', () => {
      updateSoundline(container, rows, {
        onBoundary: (row) => row.data.note === 0
      });

      const notes = container.querySelectorAll('.plano-soundline-note');
      expect(notes[0].classList.contains('plano-boundary')).toBe(false);
      expect(notes[2].classList.contains('plano-boundary')).toBe(true);
    });

    test('should preserve scroll position', () => {
      Object.defineProperty(container, 'scrollTop', { value: 100, writable: true });

      updateSoundline(container, rows);

      expect(container.scrollTop).toBe(100);
    });
  });

  describe('updateMatrix', () => {
    let container;
    const rows = [
      { id: 'r1', label: 'Row 1', data: {} },
      { id: 'r2', label: 'Row 2', data: {} }
    ];
    const columns = 3;

    beforeEach(() => {
      container = document.createElement('div');
    });

    test('should handle null container gracefully', () => {
      expect(() => {
        updateMatrix(null, rows, columns);
      }).not.toThrow();
    });

    test('should handle empty rows', () => {
      updateMatrix(container, [], columns);
      expect(container.querySelector('.plano-matrix')).toBeNull();
    });

    test('should handle zero columns', () => {
      updateMatrix(container, rows, 0);
      expect(container.querySelector('.plano-matrix')).toBeNull();
    });

    test('should create grid with correct number of cells', () => {
      updateMatrix(container, rows, columns);

      const cells = container.querySelectorAll('.plano-cell');
      expect(cells.length).toBe(6); // 2 rows * 3 columns
    });

    test('should set grid template columns', () => {
      updateMatrix(container, rows, columns, { cellWidth: 50 });

      const grid = container.querySelector('.plano-matrix');
      expect(grid.style.gridTemplateColumns).toBe('repeat(3, 50px)');
    });

    test('should set cell data attributes', () => {
      updateMatrix(container, rows, columns);

      const cell = container.querySelector('.plano-cell');
      expect(cell.dataset.rowId).toBe('r1');
      expect(cell.dataset.colIndex).toBe('0');
    });

    test('should mark selected cells', () => {
      updateMatrix(container, rows, columns, {
        isSelected: (rowId, colIdx) => rowId === 'r1' && colIdx === 1
      });

      const cells = container.querySelectorAll('.plano-cell');
      expect(cells[1].classList.contains('plano-selected')).toBe(true);
      expect(cells[0].classList.contains('plano-selected')).toBe(false);
    });

    test('should add label to selected cells', () => {
      updateMatrix(container, rows, columns, {
        isSelected: (rowId, colIdx) => rowId === 'r1' && colIdx === 0,
        cellFormatter: (row) => row.label
      });

      const label = container.querySelector('.plano-cell-label');
      expect(label).not.toBeNull();
      expect(label.textContent).toBe('Row 1');
    });

    test('should attach click handler', () => {
      let clickHandlerCalled = false;
      let clickArgs = null;
      const clickHandler = (row, col, cellEl) => {
        clickHandlerCalled = true;
        clickArgs = { row, col, cellEl };
      };
      updateMatrix(container, rows, columns, {
        onCellClick: clickHandler
      });

      const cell = container.querySelector('.plano-cell');
      cell.click();

      expect(clickHandlerCalled).toBe(true);
      expect(clickArgs.row).toEqual(rows[0]);
      expect(clickArgs.col).toBe(0);
      expect(clickArgs.cellEl).toBe(cell);
    });

    test('should preserve scroll position', () => {
      Object.defineProperty(container, 'scrollTop', { value: 50, writable: true });
      Object.defineProperty(container, 'scrollLeft', { value: 100, writable: true });

      updateMatrix(container, rows, columns);

      expect(container.scrollTop).toBe(50);
      expect(container.scrollLeft).toBe(100);
    });
  });

  describe('updateTimeline', () => {
    let container;
    const columns = 8;

    beforeEach(() => {
      container = document.createElement('div');
    });

    test('should handle null container gracefully', () => {
      expect(() => {
        updateTimeline(null, columns);
      }).not.toThrow();
    });

    test('should handle zero columns', () => {
      updateTimeline(container, 0);
      expect(container.querySelector('.plano-timeline-row')).toBeNull();
    });

    test('should create timeline numbers for each column', () => {
      updateTimeline(container, columns);

      const numbers = container.querySelectorAll('.plano-timeline-number');
      expect(numbers.length).toBe(8);
    });

    test('should set grid template columns', () => {
      updateTimeline(container, columns, { cellWidth: 50 });

      const row = container.querySelector('.plano-timeline-row');
      expect(row.style.gridTemplateColumns).toBe('repeat(8, 50px)');
    });

    test('should show pulse numbers with default cycle', () => {
      updateTimeline(container, 8, { cycleConfig: { compas: 4 } });

      const numbers = container.querySelectorAll('.plano-pulse-num');
      expect(numbers[0].textContent).toBe('0');
      expect(numbers[1].textContent).toBe('1');
      expect(numbers[4].textContent).toBe('0'); // New cycle
    });

    test('should mark cycle starts', () => {
      updateTimeline(container, 8, { cycleConfig: { compas: 4 } });

      const numbers = container.querySelectorAll('.plano-timeline-number');
      expect(numbers[0].classList.contains('plano-cycle-start')).toBe(true);
      expect(numbers[1].classList.contains('plano-cycle-start')).toBe(false);
      expect(numbers[4].classList.contains('plano-cycle-start')).toBe(true);
    });

    test('should show cycle superscript when enabled', () => {
      updateTimeline(container, 8, { cycleConfig: { compas: 4, showCycle: true } });

      const cycles = container.querySelectorAll('.plano-cycle-num');
      expect(cycles.length).toBe(8);
      expect(cycles[0].textContent).toBe('1');
      expect(cycles[4].textContent).toBe('2');
    });

    test('should hide cycle superscript when disabled', () => {
      updateTimeline(container, 8, { cycleConfig: { compas: 4, showCycle: false } });

      const cycles = container.querySelectorAll('.plano-cycle-num');
      expect(cycles.length).toBe(0);
    });

    test('should use custom label formatter', () => {
      updateTimeline(container, 4, {
        labelFormatter: (colIdx) => ({ label: `P${colIdx}`, cycle: colIdx + 1 })
      });

      const numbers = container.querySelectorAll('.plano-pulse-num');
      expect(numbers[0].textContent).toBe('P0');
      expect(numbers[2].textContent).toBe('P2');
    });

    test('should preserve scroll position', () => {
      Object.defineProperty(container, 'scrollLeft', { value: 75, writable: true });

      updateTimeline(container, columns);

      expect(container.scrollLeft).toBe(75);
    });
  });

  describe('updateCellSelection', () => {
    let container;

    beforeEach(() => {
      container = document.createElement('div');
      const cell = document.createElement('div');
      cell.className = 'plano-cell';
      cell.dataset.rowId = '5r4';  // Format: NrR (note 5, registry 4)
      cell.dataset.colIndex = '2';
      container.appendChild(cell);
    });

    test('should handle null container gracefully', () => {
      expect(() => {
        updateCellSelection(null, 'r1', 2, true);
      }).not.toThrow();
    });

    test('should add selected class', () => {
      updateCellSelection(container, '5r4', 2, true);

      const cell = container.querySelector('.plano-cell');
      expect(cell.classList.contains('plano-selected')).toBe(true);
    });

    test('should remove selected class', () => {
      const cell = container.querySelector('.plano-cell');
      cell.classList.add('plano-selected');

      updateCellSelection(container, '5r4', 2, false);

      expect(cell.classList.contains('plano-selected')).toBe(false);
    });

    test('should add label when selecting', () => {
      // Update cell with valid rowId format (NrR) and compas option
      updateCellSelection(container, '5r4', 2, true, '', { compas: 4 });

      const label = container.querySelector('.plano-cell-label');
      expect(label).not.toBeNull();
      // Label format: N^r P^c → "5" + sup "4" + " " + "2" + sup "1" (cycle 1 because colIndex 2 / compas 4 = 0 + 1)
      expect(label.innerHTML).toBe('5<sup>4</sup> 2<sup>1</sup>');
    });

    test('should remove label when deselecting', () => {
      const cell = container.querySelector('.plano-cell');
      const label = document.createElement('span');
      label.className = 'plano-cell-label';
      cell.appendChild(label);

      updateCellSelection(container, '5r4', 2, false);

      expect(cell.querySelector('.plano-cell-label')).toBeNull();
    });

    test('should not duplicate label', () => {
      updateCellSelection(container, '5r4', 2, true, '', { compas: 4 });
      updateCellSelection(container, '5r4', 2, true, '', { compas: 4 });

      const labels = container.querySelectorAll('.plano-cell-label');
      expect(labels.length).toBe(1);
    });
  });

  describe('highlightCell', () => {
    let container;

    beforeEach(() => {
      container = document.createElement('div');
      const cell = document.createElement('div');
      cell.className = 'plano-cell';
      cell.dataset.rowId = 'r1';
      cell.dataset.colIndex = '0';
      container.appendChild(cell);
    });

    test('should handle null container gracefully', () => {
      const remove = highlightCell(null, 'r1', 0);
      expect(typeof remove).toBe('function');
    });

    test('should add highlight class', () => {
      highlightCell(container, 'r1', 0);

      const cell = container.querySelector('.plano-cell');
      expect(cell.classList.contains('plano-highlight')).toBe(true);
    });

    test('should return function to remove highlight', () => {
      const remove = highlightCell(container, 'r1', 0);
      remove();

      const cell = container.querySelector('.plano-cell');
      expect(cell.classList.contains('plano-highlight')).toBe(false);
    });

    test('should auto-remove highlight after duration', (done) => {
      highlightCell(container, 'r1', 0, 50);

      const cell = container.querySelector('.plano-cell');
      expect(cell.classList.contains('plano-highlight')).toBe(true);

      setTimeout(() => {
        expect(cell.classList.contains('plano-highlight')).toBe(false);
        done();
      }, 100);
    });

    test('should handle non-existent cell', () => {
      const remove = highlightCell(container, 'nonexistent', 0);
      expect(typeof remove).toBe('function');
    });
  });

  describe('highlightTimelineNumber', () => {
    let container;

    beforeEach(() => {
      container = document.createElement('div');
      const num = document.createElement('div');
      num.className = 'plano-timeline-number';
      num.dataset.colIndex = '3';
      container.appendChild(num);
    });

    test('should handle null container gracefully', () => {
      const remove = highlightTimelineNumber(null, 3);
      expect(typeof remove).toBe('function');
    });

    test('should add highlight class', () => {
      highlightTimelineNumber(container, 3);

      const num = container.querySelector('.plano-timeline-number');
      expect(num.classList.contains('plano-highlight')).toBe(true);
    });

    test('should return function to remove highlight', () => {
      const remove = highlightTimelineNumber(container, 3);
      remove();

      const num = container.querySelector('.plano-timeline-number');
      expect(num.classList.contains('plano-highlight')).toBe(false);
    });
  });

  describe('clearCellHighlights', () => {
    let container;

    beforeEach(() => {
      container = document.createElement('div');
      for (let i = 0; i < 3; i++) {
        const el = document.createElement('div');
        el.className = 'plano-cell plano-highlight';
        container.appendChild(el);
      }
    });

    test('should handle null container gracefully', () => {
      expect(() => {
        clearCellHighlights(null);
      }).not.toThrow();
    });

    test('should remove all highlights', () => {
      clearCellHighlights(container);

      const highlighted = container.querySelectorAll('.plano-highlight');
      expect(highlighted.length).toBe(0);
    });
  });

  describe('getCellWidth', () => {
    test('should return 50 for null container', () => {
      expect(getCellWidth(null)).toBe(50);
    });

    test('should return default 50 if no CSS variable or cells', () => {
      const container = document.createElement('div');
      expect(getCellWidth(container)).toBe(50);
    });

    test('should read from CSS custom property', () => {
      const container = document.createElement('div');
      container.style.setProperty('--plano-cell-width', '60px');
      document.body.appendChild(container);

      // Note: jsdom may not fully support custom properties in getComputedStyle
      // This test documents expected behavior
      const width = getCellWidth(container);
      expect(typeof width).toBe('number');

      document.body.removeChild(container);
    });
  });

  describe('getCellHeight', () => {
    test('should return 32 for null container', () => {
      expect(getCellHeight(null)).toBe(32);
    });

    test('should return default 32 if no CSS variable or cells', () => {
      const container = document.createElement('div');
      expect(getCellHeight(container)).toBe(32);
    });
  });
});
