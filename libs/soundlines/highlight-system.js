// libs/soundlines/highlight-system.js
// Sistema de highlights per soundlines - Compartit entre Apps 21, 23, 24

/**
 * Crea un gestor de highlights per soundlines
 * @param {Object} options - Opcions de configuració
 * @param {SVGElement} options.connectionSvg - Element SVG per les línies de connexió
 * @returns {Object} API del gestor de highlights
 */
export function createHighlightManager(options = {}) {
  const { connectionSvg } = options;

  // Map per guardar highlights actius
  const activeHighlights = new Map();

  /**
   * Crea un element highlight en una soundline
   * @param {Object} soundlineApi - API de la soundline (del mòdul soundline.js)
   * @param {number} noteIndex - Índex de la nota (0-11)
   * @returns {HTMLElement} Element highlight creat
   */
  function createHighlight(soundlineApi, noteIndex) {
    const yPct = soundlineApi.getNotePosition(noteIndex);

    const highlight = document.createElement('div');
    highlight.className = 'note-highlight';
    highlight.style.top = `${yPct}%`;
    highlight.dataset.note = noteIndex;

    soundlineApi.element.appendChild(highlight);
    return highlight;
  }

  /**
   * Destaca una nota en una soundline amb duració temporal
   * @param {Object} soundlineApi - API de la soundline
   * @param {number} noteIndex - Índex de la nota (0-11)
   * @param {number} durationMs - Duració del highlight en ms
   * @param {string} key - Clau única per identificar el highlight (ex: 'chromatic', 'scale')
   */
  function highlightNote(soundlineApi, noteIndex, durationMs, key) {
    const existingKey = `${key}-${noteIndex}`;

    // Eliminar highlight existent si n'hi ha
    if (activeHighlights.has(existingKey)) {
      const prev = activeHighlights.get(existingKey);
      prev.element.remove();
      clearTimeout(prev.timeout);
      activeHighlights.delete(existingKey);
    }

    const highlight = createHighlight(soundlineApi, noteIndex);
    highlight.classList.add('active');

    const timeout = setTimeout(() => {
      highlight.classList.remove('active');
      setTimeout(() => highlight.remove(), 150);
      activeHighlights.delete(existingKey);
    }, durationMs);

    activeHighlights.set(existingKey, { element: highlight, timeout });
  }

  /**
   * Destaca una línia de connexió
   * @param {number} semitone - Semitono de la línia (0-11)
   * @param {number} durationMs - Duració del highlight en ms
   */
  function highlightConnectionLine(semitone, durationMs) {
    if (!connectionSvg) return;

    const line = connectionSvg.querySelector(`[data-semitone="${semitone}"]`);
    if (!line) return;

    line.classList.add('active');

    setTimeout(() => {
      line.classList.remove('active');
    }, durationMs);
  }

  /**
   * Neteja tots els highlights actius
   */
  function clearAllHighlights() {
    activeHighlights.forEach(({ element, timeout }) => {
      clearTimeout(timeout);
      element.remove();
    });
    activeHighlights.clear();

    if (connectionSvg) {
      connectionSvg.querySelectorAll('.connection-line.active').forEach(line => {
        line.classList.remove('active');
      });
    }
  }

  /**
   * Aplica color destacat als números que coincideixen amb les notes donades
   * @param {HTMLElement} soundlineElement - Element de la soundline
   * @param {number[]} highlightedNotes - Notes a destacar (0-11)
   */
  function applyHighlightColors(soundlineElement, highlightedNotes) {
    const numbers = soundlineElement.querySelectorAll('.soundline-number');
    numbers.forEach(num => {
      const noteIndex = parseInt(num.dataset.note, 10);
      if (highlightedNotes.includes(noteIndex)) {
        num.classList.add('highlighted');
      } else {
        num.classList.remove('highlighted');
      }
    });
  }

  /**
   * Aplica color destacat a tots els números d'una soundline
   * @param {HTMLElement} soundlineElement - Element de la soundline
   */
  function applyHighlightColorsAll(soundlineElement) {
    const numbers = soundlineElement.querySelectorAll('.soundline-number');
    numbers.forEach(num => {
      num.classList.add('highlighted');
    });
  }

  /**
   * Actualitza els highlights de la cromàtica basant-se en les notes transposades
   * @param {Object} chromaticSoundline - API de la soundline cromàtica
   * @param {number[]} transposedNotes - Notes de l'escala transposada (0-11)
   * @param {number} outputNote - Nota de sortida/transposició (0-11)
   */
  function updateChromaticHighlights(chromaticSoundline, transposedNotes, outputNote) {
    const numbers = chromaticSoundline.element.querySelectorAll('.soundline-number');

    numbers.forEach(num => {
      const noteIndex = parseInt(num.dataset.note, 10);
      // La nota mostrada és (noteIndex + outputNote) % 12
      const displayedNote = (noteIndex + outputNote) % 12;
      if (transposedNotes.includes(displayedNote)) {
        num.classList.add('highlighted');
      } else {
        num.classList.remove('highlighted');
      }
    });
  }

  /**
   * Destaca una nota al pentagrama amb duració temporal
   * @param {HTMLElement} pentagramContainer - Contenidor del pentagrama
   * @param {number} noteIndex - Índex de la nota a destacar (0-based)
   * @param {number} durationMs - Duració del highlight en ms
   */
  function highlightPentagramNote(pentagramContainer, noteIndex, durationMs) {
    if (!pentagramContainer) return;

    const svg = pentagramContainer.querySelector('svg');
    if (!svg) return;

    // Trobar l'element SVG de la nota pel seu data-idx
    const noteElement = svg.querySelector(`[data-idx="${noteIndex}"]`);
    if (!noteElement) return;

    // Buscar el notehead dins del grup VexFlow
    const noteheadGroup = noteElement.querySelector('.vf-notehead');
    if (!noteheadGroup) return;

    // VexFlow usa <text> amb font musical per dibuixar els caps de les notes
    const noteheadText = noteheadGroup.querySelector('text');
    if (!noteheadText) return;

    // Guardar el color original
    const originalFill = noteheadText.getAttribute('fill') || 'black';

    // Canviar el color del cap de la nota directament
    const highlightColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--selection-color').trim() || '#FFBB33';
    noteheadText.setAttribute('fill', highlightColor);

    // Restaurar el color original després de la duració
    setTimeout(() => {
      noteheadText.setAttribute('fill', originalFill);
    }, durationMs);
  }

  return {
    highlightNote,
    highlightConnectionLine,
    clearAllHighlights,
    applyHighlightColors,
    applyHighlightColorsAll,
    updateChromaticHighlights,
    highlightPentagramNote,
    // Exposar el map per debugging si cal
    get activeHighlights() { return activeHighlights; }
  };
}
