/**
 * Standardized audio initialization pattern
 * Based on App4's successful approach that avoids AudioContext warnings
 */

import { TimelineAudio, waitForUserInteraction } from '../sound/index.js';
import { ensureToneLoaded } from '../sound/tone-loader.js';
import { ensurePreferredSampleRateContext } from '../sound/audio-context-helper.js';

// Gamification hooks - optional integration
let gamificationHooks = null;

/**
 * Set gamification hooks for audio events
 * @param {Object} hooks - Object with event handler functions
 */
export function setGamificationHooks(hooks) {
  gamificationHooks = hooks;
}

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

        // Pin sampleRate=44100 abans que Tone.js creï el seu context
        // (eliminem el resampling silenciós a Firefox/Linux 48kHz)
        ensurePreferredSampleRateContext();

        const instance = new TimelineAudio();

        // Apply sound selections BEFORE ready() to prevent _initPlayers() from loading defaults
        // This sets _soundAssignments before buffers are loaded
        if (config.getSoundSelects) {
          const selects = config.getSoundSelects();
          if (selects.baseSoundSelect?.dataset?.value) {
            instance._soundAssignments.pulso = selects.baseSoundSelect.dataset.value;
            if (!selects.startSoundSelect?.dataset?.value) {
              instance._soundAssignments.pulso0 = selects.baseSoundSelect.dataset.value;
            }
          }
          if (selects.accentSoundSelect?.dataset?.value) {
            instance._soundAssignments.seleccionados = selects.accentSoundSelect.dataset.value;
          }
          if (selects.startSoundSelect?.dataset?.value) {
            const startValue = selects.startSoundSelect.dataset.value;
            instance._soundAssignments.start = startValue;
            instance._soundAssignments.pulso0 = startValue;
          }
          if (selects.cycleSoundSelect?.dataset?.value) {
            instance._soundAssignments.cycle = selects.cycleSoundSelect.dataset.value;
          }
        }

        await instance.ready();

        // Set up gamification hooks if available
        if (gamificationHooks && typeof instance.setGamificationHooks === 'function') {
          instance.setGamificationHooks(gamificationHooks);
        }

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

/**
 * Create audio initializer for melodic apps (App12, App15)
 * Uses MelodicTimelineAudio with proper Tone.js loading order
 *
 * @param {Object} config - Configuration options
 * @param {string} config.defaultInstrument - Default instrument to load ('piano')
 * @param {Function} config.getPreferences - Function to get saved preferences
 * @param {Function} config.onReady - Callback when audio is ready
 * @returns {Function} initAudio function
 */
export function createMelodicAudioInitializer(config = {}) {
  let audio = null;
  let audioInitPromise = null;

  async function initAudio() {
    if (audio) {
      return audio;
    }

    if (!audioInitPromise) {
      audioInitPromise = (async () => {
        // 1. Load Tone.js FIRST (critical for avoiding race condition)
        // ensureToneLoaded() waits for user interaction internally
        await ensureToneLoaded();

        // Pin sampleRate=44100 abans que Tone.js creï el seu context
        // (eliminem el resampling silenciós a Firefox/Linux 48kHz)
        ensurePreferredSampleRateContext();

        // 2. Start Tone.js AudioContext IMMEDIATELY after user gesture
        // This MUST happen before any other async operations to avoid InvalidAccessError
        // The user gesture from ensureToneLoaded() is still valid here
        if (typeof Tone !== 'undefined' && typeof Tone.start === 'function') {
          try {
            await Tone.start();
            console.log('Tone.js AudioContext started successfully');
          } catch (err) {
            // Log but don't fail - context might already be running
            console.warn('Tone.start() warning:', err.message);
          }
        }

        // 3. Dynamic import to avoid circular dependencies
        const { MelodicTimelineAudio } = await import('../sound/melodic-audio.js');

        // 4. Create instance AFTER Tone.js is loaded and started
        const instance = new MelodicTimelineAudio();

        // 5. Ready (Tone.js guaranteed to be available and running)
        await instance.ready();

        // 6. Load instrument
        // Priority: per-app localStorage > app prefs > config default
        // Detectar app per llegir la clau correcta
        const path = typeof window !== 'undefined' ? window.location.pathname : '';
        const appMatch = path.match(/App(\d+[A-Za-z]*)/i);
        const appId = appMatch ? appMatch[1].toLowerCase() : null;
        const perAppKey = appId ? `app${appId}:selectedInstrument` : null;

        const storedInstrument = perAppKey ? localStorage.getItem(perAppKey) : null;
        const prefs = config.getPreferences?.() || {};
        const instrument = storedInstrument || prefs.selectedInstrument || config.defaultInstrument || 'piano';
        await instance.setInstrument(instrument);

        // 7. Expose globally for Performance submenu and header
        if (typeof window !== 'undefined') {
          window.NuzicAudioEngine = instance;
          window.__labAudio = instance;
        }

        // 8. Call onReady callback if provided
        config.onReady?.(instance);

        return instance;
      })();

      audio = await audioInitPromise;
    }

    return audio;
  }

  // Expose method to get current audio instance without initializing
  initAudio.getInstance = () => audio;

  return initAudio;
}

