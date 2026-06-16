/**
 * @jest-environment jsdom
 *
 * F6.scroll: tests UNITARIS de la lògica PURA de notation-system.js
 * (fractionTupletPlan). El render complet del sistema usa VexFlow + mètriques de
 * canvas (no disponibles a jsdom de jest) → es verifica al navegador (CDP) i amb
 * probes jsdom+canvas-stub fora de la suite. Aquí es prova el pla de tuplet, que
 * és el que garanteix que totes les veus comparteixin total de ticks (alineació).
 *
 * Es mocken VexFlow (entry) i subdivision.js perquè l'import del mòdul no
 * arrossegui dependències de render; fractionTupletPlan només usa
 * resolveFractionNotation (real) i aritmètica.
 */
import { jest } from '@jest/globals';

// VexFlow entry: stubs mínims (fractionTupletPlan no en fa servir cap classe).
jest.unstable_mockModule('../../vendor/vexflow/entry/vexflow-nuzic.js', () => ({
  Renderer: class {}, Stave: class {}, StaveNote: class {}, Voice: class {},
  Formatter: class {}, Tuplet: class { static get LOCATION_TOP() { return 1; } },
  Beam: class {}, Dot: { buildAndAttach() {} }, BarlineType: { SINGLE: 1, END: 3 },
  fontsReady: Promise.resolve()
}));

const { fractionTupletPlan } = await import('../notation-system.js');

const RESOLUTION = 16384;
const QUARTER = RESOLUTION / 4;
const DUR_TICKS = { w: RESOLUTION, h: RESOLUTION / 2, q: RESOLUTION / 4, '8': RESOLUTION / 8, '16': RESOLUTION / 16, '32': RESOLUTION / 32, '64': RESOLUTION / 64 };
function figTicks(dur, dots = 0) { let c = DUR_TICKS[dur], t = c; for (let i = 0; i < dots; i++) { c /= 2; t += c; } return t; }

describe('fractionTupletPlan (alineació de ticks)', () => {
  // Per a CADA (n,d) del rang d'App4, el cicle de `d` notes ha d'omplir
  // EXACTAMENT `n` negres → totes les veus comparteixen total → un sol Formatter
  // alinea els cops simultanis sense TickMismatch.
  test('el cicle omple exactament n negres per a tot n∈[1,7], d∈[1,12]', () => {
    for (let n = 1; n <= 7; n += 1) {
      for (let d = 1; d <= 12; d += 1) {
        const plan = fractionTupletPlan(n, d);
        const f = figTicks(plan.duration, plan.dots);
        // ticks de cada nota dins del tuplet = figura × notesOccupied/numNotes
        const perNote = f * (plan.notesOccupied / plan.numNotes);
        const cycle = perNote * d;
        expect(Math.abs(cycle - n * QUARTER)).toBeLessThan(1e-6);
      }
    }
  });

  test('figura potència de 2 que ja omple → cap tuplet (1/2, 1/4, 3/2)', () => {
    expect(fractionTupletPlan(1, 2).needsTuplet).toBe(false); // 2 corxeres = 1 negra
    expect(fractionTupletPlan(1, 4).needsTuplet).toBe(false); // 4 semicorxeres = 1 negra
    expect(fractionTupletPlan(3, 2).needsTuplet).toBe(false); // 2 negres amb punt = 3 negres
  });

  test('tresillo/cinquillo/etc. → tuplet amb ràtio visible (notesOccupied enter)', () => {
    const p13 = fractionTupletPlan(1, 3);
    expect(p13.needsTuplet).toBe(true);
    expect(p13.ratioed).toBe(true);
    expect(Number.isInteger(p13.notesOccupied)).toBe(true);
    const p17 = fractionTupletPlan(1, 7);
    expect(p17.needsTuplet).toBe(true);
    expect(p17.ratioed).toBe(true);
  });

  test('numerador 5/7 amb figura amb punt/rodona → ràtio amagada (compte sol)', () => {
    // 5/2: notesOccupied = 5*Q / figura(h.) = 5*4096 / 6144 = 3.33… (no enter)
    const p52 = fractionTupletPlan(5, 2);
    expect(p52.needsTuplet).toBe(true);
    expect(p52.ratioed).toBe(false);
    expect(Number.isInteger(p52.notesOccupied)).toBe(false);
    const p73 = fractionTupletPlan(7, 3);
    expect(p73.ratioed).toBe(false);
  });

  test('numNotes és sempre el denominador (subdivisions per cicle)', () => {
    expect(fractionTupletPlan(2, 3).numNotes).toBe(3);
    expect(fractionTupletPlan(1, 12).numNotes).toBe(12);
    expect(fractionTupletPlan(6, 5).numNotes).toBe(5);
  });

  test('figures beamables (corxera i més curtes) marquen beamable=true', () => {
    expect(fractionTupletPlan(1, 3).beamable).toBe(true);   // corxera
    expect(fractionTupletPlan(1, 12).beamable).toBe(true);  // fusa
    expect(fractionTupletPlan(3, 2).beamable).toBe(false);  // negra amb punt
  });
});
