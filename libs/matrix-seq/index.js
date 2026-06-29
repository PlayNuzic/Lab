/**
 * matrix-seq - Utilitats de parsing d'intervals (sound/temporal)
 *
 * Nota (2026-06): el sistema d'editor N×P (createMatrixSeqController,
 * createDualEditor, createGridEditor, createDragHandlers, createSyncManager,
 * createPairColumnsRenderer, createPairStateManager i el parser N/P) es va
 * eliminar perquè cap app l'usava — les apps tenen els seus editors inline.
 * Es conserva només `interval-parser.js`, que sí s'usa (App15 i
 * libs/interval-sequencer).
 */

export {
  getIntervalRange,
  validateSoundInterval,
  validateTemporalInterval,
  parseIntervalPairs,
  intervalsToPairs,
  formatInterval
} from './interval-parser.js';