// =============================================================================
// CONFIGURACIÓ CANÒNICA D'ÀUDIO (Fase A de la centralització)
// =============================================================================
// Valors únics de FX, canals i persistència que TOTES les apps comparteixen
// (a no ser que opt-out explícit). El motor (libs/sound/index.js) duplica
// aquests defaults al constructor; aquesta secció els documenta i ofereix
// helpers per aplicar-los/sobreescriure'ls des de qualsevol app.

/**
 * Configuració canònica de la cadena d'efectes master. Aplicats per
 * defecte al motor; les apps no els han de tocar (a menys que el cas
 * d'ús ho requereixi explícitament).
 */
export const CANONICAL_FX = Object.freeze({
  compressor: { threshold: -6, knee: 30, ratio: 2, attack: 0.02, release: 0.25 },
  limiter:    { threshold: -0.5, knee: 0, ratio: 20, attack: 0.003, release: 0.1 },
  eq:         { type: 'highshelf', frequency: 3000, gain: 1.5 },
  reverb:     { wet: 0.12 }
});

/**
 * Tiers de canals de mixer per app. `MelodicTimelineAudio` ja registra
 * automàticament tots els canals base (pulse, start, accent, subdivision,
 * instrument), així que un tier només "personalitza" els labels visibles.
 */
export const CHANNEL_TIERS = Object.freeze({
  RHYTHM_BASIC:  [{ id: 'pulse', label: 'Pulso' }],
  RHYTHM_ACCENT: [
    { id: 'pulse', label: 'Pulso' },
    { id: 'accent', label: 'Seleccionado', allowSolo: true }
  ],
  RHYTHM_SUB: [
    { id: 'pulse', label: 'Pulso' },
    { id: 'subdivision', label: 'Subdivisión' }
  ],
  RHYTHM_FULL: [
    { id: 'pulse', label: 'Pulso' },
    { id: 'subdivision', label: 'Subdivisión' },
    { id: 'accent', label: 'Seleccionado', allowSolo: true }
  ],
  MELODIC_BASIC: [
    { id: 'instrument', label: 'Instrumento', volume: 1, allowSolo: true }
  ],
  MELODIC_PULSE: [
    { id: 'pulse', label: 'Pulso' },
    { id: 'instrument', label: 'Instrumento', volume: 1, allowSolo: true }
  ],
  MELODIC_FULL: [
    { id: 'pulse', label: 'Pulso' },
    { id: 'subdivision', label: 'Subdivisión' },
    { id: 'instrument', label: 'Instrumento', volume: 1, allowSolo: true }
  ]
});

/**
 * Aplica configuració canònica a una instància d'àudio ja inicialitzada.
 * Idempotent: si crides dues vegades amb les mateixes opcions, l'estat
 * final és el mateix.
 *
 * @param {Object} audio - instància de TimelineAudio o MelodicTimelineAudio
 * @param {Object} options
 * @param {Object} [options.fx] - override de CANONICAL_FX (poc comú)
 * @param {Array} [options.channels] - llista de canals a registrar
 *                                     (de CHANNEL_TIERS o custom)
 * @param {boolean} [options.enableEffects=true] - encén la cadena FX
 * @returns {void}
 */
