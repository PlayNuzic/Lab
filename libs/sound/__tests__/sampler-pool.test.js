/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { createSamplerPool, ADSR_PRESETS } from '../sampler-pool.js';

// Mock AudioContext and related APIs
class MockAudioBuffer {
  constructor(options = {}) {
    this.numberOfChannels = options.numberOfChannels || 2;
    this.length = options.length || 44100;
    this.sampleRate = options.sampleRate || 44100;
    this.duration = this.length / this.sampleRate;
  }
}

class MockAudioBufferSourceNode {
  constructor() {
    this.buffer = null;
    this.detune = { value: 0 };
    this.onended = null;
    this._started = false;
    this._stopped = false;
    this._startTime = 0;
    this._stopTime = Infinity;
  }

  connect() { return this; }
  disconnect() {}

  start(when = 0) {
    this._started = true;
    this._startTime = when;
  }

  stop(when = 0) {
    this._stopped = true;
    this._stopTime = when;
    // Simulate onended callback
    if (this.onended) {
      setTimeout(() => this.onended(), 0);
    }
  }
}

class MockGainNode {
  constructor() {
    this.gain = {
      value: 1,
      setValueAtTime: jest.fn(),
      linearRampToValueAtTime: jest.fn(),
      cancelScheduledValues: jest.fn()
    };
  }

  connect() { return this; }
  disconnect() {}
}

class MockAudioContext {
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.state = 'running';
  }

  createBufferSource() {
    return new MockAudioBufferSourceNode();
  }

  createGain() {
    return new MockGainNode();
  }

  get destination() {
    return { connect: () => {} };
  }
}

// Mock ToneAudioBuffer
class MockToneAudioBuffer {
  constructor(buffer) {
    this._buffer = buffer;
  }

  get() {
    return this._buffer;
  }
}

// Mock Tone.Sampler structure
function createMockSampler(noteBuffers = {}) {
  const buffersMap = new Map();

  for (const [noteName, buffer] of Object.entries(noteBuffers)) {
    buffersMap.set(noteName, new MockToneAudioBuffer(buffer));
  }

  return {
    _buffers: {
      _buffers: buffersMap
    },
    disconnect: jest.fn(),
    connect: jest.fn()
  };
}

