// Façana lazy de libs/notation: l'entry complet arrossega VexFlow
// (~1,6MB, 108 mòduls). Les apps amb el panell de notació tancat per
// defecte (App2/App4/App5) només l'han de pagar la primera vegada que
// s'obre. Per a imports síncrons lleugers hi ha mòduls lliures de
// VexFlow: panel.js, utils.js i fraction-notation.js.
let notationPromise = null;

export function loadNotation() {
  if (!notationPromise) {
    notationPromise = import('./index.js').catch((err) => {
      notationPromise = null; // un fetch fallit es pot reintentar al següent toggle
      throw err;
    });
  }
  return notationPromise;
}
