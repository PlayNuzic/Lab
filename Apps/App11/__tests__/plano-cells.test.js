/**
 * @jest-environment jsdom
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { selectCell, deselectCell, createLiveSequence } from '../plano-cells.js';

// Plànol mínim: cel·les .musical-cell amb data-pulse/data-note com les de musical-grid
function buildGrid(pulses = 3, notes = 5) {
  const grid = document.createElement('div');
  for (let p = 0; p < pulses; p++) {
    for (let n = 0; n < notes; n++) {
      const cell = document.createElement('div');
      cell.className = 'musical-cell';
      cell.dataset.pulse = String(p);
      cell.dataset.note = String(n);
      grid.appendChild(cell);
    }
  }
  document.body.appendChild(grid);
  return grid;
}

const cellAt = (grid, pulse, note) =>
  grid.querySelector(`.musical-cell[data-pulse="${pulse}"][data-note="${note}"]`);
const activeNotes = (grid) =>
  [...grid.querySelectorAll('.musical-cell.active')].map(c => `(${c.dataset.pulse},${c.dataset.note})`);

describe('selectCell / deselectCell', () => {
  let grid;
  beforeEach(() => {
    document.body.innerHTML = '';
    grid = buildGrid();
  });

  test('posa la nota amb la seva etiqueta P-N', () => {
    selectCell(grid, cellAt(grid, 1, 3));
    expect(activeNotes(grid)).toEqual(['(1,3)']);
    expect(cellAt(grid, 1, 3).querySelector('.cell-label').textContent).toBe('( 1 , 3 )');
  });

  test('cas del test P2-02: dues notes al pols 0 → només en queda una', () => {
    selectCell(grid, cellAt(grid, 0, 2)); // clic de l'usuari
    selectCell(grid, cellAt(grid, 0, 4)); // nota del playback
    expect(activeNotes(grid)).toEqual(['(0,4)']);
    expect(cellAt(grid, 0, 2).querySelector('.cell-label')).toBeNull();
  });

  test('no toca les notes dels altres polsos', () => {
    selectCell(grid, cellAt(grid, 0, 1));
    selectCell(grid, cellAt(grid, 1, 1));
    selectCell(grid, cellAt(grid, 2, 4));
    expect(activeNotes(grid)).toEqual(['(0,1)', '(1,1)', '(2,4)']);
  });

  test('tornar a seleccionar la mateixa cel·la no duplica l\'etiqueta', () => {
    const cell = cellAt(grid, 2, 0);
    selectCell(grid, cell);
    selectCell(grid, cell);
    expect(cell.querySelectorAll('.cell-label').length).toBe(1);
  });

  test('deselectCell treu la classe i l\'etiqueta', () => {
    const cell = selectCell(grid, cellAt(grid, 1, 1));
    cell.classList.add('fading-out');
    deselectCell(cell);
    expect(cell.classList.contains('active')).toBe(false);
    expect(cell.classList.contains('fading-out')).toBe(false);
    expect(cell.querySelector('.cell-label')).toBeNull();
  });
});

describe('createLiveSequence', () => {
  test('fora de la reproducció no guarda res', () => {
    const live = createLiveSequence();
    live.set(0, 2);
    expect(live.isPlaying()).toBe(false);
    expect(live.noteAt(0)).toBeUndefined();
  });

  test('cas del test P2-02: un clic mentre sona canvia la nota que sonarà', () => {
    const live = createLiveSequence();
    live.start([{ pulse: 0, note: 4 }, { pulse: 3, note: 7 }]); // aleatòria
    live.set(0, 2); // clic a (0,2) abans que soni el pols 0
    expect(live.noteAt(0)).toBe(2);
    expect(live.noteAt(3)).toBe(7);
  });

  test('treure una nota mentre sona la treu de la melodia', () => {
    const live = createLiveSequence();
    live.start([{ pulse: 1, note: 5 }]);
    live.remove(1);
    expect(live.noteAt(1)).toBeUndefined();
  });

  test('stop la buida', () => {
    const live = createLiveSequence();
    live.start([{ pulse: 1, note: 5 }]);
    live.stop();
    expect(live.isPlaying()).toBe(false);
    expect(live.noteAt(1)).toBeUndefined();
  });
});
