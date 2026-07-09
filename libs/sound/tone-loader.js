import { hasUserInteracted } from './user-interaction.js';
// Cicle d'imports amb audio-context-helper: segur — tots dos mòduls només
// usen l'altre dins de funcions (mai durant l'avaluació del mòdul).
import { ensurePreferredSampleRateContext } from './audio-context-helper.js';

/**
 * Lazy loader for Tone.js that waits for user interaction before loading
 * This prevents AudioContext warnings on page load
 */

let toneLoadPromise = null;
let toneLoaded = false;
let scriptInjected = false;

// P-12: descarrega Tone.js (~340KB) en paral·lel a la càrrega de la pàgina
// SENSE executar-lo — només mou bytes, no crea cap AudioContext, així que
// l'ordre d'init (Tone → gest d'usuari → start) queda intacte. Al primer ús
// la injecció del <script> es resol des de la cache.
// rel=prefetch (no preload): des d'A-08 les apps rítmiques no executen mai
// Tone i Chrome avisava del preload "not used within a few seconds";
// prefetch fa la mateixa feina en prioritat baixa i sense l'avís.
if (typeof document !== 'undefined' && document.head) {
  const prefetchHref = new URL('../vendor/Tone.js', import.meta.url).href;
  if (!document.querySelector(`link[rel="prefetch"][href="${prefetchHref}"]`)) {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'script';
    link.href = prefetchHref;
    document.head.appendChild(link);
  }
}

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
    // U-01: passive — loadTone mai fa preventDefault, així que un touchstart
    // no-passiu aquí bloquejaria el primer scroll fins que el JS respon
    // (mateixa classe de bug que LA-03, ja tancada a user-interaction.js).
    const listenerOptions = { capture: true, passive: true };

    const detachListeners = () => {
      eventTypes.forEach((eventName) => {
        document.removeEventListener(eventName, onGesture, listenerOptions);
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
        toneLoaded = true;
        // Regla d'or del wiki de Tone: "set the context before creating
        // any nodes" — els nodes d'un context no es poden connectar als
        // d'un altre. Pinnem el context preferit (44100) AQUÍ, abans de
        // resoldre la promesa: així CAP consumidor (el preload del piano
        // inclòs) pot construir nodes sobre un context que després es
        // canviaria/tancaria — era l'origen del "Connecting nodes after
        // the context has been closed" i dels samplers muts al 1r play.
        try { ensurePreferredSampleRateContext(); } catch {}
        resolve(true);
      };

      script.onerror = () => {
        toneLoadPromise = null; // Reset so it can be retried
        scriptInjected = false;
        reject(new Error('Failed to load Tone.js from ' + scriptUrl));
      };

      document.head.appendChild(script);
    };

    // H-17: filtre d'esdeveniments sintètics — un click programàtic
    // (isTrusted===false) no ha de disparar loadTone, que acaba creant
    // l'AudioContext pinnat sense cap gest real de l'usuari.
    const onGesture = (event) => {
      if (event?.isTrusted === false) {
        return;
      }
      loadTone();
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
      document.addEventListener(eventName, onGesture, listenerOptions);
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
