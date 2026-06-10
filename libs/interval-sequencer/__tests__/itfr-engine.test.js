/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { createItfrEngine } from '../itfr-engine.js';

// Config tipus App30: lg=6, n=1, d=2 → 12 subdivisions.
// `prepare(elements)` permet marcar elements (p.ex. non-selectable) ABANS
// del bindTimeline, com fa el renderTimeline d'App31.
function buildHarness({ lg = 6, n = 1, d = 2, isSelectable, sequence = [], prepare } = {}) {
  document.body.innerHTML = '';
  const timeline = document.createElement('div');
  timeline.getBoundingClientRect = () => ({ left: 0, width: 600, top: 0, height: 40 });
  document.body.appendChild(timeline);

  const cellsHost = document.createElement('div');
  document.body.appendChild(cellsHost);

  let model = sequence;
  const onSequenceChange = jest.fn();

  const engine = createItfrEngine({
    timeline,
    colors: ['#111', '#222'],
    getLg: () => lg,
    getNumerator: () => n,
    getDenominator: () => d,
    getTotalSubdivisions: () => lg * d,
    getSequence: () => model,
    setSequence: (next) => { model = next; },
    isSelectable,
    onSequenceChange,
    getEditorCellsHost: () => cellsHost
  });

  // Elements com els crea renderTimeline: polsos 0..lg, marcadors fraccionaris.
  const pulses = [];
  for (let i = 0; i <= lg; i++) {
    const p = document.createElement('div');
    p.className = 'pulse-number';
    p.dataset.index = String(i);
    timeline.appendChild(p);
    pulses.push(p);
  }
  const cycleMarkers = [];
  const cycleLabels = [];
  const cycles = Math.floor(lg / n);
  for (let ci = 0; ci < cycles; ci++) {
    for (let s = 1; s < d; s++) {
      const marker = document.createElement('div');
      marker.className = 'cycle-marker';
      marker.dataset.cycleIndex = String(ci);
      marker.dataset.subdivision = String(s);
      marker.dataset.globalSubdiv = String(ci * d + s);
      timeline.appendChild(marker);
      cycleMarkers.push(marker);
      const label = document.createElement('div');
      label.className = 'cycle-label';
      label.dataset.cycleIndex = String(ci);
      label.dataset.subdivision = String(s);
      label.dataset.globalSubdiv = String(ci * d + s);
      timeline.appendChild(label);
      cycleLabels.push(label);
    }
  }

  if (prepare) prepare({ pulses, cycleMarkers, cycleLabels });
  engine.bindTimeline({ pulses, cycleMarkers, cycleLabels });

  return {
    engine, timeline, cellsHost, pulses, cycleMarkers, cycleLabels,
    onSequenceChange, getModel: () => model
  };
}

function pointer(type, props = {}) {
  return new MouseEvent(type, { bubbles: true, cancelable: true, ...props });
}

afterEach(() => {
  document.body.innerHTML = '';
  document.body.classList.remove('dragging-it');
});

describe('createItfrEngine — barres', () => {
  test('updateIntervalBars pinta una barra + halter per iT i salta silencis', () => {
    const { engine, timeline } = buildHarness({
      sequence: [
        { start: 0, it: 2, isSilence: false },
        { start: 2, it: 1, isSilence: true },
        { start: 3, it: 3, isSilence: false }
      ]
    });
    engine.updateIntervalBars();

    const bars = timeline.querySelectorAll('.interval-bar-visual');
    expect(bars.length).toBe(2);
    // start=0 it=2 amb n=1 d=2 → 0% a (1/6)*100%
    expect(bars[0].style.left).toBe('0%');
    expect(parseFloat(bars[0].style.width)).toBeCloseTo((1 / 6) * 100);
    // El halter acompanya cada barra real
    expect(timeline.querySelectorAll('.interval-label-bar').length).toBe(2);
  });

  test('re-render neteja les barres anteriors', () => {
    const { engine, timeline } = buildHarness({
      sequence: [{ start: 0, it: 2, isSilence: false }]
    });
    engine.updateIntervalBars();
    engine.updateIntervalBars();
    expect(timeline.querySelectorAll('.interval-bar-visual').length).toBe(1);
    expect(timeline.querySelectorAll('.interval-label-bar').length).toBe(1);
  });
});

describe('createItfrEngine — model', () => {
  test('insertItAtPosition elimina solapaments, ordena i notifica', () => {
    const { engine, getModel, onSequenceChange } = buildHarness({
      sequence: [
        { start: 0, it: 2, isSilence: false },
        { start: 4, it: 2, isSilence: false }
      ]
    });
    engine.insertItAtPosition(1, 3); // solapa amb el primer (0-2), no amb el segon (4-6)

    const model = getModel();
    expect(model).toEqual([
      { start: 1, it: 3, isSilence: false },
      { start: 4, it: 2, isSilence: false }
    ]);
    expect(onSequenceChange).toHaveBeenCalledTimes(1);
  });

  test('getItIndexAtScaledStart mapeja start×n → índex', () => {
    const { engine } = buildHarness({
      n: 2, d: 3, lg: 4,
      sequence: [
        { start: 0, it: 2, isSilence: false },
        { start: 3, it: 1, isSilence: false }
      ]
    });
    expect(engine.getItIndexAtScaledStart(0)).toBe(0);
    expect(engine.getItIndexAtScaledStart(6)).toBe(1); // 3 × n(2)
    expect(engine.getItIndexAtScaledStart(2)).toBe(-1);
  });
});

