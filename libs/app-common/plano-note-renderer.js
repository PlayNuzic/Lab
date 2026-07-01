// libs/app-common/plano-note-renderer.js
// Shared note bar rendering and monophonic overlap management for plano grid apps

/**
 * Render note bars on a plano grid matrix.
 * Each note is a colored div positioned absolutely on the matrix.
 *
 * @param {Object} options
 * @param {HTMLElement} options.matrixContainer - The grid's matrix container element
 * @param {Array<{note: number, startSubdiv: number, duration: number}>} options.notes - Notes to render
 * @param {number} [options.totalColumns] - Total subdivision columns. Quan es passa,
 *   les barres es posicionen horitzontalment en % EXACTE (`col / totalColumns`),
 *   alineades amb les columnes 1fr sense deriva. És el mode preferent (App32-35).
 * @param {number} [options.cellWidth] - Ample de cel·la en px (mode LEGACY,
 *   `índex × cellWidth`). Només s'usa si NO es passa `totalColumns`. ⚠️ Amb
 *   columnSizing:'fr' l'`offsetWidth` arrodonit acumula deriva — prefereix `totalColumns`.
 * @param {number} [options.noteCount=12] - Total number of note rows
 * @param {number} [options.cellHeight=32] - Height of each row in pixels
 * @param {string[]} [options.colors] - Array of colors for note bars (cycles)
 * @param {Function} [options.onClickNote] - Callback when a note bar is clicked: (index) => void
 * @param {Function} [options.formatBarLabel] - Text mostrat dins el rectangle de la
 *   nota. Per defecte l'iT (`duration`); App34/35 el fan servir per mostrar el
 *   número de nota (`note`).
 */
export function renderNoteBars({
  matrixContainer,
  notes,
  totalColumns,
  cellWidth,
  noteCount = 12,
  cellHeight,
  colors,
  onClickNote,
  formatBarLabel = (n) => n.duration
}) {
  // Horitzontal en % exacte quan es coneix el nombre total de columnes; si no,
  // mode legacy en px (índex × cellWidth). Vertical sempre en px: a plano-modular
  // `cellHeight` és un enter exacte, així que no hi ha deriva vertical.
  const usePercent = totalColumns != null && totalColumns > 0;
  // Clear existing bars
  const existingBars = matrixContainer?.querySelectorAll('.note-bar');
  existingBars?.forEach(bar => bar.remove());

  if (!notes || notes.length === 0) return;

  const matrix = matrixContainer?.querySelector('.plano-matrix');
  if (!matrix) return;

  // Measure actual cell height from DOM if not provided — the --plano-cell-height
  // CSS var shrinks on narrower viewports (32→28→24→18→16), so relying on the
  // 32px default would push bars one row down on small screens.
  if (cellHeight === undefined) {
    const firstCell = matrix.querySelector('.plano-cell');
    cellHeight = firstCell?.offsetHeight || 32;
  }

  const defaultColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F1948A', '#82E0AA'];

  const palette = colors || defaultColors;

  let lastNoteRow = Math.floor(noteCount / 2); // Default to middle row for silence positioning

  notes.forEach((noteData, idx) => {
    if (noteData.isRest) {
      // Silence: barra discontínua centrada verticalment SOBRE la mateixa
      // línia on viu el note-bar de l'última nota seleccionada.
      // - Les note-bars d'App34/35 s'ancoren a la línia divisòria entre
      //   files: centre del bar a `(rowIndex+1)*cellHeight`.
      // - Per alinear el silenci amb aquesta línia, fem que el seu
      //   centre també caigui a `(rowIndex+1)*cellHeight`.
      // L'alçada (25% de la cel·la) coincideix amb `.musical-cell.rest`
      // de musical-grid (App15/25/25B) per coherència visual.
      const bar = document.createElement('div');
      bar.className = 'note-bar note-bar--silence';
      const rowIndex = (noteCount - 1) - lastNoteRow;
      const restHeight = cellHeight * 0.25;
      const top = (rowIndex + 1) * cellHeight - restHeight / 2;

      if (usePercent) {
        bar.style.left = `${(noteData.startSubdiv / totalColumns) * 100}%`;
        bar.style.width = `${(noteData.duration / totalColumns) * 100}%`;
      } else {
        bar.style.left = `${noteData.startSubdiv * cellWidth}px`;
        bar.style.width = `${noteData.duration * cellWidth}px`;
      }
      bar.style.top = `${top}px`;
      bar.style.height = `${restHeight}px`;

      matrix.appendChild(bar);
      return;
    }

    lastNoteRow = noteData.note;

    const bar = document.createElement('div');
    bar.className = 'note-bar';
    bar.dataset.noteIndex = idx;

    const rowIndex = (noteCount - 1) - noteData.note;
    const barHeight = cellHeight - 2;
    const top = (rowIndex + 1) * cellHeight - barHeight / 2;

    if (usePercent) {
      bar.style.left = `${(noteData.startSubdiv / totalColumns) * 100}%`;
      bar.style.width = `${(noteData.duration / totalColumns) * 100}%`;
    } else {
      bar.style.left = `${noteData.startSubdiv * cellWidth}px`;
      bar.style.width = `${noteData.duration * cellWidth}px`;
    }
    bar.style.top = `${top}px`;
    bar.style.height = `${barHeight}px`;
    bar.style.background = palette[idx % palette.length];

    const label = document.createElement('span');
    label.className = 'note-bar__label';
    label.textContent = formatBarLabel(noteData);
    bar.appendChild(label);

    if (onClickNote) {
      bar.addEventListener('click', (e) => {
        e.stopPropagation();
        onClickNote(idx);
      });
    }

    matrix.appendChild(bar);
  });
}

