// P-13: entry retallat per al Lab — el vexflow.js de sèrie carrega i
// parseja SIS fonts (~790KB de glyph-data JS); la notació del repo només
// usa Bravura (música) i Academico (text). Sense build step no hi ha
// tree-shaking: Petaluma/PetalumaScript/Gonville (~400KB + 3 requests)
// viatjaven per res a cada app amb notació. Mateixa forma que l'entry
// original (fontsReady inclòs) perquè el canvi sigui només d'import.
import { VexFlow } from '../src/vexflow.js';
import { Font } from '../src/font.js';
import { Academico } from '../src/fonts/academico.js';
import { AcademicoBold } from '../src/fonts/academicobold.js';
import { Bravura } from '../src/fonts/bravura.js';
const block = { display: 'block' };
const swap = { display: 'swap' };
const swapBold = { display: 'swap', weight: 'bold' };
const fontBravura = Font.load('Bravura', Bravura, block);
const fontAcademico = Font.load('Academico', Academico, swap);
const fontAcademicoBold = Font.load('Academico', AcademicoBold, swapBold);
const fontLoadPromises = [
    fontBravura,
    fontAcademico,
    fontAcademicoBold,
];
VexFlow.BUILD.INFO = 'vexflow-nuzic';
VexFlow.setFonts('Bravura', 'Academico');

// Export a promise that resolves when all fonts are loaded
// This allows apps to await font loading before rendering
export const fontsReady = Promise.allSettled(fontLoadPromises);

export * from '../src/index.js';
export default VexFlow;
