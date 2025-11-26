import { hasUserInteracted } from './user-interaction.js';

/**
 * Lazy loader for Tone.js that waits for user interaction before loading
 * This prevents AudioContext warnings on page load
 */

let toneLoadPromise = null;
let toneLoaded = false;
let scriptInjected = false;

/**
 * Ensures Tone.js is loaded before using it
 * Waits for first user interaction (click, keydown, touchstart) before loading the script
 * @returns {Promise<boolean>} True if Tone.js loaded successfully
 */
export async function ensureToneLoaded() {
  // If already loaded and available globally, return immediately
  if (toneLoaded && typeof Tone !== 'undefined') {
    return true;
  }

  // If loading is in progress, return the existing promise
  if (toneLoadPromise) {
    return toneLoadPromise;
  }

  // Start loading Tone.js after user interaction
  toneLoadPromise = new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      toneLoadPromise = null;
      resolve(false);
      return;
    }

    const eventTypes = ['click', 'keydown', 'touchstart'];
    const listenerOptions = { capture: true };

    const detachListeners = () => {
      eventTypes.forEach((eventName) => {
        document.removeEventListener(eventName, loadTone, listenerOptions);
      });
    };

    const loadTone = () => {
      detachListeners();

      if (scriptInjected) {
        return;
      }

      scriptInjected = true;

      // Create and inject script tag
      const script = document.createElement('script');
      const scriptUrl = new URL('../vendor/Tone.js', import.meta.url).href;
      script.src = scriptUrl;

      script.onload = () => {
        // Wait for Tone to be available globally (script execution may lag behind onload)
        let retries = 0;
        const maxRetries = 50; // Max 50ms wait (50 * 1ms)

        const checkTone = () => {
          if (typeof Tone !== 'undefined') {
            toneLoaded = true;
            resolve(true);
          } else if (retries < maxRetries) {
            retries++;
            // Retry after a short delay (allows script to execute)
            setTimeout(checkTone, 1);
          } else {
            // Fallback: resolve anyway after max retries (script loaded but Tone not global yet)
            toneLoaded = true;
            resolve(true);
          }
        };
        checkTone();
      };

      script.onerror = () => {
        toneLoadPromise = null; // Reset so it can be retried
        scriptInjected = false;
        reject(new Error('Failed to load Tone.js from ' + scriptUrl));
      };

      document.head.appendChild(script);
    };

    const hasActiveUserGesture =
      (typeof navigator !== 'undefined' && navigator.userActivation?.isActive) ||
      hasUserInteracted();

    if (hasActiveUserGesture) {
      loadTone();
      return;
    }

    // Wait for first user interaction before loading
    eventTypes.forEach((eventName) => {
      document.addEventListener(eventName, loadTone, listenerOptions);
    });
  });

  return toneLoadPromise;
}

/**
 * Check if Tone.js is already loaded
 * @returns {boolean}
 */
export function isToneLoaded() {
  return toneLoaded && typeof Tone !== 'undefined';
}
