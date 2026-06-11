let userInteractionCaptured = false;
let userInteractionPromise = null;

function markInteraction() {
  userInteractionCaptured = true;
}

// L'activació "sticky" del navegador: true des del PRIMER gest de l'usuari a
// la pàgina, per sempre. És exactament el contracte que aquest gate vol
// representar — si el navegador ja la té, el gest va passar encara que els
// nostres listeners no el veiessin.
function hasStickyActivation() {
  return typeof navigator !== 'undefined' && navigator.userActivation?.hasBeenActive === true;
}

function attachListeners() {
  if (typeof document === 'undefined') {
    markInteraction();
    return Promise.resolve();
  }

  if (!userInteractionPromise) {
    userInteractionPromise = new Promise((resolve) => {
      const handleInteraction = (event) => {
        if (event?.isTrusted === false) {
          return;
        }

        markInteraction();
        document.removeEventListener('click', handleInteraction);
        document.removeEventListener('keydown', handleInteraction);
        document.removeEventListener('touchstart', handleInteraction);
        resolve();
      };

      // LA-03: el handler mai fa preventDefault, així que passive és
      // gratis — sense això, un touchstart no-passiu a document bloqueja
      // el primer scroll de la pàgina fins que el JS respon.
      document.addEventListener('click', handleInteraction, { passive: true });
      document.addEventListener('keydown', handleInteraction, { passive: true });
      document.addEventListener('touchstart', handleInteraction, { passive: true });
    });
  }

  return userInteractionPromise;
}

export function hasUserInteracted() {
  return userInteractionCaptured || hasStickyActivation();
}

export function waitForUserInteraction() {
  if (userInteractionCaptured) {
    return Promise.resolve();
  }
  // Sticky activation: el gest ja ha passat (p. ex. el clic de Play que ha
  // disparat aquesta mateixa cadena d'init) — esperar-ne un altre seria
  // esperar un tren que ja ha sortit.
  if (hasStickyActivation()) {
    markInteraction();
    return Promise.resolve();
  }

  return attachListeners();
}

// REGRESSIÓ CAÇADA (2026-06-11): aquest gate s'armava implícitament a la
// CÀRREGA de cada pàgina perquè el constructor de l'AudioMixer (singleton
// creat a l'eval de libs/sound/index.js) cridava waitForUserInteraction()
// per sincronitzar el seu graf de Tone. A-17 va eliminar aquell graf (era
// codi mort)... i sense saber-ho va desarmar el gate: la primera crida
// passava a ser DINS de la cadena d'init del primer Play, sovint després
// d'un await (càrrega de Tone.js) — és a dir, DESPRÉS del clic — i el gate
// es quedava esperant un segon clic ("la primera no sona, la segona sí").
// L'armat al load del mòdul recupera el comportament d'abans de manera
// EXPLÍCITA; el camí de sticky activation de dalt cobreix qualsevol ordre
// patològic que quedi (i navegadors sense userActivation cauen al gate
// armat). Cap so ni AudioContext es crea aquí: només listeners passius.
attachListeners();
