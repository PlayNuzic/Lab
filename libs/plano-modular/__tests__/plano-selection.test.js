/**
 * @jest-environment node
 */

import { createSelectionManager } from '../plano-selection.js';

describe('plano-selection', () => {
  describe('createSelectionManager', () => {
    describe('monophonic mode', () => {
      let manager;

      beforeEach(() => {
        manager = createSelectionManager('monophonic');
      });

      test('should create manager with monophonic mode', () => {
        expect(manager.getMode()).toBe('monophonic');
      });

      test('should select a cell', () => {
        manager.select('row1', 0);
        expect(manager.isSelected('row1', 0)).toBe(true);
        expect(manager.count()).toBe(1);
      });

      test('should deselect existing cell in same column (monophonic)', () => {
        manager.select('row1', 0);
        const deselected = manager.select('row2', 0);

        expect(manager.isSelected('row1', 0)).toBe(false);
        expect(manager.isSelected('row2', 0)).toBe(true);
        expect(deselected).toContain('row1-0');
        expect(manager.count()).toBe(1);
      });

      test('should allow cells in different columns', () => {
        manager.select('row1', 0);
        manager.select('row2', 1);

        expect(manager.isSelected('row1', 0)).toBe(true);
        expect(manager.isSelected('row2', 1)).toBe(true);
        expect(manager.count()).toBe(2);
      });

      test('should deselect a cell', () => {
        manager.select('row1', 0);
        const result = manager.deselect('row1', 0);

        expect(result).toBe(true);
        expect(manager.isSelected('row1', 0)).toBe(false);
        expect(manager.count()).toBe(0);
      });

      test('should return false when deselecting non-existent cell', () => {
        const result = manager.deselect('row1', 0);
        expect(result).toBe(false);
      });

      test('should toggle cell selection', () => {
        // Toggle on
        let result = manager.toggle('row1', 0);
        expect(result.isSelected).toBe(true);
        expect(manager.isSelected('row1', 0)).toBe(true);

        // Toggle off
        result = manager.toggle('row1', 0);
        expect(result.isSelected).toBe(false);
        expect(manager.isSelected('row1', 0)).toBe(false);
      });

      test('toggle should deselect other cells in same column', () => {
        manager.select('row1', 0);
        const result = manager.toggle('row2', 0);

        expect(result.isSelected).toBe(true);
        expect(result.deselected).toContain('row1-0');
        expect(manager.isSelected('row1', 0)).toBe(false);
        expect(manager.isSelected('row2', 0)).toBe(true);
      });

      test('should clear all selections', () => {
        manager.select('row1', 0);
        manager.select('row2', 1);
        manager.select('row3', 2);

        const cleared = manager.clear();

        expect(cleared).toHaveLength(3);
        expect(manager.count()).toBe(0);
      });

      test('should get selection at column', () => {
        manager.select('row1', 0, { note: 5 });

        const selection = manager.getAtColumn(0);

        expect(selection).not.toBeNull();
        expect(selection.rowId).toBe('row1');
        expect(selection.colIndex).toBe(0);
        expect(selection.note).toBe(5);
      });

      test('should return null for empty column', () => {
        const selection = manager.getAtColumn(0);
        expect(selection).toBeNull();
      });
    });

    describe('polyphonic mode', () => {
      let manager;

      beforeEach(() => {
        manager = createSelectionManager('polyphonic');
      });

      test('should create manager with polyphonic mode', () => {
        expect(manager.getMode()).toBe('polyphonic');
      });

      test('should allow multiple cells in same column', () => {
        manager.select('row1', 0);
        const deselected = manager.select('row2', 0);

        expect(manager.isSelected('row1', 0)).toBe(true);
        expect(manager.isSelected('row2', 0)).toBe(true);
        expect(deselected).toHaveLength(0);
        expect(manager.count()).toBe(2);
      });

      test('should allow unlimited selections', () => {
        for (let i = 0; i < 10; i++) {
          manager.select(`row${i}`, i % 3);
        }
        expect(manager.count()).toBe(10);
      });
    });

    describe('none mode', () => {
      let manager;

      beforeEach(() => {
        manager = createSelectionManager('none');
      });

      test('should not select anything in none mode', () => {
        manager.select('row1', 0);
        expect(manager.isSelected('row1', 0)).toBe(false);
        expect(manager.count()).toBe(0);
      });
    });

    describe('getSelected', () => {
      test('should return Map of selections', () => {
        const manager = createSelectionManager('monophonic');
        manager.select('row1', 0);
        manager.select('row2', 1);

        const selected = manager.getSelected();

        expect(selected instanceof Map).toBe(true);
        expect(selected.size).toBe(2);
        expect(selected.has('row1-0')).toBe(true);
        expect(selected.has('row2-1')).toBe(true);
      });

      test('should return a copy (not modify original)', () => {
        const manager = createSelectionManager('monophonic');
        manager.select('row1', 0);

        const selected = manager.getSelected();
        selected.delete('row1-0');

        expect(manager.isSelected('row1', 0)).toBe(true);
      });
    });

    describe('getSelectedArray', () => {
      test('should return array of selection data', () => {
        const manager = createSelectionManager('monophonic');
        manager.select('row1', 0, { note: 5 });
        manager.select('row2', 1, { note: 7 });

        const arr = manager.getSelectedArray();

        expect(Array.isArray(arr)).toBe(true);
        expect(arr).toHaveLength(2);
        expect(arr.some(s => s.rowId === 'row1' && s.colIndex === 0)).toBe(true);
        expect(arr.some(s => s.rowId === 'row2' && s.colIndex === 1)).toBe(true);
      });
    });

    describe('exportKeys / loadFromKeys', () => {
      test('should export keys as array', () => {
        const manager = createSelectionManager('monophonic');
        manager.select('row1', 0);
        manager.select('row2', 1);

        const keys = manager.exportKeys();

        expect(keys).toContain('row1-0');
        expect(keys).toContain('row2-1');
      });

      test('should load from keys', () => {
        const manager = createSelectionManager('polyphonic');
        manager.loadFromKeys(['row1-0', 'row2-1', '3-5-2']);

        expect(manager.isSelected('row1', 0)).toBe(true);
        expect(manager.isSelected('row2', 1)).toBe(true);
        expect(manager.isSelected('3-5', 2)).toBe(true);
        expect(manager.count()).toBe(3);
      });

      test('should clear existing selections when loading', () => {
        const manager = createSelectionManager('polyphonic');
        manager.select('old', 0);
        manager.loadFromKeys(['new-0']);

        expect(manager.isSelected('old', 0)).toBe(false);
        expect(manager.isSelected('new', 0)).toBe(true);
      });
    });

    describe('getKey', () => {
      test('should generate consistent keys', () => {
        const manager = createSelectionManager('monophonic');

        expect(manager.getKey('row1', 0)).toBe('row1-0');
        expect(manager.getKey('5-3', 2)).toBe('5-3-2');
      });
    });
  });
});
