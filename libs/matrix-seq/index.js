/**
 * matrix-seq - Sistema de secuencias 2D (Notas × Pulsos)
 *
 * Módulo compartido para gestionar pares de coordenadas (nota, pulso)
 * con sincronización bidireccional entre sucesiones y matriz visual.
 *
 * Features:
 * - Dual contenteditable (Notas + Pulsos)
 * - Validación diferenciada (N: libre, P: ascendente sin duplicados)
 * - Drag selection en ambos ejes
 * - Memory system para persistencia
 * - Sincronización automática sucesiones ↔ matriz
 * - Column-based renderer with multi-voice support
 * - Grid-based editor with invisible table layout (2 rows × 8 columns)
 */

export { createMatrixSeqController } from './matrix-seq.js';
export { parseNotes, parsePulses, validateNote, validatePulse } from './parser.js';
export { createPairStateManager } from './state.js';
export { createDualEditor } from './editor.js';
export { createDragHandlers } from './drag.js';
export { createSyncManager } from './sync.js';
export { createPairColumnsRenderer } from './pair-columns.js';
export { createGridEditor } from './grid-editor.js';

// Interval parser functions for App15
export {
  getIntervalRange,
  validateSoundInterval,
  validateTemporalInterval,
  parseIntervalPairs,
  intervalsToPairs,
  formatInterval
} from './interval-parser.js';
