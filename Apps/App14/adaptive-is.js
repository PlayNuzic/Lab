// App14: canvi adaptatiu d'un iS dins la seqüència i text de l'avís.
// Mòdul pur (sense DOM) perquè es pugui provar.

/**
 * Canvia intervals[idx] per newVal. Si hi ha un iS següent, li resta la
 * diferència perquè les notes posteriors no es moguin (la nota de després
 * d'aquest iS següent és la mateixa d'abans, per tant sempre és vàlida).
 * No modifica l'array d'entrada.
 *
 * @param {number[]} intervals - seqüència d'iS actual (comença a la nota 0)
 * @param {number} idx - posició de l'iS editat
 * @param {number} newVal - valor nou
 * @param {{minNote?: number, maxNote?: number}} [range]
 * @returns {{ok: true, intervals: number[], adjustedIndex: number|null, adjustedDelta: number}
 *          | {ok: false, message: string}}
 */
export function applyAdaptiveChange(intervals, idx, newVal, { minNote = 0, maxNote = 11 } = {}) {
  if (idx === 0 && newVal < 0) {
    return { ok: false, message: 'Primer iS ≥ 0' };
  }

  // La nota just després de l'iS editat ha de quedar dins el rang
  let noteBefore = 0;
  for (let i = 0; i < idx; i++) noteBefore += intervals[i];
  const newNoteAtIdx = noteBefore + newVal;
  if (newNoteAtIdx < minNote || newNoteAtIdx > maxNote) {
    return { ok: false, message: `iS fuera de rango [${minNote - noteBefore}, ${maxNote - noteBefore}]` };
  }

  const trial = intervals.slice();
  const delta = newVal - trial[idx];
  trial[idx] = newVal;

  let adjustedIndex = null;
  let adjustedDelta = 0;

  // L'iS següent absorbeix la diferència (retallat al rang per seguretat)
  if (idx + 1 < trial.length && delta !== 0) {
    const target = trial[idx + 1] - delta;
    const clamped = Math.max(minNote - newNoteAtIdx, Math.min(maxNote - newNoteAtIdx, target));
    trial[idx + 1] = clamped;
    adjustedIndex = idx + 1;
    adjustedDelta = clamped - intervals[idx + 1];
  }

  // Comprovació final de tota la seqüència
  let note = 0;
  for (const iv of trial) {
    note += iv;
    if (note < minNote || note > maxNote) {
      return { ok: false, message: 'El valor invalida la secuencia' };
    }
  }

  return { ok: true, intervals: trial, adjustedIndex, adjustedDelta };
}

/**
 * Avís quan l'iS següent s'ha ajustat sol. Diu el valor que hi ha quedat (el
 * que es veu a la casella), no quant ha canviat: amb «Ajustado iS₂: +4» i un
 * +3 a la casella, al test P2-02 no s'entenia.
 * @param {number} index - posició (0-based) de l'iS ajustat
 * @param {number} value - valor final d'aquest iS
 * @returns {string}
 */
export function formatAdjustNotice(index, value) {
  const shown = value > 0 ? `+${value}` : String(value);
  return `iS₍${index + 1}₎ ajustado a ${shown}`;
}
