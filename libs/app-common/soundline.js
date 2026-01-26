// libs/app-common/soundline.js
// Módulo para crear línea sonora vertical con divisiones y numeración MIDI

/**
 * Creates a vertical soundline with horizontal divisions and numbered spaces.
 *
 * Supports the legacy signature `createSoundline({ container, onNoteClick })`
 * as well as the simplified `createSoundline(container)`.
 *
 * @param {HTMLElement|Object} options - Container element or configuration.
 * @param {HTMLElement} options.container - Target container element.
 * @param {number} [options.totalNotes=12] - Number of note spaces (>=1).
 * @param {number} [options.startMidi=60] - MIDI note assigned to index 0.
 * @param {Function} [options.labelFormatter] - Custom text for each label.
 * @param {Function} [options.onNoteClick] - Click handler for labels.
 * @param {number[]} [options.visibleNotes] - Array of note indices to show with full division.
 *        Notes NOT in this array will be shown as dots. If null/undefined, all notes shown.
 * @param {string} [options.dotClass='soundline-dot'] - CSS class for dot elements.
 * @returns {Object} Soundline API.
 */
export function createSoundline(options) {
  const {
    container,
    totalNotes,
    startMidi,
    labelFormatter,
    onNoteClick,
    visibleNotes,
    dotClass
  } = normalizeOptions(options);

  // Create main soundline container
  const soundline = document.createElement('div');
  soundline.className = 'soundline';
  soundline.id = 'soundline';

  // Create horizontal division lines (indices 0 to totalNotes-1)
  // If visibleNotes is defined, only those indices get full divisions; others get dots
  const hasVisibleFilter = Array.isArray(visibleNotes);

  for (let i = 0; i < totalNotes; i++) {
    const isVisible = !hasVisibleFilter || visibleNotes.includes(i);
    const midi = startMidi + i;

    if (isVisible) {
      // Full division line
      const line = document.createElement('div');
      line.className = 'soundline-division';
      line.dataset.index = i;
      line.dataset.noteIndex = i;
      line.dataset.midi = midi;

      if (onNoteClick) {
        line.style.cursor = 'pointer';
        line.addEventListener('click', (event) => {
          onNoteClick(i, midi, event);
        });
      }

      soundline.appendChild(line);
    } else {
      // Dot for non-visible notes
      const dot = document.createElement('div');
      dot.className = dotClass;
      dot.dataset.index = i;
      dot.dataset.noteIndex = i;
      dot.dataset.midi = midi;
      soundline.appendChild(dot);
    }
  }


  // Create number labels only for visible notes
  for (let i = 0; i < totalNotes; i++) {
    const isVisible = !hasVisibleFilter || visibleNotes.includes(i);
    if (!isVisible) continue; // Skip labels for non-visible notes

    const label = document.createElement('div');
    label.className = 'soundline-number';

    const midi = startMidi + i;
    label.dataset.note = i;
    label.dataset.noteIndex = i;
    label.dataset.midi = midi;
    label.innerHTML = formatLabel(labelFormatter, i, midi);

    if (onNoteClick) {
      label.tabIndex = 0;
      label.addEventListener('click', (event) => {
        onNoteClick(i, midi, event);
      });
      label.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onNoteClick(i, midi, event);
        }
      });
    }

    soundline.appendChild(label);
  }

  container.appendChild(soundline);

  // Position elements after appending to DOM
  layoutSoundline(soundline, totalNotes);

  const soundlineApi = {
    element: soundline,

    /**
     * Get vertical position percentage for a note index.
     * @param {number} noteIndex - Note index (0-totalNotes-1)
     * @returns {number} Percentage from top (0-100)
     */
    getNotePosition: (noteIndex) => {
      if (noteIndex < 0 || noteIndex >= totalNotes) {
        console.warn(`Note index ${noteIndex} out of range (0-${totalNotes - 1})`);
        return 50;
      }

      // Center of space between lines: same as numbers
      const pct = ((noteIndex + 0.5) / totalNotes) * 100;
      // Inverted: note 0 at bottom, top note at top
      return 100 - pct;
    },

    /**
     * Get MIDI number for note index.
     * @param {number} noteIndex - Note index (0-totalNotes-1)
     * @returns {number} MIDI number
     */
    getMidiForNote: (noteIndex) => {
      if (noteIndex < 0 || noteIndex >= totalNotes) {
        console.warn(`Note index ${noteIndex} out of range (0-${totalNotes - 1})`);
        return startMidi;
      }
      return startMidi + noteIndex;
    },

    /**
     * Get note index for MIDI number.
     * @param {number} midi - MIDI number
     * @returns {number} Note index or -1 if out of range
     */
    getNoteForMidi: (midi) => {
      const offset = midi - startMidi;
      if (offset < 0 || offset >= totalNotes) {
        console.warn(`MIDI ${midi} out of range (${startMidi}-${startMidi + totalNotes - 1})`);
        return -1;
      }
      return offset;
    },

    /**
     * Get vertical position bounds for a note index (px).
     * Compatible with musical-plane axis interface.
     * @param {number} noteIndex - Note index (0-totalNotes-1)
     * @returns {Object} {top: px, height: px}
     */
    getPosition: (noteIndex) => {
      if (noteIndex < 0 || noteIndex >= totalNotes) {
        console.warn(`Note index ${noteIndex} out of range (0-${totalNotes - 1})`);
        return { top: 0, height: 0 };
      }

      const containerRect = soundline.getBoundingClientRect();
      const containerHeight = containerRect.height;

      const noteHeight = containerHeight / totalNotes;
      const top = containerHeight - ((noteIndex + 1) * noteHeight);

      return {
        top: Math.max(0, top),
        height: noteHeight
      };
    },

    /**
     * Get number of notes (divisions).
     * Compatible with musical-plane axis interface.
     * @returns {number}
     */
    getCount: () => totalNotes,

    /**
     * Force layout recomputation (e.g., after resize or font change).
     */
    relayout: () => layoutSoundline(soundline, totalNotes),

    /**
     * Update which notes are visible (have divisions vs dots).
     * Rebuilds the soundline content with new visible notes.
     * @param {number[]} newVisibleNotes - Array of note indices to show with full division.
     * @param {Function} [newLabelFormatter] - Optional new label formatter.
     */
    setVisibleNotes: (newVisibleNotes, newLabelFormatter) => {
      // Clear existing content
      soundline.innerHTML = '';

      const hasVisibleFilter = Array.isArray(newVisibleNotes);
      const formatter = newLabelFormatter || labelFormatter;

      // Rebuild divisions/dots
      for (let i = 0; i < totalNotes; i++) {
        const isVisible = !hasVisibleFilter || newVisibleNotes.includes(i);
        const midi = startMidi + i;

        if (isVisible) {
          const line = document.createElement('div');
          line.className = 'soundline-division';
          line.dataset.index = i;
          line.dataset.noteIndex = i;
          line.dataset.midi = midi;

          if (onNoteClick) {
            line.style.cursor = 'pointer';
            line.addEventListener('click', (event) => {
              onNoteClick(i, midi, event);
            });
          }
          soundline.appendChild(line);
        } else {
          const dot = document.createElement('div');
          dot.className = dotClass;
          dot.dataset.index = i;
          dot.dataset.noteIndex = i;
          dot.dataset.midi = midi;
          soundline.appendChild(dot);
        }
      }

      // Rebuild labels for visible notes
      for (let i = 0; i < totalNotes; i++) {
        const isVisible = !hasVisibleFilter || newVisibleNotes.includes(i);
        if (!isVisible) continue;

        const label = document.createElement('div');
        label.className = 'soundline-number';

        const midi = startMidi + i;
        label.dataset.note = i;
        label.dataset.noteIndex = i;
        label.dataset.midi = midi;
        label.innerHTML = formatLabel(formatter, i, midi);

        if (onNoteClick) {
          label.tabIndex = 0;
          label.addEventListener('click', (event) => {
            onNoteClick(i, midi, event);
          });
          label.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onNoteClick(i, midi, event);
            }
          });
        }
        soundline.appendChild(label);
      }

      // Re-layout
      layoutSoundline(soundline, totalNotes);
    }
  };

  return soundlineApi;
}

