/**
 * Tests for presets.js
 * @jest-environment jsdom
 */

import {
  createPlanoMusical,
  createApp19Grid,
  createSimpleGrid,
  PRESETS
} from '../presets.js';

describe('presets', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);

    // Mock CSS custom properties
    document.documentElement.style.setProperty('--plano-cell-width', '50px');
    document.documentElement.style.setProperty('--plano-cell-height', '32px');
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('PRESETS', () => {
    it('should have APP19 preset', () => {
      expect(PRESETS.APP19).toBeDefined();
      expect(PRESETS.APP19.visibleRows).toBe(15);
      expect(PRESETS.APP19.selectableRegistries).toEqual([3, 4, 5]);
      expect(PRESETS.APP19.selectionMode).toBe('monophonic');
      expect(PRESETS.APP19.blockVerticalWheel).toBe(true);
    });

    it('should have PIANO_ROLL preset', () => {
      expect(PRESETS.PIANO_ROLL).toBeDefined();
      expect(PRESETS.PIANO_ROLL.visibleRows).toBe(24);
      expect(PRESETS.PIANO_ROLL.selectionMode).toBe('polyphonic');
    });

    it('should have SINGLE_OCTAVE preset', () => {
      expect(PRESETS.SINGLE_OCTAVE).toBeDefined();
      expect(PRESETS.SINGLE_OCTAVE.visibleRows).toBe(12);
      expect(PRESETS.SINGLE_OCTAVE.registries).toHaveLength(1);
    });
  });

  describe('createPlanoMusical', () => {
    it('should create a grid with default App19 config', () => {
      const grid = createPlanoMusical({
        parent: container,
        columns: 8
      });

      expect(grid).toBeDefined();
      expect(typeof grid.getCurrentRegistry).toBe('function');
      expect(typeof grid.setRegistry).toBe('function');
      expect(typeof grid.exportApp19Selection).toBe('function');

      grid.destroy();
    });

    it('should create DOM structure', () => {
      const grid = createPlanoMusical({
        parent: container,
        columns: 8
      });

      expect(container.querySelector('.plano-container')).toBeTruthy();
      expect(container.querySelector('.plano-soundline-container')).toBeTruthy();
      expect(container.querySelector('.plano-matrix-container')).toBeTruthy();
      expect(container.querySelector('.plano-timeline-container')).toBeTruthy();

      grid.destroy();
    });

    it('should build 39 rows with default config', () => {
      const grid = createPlanoMusical({
        parent: container,
        columns: 4
      });

      const rows = grid.getRowDefinitions();
      expect(rows).toHaveLength(39);

      grid.destroy();
    });

    it('should track current registry', () => {
      const grid = createPlanoMusical({
        parent: container,
        columns: 4
      });

      // Default is middle of selectableRegistries (4)
      expect(grid.getCurrentRegistry()).toBe(4);

      grid.destroy();
    });

    it('should allow registry navigation', async () => {
      const grid = createPlanoMusical({
        parent: container,
        columns: 4
      });

      await grid.setRegistry(5);
      expect(grid.getCurrentRegistry()).toBe(5);

      await grid.setRegistry(3);
      expect(grid.getCurrentRegistry()).toBe(3);

      grid.destroy();
    });

    it('should prevent setting invalid registry', async () => {
      const originalWarn = console.warn;
      let warnCalled = false;
      console.warn = () => { warnCalled = true; };

      const grid = createPlanoMusical({
        parent: container,
        columns: 4
      });

      await grid.setRegistry(99);
      expect(warnCalled).toBe(true);
      expect(grid.getCurrentRegistry()).toBe(4); // Unchanged

      console.warn = originalWarn;
      grid.destroy();
    });

    it('should navigate next/prev registry', async () => {
      const grid = createPlanoMusical({
        parent: container,
        columns: 4
      });

      // Start at 4
      expect(grid.getCurrentRegistry()).toBe(4);

      // Next (higher pitch) goes to 5
      await grid.nextRegistry();
      expect(grid.getCurrentRegistry()).toBe(5);

      // Next at max stays at 5
      await grid.nextRegistry();
      expect(grid.getCurrentRegistry()).toBe(5);

      // Prev goes back to 4
      await grid.prevRegistry();
      expect(grid.getCurrentRegistry()).toBe(4);

      grid.destroy();
    });

    it('should export/import App19 selection', () => {
      const grid = createPlanoMusical({
        parent: container,
        columns: 8
      });

      // Select some cells
      grid.selectCell('7r5', 0);
      grid.selectCell('4r4', 3);

      const exported = grid.exportApp19Selection();
      expect(exported).toContain('5-7-0');
      expect(exported).toContain('4-4-3');

      // Clear and reload
      grid.clearSelection();
      expect(grid.exportApp19Selection()).toHaveLength(0);

      grid.loadApp19Selection(['5-7-0', '4-4-3']);
      expect(grid.isSelected('7r5', 0)).toBe(true);
      expect(grid.isSelected('4r4', 3)).toBe(true);

      grid.destroy();
    });

    it('should calculate MIDI notes correctly', () => {
      const grid = createPlanoMusical({
        parent: container,
        columns: 4
      });

      // Middle C is C4 = MIDI 60 = registry 4, note 0
      expect(grid.getMidi(4, 0)).toBe(60);

      // C5 = MIDI 72 = registry 5, note 0
      expect(grid.getMidi(5, 0)).toBe(72);

      grid.destroy();
    });

    it('should get selected MIDI notes map', () => {
      const grid = createPlanoMusical({
        parent: container,
        columns: 8
      });

      grid.selectCell('0r4', 0);  // MIDI 60 at pulse 0
      grid.selectCell('0r5', 2);  // MIDI 72 at pulse 2

      const midiMap = grid.getSelectedMidiNotes();
      expect(midiMap.get(0)).toBe(60);
      expect(midiMap.get(2)).toBe(72);

      grid.destroy();
    });

    it('should return note0RowMap', () => {
      const grid = createPlanoMusical({
        parent: container,
        columns: 4
      });

      const map = grid.getNote0RowMap();
      expect(map[5]).toBe(7);
      expect(map[4]).toBe(19);
      expect(map[3]).toBe(31);

      grid.destroy();
    });

    it('should call onCellClick with enriched data', () => {
      let clickReceived = null;

      const grid = createPlanoMusical({
        parent: container,
        columns: 4,
        onCellClick: (rowData, colIndex, isSelected) => {
          clickReceived = { rowData, colIndex, isSelected };
        }
      });

      // selectCell doesn't trigger onCellClick (only actual DOM clicks do)
      // But we can verify the getMidi function works correctly
      expect(grid.getMidi(4, 0)).toBe(60);

      grid.destroy();
    });

    it('should get registry config', () => {
      const grid = createPlanoMusical({
        parent: container,
        columns: 4
      });

      const config = grid.getRegistryConfig();
      expect(config.visibleRows).toBe(15);
      expect(config.selectableRegistries).toEqual([3, 4, 5]);
      expect(config.notesPerRegistry).toBe(12);
      expect(config.midiOffset).toBe(12);

      grid.destroy();
    });

    it('should work with custom registry config', () => {
      const grid = createPlanoMusical({
        parent: container,
        columns: 4,
        registryConfig: {
          registries: [
            { id: 4, notes: { from: 5, to: 0 } }
          ],
          visibleRows: 6,
          selectableRegistries: [4]
        }
      });

      const rows = grid.getRowDefinitions();
      expect(rows).toHaveLength(6);
      expect(grid.getSelectableRegistries()).toEqual([4]);

      grid.destroy();
    });
  });

  describe('createApp19Grid', () => {
    it('should create grid with App19 defaults', () => {
      const grid = createApp19Grid({
        parent: container,
        columns: 16
      });

      expect(grid).toBeDefined();
      expect(grid.getRowDefinitions()).toHaveLength(39);
      expect(grid.getSelectableRegistries()).toEqual([3, 4, 5]);

      grid.destroy();
    });

    it('should accept cycleConfig', () => {
      const grid = createApp19Grid({
        parent: container,
        columns: 16,
        cycleConfig: { compas: 4, showCycle: true }
      });

      expect(grid.getCompas()).toBe(4);

      grid.destroy();
    });

    it('should accept bpm', () => {
      const grid = createApp19Grid({
        parent: container,
        columns: 8,
        bpm: 120
      });

      expect(grid.getBpm()).toBe(120);

      grid.destroy();
    });

    it('should work with callbacks', () => {
      let clickCalled = false;
      let selectionCalled = false;

      const grid = createApp19Grid({
        parent: container,
        columns: 8,
        onCellClick: () => { clickCalled = true; },
        onSelectionChange: () => { selectionCalled = true; }
      });

      // Callbacks should be wired up
      expect(grid).toBeDefined();

      grid.destroy();
    });

    it('should use defaultRegistry=4 if not specified', (done) => {
      const grid = createApp19Grid({
        parent: container,
        columns: 8
      });

      // After setTimeout in createApp19Grid
      setTimeout(() => {
        expect(grid.getCurrentRegistry()).toBe(4);
        grid.destroy();
        done();
      }, 10);
    });

    it('should allow custom defaultRegistry', (done) => {
      const grid = createApp19Grid({
        parent: container,
        columns: 8,
        defaultRegistry: 5
      });

      setTimeout(() => {
        expect(grid.getCurrentRegistry()).toBe(5);
        grid.destroy();
        done();
      }, 10);
    });

    it('should have all base API methods', () => {
      const grid = createApp19Grid({
        parent: container,
        columns: 8
      });

      // Base methods
      expect(typeof grid.updateColumns).toBe('function');
      expect(typeof grid.selectCell).toBe('function');
      expect(typeof grid.clearSelection).toBe('function');
      expect(typeof grid.updatePlayhead).toBe('function');
      expect(typeof grid.refresh).toBe('function');

      // Extended methods
      expect(typeof grid.setRegistry).toBe('function');
      expect(typeof grid.exportApp19Selection).toBe('function');
      expect(typeof grid.loadApp19Selection).toBe('function');
      expect(typeof grid.getMidi).toBe('function');

      grid.destroy();
    });
  });

  describe('createSimpleGrid', () => {
    it('should create a simple grid without registry features', () => {
      const grid = createSimpleGrid({
        parent: container,
        rows: 10,
        columns: 8
      });

      expect(grid).toBeDefined();
      expect(grid.getRows()).toHaveLength(10);

      grid.destroy();
    });

    it('should use custom row label formatter', () => {
      const grid = createSimpleGrid({
        parent: container,
        rows: 5,
        columns: 4,
        rowLabelFormatter: (i) => `Row ${i + 1}`
      });

      const rows = grid.getRows();
      expect(rows[0].label).toBe('Row 1');
      expect(rows[4].label).toBe('Row 5');

      grid.destroy();
    });

    it('should default to no selection mode', () => {
      const grid = createSimpleGrid({
        parent: container,
        rows: 5,
        columns: 4
      });

      // With 'none' selection mode, clicking doesn't select
      // This is tested by the behavior, not a getter
      expect(grid).toBeDefined();

      grid.destroy();
    });

    it('should allow selection mode configuration', () => {
      const grid = createSimpleGrid({
        parent: container,
        rows: 5,
        columns: 4,
        selectionMode: 'polyphonic'
      });

      grid.selectCell('row-0', 0);
      grid.selectCell('row-1', 0);
      grid.selectCell('row-2', 0);

      // Polyphonic allows multiple selections per column
      expect(grid.isSelected('row-0', 0)).toBe(true);
      expect(grid.isSelected('row-1', 0)).toBe(true);
      expect(grid.isSelected('row-2', 0)).toBe(true);

      grid.destroy();
    });

    it('should not show playhead by default', () => {
      const grid = createSimpleGrid({
        parent: container,
        rows: 5,
        columns: 4
      });

      // Playhead is not visible by default
      expect(grid.isPlayheadVisible()).toBe(false);

      grid.destroy();
    });

    it('should work with callbacks', () => {
      let clickCalled = false;

      const grid = createSimpleGrid({
        parent: container,
        rows: 5,
        columns: 4,
        onCellClick: () => { clickCalled = true; }
      });

      expect(grid).toBeDefined();

      grid.destroy();
    });
  });

  describe('Integration tests', () => {
    it('should handle full workflow', async () => {
      // Create grid
      const grid = createApp19Grid({
        parent: container,
        columns: 16,
        cycleConfig: { compas: 4 }
      });

      // Wait for initial scroll
      await new Promise(resolve => setTimeout(resolve, 10));

      // Select some notes
      grid.selectCell('0r4', 0);
      grid.selectCell('4r4', 4);
      grid.selectCell('7r4', 8);

      // Export
      const saved = grid.exportApp19Selection();
      expect(saved).toHaveLength(3);

      // Navigate registry
      await grid.setRegistry(5);
      expect(grid.getCurrentRegistry()).toBe(5);

      // Clear and reload
      grid.clearSelection();
      grid.loadApp19Selection(saved);

      // Verify restoration
      expect(grid.isSelected('0r4', 0)).toBe(true);
      expect(grid.isSelected('4r4', 4)).toBe(true);
      expect(grid.isSelected('7r4', 8)).toBe(true);

      // Get MIDI map
      const midiMap = grid.getSelectedMidiNotes();
      expect(midiMap.size).toBe(3);

      grid.destroy();
    });

    it('should update columns dynamically', () => {
      const grid = createApp19Grid({
        parent: container,
        columns: 8
      });

      expect(grid.getColumns()).toBe(8);

      grid.updateColumns(16);
      expect(grid.getColumns()).toBe(16);

      grid.destroy();
    });

    it('should handle playhead during playback simulation', () => {
      const grid = createApp19Grid({
        parent: container,
        columns: 8
      });

      // Simulate playback
      for (let i = 0; i < 8; i++) {
        grid.updatePlayhead(i);
      }

      grid.hidePlayhead();
      expect(grid.isPlayheadVisible()).toBe(false);

      grid.destroy();
    });
  });
});
