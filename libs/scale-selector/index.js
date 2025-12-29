/**
 * Scale Selector Module - Entry Point
 *
 * Selector d'escales amb suport per:
 * - Totes les escales mare amb TOTES les seves rotacions/modes
 * - Selector de nota de sortida (transposició 0-11)
 * - Filtres per App: escollir quines escales/rotacions mostrar
 * - Integració amb preferències i factory reset
 *
 * @module scale-selector
 *
 * @example
 * // Importar el mòdul
 * import {
 *   createScaleSelector,
 *   createTransposeSelector,
 *   ALL_SCALES,
 *   SCALE_PRESETS,
 *   filterScales,
 *   getRotatedScaleNotes
 * } from '../../libs/scale-selector/index.js';
 *
 * @example
 * // Crear selector amb preset (com App21 original)
 * const selector = createScaleSelector({
 *   container: document.getElementById('scaleContainer'),
 *   appId: 'app21',
 *   preset: 'app21',  // DIAT tots modes + altres escales mode 0
 *   initialScale: 'CROM-0',
 *   enableTranspose: true,
 *   transposeHiddenByDefault: true,
 *   onScaleChange: ({ scaleNotes, displayName }) => {
 *     console.log('Escala:', displayName, 'Notes:', scaleNotes);
 *   },
 *   onTransposeChange: (transpose) => {
 *     console.log('Transposició:', transpose);
 *   }
 * });
 * selector.render();
 * selector.addTransposeOptionToMenu();
 *
 * @example
 * // Crear selector amb TOTES les escales i rotacions
 * const selector = createScaleSelector({
 *   container: document.getElementById('scaleContainer'),
 *   appId: 'myApp',
 *   preset: 'all'  // Totes les escales amb totes les rotacions
 * });
 *
 * @example
 * // Crear selector amb filtre personalitzat
 * const selector = createScaleSelector({
 *   container: document.getElementById('scaleContainer'),
 *   appId: 'myApp',
 *   filter: {
 *     scaleIds: ['DIAT', 'ACUS', 'ARMme'],
 *     rotations: {
 *       DIAT: 'all',        // Tots els 7 modes de la diatònica
 *       ACUS: [0, 1, 4],    // Només modes 0, 1 i 4 de l'acústica
 *       ARMme: 'all'        // Tots els modes de l'armònica menor
 *     }
 *   }
 * });
 *
 * @example
 * // Obtenir totes les escales disponibles
 * import { ALL_SCALES } from '../../libs/scale-selector/index.js';
 * console.log(ALL_SCALES);
 * // [
 * //   { id: 'CROM', rotation: 0, value: 'CROM-0', name: 'Cromática', ... },
 * //   { id: 'DIAT', rotation: 0, value: 'DIAT-0', name: 'Mayor', ... },
 * //   { id: 'DIAT', rotation: 1, value: 'DIAT-1', name: 'Dórica', ... },
 * //   ...
 * // ]
 */

export {
  // Components principals
  createScaleSelector,
  createTransposeSelector,

  // Dades d'escales
  SCALE_IDS,
  ALL_SCALES,
  getAllScalesWithRotations,

  // Presets i filtres
  SCALE_PRESETS,
  getScalesByPreset,
  filterScales,

  // Utilitats
  getRotatedScaleNotes,
  getScaleDisplayName,
  getScaleShortName,
  parseScaleValue,
  getScaleInfo
} from './scale-selector.js';
