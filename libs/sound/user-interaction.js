let userInteractionCaptured = false;
let userInteractionPromise = null;

function markInteraction() {
  userInteractionCaptured = true;
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
  return userInteractionCaptured;
}

export function waitForUserInteraction() {
  if (userInteractionCaptured) {
    return Promise.resolve();
  }

  return attachListeners();
}
