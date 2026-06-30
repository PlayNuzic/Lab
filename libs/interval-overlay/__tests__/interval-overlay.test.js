/**
 * @jest-environment jsdom
 */
import { createIntervalOverlay } from '../index.js';

function makeMatrix() {
  const m = document.createElement('div');
  m.className = 'plano-matrix';
  return m;
}

const GEO = { totalColumns: 12, noteCount: 12, cellHeight: 32 };

describe('interval-overlay', () => {
  it('draws one bar+number per event, from baseNote', () => {
    const matrix = makeMatrix();
    const ov = createIntervalOverlay({ matrix });
    ov.render([{ note: 3, column: 0 }, { note: 7, column: 4 }], GEO);

    expect(matrix.querySelectorAll('.iv-bar')).toHaveLength(2);
    expect(matrix.querySelectorAll('.iv-num')).toHaveLength(2);
    const nums = [...matrix.querySelectorAll('.iv-num')].map(n => n.textContent);
    expect(nums).toEqual(['+3', '+4']); // base0→3 = +3, 3→7 = +4
  });

  it('marks ascending vs descending', () => {
    const matrix = makeMatrix();
    const ov = createIntervalOverlay({ matrix });
    ov.render([{ note: 7, column: 0 }, { note: 2, column: 4 }], GEO);
    const bars = matrix.querySelectorAll('.iv-bar');
    expect(bars[0].classList.contains('iv-bar--asc')).toBe(true);  // 0→7
    expect(bars[1].classList.contains('iv-bar--desc')).toBe(true); // 7→2
    expect([...matrix.querySelectorAll('.iv-num')].map(n => n.textContent)).toEqual(['+7', '-5']);
  });

  it('renders interval-zero (unison) as a short bar with "0"', () => {
    const matrix = makeMatrix();
    const ov = createIntervalOverlay({ matrix });
    // base0→5 (+5), then 5→5 (0)
    ov.render([{ note: 5, column: 0 }, { note: 5, column: 6 }], GEO);
    expect(matrix.querySelectorAll('.iv-bar--zero')).toHaveLength(1);
    const nums = [...matrix.querySelectorAll('.iv-num')].map(n => n.textContent);
    expect(nums).toContain('0');
  });

  it('showNumbers:false hides numbers but keeps bars', () => {
    const matrix = makeMatrix();
    const ov = createIntervalOverlay({ matrix });
    ov.render([{ note: 3, column: 0 }, { note: 7, column: 4 }], { ...GEO, showNumbers: false });
    expect(matrix.querySelectorAll('.iv-bar')).toHaveLength(2);
    expect(matrix.querySelectorAll('.iv-num')).toHaveLength(0);
  });

  it('skips rests without breaking the chain', () => {
    const matrix = makeMatrix();
    const ov = createIntervalOverlay({ matrix });
    // base0→3 (+3), rest (skipped), 3→8 (+5)
    ov.render([
      { note: 3, column: 0 },
      { note: null, column: 2, isRest: true },
      { note: 8, column: 4 }
    ], GEO);
    const nums = [...matrix.querySelectorAll('.iv-num')].map(n => n.textContent);
    expect(nums).toEqual(['+3', '+5']);
  });

  it('clear() empties the overlay layer', () => {
    const matrix = makeMatrix();
    const ov = createIntervalOverlay({ matrix });
    ov.render([{ note: 3, column: 0 }], GEO);
    expect(matrix.querySelectorAll('.iv-bar').length).toBeGreaterThan(0);
    ov.clear();
    expect(matrix.querySelectorAll('.iv-bar')).toHaveLength(0);
  });

  it('re-render replaces previous content (no accumulation)', () => {
    const matrix = makeMatrix();
    const ov = createIntervalOverlay({ matrix });
    ov.render([{ note: 3, column: 0 }, { note: 7, column: 4 }], GEO);
    ov.render([{ note: 1, column: 0 }], GEO);
    expect(matrix.querySelectorAll('.iv-bar')).toHaveLength(1);
    expect(matrix.querySelectorAll('.iv-overlay')).toHaveLength(1);
  });

  it('no-ops without throwing when geometry is incomplete', () => {
    const matrix = makeMatrix();
    const ov = createIntervalOverlay({ matrix });
    expect(() => ov.render([{ note: 3, column: 0 }], { totalColumns: 0, cellHeight: 0 })).not.toThrow();
    expect(matrix.querySelectorAll('.iv-bar')).toHaveLength(0);
  });
});
