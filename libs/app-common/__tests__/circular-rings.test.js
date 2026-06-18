/**
 * @jest-environment jsdom
 */

// Tests del mòdul d'anells concèntrics (App4 F5a).
// La geometria de referència és docs/app4-rings-sketch.html.

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  createCircularRings,
  idealRadius,
  resolveRadii,
  computeLabelStep,
  computeLabelList,
  computeCycleLineStep,
  dotMetrics,
  saturatedAccent,
  RING_GEOMETRY
} from '../circular-rings.js';

const { R0, RMIN, RMAX, GAP, RING_STROKE, BASE_STROKE, INNER_CLAMP_MARGIN } = RING_GEOMETRY;
// Centerline de la banda base ampla (creix cap endins, vora exterior fixa).
const BASE_BAND_CENTER = R0 - (BASE_STROKE - RING_STROKE) / 2;

describe('idealRadius', () => {
  it('s=1 → exactament R0 (mateixa velocitat que el pols)', () => {
    expect(idealRadius(1)).toBe(R0);
  });

  it('s=4, k=0.35 → ~1.62·R0, dins del clamp', () => {
    const r = idealRadius(4, 0.35);
    expect(r).toBeCloseTo(R0 * Math.pow(4, 0.35), 9);
    expect(r / R0).toBeCloseTo(1.6245, 3);
    expect(r).toBeGreaterThan(R0);
    expect(r).toBeLessThan(RMAX);
  });

  it('s molt gran → clamp a RMAX', () => {
    expect(idealRadius(100)).toBe(RMAX);
  });

  it('s molt petit → clamp a RMIN', () => {
    expect(idealRadius(0.001)).toBe(RMIN);
  });

  it('respecta la k passada com a opció', () => {
    expect(idealRadius(2, 0.5)).toBeCloseTo(R0 * Math.SQRT2, 9);
  });
});

describe('resolveRadii', () => {
  it('sense fraccions → només la base, fixa a R0', () => {
    expect(resolveRadii([])).toEqual({ base: R0 });
  });

  it('fracció més ràpida (1/4) queda per fora de la base (≥ R0 + GAP)', () => {
    const radii = resolveRadii([{ id: 'f1', numerator: 1, denominator: 4 }]);
    expect(radii.base).toBe(R0);
    expect(radii.f1).toBeGreaterThanOrEqual(R0 + GAP);
    expect(radii.f1).toBeCloseTo(idealRadius(4), 9); // l'ideal ja respecta el GAP
  });

  it('fracció més lenta (3/2) queda per dins, esquivant la banda base ampla', () => {
    const radii = resolveRadii([{ id: 'f1', numerator: 3, denominator: 2 }]);
    expect(radii.base).toBe(R0);
    // adjacent a la base ampla → GAP + (BASE_STROKE − RING_STROKE) de clearança
    expect(radii.f1).toBeCloseTo(R0 - GAP - (BASE_STROKE - RING_STROKE), 9);
  });

  it('dues fraccions iguals se separen exactament GAP', () => {
    const radii = resolveRadii([
      { id: 'a', numerator: 1, denominator: 2 },
      { id: 'b', numerator: 1, denominator: 2 }
    ]);
    const ideal = idealRadius(2);
    expect(Math.abs(radii.a - radii.b)).toBeCloseTo(GAP, 9);
    expect(Math.min(radii.a, radii.b)).toBeCloseTo(ideal, 9);
  });

  it('empat amb la base → la base (fixa) va primer i la fracció s\'aparta enfora', () => {
    const radii = resolveRadii([{ id: 'f1', numerator: 1, denominator: 1 }]); // s=1 → ideal R0
    expect(radii.base).toBe(R0);
    expect(radii.f1).toBeCloseTo(R0 + GAP, 9);
  });

  it('cas mixt de l\'esbós (1/4, 3/2, 7/8): ràpid fora, lent dins, mitjà empès al GAP', () => {
    const radii = resolveRadii([
      { id: 'f1', numerator: 1, denominator: 4 }, // s=4 → ideal ~251.8
      { id: 'f2', numerator: 3, denominator: 2 }, // s=2/3 → ideal ~134.5
      { id: 'f3', numerator: 7, denominator: 8 }  // s=8/7 → ideal ~162.4
    ]);
    expect(radii.base).toBe(R0);
    expect(radii.f2).toBeCloseTo(R0 - GAP - (BASE_STROKE - RING_STROKE), 9); // endins, esquiva banda ampla
    expect(radii.f3).toBeCloseTo(R0 + GAP, 9);          // enfora: 195 (ideal 162.4 < 195)
    expect(radii.f1).toBeCloseTo(idealRadius(4), 9);    // ~251.8 ≥ 195 + GAP
    expect(radii.f1 - radii.f3).toBeGreaterThanOrEqual(GAP);
  });

  it('clamp final: la pila interior mai baixa de RMIN − 14', () => {
    const slow = (id) => ({ id, numerator: 7, denominator: 1 }); // s=1/7, ideal ~78.4
    const radii = resolveRadii([slow('a'), slow('b'), slow('c'), slow('d'), slow('e')]);
    const values = ['a', 'b', 'c', 'd', 'e'].map((id) => radii[id]);
    for (const r of values) {
      expect(r).toBeGreaterThanOrEqual(RMIN - INNER_CLAMP_MARGIN);
      expect(r).toBeLessThanOrEqual(RMAX);
    }
    // La pila s'enfonsa per sota del clamp → els més interiors hi queden clavats.
    expect(Math.min(...values)).toBe(RMIN - INNER_CLAMP_MARGIN);
  });

  it('clamp final: la pila exterior mai supera RMAX', () => {
    const fast = (id) => ({ id, numerator: 1, denominator: 12 }); // ideal clamp a 256
    const radii = resolveRadii([fast('a'), fast('b'), fast('c')]);
    for (const id of ['a', 'b', 'c']) {
      expect(radii[id]).toBeLessThanOrEqual(RMAX);
    }
  });
});

