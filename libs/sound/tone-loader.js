/**
 * Lazy loader for Tone.js that waits for user interaction before loading
 * This prevents AudioContext warnings on page load
 */

let toneLoadPromise = null;
let toneLoaded = false;

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
    const loadTone = () => {
      // Remove event listeners immediately to prevent multiple loads
      document.removeEventListener('click', loadTone);
      document.removeEventListener('keydown', loadTone);
      document.removeEventListener('touchstart', loadTone);

      // Create and inject script tag
      const script = document.createElement('script');
      const scriptUrl = new URL('../vendor/Tone.js', import.meta.url).href;
      script.src = scriptUrl;

      script.onload = () => {
        toneLoaded = true;
        resolve(true);
      };

      script.onerror = () => {
        toneLoadPromise = null; // Reset so it can be retried
        reject(new Error('Failed to load Tone.js from ' + scriptUrl));
      };

      document.head.appendChild(script);
    };

    // Wait for first user interaction before loading
    document.addEventListener('click', loadTone, { once: true, capture: true });
    document.addEventListener('keydown', loadTone, { once: true, capture: true });
    document.addEventListener('touchstart', loadTone, { once: true, capture: true });
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
