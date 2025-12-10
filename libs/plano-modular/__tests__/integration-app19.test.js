/**
 * Integration test: App19 migration scenario
 * Tests that the module works correctly for App19's use case
 * @jest-environment jsdom
 */

import { createApp19Grid } from '../index.js';

describe('App19 Integration', () => {
  let container;
  let grid;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);

    // Mock CSS custom properties
    document.documentElement.style.setProperty('--plano-cell-width', '50px');
    document.documentElement.style.setProperty('--plano-cell-height', '32px');
  });

  afterEach(() => {
    if (grid) {
      grid.destroy();
      grid = null;
    }
    document.body.innerHTML = '';
  });

  describe('Grid Creation', () => {
    it('should create grid with 39 rows', () => {
      grid = createApp19Grid({
        parent: container,
        columns: 8,
        cycleConfig: { compas: 4 }
      });

      expect(grid.getRowDefinitions()).toHaveLength(39);
    });

    it('should create correct number of cells', () => {
      grid = createApp19Grid({
        parent: container,
        columns: 16,
        cycleConfig: { compas: 4 }
      });

      const cells = container.querySelectorAll('.plano-cell');
      expect(cells.length).toBe(39 * 16); // 39 rows × 16 columns
    });

    it('should create soundline with note labels', () => {
      grid = createApp19Grid({
        parent: container,
        columns: 8
      });

      const soundlineNotes = container.querySelectorAll('.plano-soundline-note');
      expect(soundlineNotes.length).toBe(39);

      // Check first label is 7r5
      expect(soundlineNotes[0].textContent).toBe('7r5');
    });

    it('should create timeline with pulse numbers', () => {
      grid = createApp19Grid({
        parent: container,
        columns: 8,
        cycleConfig: { compas: 4 }
      });

      const timelineNumbers = container.querySelectorAll('.plano-timeline-number');
      expect(timelineNumbers.length).toBe(8);
    });
  });

  describe('Registry Navigation', () => {
    beforeEach(() => {
      grid = createApp19Grid({
        parent: container,
        columns: 8,
        defaultRegistry: 4
      });
    });

    it('should start at default registry', (done) => {
      setTimeout(() => {
        expect(grid.getCurrentRegistry()).toBe(4);
        done();
      }, 10);
    });

    it('should navigate to registry 5', async () => {
      await grid.setRegistry(5);
      expect(grid.getCurrentRegistry()).toBe(5);
    });

    it('should navigate to registry 3', async () => {
      await grid.setRegistry(3);
      expect(grid.getCurrentRegistry()).toBe(3);
    });

    it('should support nextRegistry navigation', async () => {
      await grid.setRegistry(4);
      await grid.nextRegistry();
      expect(grid.getCurrentRegistry()).toBe(5);
    });

    it('should support prevRegistry navigation', async () => {
      await grid.setRegistry(4);
      await grid.prevRegistry();
      expect(grid.getCurrentRegistry()).toBe(3);
    });
  });

  describe('Selection (Monophonic)', () => {
    beforeEach(() => {
      grid = createApp19Grid({
        parent: container,
        columns: 8
      });
    });

    it('should select a cell', () => {
      grid.selectCell('0r4', 0);
      expect(grid.isSelected('0r4', 0)).toBe(true);
    });

    it('should enforce monophonic (one cell per column)', () => {
      grid.selectCell('0r4', 0);
      grid.selectCell('5r4', 0); // Same column, different note

      expect(grid.isSelected('0r4', 0)).toBe(false);
      expect(grid.isSelected('5r4', 0)).toBe(true);
    });

    it('should allow selections in different columns', () => {
      grid.selectCell('0r4', 0);
      grid.selectCell('5r4', 1);
      grid.selectCell('7r5', 2);

      expect(grid.isSelected('0r4', 0)).toBe(true);
      expect(grid.isSelected('5r4', 1)).toBe(true);
      expect(grid.isSelected('7r5', 2)).toBe(true);
    });

    it('should clear all selections', () => {
      grid.selectCell('0r4', 0);
      grid.selectCell('5r4', 1);
      grid.selectCell('7r5', 2);

      grid.clearSelection();

      expect(grid.isSelected('0r4', 0)).toBe(false);
      expect(grid.isSelected('5r4', 1)).toBe(false);
      expect(grid.isSelected('7r5', 2)).toBe(false);
    });
  });

  describe('App19 Key Format', () => {
    beforeEach(() => {
      grid = createApp19Grid({
        parent: container,
        columns: 16
      });
    });

    it('should export selection in App19 format', () => {
      grid.selectCell('7r5', 0);
      grid.selectCell('0r4', 4);
      grid.selectCell('11r3', 8);

      const exported = grid.exportApp19Selection();

      expect(exported).toContain('5-7-0');
      expect(exported).toContain('4-0-4');
      expect(exported).toContain('3-11-8');
    });

    it('should load selection from App19 format', () => {
      grid.loadApp19Selection(['5-7-0', '4-0-4', '3-11-8']);

      expect(grid.isSelected('7r5', 0)).toBe(true);
      expect(grid.isSelected('0r4', 4)).toBe(true);
      expect(grid.isSelected('11r3', 8)).toBe(true);
    });

    it('should round-trip export/import correctly', () => {
      grid.selectCell('7r5', 0);
      grid.selectCell('4r4', 3);
      grid.selectCell('0r3', 7);

      const exported = grid.exportApp19Selection();
      grid.clearSelection();
      grid.loadApp19Selection(exported);

      expect(grid.isSelected('7r5', 0)).toBe(true);
      expect(grid.isSelected('4r4', 3)).toBe(true);
      expect(grid.isSelected('0r3', 7)).toBe(true);
    });
  });

  describe('MIDI Calculation', () => {
    beforeEach(() => {
      grid = createApp19Grid({
        parent: container,
        columns: 8
      });
    });

    it('should calculate correct MIDI for 0r4 (Middle C)', () => {
      expect(grid.getMidi(4, 0)).toBe(60);
    });

    it('should calculate correct MIDI for 0r5', () => {
      expect(grid.getMidi(5, 0)).toBe(72);
    });

    it('should calculate correct MIDI for 0r3', () => {
      expect(grid.getMidi(3, 0)).toBe(48);
    });

    it('should get selected MIDI notes map', () => {
      grid.selectCell('0r4', 0);  // MIDI 60 at pulse 0
      grid.selectCell('0r5', 4);  // MIDI 72 at pulse 4

      const midiMap = grid.getSelectedMidiNotes();

      expect(midiMap.get(0)).toBe(60);
      expect(midiMap.get(4)).toBe(72);
    });
  });

  describe('Playhead', () => {
    beforeEach(() => {
      grid = createApp19Grid({
        parent: container,
        columns: 8
      });
    });

    it('should update playhead position', () => {
      grid.updatePlayhead(3);
      expect(grid.isPlayheadVisible()).toBe(true);
    });

    it('should hide playhead', () => {
      grid.updatePlayhead(3);
      grid.hidePlayhead();
      expect(grid.isPlayheadVisible()).toBe(false);
    });
  });

  describe('Highlights', () => {
    beforeEach(() => {
      grid = createApp19Grid({
        parent: container,
        columns: 8
      });
    });

    it('should highlight cells', () => {
      grid.selectCell('0r4', 0);
      grid.highlightCell('0r4', 0);

      const cell = container.querySelector('.plano-cell[data-row-id="0r4"][data-col-index="0"]');
      expect(cell.classList.contains('plano-highlight')).toBe(true);
    });

    it('should highlight timeline numbers', () => {
      grid.highlightTimelineNumber(3);

      const num = container.querySelector('.plano-timeline-number[data-col-index="3"]');
      expect(num.classList.contains('plano-highlight')).toBe(true);
    });

    it('should clear all highlights', () => {
      grid.highlightCell('0r4', 0);
      grid.highlightTimelineNumber(3);

      grid.clearHighlights();

      const highlightedCells = container.querySelectorAll('.plano-highlight');
      expect(highlightedCells.length).toBe(0);
    });
  });

  describe('Dynamic Updates', () => {
    beforeEach(() => {
      grid = createApp19Grid({
        parent: container,
        columns: 8,
        cycleConfig: { compas: 4 }
      });
    });

    it('should update columns', () => {
      expect(grid.getColumns()).toBe(8);

      grid.updateColumns(16);
      expect(grid.getColumns()).toBe(16);

      const cells = container.querySelectorAll('.plano-cell');
      expect(cells.length).toBe(39 * 16);
    });

    it('should update compas', () => {
      expect(grid.getCompas()).toBe(4);

      grid.setCompas(3);
      expect(grid.getCompas()).toBe(3);
    });

    it('should update BPM', () => {
      expect(grid.getBpm()).toBe(100);

      grid.setBpm(120);
      expect(grid.getBpm()).toBe(120);
    });

    it('should preserve selection after column update', () => {
      grid.selectCell('0r4', 0);
      grid.selectCell('5r4', 4);

      grid.updateColumns(16);

      expect(grid.isSelected('0r4', 0)).toBe(true);
      expect(grid.isSelected('5r4', 4)).toBe(true);
    });
  });

  describe('Full Workflow Simulation', () => {
    it('should handle complete App19 workflow', async () => {
      // 1. Create grid
      grid = createApp19Grid({
        parent: container,
        columns: 16,
        cycleConfig: { compas: 4 },
        bpm: 100,
        defaultRegistry: 4
      });

      // Wait for initial scroll
      await new Promise(resolve => setTimeout(resolve, 20));

      // 2. Select some notes
      grid.selectCell('0r4', 0);   // Middle C at pulse 0
      grid.selectCell('2r4', 4);   // D at pulse 4
      grid.selectCell('4r4', 8);   // E at pulse 8
      grid.selectCell('5r4', 12);  // F at pulse 12

      // 3. Get MIDI map for playback
      const midiMap = grid.getSelectedMidiNotes();
      expect(midiMap.size).toBe(4);
      expect(midiMap.get(0)).toBe(60);  // C4
      expect(midiMap.get(4)).toBe(62);  // D4
      expect(midiMap.get(8)).toBe(64);  // E4
      expect(midiMap.get(12)).toBe(65); // F4

      // 4. Simulate playback step-through
      for (let step = 0; step < 16; step++) {
        grid.updatePlayhead(step);
        grid.highlightTimelineNumber(step, 100);

        const midi = midiMap.get(step);
        if (midi !== undefined) {
          const selected = grid.getSelectedArray().find(s => s.colIndex === step);
          if (selected) {
            grid.highlightCell(selected.rowId, step, 100);
          }
        }
      }

      // 5. Stop playback
      grid.hidePlayhead();
      grid.clearHighlights();

      // 6. Export for preferences
      const savedKeys = grid.exportApp19Selection();
      expect(savedKeys).toHaveLength(4);

      // 7. Simulate app restart - clear and reload
      grid.clearSelection();
      grid.loadApp19Selection(savedKeys);

      // 8. Verify restoration
      expect(grid.isSelected('0r4', 0)).toBe(true);
      expect(grid.isSelected('2r4', 4)).toBe(true);
      expect(grid.isSelected('4r4', 8)).toBe(true);
      expect(grid.isSelected('5r4', 12)).toBe(true);

      // 9. Navigate registries
      await grid.setRegistry(5);
      expect(grid.getCurrentRegistry()).toBe(5);

      await grid.setRegistry(3);
      expect(grid.getCurrentRegistry()).toBe(3);
    });
  });
});
