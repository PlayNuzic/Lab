/**
 * Shell compartit de les apps de fraccions (H-14: App26-31 duien aquest
 * bloc copiat byte-a-byte, ~200 línies per app).
 *
 * Composa, en una sola crida declarativa, les peces que totes sis
 * repetien: emmagatzematge de preferències + factory reset, scheduling
 * bridge (apps rítmiques), events de so compartits (sharedui:*), toggles
 * d'àudio sincronitzats amb el mixer, menú del mixer, persistència de
 * tema/mute i la inicialització d'àudio (rhythm o melodic) amb la
 * re-aplicació d'estat (toggles, mute desat, selects de so).
 *
 * El patró d'accessors és el de la resta de factories del repo: la
 * variable `audio` segueix vivint a l'app (getAudio/setAudio); el shell
 * només la pobla al primer initAudio().
 */

import { getMixer, subscribeMixer } from '../sound/index.js';
import {
  createRhythmAudioInitializer,
  createMelodicAudioInitializer,
  setupAudioDefaults
} from './audio-init.js';
import { createSchedulingBridge, bindSharedSoundEvents } from './audio.js';
import { initAudioToggles } from './audio-toggles.js';
import { initMixerMenu } from './mixer-menu.js';
import {
  createPreferenceStorage,
  registerFactoryReset,
  setupThemeSync,
  setupMutePersistence
} from './preferences.js';

/**
 * @param {Object} config
 * @param {string} config.prefix - Prefix de localStorage (p.ex. 'app28')
 * @param {Function} config.getAudio - Accessor de la variable `audio` de l'app
 * @param {Function} config.setAudio - L'app desa la instància quan es crea
 * @param {Object} config.audio - Configuració d'inicialització:
 *   - type: 'rhythm' | 'melodic'
 *   - channelTier: CHANNEL_TIERS.* per a setupAudioDefaults
 *   - getSoundSelects: () => ({ baseSoundSelect, accentSoundSelect, startSoundSelect, cycleSoundSelect })
 *     (rhythm: el passa a l'inicialitzador; melodic: el shell aplica els
 *     dataset.value amb setBase/setAccent/setStart/setCycle al primer init)
 *   - soundEventMapping: { baseSound: 'setBase', ... } per a bindSharedSoundEvents
 *   - defaultInstrument: instrument per defecte ('piano')
 *   - schedulingBridge: bool — escolta sharedui:scheduling (apps rítmiques)
 *   - instrumentSync: bool — escolta sharedui:instrument → setInstrument (melòdiques)
 *   - exposeEngineGlobal: bool — window.NuzicAudioEngine (melòdiques)
 * @param {Array} [config.toggles] - [{ id, button, storageKey, mixerChannel, engineSetter }]
 *   engineSetter ('setPulseEnabled'|'setCycleEnabled') s'invoca al canvi i al primer init
 * @param {Object} [config.mixer] - { menu, triggers, channels } per a initMixerMenu
 * @param {Object} [config.theme] - { selectEl, muteButton } per a tema + mute persistents
 * @param {Function} [config.onFactoryReset] - Reset extra (els toggles ja es reinicien sols)
 * @returns {{ storage, load, save, clear, initAudio, getToggle, setToggle }}
 */
