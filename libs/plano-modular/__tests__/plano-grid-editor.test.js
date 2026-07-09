/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';

import { createPlanoGridEditor } from '../plano-grid-editor.js';

/**
 * Construeix una estructura DOM mínima equivalent a `buildGridDOM` amb un
 * `.plano-matrix` dins del matrixContainer (App32-35 sempre mesuren i
 * injecten np-dots sobre aquest fill, no sobre el container).
 */
function buildDomElements() {
  const container = document.createElement('div');
  container.className = 'plano-container';

  const matrixContainer = document.createElement('div');
  const matrix = document.createElement('div');
  matrix.className = 'plano-matrix';
  matrixContainer.appendChild(matrix);

  const timelineContainer = document.createElement('div');
  const soundlineContainer = document.createElement('div');

  container.appendChild(matrixContainer);
  container.appendChild(timelineContainer);
  container.appendChild(soundlineContainer);

  return { container, matrixContainer, timelineContainer, soundlineContainer, matrix };
}

/** Afegeix `count` cel·les `.plano-cell` amb dataset note/colIndex al matrix. */
function addCells(matrix, cells) {
  for (const { note, colIndex } of cells) {
    const cell = document.createElement('div');
    cell.className = 'plano-cell';
    cell.dataset.note = String(note);
    cell.dataset.colIndex = String(colIndex);
    matrix.appendChild(cell);
  }
}

function makeSimpleContext(overrides = {}) {
  const dom = buildDomElements();
  let notes = [];
  const infoDisplays = {
    sum: document.createElement('input'),
    available: document.createElement('input')
  };

  const context = {
    getGridElements: () => dom,
    getFraction: () => ({ lg: 12, numerator: 1, denominator: 2 }),
    initAudio: jest.fn(async () => null),
    getBpm: () => 60,
    getNotes: () => notes,
    onNoteCreated: jest.fn((noteData) => { notes.push(noteData); }),
    getInfoDisplays: () => infoDisplays,
    noteCount: 12,
    baseMidi: 48,
    ...overrides
  };

  return { context, dom, infoDisplays, getNotes: () => notes, setNotes: (n) => { notes = n; } };
}

function makeComplexContext(overrides = {}) {
  return makeSimpleContext({
    getFraction: () => ({ lg: 12, numerator: 2, denominator: 3 }),
    ...overrides
  });
}

