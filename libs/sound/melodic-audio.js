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
import { loadPiano } from './piano.js';

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
    await this.ready();

    console.log(`Loading instrument: ${key}`);

    // Disconnect previous instrument if exists
    if (this._instrumentSampler) {
      this._instrumentSampler.disconnect();
      this._instrumentSampler.dispose();
    }

    // Load new instrument sampler
    // For now, only piano is supported
    // Future: Add switch/case for different instruments
    let sampler;
    switch (key) {
      case 'piano':
      default:
        sampler = await loadPiano();
        break;
      // Future instruments:
      // case 'synth':
      //   sampler = await loadSynth();
      //   break;
      // case 'guitar':
      //   sampler = await loadGuitar();
      //   break;
    }

    // Connect sampler to mixer channel (NOT toDestination!)
    const instrumentChannel = this.mixer.getChannelNode('instrument');

    if (!instrumentChannel) {
      console.error('Instrument channel not found in mixer');
      return;
    }

    sampler.disconnect();
    sampler.connect(instrumentChannel);

    this._instrumentSampler = sampler;
    this._currentInstrument = key;

    console.log(`Instrument ${key} loaded and connected to mixer channel`);
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

    const Tone = window.Tone;
    const notes = midiNotes.map(midi => Tone.Frequency(midi, 'midi').toNote());

    this._instrumentSampler.triggerAttackRelease(notes, duration, when);
  }

  /**
   * Stop playback - extends parent stop() to also release instrument notes
   */
  stop() {
    super.stop();

    // Release all active instrument notes
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