function formatLabel(formatter, noteIndex, midi) {
  if (typeof formatter === 'function') {
    try {
      const result = formatter(noteIndex, midi);
      if (result !== undefined && result !== null) {
        return String(result);
      }
    } catch (error) {
      console.warn('Soundline labelFormatter threw an error:', error);
    }
  }
  return String(noteIndex);
}

function normalizeOptions(options) {
  const defaultOptions = {
    container: null,
    totalNotes: 12,
    startMidi: 60,
    labelFormatter: null,
    onNoteClick: null,
    visibleNotes: null,
    dotClass: 'soundline-dot'
  };

  if (isDomElement(options)) {
    return { ...defaultOptions, container: options };
  }

  const config = { ...defaultOptions, ...(options || {}) };
  const container = config.container;

  if (!isDomElement(container)) {
    throw new Error('Container element required for soundline');
  }

  const normalizedTotalNotes = Number.isInteger(config.totalNotes) ? config.totalNotes : defaultOptions.totalNotes;
  const safeTotalNotes = Math.max(1, normalizedTotalNotes);

  const normalizedStartMidi = Number.isInteger(config.startMidi) ? config.startMidi : defaultOptions.startMidi;

  // Validate visibleNotes if provided
  const visibleNotes = Array.isArray(config.visibleNotes) ? config.visibleNotes : null;

  return {
    container,
    totalNotes: safeTotalNotes,
    startMidi: normalizedStartMidi,
    labelFormatter: config.labelFormatter,
    onNoteClick: typeof config.onNoteClick === 'function' ? config.onNoteClick : null,
    visibleNotes,
    dotClass: typeof config.dotClass === 'string' ? config.dotClass : defaultOptions.dotClass
  };
}

