/**
 * pair-columns.js - Column-based pair visualization with multi-voice support
 *
 * Renders pairs as vertical columns:
 * ┌─────────┬─────────┬──────────────┐
 * │  Par 0  │  Par 1  │    Par 2     │
 * ├─────────┼─────────┼──────────────┤
 * │ N: [3]  │ N: [5]  │ N1: [5]      │
 * │ P: [0]  │ P: [2]  │ N2: [8]      │
 * │         │         │ P:  [2]      │
 * └─────────┴─────────┴──────────────┘
 *
 * Features:
 * - Vertical columns for each pair
 * - Multi-voice support (N2, N3, ..., N12 for simultaneous notes)
 * - Dynamic row visibility (hide empty voice rows)
 * - CSS Grid layout with proper vertical alignment
 * - Interactive editing via contenteditable
 */

/**
 * Groups pairs by pulse index, supporting multiple notes per pulse
 * @param {Array<{note: number, pulse: number}>} pairs - Array of pairs
 * @returns {Array<{pulse: number, notes: number[]}>} - Grouped by pulse
 */
function groupPairsByPulse(pairs) {
  const groups = {};

  for (const pair of pairs) {
    if (!groups[pair.pulse]) {
      groups[pair.pulse] = {
        pulse: pair.pulse,
        notes: []
      };
    }
    groups[pair.pulse].notes.push(pair.note);
  }

  // Sort notes within each pulse (ascending order)
  for (const pulse in groups) {
    groups[pulse].notes.sort((a, b) => a - b);
  }

  // Convert to array and sort by pulse
  return Object.values(groups).sort((a, b) => a.pulse - b.pulse);
}

/**
 * Calculates the maximum number of simultaneous voices needed
 * @param {Array<{pulse: number, notes: number[]}>} groups - Pulse groups
 * @returns {number} - Max voice count (1-12)
 */
function calculateMaxVoices(groups) {
  let max = 1;
  for (const group of groups) {
    if (group.notes.length > max) {
      max = group.notes.length;
    }
  }
  return Math.min(max, 12); // Cap at 12 voices
}

/**
 * Creates column-based pair renderer
 * @param {Object} config - Configuration
 * @returns {Object} - Renderer API
 */
