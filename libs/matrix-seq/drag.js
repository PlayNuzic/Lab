/**
 * drag.js - Drag selection para soundline (notas) y timeline (pulsos)
 *
 * Permite selección mediante arrastre en ambos ejes:
 * - Soundline (vertical): Selecciona notas (permite duplicados)
 * - Timeline (horizontal): Selecciona pulsos (fuerza orden ascendente)
 *
 * Pointer Events (U-02): un sol camí cobreix ratolí, tàctil i llapis. En
 * tàctil el navegador captura implícitament el pointer sobre el target
 * inicial, així que els `pointermove` arriben retargetats — per això la
 * detecció de cel·la usa document.elementFromPoint() i no e.target.
 * Recordeu posar `touch-action: none` a la superfície de drag al CSS del
 * consumidor perquè el navegador no robi el gest per fer scroll.
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
  let activePointerId = null;
  let selectedIndices = [];
  let lastTarget = null;
  let documentListenersAttached = false;
  const attachedElements = [];

  /**
   * Adjunta els listeners de document una sola vegada (attachToNotes i
   * attachToPulses compartien aquest pas i abans es duplicaven).
   */
  function ensureDocumentListeners() {
    if (documentListenersAttached) return;
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerCancel);
    documentListenersAttached = true;
  }

  /**
   * Adjunta handlers de drag a elemento de notas (soundline)
   */
  function attachToNotes(noteElement) {
    if (!noteElement) return;

    noteElement.addEventListener('pointerdown', handleNotePointerDown);
    attachedElements.push([noteElement, handleNotePointerDown]);
    ensureDocumentListeners();
  }

  /**
   * Adjunta handlers de drag a elemento de pulsos (timeline)
   */
  function attachToPulses(pulseElement) {
    if (!pulseElement) return;

    pulseElement.addEventListener('pointerdown', handlePulsePointerDown);
    attachedElements.push([pulseElement, handlePulsePointerDown]);
    ensureDocumentListeners();
  }

  /**
   * Handler pointerdown en notas
   */
  function handleNotePointerDown(e) {
    // Solo botón principal (ratolí esquerre / contacte tàctil)
    if (e.button !== 0) return;

    const target = e.target.closest('[data-note-index]');
    if (!target) return;

    e.preventDefault();
    isDragging = true;
    dragType = 'notes';
    activePointerId = e.pointerId ?? null;
    selectedIndices = [];

    const noteIndex = parseInt(target.dataset.noteIndex, 10);
    if (!isNaN(noteIndex)) {
      selectedIndices.push(noteIndex);
      lastTarget = target;
    }
  }

  /**
   * Handler pointerdown en pulsos
   */
  function handlePulsePointerDown(e) {
    // Solo botón principal
    if (e.button !== 0) return;

    const target = e.target.closest('[data-pulse-index]');
    if (!target) return;

    e.preventDefault();
    isDragging = true;
    dragType = 'pulses';
    activePointerId = e.pointerId ?? null;
    selectedIndices = [];

    const pulseIndex = parseInt(target.dataset.pulseIndex, 10);
    if (!isNaN(pulseIndex)) {
      selectedIndices.push(pulseIndex);
      lastTarget = target;
    }
  }

  /**
   * Handler pointermove — resol la cel·la sota el punter amb
   * elementFromPoint (e.target queda retargetat per la captura implícita
   * del tàctil i no serveix per detectar cel·les).
   */
  function handlePointerMove(e) {
    if (!isDragging) return;
    if (activePointerId != null && e.pointerId !== activePointerId) return;

    const under = document.elementFromPoint(e.clientX, e.clientY);
    if (!under) return;

    let target;
    if (dragType === 'notes') {
      target = under.closest('[data-note-index]');
      if (target && target !== lastTarget) {
        const noteIndex = parseInt(target.dataset.noteIndex, 10);
        if (!isNaN(noteIndex)) {
          selectedIndices.push(noteIndex);
          lastTarget = target;
        }
      }
    } else if (dragType === 'pulses') {
      target = under.closest('[data-pulse-index]');
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
   * Handler pointerup — committeja la selecció
   */
  function handlePointerUp(e) {
    if (!isDragging) return;
    if (activePointerId != null && e.pointerId !== activePointerId) return;

    if (dragType === 'notes' && selectedIndices.length > 0) {
      // Notas: permitir duplicados, preservar orden de selección
      onNotesSelected([...selectedIndices]);
    } else if (dragType === 'pulses' && selectedIndices.length > 0) {
      // Pulsos: eliminar duplicados, ordenar ascendentemente
      const uniquePulses = [...new Set(selectedIndices)];
      uniquePulses.sort((a, b) => a - b);
      onPulsesSelected(uniquePulses);
    }

    resetState();
  }

  /**
   * Handler pointercancel — el navegador ha robat el gest: netegem sense
   * committejar la selecció parcial.
   */
  function handlePointerCancel(e) {
    if (!isDragging) return;
    if (activePointerId != null && e.pointerId !== activePointerId) return;
    resetState();
  }

  function resetState() {
    isDragging = false;
    dragType = null;
    activePointerId = null;
    selectedIndices = [];
    lastTarget = null;
  }

  /**
   * Limpia listeners
   */
  function detach() {
    for (const [element, handler] of attachedElements) {
      element.removeEventListener('pointerdown', handler);
    }
    attachedElements.length = 0;
    if (documentListenersAttached) {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerCancel);
      documentListenersAttached = false;
    }
  }

  return {
    attachToNotes,
    attachToPulses,
    detach
  };
}
