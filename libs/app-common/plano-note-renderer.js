// libs/app-common/plano-note-renderer.js
// Shared note bar rendering and monophonic overlap management for plano grid apps

/**
 * Render note bars on a plano grid matrix.
 * Each note is a colored div positioned absolutely on the matrix.
 *
 * @param {Object} options
 * @param {HTMLElement} options.matrixContainer - The grid's matrix container element
 * @param {Array<{note: number, startSubdiv: number, duration: number}>} options.notes - Notes to render
 * @param {number} options.cellWidth - Width of each subdivision cell in pixels
 * @param {number} [options.noteCount=12] - Total number of note rows
 * @param {number} [options.cellHeight=32] - Height of each row in pixels
 * @param {string[]} [options.colors] - Array of colors for note bars (cycles)
 * @param {Function} [options.onClickNote] - Callback when a note bar is clicked: (index) => void
 */
export function renderNoteBars({
  matrixContainer,
  notes,
  cellWidth,
  noteCount = 12,
  cellHeight = 32,
  colors,
  onClickNote
}) {
  // Clear existing bars
  const existingBars = matrixContainer?.querySelectorAll('.note-bar');
  existingBars?.forEach(bar => bar.remove());

  if (!notes || notes.length === 0) return;

  const matrix = matrixContainer?.querySelector('.plano-matrix');
  if (!matrix) return;

  const defaultColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F1948A', '#82E0AA'];

  const palette = colors || defaultColors;

  let lastNoteRow = Math.floor(noteCount / 2); // Default to middle row for silence positioning

  notes.forEach((noteData, idx) => {
    if (noteData.isRest) {
      // Silence: thin dotted-line bar centered on the division line
      const bar = document.createElement('div');
      bar.className = 'note-bar note-bar--silence';
      const left = noteData.startSubdiv * cellWidth;
      const width = noteData.duration * cellWidth;
      const rowIndex = (noteCount - 1) - lastNoteRow;
      const restHeight = Math.max(3, (cellHeight - 2) / 6);
      const top = (rowIndex + 1) * cellHeight - restHeight / 2;

      bar.style.left = `${left}px`;
      bar.style.width = `${width}px`;
      bar.style.top = `${top}px`;
      bar.style.height = `${restHeight}px`;

      matrix.appendChild(bar);
      return;
    }

    lastNoteRow = noteData.note;

    const bar = document.createElement('div');
    bar.className = 'note-bar';
    bar.dataset.noteIndex = idx;

    const left = noteData.startSubdiv * cellWidth;
    const width = noteData.duration * cellWidth;
    const rowIndex = (noteCount - 1) - noteData.note;
    const barHeight = cellHeight - 2;
    const top = (rowIndex + 1) * cellHeight - barHeight / 2;

    bar.style.left = `${left}px`;
    bar.style.width = `${width}px`;
    bar.style.top = `${top}px`;
    bar.style.height = `${barHeight}px`;
    bar.style.background = palette[idx % palette.length];

    const label = document.createElement('span');
    label.className = 'note-bar__label';
    label.textContent = noteData.duration;
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