/**
 * Render dashed silence lines for the UNCOVERED gaps between notes (estil
 * App15/App25B): una línia discontínua que CONTINUA la fila de l'última nota a
 * través del forat. Els silencis EXPLÍCITS (entrades `isRest` a `notes`) ja els
 * pinta `renderNoteBars` com a `.note-bar--silence`; aquí només omplim els
 * forats no coberts (p.ex. notes separades a la graella sense entrada de silenci).
 *
 * Posicionament HORITZONTAL en % exacte (`col / totalColumns`), VERTICAL en px
 * (cellHeight enter), centrat a la línia de divisió — igual que els note-bars.
 * El forat inicial (abans de la primera nota) NO es pinta (no hi ha nota prèvia).
 *
 * @param {Object} options
 * @param {HTMLElement} options.matrixContainer
 * @param {Array<{note:number, startSubdiv:number, duration:number, isRest?:boolean}>} options.notes
 * @param {number} options.totalColumns
 * @param {number} [options.noteCount=12]
 * @param {number} [options.cellHeight] - mesurat del DOM si no es passa
 */
export function renderSilenceLines({ matrixContainer, notes, totalColumns, noteCount = 12, cellHeight }) {
  const matrix = matrixContainer?.querySelector('.plano-matrix');
  if (!matrix) return;

  // Netejar línies de silenci anteriors (classe pròpia → no la toca renderNoteBars).
  matrix.querySelectorAll('.plano-silence-line').forEach(el => el.remove());

  if (!notes || notes.length === 0 || !totalColumns) return;

  if (cellHeight === undefined) {
    const firstCell = matrix.querySelector('.plano-cell');
    cellHeight = firstCell?.offsetHeight || 32;
  }
  const restHeight = cellHeight * 0.25;

  const sorted = [...notes].sort((a, b) => a.startSubdiv - b.startSubdiv);
  let cursor = 0;            // primera columna encara no coberta
  let lastNoteRow = null;    // fila de l'última NOTA real (no silenci)

  sorted.forEach((n) => {
    // Forat no cobert entre `cursor` i l'inici d'aquesta entrada → línia de silenci
    // (només si ja hi ha hagut una nota: el forat inicial no es pinta).
    if (n.startSubdiv > cursor && lastNoteRow !== null) {
      const rowIndex = (noteCount - 1) - lastNoteRow;
      const top = (rowIndex + 1) * cellHeight - restHeight / 2;
      const line = document.createElement('div');
      line.className = 'plano-silence-line';
      line.style.left = `${(cursor / totalColumns) * 100}%`;
      line.style.width = `${((n.startSubdiv - cursor) / totalColumns) * 100}%`;
      line.style.top = `${top}px`;
      line.style.height = `${restHeight}px`;
      matrix.appendChild(line);
    }
    cursor = Math.max(cursor, n.startSubdiv + n.duration);
    if (!n.isRest && n.note != null) lastNoteRow = n.note;
  });
}

/**
 * Check if a note would overlap with existing notes (monophonic mode).
 * In monophonic mode, no two notes can occupy the same column range.
 *
 * @param {Array<{startSubdiv: number, duration: number}>} notes - Existing notes
 * @param {{startSubdiv: number, duration: number}} noteData - Note to check
 * @returns {boolean} True if the note would overlap
 */
export function wouldOverlap(notes, noteData) {
  const newStart = noteData.startSubdiv;
  const newEnd = noteData.startSubdiv + noteData.duration;

  for (const n of notes) {
    const existingStart = n.startSubdiv;
    const existingEnd = n.startSubdiv + n.duration;
    const columnsOverlap = !(newEnd <= existingStart || newStart >= existingEnd);
    if (columnsOverlap) return true;
  }
  return false;
}

/**
 * Remove notes that overlap with a given column range (monophonic mode).
 *
 * @param {Array<{startSubdiv: number, duration: number}>} notes - Mutable notes array
 * @param {number} startSubdiv - Start of the range
 * @param {number} duration - Duration of the range
 * @returns {Array} Filtered notes array (new array)
 */
export function removeOverlappingNotes(notes, startSubdiv, duration) {
  const newEnd = startSubdiv + duration;
  return notes.filter(n => {
    const existingEnd = n.startSubdiv + n.duration;
    return newEnd <= n.startSubdiv || startSubdiv >= existingEnd;
  });
}
