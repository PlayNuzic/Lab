/**
 * @jest-environment jsdom
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import {
  createAudioInitializer,
  createRhythmAudioInitializer,
  RHYTHM_APP_AUDIO_CONFIG,
  CANONICAL_FX,
  CHANNEL_TIERS,
  setupAudioDefaults,
  createMixerPersistence
} from './audio-init.js';

describe('Audio Initialization Components', () => {

  describe('createAudioInitializer', () => {
    test('creates audio initializer function', () => {
      const initAudio = createAudioInitializer();
      expect(typeof initAudio).toBe('function');
    });

    test('accepts configuration object', () => {
      const config = {
        channels: [{ id: 'test' }],
        getSoundSelects: () => ({}),
        schedulingBridge: { applyTo: () => {} }
      };

      const initAudio = createAudioInitializer(config);
      expect(typeof initAudio).toBe('function');
    });

    test('handles empty configuration', () => {
      const initAudio = createAudioInitializer({});
      expect(typeof initAudio).toBe('function');
    });
  });

  describe('createRhythmAudioInitializer', () => {
    test('creates rhythm audio initializer with standard config', () => {
      const initAudio = createRhythmAudioInitializer();
      expect(typeof initAudio).toBe('function');
    });

    test('accepts additional configuration', () => {
      const customConfig = {
        getSoundSelects: () => ({ baseSoundSelect: null })
      };

      const initAudio = createRhythmAudioInitializer(customConfig);
      expect(typeof initAudio).toBe('function');
    });
  });

  describe('RHYTHM_APP_AUDIO_CONFIG', () => {
    test('has correct structure', () => {
      expect(RHYTHM_APP_AUDIO_CONFIG).toEqual({
        channels: [
          {
            id: 'accent',
            options: { allowSolo: true, label: 'Seleccionado' },
            assignment: 'accent'
          }
        ]
      });
    });

    test('has accent channel configuration', () => {
      expect(RHYTHM_APP_AUDIO_CONFIG.channels).toHaveLength(1);
      expect(RHYTHM_APP_AUDIO_CONFIG.channels[0].id).toBe('accent');
    });
  });

  describe('CANONICAL_FX', () => {
    test('exposes canonical FX values', () => {
      expect(CANONICAL_FX.compressor.threshold).toBe(-6);
      expect(CANONICAL_FX.limiter.threshold).toBe(-0.5);
      expect(CANONICAL_FX.eq.gain).toBe(1.5);
      expect(CANONICAL_FX.reverb.wet).toBe(0);
    });

    test('is frozen', () => {
      expect(Object.isFrozen(CANONICAL_FX)).toBe(true);
    });
  });

  describe('CHANNEL_TIERS', () => {
    test('exposes the 7 canonical tiers', () => {
      expect(Object.keys(CHANNEL_TIERS).sort()).toEqual([
        'MELODIC_BASIC', 'MELODIC_FULL', 'MELODIC_PULSE',
        'RHYTHM_ACCENT', 'RHYTHM_BASIC', 'RHYTHM_FULL', 'RHYTHM_SUB'
      ]);
    });

    test('melodic tiers include the instrument channel with volume 1', () => {
      const instr = CHANNEL_TIERS.MELODIC_PULSE.find(c => c.id === 'instrument');
      expect(instr).toBeDefined();
      expect(instr.volume).toBe(1);
    });

    test('rhythm tiers do not include instrument', () => {
      for (const tier of ['RHYTHM_BASIC', 'RHYTHM_ACCENT', 'RHYTHM_SUB', 'RHYTHM_FULL']) {
        expect(CHANNEL_TIERS[tier].some(c => c.id === 'instrument')).toBe(false);
      }
    });
  });

  describe('setupAudioDefaults', () => {
    function makeAudioStub() {
      const calls = { compThresh: [], limThresh: [], reverbWet: [], fxEnabled: [], registered: [] };
      return {
        calls,
        setEffectsEnabled(v) { calls.fxEnabled.push(v); },
        setCompressorThreshold(v) { calls.compThresh.push(v); },
        setLimiterThreshold(v) { calls.limThresh.push(v); },
        setReverbWet(v) { calls.reverbWet.push(v); },
        mixer: {
          registerChannel(id, meta) { calls.registered.push({ id, meta }); }
        }
      };
    }

    test('applies canonical FX defaults', () => {
      const audio = makeAudioStub();
      setupAudioDefaults(audio);
      expect(audio.calls.fxEnabled).toEqual([true]);
      expect(audio.calls.compThresh).toEqual([-6]);
      expect(audio.calls.limThresh).toEqual([-0.5]);
      expect(audio.calls.reverbWet).toEqual([0]);
    });

    test('registers channels from tier', () => {
      const audio = makeAudioStub();
      setupAudioDefaults(audio, { channels: CHANNEL_TIERS.MELODIC_PULSE });
      const ids = audio.calls.registered.map(c => c.id);
      expect(ids).toEqual(['pulse', 'instrument']);
      expect(audio.calls.registered[1].meta.volume).toBe(1);
    });

    test('enableEffects=false disables FX without crashing', () => {
      const audio = makeAudioStub();
      setupAudioDefaults(audio, { enableEffects: false });
      expect(audio.calls.fxEnabled).toEqual([false]);
      expect(audio.calls.compThresh).toEqual([]);
      expect(audio.calls.limThresh).toEqual([]);
    });

    test('null audio does not crash', () => {
      expect(() => setupAudioDefaults(null)).not.toThrow();
    });
  });

  describe('createMixerPersistence', () => {
    beforeEach(() => {
      if (typeof localStorage !== 'undefined') localStorage.clear();
    });

    test('returns no-op api when storageKey missing', () => {
      const p = createMixerPersistence({});
      expect(typeof p.hydrate).toBe('function');
      expect(typeof p.subscribe).toBe('function');
      // doesn't crash
      p.hydrate({ mixer: {} });
      p.subscribe({ mixer: {} });
    });

    test('hydrate restores master and channel volumes from storage', () => {
      localStorage.setItem('test:mixer', JSON.stringify({
        master: 0.5,
        channels: { pulse: 0.3, instrument: 0.9 },
        mutes: { pulse: true }
      }));
      const calls = { master: [], channels: [], mutes: [] };
      const audio = {
        mixer: {
          setMasterVolume(v) { calls.master.push(v); },
          setChannelVolume(id, v) { calls.channels.push([id, v]); },
          setChannelMute(id, m) { calls.mutes.push([id, m]); }
        }
      };
      const p = createMixerPersistence({ storageKey: 'test:mixer' });
      p.hydrate(audio);
      expect(calls.master).toEqual([0.5]);
      expect(calls.channels.sort()).toEqual([['instrument', 0.9], ['pulse', 0.3]]);
      expect(calls.mutes).toEqual([['pulse', true]]);
    });

    test('hydrate is silent on missing storage entry', () => {
      const audio = { mixer: { setMasterVolume: jest.fn(), setChannelVolume: jest.fn() } };
      const p = createMixerPersistence({ storageKey: 'test:nonexistent' });
      expect(() => p.hydrate(audio)).not.toThrow();
      expect(audio.mixer.setMasterVolume).not.toHaveBeenCalled();
    });

    test('subscribe writes snapshot to storage (debounced)', async () => {
      jest.useFakeTimers();
      let listener = null;
      const audio = {
        mixer: {
          subscribe(fn) {
            listener = fn;
            return () => { listener = null; };
          }
        }
      };
      const p = createMixerPersistence({ storageKey: 'test:write', debounceMs: 50 });
      p.subscribe(audio);
      expect(typeof listener).toBe('function');
      // Emit a snapshot
      listener({
        master: { volume: 0.4 },
        channels: [
          { id: 'pulse', volume: 0.6, muted: false },
          { id: 'instrument', volume: 1, muted: true }
        ]
      });
      jest.advanceTimersByTime(60);
      const saved = JSON.parse(localStorage.getItem('test:write'));
      expect(saved.master).toBe(0.4);
      expect(saved.channels.pulse).toBe(0.6);
      expect(saved.channels.instrument).toBe(1);
      expect(saved.mutes.instrument).toBe(true);
      jest.useRealTimers();
    });
  });
});