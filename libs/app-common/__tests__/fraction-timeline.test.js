/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { createFractionTimeline, decoratePulseWithEndDot } from '../fraction-timeline.js';
import { createFractionHighlighter } from '../fraction-highlight.js';

function build({ lg = 6, n = 1, d = 2, ...rest } = {}) {
  const timeline = document.createElement('div');
  document.body.appendChild(timeline);
  const tl = createFractionTimeline({
    timeline,
    getLg: () => lg,
    getNumerator: () => n,
    getDenominator: () => d,
    ...rest
  });
  return { timeline, tl };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('createFractionTimeline', () => {
  test('renderitza polsos 0..Lg, etiqueta n/d i subdivisions fraccionàries', () => {
    const { timeline, tl } = build({ lg: 6, n: 1, d: 2 });
    tl.render();

    expect(tl.getPulses().length).toBe(7);
    expect(timeline.querySelector('.subdivision-label').textContent).toBe('1/2');
    // 6 cicles × (d-1)=1 subdivisió fraccionària
    expect(tl.getCycleMarkers().length).toBe(6);
    expect(tl.getCycleLabels().length).toBe(6);
    expect(tl.getCycleLabels()[0].textContent).toBe('.1');

    // Decoració per defecte: '·' al final
    const last = tl.getPulses()[6];
    expect(last.classList.contains('cycle-end')).toBe(true);
    expect(last.textContent).toBe('·');

    // Datasets per a tots els consumidors (tokens 28/29, drag 30/31)
    const m = tl.getCycleMarkers()[2]; // cicle 2, subdivisió 1
    expect(m.dataset.cycleIndex).toBe('2');
    expect(m.dataset.subdivision).toBe('1');
    expect(m.dataset.base).toBe('2');        // cycleIndex × n
    expect(m.dataset.globalSubdiv).toBe('5'); // cycleIndex × d + s
  });

  test('layout posiciona per percentatge horitzontal', () => {
    const { tl } = build({ lg: 4, n: 1, d: 2 });
    tl.render();
    expect(tl.getPulses()[2].style.left).toBe('50%');
    // Primera subdivisió fraccionària a 0.5 polsos → 12.5%
    expect(tl.getCycleMarkers()[0].style.left).toBe('12.5%');
  });

  test('decoradors custom substitueixen el comportament per defecte', () => {
    const decoratePulse = (el, { index, lg }) => {
      if (index === 0 || index === lg) el.classList.add('endpoint');
      else el.classList.add('ghost');
    };
    const decorateSubdivision = jest.fn((el) => el.classList.add('non-selectable'));
    const onAfterRender = jest.fn();

    const { tl } = build({ lg: 2, n: 2, d: 3, decoratePulse, decorateSubdivision, onAfterRender });
    tl.render();

    expect(tl.getPulses()[0].classList.contains('endpoint')).toBe(true);
    expect(tl.getPulses()[1].classList.contains('ghost')).toBe(true);
    expect(tl.getPulses()[2].textContent).toBe('2'); // sense '·' per defecte
    // marcador + etiqueta per cada subdivisió fraccionària
    expect(decorateSubdivision).toHaveBeenCalledTimes(tl.getCycleMarkers().length * 2);
    expect(tl.getCycleMarkers()[0].classList.contains('non-selectable')).toBe(true);
    expect(onAfterRender).toHaveBeenCalledWith(expect.objectContaining({
      pulses: tl.getPulses(),
      cycleMarkers: tl.getCycleMarkers()
    }));
  });

  test('re-render neteja el DOM anterior', () => {
    const { timeline, tl } = build();
    tl.render();
    tl.render();
    expect(timeline.querySelectorAll('.pulse-number').length).toBe(7);
    expect(timeline.querySelectorAll('.subdivision-label').length).toBe(1);
  });
});

describe('createFractionHighlighter', () => {
  function buildWithHighlighter(hooks = {}) {
    const { tl } = build({ lg: 4, n: 1, d: 3 });
    tl.render();
    const hl = createFractionHighlighter({
      getPulses: tl.getPulses,
      getCycleMarkers: tl.getCycleMarkers,
      getCycleLabels: tl.getCycleLabels,
      ...hooks
    });
    return { tl, hl };
  }

  test('highlightPulseIndex activa el pols i només un', () => {
    const { tl, hl } = buildWithHighlighter();
    hl.highlightPulseIndex(2);
    expect(tl.getPulses()[2].classList.contains('active')).toBe(true);
    hl.highlightPulseIndex(3);
    expect(tl.getPulses()[2].classList.contains('active')).toBe(false);
    expect(tl.getPulses()[3].classList.contains('active')).toBe(true);
  });

  test('highlightCycle activa la parella marcador+etiqueta i informa base', () => {
    const onCycleHighlight = jest.fn();
    const { tl, hl } = buildWithHighlighter({ onCycleHighlight });

    hl.highlightCycle({ cycleIndex: 1, subdivisionIndex: 2 });
    const marker = tl.getCycleMarkers().find(m =>
      m.dataset.cycleIndex === '1' && m.dataset.subdivision === '2');
    expect(marker.classList.contains('active')).toBe(true);
    expect(onCycleHighlight).toHaveBeenCalledWith({ cycleIndex: 1, subdivisionIndex: 2, base: 1 });

    // Payload invàlid: no peta ni canvia res
    hl.highlightCycle({});
    expect(marker.classList.contains('active')).toBe(true);
  });

  test('clear apaga tot i crida onClear', () => {
    const onClear = jest.fn();
    const { tl, hl } = buildWithHighlighter({ onClear });
    hl.highlightPulseIndex(1);
    hl.highlightCycle({ cycleIndex: 0, subdivisionIndex: 1 });
    hl.clear();
    expect(document.querySelectorAll('.active').length).toBe(0);
    expect(onClear).toHaveBeenCalled();
  });
});