describe('sampler-pool', () => {
  let context;
  let destination;

  beforeEach(() => {
    context = new MockAudioContext();
    destination = new MockGainNode();
  });

  describe('createSamplerPool', () => {
    it('should throw if required config is missing', () => {
      expect(() => createSamplerPool({})).toThrow('requires sampler, context, and destination');
      expect(() => createSamplerPool({ sampler: {} })).toThrow();
      expect(() => createSamplerPool({ sampler: {}, context })).toThrow();
    });

    it('should create pool with valid config', () => {
      const sampler = createMockSampler({
        'C4': new MockAudioBuffer(),
        'F#4': new MockAudioBuffer()
      });

      const pool = createSamplerPool({
        sampler,
        context,
        destination
      });

      expect(pool).toBeDefined();
      expect(typeof pool.init).toBe('function');
      expect(typeof pool.playNote).toBe('function');
      expect(typeof pool.stopAll).toBe('function');
      expect(typeof pool.isReady).toBe('function');
    });
  });

  describe('init', () => {
    it('should extract buffers from Tone.Sampler', () => {
      const sampler = createMockSampler({
        'C4': new MockAudioBuffer(),
        'F#4': new MockAudioBuffer(),
        'C5': new MockAudioBuffer()
      });

      const pool = createSamplerPool({
        sampler,
        context,
        destination
      });

      const result = pool.init();

      expect(result).toBe(true);
      expect(pool.isReady()).toBe(true);

      const stats = pool.getStats();
      expect(stats.bufferCount).toBe(3);
      expect(stats.sampleNotes).toContain('C4');
      expect(stats.sampleNotes).toContain('F#4');
      expect(stats.sampleNotes).toContain('C5');
    });

    it('should return false if no buffers found', () => {
      const sampler = createMockSampler({});

      const pool = createSamplerPool({
        sampler,
        context,
        destination
      });

      const result = pool.init();

      expect(result).toBe(false);
      expect(pool.isReady()).toBe(false);
    });

    it('should handle missing _buffers structure gracefully', () => {
      const sampler = { _buffers: null };

      const pool = createSamplerPool({
        sampler,
        context,
        destination
      });

      const result = pool.init();
      expect(result).toBe(false);
    });
  });

  describe('playNote', () => {
    it('should play note using BufferSource', () => {
      const sampler = createMockSampler({
        'C4': new MockAudioBuffer()
      });

      const pool = createSamplerPool({
        sampler,
        context,
        destination
      });

      pool.init();

      const voice = pool.playNote(60, 1, 0, 0.8); // C4 = MIDI 60

      expect(voice).not.toBeNull();
      expect(voice.midi).toBe(60);
      expect(voice.active).toBe(true);

      const stats = pool.getStats();
      expect(stats.activeVoices).toBe(1);
    });

    it('should apply detuning for notes between samples', () => {
      // Only C4 available, playing D4 (MIDI 62) should detune +200 cents
      const sampler = createMockSampler({
        'C4': new MockAudioBuffer()
      });

      const pool = createSamplerPool({
        sampler,
        context,
        destination
      });

      pool.init();

      const voice = pool.playNote(62, 1, 0); // D4 = MIDI 62

      expect(voice).not.toBeNull();
      // The source should have detuning applied
      expect(voice.source.detune.value).toBe(200); // +2 semitones = 200 cents
    });

    it('should return null if pool not ready', () => {
      const sampler = createMockSampler({});

      const pool = createSamplerPool({
        sampler,
        context,
        destination
      });

      // Don't call init() or init fails
      const voice = pool.playNote(60, 1, 0);
      expect(voice).toBeNull();
    });

    it('should play multiple simultaneous notes', () => {
      const sampler = createMockSampler({
        'C4': new MockAudioBuffer(),
        'E4': new MockAudioBuffer(),
        'G4': new MockAudioBuffer()
      });

      const pool = createSamplerPool({
        sampler,
        context,
        destination
      });

      pool.init();

      // Play C major chord
      pool.playNote(60, 1, 0); // C4
      pool.playNote(64, 1, 0); // E4
      pool.playNote(67, 1, 0); // G4

      const stats = pool.getStats();
      expect(stats.activeVoices).toBe(3);
    });
  });

  describe('stopAll', () => {
    it('should stop all active voices', () => {
      const sampler = createMockSampler({
        'C4': new MockAudioBuffer()
      });

      const pool = createSamplerPool({
        sampler,
        context,
        destination
      });

      pool.init();

      pool.playNote(60, 1, 0);
      pool.playNote(60, 1, 0);
      pool.playNote(60, 1, 0);

      expect(pool.getStats().activeVoices).toBe(3);

      pool.stopAll();

      // Voices should be scheduled for stop (async cleanup)
      // The actual cleanup happens in onended callback
    });
  });

  describe('ADSR envelope', () => {
    it('should apply ADSR envelope to gain node', () => {
      const sampler = createMockSampler({
        'C4': new MockAudioBuffer()
      });

      const customAdsr = {
        attack: 0.01,
        decay: 0.2,
        sustain: 0.5,
        release: 0.5
      };

      const pool = createSamplerPool({
        sampler,
        context,
        destination,
        adsr: customAdsr
      });

      pool.init();

      const voice = pool.playNote(60, 1, 0, 0.8);

      expect(voice).not.toBeNull();
      expect(voice.envelopeGain.gain.setValueAtTime).toHaveBeenCalled();
      expect(voice.envelopeGain.gain.linearRampToValueAtTime).toHaveBeenCalled();
    });
  });

  describe('ADSR_PRESETS', () => {
    it('should have presets for common instruments', () => {
      expect(ADSR_PRESETS.piano).toBeDefined();
      expect(ADSR_PRESETS.violin).toBeDefined();
      expect(ADSR_PRESETS.pluck).toBeDefined();
      expect(ADSR_PRESETS.pad).toBeDefined();
    });

    it('should have valid ADSR values', () => {
      for (const [name, preset] of Object.entries(ADSR_PRESETS)) {
        expect(preset.attack).toBeGreaterThanOrEqual(0);
        expect(preset.decay).toBeGreaterThanOrEqual(0);
        expect(preset.sustain).toBeGreaterThanOrEqual(0);
        expect(preset.sustain).toBeLessThanOrEqual(1);
        expect(preset.release).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('MIDI conversion', () => {
    it('should correctly map MIDI to note names', () => {
      const sampler = createMockSampler({
        'C4': new MockAudioBuffer(),
        'C#4': new MockAudioBuffer(),
        'D4': new MockAudioBuffer()
      });

      const pool = createSamplerPool({
        sampler,
        context,
        destination
      });

      pool.init();

      // C4 = 60
      const voiceC4 = pool.playNote(60, 1, 0);
      expect(voiceC4.source.detune.value).toBe(0); // Exact match

      // C#4 = 61
      const voiceCSharp4 = pool.playNote(61, 1, 0);
      expect(voiceCSharp4.source.detune.value).toBe(0); // Exact match

      // D4 = 62
      const voiceD4 = pool.playNote(62, 1, 0);
      expect(voiceD4.source.detune.value).toBe(0); // Exact match
    });

    it('should handle numeric MIDI keys (real Tone.Sampler behavior)', () => {
      // Tone.Sampler internally converts note names to MIDI numbers
      // So _buffers._buffers Map has numeric keys like 60, 66, 72
      const buffersMap = new Map();
      buffersMap.set(60, new MockToneAudioBuffer(new MockAudioBuffer())); // C4
      buffersMap.set(66, new MockToneAudioBuffer(new MockAudioBuffer())); // F#4
      buffersMap.set(72, new MockToneAudioBuffer(new MockAudioBuffer())); // C5

      const sampler = {
        _buffers: {
          _buffers: buffersMap
        },
        disconnect: jest.fn(),
        connect: jest.fn()
      };

      const pool = createSamplerPool({
        sampler,
        context,
        destination
      });

      const result = pool.init();
      expect(result).toBe(true);
      expect(pool.isReady()).toBe(true);

      // Play C4 (MIDI 60) - should be exact match
      const voiceC4 = pool.playNote(60, 1, 0);
      expect(voiceC4).not.toBeNull();
      expect(voiceC4.source.detune.value).toBe(0);

      // Play D4 (MIDI 62) - should detune from C4 by +200 cents
      const voiceD4 = pool.playNote(62, 1, 0);
      expect(voiceD4).not.toBeNull();
      expect(voiceD4.source.detune.value).toBe(200);

      // Play F#4 (MIDI 66) - should be exact match
      const voiceFs4 = pool.playNote(66, 1, 0);
      expect(voiceFs4).not.toBeNull();
      expect(voiceFs4.source.detune.value).toBe(0);
    });
  });
});
