/**
 * @jest-environment jsdom
 *
 * F6.scroll: orquestració de createNotationRenderer (App4). Es mocken rhythm-staff
 * (back-compat single) i notation-system (multi-fracció), que arrosseguen VexFlow,
 * per a poder provar en jsdom la lògica pura: partició de seleccions per fracció,
 * estat del pentagrama base "Pulso", back-compat d'una sola fracció, i el cicle de
 * vida del SISTEMA de pentagrames (un SVG, un Formatter) al camí multi-fracció.
 */
import { jest } from '@jest/globals';

// Controllers mockejats de rhythm-staff (camí SINGLE back-compat).
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

// Sistema mockejat (camí MULTI-FRACCIÓ): UN sol per renderer; enregistra els
// renders (amb les staves mapejades), el cursor i el destroy.
const createdSystems = [];
const createNotationSystemMock = jest.fn((config) => {
  const system = {
    config,
    lastRender: null,
    renderCalls: [],
    cursorCalls: [],
    resetCalls: 0,
    destroyed: false,
    render(state) { this.lastRender = state; this.renderCalls.push(state); },
    updateCursor(pos, playing) { this.cursorCalls.push([pos, playing]); },
    clearCursor() {},
    resetCursor() { this.resetCalls += 1; },
    destroy() { this.destroyed = true; },
    getElement: () => null,
    getLayout: () => ({ lg: 0, staves: [] })
  };
  createdSystems.push(system);
  return system;
});

jest.unstable_mockModule('../rhythm-staff.js', () => ({
  createRhythmStaff: createRhythmStaffMock,
  default: createRhythmStaffMock
}));