export function createPairColumnsRenderer(config = {}) {
  const {
    container,
    noteRange = [0, 11],
    pulseRange = [0, 7],
    onPairClick = () => {},
    onPairChange = () => {},
    editable = true
  } = config;

  let currentPairs = [];
  let columnElements = [];

  /**
   * Renders the column grid
   */
  function render(pairs) {
    currentPairs = [...pairs];

    if (!container) {
      console.warn('No container provided for pair columns');
      return;
    }

    // Clear existing content
    container.innerHTML = '';
    container.className = 'pair-columns-container';

    // Group pairs by pulse
    const groups = groupPairsByPulse(pairs);
    const maxVoices = calculateMaxVoices(groups);

    if (groups.length === 0) {
      // Empty state
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'pair-columns-empty';
      emptyMsg.textContent = 'Sin pares. Haz clic en la matriz para crear.';
      container.appendChild(emptyMsg);
      return;
    }

    // Create grid container
    const grid = document.createElement('div');
    grid.className = 'pair-columns-grid';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = `repeat(${groups.length}, 1fr)`;
    grid.style.gap = '15px';

    columnElements = [];

    // Render each column
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      const column = createColumn(group, i, maxVoices);
      grid.appendChild(column);
      columnElements.push(column);
    }

    container.appendChild(grid);
  }

  /**
   * Creates a single column for a pulse group
   */
  function createColumn(group, index, maxVoices) {
    const column = document.createElement('div');
    column.className = 'pair-column';
    column.dataset.pulse = group.pulse;

    // Header: Par N
    const header = document.createElement('div');
    header.className = 'pair-column-header';
    header.textContent = `Par ${index}`;
    column.appendChild(header);

    // Content wrapper
    const content = document.createElement('div');
    content.className = 'pair-column-content';

    // Render note rows (N, N2, N3, ...)
    for (let voiceIdx = 0; voiceIdx < maxVoices; voiceIdx++) {
      const note = group.notes[voiceIdx];
      const noteRow = createNoteRow(voiceIdx, note, group.pulse);
      content.appendChild(noteRow);
    }

    // Render pulse row (always single)
    const pulseRow = createPulseRow(group.pulse);
    content.appendChild(pulseRow);

    column.appendChild(content);

    return column;
  }

  /**
   * Creates a note row (N, N2, N3, ...)
   */
  function createNoteRow(voiceIndex, note, pulse) {
    const row = document.createElement('div');
    row.className = 'pair-column-row pair-note-row';
    row.dataset.voice = voiceIndex;

    // Label (N, N2, N3, ...)
    const label = document.createElement('span');
    label.className = 'pair-row-label';
    label.textContent = voiceIndex === 0 ? 'N:' : `N${voiceIndex + 1}:`;

    // Value container
    const valueContainer = document.createElement('span');
    valueContainer.className = 'pair-row-value';

    if (note !== undefined) {
      // Render note value
      const noteEl = document.createElement('span');
      noteEl.className = 'pair-note-value';
      noteEl.textContent = note;

      if (editable) {
        noteEl.contentEditable = 'true';
        noteEl.dataset.note = note;
        noteEl.dataset.pulse = pulse;
        noteEl.dataset.voice = voiceIndex;

        // Handle editing
        noteEl.addEventListener('blur', (e) => handleNoteEdit(e, pulse, note, voiceIndex));
        noteEl.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.target.blur();
          }
          // Only allow digits
          if (!/^[0-9]$/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
            e.preventDefault();
          }
        });
      }

      valueContainer.appendChild(noteEl);
    } else {
      // Empty voice row (hide by default)
      row.classList.add('pair-row-empty');
      valueContainer.textContent = '—';
    }

    row.appendChild(label);
    row.appendChild(valueContainer);

    return row;
  }

  /**
   * Creates a pulse row
   */
  function createPulseRow(pulse) {
    const row = document.createElement('div');
    row.className = 'pair-column-row pair-pulse-row';

    // Label
    const label = document.createElement('span');
    label.className = 'pair-row-label';
    label.textContent = 'P:';

    // Value
    const valueContainer = document.createElement('span');
    valueContainer.className = 'pair-row-value';

    const pulseEl = document.createElement('span');
    pulseEl.className = 'pair-pulse-value';
    pulseEl.textContent = pulse;

    if (editable) {
      pulseEl.contentEditable = 'true';
      pulseEl.dataset.pulse = pulse;

      pulseEl.addEventListener('blur', (e) => handlePulseEdit(e, pulse));
      pulseEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.target.blur();
        }
        // Only allow digits
        if (!/^[0-9]$/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
          e.preventDefault();
        }
      });
    }

    valueContainer.appendChild(pulseEl);

    row.appendChild(label);
    row.appendChild(valueContainer);

    return row;
  }

  /**
   * Handles note value edit
   */
  function handleNoteEdit(event, oldPulse, oldNote, voiceIndex) {
    const newValue = event.target.textContent.trim();
    const newNote = parseInt(newValue, 10);

    // Validate
    if (isNaN(newNote) || newNote < noteRange[0] || newNote > noteRange[1]) {
      // Invalid - revert
      event.target.textContent = oldNote;
      showValidationError(event.target, `Nota debe estar entre ${noteRange[0]} y ${noteRange[1]}`);
      return;
    }

    // If unchanged, no action
    if (newNote === oldNote) return;

    // Update pairs: remove old, add new
    const updatedPairs = currentPairs.filter(p => !(p.note === oldNote && p.pulse === oldPulse));
    updatedPairs.push({ note: newNote, pulse: oldPulse });

    // Sort by pulse, then by note
    updatedPairs.sort((a, b) => {
      if (a.pulse !== b.pulse) return a.pulse - b.pulse;
      return a.note - b.note;
    });

    onPairChange(updatedPairs);
  }

  /**
   * Handles pulse value edit
   */
  function handlePulseEdit(event, oldPulse) {
    const newValue = event.target.textContent.trim();
    const newPulse = parseInt(newValue, 10);

    // Validate
    if (isNaN(newPulse) || newPulse < pulseRange[0] || newPulse > pulseRange[1]) {
      // Invalid - revert
      event.target.textContent = oldPulse;
      showValidationError(event.target, `Pulso debe estar entre ${pulseRange[0]} y ${pulseRange[1]}`);
      return;
    }

    // If unchanged, no action
    if (newPulse === oldPulse) return;

    // Update pairs: change all pairs with oldPulse to newPulse
    const updatedPairs = currentPairs.map(p => {
      if (p.pulse === oldPulse) {
        return { note: p.note, pulse: newPulse };
      }
      return p;
    });

    // Sort by pulse, then by note
    updatedPairs.sort((a, b) => {
      if (a.pulse !== b.pulse) return a.pulse - b.pulse;
      return a.note - b.note;
    });

    onPairChange(updatedPairs);
  }

  /**
   * Shows validation error tooltip
   */
  function showValidationError(element, message) {
    const tip = document.createElement('div');
    tip.className = 'hover-tip validation-error';
    tip.textContent = message;
    document.body.appendChild(tip);

    // Position below element
    const rect = element.getBoundingClientRect();
    tip.style.position = 'absolute';
    tip.style.left = rect.left + 'px';
    tip.style.top = (rect.bottom + window.scrollY + 5) + 'px';
    tip.style.zIndex = '1000';

    // Auto-remove after 2s
    setTimeout(() => tip.remove(), 2000);
  }

  /**
   * Highlights a specific pulse column
   */
  function highlightPulse(pulse) {
    // Remove previous highlights
    columnElements.forEach(col => col.classList.remove('pulse-highlighted'));

    // Find and highlight column with matching pulse
    const column = columnElements.find(col => parseInt(col.dataset.pulse, 10) === pulse);
    if (column) {
      column.classList.add('pulse-highlighted');
    }
  }

  /**
   * Clears all highlights
   */
  function clearHighlights() {
    columnElements.forEach(col => col.classList.remove('pulse-highlighted'));
  }

  /**
   * Destroys the renderer
   */
  function destroy() {
    if (container) {
      container.innerHTML = '';
    }
    columnElements = [];
    currentPairs = [];
  }

  return {
    render,
    highlightPulse,
    clearHighlights,
    destroy
  };
}
