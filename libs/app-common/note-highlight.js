// libs/app-common/note-highlight.js
// Controller for highlighting notes on soundline during playback

/**
 * Creates a note highlight controller for soundline
 * Shows rectangular highlights when notes play
 *
 * @param {Object} config - Configuration
 * @param {Object} config.soundline - Soundline instance from createSoundline()
 * @param {number} config.highlightDuration - Duration of highlight in ms (default: 300)
 * @param {string} config.highlightClass - CSS class for active highlight (default: 'highlight')
 * @returns {Object} Note highlight controller API
 */
export function createNoteHighlightController(config = {}) {
  const {
    soundline,
    highlightDuration = 300,
    highlightClass = 'highlight'
  } = config;

  if (!soundline || !soundline.element) {
    throw new Error('Soundline instance required for note highlight controller');
  }

  // Track active highlight elements
  const activeHighlights = new Map();

  /**
   * Highlight a note on the soundline
   * @param {number} noteIndex - Note index (0-11)
   * @param {number} duration - Optional custom duration in ms
   */
  function highlightNote(noteIndex, duration) {
    if (noteIndex < 0 || noteIndex > 11) {
      console.warn(`Note index ${noteIndex} out of range (0-11)`);
      return;
    }

    // Get or create highlight element
    let rect = activeHighlights.get(noteIndex);

    if (!rect) {
      rect = document.createElement('div');
      rect.className = 'note-highlight';
      rect.dataset.note = noteIndex;

      // Position rectangle - bottom edge aligned with division line
      const yPos = soundline.getNotePosition(noteIndex);
      rect.style.top = `${yPos}%`;
      // left se maneja en CSS (120px)
      rect.style.width = '80px';
      rect.style.height = '8.33%'; // 100% / 12 spaces = 8.33%
      rect.style.transform = 'translateY(-100%)';

      // Note: Label removed - no numbers inside highlighted cells

      soundline.element.appendChild(rect);
      activeHighlights.set(noteIndex, rect);
    }

    // Add highlight class
    rect.classList.add(highlightClass);

    // Auto-remove highlight after duration
    const actualDuration = duration || highlightDuration;
    setTimeout(() => {
      rect.classList.remove(highlightClass);
    }, actualDuration);
  }

  /**
   * Clear all highlights and remove elements
   */
  function clearHighlights() {
    activeHighlights.forEach(rect => {
      rect.classList.remove(highlightClass);
      rect.remove();
    });
    activeHighlights.clear();
  }

  /**
   * Remove highlight for specific note
   * @param {number} noteIndex - Note index (0-11)
   */
  function removeHighlight(noteIndex) {
    const rect = activeHighlights.get(noteIndex);
    if (rect) {
      rect.classList.remove(highlightClass);
      rect.remove();
      activeHighlights.delete(noteIndex);
    }
  }

  return {
    highlightNote,
    clearHighlights,
    removeHighlight
  };
}
