/**
 * @jest-environment jsdom
 *
 * F6: orquestració multi-fracció de createNotationRenderer (App4). Es mocka
 * rhythm-staff (que arrossega VexFlow) per a poder provar en jsdom la lògica
 * pura: partició de seleccions per fracció, estat del pentagrama base "Pulso",
 * back-compat d'una sola fracció i el cicle de vida (crear/destruir/reordenar)
 * dels pentagrames.
 */
import { jest } from '@jest/globals';

// Cada controller mockejat enregistra les seves crides perquè els tests les
// inspeccionin (l'últim render, els destroy, l'ordre dels hosts al DOM).
const createdControllers = [];
const createRhythmStaffMock = jest.fn(({ container }) => {
  const controller = {
    container,
    lastRender: null,
    renderCalls: [],
    cursorCalls: [],
    resetCalls: 0,
    destroyed: false,
    render(state) { this.lastRender = state; this.renderCalls.push(state); },
    updateCursor(pulse, playing) { this.cursorCalls.push([pulse, playing]); },
    resetCursor() { this.resetCalls += 1; },
    destroy() { this.destroyed = true; }
  };
  createdControllers.push(controller);
  return controller;
});

jest.unstable_mockModule('../rhythm-staff.js', () => ({
  createRhythmStaff: createRhythmStaffMock,
  default: createRhythmStaffMock
}));

const { createNotationRenderer } = await import('../renderer.js');

// ─── Dobles de prova ────────────────────────────────────────────────────────

function makePulseMemoryApi(selectedInts = []) {
  const data = [];
  return {
    data,
    ensure(lg) { while (data.length <= lg) data.push(false); selectedInts.forEach((i) => { data[i] = true; }); }
  };
}

// Una selecció fraccionada amb la forma del store d'App4 (n/d LITERAL del slot).
function fractionSelection({ base, numerator, denominator, pulsesPerCycle }) {
  const value = base + numerator / denominator;
  const key = `frac:${base}:${numerator}:${denominator}`;
  return { key, base, numerator, denominator, value, pulsesPerCycle };
}

function makeStore(selections = []) {
  const selectionState = new Map();
  selections.forEach((s) => selectionState.set(s.key, s));
  return { pulseSelections: selections, selectionState };
}

function makePanel(isOpen = true) {
  return { isOpen };
}

function setup({ activeFractions, getFraction, selections = [], selectedInts = [], lg = 24 } = {}) {
  const notationContentEl = document.createElement('div');
  document.body.appendChild(notationContentEl);
  const controller = createNotationRenderer({
    notationContentEl,
    notationPanelController: makePanel(true),
    getFraction: getFraction || (() => ({ numerator: null, denominator: null })),
    getActiveFractions: activeFractions,
    getLg: () => lg,
    fractionStore: makeStore(selections),
    pulseMemoryApi: makePulseMemoryApi(selectedInts),
    createFractionSelectionFromValue: jest.fn(),
    onPulseSelected: jest.fn(),
    onFractionSelected: jest.fn()
  });
  return { controller, notationContentEl };
}

beforeEach(() => {
  createdControllers.length = 0;
  createRhythmStaffMock.mockClear();
  document.body.innerHTML = '';
});

// ─── buildNotationRenderStates ───────────────────────────────────────────────

