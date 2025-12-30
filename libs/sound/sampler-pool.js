/**
 * sampler-pool.js - Low-latency sample playback using native Web Audio API
 *
 * Provides sample-accurate timing by bypassing Tone.js abstractions.
 * Extracts AudioBuffers from Tone.Sampler and uses direct BufferSource playback.
 *
 * Latency comparison:
 * - Tone.Sampler.triggerAttackRelease(): ~20-50ms
 * - SamplerPool.playNote(): ~1-3ms (same as metronome samples)
 */

// Pool configuration
const DEFAULT_POOL_SIZE = 16; // Max simultaneous notes per pitch class
const ADSR_DEFAULTS = {
  attack: 0.005,   // 5ms attack (instant, but smooth to avoid clicks)
  decay: 0.1,      // 100ms decay
  sustain: 0.8,    // 80% sustain level
  release: 0.3     // 300ms release
};

/**
 * Create a low-latency sampler pool from a Tone.Sampler
 *
 * @param {Object} config
 * @param {Tone.Sampler} config.sampler - Loaded Tone.Sampler instance
 * @param {AudioContext} config.context - Web Audio AudioContext
 * @param {AudioNode} config.destination - Output node (e.g., GainNode for mixer channel)
 * @param {Object} config.adsr - ADSR envelope settings (optional)
 * @param {number} config.poolSize - Max voices per note (optional, default 16)
 * @returns {Object} Pool API
 */
