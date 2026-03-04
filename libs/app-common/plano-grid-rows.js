// libs/app-common/plano-grid-rows.js
// Shared grid row builders for plano apps

/**
 * Build simple chromatic rows (0 to noteCount-1), ordered top-to-bottom (highest first).
 *
 * @param {number} [noteCount=12] - Number of note rows
 * @returns {Array<{id: string, label: string, data: {note: number}}>}
 */
export function buildSimple12Rows(noteCount = 12) {
  const rows = [];
  for (let note = noteCount - 1; note >= 0; note--) {
    rows.push({
      id: `note-${note}`,
      label: String(note),
      data: { note }
    });
  }
  return rows;
}
