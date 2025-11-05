/**
 * state.js - Gestión de estado para pares (nota, pulso)
 *
 * Mantiene sincronizadas tres representaciones:
 * 1. Array de pares [{note, pulse}, ...] - orden preservado
 * 2. Set de strings "note-pulse" - búsqueda rápida
 * 3. Memory 2D para persistencia
 */

/**
 * Crea un gestor de estado para pares matriz
 *
 * @param {Object} options - Opciones de configuración
 * @returns {Object} API del state manager
 */
export function createPairStateManager(options = {}) {
  const {
    noteRange = [0, 11],
    pulseRange = [0, 7],
    onChange = () => {}
  } = options;

  // Estado interno
  let pairs = []; // [{note, pulse}, ...]
  let pairSet = new Set(); // Set<'note-pulse'>
  let memory = {}; // {note: {pulse: boolean}}

  /**
   * Genera clave única para un par
   */
  function pairKey(note, pulse) {
    return `${note}-${pulse}`;
  }

  /**
   * Añade un par
   */
  function add(note, pulse) {
    const key = pairKey(note, pulse);

    if (pairSet.has(key)) {
      return false; // Ya existe
    }

    pairs.push({ note, pulse });
    pairSet.add(key);

    // Actualizar memory
    if (!memory[note]) memory[note] = {};
    memory[note][pulse] = true;

    onChange(getPairs());
    return true;
  }

  /**
   * Elimina un par
   */
  function remove(note, pulse) {
    const key = pairKey(note, pulse);

    if (!pairSet.has(key)) {
      return false; // No existe
    }

    pairs = pairs.filter(p => !(p.note === note && p.pulse === pulse));
    pairSet.delete(key);

    // Actualizar memory
    if (memory[note] && memory[note][pulse]) {
      delete memory[note][pulse];
    }

    onChange(getPairs());
    return true;
  }

  /**
   * Verifica si existe un par
   */
  function has(note, pulse) {
    return pairSet.has(pairKey(note, pulse));
  }

  /**
   * Limpia todos los pares
   */
  function clear() {
    pairs = [];
    pairSet.clear();
    memory = {};
    onChange([]);
  }

  /**
   * Obtiene todos los pares (orden preservado)
   */
  function getPairs() {
    return [...pairs];
  }

  /**
   * Establece pares desde array
   * Reemplaza completamente el estado actual
   */
  function setPairs(newPairs) {
    clear();

    for (const pair of newPairs) {
      const key = pairKey(pair.note, pair.pulse);
      pairs.push(pair);
      pairSet.add(key);

      if (!memory[pair.note]) memory[pair.note] = {};
      memory[pair.note][pair.pulse] = true;
    }

    onChange(getPairs());
  }

  /**
   * Obtiene solo las notas (orden preservado, con duplicados)
   */
  function getNotes() {
    return pairs.map(p => p.note);
  }

  /**
   * Obtiene solo los pulsos (orden preservado)
   */
  function getPulses() {
    return pairs.map(p => p.pulse);
  }

  /**
   * Obtiene estado de memory para un par
   */
  function getMemory(note, pulse) {
    return memory[note]?.[pulse] || false;
  }

  /**
   * Establece estado de memory
   */
  function setMemory(note, pulse, value) {
    if (!memory[note]) memory[note] = {};
    memory[note][pulse] = value;
  }

  /**
   * Expande memory para asegurar rango
   */
  function ensureMemory(noteCount, pulseCount) {
    for (let n = 0; n <= noteCount; n++) {
      if (!memory[n]) memory[n] = {};
      for (let p = 0; p <= pulseCount; p++) {
        if (memory[n][p] === undefined) {
          memory[n][p] = false;
        }
      }
    }
  }

  /**
   * Obtiene todos los pares activos en memory
   */
  function getMemoryPairs() {
    const memPairs = [];
    for (const note in memory) {
      for (const pulse in memory[note]) {
        if (memory[note][pulse]) {
          memPairs.push({
            note: parseInt(note, 10),
            pulse: parseInt(pulse, 10)
          });
        }
      }
    }
    return memPairs;
  }

  /**
   * Cuenta total de pares
   */
  function count() {
    return pairs.length;
  }

  return {
    // Core operations
    add,
    remove,
    has,
    clear,

    // Getters/Setters
    getPairs,
    setPairs,
    getNotes,
    getPulses,
    count,

    // Memory system
    getMemory,
    setMemory,
    ensureMemory,
    getMemoryPairs,

    // Config
    noteRange,
    pulseRange
  };
}
