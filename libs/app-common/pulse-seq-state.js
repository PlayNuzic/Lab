/**
 * @fileoverview Gestión de estado de secuencia de pulsos
 *
 * Este módulo gestiona el estado compartido entre pulseMemory (pulsos enteros seleccionados)
 * y fractionStore (fracciones seleccionadas), proporcionando operaciones atómicas para:
 * - Aplicar tokens validados al estado
 * - Generar texto formateado del campo
 * - Sincronizar estado con Lg
 */

/**
 * Crea gestor de estado para pulseSeq
 * @param {object} config - Configuración
 * @param {object} config.fractionStore - Store de fracciones con selectionState, pulseSeqEntryOrder, pulseSeqEntryLookup
 * @param {object} config.pulseMemoryApi - API de pulseMemory con data, ensure
 * @returns {object} API del gestor de estado
 */
export function createPulseSeqStateManager({ fractionStore, pulseMemoryApi }) {

  /**
   * Aplica tokens validados al estado
   * Limpia selecciones previas y aplica las nuevas
   *
   * @param {Array<number>} integers - Pulsos enteros válidos (ej: [1, 3, 5])
   * @param {Array<object>} fractions - Fracciones válidas con {key, base, numerator, denominator, value, display, ...}
   * @param {object} options - Opciones adicionales
   * @param {number} options.lg - Longitud del grid (opcional, para pulseMemory)
   */
  function applyValidatedTokens(integers, fractions, { lg } = {}) {
    // 1. Actualizar pulseMemory si tenemos Lg válido
    if (Number.isFinite(lg) && lg > 0) {
      pulseMemoryApi.ensure(lg);

      // Limpiar todos los pulsos
      for (let i = 1; i < lg; i++) {
        pulseMemoryApi.data[i] = false;
      }

      // Aplicar pulsos enteros válidos
      integers.forEach(i => {
        if (i < lg) {
          pulseMemoryApi.data[i] = true;
        }
      });
    }

    // 2. Actualizar fractionStore
    fractionStore.selectionState.clear();
    fractions.forEach(entry => {
      if (entry && entry.key) {
        fractionStore.selectionState.set(entry.key, entry);
      }
    });
  }

  /**
   * Genera texto formateado del campo pulseSeq
   * El formato es: "  1  3.2  5  " (dobles espacios como separadores)
   *
   * @param {object} options - Opciones de generación
   * @param {number} options.lg - Longitud del grid
   * @param {object} options.pulseSeqRanges - Mapa de rangos de texto (se modifica in-place)
   * @returns {string} Texto formateado
   */
  function generateFieldText({ lg, pulseSeqRanges = {} }) {
    const hasValidLg = Number.isFinite(lg) && lg > 0;

    if (hasValidLg) {
      // Con Lg válido: generar desde pulseMemory + fractionStore
      const ints = [];
      for (let i = 1; i < lg; i++) {
        if (pulseMemoryApi.data[i]) {
          ints.push(i);
        }
      }

      const fracs = Array.from(fractionStore.selectionState.values())
        .map(f => f.display)
        .sort();

      const combined = [...ints, ...fracs];
      return combined.length > 0
        ? '  ' + combined.join('  ') + '  '
        : '  ';
    }

    // Sin Lg válido: usar orden de entrada (preservar orden temporal)
    const ints = [];
    const fracs = [];

    // Extraer enteros desde pulseMemory
    for (let i = 0; i < pulseMemoryApi.data.length; i++) {
      if (pulseMemoryApi.data[i]) {
        ints.push({ value: i, display: String(i), key: String(i) });
      }
    }

    // Extraer fracciones desde fractionStore
    fractionStore.selectionState.forEach((entry) => {
      const rawLabel = typeof entry.rawLabel === 'string' ? entry.rawLabel : '';
      const preferred = rawLabel ? rawLabel : entry.display;
      fracs.push({ value: entry.value, display: preferred, key: entry.key });
    });

    // Combinar y ordenar por valor
    const combined = [...ints, ...fracs].sort((a, b) => a.value - b.value);

    // Actualizar metadatos del fractionStore
    fractionStore.pulseSeqEntryOrder = combined.map(entry => entry.key);
    fractionStore.pulseSeqEntryLookup.clear();

    // Generar texto y actualizar rangos
    let pos = 0;
    const parts = combined.map(entry => {
      if (!entry || !entry.key) return '';

      const start = pos + 2;
      const end = start + entry.display.length;
      pulseSeqRanges[entry.key] = [start, end];
      pos += entry.display.length + 2;

      const type = entry.display.includes('.') ? 'fraction' : 'int';
      fractionStore.pulseSeqEntryLookup.set(entry.key, { ...entry, type });

      return entry.display;
    }).filter(Boolean);

    return parts.length > 0
      ? '  ' + parts.join('  ') + '  '
      : '  ';
  }

  /**
   * Sincroniza pulseMemory con lg (asegura que el array tenga tamaño suficiente)
   * @param {number} lg - Longitud del grid
   */
  function syncMemory(lg) {
    if (Number.isFinite(lg) && lg > 0) {
      pulseMemoryApi.ensure(lg);
    }
  }

  /**
   * Obtiene el estado actual de selección
   * @returns {{integers: Array<number>, fractions: Array<object>}}
   */
  function getCurrentSelection() {
    const integers = [];
    for (let i = 0; i < pulseMemoryApi.data.length; i++) {
      if (pulseMemoryApi.data[i]) {
        integers.push(i);
      }
    }

    const fractions = Array.from(fractionStore.selectionState.values());

    return { integers, fractions };
  }

  /**
   * Limpia todas las selecciones
   * @param {number} lg - Longitud del grid (opcional)
   */
  function clearAll(lg) {
    if (Number.isFinite(lg) && lg > 0) {
      pulseMemoryApi.ensure(lg);
      for (let i = 1; i < lg; i++) {
        pulseMemoryApi.data[i] = false;
      }
    }
    fractionStore.selectionState.clear();
    fractionStore.pulseSeqEntryOrder = [];
    fractionStore.pulseSeqEntryLookup.clear();
  }

  // API pública
  return {
    applyValidatedTokens,
    generateFieldText,
    syncMemory,
    getCurrentSelection,
    clearAll
  };
}