export function createFractionAppShell(config = {}) {
  const {
    prefix,
    separator = '::',
    getAudio,
    setAudio,
    audio: audioConfig = {},
    toggles = [],
    mixer: mixerConfig = {},
    theme = {},
    onFactoryReset = null
  } = config;

  if (!prefix) throw new Error('createFractionAppShell requires a prefix');
  if (typeof getAudio !== 'function' || typeof setAudio !== 'function') {
    throw new Error('createFractionAppShell requires getAudio/setAudio accessors');
  }

  const {
    type = 'rhythm',
    channelTier = null,
    getSoundSelects = null,
    soundEventMapping = null,
    defaultInstrument = 'piano',
    schedulingBridge: useSchedulingBridge = type === 'rhythm',
    instrumentSync = type === 'melodic',
    exposeEngineGlobal = type === 'melodic'
  } = audioConfig;

  // ---- Preferències + factory reset --------------------------------------
  const storage = createPreferenceStorage({ prefix, separator });
  const { load, save, clear } = storage;

  // ---- Scheduling bridge (sharedui:scheduling → perfils de lookahead) -----
  let schedulingBridge = null;
  if (useSchedulingBridge) {
    schedulingBridge = createSchedulingBridge({ getAudio });
    window.addEventListener('sharedui:scheduling', schedulingBridge.handleSchedulingEvent);
  }

  // ---- Events de so compartits (header dropdowns → motor) -----------------
  if (soundEventMapping) {
    bindSharedSoundEvents({ getAudio, mapping: soundEventMapping });
  }

  // ---- Sincronització d'instrument (apps melòdiques) ----------------------
  if (instrumentSync) {
    window.addEventListener('sharedui:instrument', async (e) => {
      const instance = getAudio();
      if (e.detail?.instrument && instance && typeof instance.setInstrument === 'function') {
        await instance.setInstrument(e.detail.instrument);
      }
    });
  }

  // ---- Toggles d'àudio sincronitzats amb el mixer --------------------------
  const globalMixer = getMixer();
  let toggleManager = null;
  if (toggles.length) {
    toggleManager = initAudioToggles({
      toggles: toggles.map((t) => ({
        id: t.id,
        button: t.button,
        storageKey: t.storageKey,
        mixerChannel: t.mixerChannel,
        defaultEnabled: t.defaultEnabled ?? true,
        onChange: t.engineSetter
          ? (enabled) => {
            const instance = getAudio();
            if (instance && typeof instance[t.engineSetter] === 'function') {
              instance[t.engineSetter](enabled);
            }
          }
          : undefined
      })),
      storage: { load, save },
      mixer: globalMixer,
      subscribeMixer,
      onMixerSnapshot: ({ channels, setFromMixer, getState }) => {
        if (!channels) return;
        toggles.forEach(({ id, mixerChannel }) => {
          const channelState = channels.get(mixerChannel);
          if (!channelState) return;
          const shouldEnable = !channelState.muted;
          if (getState(id) === shouldEnable) return;
          setFromMixer(id, shouldEnable);
        });
      }
    });
  }

  const getToggle = (id) => toggleManager?.get(id) ?? null;
  const setToggle = (id, value, options) => {
    getToggle(id)?.set(value, options);
  };

  registerFactoryReset({
    storage,
    onBeforeReload: () => {
      toggles.forEach(({ id }) => setToggle(id, true, { persist: false }));
      if (typeof onFactoryReset === 'function') onFactoryReset();
    }
  });

  // ---- Menú del mixer ------------------------------------------------------
  if (mixerConfig.menu && Array.isArray(mixerConfig.channels)) {
    initMixerMenu({
      menu: mixerConfig.menu,
      triggers: (mixerConfig.triggers || []).filter(Boolean),
      channels: mixerConfig.channels
    });
  }

  // ---- Tema + mute persistents ---------------------------------------------
  setupThemeSync({ storage, selectEl: theme.selectEl });
  setupMutePersistence({
    storage,
    getAudioInstance: getAudio,
    muteButton: theme.muteButton
  });

  // ---- Inicialització d'àudio ----------------------------------------------
  const baseInit = type === 'melodic'
    ? createMelodicAudioInitializer({ defaultInstrument })
    : createRhythmAudioInitializer({
      getSoundSelects: getSoundSelects || (() => ({})),
      schedulingBridge,
      channels: [],
      defaultInstrument
    });

  // El select de cada canal porta el so triat a dataset.value; en apps
  // melòdiques l'inicialitzador no els coneix, així que s'apliquen aquí.
  const SELECT_SETTERS = [
    ['baseSoundSelect', 'setBase'],
    ['accentSoundSelect', 'setAccent'],
    ['startSoundSelect', 'setStart'],
    ['cycleSoundSelect', 'setCycle']
  ];

  async function initAudio() {
    let instance = getAudio();
    if (instance) return instance;

    instance = await baseInit();
    if (instance && channelTier) {
      setupAudioDefaults(instance, { channels: channelTier });
    }

    // L'app ha de veure la instància ABANS de re-aplicar els toggles:
    // els seus onChange resolen el motor via getAudio().
    setAudio(instance);

    // Re-aplicar l'estat dels toggles fets abans que el motor existís (H-11)
    toggleManager?.applyTo();

    // Mute desat
    if (load('mute') === '1' && typeof instance.setMute === 'function') {
      instance.setMute(true);
    }

    // Apps melòdiques: aplicar els selects de so manualment
    if (type === 'melodic' && typeof getSoundSelects === 'function') {
      const selects = getSoundSelects() || {};
      for (const [selectKey, method] of SELECT_SETTERS) {
        const value = selects[selectKey]?.dataset?.value;
        if (value && typeof instance[method] === 'function') {
          await instance[method](value);
        }
      }
    }

    if (typeof window !== 'undefined') {
      window.__labAudio = instance;
      if (exposeEngineGlobal) window.NuzicAudioEngine = instance;
    }

    return instance;
  }

  if (typeof window !== 'undefined') {
    // Exposat per al preview del dropdown de sons (patró App28/29)
    window.__labInitAudio = initAudio;
  }

  return {
    storage,
    load,
    save,
    clear,
    initAudio,
    getToggle,
    setToggle
  };
}
