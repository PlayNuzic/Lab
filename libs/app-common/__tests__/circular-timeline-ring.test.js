/**
 * @jest-environment jsdom
 *
 * Tests for circular-timeline-ring.js (números del donut nuzic).
 * El posicionament real depèn de getBoundingClientRect + rAF (no mesurable a
 * jsdom: width=0 → el callback surt aviat), així que aquí cobrim la creació
 * síncrona dels elements: comptador, etiquetes, classe cycle-start i neteja.
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { renderCircularRingNumbers } from '../circular-timeline-ring.js';

describe('renderCircularRingNumbers', () => {
  let timeline;
  beforeEach(() => {
    timeline = document.createElement('div');
    timeline.className = 'timeline circular';
    document.body.appendChild(timeline);
  });

  test('crea `count` elements .pulse-number amb data-index 0..count-1', () => {
    const els = renderCircularRingNumbers(timeline, { count: 6 });
    expect(els).toHaveLength(6);
    const dom = timeline.querySelectorAll('.pulse-number');
    expect(dom).toHaveLength(6);
    expect([...dom].map(n => n.dataset.index)).toEqual(['0', '1', '2', '3', '4', '5']);
  });

  test('etiqueta per defecte = índex; el text va dins de .pulse-number__text', () => {
    renderCircularRingNumbers(timeline, { count: 3 });
    const texts = [...timeline.querySelectorAll('.pulse-number__text')].map(s => s.textContent);
    expect(texts).toEqual(['0', '1', '2']);
  });

  test('etiqueta personalitzada (p.ex. superíndex de mòdul d\'App17)', () => {
    renderCircularRingNumbers(timeline, { count: 2, label: (i) => `${i}<sup>1</sup>` });
    const spans = timeline.querySelectorAll('.pulse-number__text');
    expect(spans[0].innerHTML).toBe('0<sup>1</sup>');
    expect(spans[1].querySelector('sup')).not.toBeNull();
  });

  test('només el pols 0 rep la classe cycle-start', () => {
    renderCircularRingNumbers(timeline, { count: 4 });
    const dom = [...timeline.querySelectorAll('.pulse-number')];
    expect(dom[0].classList.contains('cycle-start')).toBe(true);
    expect(dom.slice(1).some(n => n.classList.contains('cycle-start'))).toBe(false);
  });

  test('cridar-lo de nou neteja els números previs (no s\'acumulen)', () => {
    renderCircularRingNumbers(timeline, { count: 6 });
    renderCircularRingNumbers(timeline, { count: 3 });
    expect(timeline.querySelectorAll('.pulse-number')).toHaveLength(3);
  });

  test('count invàlid o ≤ 0 → cap element, retorna []', () => {
    expect(renderCircularRingNumbers(timeline, { count: 0 })).toEqual([]);
    expect(renderCircularRingNumbers(timeline, { count: -2 })).toEqual([]);
    expect(renderCircularRingNumbers(timeline, {})).toEqual([]);
    expect(renderCircularRingNumbers(null, { count: 4 })).toEqual([]);
    expect(timeline.querySelectorAll('.pulse-number')).toHaveLength(0);
  });
});
