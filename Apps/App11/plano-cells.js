// App11: notes del plànol (una per pols) i melodia que sona.
// Separat de main.js perquè es pugui provar sense àudio.

/** Treu la nota d'una cel·la: classe i etiqueta P-N. */
export function deselectCell(cell) {
  cell.classList.remove('active', 'fading-out');
  cell.querySelector('.cell-label')?.remove();
}

/**
 * Posa la nota de la cel·la i treu qualsevol altra del mateix pols: el plànol
 * és monofònic. Ho fan servir tant el clic de l'usuari com el playback (test
 * P2-02: un clic just després del ▶ i la nota aleatòria del pols 0 quedaven
 * totes dues).
 * @param {ParentNode} root - on buscar les altres notes (el plànol o document)
 * @param {HTMLElement} cell - cel·la amb data-pulse i data-note
 * @returns {HTMLElement} la mateixa cel·la
 */
export function selectCell(root, cell) {
  const { pulse, note } = cell.dataset;
  root.querySelectorAll('.musical-cell.active').forEach(prev => {
    if (prev !== cell && prev.dataset.pulse === pulse) deselectCell(prev);
  });
  cell.classList.add('active');
  if (!cell.querySelector('.cell-label')) {
    const label = document.createElement('span');
    label.className = 'cell-label';
    label.textContent = `( ${pulse} , ${note} )`;
    cell.appendChild(label);
  }
  return cell;
}

/**
 * La melodia que està sonant. Es fixa en prémer ▶, però un clic durant la
 * reproducció la canvia: el que es veu al plànol és el que sona. Fora de la
 * reproducció no guarda res (set/remove no fan res).
 */
export function createLiveSequence() {
  let byPulse = null;
  return {
    /** @param {Array<{pulse: number, note: number}>} notes */
    start(notes) {
      byPulse = new Map(notes.map(({ pulse, note }) => [pulse, note]));
    },
    stop() { byPulse = null; },
    isPlaying() { return byPulse !== null; },
    /** @returns {number|undefined} */
    noteAt(pulse) { return byPulse?.get(pulse); },
    set(pulse, note) { byPulse?.set(pulse, note); },
    remove(pulse) { byPulse?.delete(pulse); }
  };
}