describe('buildNotationRenderStates (multi-fracció)', () => {
  test('un estat base "Pulso" + un per fracció activa, en ordre', () => {
    const { controller } = setup({
      activeFractions: () => [
        { id: 'f1', numerator: 3, denominator: 2, color: '#FFBB33' },
        { id: 'f2', numerator: 2, denominator: 3, color: '#F28AAD' },
        { id: 'f3', numerator: 1, denominator: 4, color: '#7BB4CD' }
      ]
    });
    const states = controller.buildNotationRenderStates();
    expect(states.map((s) => s.staffId)).toEqual(['base', 'f1', 'f2', 'f3']);

    const base = states[0];
    expect(base.label).toBe('Pulso');
    expect(base.fraction).toBeNull();
    expect(base.color).toBeNull();
    expect(base.pulseFilter).toBe('whole');

    expect(states[1].label).toBe('3/2');
    expect(states[1].fraction).toMatchObject({ numerator: 3, denominator: 2 });
    expect(states[1].color).toBe('#FFBB33');
    expect(states[2].label).toBe('2/3');
    expect(states[2].color).toBe('#F28AAD');
    expect(states[3].label).toBe('1/4');
    expect(states[3].color).toBe('#7BB4CD');
  });

  test('cada estat de fracció duu NOMÉS les seves seleccions (match literal n/d)', () => {
    // Dues fraccions amb el MATEIX denominador però n diferent: la selecció
    // 1/2 (pulsesPerCycle 1) ha d'anar al pentagrama 1/2, no al 3/2.
    const selA = fractionSelection({ base: 0, numerator: 1, denominator: 2, pulsesPerCycle: 1 }); // 0.5
    const selB = fractionSelection({ base: 1, numerator: 1, denominator: 2, pulsesPerCycle: 3 }); // 1.5
    const { controller } = setup({
      lg: 12,
      activeFractions: () => [
        { id: 'f1', numerator: 1, denominator: 2, color: '#FFBB33' },
        { id: 'f2', numerator: 3, denominator: 2, color: '#F28AAD' }
      ],
      selections: [selA, selB]
    });
    const states = controller.buildNotationRenderStates();
    const f1 = states.find((s) => s.staffId === 'f1');
    const f2 = states.find((s) => s.staffId === 'f2');

    // El pentagrama 1/2 inclou la selecció 0.5 (value 0.5 marcat seleccionat).
    expect(f1.selectedIndices).toContain(0.5);
    expect(f1.selectedIndices).not.toContain(1.5);
    // El pentagrama 3/2 inclou la selecció 1.5, no la 0.5.
    expect(f2.selectedIndices).toContain(1.5);
    expect(f2.selectedIndices).not.toContain(0.5);
  });

  test('els enters seleccionats apareixen al base i a cada pentagrama de fracció', () => {
    const { controller } = setup({
      lg: 12,
      selectedInts: [3, 6],
      activeFractions: () => [{ id: 'f1', numerator: 1, denominator: 2, color: '#FFBB33' }]
    });
    const states = controller.buildNotationRenderStates();
    const base = states.find((s) => s.staffId === 'base');
    const f1 = states.find((s) => s.staffId === 'f1');
    expect(base.selectedIndices).toEqual(expect.arrayContaining([0, 3, 6]));
    expect(f1.selectedIndices).toEqual(expect.arrayContaining([0, 3, 6]));
  });

  test('Lg invàlid → null', () => {
    const { controller } = setup({
      lg: 0,
      activeFractions: () => [{ id: 'f1', numerator: 1, denominator: 2 }]
    });
    expect(controller.buildNotationRenderStates()).toBeNull();
  });

  test('una fracció activa amb valors invàlids no genera pentagrama', () => {
    const { controller } = setup({
      activeFractions: () => [
        { id: 'f1', numerator: 3, denominator: 2, color: '#FFBB33' },
        { id: 'f2', numerator: 0, denominator: 0, color: '#F28AAD' }
      ]
    });
    const states = controller.buildNotationRenderStates();
    expect(states.map((s) => s.staffId)).toEqual(['base', 'f1']);
  });
});

// ─── Back-compat (sense getActiveFractions) ──────────────────────────────────

describe('buildNotationRenderStates (back-compat single)', () => {
  test('sense getActiveFractions → un sol estat amb la fracció de getFraction()', () => {
    const notationContentEl = document.createElement('div');
    document.body.appendChild(notationContentEl);
    const controller = createNotationRenderer({
      notationContentEl,
      notationPanelController: makePanel(true),
      getFraction: () => ({ numerator: 2, denominator: 3 }),
      // getActiveFractions OMÈS expressament
      getLg: () => 12,
      fractionStore: makeStore([]),
      pulseMemoryApi: makePulseMemoryApi([]),
      createFractionSelectionFromValue: jest.fn(),
      onPulseSelected: jest.fn(),
      onFractionSelected: jest.fn()
    });
    const states = controller.buildNotationRenderStates();
    expect(states).toHaveLength(1);
    expect(states[0].staffId).toBe('single');
    expect(states[0].label).toBeNull();
    expect(states[0].fraction).toMatchObject({ numerator: 2, denominator: 3 });
  });
});

