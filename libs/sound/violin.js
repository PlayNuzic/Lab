// libs/sound/violin.js
// Violin instrument using Tone.js Sampler with tonejs-instruments samples

/**
 * Violin instrument manager using Tone.js Sampler
 * Loads samples from nbrosowsky/tonejs-instruments GitHub repository
 *
 * Sample source: https://github.com/nbrosowsky/tonejs-instruments
 * License: Check repository for licensing details
 */

let sampler = null;
let isLoaded = false;
let loadPromise = null;
let preloadInitiated = false;

// Base URL for tonejs-instruments samples on GitHub Pages
const BASE_URL = 'https://nbrosowsky.github.io/tonejs-instruments/samples/violin/';

// Available violin samples (A, C, E, G across octaves 3-7)
// Tone.js Sampler will interpolate missing notes
const VIOLIN_NOTES = [
  'A3', 'A4', 'A5', 'A6',
  'C4', 'C5', 'C6', 'C7',
  'E4', 'E5', 'E6',
  'G3', 'G4', 'G5', 'G6'
];

/**
 * Load violin sampler with samples from tonejs-instruments
 * @returns {Promise<Tone.Sampler>} Loaded sampler instance
 */
export async function loadViolin() {
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
    // Create URLs object mapping note names to files
    const urls = {};
    VIOLIN_NOTES.forEach(note => {
      urls[note] = `${note}.mp3`;
    });

    sampler = new Tone.Sampler({
      urls,
      release: 0.8,  // Slightly shorter release than piano for violin character
      baseUrl: BASE_URL
    }).toDestination();

    // Wait for all samples to load
    await Tone.loaded();
    isLoaded = true;

    console.log('Violin loaded successfully');
    return sampler;
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
    console.warn('Violin not loaded, loading now...');
    await loadViolin();
  }

  const Tone = window.Tone;
  const note = Tone.Frequency(midiNumber, 'midi').toNote();
  const playTime = when === 0 ? Tone.now() : Tone.now() + when;

  sampler.triggerAttackRelease(note, duration, playTime);
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
    console.log('Violin not loaded, loading...');
    await loadViolin();
  }

  const Tone = window.Tone;
  const startTime = Tone.now();

  // Schedule all notes
  midiNumbers.forEach((midi, idx) => {
    const when = startTime + (idx * intervalSec);
    const note = Tone.Frequency(midi, 'midi').toNote();

    // Duration is 90% of interval to leave small gap
    const noteDuration = intervalSec * 0.9;
    sampler.triggerAttackRelease(note, noteDuration, when);

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
 * Check if violin is loaded
 * @returns {boolean}
 */
export function isViolinLoaded() {
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
 * Preload violin samples in background after user interaction
 * This reduces perceived latency by loading samples before user clicks Play
 *
 * @param {Object} options - Preload options
 * @param {number} options.delay - Delay in ms before starting preload (default: 300)
 * @param {Function} options.onStart - Callback when preload starts
 * @param {Function} options.onComplete - Callback when preload completes
 * @param {Function} options.onError - Callback on preload error
 * @returns {Promise<void>}
 */
export async function preloadViolin(options = {}) {
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
    await loadViolin();
    onComplete?.();
  } catch (err) {
    preloadInitiated = false; // Allow retry
    onError?.(err);
    console.warn('Violin preload failed:', err);
  }
}

/**
 * Setup automatic violin preload after first user interaction
 * Attaches one-time listener that triggers preload 300ms after first click/touch
 *
 * @param {Object} options - Same options as preloadViolin
 */
export function setupViolinPreload(options = {}) {
  if (typeof document === 'undefined') return;

  // Already loaded or preload setup
  if (isLoaded || preloadInitiated) return;

  const triggerPreload = async () => {
    // Import tone-loader to ensure Tone.js is loaded first
    const { ensureToneLoaded } = await import('./tone-loader.js');

    // Ensure Tone.js is loaded before preloading violin
    await ensureToneLoaded();

    // Preload violin in background
    preloadViolin(options);
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
 * Check if violin preload has been initiated
 * @returns {boolean}
 */
export function isViolinPreloading() {
  return preloadInitiated && !isLoaded;
}