function isDomElement(value) {
  return Boolean(value && typeof value === 'object' && value.nodeType === 1 && typeof value.appendChild === 'function');
}

/**
 * Layout soundline elements in vertical arrangement
 * @private
 */
function layoutSoundline(soundline, totalNotes = 12) {
  if (!soundline) return;

  const safeTotalNotes = Math.max(1, totalNotes);
  const divisions = soundline.querySelectorAll('.soundline-division');
  const numbers = soundline.querySelectorAll('.soundline-number');
  const dots = soundline.querySelectorAll('.soundline-dot');

  // Calculate top and bottom positions for vertical line
  const topNotePct = ((safeTotalNotes - 0.5) / safeTotalNotes) * 100;  // note 11 position
  const bottomNotePct = (0.5 / safeTotalNotes) * 100;  // note 0 position
  const lineTop = 100 - topNotePct;  // inverted
  const lineBottom = 100 - bottomNotePct;  // inverted

  // Set CSS custom properties for vertical line bounds
  soundline.style.setProperty('--line-top', `${lineTop}%`);
  soundline.style.setProperty('--line-bottom', `${100 - lineBottom}%`);

  // Position divisions at their note index height
  divisions.forEach((div) => {
    const idx = parseInt(div.dataset.noteIndex, 10);
    const pct = ((idx + 0.5) / safeTotalNotes) * 100;
    const invertedPct = 100 - pct;
    div.style.top = `${invertedPct}%`;
  });

  // Position dots at their note index height
  dots.forEach((dot) => {
    const idx = parseInt(dot.dataset.noteIndex, 10);
    const pct = ((idx + 0.5) / safeTotalNotes) * 100;
    const invertedPct = 100 - pct;
    dot.style.top = `${invertedPct}%`;
  });

  // Position numbers at their note index height
  numbers.forEach((num) => {
    const idx = parseInt(num.dataset.noteIndex, 10);
    const pct = ((idx + 0.5) / safeTotalNotes) * 100;
    const invertedPct = 100 - pct;
    num.style.top = `${invertedPct}%`;
    num.style.transform = 'translateY(-50%)';
  });
}
