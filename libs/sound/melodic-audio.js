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
import { createSamplerPool, ADSR_PRESETS } from './sampler-pool.js';

export class MelodicTimelineAudio extends TimelineAudio {
  constructor() {
    super();

    this._instrumentSampler = null;
    this._currentInstrument = null;

    // Low-latency sampler pool (bypasses Tone.js for sample-accurate timing)
    this._samplerPool = null;
    this._useLowLatencyMode = true; // Enable by default

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

    // Initialize low-latency sampler pool if enabled
    if (this._useLowLatencyMode && sampler && this._ctx) {
      try {
        const adsr = ADSR_PRESETS[key] || ADSR_PRESETS.piano;
        this._samplerPool = createSamplerPool({
          sampler,
          context: this._ctx,
          destination: melodicChannel || this._ctx.destination,
          adsr
        });

        // Extract buffers from Tone.Sampler
        if (this._samplerPool.init()) {
          console.log(`SamplerPool initialized for ${key} (low-latency mode enabled)`);
        } else {
          console.warn(`SamplerPool failed to extract buffers, falling back to Tone.js`);
          this._samplerPool = null;
        }
      } catch (poolError) {
        console.warn('SamplerPool creation failed:', poolError.message);
        this._samplerPool = null;
      }
    }

    console.log(`Instrument ${key} loaded and set as current (sampler:`, !!sampler, ', pool:', !!this._samplerPool, ')');
  }

  /**
   * Play a note using the current instrument
   * Uses low-latency SamplerPool if available, falls back to Tone.js
   *
   * @param {number} midi - MIDI note number (0-127)
   * @param {number} duration - Note duration in seconds
   * @param {number} when - When to play (AudioContext.currentTime or Tone.now())
   * @param {number} velocity - Note velocity 0-1 (default 0.8)
   */
  playNote(midi, duration, when, velocity = 0.8) {
    // Try low-latency pool first (sample-accurate timing)
    if (this._samplerPool && this._samplerPool.isReady()) {
      // Convert Tone.now() to AudioContext.currentTime if needed
      const audioTime = this._ctx ? when : when;
      this._samplerPool.playNote(midi, duration, audioTime, velocity);
      return;
    }

    // Fallback to Tone.js Sampler
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

    this._instrumentSampler.triggerAttackRelease(note, duration, when, velocity);
  }

  /**
   * Play multiple notes simultaneously (chord)
   * @param {number[]} midiNotes - Array of MIDI note numbers
   * @param {number} duration - Note duration in seconds
   * @param {number} when - When to play
   * @param {number} velocity - Note velocity 0-1 (default 0.8)
   */
  playChord(midiNotes, duration, when, velocity = 0.8) {
    // Try low-latency pool first
    if (this._samplerPool && this._samplerPool.isReady()) {
      for (const midi of midiNotes) {
        this._samplerPool.playNote(midi, duration, when, velocity);
      }
      return;
    }

    // Fallback to Tone.js Sampler
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

    this._instrumentSampler.triggerAttackRelease(notes, duration, when, velocity);
  }

  /**
   * Stop playback - extends parent stop() to also release instrument notes
   */
  stop() {
    super.stop();

    // Stop low-latency pool
    if (this._samplerPool) {
      this._samplerPool.stopAll();
    }

    // Also stop Tone.js sampler
    if (this._instrumentSampler && typeof this._instrumentSampler.releaseAll === 'function') {
      this._instrumentSampler.releaseAll();
    }
  }

  /**
   * Enable or disable low-latency mode
   * When enabled, uses native Web Audio API for sample-accurate timing
   * When disabled, uses Tone.js (more features but ~20-50ms latency)
   *
   * @param {boolean} enabled
   */
  setLowLatencyMode(enabled) {
    this._useLowLatencyMode = enabled;
    console.log(`Low-latency mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if low-latency mode is active
   * @returns {boolean}
   */
  isLowLatencyMode() {
    return this._useLowLatencyMode && this._samplerPool && this._samplerPool.isReady();
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