export function setupAudioDefaults(audio, options = {}) {
  if (!audio) return;
  const { fx = CANONICAL_FX, channels = [], enableEffects = true } = options;

  // 1. FX chain
  if (typeof audio.setEffectsEnabled === 'function') {
    audio.setEffectsEnabled(enableEffects);
  }
  if (enableEffects && fx) {
    if (typeof audio.setCompressorThreshold === 'function' && fx.compressor) {
      audio.setCompressorThreshold(fx.compressor.threshold);
    }
    if (typeof audio.setLimiterThreshold === 'function' && fx.limiter) {
      audio.setLimiterThreshold(fx.limiter.threshold);
    }
    if (typeof audio.setReverbWet === 'function' && fx.reverb && Number.isFinite(fx.reverb.wet)) {
      audio.setReverbWet(fx.reverb.wet);
    }
  }

  // 2. Canals: idempotent. `registerChannel` ja és segur per
  // doble-registre (sobreescriu metadata sense duplicar nodes).
  if (Array.isArray(channels) && channels.length && audio.mixer
      && typeof audio.mixer.registerChannel === 'function') {
    for (const ch of channels) {
      const { id, ...meta } = ch;
      if (!id) continue;
      audio.mixer.registerChannel(id, meta);
    }
  }
}

/**
 * Crea un controlador de persistència del mixer via localStorage.
 *
 * Ús típic:
 *   const persist = createMixerPersistence({ storageKey: 'app19:mixer' });
 *   persist.hydrate(audio);     // carrega volums guardats
 *   persist.subscribe(audio);   // comença a desar canvis
 *
 * Idempotent: hydrate sense estat guardat no fa res; subscribe doble
 * no duplica listeners.
 *
 * @param {Object} options
 * @param {string} options.storageKey - clau localStorage (e.g. 'app19:mixer')
 * @param {number} [options.debounceMs=120] - retard d'escriptura
 * @returns {{hydrate: (audio:Object)=>void, subscribe: (audio:Object)=>()=>void}}
 */
export function createMixerPersistence({ storageKey, debounceMs = 120 } = {}) {
  if (!storageKey) {
    return { hydrate() {}, subscribe() { return () => {}; } };
  }

  // Versió de la clau: en pujar-la descartem l'estat antic que podria
  // contenir volums per defecte obsolets (p.ex. els canals rítmics
  // melòdics a 0.1, que sobreescriurien el nou 0.6 i mantindrien el P0
  // "perdut"). v2 = canvi de defaults dels canals rítmics melòdics.
  const key = `${storageKey}:v2`;

  let writeTimer = null;
  let unsubscribe = null;

  function readState() {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeState(state) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(state));
      }
    } catch {
      // localStorage ple o sandbox: ignorem
    }
  }

  function hydrate(audio) {
    if (!audio || !audio.mixer) return;
    const state = readState();
    if (!state || typeof state !== 'object') return;
    if (Number.isFinite(state.master)) {
      audio.mixer.setMasterVolume?.(state.master);
    }
    if (state.channels && typeof state.channels === 'object') {
      for (const [id, vol] of Object.entries(state.channels)) {
        if (Number.isFinite(vol)) {
          audio.mixer.setChannelVolume?.(id, vol);
        }
      }
    }
    if (state.mutes && typeof state.mutes === 'object') {
      for (const [id, muted] of Object.entries(state.mutes)) {
        audio.mixer.setChannelMute?.(id, !!muted);
      }
    }
  }

  function subscribe(audio) {
    if (!audio || !audio.mixer || typeof audio.mixer.subscribe !== 'function') {
      return () => {};
    }
    if (unsubscribe) return unsubscribe;

    unsubscribe = audio.mixer.subscribe((snapshot) => {
      if (writeTimer) clearTimeout(writeTimer);
      writeTimer = setTimeout(() => {
        writeTimer = null;
        const payload = {
          master: snapshot?.master?.volume,
          channels: {},
          mutes: {}
        };
        if (Array.isArray(snapshot?.channels)) {
          for (const ch of snapshot.channels) {
            if (!ch || !ch.id) continue;
            if (Number.isFinite(ch.volume)) payload.channels[ch.id] = ch.volume;
            if (typeof ch.muted === 'boolean') payload.mutes[ch.id] = ch.muted;
          }
        }
        writeState(payload);
      }, debounceMs);
    });
    return unsubscribe;
  }

  return { hydrate, subscribe };
}