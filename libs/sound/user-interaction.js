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

      document.addEventListener('click', handleInteraction);
      document.addEventListener('keydown', handleInteraction);
      document.addEventListener('touchstart', handleInteraction);
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