describe('createItfrEngine — drag', () => {
  test('pointerdown → move → up crea un iT al model', () => {
    const { engine, cycleMarkers, getModel } = buildHarness();

    // Marcador a la subdivisió 1
    cycleMarkers[0].dispatchEvent(pointer('pointerdown'));
    expect(engine.isDragging()).toBe(true);
    expect(document.body.classList.contains('dragging-it')).toBe(true);

    // Timeline 600px / lg 6 → 100px per pols; d=2 → 50px per subdivisió.
    // clientX=250 → 2.5 polsos → subdivisió 5.
    document.dispatchEvent(pointer('pointermove', { clientX: 250 }));
    document.dispatchEvent(pointer('pointerup'));

    expect(engine.isDragging()).toBe(false);
    expect(document.body.classList.contains('dragging-it')).toBe(false);
    expect(getModel()).toEqual([{ start: 1, it: 5, isSilence: false }]);
  });

  test('pointercancel neteja sense fer commit', () => {
    const { engine, cycleMarkers, getModel, timeline } = buildHarness();

    cycleMarkers[0].dispatchEvent(pointer('pointerdown'));
    document.dispatchEvent(pointer('pointermove', { clientX: 250 }));
    expect(timeline.querySelector('.interval-bar-preview')).not.toBeNull();

    document.dispatchEvent(pointer('pointercancel'));

    expect(engine.isDragging()).toBe(false);
    expect(getModel()).toEqual([]);
    expect(timeline.querySelector('.interval-bar-preview')).toBeNull();
    expect(document.body.classList.contains('dragging-it')).toBe(false);
  });

  test('els listeners de document es retiren en acabar el drag', () => {
    const { cycleMarkers, getModel } = buildHarness();

    cycleMarkers[0].dispatchEvent(pointer('pointerdown'));
    document.dispatchEvent(pointer('pointerup'));
    expect(getModel().length).toBe(1);

    // Un segon pointerup orfe no torna a inserir res
    document.dispatchEvent(pointer('pointerup'));
    expect(getModel().length).toBe(1);
  });

  test('isSelectable exclou elements del drag (App31 non-selectable)', () => {
    const { engine, cycleMarkers, getModel } = buildHarness({
      isSelectable: (el) => !el.classList.contains('non-selectable'),
      prepare: ({ cycleMarkers: markers }) => {
        markers[0].classList.add('non-selectable');
      }
    });

    // El marcador no seleccionable no arrenca cap drag
    cycleMarkers[0].dispatchEvent(pointer('pointerdown'));
    expect(engine.isDragging()).toBe(false);
    document.dispatchEvent(pointer('pointerup'));
    expect(getModel()).toEqual([]);

    // Un de seleccionable sí
    cycleMarkers[1].dispatchEvent(pointer('pointerdown'));
    expect(engine.isDragging()).toBe(true);
    document.dispatchEvent(pointer('pointerup'));
    expect(getModel().length).toBe(1);
  });

  test('drag des d\'un pols enter converteix índex a subdivisió', () => {
    const { engine, pulses, getModel } = buildHarness({ n: 2, d: 4, lg: 4 });
    // Pols 2 amb n=2,d=4 → subdivisió round(2*4/2)=4
    pulses[2].dispatchEvent(pointer('pointerdown'));
    expect(engine.isDragging()).toBe(true);
    document.dispatchEvent(pointer('pointerup'));
    expect(getModel()).toEqual([{ start: 4, it: 1, isSilence: false }]);
  });
});

describe('createItfrEngine — highlights', () => {
  function withCells(harness, count) {
    for (let i = 0; i < count; i++) {
      const cell = document.createElement('div');
      cell.className = 'itfr-value';
      cell.dataset.entryIndex = String(i);
      harness.cellsHost.appendChild(cell);
    }
  }

  test('highlightPulse activa el pols enter i la barra que el conté', () => {
    const h = buildHarness({ sequence: [{ start: 0, it: 4, isSilence: false }] });
    withCells(h, 1);
    h.engine.updateIntervalBars();

    h.engine.highlightPulse(2); // scaledIndex 2 amb d=2 → pols 1 (dins l'iT 0-2)
    expect(h.pulses[1].classList.contains('active')).toBe(true);
    expect(h.timeline.querySelector('.interval-bar-visual').classList.contains('highlight')).toBe(true);
    expect(h.cellsHost.querySelector('[data-entry-index="0"]').classList.contains('active')).toBe(true);

    // Subdivisions no toquen el highlight de pols
    h.engine.highlightPulse(3);
    expect(h.pulses[1].classList.contains('active')).toBe(true);
  });

  test('highlightCycle activa marcador+label i clearHighlights ho neteja tot', () => {
    const h = buildHarness({ sequence: [{ start: 0, it: 4, isSilence: false }] });
    withCells(h, 1);
    h.engine.updateIntervalBars();

    h.engine.highlightCycle({ cycleIndex: 0, subdivisionIndex: 1 });
    const marker = h.cycleMarkers.find(m => m.dataset.cycleIndex === '0' && m.dataset.subdivision === '1');
    expect(marker.classList.contains('active')).toBe(true);

    h.engine.clearHighlights();
    expect(document.querySelectorAll('.active').length).toBe(0);
    expect(document.querySelectorAll('.highlight').length).toBe(0);
  });
});
