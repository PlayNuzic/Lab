// libs/sound/piano.js
// Piano instrument using Tone.js Sampler with Salamander piano samples

/**
 * Piano instrument manager using Tone.js Sampler
 * Loads samples from Tone.js CDN (Salamander piano)
 */

let sampler = null;
let isLoaded = false;
let loadPromise = null;

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
    // Create URLs for Salamander piano samples (C and F# for each octave)
    const urls = {};
    for (let octave = 1; octave <= 7; octave++) {
      urls[`C${octave}`] = `C${octave}.mp3`;
      urls[`F#${octave}`] = `Fs${octave}.mp3`;
    }

    sampler = new Tone.Sampler({
      urls,
      release: 1,
      baseUrl: 'https://tonejs.github.io/audio/salamander/'
    }).toDestination();

    // Wait for all samples to load
    await Tone.loaded();
    isLoaded = true;

    console.log('Piano loaded successfully');
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
    console.warn('Piano not loaded, loading now...');
    await loadPiano();
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
