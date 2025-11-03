// libs/app-common/soundline.js
// Módulo para crear línea sonora vertical con divisiones y numeración MIDI

/**
 * Creates a vertical soundline with 13 horizontal divisions and numbered spaces (0-11)
 * Mapping: 0 → MIDI 60 (C4), 11 → MIDI 71 (B4)
 *
 * @param {HTMLElement} container - Container element for the soundline
 * @returns {Object} Soundline API
 */
export function createSoundline(container) {
  if (!container) {
    throw new Error('Container element required for soundline');
  }

  // Create main soundline container
  const soundline = document.createElement('div');
  soundline.className = 'soundline';
  soundline.id = 'soundline';

  // Create 13 horizontal division lines (indices 0-12)
  for (let i = 0; i <= 12; i++) {
    const line = document.createElement('div');
    line.className = 'soundline-division';
    line.dataset.index = i;
    soundline.appendChild(line);
  }

  // Create 12 number labels (0-11) positioned in spaces between lines
  // Note 0 (MIDI 60) at bottom, Note 11 (MIDI 71) at top
  for (let i = 0; i <= 11; i++) {
    const label = document.createElement('div');
    label.className = 'soundline-number';
    label.dataset.note = i;
    label.dataset.midi = 60 + i;
    label.textContent = i;
    soundline.appendChild(label);
  }

  container.appendChild(soundline);

  // Position elements after appending to DOM
  layoutSoundline(soundline);

  return {
    element: soundline,

    /**
     * Get vertical position percentage for a note index
     * @param {number} noteIndex - Note index (0-11)
     * @returns {number} Percentage from top (0-100)
     */
    getNotePosition: (noteIndex) => {
      if (noteIndex < 0 || noteIndex > 11) {
        console.warn(`Note index ${noteIndex} out of range (0-11)`);
        return 50;
      }
      // Center of space between lines: same as numbers
      // Space centers: 4.17%, 12.5%, 20.83%, ... 95.83%
      const pct = ((noteIndex + 0.5) / 12) * 100;
      // Inverted: note 0 at bottom (95.83%), note 11 at top (4.17%)
      return 100 - pct;
    },

    /**
     * Get MIDI number for note index
     * @param {number} noteIndex - Note index (0-11)
     * @returns {number} MIDI number (60-71)
     */
    getMidiForNote: (noteIndex) => {
      if (noteIndex < 0 || noteIndex > 11) {
        console.warn(`Note index ${noteIndex} out of range (0-11)`);
        return 60;
      }
      return 60 + noteIndex;
    },

    /**
     * Get note index for MIDI number
     * @param {number} midi - MIDI number (60-71)
     * @returns {number} Note index (0-11) or -1 if out of range
     */
    getNoteForMidi: (midi) => {
      if (midi < 60 || midi > 71) {
        console.warn(`MIDI ${midi} out of range (60-71)`);
        return -1;
      }
      return midi - 60;
    }
  };
}

/**
 * Layout soundline elements in vertical arrangement
 * @private
 */
function layoutSoundline(soundline) {
  const divisions = soundline.querySelectorAll('.soundline-division');
  const numbers = soundline.querySelectorAll('.soundline-number');

  // Position horizontal division lines
  divisions.forEach((div, idx) => {
    const pct = (idx / 12) * 100; // 0%, 8.33%, 16.67%, ... 100%
    div.style.top = `${pct}%`;
    // left y width se manejan en CSS
  });

  // Position numbers in spaces between lines
  numbers.forEach((num, idx) => {
    // Space centers: 4.17%, 12.5%, 20.83%, ... 95.83%
    const pct = ((idx + 0.5) / 12) * 100;
    // Inverted: index 0 at bottom, index 11 at top
    const invertedPct = 100 - pct;
    num.style.top = `${invertedPct}%`;
    num.style.transform = 'translateY(-50%)';
    // left y width se manejan en CSS
  });
}
