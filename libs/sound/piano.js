// libs/sound/piano.js
// Piano instrument using Tone.js Sampler with Salamander piano samples

/**
 * Piano instrument manager using Tone.js Sampler
 * Loads samples from Tone.js CDN (Salamander piano)
 */

let sampler = null;
let isLoaded = false;
let loadPromise = null;
let preloadInitiated = false;

/**
 * Load piano sampler with Salamander samples from CDN
 * @returns {Promise<Tone.Sampler>} Loaded sampler instance
 */
export async function loadPiano() {
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
      // Ensure AudioContext is started (required for toDestination fallback)
      await Tone.start();

      // Create URLs for Salamander piano samples (C and F# for each octave)
      const urls = {};
      for (let octave = 1; octave <= 7; octave++) {
        urls[`C${octave}`] = `C${octave}.mp3`;
        urls[`F#${octave}`] = `Fs${octave}.mp3`;
      }

      // Create sampler
      sampler = new Tone.Sampler({
        urls,
        release: 1,
        baseUrl: 'https://tonejs.github.io/audio/salamander/'
      });

      // Connect to melodic channel (goes through master effects chain) or fallback to destination
      const melodicChannel = window.NuzicAudioEngine?.getMelodicChannel?.();
      if (melodicChannel) {
        sampler.connect(melodicChannel);
        console.log('Piano connected to melodic channel (through effects chain)');
      } else {
        sampler.toDestination();
        console.log('Piano connected directly to destination (no effects chain)');
      }

      // Wait for all samples to load
      await Tone.loaded();
      isLoaded = true;

      console.log('Piano loaded successfully');
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
    console.warn('Piano not loaded, loading now...');
    await loadPiano();
  }

  const Tone = window.Tone;
  const note = Tone.Frequency(midiNumber, 'midi').toNote();
  const playTime = when === 0 ? Tone.now() : Tone.now() + when;

  sampler.triggerAttackRelease(note, duration, playTime, 0.8);
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
    console.log('Piano not loaded, loading...');
    await loadPiano();
  }

  const Tone = window.Tone;
  const startTime = Tone.now();

  // Schedule all notes
  midiNumbers.forEach((midi, idx) => {
    const when = startTime + (idx * intervalSec);
    const note = Tone.Frequency(midi, 'midi').toNote();

    // Duration is 90% of interval to leave small gap
    const noteDuration = intervalSec * 0.9;
    sampler.triggerAttackRelease(note, noteDuration, when, 0.8);

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
 * Check if piano is loaded
 * @returns {boolean}
 */
export function isPianoLoaded() {
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
 * Preload piano samples in background after user interaction
 * This reduces perceived latency by loading samples before user clicks Play
 *
 * Call this after first user interaction (e.g., in DOMContentLoaded or after first click)
 *
 * @param {Object} options - Preload options
 * @param {number} options.delay - Delay in ms before starting preload (default: 300)
 * @param {Function} options.onStart - Callback when preload starts
 * @param {Function} options.onComplete - Callback when preload completes
 * @param {Function} options.onError - Callback on preload error
 * @returns {Promise<void>}
 */
export async function preloadPiano(options = {}) {
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
    await loadPiano();
    onComplete?.();
  } catch (err) {
    preloadInitiated = false; // Allow retry
    onError?.(err);
    // Only log non-access errors (InvalidAccessError is expected during early preload)
    if (!(err instanceof DOMException && err.name === 'InvalidAccessError')) {
      console.warn('Piano preload failed:', err);
    }
  }
}

/**
 * Setup automatic piano preload after first user interaction
 * Attaches one-time listener that triggers preload 300ms after first click/touch
 *
 * @param {Object} options - Same options as preloadPiano
 */
export function setupPianoPreload(options = {}) {
  if (typeof document === 'undefined') return;

  // Already loaded or preload setup
  if (isLoaded || preloadInitiated) return;

  const triggerPreload = async () => {
    // Import tone-loader to ensure Tone.js is loaded first
    const { ensureToneLoaded } = await import('./tone-loader.js');

    // Ensure Tone.js is loaded before preloading piano
    await ensureToneLoaded();

    // Preload piano in background
    preloadPiano(options);
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
 * Check if piano preload has been initiated
 * @returns {boolean}
 */
export function isPianoPreloading() {
  return preloadInitiated && !isLoaded;
}
