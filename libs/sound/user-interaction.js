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
      const handleInteraction = () => {
        markInteraction();
        document.removeEventListener('click', handleInteraction);
        document.removeEventListener('keydown', handleInteraction);
        document.removeEventListener('touchstart', handleInteraction);
        resolve();
      };

      document.addEventListener('click', handleInteraction, { once: true });
      document.addEventListener('keydown', handleInteraction, { once: true });
      document.addEventListener('touchstart', handleInteraction, { once: true });
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