export function createSamplerPool(config) {
  const {
    sampler,
    context,
    destination,
    adsr = ADSR_DEFAULTS,
    poolSize = DEFAULT_POOL_SIZE
  } = config;

  if (!sampler || !context || !destination) {
    throw new Error('SamplerPool requires sampler, context, and destination');
  }

  // Extract buffers from Tone.Sampler
  // Tone.Sampler stores buffers in _buffers (ToneAudioBuffers) which has a _buffers Map
  const bufferMap = new Map();
  const sampleNotes = []; // Available sample notes (e.g., C4, F#4)

  /**
   * Extract AudioBuffers from Tone.Sampler internals
   */
  function extractBuffers() {
    bufferMap.clear();
    sampleNotes.length = 0;

    // Tone.Sampler._buffers is a ToneAudioBuffers instance
    // ToneAudioBuffers._buffers is a Map<string, ToneAudioBuffer>
    // ToneAudioBuffer.get() returns the raw AudioBuffer
    const toneBuffers = sampler._buffers;
    if (!toneBuffers || !toneBuffers._buffers) {
      console.warn('SamplerPool: Cannot access Tone.Sampler buffers');
      return false;
    }

    const internalMap = toneBuffers._buffers;
    if (!(internalMap instanceof Map)) {
      console.warn('SamplerPool: Unexpected buffer structure');
      return false;
    }

    for (const [key, toneBuffer] of internalMap) {
      // ToneAudioBuffer.get() returns the raw AudioBuffer
      const audioBuffer = toneBuffer.get ? toneBuffer.get() : toneBuffer;
      // Use duck-typing instead of instanceof for test compatibility
      // AudioBuffer has: numberOfChannels, length, sampleRate, duration
      if (audioBuffer && typeof audioBuffer.length === 'number' && typeof audioBuffer.sampleRate === 'number') {
        // Tone.Sampler stores buffers with MIDI numbers as keys (numbers or numeric strings)
        // Convert to note name for our internal storage
        let midiNum;
        if (typeof key === 'number') {
          midiNum = key;
        } else if (!isNaN(parseInt(key))) {
          // Numeric string (e.g., "60")
          midiNum = parseInt(key);
        } else {
          // Note name string (e.g., "C4") - convert to MIDI
          midiNum = noteNameToMidi(key);
        }

        const noteName = midiToNoteName(midiNum);
        bufferMap.set(noteName, audioBuffer);
        sampleNotes.push(noteName);
      }
    }

    console.log(`SamplerPool: Extracted ${bufferMap.size} buffers from keys:`, [...internalMap.keys()].slice(0, 5), '...');
    return bufferMap.size > 0;
  }

  // Voice pool: Map<noteName, Array<{source, gainNode, endTime}>>
  const voicePool = new Map();

  // Active voices for cleanup
  const activeVoices = new Set();

  /**
   * Convert MIDI number to note name (e.g., 60 -> "C4")
   */
  function midiToNoteName(midi) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    const noteIndex = midi % 12;
    return noteNames[noteIndex] + octave;
  }

  /**
   * Find the closest available sample for a MIDI note
   * Returns { noteName, buffer, detuneCents }
   */
  function findClosestSample(midi) {
    const targetNote = midiToNoteName(midi);

    // Exact match
    if (bufferMap.has(targetNote)) {
      return { noteName: targetNote, buffer: bufferMap.get(targetNote), detuneCents: 0 };
    }

    // Find closest sample
    let closestNote = null;
    let closestDistance = Infinity;

    for (const sampleNote of sampleNotes) {
      const sampleMidi = noteNameToMidi(sampleNote);
      const distance = Math.abs(midi - sampleMidi);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestNote = sampleNote;
      }
    }

    if (!closestNote) return null;

    // Calculate detune in cents (100 cents = 1 semitone)
    const sampleMidi = noteNameToMidi(closestNote);
    const detuneCents = (midi - sampleMidi) * 100;

    return {
      noteName: closestNote,
      buffer: bufferMap.get(closestNote),
      detuneCents
    };
  }

  /**
   * Convert note name to MIDI number (e.g., "C4" -> 60)
   */
  function noteNameToMidi(noteName) {
    const match = noteName.match(/^([A-G]#?)(\d+)$/);
    if (!match) return 60; // Default to C4

    const [, note, octave] = match;
    const noteMap = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };
    return (parseInt(octave) + 1) * 12 + (noteMap[note] || 0);
  }

  /**
   * Apply ADSR envelope to a GainNode
   */
  function applyEnvelope(gainNode, when, duration, velocity = 1) {
    const now = context.currentTime;
    const startTime = Math.max(when, now);
    const { attack, decay, sustain, release } = adsr;

    // Start at 0
    gainNode.gain.setValueAtTime(0, startTime);

    // Attack: ramp to velocity
    gainNode.gain.linearRampToValueAtTime(velocity, startTime + attack);

    // Decay: ramp to sustain level
    gainNode.gain.linearRampToValueAtTime(velocity * sustain, startTime + attack + decay);

    // Hold sustain until release
    const releaseStart = startTime + duration;
    gainNode.gain.setValueAtTime(velocity * sustain, releaseStart);

    // Release: ramp to 0
    gainNode.gain.linearRampToValueAtTime(0, releaseStart + release);

    return releaseStart + release; // Return end time
  }

  /**
   * Play a note with sample-accurate timing
   *
   * @param {number} midi - MIDI note number (0-127)
   * @param {number} duration - Note duration in seconds
   * @param {number} when - AudioContext time to start
   * @param {number} velocity - Note velocity 0-1 (default 0.8)
   * @returns {Object|null} Voice object or null if failed
   */
  function playNote(midi, duration, when, velocity = 0.8) {
    const sample = findClosestSample(midi);
    if (!sample || !sample.buffer) {
      console.warn(`SamplerPool: No sample found for MIDI ${midi}`);
      return null;
    }

    // Debug logging (remove in production)
    // console.log(`SamplerPool.playNote: MIDI ${midi} -> sample "${sample.noteName}" detune ${sample.detuneCents}cents`);

    const now = context.currentTime;
    const startTime = Math.max(when, now);

    // Create BufferSource
    const source = context.createBufferSource();
    source.buffer = sample.buffer;

    // Apply detuning if needed (for notes between samples)
    if (sample.detuneCents !== 0) {
      source.detune.value = sample.detuneCents;
    }

    // Create envelope GainNode
    const envelopeGain = context.createGain();

    // Connect: source -> envelope -> destination
    source.connect(envelopeGain);
    envelopeGain.connect(destination);

    // Apply ADSR envelope
    const endTime = applyEnvelope(envelopeGain, startTime, duration, velocity);

    // Start playback
    source.start(startTime);

    // Schedule stop after envelope completes
    source.stop(endTime + 0.01); // Small buffer to ensure envelope completes

    // Create voice object
    const voice = {
      source,
      envelopeGain,
      midi,
      startTime,
      endTime,
      active: true
    };

    activeVoices.add(voice);

    // Cleanup when done
    source.onended = () => {
      voice.active = false;
      activeVoices.delete(voice);
      try {
        source.disconnect();
        envelopeGain.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
    };

    return voice;
  }

  /**
   * Stop all active voices immediately
   */
  function stopAll() {
    const now = context.currentTime;
    const quickRelease = 0.05; // 50ms quick release to avoid clicks

    for (const voice of activeVoices) {
      if (voice.active) {
        try {
          // Quick fade out
          voice.envelopeGain.gain.cancelScheduledValues(now);
          voice.envelopeGain.gain.setValueAtTime(voice.envelopeGain.gain.value, now);
          voice.envelopeGain.gain.linearRampToValueAtTime(0, now + quickRelease);

          // Stop source after fade
          voice.source.stop(now + quickRelease + 0.01);
        } catch (e) {
          // Source may have already stopped
        }
      }
    }
  }

  /**
   * Release a specific voice (like releasing a key)
   */
  function releaseVoice(voice) {
    if (!voice || !voice.active) return;

    const now = context.currentTime;
    const { release } = adsr;

    try {
      // Cancel scheduled gains and apply release
      voice.envelopeGain.gain.cancelScheduledValues(now);
      voice.envelopeGain.gain.setValueAtTime(voice.envelopeGain.gain.value, now);
      voice.envelopeGain.gain.linearRampToValueAtTime(0, now + release);

      // Stop source after release
      voice.source.stop(now + release + 0.01);
    } catch (e) {
      // Voice may have already stopped
    }
  }

  /**
   * Get pool statistics
   */
  function getStats() {
    return {
      bufferCount: bufferMap.size,
      sampleNotes: [...sampleNotes],
      activeVoices: activeVoices.size
    };
  }

  /**
   * Check if pool is ready
   */
  function isReady() {
    return bufferMap.size > 0;
  }

  /**
   * Initialize pool by extracting buffers
   * Call this after Tone.loaded() completes
   */
  function init() {
    return extractBuffers();
  }

  // Public API
  return {
    init,
    isReady,
    playNote,
    stopAll,
    releaseVoice,
    getStats,

    // Expose for debugging
    _bufferMap: bufferMap,
    _activeVoices: activeVoices
  };
}

/**
 * Default ADSR presets for different instruments
 */
export const ADSR_PRESETS = {
  piano: {
    attack: 0.002,
    decay: 0.1,
    sustain: 0.7,
    release: 0.4
  },
  violin: {
    attack: 0.05,
    decay: 0.1,
    sustain: 0.9,
    release: 0.2
  },
  flute: {
    attack: 0.08,    // Slower attack than violin - breath onset
    decay: 0.05,     // Quick decay to sustain
    sustain: 0.85,   // High sustain - sustained breath
    release: 0.25    // Moderate release - breath tail
  },
  pluck: {
    attack: 0.001,
    decay: 0.2,
    sustain: 0.3,
    release: 0.1
  },
  pad: {
    attack: 0.3,
    decay: 0.2,
    sustain: 0.8,
    release: 0.5
  }
};

export default createSamplerPool;