describe('plano-grid-editor', () => {
  describe('createPlanoGridEditor', () => {
    test('crea una instància amb context simple exposant tota l\'API', () => {
      const { context } = makeSimpleContext();
      const editor = createPlanoGridEditor(context);

      expect(typeof editor.renderGridTimeline).toBe('function');
      expect(typeof editor.attachGridDragHandlers).toBe('function');
      expect(typeof editor.injectNpDots).toBe('function');
      expect(typeof editor.refreshCellWidth).toBe('function');
      expect(typeof editor.getCellWidth).toBe('function');
      expect(typeof editor.syncGridScrolls).toBe('function');
      expect(typeof editor.updateInfoDisplays).toBe('function');
      expect(typeof editor.playNotePreview).toBe('function');
      expect(typeof editor.getIntegerLabels).toBe('function');
      expect(typeof editor.getFractionLabels).toBe('function');
      expect(typeof editor.destroy).toBe('function');
    });

    test('crea una instància amb context complex (n variable) sense error', () => {
      const { context } = makeComplexContext();
      expect(() => createPlanoGridEditor(context)).not.toThrow();
    });

    test('dues instàncies no comparteixen estat (cap variable a nivell de mòdul)', () => {
      const a = createPlanoGridEditor(makeSimpleContext().context);
      const b = createPlanoGridEditor(makeSimpleContext().context);

      a.renderGridTimeline();
      // Els arrays de labels de `a` no han d'afectar `b` (buit fins que es
      // renderitzi explícitament).
      expect(a.getIntegerLabels().length).toBeGreaterThan(0);
      expect(b.getIntegerLabels().length).toBe(0);
    });
  });

  describe('renderGridTimeline', () => {
    test('variant simple (n=1, d=2, lg=12): pobla enters i fraccions + endpoint', () => {
      const { context, dom } = makeSimpleContext();
      const editor = createPlanoGridEditor(context);

      editor.renderGridTimeline();

      // columns = getTotalSubdivisions(12, 1, 2) = 24
      const numberEls = dom.timelineContainer.querySelectorAll('.plano-timeline-number');
      expect(numberEls.length).toBe(24 + 1); // + endpoint '·'

      const integerLabels = editor.getIntegerLabels();
      const fractionLabels = editor.getFractionLabels();

      // Enters: pulseIndex 0..11 (colIdx pars: 0,2,4,...22) + endpoint a [12]
      for (let p = 0; p <= 11; p++) {
        expect(integerLabels[p]).toBeDefined();
        expect(integerLabels[p].textContent).toBe(String(p));
      }
      expect(integerLabels[12]).toBeDefined();
      expect(integerLabels[12].textContent).toBe('·');
      expect(integerLabels[12].classList.contains('plano-cycle-end')).toBe(true);

      // Fraccions: la resta de columnes (24 - 12 enters = 12)
      expect(fractionLabels.length).toBe(12);
      expect(fractionLabels[0].textContent).toBe('.1');

      // Label de fracció al container
      const subdivLabel = dom.container.querySelector('.plano-subdivision-label');
      expect(subdivLabel.textContent).toBe('1/2');
    });

    test('variant complexa (n=2, d=3, lg=12): enters només on (colIdx*n)%d===0', () => {
      const { context, dom } = makeComplexContext();
      const editor = createPlanoGridEditor(context);

      editor.renderGridTimeline();

      // columns = getTotalSubdivisions(12, 2, 3) = (12*3)/2 = 18
      const numberEls = dom.timelineContainer.querySelectorAll('.plano-timeline-number');
      expect(numberEls.length).toBe(18 + 1);

      const integerLabels = editor.getIntegerLabels();
      // colIdx*2 % 3 === 0  →  colIdx múltiple de 3 (0,3,6,9,12,15) → pulseIndex 0,2,4,6,8,10
      const expectedPulses = [0, 2, 4, 6, 8, 10];
      for (const p of expectedPulses) {
        expect(integerLabels[p]).toBeDefined();
      }
      expect(integerLabels[12]).toBeDefined(); // endpoint a lg=12

      const subdivLabel = dom.container.querySelector('.plano-subdivision-label');
      expect(subdivLabel.textContent).toBe('2/3');
    });

    test('identitat estable: renderGridTimeline reutilitza el mateix array (mai reassigna)', () => {
      const { context } = makeSimpleContext();
      const editor = createPlanoGridEditor(context);

      editor.renderGridTimeline();
      const integerRef1 = editor.getIntegerLabels();
      const fractionRef1 = editor.getFractionLabels();

      editor.renderGridTimeline();
      const integerRef2 = editor.getIntegerLabels();
      const fractionRef2 = editor.getFractionLabels();

      // Mateixa identitat d'objecte entre dos renders — crític perquè
      // l'app pot desar-se una const apuntant a l'array un sol cop.
      expect(integerRef1).toBe(integerRef2);
      expect(fractionRef1).toBe(fractionRef2);
    });
  });

  describe('refreshCellWidth / getCellWidth', () => {
    test('llegeix offsetWidth de la primera .plano-cell i el retorna', () => {
      const { context, dom } = makeSimpleContext();
      const editor = createPlanoGridEditor(context);

      addCells(dom.matrix, [{ note: 0, colIndex: 0 }]);
      Object.defineProperty(dom.matrix.querySelector('.plano-cell'), 'offsetWidth', { value: 55, configurable: true });

      const result = editor.refreshCellWidth();
      expect(result).toBe(55);
      expect(editor.getCellWidth()).toBe(55);
    });

    test('fallback a 40 quan no hi ha cap cel·la renderitzada', () => {
      const { context } = makeSimpleContext();
      const editor = createPlanoGridEditor(context);
      expect(editor.getCellWidth()).toBe(40);
      expect(editor.refreshCellWidth()).toBe(40);
    });
  });

  describe('updateInfoDisplays', () => {
    test('calcula suma iT i disponibles a partir de getNotes()', () => {
      const { context, infoDisplays, setNotes } = makeSimpleContext();
      setNotes([{ note: 0, startSubdiv: 0, duration: 3 }, { note: 1, startSubdiv: 3, duration: 2 }]);
      const editor = createPlanoGridEditor(context);

      editor.updateInfoDisplays();

      // columns = 24 (n=1,d=2,lg=12); usats = 3+2 = 5; disponibles = 19
      expect(infoDisplays.sum.value).toBe('5');
      expect(infoDisplays.available.value).toBe('19');
    });
  });

  describe('injectNpDots', () => {
    test('afegeix un .np-dot a cada .plano-cell', () => {
      const { context, dom } = makeSimpleContext();
      const editor = createPlanoGridEditor(context);
      addCells(dom.matrix, [{ note: 0, colIndex: 0 }, { note: 1, colIndex: 1 }]);

      editor.injectNpDots();

      const dots = dom.matrix.querySelectorAll('.np-dot');
      expect(dots.length).toBe(2);
    });

    test('és idempotent: una segona crida no duplica els dots', () => {
      const { context, dom } = makeSimpleContext();
      const editor = createPlanoGridEditor(context);
      addCells(dom.matrix, [{ note: 0, colIndex: 0 }]);

      editor.injectNpDots();
      editor.injectNpDots();

      const dots = dom.matrix.querySelectorAll('.np-dot');
      expect(dots.length).toBe(1);
    });
  });

  describe('attachGridDragHandlers — Trap 3 (ordre A-17)', () => {
    test('injectNpDots s\'executa SEMPRE, encara que el guard bloquegi la re-adjunció de listeners', () => {
      const { context, dom } = makeSimpleContext();
      const editor = createPlanoGridEditor(context);
      addCells(dom.matrix, [{ note: 0, colIndex: 0 }]);

      const addSpy = jest.spyOn(dom.matrixContainer, 'addEventListener');

      editor.attachGridDragHandlers();
      expect(dom.matrix.querySelectorAll('.np-dot').length).toBe(1);
      const callsAfterFirst = addSpy.mock.calls.filter(([type]) => type === 'mousedown').length;
      expect(callsAfterFirst).toBe(1);

      // Simular un updateMatrix: es destrueixen les cel·les i se'n
      // creen de noves (sense np-dots).
      dom.matrix.innerHTML = '';
      addCells(dom.matrix, [{ note: 0, colIndex: 0 }, { note: 1, colIndex: 1 }]);
      expect(dom.matrix.querySelectorAll('.np-dot').length).toBe(0);

      // Segona crida: el guard `delegationAttached` ja és true, però
      // injectNpDots() ha de córrer igualment PRIMER i reomplir els dots.
      editor.attachGridDragHandlers();

      expect(dom.matrix.querySelectorAll('.np-dot').length).toBe(2);
      // La delegació d'events NO s'ha tornat a adjuntar (guard funciona).
      const callsAfterSecond = addSpy.mock.calls.filter(([type]) => type === 'mousedown').length;
      expect(callsAfterSecond).toBe(1);

      addSpy.mockRestore();
    });
  });

  describe('playNotePreview — Invariant 3 (àudio dins del gest)', () => {
    test('crida initAudio() i NO reprodueix res si retorna null', async () => {
      const { context } = makeSimpleContext();
      const editor = createPlanoGridEditor(context);

      await editor.playNotePreview({ note: 0, startSubdiv: 0, duration: 1 });

      expect(context.initAudio).toHaveBeenCalledTimes(1);
    });

    test('reprodueix la nota amb la durada calculada quan hi ha instància', async () => {
      const playNote = jest.fn();
      const { context } = makeSimpleContext({
        initAudio: jest.fn(async () => ({ playNote }))
      });
      const editor = createPlanoGridEditor(context);

      // n=1, d=2, bpm=60 → beatDuration=1s; duration=2 subdivs → 2*1/2=1 pols → 1s
      await editor.playNotePreview({ note: 3, startSubdiv: 0, duration: 2 });

      expect(playNote).toHaveBeenCalledWith(48 + 3, 1, 0);
    });

    test('capa el preview a previewMaxSeconds', async () => {
      const playNote = jest.fn();
      const { context } = makeSimpleContext({
        initAudio: jest.fn(async () => ({ playNote })),
        getBpm: () => 10 // molt lent → durada llarga
      });
      const editor = createPlanoGridEditor(context);

      await editor.playNotePreview({ note: 0, startSubdiv: 0, duration: 20 });

      const [, durationSeconds] = playNote.mock.calls[0];
      expect(durationSeconds).toBe(2); // previewMaxSeconds per defecte
    });
  });

  describe('destroy', () => {
    test('no llança encara que no s\'hagi cridat attachGridDragHandlers abans', () => {
      const { context } = makeSimpleContext();
      const editor = createPlanoGridEditor(context);
      expect(() => editor.destroy()).not.toThrow();
    });
  });
});
