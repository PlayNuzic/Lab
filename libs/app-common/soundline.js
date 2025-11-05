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
 * @returns {Object} Soundline API.
 */
export function createSoundline(options) {
  const {
    container,
    totalNotes,
    startMidi,
    labelFormatter,
    onNoteClick
  } = normalizeOptions(options);

  // Create main soundline container
  const soundline = document.createElement('div');
  soundline.className = 'soundline';
  soundline.id = 'soundline';

  // Create horizontal division lines (indices 0-totalNotes)
  for (let i = 0; i <= totalNotes; i++) {
    const line = document.createElement('div');
    line.className = 'soundline-division';
    line.dataset.index = i;
    soundline.appendChild(line);
  }

  // Create number labels (0-totalNotes-1) positioned in spaces between lines
  for (let i = 0; i < totalNotes; i++) {
    const label = document.createElement('div');
    label.className = 'soundline-number';

    const midi = startMidi + i;
    label.dataset.note = i;
    label.dataset.noteIndex = i;
    label.dataset.midi = midi;
    label.textContent = formatLabel(labelFormatter, i, midi);

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
    relayout: () => layoutSoundline(soundline, totalNotes)
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
    onNoteClick: null
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

  return {
    container,
    totalNotes: safeTotalNotes,
    startMidi: normalizedStartMidi,
    labelFormatter: config.labelFormatter,
    onNoteClick: typeof config.onNoteClick === 'function' ? config.onNoteClick : null
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

  divisions.forEach((div, idx) => {
    const pct = (idx / safeTotalNotes) * 100;
    div.style.top = `${pct}%`;
  });

  numbers.forEach((num, idx) => {
    const pct = ((idx + 0.5) / safeTotalNotes) * 100;
    const invertedPct = 100 - pct;
    num.style.top = `${invertedPct}%`;
    num.style.transform = 'translateY(-50%)';
  });
}
