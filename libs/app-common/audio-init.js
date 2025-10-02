/**
 * Standardized audio initialization pattern
 * Based on App4's successful approach that avoids AudioContext warnings
 */

import { TimelineAudio, waitForUserInteraction } from '../sound/index.js';
import { ensureToneLoaded } from '../sound/tone-loader.js';

/**
 * Create a standardized audio initialization function that follows App4's pattern
 * @param {Object} config - Configuration options
 * @param {Function} config.getSoundSelects - Function that returns sound select elements
 * @param {Function} config.schedulingBridge - Optional scheduling bridge to apply
 * @param {string[]} config.channels - Optional channels to register
 * @returns {Function} initAudio function
 */
export function createAudioInitializer(config = {}) {
  let audio = null;
  let audioInitPromise = null;

  async function initAudio() {
    if (audio) {
      await audio.ready();
      // Always update sounds from dropdowns to reflect any changes made while audio was initialized
      if (config.getSoundSelects) {
        const selects = config.getSoundSelects();
        if (selects.baseSoundSelect?.dataset?.value) {
          audio.setBase(selects.baseSoundSelect.dataset.value);
        }
        if (selects.accentSoundSelect?.dataset?.value) {
          audio.setAccent(selects.accentSoundSelect.dataset.value);
        }
        if (selects.startSoundSelect?.dataset?.value) {
          audio.setStart(selects.startSoundSelect.dataset.value);
        }
        if (selects.cycleSoundSelect?.dataset?.value) {
          audio.setCycle(selects.cycleSoundSelect.dataset.value);
        }
      }
      return audio;
    }

    if (!audioInitPromise) {
      audioInitPromise = (async () => {
        // Load Tone.js first (waits for user interaction internally)
        await ensureToneLoaded();

        // Wait for user interaction before creating AudioContext to avoid browser warnings
        await waitForUserInteraction();

        const instance = new TimelineAudio();

        // Apply sound selections BEFORE ready() to prevent _initPlayers() from loading defaults
        // This sets _soundAssignments before buffers are loaded
        if (config.getSoundSelects) {
          const selects = config.getSoundSelects();
          if (selects.baseSoundSelect?.dataset?.value) {
            instance._soundAssignments.pulso = selects.baseSoundSelect.dataset.value;
            instance._soundAssignments.pulso0 = selects.baseSoundSelect.dataset.value;
          }
          if (selects.accentSoundSelect?.dataset?.value) {
            instance._soundAssignments.seleccionados = selects.accentSoundSelect.dataset.value;
          }
          if (selects.startSoundSelect?.dataset?.value) {
            instance._soundAssignments.start = selects.startSoundSelect.dataset.value;
          }
          if (selects.cycleSoundSelect?.dataset?.value) {
            instance._soundAssignments.cycle = selects.cycleSoundSelect.dataset.value;
          }
        }

        await instance.ready();

        // Register channels if specified
        if (config.channels && instance.mixer && typeof instance.mixer.registerChannel === 'function') {
          config.channels.forEach(channel => {
            instance.mixer.registerChannel(channel.id, channel.options || {});
          });
        }

        // Set up channel assignments
        if (config.channels && instance._channelAssignments) {
          config.channels.forEach(channel => {
            if (channel.assignment) {
              instance._channelAssignments[channel.assignment] = channel.id;
            }
          });
        }

        // Apply scheduling bridge if provided
        if (config.schedulingBridge && typeof config.schedulingBridge.applyTo === 'function') {
          config.schedulingBridge.applyTo(instance);
        }

        return instance;
      })();

      audio = await audioInitPromise;
      audioInitPromise = null;
    }

    return audio;
  }

  return initAudio;
}

/**
 * Standard configuration for rhythm apps with accent channel
 */
export const RHYTHM_APP_AUDIO_CONFIG = {
  channels: [
    {
      id: 'accent',
      options: { allowSolo: true, label: 'Seleccionado' },
      assignment: 'accent'
    }
  ]
};

/**
 * Create audio initializer with standard rhythm app configuration
 * @param {Object} config - Additional configuration
 * @returns {Function} initAudio function
 */
export function createRhythmAudioInitializer(config = {}) {
  return createAudioInitializer({
    ...RHYTHM_APP_AUDIO_CONFIG,
    ...config
  });
}