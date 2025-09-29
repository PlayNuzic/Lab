/**
 * @jest-environment jsdom
 */
import { describe, test, expect } from '@jest/globals';
import { createAudioInitializer, createRhythmAudioInitializer, RHYTHM_APP_AUDIO_CONFIG } from './audio-init.js';

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
});