/**
 * MelodicTimelineAudio - Extends TimelineAudio with melodic instrument support
 *
 * Adds a new audio category "Instruments" to the repository's audio engine.
 * Integrates sampler-based instruments (piano, synth, etc.) with:
 * - Mixer volume controls
 * - Performance submenu settings (sample rate, schedule horizon)
 * - Master volume
 * - Play/Stop coordination
 */

import TimelineAudio from './index.js';
import { loadPiano, resetPiano } from './piano.js';
import { loadViolin, resetViolin } from './violin.js';
import { ensureToneLoaded } from './tone-loader.js';

export class MelodicTimelineAudio extends TimelineAudio {
  constructor() {
    super();

    this._instrumentSampler = null;
    this._currentInstrument = null;

    // Register "instrument" channel in mixer
    this.mixer.registerChannel('instrument', {
      allowSolo: true,
      label: 'Instrumento'
    });

    console.log('MelodicTimelineAudio initialized with instrument channel');
  }

  /**
   * Load and set an instrument sampler
   * @param {string} key - Instrument key (e.g., 'piano', 'synth', 'guitar')
   * @returns {Promise<void>}
   */
  async setInstrument(key) {
    // Ensure TimelineAudio is ready (loads AudioContext)
    await this.ready();

    // CRITICAL: Explicitly load Tone.js before using piano
    await ensureToneLoaded();

    console.log(`Loading instrument: ${key}`);

    // Verify Tone.js is available
    if (typeof window.Tone === 'undefined') {
      console.error('Tone.js not loaded after ensureToneLoaded()');
      return;
    }

    // CRITICAL: Make Tone.js use the same AudioContext as TimelineAudio
    // This prevents InvalidAccessError when connecting Tone.js nodes to our GainNodes
    const Tone = window.Tone;
    if (this._ctx && Tone.getContext().rawContext !== this._ctx) {
      console.log('Setting Tone.js to use TimelineAudio AudioContext');
      Tone.setContext(this._ctx);

      // Reset existing samplers - they were created with the old context
      // This forces them to be recreated with the new context on next load
      resetPiano();
      resetViolin();
    }

    // Disconnect previous sampler if exists (prevents overlapping sounds)
    // Note: We don't dispose singletons, just disconnect them
    if (this._instrumentSampler && this._currentInstrument !== key) {
      try {
        this._instrumentSampler.disconnect();
        console.log(`Disconnected previous instrument: ${this._currentInstrument}`);
      } catch (e) {
        // Ignore disconnect errors
      }
    }

    // Load new instrument sampler
    // Note: piano.js and violin.js now connect to melodicChannel automatically
    // which routes through the master effects chain (EQ → Compressor → Limiter)
    let sampler;
    try {
      switch (key) {
        case 'violin':
          sampler = await loadViolin();
          break;
        case 'piano':
        default:
          sampler = await loadPiano();
          break;
      }
    } catch (error) {
      console.error(`Failed to load instrument ${key}:`, error);
      return;
    }

    // Ensure sampler is connected to melodic channel
    // This is needed because we disconnect the previous sampler above
    // and the singleton sampler might have been disconnected from a previous switch
    const melodicChannel = window.NuzicAudioEngine?.getMelodicChannel?.();
    if (melodicChannel && sampler) {
      try {
        // Disconnect first to avoid double connections
        sampler.disconnect();
        sampler.connect(melodicChannel);
        console.log(`${key} connected to melodic channel`);
      } catch (e) {
        // If connection fails, try toDestination as fallback
        try {
          sampler.toDestination();
          console.log(`${key} connected to destination (fallback)`);
        } catch (e2) {
          console.warn(`Failed to connect ${key}:`, e2.message);
        }
      }
    }

    this._instrumentSampler = sampler;
    this._currentInstrument = key;

    console.log(`Instrument ${key} loaded and set as current (sampler:`, !!sampler, ')');
  }

  /**
   * Play a note using the current instrument
   * @param {number} midi - MIDI note number (0-127)
   * @param {number} duration - Note duration in seconds
   * @param {number} when - When to play (Tone.now() + offset)
   */
  playNote(midi, duration, when) {
    if (!this._instrumentSampler) {
      console.warn('No instrument loaded, cannot play note');
      return;
    }

    if (typeof window.Tone === 'undefined') {
      console.error('Tone.js not available');
      return;
    }

    const Tone = window.Tone;
    const note = Tone.Frequency(midi, 'midi').toNote();

    this._instrumentSampler.triggerAttackRelease(note, duration, when);
  }

  /**
   * Play multiple notes simultaneously (chord)
   * @param {number[]} midiNotes - Array of MIDI note numbers
   * @param {number} duration - Note duration in seconds
   * @param {number} when - When to play
   */
  playChord(midiNotes, duration, when) {
    if (!this._instrumentSampler) {
      console.warn('No instrument loaded, cannot play chord');
      return;
    }

    if (typeof window.Tone === 'undefined') {
      console.error('Tone.js not available');
      return;
    }

    const Tone = window.Tone;
    const notes = midiNotes.map(midi => Tone.Frequency(midi, 'midi').toNote());

    this._instrumentSampler.triggerAttackRelease(notes, duration, when);
  }

  /**
   * Stop playback - extends parent stop() to also release instrument notes
   */
  stop() {
    super.stop();

    if (this._instrumentSampler && typeof this._instrumentSampler.releaseAll === 'function') {
      this._instrumentSampler.releaseAll();
    }
  }

  /**
   * Get current instrument key
   * @returns {string|null}
   */
  getCurrentInstrument() {
    return this._currentInstrument;
  }

  /**
   * Check if instrument is loaded and ready
   * @returns {boolean}
   */
  hasInstrument() {
    return this._instrumentSampler !== null;
  }
}

export default MelodicTimelineAudio;
