/**
 * matrix-seq.js - Controller principal para secuencias 2D
 *
 * Une todos los sub-sistemas:
 * - Editor dual (N + P)
 * - State manager (pares)
 * - Drag selection
 * - Sync bidireccional
 * - Column-based renderer (optional)
 */

import { createDualEditor } from './editor.js';
import { createPairStateManager } from './state.js';
import { createDragHandlers } from './drag.js';
import { createSyncManager } from './sync.js';
import { createPairColumnsRenderer } from './pair-columns.js';

/**
 * Crea un controller completo de matrix-seq
 *
 * @param {Object} config - Configuración
 * @returns {Object} API del controller
 */
export function createMatrixSeqController(config = {}) {
  const {
    noteRange = [0, 11],
    pulseRange = [0, 7],
    onPairsChange = () => {},
    onNotesChange = () => {},
    onPulsesChange = () => {},
    onEnterFromNote = null,
    onEnterFromPulse = null,
    renderMode = 'rows', // 'rows' | 'columns'
    columnContainer = null, // Container for column-based rendering
    autoJump = false // Enable auto-jump on digit entry
  } = config;

  // Sub-sistemas
  let state = null;
  let editor = null;
  let dragHandlers = null;
  let syncManager = null;
  let columnRenderer = null;

  // Referencias a elementos y ejes
  let noteAxis = null;
  let pulseAxis = null;

  /**
   * Monta el controller en elementos DOM
   */
  function mount(mountConfig) {
    const {
      noteRoot,
      pulseRoot,
      noteAxis: nAxis,
      pulseAxis: pAxis,
      noteElement = null,  // Elemento para drag (soundline wrapper)
      pulseElement = null  // Elemento para drag (timeline wrapper)
    } = mountConfig;

    noteAxis = nAxis;
    pulseAxis = pAxis;

    // Crear state manager
    state = createPairStateManager({
      noteRange,
      pulseRange,
      onChange: (pairs) => {
        onPairsChange(pairs);

        // Update column renderer if in column mode
        if (renderMode === 'columns' && columnRenderer) {
          columnRenderer.render(pairs);
        }
      }
    });

    // Crear editor
    editor = createDualEditor({
      noteRange,
      pulseRange,
      autoJump, // Pass through auto-jump flag
      onPairsChange: (pairs) => {
        // Cuando el editor cambia, actualizar state
        if (syncManager && !syncManager.getSyncStatus()) {
          syncManager.syncFromEditor();
        }
      },
      onNotesChange,
      onPulsesChange,
      onEnterFromNote,
      onEnterFromPulse
    });

    // Montar editor
    const { noteEditEl, pulseEditEl } = editor.mount({
      noteRootEl: noteRoot,
      pulseRootEl: pulseRoot
    });

    // Crear sync manager
    syncManager = createSyncManager({
      editor,
      state,
      onSyncComplete: (source, pairs) => {
        // console.log('Sync complete from', source, pairs);
      }
    });

    // Crear drag handlers si se proveen elementos
    if (noteElement || pulseElement) {
      dragHandlers = createDragHandlers({
        onNotesSelected: (notes) => {
          // Drag en notas → actualizar editor
          editor.setNotes(notes);
        },
        onPulsesSelected: (pulses) => {
          // Drag en pulsos → actualizar editor
          editor.setPulses(pulses);
        },
        noteAxis,
        pulseAxis
      });

      if (noteElement) {
        dragHandlers.attachToNotes(noteElement);
      }

      if (pulseElement) {
        dragHandlers.attachToPulses(pulseElement);
      }
    }

    // Crear column renderer si está en modo columns
    if (renderMode === 'columns' && columnContainer) {
      columnRenderer = createPairColumnsRenderer({
        container: columnContainer,
        noteRange,
        pulseRange,
        onPairClick: (note, pulse) => {
          // Click on column → toggle pair
          if (state.has(note, pulse)) {
            syncManager.removePair(note, pulse);
          } else {
            syncManager.addPair(note, pulse);
          }
        },
        onPairChange: (updatedPairs) => {
          // Column edit → update state
          state.setPairs(updatedPairs);
          if (syncManager) {
            syncManager.syncToEditor();
          }
        },
        editable: true
      });

      // Initial render
      columnRenderer.render(state.getPairs());
    }

    return {
      noteEditEl,
      pulseEditEl,
      state,
      editor,
      syncManager,
      columnRenderer
    };
  }

  /**
   * Obtiene todos los pares
   */
  function getPairs() {
    return state ? state.getPairs() : [];
  }

  /**
   * Establece pares programáticamente
   */
  function setPairs(pairs) {
    if (!state) return;
    state.setPairs(pairs);
    if (syncManager) {
      syncManager.syncToEditor();
    }
  }

  /**
   * Añade un par
   */
  function addPair(note, pulse) {
    if (!syncManager) return false;
    return syncManager.addPair(note, pulse);
  }

  /**
   * Elimina un par
   */
  function removePair(note, pulse) {
    if (!syncManager) return false;
    return syncManager.removePair(note, pulse);
  }

  /**
   * Verifica si existe un par
   */
  function hasPair(note, pulse) {
    return state ? state.has(note, pulse) : false;
  }

  /**
   * Limpia todos los pares
   */
  function clear() {
    if (syncManager) {
      syncManager.clear();
    }
  }

  /**
   * Obtiene solo notas
   */
  function getNotes() {
    return state ? state.getNotes() : [];
  }

  /**
   * Obtiene solo pulsos
   */
  function getPulses() {
    return state ? state.getPulses() : [];
  }

  /**
   * Cuenta total de pares
   */
  function count() {
    return state ? state.count() : 0;
  }

  /**
   * Acceso al memory system
   */
  const memory = {
    get: (note, pulse) => state?.getMemory(note, pulse) || false,
    set: (note, pulse, value) => state?.setMemory(note, pulse, value),
    ensure: (noteCount, pulseCount) => state?.ensureMemory(noteCount, pulseCount),
    getPairs: () => state?.getMemoryPairs() || []
  };

  /**
   * Acceso al drag system
   */
  const drag = {
    attachToNotes: (el) => dragHandlers?.attachToNotes(el),
    attachToPulses: (el) => dragHandlers?.attachToPulses(el),
    detach: () => dragHandlers?.detach()
  };

  /**
   * Acceso al column renderer
   */
  const columns = {
    render: (pairs) => columnRenderer?.render(pairs),
    highlightPulse: (pulse) => columnRenderer?.highlightPulse(pulse),
    clearHighlights: () => columnRenderer?.clearHighlights(),
    destroy: () => columnRenderer?.destroy()
  };

  /**
   * Obtiene texto actual
   */
  function getText() {
    if (!editor) return { notes: '', pulses: '' };
    return {
      notes: editor.getNoteText(),
      pulses: editor.getPulseText()
    };
  }

  /**
   * Establece texto programáticamente
   */
  function setText({ notes, pulses }) {
    if (!editor) return;
    if (notes !== undefined) editor.setNotes(notes.split(' ').map(n => parseInt(n, 10)).filter(n => !isNaN(n)));
    if (pulses !== undefined) editor.setPulses(pulses.split(' ').map(p => parseInt(p, 10)).filter(p => !isNaN(p)));
  }

  return {
    // Montaje
    mount,

    // Operaciones de pares
    getPairs,
    setPairs,
    addPair,
    removePair,
    hasPair,
    clear,
    count,

    // Getters individuales
    getNotes,
    getPulses,

    // Texto
    getText,
    setText,

    // Sub-sistemas
    memory,
    drag,
    columns,

    // Configuración
    noteRange,
    pulseRange,
    renderMode
  };
}
