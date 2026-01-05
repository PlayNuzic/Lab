/**
 * Tests para musical-grid.js
 * @jest-environment jsdom
 */

import { createMusicalGrid } from '../musical-grid.js';

describe('musical-grid', () => {
  let parent;
  let grid;

  beforeEach(() => {
    // Create mock parent container
    parent = document.createElement('div');
    document.body.appendChild(parent);
  });

  afterEach(() => {
    // Cleanup
    if (grid) {
      grid.destroy();
    }
    if (parent && parent.parentNode) {
      parent.remove();
    }
  });

  describe('createMusicalGrid', () => {
    it('crea grid con configuración por defecto', () => {
      grid = createMusicalGrid({ parent });
      expect(grid).toBeDefined();
      expect(grid.render).toBeDefined();
      expect(grid.clear).toBeDefined();
      expect(grid.update).toBeDefined();
      expect(grid.destroy).toBeDefined();
      expect(grid.getCellElement).toBeDefined();
      expect(grid.highlight).toBeDefined();
    });

    it('renderiza estructura DOM correcta', () => {
      grid = createMusicalGrid({ parent });
      const gridContainer = parent.querySelector('.grid-container');
      expect(gridContainer).toBeTruthy();

      const soundline = parent.querySelector('.soundline-wrapper');
      const matrix = parent.querySelector('.matrix-container');
      const timeline = parent.querySelector('.timeline-wrapper');

      expect(soundline).toBeTruthy();
      expect(matrix).toBeTruthy();
      expect(timeline).toBeTruthy();
    });

    it('acepta configuración personalizada', () => {
      grid = createMusicalGrid({
        parent,
        notes: 24,
        pulses: 16,
        startMidi: 48,
        fillSpaces: false
      });
      expect(grid.noteCount).toBe(24);
      expect(grid.pulseCount).toBe(16);
    });

    it('lanza error sin parent', () => {
      expect(() => {
        createMusicalGrid({});
      }).toThrow('createMusicalGrid requires config.parent');
    });

    it('lanza error con dimensiones inválidas', () => {
      expect(() => {
        createMusicalGrid({ parent, notes: 0 });
      }).toThrow('createMusicalGrid requires notes > 0 and pulses > 0');

      expect(() => {
        createMusicalGrid({ parent, notes: 12, pulses: 0 });
      }).toThrow('createMusicalGrid requires notes > 0 and pulses > 0');
    });
  });

  describe('renderizado básico', () => {
    it('renderiza número correcto de notas', () => {
      grid = createMusicalGrid({ parent, notes: 12, pulses: 9 });
      const noteLabels = parent.querySelectorAll('.soundline-number');
      // Now includes top zero label, so 12 notes + 1 top label = 13
      expect(noteLabels.length).toBe(13);
    });

    it('renderiza número correcto de pulsos', () => {
      grid = createMusicalGrid({ parent, notes: 12, pulses: 9 });
      const pulseMarkers = parent.querySelectorAll('.pulse-marker');
      expect(pulseMarkers.length).toBe(9);
    });

    it('renderiza número correcto de celdas (fillSpaces=true)', () => {
      grid = createMusicalGrid({ parent, notes: 12, pulses: 9, fillSpaces: true });
      expect(grid.cellCount).toBe(12 * 8); // 12 notes × 8 spaces (between 9 pulses)
    });

    it('renderiza número correcto de celdas (fillSpaces=false)', () => {
      grid = createMusicalGrid({ parent, notes: 12, pulses: 9, fillSpaces: false });
      expect(grid.cellCount).toBe(12 * 9); // 12 notes × 9 pulses
    });
  });

  describe('getCellElement', () => {
    it('obtiene celda por índices', () => {
      grid = createMusicalGrid({ parent, notes: 12, pulses: 9 });
      const cell = grid.getCellElement(5, 2);
      expect(cell).toBeTruthy();
      expect(cell.dataset.note).toBe('5');
      expect(cell.dataset.pulse).toBe('2');
    });

    it('retorna null para índices inválidos', () => {
      grid = createMusicalGrid({ parent, notes: 12, pulses: 9 });
      expect(grid.getCellElement(99, 99)).toBeNull();
    });
  });

  describe('highlight', () => {
    it('destaca celda correctamente', () => {
      grid = createMusicalGrid({ parent, notes: 12, pulses: 9 });
      grid.highlight(5, 2);

      const cell = grid.getCellElement(5, 2);
      expect(cell.classList.contains('highlight')).toBe(true);
    });

    it('elimina highlight después del duration', (done) => {
      grid = createMusicalGrid({ parent, notes: 12, pulses: 9 });
      grid.highlight(5, 2, 50); // 50ms duration

      const cell = grid.getCellElement(5, 2);
      expect(cell.classList.contains('highlight')).toBe(true);

      setTimeout(() => {
        expect(cell.classList.contains('highlight')).toBe(false);
        done();
      }, 100);
    });
  });

  describe('clear', () => {
    it('elimina todas las clases active y highlight', () => {
      grid = createMusicalGrid({ parent, notes: 12, pulses: 9 });

      // Add some active/highlight states
      const cell1 = grid.getCellElement(0, 0);
      const cell2 = grid.getCellElement(5, 2);
      cell1.classList.add('active');
      cell2.classList.add('highlight');

      grid.clear();

      expect(cell1.classList.contains('active')).toBe(false);
      expect(cell2.classList.contains('highlight')).toBe(false);
    });
  });

  describe('update', () => {
    it('actualiza posiciones sin errores', () => {
      grid = createMusicalGrid({ parent, notes: 12, pulses: 9 });
      expect(() => {
        grid.update();
      }).not.toThrow();
    });
  });

  describe('destroy', () => {
    it('limpia el DOM correctamente', () => {
      grid = createMusicalGrid({ parent, notes: 12, pulses: 9 });
      grid.destroy();

      const gridContainer = parent.querySelector('.grid-container');
      expect(gridContainer).toBeNull();
    });

    it('permite múltiples llamadas a destroy sin errores', () => {
      grid = createMusicalGrid({ parent, notes: 12, pulses: 9 });
      grid.destroy();

      expect(() => {
        grid.destroy();
      }).not.toThrow();
    });
  });

  describe('callbacks', () => {
    it('llama onCellClick cuando se hace click en celda', () => {
      let clickedCell = null;
      grid = createMusicalGrid({
        parent,
        notes: 12,
        pulses: 9,
        onCellClick: (note, pulse, el) => {
          clickedCell = { note, pulse, el };
        }
      });

      const cell = grid.getCellElement(5, 2);
      cell.click();

      expect(clickedCell).toBeTruthy();
      expect(clickedCell.note).toBe(5);
      expect(clickedCell.pulse).toBe(2);
    });

    it('llama onNoteClick cuando se hace click en nota', () => {
      let clickedNote = null;
      grid = createMusicalGrid({
        parent,
        notes: 12,
        pulses: 9,
        startMidi: 60,
        onNoteClick: (noteIndex, midi, el) => {
          clickedNote = { noteIndex, midi, el };
        }
      });

      const noteLabel = parent.querySelector('.soundline-number[data-note-index="5"]');
      noteLabel.click();

      expect(clickedNote).toBeTruthy();
      expect(clickedNote.noteIndex).toBe(5);
      expect(clickedNote.midi).toBe(65); // 60 + 5
    });
  });

  describe('scroll mode', () => {
    it('crea contenedores interiores cuando scrollEnabled=true', () => {
      grid = createMusicalGrid({
        parent,
        notes: 24,
        pulses: 16,
        scrollEnabled: true,
        cellSize: { minWidth: 60, minHeight: 40 }
      });

      const soundlineInner = parent.querySelector('.soundline-inner');
      const matrixInner = parent.querySelector('.matrix-inner');
      const timelineInner = parent.querySelector('.timeline-inner');

      expect(soundlineInner).toBeTruthy();
      expect(matrixInner).toBeTruthy();
      expect(timelineInner).toBeTruthy();
    });

    it('no crea contenedores interiores cuando scrollEnabled=false', () => {
      grid = createMusicalGrid({
        parent,
        notes: 12,
        pulses: 9,
        scrollEnabled: false
      });

      const soundlineInner = parent.querySelector('.soundline-inner');
      const matrixInner = parent.querySelector('.matrix-inner');

      expect(soundlineInner).toBeNull();
      expect(matrixInner).toBeNull();
    });

    it('aplica containerSize cuando se proporciona', () => {
      grid = createMusicalGrid({
        parent,
        notes: 24,
        pulses: 16,
        scrollEnabled: true,
        containerSize: { width: '800px', height: '600px' }
      });

      const gridContainer = parent.querySelector('.grid-container');
      expect(gridContainer.style.width).toBe('800px');
      expect(gridContainer.style.height).toBe('600px');
    });
  });

  describe('formatters', () => {
    it('usa noteFormatter personalizado', () => {
      grid = createMusicalGrid({
        parent,
        notes: 12,
        pulses: 9,
        noteFormatter: (index, midi) => `Note-${index}`
      });

      const noteLabel = parent.querySelector('.soundline-number[data-note-index="5"]');
      expect(noteLabel.textContent).toBe('Note-5');
    });

    it('usa pulseFormatter personalizado', () => {
      grid = createMusicalGrid({
        parent,
        notes: 12,
        pulses: 9,
        pulseFormatter: (index) => `P${index}`
      });

      const pulseMarker = parent.querySelector('.pulse-marker[data-pulse-index="3"]');
      expect(pulseMarker.textContent).toBe('P3');
    });
  });

  describe('getters', () => {
    it('expone propiedades de solo lectura', () => {
      grid = createMusicalGrid({ parent, notes: 12, pulses: 9 });
      expect(grid.isRendered).toBe(true);
      expect(grid.noteCount).toBe(12);
      expect(grid.pulseCount).toBe(9);
      expect(grid.cellCount).toBe(12 * 8); // fillSpaces=true por defecto
    });

    it('retorna copia de array cells', () => {
      grid = createMusicalGrid({ parent, notes: 12, pulses: 9 });
      const cells1 = grid.cells;
      const cells2 = grid.cells;

      expect(cells1).toEqual(cells2);
      expect(cells1).not.toBe(cells2); // Diferentes referencias (copia)
    });
  });

  describe('interval highlighting', () => {
    it('expone métodos de interval highlighting', () => {
      grid = createMusicalGrid({
        parent,
        notes: 12,
        pulses: 9,
        showIntervals: { horizontal: true, vertical: false }
      });

      expect(typeof grid.highlightInterval).toBe('function');
      expect(typeof grid.clearIntervalHighlights).toBe('function');
      expect(typeof grid.onPulseStep).toBe('function');
    });

    it('agrega clase active a interval bar cuando se llama highlightInterval', () => {
      grid = createMusicalGrid({
        parent,
        notes: 12,
        pulses: 9,
        showIntervals: { horizontal: true, vertical: false }
      });

      // Encontrar la barra de intervalo 1
      const timelineContainer = grid.getTimelineContainer();
      const intervalBar = timelineContainer.querySelector('.interval-bar.horizontal[data-interval-index="1"]');

      expect(intervalBar).toBeTruthy();
      expect(intervalBar.classList.contains('active')).toBe(false);

      // Destacar intervalo 1
      grid.highlightInterval('horizontal', 1, 0);
      expect(intervalBar.classList.contains('active')).toBe(true);
    });

    it('limpia highlights cuando se llama clearIntervalHighlights', () => {
      grid = createMusicalGrid({
        parent,
        notes: 12,
        pulses: 9,
        showIntervals: { horizontal: true, vertical: false }
      });

      const timelineContainer = grid.getTimelineContainer();
      const intervalBar = timelineContainer.querySelector('.interval-bar.horizontal[data-interval-index="1"]');

      // Destacar y luego limpiar
      grid.highlightInterval('horizontal', 1, 0);
      expect(intervalBar.classList.contains('active')).toBe(true);

      grid.clearIntervalHighlights('horizontal');
      expect(intervalBar.classList.contains('active')).toBe(false);
    });

    it('onPulseStep destaca el intervalo correcto', () => {
      grid = createMusicalGrid({
        parent,
        notes: 12,
        pulses: 9,
        showIntervals: { horizontal: true, vertical: false }
      });

      const timelineContainer = grid.getTimelineContainer();
      const interval1 = timelineContainer.querySelector('.interval-bar.horizontal[data-interval-index="1"]');
      const interval2 = timelineContainer.querySelector('.interval-bar.horizontal[data-interval-index="2"]');

      // Pulso 0 debe destacar intervalo 1
      grid.onPulseStep(0, 0);
      expect(interval1.classList.contains('active')).toBe(true);
      expect(interval2.classList.contains('active')).toBe(false);

      // Pulso 1 debe destacar intervalo 2
      grid.onPulseStep(1, 0);
      expect(interval1.classList.contains('active')).toBe(false);
      expect(interval2.classList.contains('active')).toBe(true);
    });
  });

  describe('setEnabledNotes', () => {
    it('deshabilita celdas fuera de las notas habilitadas', () => {
      const grid = createMusicalGrid({
        parent,
        notes: 12,
        pulses: 9
      });

      // Habilitar solo notas de escala mayor (C, D, E, F, G, A, B = 0, 2, 4, 5, 7, 9, 11)
      const scaleNotes = [0, 2, 4, 5, 7, 9, 11];
      grid.setEnabledNotes(scaleNotes);

      // Verificar que las notas fuera de la escala están deshabilitadas
      const disabledCells = parent.querySelectorAll('.musical-cell.disabled');
      // 5 notas cromáticas (1, 3, 6, 8, 10) × 8 pulsos = 40 celdas
      expect(disabledCells.length).toBe(5 * 8);

      // Verificar que las notas de la escala están habilitadas
      const enabledCells = parent.querySelectorAll('.musical-cell:not(.disabled)');
      // 7 notas de escala × 8 pulsos = 56 celdas
      expect(enabledCells.length).toBe(7 * 8);
    });

    it('actualiza pointer-events correctamente', () => {
      const grid = createMusicalGrid({
        parent,
        notes: 12,
        pulses: 9
      });

      grid.setEnabledNotes([0, 4, 7]); // Solo triada

      // Celda habilitada tiene pointer-events: auto
      const enabledCell = grid.getCellElement(0, 0);
      expect(enabledCell.style.pointerEvents).toBe('auto');

      // Celda deshabilitada tiene pointer-events: none
      const disabledCell = grid.getCellElement(1, 0);
      expect(disabledCell.style.pointerEvents).toBe('none');
    });

    it('puede re-habilitar todas las notas', () => {
      const grid = createMusicalGrid({
        parent,
        notes: 12,
        pulses: 9
      });

      // Primero deshabilitar algunas
      grid.setEnabledNotes([0, 2, 4]);

      // Luego habilitar todas
      const allNotes = Array.from({ length: 12 }, (_, i) => i);
      grid.setEnabledNotes(allNotes);

      const disabledCells = parent.querySelectorAll('.musical-cell.disabled');
      expect(disabledCells.length).toBe(0);
    });
  });

  describe('updateSoundlineLabels', () => {
    it('actualiza clases de notas de escala y cromáticas', () => {
      const grid = createMusicalGrid({
        parent,
        notes: 12,
        pulses: 9
      });

      const scaleNotes = [0, 2, 4, 5, 7, 9, 11];
      grid.updateSoundlineLabels(scaleNotes, (noteIndex) => {
        const degreeIndex = scaleNotes.indexOf(noteIndex);
        return degreeIndex !== -1 ? String(degreeIndex) : '';
      });

      // Verificar clases en soundline numbers
      const scaleNumbers = parent.querySelectorAll('.soundline-number.scale-note');
      const chromaticNumbers = parent.querySelectorAll('.soundline-number.chromatic-note');

      // 7 notas de escala + 1 top-zero label
      expect(scaleNumbers.length).toBeGreaterThanOrEqual(7);

      // 5 notas cromáticas
      expect(chromaticNumbers.length).toBe(5);
    });

    it('aplica formatter personalizado a las etiquetas', () => {
      const grid = createMusicalGrid({
        parent,
        notes: 12,
        pulses: 9
      });

      const scaleNotes = [0, 2, 4];
      grid.updateSoundlineLabels(scaleNotes, (noteIndex) => {
        return scaleNotes.includes(noteIndex) ? `D${scaleNotes.indexOf(noteIndex)}` : '·';
      });

      // Verificar que los labels fueron actualizados
      const allNumbers = parent.querySelectorAll('.soundline-number:not(.top-zero)');
      const labelsWithD = Array.from(allNumbers).filter(el => el.textContent.startsWith('D'));
      expect(labelsWithD.length).toBe(3);
    });
  });
});
