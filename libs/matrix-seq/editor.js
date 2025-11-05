/**
 * editor.js - Dual contenteditable editor para N (notas) y P (pulsos)
 *
 * Features:
 * - Enter key navigation: N → P → N
 * - Markup builders: "N ( ... ) 0-11" y "P ( ... ) 0-7"
 * - Auto-completar P si N lleno
 * - Parsing y validación diferenciada
 */

import { parseNotes, parsePulses, autoCompletePulses, createPairs } from './parser.js';

/**
 * Crea markup builder para notas
 * Formato: N ( ... ) 0-11
 */
function createNoteMarkupBuilder() {
  return function buildNoteMarkup({ root, initialText = '' }) {
    const mk = (cls, txt) => {
      const span = document.createElement('span');
      span.className = `pz ${cls}`;
      if (txt != null) span.textContent = txt;
      return span;
    };

    root.textContent = '';
    const edit = mk('edit', initialText);
    edit.contentEditable = 'true';
    edit.dataset.role = 'note-edit';

    root.append(
      mk('prefix', 'N ('),
      edit,
      mk('suffix', ')'),
      mk('range', '0-11')
    );

    return { editEl: edit };
  };
}

/**
 * Crea markup builder para pulsos
 * Formato: P ( ... ) 0-7
 */
function createPulseMarkupBuilder() {
  return function buildPulseMarkup({ root, initialText = '' }) {
    const mk = (cls, txt) => {
      const span = document.createElement('span');
      span.className = `pz ${cls}`;
      if (txt != null) span.textContent = txt;
      return span;
    };

    root.textContent = '';
    const edit = mk('edit', initialText);
    edit.contentEditable = 'true';
    edit.dataset.role = 'pulse-edit';

    root.append(
      mk('prefix', 'P ('),
      edit,
      mk('suffix', ')'),
      mk('range', '0-7')
    );

    return { editEl: edit };
  };
}

/**
 * Crea un editor dual para notas y pulsos
 *
 * @param {Object} config - Configuración del editor
 * @returns {Object} API del editor
 */
export function createDualEditor(config = {}) {
  const {
    noteRange = [0, 11],
    pulseRange = [0, 7],
    onPairsChange = () => {},
    onNotesChange = () => {},
    onPulsesChange = () => {},
    onEnterFromNote = null,
    onEnterFromPulse = null
  } = config;

  let noteRoot = null;
  let pulseRoot = null;
  let noteEditEl = null;
  let pulseEditEl = null;

  let currentNotes = [];
  let currentPulses = [];
  let isUpdating = false; // Flag para evitar loops

  /**
   * Monta el editor en elementos DOM
   */
  function mount({ noteRootEl, pulseRootEl }) {
    noteRoot = noteRootEl;
    pulseRoot = pulseRootEl;

    // Crear markup para notas
    const noteBuilder = createNoteMarkupBuilder();
    const { editEl: noteEdit } = noteBuilder({ root: noteRoot, initialText: '' });
    noteEditEl = noteEdit;

    // Crear markup para pulsos
    const pulseBuilder = createPulseMarkupBuilder();
    const { editEl: pulseEdit } = pulseBuilder({ root: pulseRoot, initialText: '' });
    pulseEditEl = pulseEdit;

    // Eventos de input
    noteEditEl.addEventListener('input', handleNoteInput);
    pulseEditEl.addEventListener('input', handlePulseInput);

    // Eventos de tecla Enter
    noteEditEl.addEventListener('keydown', handleNoteKeydown);
    pulseEditEl.addEventListener('keydown', handlePulseKeydown);

    return { noteEditEl, pulseEditEl };
  }

  /**
   * Handler para input en notas
   */
  function handleNoteInput() {
    if (isUpdating) return;

    const text = noteEditEl.textContent || '';
    const { notes, errors } = parseNotes(text, {
      min: noteRange[0],
      max: noteRange[1]
    });

    currentNotes = notes;

    // Callback de cambio en notas
    onNotesChange(notes, errors);

    // Si notas válidas y pulsos vacíos, auto-completar pulsos
    if (notes.length > 0 && currentPulses.length === 0) {
      const autoPulses = autoCompletePulses(notes.length, pulseRange[1]);
      setPulses(autoPulses);
    }

    // Emitir pares actualizados
    emitPairsChange();
  }

  /**
   * Handler para input en pulsos
   */
  function handlePulseInput() {
    if (isUpdating) return;

    const text = pulseEditEl.textContent || '';
    const { pulses, errors, sanitized } = parsePulses(text, {
      min: pulseRange[0],
      max: pulseRange[1]
    });

    currentPulses = pulses;

    // Si se sanitizó, actualizar el texto mostrado
    if (sanitized && pulses.length > 0) {
      isUpdating = true;
      pulseEditEl.textContent = pulses.join(' ');
      isUpdating = false;
    }

    // Callback de cambio en pulsos
    onPulsesChange(pulses, errors);

    // Emitir pares actualizados
    emitPairsChange();
  }

  /**
   * Handler para Enter key en notas
   */
  function handleNoteKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (onEnterFromNote) {
        onEnterFromNote();
      } else if (pulseEditEl) {
        pulseEditEl.focus();
      }
    }
  }

  /**
   * Handler para Enter key en pulsos
   */
  function handlePulseKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (onEnterFromPulse) {
        onEnterFromPulse();
      } else if (noteEditEl) {
        noteEditEl.focus();
      }
    }
  }

  /**
   * Emite evento de cambio de pares
   */
  function emitPairsChange() {
    const pairs = createPairs(currentNotes, currentPulses);
    onPairsChange(pairs);
  }

  /**
   * Obtiene texto de notas
   */
  function getNoteText() {
    return noteEditEl?.textContent || '';
  }

  /**
   * Obtiene texto de pulsos
   */
  function getPulseText() {
    return pulseEditEl?.textContent || '';
  }

  /**
   * Establece notas programáticamente
   */
  function setNotes(notes) {
    if (!noteEditEl) return;

    isUpdating = true;
    noteEditEl.textContent = notes.join(' ');
    currentNotes = notes;
    isUpdating = false;

    emitPairsChange();
  }

  /**
   * Establece pulsos programáticamente
   */
  function setPulses(pulses) {
    if (!pulseEditEl) return;

    isUpdating = true;
    pulseEditEl.textContent = pulses.join(' ');
    currentPulses = pulses;
    isUpdating = false;

    emitPairsChange();
  }

  /**
   * Limpia ambos campos
   */
  function clear() {
    if (noteEditEl) noteEditEl.textContent = '';
    if (pulseEditEl) pulseEditEl.textContent = '';
    currentNotes = [];
    currentPulses = [];
    onPairsChange([]);
  }

  /**
   * Obtiene notas actuales
   */
  function getNotes() {
    return [...currentNotes];
  }

  /**
   * Obtiene pulsos actuales
   */
  function getPulses() {
    return [...currentPulses];
  }

  /**
   * Obtiene pares actuales
   */
  function getPairs() {
    return createPairs(currentNotes, currentPulses);
  }

  return {
    mount,
    getNoteText,
    getPulseText,
    setNotes,
    setPulses,
    clear,
    getNotes,
    getPulses,
    getPairs
  };
}
