// libs/sound/flute.js
// Flute instrument using Tone.js Sampler with tonejs-instruments samples

/**
 * Flute instrument manager using Tone.js Sampler
 * Loads samples from nbrosowsky/tonejs-instruments GitHub repository
 *
 * Sample source: https://github.com/nbrosowsky/tonejs-instruments
 * License: Check repository for licensing details
 *
 * IMPORTANT: This module assumes the AudioContext is already running.
 * The audio engine (MelodicTimelineAudio) must call ready() before loading instruments.
 */

import { log } from '../app-common/logger.js';
import { whenMelodicChannelReady } from './engine-ready.js';
let sampler = null;
let isLoaded = false;
let loadPromise = null;
let preloadInitiated = false;

/**
 * Reset flute sampler (needed when AudioContext changes)
 * Called by MelodicTimelineAudio when Tone.setContext() is used
 */
export function resetFlute() {
  if (sampler) {
    try {
      sampler.disconnect();
      sampler.dispose();
    } catch (e) {
      // Ignore errors during cleanup
    }
  }
  sampler = null;
  isLoaded = false;
  loadPromise = null;
  preloadInitiated = false;
  log('Flute sampler reset');
}

// Base URL for tonejs-instruments samples on GitHub Pages
const BASE_URL = 'https://nbrosowsky.github.io/tonejs-instruments/samples/flute/';

// Available flute samples (A, C, E across octaves 4-7)
// Tone.js Sampler will interpolate missing notes
const FLUTE_NOTES = [
  'A4', 'A5', 'A6',
  'C4', 'C5', 'C6', 'C7',
  'E4', 'E5', 'E6'
];

/**
 * Load flute sampler with samples from tonejs-instruments
 * @returns {Promise<Tone.Sampler>} Loaded sampler instance
 */
export async function loadFlute() {
  // Return existing sampler if already loaded
  if (sampler && isLoaded) {
    return sampler;
  }

  // Return ongoing load promise if loading
  if (loadPromise) {
    return loadPromise;
  }

  // Ensure Tone.js is loaded and available globally
  if (typeof window.Tone === 'undefined') {
    throw new Error('Tone.js not loaded. Ensure tone-loader.js has initialized Tone.js.');
  }

  const Tone = window.Tone;

  loadPromise = (async () => {
    try {
      // Wait for the engine's melodic channel FIRST, then pin Tone.js to its
      // AudioContext BEFORE building the sampler — same cross-context fix as
      // piano.js (Chrome enforces same-context connects; Firefox is lax).
      // LA-08: senyal del motor en lloc de polling (vegeu engine-ready.js).
      let melodicChannel = await whenMelodicChannelReady(1500);
      if (!melodicChannel) {
        melodicChannel = window.NuzicAudioEngine?.getMelodicChannel?.() || null;
        if (!melodicChannel) {
          console.warn('Flute: melodic channel not ready — sampler will bypass the master FX chain');
        }
      }
      if (melodicChannel?.context) {
        const toneCtx = Tone.getContext?.()?.rawContext || Tone.getContext?.() || Tone.context;
        if (toneCtx !== melodicChannel.context && typeof Tone.setContext === 'function') {
          log('Flute: aligning Tone.js to the engine AudioContext');
          Tone.setContext(melodicChannel.context);
        }
      }

      // Resume the (now engine-aligned) context if suspended
      const ctx = Tone.context?.rawContext || Tone.context;
      if (ctx?.state === 'suspended') {
        try {
          await ctx.resume();
        } catch (resumeErr) {
          console.warn('Flute: Resume failed:', resumeErr.message);
        }
      }

      // Create URLs object mapping note names to files
      const urls = {};
      FLUTE_NOTES.forEach(note => {
        urls[note] = `${note}.mp3`;
      });

      // A-12: samples vendoritzats en local primer; el CDN queda com a
      // fallback per a desplegaments parcials (mateixa estratègia que piano.js).
      const sampleBases = [
        new URL('./samples/instruments/flute/', import.meta.url).href,
        BASE_URL
      ];

      let loadError = null;
      for (const baseUrl of sampleBases) {
        // Create the sampler — now guaranteed to live in the engine's context
        try {
          sampler = new Tone.Sampler({
            urls,
            attack: 0.1,    // Soft attack to smooth the start
            release: 0.8,   // Longer release for smoother decay
            baseUrl
          });
        } catch (samplerErr) {
          console.error('Flute: Tone.Sampler constructor failed:', samplerErr.name, samplerErr.message);
          throw samplerErr;
        }

        // Connect to the melodic channel (same context) or fall back to the
        // destination. Connect failure is non-fatal so the flute still plays.
        try {
          if (melodicChannel) {
            sampler.connect(melodicChannel);
          } else {
            sampler.toDestination();
          }
        } catch (connectErr) {
          console.warn('Flute: connect failed, using destination:', connectErr.message);
          try { sampler.toDestination(); } catch {}
        }

        // Wait for all samples to load
        log(`Flute: Calling Tone.loaded() (${baseUrl})...`);
        try {
          await Tone.loaded();
          log('Flute: Tone.loaded() completed');
          loadError = null;
          break;
        } catch (loadedErr) {
          console.warn(`Flute: load failed from ${baseUrl}:`, loadedErr.name, loadedErr.message);
          loadError = loadedErr;
          try { sampler.dispose?.(); } catch {}
          sampler = null;
        }
      }
      if (loadError) {
        console.error('Flute: Tone.loaded() failed on all sources:', loadError.name, loadError.message);
        throw loadError;
      }

      isLoaded = true;
      log('Flute loaded successfully');
      return sampler;
    } catch (err) {
      // Reset state on failure to allow retry
      loadPromise = null;
      sampler = null;
      isLoaded = false;
      throw err;
    }
  })();

  return loadPromise;
}

/**
 * Check if flute is loaded
 * @returns {boolean}
 */
export function isFluteLoaded() {
  return isLoaded;
}

/**
 * Preload flute samples in background after user interaction
 * This reduces perceived latency by loading samples before user clicks Play
 *
 * @param {Object} options - Preload options
 * @param {number} options.delay - Delay in ms before starting preload (default: 300)
 * @param {Function} options.onStart - Callback when preload starts
 * @param {Function} options.onComplete - Callback when preload completes
 * @param {Function} options.onError - Callback on preload error
 * @returns {Promise<void>}
 */
export async function preloadFlute(options = {}) {
  const { delay = 300, onStart, onComplete, onError } = options;

  // Already loaded or preload already started
  if (isLoaded || preloadInitiated) {
    return;
  }

  preloadInitiated = true;

  // Wait for specified delay to not block initial interaction
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  try {
    onStart?.();
    await loadFlute();
    onComplete?.();
  } catch (err) {
    preloadInitiated = false; // Allow retry
    onError?.(err);
    // Only log non-access errors (InvalidAccessError is expected during early preload)
    if (!(err instanceof DOMException && err.name === 'InvalidAccessError')) {
      console.warn('Flute preload failed:', err);
    }
  }
}

/**
 * Check if flute preload has been initiated
 * @returns {boolean}
 */
export function isFlutePreloading() {
  return preloadInitiated && !isLoaded;
}
