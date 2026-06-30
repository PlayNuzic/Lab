// libs/interval-overlay/index.js
//
// Overlay de línies i números d'interval (visual idèntic a App15/App25B) per a
// QUALSEVOL graella amb un contenidor posicionat. Per a cada parell de notes
// consecutives dibuixa una barra vertical amb fletxa (sentit asc/desc) + punt
// d'origen i una caixa amb el número (delta). El cas iS(0) (uníson) dibuixa una
// barra curta + el "0" a sobre, sense fletxa ni punt.
//
// Agnòstic de la graella: rep la geometria de l'app i un formatador del valor.
//   - Horitzontal en % EXACTE (`column / totalColumns`) → encaixa amb columnes
//     1fr sense deriva (a diferència de `índex × offsetWidth` arrodonit).
//   - Vertical en px via `cellHeight` (a plano-modular cellHeight és un enter
//     exacte; la línia de divisió d'una nota = `(noteCount - note) * cellHeight`,
//     la mateixa convenció que els note-bars).
//
// Reutilitzable per App32-35 ara; App15/App25B el podrien adoptar després.

const BAR_WIDTH_PX = 4;

/**
 * @param {Object} opts
 * @param {HTMLElement} opts.matrix - contenidor posicionat (p.ex. `.plano-matrix`)
 *   on s'ancora la capa absoluta `.iv-overlay`.
 */
export function createIntervalOverlay({ matrix }) {
  if (!matrix) throw new Error('createIntervalOverlay: cal `matrix`');

  function ensureLayer() {
    let layer = matrix.querySelector('.iv-overlay');
    if (!layer || layer.parentElement !== matrix) {
      layer = document.createElement('div');
      layer.className = 'iv-overlay';
      matrix.appendChild(layer);
    }
    return layer;
  }

  function clear() {
    const layer = matrix.querySelector('.iv-overlay');
    if (layer) layer.innerHTML = '';
  }

  function drawLine(layer, fromNote, toNote, column, geo) {
    const { totalColumns, noteCount, cellHeight, formatValue, showNumbers } = geo;
    const leftPct = (column / totalColumns) * 100;
    const delta = toNote - fromNote;
    // Ancoratge horitzontal del número segons la columna: a la primera (esquerra)
    // s'ancora a la dreta de la línia i a l'última a l'esquerra, perquè la caixa
    // no surti del grid ni trepitgi la soundline. Centrat a la resta.
    const numTx = column <= 0 ? '0' : (column >= totalColumns - 1 ? '-100%' : '-50%');

    // iS(0) — uníson: barra curta centrada a la línia de divisió + "0" a sobre.
    if (delta === 0) {
      const divPx = (noteCount - toNote) * cellHeight;
      const bar = document.createElement('div');
      bar.className = 'iv-bar iv-bar--zero';
      bar.style.left = `${leftPct}%`;
      bar.style.top = `${divPx - cellHeight / 2}px`;
      bar.style.height = `${cellHeight}px`;
      bar.style.width = `${BAR_WIDTH_PX}px`;
      bar.style.transform = 'translateX(-50%)';
      layer.appendChild(bar);

      if (showNumbers) {
        const num = document.createElement('div');
        num.className = 'iv-num';
        num.textContent = '0';
        num.style.left = `${leftPct}%`;
        num.style.top = `${divPx - cellHeight / 2}px`;
        num.style.transform = `translate(${numTx}, -100%)`;
        layer.appendChild(num);
      }
      return;
    }

    // Línies de divisió (vora inferior de la fila de cada nota), en px.
    const fromDiv = (noteCount - fromNote) * cellHeight;
    const toDiv = (noteCount - toNote) * cellHeight;
    const ascending = toNote > fromNote;
    const topEdge = Math.min(fromDiv, toDiv);
    const bottomEdge = Math.max(fromDiv, toDiv);

    const bar = document.createElement('div');
    bar.className = `iv-bar ${ascending ? 'iv-bar--asc' : 'iv-bar--desc'}`;
    bar.style.left = `${leftPct}%`;
    bar.style.top = `${topEdge}px`;
    bar.style.height = `${bottomEdge - topEdge}px`;
    bar.style.width = `${BAR_WIDTH_PX}px`;
    bar.style.transform = 'translateX(-50%)';
    layer.appendChild(bar);

    if (showNumbers) {
      const num = document.createElement('div');
      num.className = 'iv-num';
      num.textContent = formatValue(delta);
      num.style.left = `${leftPct}%`;
      num.style.top = `${(topEdge + bottomEdge) / 2}px`;
      num.style.transform = `translate(${numTx}, -50%)`;
      layer.appendChild(num);
    }
  }

  /**
   * Dibuixa totes les línies des de `baseNote` recorrent els events per columna.
   * Els silencis (`isRest`) no dibuixen línia i no trenquen la cadena (com App15).
   *
   * @param {Array<{note:number, column:number, isRest?:boolean}>} events
   * @param {Object} geo
   * @param {number} geo.totalColumns
   * @param {number} [geo.noteCount=12]
   * @param {number} geo.cellHeight
   * @param {number} [geo.baseNote=0] - nota d'origen implícita (primera línia)
   * @param {Function} [geo.formatValue] - (delta) => string
   */
  function render(events, geo = {}) {
    const layer = ensureLayer();
    layer.innerHTML = '';
    const { totalColumns, cellHeight } = geo;
    if (!Array.isArray(events) || !totalColumns || !cellHeight) return;

    const resolved = {
      totalColumns,
      noteCount: geo.noteCount || 12,
      cellHeight,
      formatValue: geo.formatValue || ((d) => (d > 0 ? `+${d}` : `${d}`)),
      showNumbers: geo.showNumbers !== false   // amaga els números (iS) si false
    };
    const baseNote = geo.baseNote ?? 0;

    const sorted = events
      .filter(e => e && e.note != null && e.column != null)
      .sort((a, b) => a.column - b.column);

    let prevNote = baseNote;
    sorted.forEach(ev => {
      if (ev.isRest) return;
      drawLine(layer, prevNote, ev.note, ev.column, resolved);
      prevNote = ev.note;
    });
  }

  return { render, clear, ensureLayer };
}