jest.unstable_mockModule('../notation-system.js', () => ({
  createNotationSystem: createNotationSystemMock,
  default: createNotationSystemMock
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
  createdSystems.length = 0;
  createRhythmStaffMock.mockClear();
  createNotationSystemMock.mockClear();
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

// ─── Camí multi-fracció: SISTEMA de pentagrames (F6.scroll) ───────────────────

describe('sistema de pentagrames (multi-fracció)', () => {
  test('render crea UN sol sistema i li passa base + fraccions com a staves', () => {
    const actives = [{ id: 'f1', numerator: 1, denominator: 2, color: '#FFBB33' }];
    const { controller, notationContentEl } = setup({ activeFractions: () => actives });
    controller.render({ force: true });
    // UN sistema (no N controllers de rhythm-staff).
    expect(createdSystems).toHaveLength(1);
    expect(createRhythmStaffMock).not.toHaveBeenCalled();
    // El sistema s'allotja directament a notationContentEl (cap sub-div .notation-staff).
    expect(notationContentEl.querySelectorAll('.notation-staff').length).toBe(0);
    const sys = createdSystems[0];
    const render = sys.lastRender;
    expect(render.staves.map((s) => s.id)).toEqual(['base', 'f1']);
    expect(render.lg).toBeGreaterThan(0);
  });

  test('re-render (afegir fracció) reutilitza el MATEIX sistema', () => {
    let actives = [{ id: 'f1', numerator: 1, denominator: 2, color: '#FFBB33' }];
    const { controller } = setup({ activeFractions: () => actives });
    controller.render({ force: true });
    actives = [...actives, { id: 'f2', numerator: 2, denominator: 3, color: '#F28AAD' }];
    controller.render({ force: true });
    // Cap sistema nou: es reutilitza (render torna a cridar-se amb 3 staves).
    expect(createdSystems).toHaveLength(1);
    const sys = createdSystems[0];
    expect(sys.lastRender.staves.map((s) => s.id)).toEqual(['base', 'f1', 'f2']);
  });

  test('les staves passades al sistema duen numerator/denominator/isBase i color', () => {
    const actives = [{ id: 'f1', numerator: 3, denominator: 2, color: '#FFBB33' }];
    const { controller } = setup({ activeFractions: () => actives });
    controller.render({ force: true });
    const { staves } = createdSystems[0].lastRender;
    const base = staves.find((s) => s.id === 'base');
    const f1 = staves.find((s) => s.id === 'f1');
    expect(base.isBase).toBe(true);
    expect(base.color).toBeNull();
    expect(f1.isBase).toBe(false);
    expect(f1.numerator).toBe(3);
    expect(f1.denominator).toBe(2);
    expect(f1.color).toBe('#FFBB33');
  });

  test('Lg invàlid → render del sistema amb lg 0 i staves buides', () => {
    const { controller } = setup({
      lg: 0,
      activeFractions: () => [{ id: 'f1', numerator: 1, denominator: 2 }]
    });
    controller.render({ force: true });
    expect(createdSystems).toHaveLength(1);
    expect(createdSystems[0].lastRender).toEqual({ lg: 0, staves: [] });
  });

  test('updateCursor i resetCursor deleguen al sistema (un sol cursor)', () => {
    const actives = [
      { id: 'f1', numerator: 1, denominator: 2, color: '#FFBB33' },
      { id: 'f2', numerator: 2, denominator: 3, color: '#F28AAD' }
    ];
    const { controller } = setup({ activeFractions: () => actives });
    controller.render({ force: true });
    controller.updateCursor(2, true);
    controller.resetCursor();
    const sys = createdSystems[0];
    expect(sys.cursorCalls).toContainEqual([2, true]);
    expect(sys.resetCalls).toBeGreaterThanOrEqual(1);
  });

  test('getRenderer() retorna el sistema en multi-fracció', () => {
    const actives = [{ id: 'f1', numerator: 1, denominator: 2, color: '#FFBB33' }];
    const { controller } = setup({ activeFractions: () => actives });
    controller.render({ force: true });
    expect(controller.getRenderer()).toBe(createdSystems[0]);
  });

  test('el sistema rep els callbacks de selecció (onPulseSelected/onFractionSelected/store)', () => {
    const actives = [{ id: 'f1', numerator: 1, denominator: 2, color: '#FFBB33' }];
    const { controller } = setup({ activeFractions: () => actives });
    controller.render({ force: true });
    const cfg = createdSystems[0].config;
    expect(typeof cfg.onPulseSelected).toBe('function');
    expect(typeof cfg.onFractionSelected).toBe('function');
    expect(typeof cfg.createFractionSelectionFromValue).toBe('function');
    expect(cfg.fractionStore).toBeTruthy();
  });

  test('destroy destrueix el sistema', () => {
    const actives = [{ id: 'f1', numerator: 1, denominator: 2, color: '#FFBB33' }];
    const { controller } = setup({ activeFractions: () => actives });
    controller.render({ force: true });
    controller.destroy();
    expect(createdSystems[0].destroyed).toBe(true);
  });
});

// ─── Back-compat single: createRhythmStaff (rhythm-staff INTACTE) ─────────────

describe('cicle de vida single (createRhythmStaff)', () => {
  function setupSingle({ getFraction, lg = 12 } = {}) {
    const notationContentEl = document.createElement('div');
    document.body.appendChild(notationContentEl);
    const controller = createNotationRenderer({
      notationContentEl,
      notationPanelController: makePanel(true),
      getFraction: getFraction || (() => ({ numerator: 2, denominator: 3 })),
      // getActiveFractions OMÈS → camí single
      getLg: () => lg,
      fractionStore: makeStore([]),
      pulseMemoryApi: makePulseMemoryApi([]),
      createFractionSelectionFromValue: jest.fn(),
      onPulseSelected: jest.fn(),
      onFractionSelected: jest.fn()
    });
    return { controller, notationContentEl };
  }

  test('render crea un controller de rhythm-staff (NO el sistema)', () => {
    const { controller, notationContentEl } = setupSingle();
    controller.render({ force: true });
    expect(createdSystems).toHaveLength(0);
    expect(createdControllers).toHaveLength(1);
    expect(notationContentEl.querySelectorAll('.notation-staff').length).toBe(1);
  });

  test('updateCursor/resetCursor fan fan-out al controller de rhythm-staff', () => {
    const { controller } = setupSingle();
    controller.render({ force: true });
    controller.updateCursor(2, true);
    controller.resetCursor();
    expect(createdControllers[0].cursorCalls).toContainEqual([2, true]);
    expect(createdControllers[0].resetCalls).toBeGreaterThanOrEqual(1);
  });
});