describe('computeLabelStep / computeLabelList', () => {
  it('lg=8 → tots els números caben (pas 1)', () => {
    expect(computeLabelStep(8)).toBe(1);
    expect(computeLabelList(8, 4)).toHaveLength(8);
  });

  it('lg=210 → mode rellotge (pas > 1)', () => {
    const step = computeLabelStep(210);
    expect(step).toBeGreaterThan(1);
    // números al terç interior de la banda ampla: r ≈ 117.7 → spacing ≈ 3.52
    // → pas = ceil(18/3.52) = 6
    expect(step).toBe(6);
  });

  it('els múltiples de bigCycle SEMPRE s\'etiqueten, encara que el pas els salti', () => {
    const labels = computeLabelList(210, 7);
    const indices = labels.map((l) => l.index);
    for (let i = 0; i < 210; i += 7) {
      expect(indices).toContain(i);
      expect(labels.find((l) => l.index === i).isCycleStart).toBe(true);
    }
    // 7 NO és múltiple del pas (5): la majoria d'inicis de cicle hi són només
    // perquè són inici de cicle, no perquè caiguin al pas d'etiquetatge.
    expect(7 % computeLabelStep(210)).not.toBe(0);
  });

  it('els inicis de cicle es marquen com a isCycleStart i la resta no', () => {
    const labels = computeLabelList(8, 4);
    expect(labels.filter((l) => l.isCycleStart).map((l) => l.index)).toEqual([0, 4]);
    expect(labels.find((l) => l.index === 3).isCycleStart).toBe(false);
  });
});

describe('computeCycleLineStep', () => {
  it('pocs cicles → una línia per cicle', () => {
    expect(computeCycleLineStep(12, 3)).toBe(3);
    expect(computeCycleLineStep(16, 8)).toBe(8);
  });

  it('més de 24 cicles → línies espaiades en múltiples de bigCycle', () => {
    expect(computeCycleLineStep(210, 1)).toBe(9); // ceil(210/24) = 9
    expect(computeCycleLineStep(60, 1)).toBe(3);  // ceil(60/24) = 3
  });
});

