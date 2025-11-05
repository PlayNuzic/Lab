/**
 * drag.js - Drag selection para soundline (notas) y timeline (pulsos)
 *
 * Permite selección mediante arrastre en ambos ejes:
 * - Soundline (vertical): Selecciona notas (permite duplicados)
 * - Timeline (horizontal): Selecciona pulsos (fuerza orden ascendente)
 */

/**
 * Crea handlers de drag selection
 *
 * @param {Object} config - Configuración
 * @returns {Object} API de drag handlers
 */
export function createDragHandlers(config = {}) {
  const {
    onNotesSelected = () => {},
    onPulsesSelected = () => {},
    noteAxis = null,  // Soundline axis object
    pulseAxis = null  // Timeline axis object
  } = config;

  let isDragging = false;
  let dragType = null; // 'notes' | 'pulses'
  let selectedIndices = [];
  let lastTarget = null;

  /**
   * Adjunta handlers de drag a elemento de notas (soundline)
   */
  function attachToNotes(noteElement) {
    if (!noteElement) return;

    noteElement.addEventListener('mousedown', handleNoteMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  /**
   * Adjunta handlers de drag a elemento de pulsos (timeline)
   */
  function attachToPulses(pulseElement) {
    if (!pulseElement) return;

    pulseElement.addEventListener('mousedown', handlePulseMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  /**
   * Handler mousedown en notas
   */
  function handleNoteMouseDown(e) {
    // Solo botón izquierdo
    if (e.button !== 0) return;

    const target = e.target.closest('[data-note-index]');
    if (!target) return;

    e.preventDefault();
    isDragging = true;
    dragType = 'notes';
    selectedIndices = [];

    const noteIndex = parseInt(target.dataset.noteIndex, 10);
    if (!isNaN(noteIndex)) {
      selectedIndices.push(noteIndex);
      lastTarget = target;
    }
  }

  /**
   * Handler mousedown en pulsos
   */
  function handlePulseMouseDown(e) {
    // Solo botón izquierdo
    if (e.button !== 0) return;

    const target = e.target.closest('[data-pulse-index]');
    if (!target) return;

    e.preventDefault();
    isDragging = true;
    dragType = 'pulses';
    selectedIndices = [];

    const pulseIndex = parseInt(target.dataset.pulseIndex, 10);
    if (!isNaN(pulseIndex)) {
      selectedIndices.push(pulseIndex);
      lastTarget = target;
    }
  }

  /**
   * Handler mousemove
   */
  function handleMouseMove(e) {
    if (!isDragging) return;

    let target;
    if (dragType === 'notes') {
      target = e.target.closest('[data-note-index]');
      if (target && target !== lastTarget) {
        const noteIndex = parseInt(target.dataset.noteIndex, 10);
        if (!isNaN(noteIndex)) {
          selectedIndices.push(noteIndex);
          lastTarget = target;
        }
      }
    } else if (dragType === 'pulses') {
      target = e.target.closest('[data-pulse-index]');
      if (target && target !== lastTarget) {
        const pulseIndex = parseInt(target.dataset.pulseIndex, 10);
        if (!isNaN(pulseIndex)) {
          // Para pulsos, evitar duplicados durante drag
          if (!selectedIndices.includes(pulseIndex)) {
            selectedIndices.push(pulseIndex);
          }
          lastTarget = target;
        }
      }
    }
  }

  /**
   * Handler mouseup
   */
  function handleMouseUp(e) {
    if (!isDragging) return;

    if (dragType === 'notes' && selectedIndices.length > 0) {
      // Notas: permitir duplicados, preservar orden de selección
      onNotesSelected([...selectedIndices]);
    } else if (dragType === 'pulses' && selectedIndices.length > 0) {
      // Pulsos: eliminar duplicados, ordenar ascendentemente
      const uniquePulses = [...new Set(selectedIndices)];
      uniquePulses.sort((a, b) => a - b);
      onPulsesSelected(uniquePulses);
    }

    // Reset estado
    isDragging = false;
    dragType = null;
    selectedIndices = [];
    lastTarget = null;
  }

  /**
   * Limpia listeners
   */
  function detach() {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }

  return {
    attachToNotes,
    attachToPulses,
    detach
  };
}
