/**
 * sync.js - Sistema de sincronización bidireccional
 *
 * Sincroniza tres fuentes de verdad:
 * 1. Editor (contenteditable N + P)
 * 2. State (pares en memoria)
 * 3. Visual (matriz 2D)
 *
 * Evita loops circulares con debouncing y flags
 */

/**
 * Crea un gestor de sincronización
 *
 * @param {Object} config - Configuración
 * @returns {Object} API del sync manager
 */
export function createSyncManager(config = {}) {
  const {
    editor = null,
    state = null,
    onSyncComplete = () => {},
    debounceMs = 50
  } = config;

  let syncTimeout = null;
  let isSyncing = false;

  /**
   * Sincroniza desde editor → state
   * Cuando el usuario edita los campos de texto
   */
  function syncFromEditor() {
    if (isSyncing) return;

    isSyncing = true;

    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      const pairs = editor.getPairs();
      state.setPairs(pairs);

      onSyncComplete('editor', pairs);
      isSyncing = false;
    }, debounceMs);
  }

  /**
   * Sincroniza desde state → editor
   * Cuando se modifican pares programáticamente
   */
  function syncToEditor() {
    if (isSyncing) return;

    isSyncing = true;

    const notes = state.getNotes();
    const pulses = state.getPulses();

    editor.setNotes(notes);
    editor.setPulses(pulses);

    onSyncComplete('state', state.getPairs());
    isSyncing = false;
  }

  /**
   * Sincroniza añadiendo un par
   * Usado desde clicks en matriz
   */
  function addPair(note, pulse) {
    if (isSyncing) return false;

    isSyncing = true;
    const added = state.add(note, pulse);

    if (added) {
      // Direct editor update (bypass flag check in syncToEditor)
      const notes = state.getNotes();
      const pulses = state.getPulses();
      editor.setNotes(notes);
      editor.setPulses(pulses);
      onSyncComplete('state', state.getPairs());
    }

    isSyncing = false;
    return added;
  }

  /**
   * Sincroniza eliminando un par
   * Usado desde clicks en matriz
   */
  function removePair(note, pulse) {
    if (isSyncing) return false;

    isSyncing = true;
    const removed = state.remove(note, pulse);

    if (removed) {
      // Direct editor update (bypass flag check in syncToEditor)
      const notes = state.getNotes();
      const pulses = state.getPulses();
      editor.setNotes(notes);
      editor.setPulses(pulses);
      onSyncComplete('state', state.getPairs());
    }

    isSyncing = false;
    return removed;
  }

  /**
   * Limpia toda la sincronización
   */
  function clear() {
    isSyncing = true;
    state.clear();
    editor.clear();
    onSyncComplete('clear', []);
    isSyncing = false;
  }

  /**
   * Verifica si está sincronizando
   */
  function getSyncStatus() {
    return isSyncing;
  }

  return {
    syncFromEditor,
    syncToEditor,
    addPair,
    removePair,
    clear,
    getSyncStatus
  };
}
