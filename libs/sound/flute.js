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
  console.log('Flute sampler reset');
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
      // Verify AudioContext is running before creating sampler
      const ctx = Tone.context?.rawContext || Tone.context;
      console.log('Flute: AudioContext state before creating sampler:', ctx?.state);

      if (ctx?.state === 'suspended') {
        console.log('Flute: Context suspended, attempting resume...');
        try {
          await ctx.resume();
          console.log('Flute: Context resumed, state:', ctx.state);
        } catch (resumeErr) {
          console.warn('Flute: Resume failed:', resumeErr.message);
        }
      }

      // Create URLs object mapping note names to files
      const urls = {};
      FLUTE_NOTES.forEach(note => {
        urls[note] = `${note}.mp3`;
      });

      // Create sampler - wrap in try-catch to see exact error
      console.log('Flute: About to create Tone.Sampler...');
      try {
        sampler = new Tone.Sampler({
          urls,
          release: 0.4,  // Shorter release than violin - flute sound decays faster
          baseUrl: BASE_URL
        });
        console.log('Flute: Tone.Sampler created successfully');
      } catch (samplerErr) {
        console.error('Flute: Tone.Sampler constructor failed:', samplerErr.name, samplerErr.message);
        console.error('Flute: Full error:', samplerErr);
        throw samplerErr;
      }

      // Wait for melodic channel to be available (audio engine initialization)
      // Retry up to 10 times with 100ms delay
      let melodicChannel = null;
      console.log('Flute: Waiting for melodic channel...');
      for (let i = 0; i < 10 && !melodicChannel; i++) {
        melodicChannel = window.NuzicAudioEngine?.getMelodicChannel?.();
        if (!melodicChannel && i < 9) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Connect to melodic channel (goes through master effects chain) or fallback to destination
      console.log('Flute: About to connect sampler, melodicChannel:', !!melodicChannel);
      try {
        if (melodicChannel) {
          sampler.connect(melodicChannel);
          console.log('Flute connected to melodic channel (through effects chain)');
        } else {
          sampler.toDestination();
          console.log('Flute connected directly to destination (no effects chain)');
        }
      } catch (connectErr) {
        console.error('Flute: Connect failed:', connectErr.name, connectErr.message);
        throw connectErr;
      }

      // Wait for all samples to load
      console.log('Flute: Calling Tone.loaded()...');
      try {
        await Tone.loaded();
        console.log('Flute: Tone.loaded() completed');
      } catch (loadedErr) {
        console.error('Flute: Tone.loaded() failed:', loadedErr.name, loadedErr.message);
        throw loadedErr;
      }

      isLoaded = true;
      console.log('Flute loaded successfully');
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
 * Play a single note
 * @param {number} midiNumber - MIDI note number (e.g., 60 = C4)
 * @param {number} duration - Note duration in seconds
 * @param {number} when - When to play (seconds from now, default 0)
 */
export async function playNote(midiNumber, duration, when = 0) {
  if (!isLoaded || !sampler) {
    console.warn('Flute not loaded, loading now...');
    await loadFlute();
  }

  const Tone = window.Tone;
  const note = Tone.Frequency(midiNumber, 'midi').toNote();
  const playTime = when === 0 ? Tone.now() : Tone.now() + when;

  sampler.triggerAttackRelease(note, duration, playTime, 0.25);
}

/**
 * Play a sequence of notes
 * @param {number[]} midiNumbers - Array of MIDI note numbers
 * @param {number} intervalSec - Interval between note starts (seconds)
 * @param {Function} onNote - Callback (index, midiNumber) called when each note plays
 * @param {Function} onComplete - Callback called when sequence completes
 */
export async function playSequence(midiNumbers, intervalSec, onNote, onComplete) {
  if (!isLoaded || !sampler) {
    console.log('Flute not loaded, loading...');
    await loadFlute();
  }

  const Tone = window.Tone;
  const startTime = Tone.now();

  // Schedule all notes
  midiNumbers.forEach((midi, idx) => {
    const when = startTime + (idx * intervalSec);
    const note = Tone.Frequency(midi, 'midi').toNote();

    // Duration is 90% of interval to leave small gap
    const noteDuration = intervalSec * 0.9;
    sampler.triggerAttackRelease(note, noteDuration, when, 0.25);

    // Call onNote callback at the right time
    if (onNote) {
      const delay = idx * intervalSec * 1000; // Convert to milliseconds
      setTimeout(() => onNote(idx, midi), delay);
    }
  });

  // Call onComplete after last note finishes
  if (onComplete) {
    const totalDuration = midiNumbers.length * intervalSec * 1000;
    setTimeout(onComplete, totalDuration);
  }
}

/**
 * Check if flute is loaded
 * @returns {boolean}
 */
export function isFluteLoaded() {
  return isLoaded;
}

/**
 * Get sampler instance (for advanced usage)
 * @returns {Tone.Sampler|null}
 */
export function getSampler() {
  return sampler;
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
 * Setup automatic flute preload after first user interaction
 * Attaches one-time listener that triggers preload 300ms after first click/touch
 *
 * @param {Object} options - Same options as preloadFlute
 */
export function setupFlutePreload(options = {}) {
  if (typeof document === 'undefined') return;

  // Already loaded or preload setup
  if (isLoaded || preloadInitiated) return;

  const triggerPreload = async () => {
    // Import tone-loader to ensure Tone.js is loaded first
    const { ensureToneLoaded } = await import('./tone-loader.js');

    // Ensure Tone.js is loaded before preloading flute
    await ensureToneLoaded();

    // Preload flute in background
    preloadFlute(options);
  };

  // Listen for first interaction
  const events = ['click', 'touchstart', 'keydown'];
  const handler = () => {
    events.forEach(e => document.removeEventListener(e, handler, { capture: true }));
    triggerPreload();
  };

  events.forEach(e => document.addEventListener(e, handler, { capture: true, once: true }));
}

/**
 * Check if flute preload has been initiated
 * @returns {boolean}
 */
export function isFlutePreloading() {
  return preloadInitiated && !isLoaded;
}
