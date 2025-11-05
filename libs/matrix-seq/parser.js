/**
 * parser.js - Validación y parsing para matrix-seq
 *
 * Reglas diferenciadas:
 * - Notas (N): Rango 0-11, permite duplicados, permite cualquier orden
 * - Pulsos (P): Rango 0-7, sin duplicados, solo orden ascendente (auto-sanitiza)
 */

/**
 * Valida un valor de nota
 * @param {number} value - Valor a validar
 * @param {number} min - Mínimo permitido (default 0)
 * @param {number} max - Máximo permitido (default 11)
 * @returns {{valid: boolean, value: number, error?: string}}
 */
export function validateNote(value, min = 0, max = 11) {
  const num = parseInt(value, 10);

  if (isNaN(num)) {
    return { valid: false, value, error: 'Nota debe ser un número' };
  }

  if (num < min || num > max) {
    return { valid: false, value: num, error: `Nota debe estar entre ${min} y ${max}` };
  }

  return { valid: true, value: num };
}

/**
 * Valida un valor de pulso
 * @param {number} value - Valor a validar
 * @param {number} min - Mínimo permitido (default 0)
 * @param {number} max - Máximo permitido (default 7)
 * @returns {{valid: boolean, value: number, error?: string}}
 */
export function validatePulse(value, min = 0, max = 7) {
  const num = parseInt(value, 10);

  if (isNaN(num)) {
    return { valid: false, value, error: 'Pulso debe ser un número' };
  }

  if (num < min || num > max) {
    return { valid: false, value: num, error: `Pulso debe estar entre ${min} y ${max}` };
  }

  return { valid: true, value: num };
}

/**
 * Parsea y valida una secuencia de notas
 * Permite duplicados y cualquier orden
 *
 * @param {string} text - Texto a parsear (ej: "0 3 7 3 11")
 * @param {Object} options - Opciones de validación
 * @returns {{notes: number[], errors: string[]}}
 */
export function parseNotes(text, options = {}) {
  const { min = 0, max = 11 } = options;
  const errors = [];
  const notes = [];

  if (!text || text.trim() === '') {
    return { notes: [], errors: [] };
  }

  // Split por espacios, filtrar vacíos
  const tokens = text.trim().split(/\s+/).filter(t => t.length > 0);

  for (const token of tokens) {
    const result = validateNote(token, min, max);

    if (result.valid) {
      notes.push(result.value);
    } else {
      errors.push(`"${token}": ${result.error}`);
    }
  }

  return { notes, errors };
}

/**
 * Parsea y valida una secuencia de pulsos
 * Sin duplicados, fuerza orden ascendente
 *
 * @param {string} text - Texto a parsear (ej: "0 2 4 6")
 * @param {Object} options - Opciones de validación
 * @returns {{pulses: number[], errors: string[], sanitized: boolean}}
 */
export function parsePulses(text, options = {}) {
  const { min = 0, max = 7 } = options;
  const errors = [];
  let pulses = [];
  let sanitized = false;

  if (!text || text.trim() === '') {
    return { pulses: [], errors: [], sanitized: false };
  }

  // Split por espacios, filtrar vacíos
  const tokens = text.trim().split(/\s+/).filter(t => t.length > 0);

  // Validar cada token
  for (const token of tokens) {
    const result = validatePulse(token, min, max);

    if (result.valid) {
      pulses.push(result.value);
    } else {
      errors.push(`"${token}": ${result.error}`);
    }
  }

  // Si hay errores de validación, retornar
  if (errors.length > 0) {
    return { pulses: [], errors, sanitized: false };
  }

  // Eliminar duplicados
  const originalLength = pulses.length;
  pulses = [...new Set(pulses)];

  if (pulses.length !== originalLength) {
    sanitized = true;
    errors.push('Pulsos duplicados eliminados');
  }

  // Ordenar ascendentemente
  const originalOrder = [...pulses];
  pulses.sort((a, b) => a - b);

  if (JSON.stringify(pulses) !== JSON.stringify(originalOrder)) {
    sanitized = true;
    errors.push('Pulsos reordenados ascendentemente');
  }

  return { pulses, errors, sanitized };
}

/**
 * Auto-completa pulsos si están vacíos
 * Genera índices secuenciales [0, 1, 2, ...]
 *
 * @param {number} count - Número de pulsos a generar
 * @param {number} max - Máximo valor permitido (default 7)
 * @returns {number[]}
 */
export function autoCompletePulses(count, max = 7) {
  const pulses = [];
  for (let i = 0; i < Math.min(count, max + 1); i++) {
    pulses.push(i);
  }
  return pulses;
}

/**
 * Crea pares (nota, pulso) desde listas separadas
 * Si las listas tienen diferente longitud, usa el mínimo
 *
 * @param {number[]} notes - Lista de notas
 * @param {number[]} pulses - Lista de pulsos
 * @returns {{note: number, pulse: number}[]}
 */
export function createPairs(notes, pulses) {
  const pairs = [];
  const length = Math.min(notes.length, pulses.length);

  for (let i = 0; i < length; i++) {
    pairs.push({ note: notes[i], pulse: pulses[i] });
  }

  return pairs;
}

/**
 * Descompone pares en listas separadas
 *
 * @param {{note: number, pulse: number}[]} pairs - Lista de pares
 * @returns {{notes: number[], pulses: number[]}}
 */
export function decomposePairs(pairs) {
  const notes = pairs.map(p => p.note);
  const pulses = pairs.map(p => p.pulse);
  return { notes, pulses };
}