describe('dotMetrics', () => {
  it('anell dens (288 punts, radi petit) → dotR clavat al mínim 1.2', () => {
    const { dotR, strokeWidth } = dotMetrics(288, RMIN, false);
    expect(dotR).toBe(1.2);
    expect(strokeWidth).toBe(1); // clamp inferior del traç
  });

  it('anell dens al radi màxim (lg=24, d=12 → 288 punts a r=256) → punts petits', () => {
    const { dotR } = dotMetrics(288, RMAX, false);
    expect(dotR).toBeLessThan(2);
    expect(dotR).toBeGreaterThanOrEqual(1.2);
  });

  it('anell base poc dens → dotR al màxim de base (10)', () => {
    const { dotR, strokeWidth } = dotMetrics(8, R0, true);
    expect(dotR).toBe(10);
    expect(strokeWidth).toBe(2.5);
  });

  it('anell de fracció poc dens → dotR al màxim de fracció (10, igual que base)', () => {
    expect(dotMetrics(8, R0, false).dotR).toBe(10);
  });
});

describe('saturatedAccent', () => {
  const hsl = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const l = (mx + mn) / 2;
    const s = mx === mn ? 0 : (l > 0.5 ? (mx - mn) / (2 - mx - mn) : (mx - mn) / (mx + mn));
    return { s, l };
  };

  it('retorna un hex de 6 dígits', () => {
    expect(saturatedAccent('#FFBB33')).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('un color clar/viu queda més saturat i no més clar (s\'aprofundeix)', () => {
    const out = hsl(saturatedAccent('#FFBB33'));
    const src = hsl('#FFBB33');
    expect(out.s).toBeGreaterThanOrEqual(src.s - 1e-9);
    expect(out.l).toBeLessThanOrEqual(src.l);
  });

  it('un color fosc s\'aclareix (per ser visible sobre la seva banda)', () => {
    const out = hsl(saturatedAccent('#43433B'));
    expect(out.l).toBeGreaterThan(hsl('#43433B').l);
    expect(out.l).toBeGreaterThanOrEqual(0.4);
  });

  it('admet hex de 3 dígits i retorna no-hex tal qual', () => {
    expect(saturatedAccent('#f93')).toMatch(/^#[0-9a-f]{6}$/);
    expect(saturatedAccent('var(--nuzic-green)')).toBe('var(--nuzic-green)');
  });
});

// ─────────────────────────── DOM ───────────────────────────

describe('createCircularRings (DOM)', () => {
  let container;
  let onDotClick;
  let rings;

  // Estat tipus: lg=12, cicle gran 3, base 12 pulsos, una fracció 3/2 (8 ticks).
  function renderScenario() {
    rings.render({
      lg: 12,
      bigCycle: 3,
      base: {
        label: 'Pols',
        dots: Array.from({ length: 12 }, (_, i) => ({
          index: i,
          selected: i === 2,
          selectable: i !== 0,
          isEndpoint: i === 0
        }))
      },
      fractions: [{
        id: 'f1', numerator: 3, denominator: 2,
        color: '#FFBB33', lightColor: '#ffeecc',
        dots: [{ tickIndex: 1, position: 1.5, selected: true }]
      }]
    });
  }

  const baseDot = (i) => container.querySelector(`[data-ring-id="base"] .crings-dot[data-index="${i}"]`);
  const fracDot = (i) => container.querySelector(`[data-ring-id="f1"] .crings-dot[data-tick-index="${i}"]`);
  const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    onDotClick = jest.fn();
    rings = createCircularRings({ container, onDotClick });
  });

  afterEach(() => {
    rings.destroy();
    container.remove();
  });

  it('crea un <svg> responsiu amb el viewBox de l\'esbós', () => {
    const svg = rings.getElement();
    expect(svg.parentElement).toBe(container);
    expect(svg.getAttribute('viewBox')).toBe('0 0 580 580');
    expect(svg.getAttribute('width')).toBe('100%');
    expect(svg.classList.contains('crings-svg')).toBe(true);
  });

  it('llança si no hi ha container', () => {
    expect(() => createCircularRings({})).toThrow();
  });

  describe('render()', () => {
    beforeEach(renderScenario);

    it('dibuixa un cercle per anell (base + 1 fracció)', () => {
      expect(container.querySelectorAll('.crings-ring')).toHaveLength(2);
      expect(container.querySelector('[data-ring-id="base"]')).not.toBeNull();
      expect(container.querySelector('[data-ring-id="f1"]')).not.toBeNull();
    });

    it('compta els punts: lg a la base, round(lg/(n/d)) a la fracció', () => {
      expect(container.querySelectorAll('[data-ring-id="base"] .crings-dot')).toHaveLength(12);
      expect(container.querySelectorAll('[data-ring-id="f1"] .crings-dot')).toHaveLength(8); // 12/(3/2)
    });

    it('etiquetes d\'anell amb el text correcte', () => {
      const labels = [...container.querySelectorAll('.crings-label')].map((t) => t.textContent);
      expect(labels).toContain('Pols');
      expect(labels).toContain('3/2');
    });

    it('números de pols: tots (pas 1) i els inicis de cicle en mode --cycle', () => {
      const numbers = container.querySelectorAll('.crings-number');
      expect(numbers).toHaveLength(12);
      const cycles = [...container.querySelectorAll('.crings-number--cycle')].map((t) => t.textContent);
      expect(cycles).toEqual(['0', '3', '6', '9']);
      expect(numbers[0].getAttribute('font-size')).toBe('13');
    });

    it('línies de cicle als múltiples de bigCycle (4 a lg=12, cicle 3)', () => {
      const lines = container.querySelectorAll('.crings-cycle-line');
      expect(lines).toHaveLength(4);
      expect(lines[0].getAttribute('stroke-width')).toBe('2'); // posició 0
      expect(lines[1].getAttribute('stroke-width')).toBe('1');
    });

    it('estats dels punts: selected, nonselectable i endpoint', () => {
      expect(baseDot(2).classList.contains('crings-dot--selected')).toBe(true);
      expect(baseDot(0).classList.contains('crings-dot--nonselectable')).toBe(true);
      expect(baseDot(0).classList.contains('crings-dot--endpoint')).toBe(true);
      expect(baseDot(1).classList.contains('crings-dot--selected')).toBe(false);
      expect(fracDot(1).classList.contains('crings-dot--selected')).toBe(true);
    });

    it('colors d\'identitat exposats com a variables CSS al grup', () => {
      const group = container.querySelector('[data-ring-id="f1"]');
      expect(group.style.getPropertyValue('--crings-color')).toBe('#FFBB33');
      expect(group.style.getPropertyValue('--crings-light')).toBe('#ffeecc');
    });

    it('la fracció lenta (3/2) es dibuixa per dins de la base', () => {
      const rBase = Number(container.querySelector('[data-ring-id="base"] .crings-ring').getAttribute('r'));
      const rF1 = Number(container.querySelector('[data-ring-id="f1"] .crings-ring').getAttribute('r'));
      // El cercle base es dibuixa a la centerline de la banda ampla (cap endins).
      expect(rBase).toBe(BASE_BAND_CENTER);
      expect(rF1).toBeCloseTo(R0 - GAP - (BASE_STROKE - RING_STROKE), 6);
    });

    it('lg=0 o invàlid → buida el dibuix sense llançar', () => {
      rings.render({ lg: 0 });
      expect(container.querySelectorAll('.crings-dot')).toHaveLength(0);
      expect(() => rings.highlightPosition(1)).not.toThrow();
    });
  });

  describe('mode rellotge i espaiat de línies (lg gran)', () => {
    it('lg=210: números amb pas 6 + inicis de cicle, font 11', () => {
      rings.render({ lg: 210, bigCycle: 30, base: { dots: [] }, fractions: [] });
      const numbers = container.querySelectorAll('.crings-number');
      expect(numbers).toHaveLength(computeLabelList(210, 30).length);
      expect(numbers.length).toBeLessThan(210);
      expect(numbers[0].getAttribute('font-size')).toBe('11');
      const cycleTexts = [...container.querySelectorAll('.crings-number--cycle')].map((t) => Number(t.textContent));
      expect(cycleTexts).toEqual([0, 30, 60, 90, 120, 150, 180]);
    });

    it('més de 24 cicles → línies espaiades (lg=60, cicle 1 → 20 línies)', () => {
      rings.render({ lg: 60, bigCycle: 1, base: { dots: [] }, fractions: [] });
      expect(container.querySelectorAll('.crings-cycle-line')).toHaveLength(20);
    });

    it('anell dens: punts amb radi mínim adaptatiu', () => {
      // lg=24 amb 1/12 → 288 punts a l'anell de la fracció
      rings.render({
        lg: 24, bigCycle: 1,
        base: { dots: [] },
        fractions: [{ id: 'f1', numerator: 1, denominator: 12, color: '#7BB4CD', lightColor: '#e3f0f7', dots: [] }]
      });
      const dots = container.querySelectorAll('[data-ring-id="f1"] .crings-dot');
      expect(dots).toHaveLength(288);
      const r = Number(dots[0].getAttribute('r'));
      expect(r).toBeGreaterThanOrEqual(1.2);
      expect(r).toBeLessThan(2);
    });
  });

  describe('clics', () => {
    beforeEach(renderScenario);

    it('clic en un punt de fracció → payload complet', () => {
      click(fracDot(1));
      expect(onDotClick).toHaveBeenCalledWith({
        type: 'fraction', ringId: 'f1', tickIndex: 1,
        position: 1.5, numerator: 3, denominator: 2
      });
    });

    it('punt de fracció sense info del consumidor → position geomètrica (tick·n/d)', () => {
      click(fracDot(3));
      expect(onDotClick).toHaveBeenCalledWith(expect.objectContaining({
        type: 'fraction', tickIndex: 3, position: 4.5
      }));
    });

    it('clic en un pols base → { type: "int", index }', () => {
      click(baseDot(3));
      expect(onDotClick).toHaveBeenCalledWith({ type: 'int', index: 3 });
    });

    it('punt nonselectable NO dispara onDotClick', () => {
      click(baseDot(0));
      expect(onDotClick).not.toHaveBeenCalled();
    });

    it('clic fora dels punts (al cercle) no dispara res', () => {
      click(container.querySelector('.crings-ring'));
      expect(onDotClick).not.toHaveBeenCalled();
    });
  });

  describe('highlightPosition / clearHighlights', () => {
    beforeEach(renderScenario);

    it('il·lumina el punt correcte de CADA anell (floor(pos/step))', () => {
      rings.highlightPosition(3.2);
      expect(baseDot(3).classList.contains('crings-dot--active')).toBe(true);
      expect(fracDot(2).classList.contains('crings-dot--active')).toBe(true); // floor(3.2/1.5)=2
      expect(container.querySelectorAll('.crings-dot--active')).toHaveLength(2);
    });

    it('en avançar, apaga l\'anterior i encén el nou (toggle barat)', () => {
      rings.highlightPosition(3.2);
      rings.highlightPosition(4.7);
      expect(baseDot(3).classList.contains('crings-dot--active')).toBe(false);
      expect(baseDot(4).classList.contains('crings-dot--active')).toBe(true);
      expect(fracDot(3).classList.contains('crings-dot--active')).toBe(true); // floor(4.7/1.5)=3
      expect(container.querySelectorAll('.crings-dot--active')).toHaveLength(2);
    });

    it('embolcalla la posició amb mòdul (pos ≥ lg)', () => {
      rings.highlightPosition(12.5);
      expect(baseDot(0).classList.contains('crings-dot--active')).toBe(true);
    });

    it('mostra i orienta l\'agulla; clearHighlights l\'amaga i apaga tot', () => {
      const needle = container.querySelector('.crings-needle');
      expect(needle.classList.contains('crings-needle--visible')).toBe(false);
      rings.highlightPosition(3);
      expect(needle.classList.contains('crings-needle--visible')).toBe(true);
      expect(needle.getAttribute('opacity')).toBe('0.5');
      rings.clearHighlights();
      expect(needle.classList.contains('crings-needle--visible')).toBe(false);
      expect(needle.getAttribute('opacity')).toBe('0');
      expect(container.querySelectorAll('.crings-dot--active')).toHaveLength(0);
    });

    it('re-render reconstrueix la cache: cap actiu ranci i el highlight torna a funcionar', () => {
      rings.highlightPosition(3.2);
      renderScenario(); // re-render complet
      expect(container.querySelectorAll('.crings-dot--active')).toHaveLength(0);
      rings.highlightPosition(0);
      expect(baseDot(0).classList.contains('crings-dot--active')).toBe(true);
      expect(fracDot(0).classList.contains('crings-dot--active')).toBe(true);
    });
  });

  describe('destroy()', () => {
    it('treu l\'SVG del contenidor i deixa el component inert', () => {
      renderScenario();
      const svg = rings.getElement();
      rings.destroy();
      expect(svg.parentElement).toBeNull();
      expect(container.querySelector('svg')).toBeNull();
      expect(() => rings.highlightPosition(1)).not.toThrow();
    });
  });
});