// ─── Cicle de vida dels pentagrames ──────────────────────────────────────────

describe('cicle de vida dels pentagrames', () => {
  test('render crea un controller per pentagrama desitjat', () => {
    let actives = [{ id: 'f1', numerator: 1, denominator: 2, color: '#FFBB33' }];
    const { controller, notationContentEl } = setup({ activeFractions: () => actives });
    controller.render({ force: true });
    // base + f1
    expect(createdControllers).toHaveLength(2);
    expect(notationContentEl.querySelectorAll('.notation-staff').length).toBe(2);
  });

  test('afegir una fracció crea un nou pentagrama sense destruir els existents', () => {
    let actives = [{ id: 'f1', numerator: 1, denominator: 2, color: '#FFBB33' }];
    const { controller, notationContentEl } = setup({ activeFractions: () => actives });
    controller.render({ force: true });
    const initialCount = createdControllers.length; // 2

    actives = [...actives, { id: 'f2', numerator: 2, denominator: 3, color: '#F28AAD' }];
    controller.render({ force: true });

    expect(createdControllers.length).toBe(initialCount + 1); // +1 (f2)
    expect(createdControllers.some((c) => c.destroyed)).toBe(false);
    expect(notationContentEl.querySelectorAll('.notation-staff').length).toBe(3);
  });

  test('desactivar una fracció destrueix el seu pentagrama i el treu del DOM', () => {
    let actives = [
      { id: 'f1', numerator: 1, denominator: 2, color: '#FFBB33' },
      { id: 'f2', numerator: 2, denominator: 3, color: '#F28AAD' }
    ];
    const { controller, notationContentEl } = setup({ activeFractions: () => actives });
    controller.render({ force: true });
    expect(notationContentEl.querySelectorAll('.notation-staff').length).toBe(3);

    actives = actives.slice(0, 1); // treu f2
    controller.render({ force: true });

    expect(notationContentEl.querySelectorAll('[data-staff-id="f2"]').length).toBe(0);
    expect(notationContentEl.querySelectorAll('.notation-staff').length).toBe(2);
  });

  test('els pentagrames queden en l\'ordre base → F1 → F2 → F3 al DOM', () => {
    const actives = [
      { id: 'f1', numerator: 1, denominator: 2, color: '#FFBB33' },
      { id: 'f2', numerator: 2, denominator: 3, color: '#F28AAD' },
      { id: 'f3', numerator: 1, denominator: 4, color: '#7BB4CD' }
    ];
    const { controller, notationContentEl } = setup({ activeFractions: () => actives });
    controller.render({ force: true });
    const order = Array.from(notationContentEl.querySelectorAll('.notation-staff'))
      .map((el) => el.dataset.staffId);
    expect(order).toEqual(['base', 'f1', 'f2', 'f3']);
  });

  test('updateCursor i resetCursor fan fan-out a tots els pentagrames', () => {
    const actives = [
      { id: 'f1', numerator: 1, denominator: 2, color: '#FFBB33' },
      { id: 'f2', numerator: 2, denominator: 3, color: '#F28AAD' }
    ];
    const { controller } = setup({ activeFractions: () => actives });
    controller.render({ force: true });
    controller.updateCursor(2, true);
    controller.resetCursor();
    // base + f1 + f2 = 3 controllers
    expect(createdControllers).toHaveLength(3);
    createdControllers.forEach((c) => {
      expect(c.cursorCalls).toContainEqual([2, true]);
      expect(c.resetCalls).toBeGreaterThanOrEqual(1);
    });
  });

  test('el color es passa a cada render de pentagrama de fracció', () => {
    const actives = [{ id: 'f1', numerator: 3, denominator: 2, color: '#FFBB33' }];
    const { controller } = setup({ activeFractions: () => actives });
    controller.render({ force: true });
    const colored = createdControllers.find((c) => c.lastRender && c.lastRender.color === '#FFBB33');
    expect(colored).toBeTruthy();
    const base = createdControllers.find((c) => c.lastRender && c.lastRender.color == null);
    expect(base).toBeTruthy();
  });
});
