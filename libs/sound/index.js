import { loadSampleMap } from './sample-map.js';
import { AudioMixer } from './mixer.js';
import { waitForUserInteraction, hasUserInteracted } from './user-interaction.js';
import { ensureToneLoaded } from './tone-loader.js';
import { signalMelodicChannelReady } from './engine-ready.js';

/* global Tone */

const SAMPLE_BASE_URL = new URL('./samples/', import.meta.url);
const SOUND_URLS = {
  click1: new URL('click1.wav', SAMPLE_BASE_URL).href,
  click2: new URL('click2.wav', SAMPLE_BASE_URL).href,
  click3: new URL('click3.wav', SAMPLE_BASE_URL).href,
  click4: new URL('click4.wav', SAMPLE_BASE_URL).href,
  click5: new URL('click5.wav', SAMPLE_BASE_URL).href,
  click6: new URL('click6.wav', SAMPLE_BASE_URL).href,
  click7: new URL('click7.wav', SAMPLE_BASE_URL).href,
  click8: new URL('click8.wav', SAMPLE_BASE_URL).href,
  click9: new URL('click9.wav', SAMPLE_BASE_URL).href,
  click10: new URL('click10.wav', SAMPLE_BASE_URL).href,
  click11: new URL('Click11.wav', SAMPLE_BASE_URL).href
};

export const soundNames = Object.keys(SOUND_URLS);
export { waitForUserInteraction };
export { ensureToneLoaded };
export const soundLabels = {
  click1: 'Click Base',
  click2: 'Click Acento',
  click3: 'Sticks',
  click4: 'Pandereta',
  click5: 'Shake',
  click6: 'Triángulo',
  click7: 'Bombo',
  click8: 'Caja',
  click9: 'Hi-Hat',
  click10: 'Ride',
  click11: 'Ruido Rosa'
};

const mixer = new AudioMixer({ masterLabel: 'Master' });
const PLAYER_KEYS = ['pulso', 'pulso0', 'seleccionados', 'start', 'cycle'];
let audioReadyPromise = null;
let toneStartPromise = null;
const workletModulePromises = new WeakMap();
// A-06: contexts amb listener de statechange ja penjat (anti doble-attach)
const watchedContexts = new WeakSet();
const bufferCacheByContext = new WeakMap();
const arrayBufferCache = new Map();
let previewContext = null;
let previewGain = null;
const previewSources = new Set();

function isBaseAudioContext(ctx) {
  if (!ctx) return false;
  const global = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
  if (!global) return false;
  const constructors = [
    global.AudioContext,
    global.webkitAudioContext,
    global.OfflineAudioContext,
    global.webkitOfflineAudioContext,
    global.BaseAudioContext
  ].filter((Ctor) => typeof Ctor === 'function');
  return constructors.some((Ctor) => {
    try { return ctx instanceof Ctor; } catch { return false; }
  });
}

function getToneContext() {
  return resolveToneContext();
}

function isRunning(ctx) {
  return !!ctx && typeof ctx.state === 'string' && ctx.state === 'running';
}

function isNotAllowedError(error) {
  if (!error) return false;
  const name = error.name;
  if (name === 'NotAllowedError' || name === 'InvalidAccessError' || name === 'SecurityError') {
    return true;
  }
  if (name === 'DOMException') {
    const code = typeof error.code === 'number' ? error.code : null;
    if (code === 11) return true; // NotAllowedError on some browsers
  }
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  if (!message) return false;
  return message.includes('not allowed') || message.includes('user gesture');
}

async function tryResumeContext(ctx) {
  if (!ctx || typeof ctx.resume !== 'function') return false;
  if (ctx.state === 'running') return true;
  if (ctx.state === 'closed') return false;
  try {
    await ctx.resume();
    return ctx.state === 'running';
  } catch (error) {
    if (isNotAllowedError(error)) {
      return false;
    }
    throw error;
  }
}

async function startToneAudio() {
  // Load Tone.js if not already loaded (waits for user interaction)
  await ensureToneLoaded();

  if (typeof Tone === 'undefined') return false;

  // Wait for user interaction before attempting to start audio
  await waitForUserInteraction();

  const contextBefore = getToneContext();
  if (isRunning(contextBefore)) return true;
  if (typeof Tone.start === 'function') {
    try {
      await Tone.start();
    } catch (error) {
      if (error && (error.name === 'InvalidAccessError' || error.name === 'NotAllowedError' || error.name === 'DOMException')) {
        return false;
      }
      throw error;
    }
  }
  let context = getToneContext();
  if (isRunning(context)) return true;
  if (context && typeof context.resume === 'function') {
    try {
      await context.resume();
    } catch (error) {
      if (error && (error.name === 'InvalidAccessError' || error.name === 'NotAllowedError' || error.name === 'DOMException')) {
        return false;
      }
      throw error;
    }
  }
  context = getToneContext();
  return isRunning(context);
}

/**
 * Enhanced ensureAudio function that minimizes console warnings
 * Only attempts to start audio context on user interaction
 */
export async function ensureAudioSilent() {
  if (typeof Tone === 'undefined') {
    console.warn('Tone.js not available - audio features disabled');
    return false;
  }

  const context = getToneContext();
  if (isRunning(context)) {
    return true; // Already running
  }

  // Don't try to start automatically - wait for user interaction
  return false;
}

export async function ensureAudio() {
  // Wait for user interaction before initializing any audio
  await waitForUserInteraction();

  if (typeof Tone !== 'undefined') {
    if (!toneStartPromise) {
      toneStartPromise = (async () => {
        try {
          return await startToneAudio();
        } finally {
          toneStartPromise = null;
        }
      })();
    }
    const started = await toneStartPromise;
    if (started) return;
  }

  if (!audioReadyPromise) {
    audioReadyPromise = (async () => {
      if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
        try {
          const Ctor = window.AudioContext || window.webkitAudioContext;
          const ctx = new Ctor({ latencyHint: 'interactive', sampleRate: 44100 });
          await ctx.close?.();
        } catch {}
      }
    })().finally(() => {
      audioReadyPromise = null;
    });
  }

  await audioReadyPromise;
}

function clamp01(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  if (num <= 0) return 0;
  if (num >= 1) return 1;
  return num;
}

export function setVolume(value) {
  mixer.setMasterVolume(clamp01(value));
}

export function getVolume() {
  return mixer.getMasterVolume();
}

export function setMute(value) {
  mixer.setMasterMute(!!value);
}

export function toggleMute() {
  return mixer.toggleMasterMute();
}

export function isMuted() {
  return mixer.isMasterMuted();
}

export function getMixer() {
  return mixer;
}

export function subscribeMixer(listener) {
  return mixer.subscribe(listener);
}

export function setChannelVolume(channelId, value) {
  mixer.setChannelVolume(channelId, value);
}

export function setChannelMute(channelId, value) {
  mixer.setChannelMute(channelId, value);
}

export function toggleChannelMute(channelId) {
  mixer.toggleChannelMute(channelId);
}

export function setChannelSolo(channelId, value) {
  mixer.setChannelSolo(channelId, value);
}

export function toggleChannelSolo(channelId) {
  mixer.toggleChannelSolo(channelId);
}

export function getChannelState(channelId) {
  return mixer.getChannelState(channelId);
}

const SCHEDULING_PRESETS = {
  desktop: { lookAhead: 0.02, updateInterval: 0.01, sampleOffset: 0.005 },
  balanced: { lookAhead: 0.03, updateInterval: 0.015, sampleOffset: 0.006 },
  mobile: { lookAhead: 0.06, updateInterval: 0.03, sampleOffset: 0.008 }
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getContextBufferCache(ctx) {
  if (!ctx) return null;
  let cache = bufferCacheByContext.get(ctx);
  if (!cache) {
    cache = new Map();
    bufferCacheByContext.set(ctx, cache);
  }
  return cache;
}

async function fetchSampleArrayBuffer(url) {
  if (!url) return null;
  const globalObj = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
  const fetchFn = (typeof fetch === 'function') ? fetch : globalObj?.fetch;
  if (typeof fetchFn !== 'function') throw new Error('fetch not available');
  let pending = arrayBufferCache.get(url);
  if (!pending) {
    pending = fetchFn(url).then((response) => {
      if (!response.ok) throw new Error(`Failed to load sample ${url}`);
      return response.arrayBuffer();
    });
    arrayBufferCache.set(url, pending);
  }
  const data = await pending;
  return data.slice ? data.slice(0) : data;
}

// P-12: escalfa la cache de xarxa amb els samples per defecte durant temps
// idle. Només mou bytes (fetch memoitzat a arrayBufferCache) — cap
// AudioContext ni descodificació abans del gest de l'usuari, així que
// l'ordre d'init es manté. La descodificació segueix passant a _initPlayers
// després del gest, però llavors els bytes ja són locals.
export function prefetchDefaultSamples() {
  if (typeof window === 'undefined') return;
  const defaultKeys = ['click7', 'click8', 'click9', 'click10'];
  const warm = () => {
    for (const key of defaultKeys) {
      fetchSampleArrayBuffer(SOUND_URLS[key]).catch(() => {});
    }
  };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(warm, { timeout: 3000 });
  } else {
    setTimeout(warm, 1500);
  }
}

// LA-05: contracte — el caller passa un ArrayBuffer de la seva propietat
// (fetchSampleArrayBuffer ja retorna una còpia privada de la cache), així
// que decodeAudioData pot detachar-lo sense còpia defensiva extra aquí.
function decodeAudioBuffer(ctx, arrayBuffer) {
  if (!ctx || !arrayBuffer) return Promise.reject(new Error('AudioContext or buffer missing'));
  return new Promise((resolve, reject) => {
    try {
      const result = ctx.decodeAudioData(arrayBuffer, resolve, reject);
      if (result && typeof result.then === 'function') {
        result.then(resolve, reject);
      }
    } catch (error) {
      reject(error);
    }
  });
}

async function loadBufferForContext(ctx, url) {
  if (!ctx || !url) return null;
  const cache = getContextBufferCache(ctx);
  if (!cache) return null;
  let pending = cache.get(url);
  if (!pending) {
    pending = (async () => {
      const arrayBuffer = await fetchSampleArrayBuffer(url);
      return decodeAudioBuffer(ctx, arrayBuffer);
    })();
    cache.set(url, pending);
  }
  try {
    return await pending;
  } catch (error) {
    cache.delete(url);
    throw error;
  }
}

async function getPreviewContext() {
  // Wait for user interaction before creating preview AudioContext
  await waitForUserInteraction();

  const globalObj = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
  const Ctor = globalObj?.AudioContext || globalObj?.webkitAudioContext;
  if (!Ctor) throw new Error('AudioContext not available');

  if (!previewContext || previewContext.state === 'closed') {
    previewContext = new Ctor({ latencyHint: 'interactive', sampleRate: 44100 });
    previewGain = null;
    previewSources.clear();
  }

  if (previewContext.state === 'suspended') {
    try { await previewContext.resume(); } catch {}
  }

  if (!previewGain) {
    previewGain = previewContext.createGain();
    previewGain.gain.value = 0.8;
    previewGain.connect(previewContext.destination);
  }

  return previewContext;
}

function resolveToUrl(value) {
  if (!value) return null;
  if (SOUND_URLS[value]) return SOUND_URLS[value];
  if (typeof value === 'string') {
    try {
      return new URL(value, SAMPLE_BASE_URL).href;
    } catch {
      return value;
    }
  }
  return null;
}

function normalizeSound(value, fallback) {
  const spec = value || fallback;
  const url = resolveToUrl(spec);
  return { key: spec || fallback, url };
}

function normalizeAudioContext(ctx) {
  if (!ctx) return null;
  if (isBaseAudioContext(ctx)) return ctx;
  if (ctx.rawContext && ctx.rawContext !== ctx) {
    const raw = normalizeAudioContext(ctx.rawContext);
    if (raw) return raw;
  }
  if (ctx.context && ctx.context !== ctx) {
    const nested = normalizeAudioContext(ctx.context);
    if (nested) return nested;
  }
  return null;
}

function resolveToneContext() {
  if (typeof Tone === 'undefined') return null;

  // Only try to access Tone context if user has interacted
  // This prevents premature AudioContext initialization warnings
  if (!hasUserInteracted()) {
    return null;
  }

  try {
    // Check if Tone context exists without accessing .state property
    // which can trigger AudioContext creation
    const candidates = [];

    if (typeof Tone.getContext === 'function') {
      try {
        const ctx = Tone.getContext();
        if (ctx && ctx.state === 'running') {
          candidates.push(ctx);
        }
      } catch {
        // Ignore context access errors
      }
    }

    // Only access Tone.context if it already exists and is confirmed running
    if (Tone.context && typeof Tone.context.state === 'string' && Tone.context.state === 'running') {
      candidates.push(Tone.context);
    }

    for (const candidate of candidates) {
      const resolved = normalizeAudioContext(candidate);
      if (resolved && resolved.state === 'running') {
        return resolved;
      }
    }
  } catch (error) {
    // Ignore errors when checking Tone context
  }

  return null;
}

// F4b: una selecció pot barrejar números (legacy → bus 'seleccionados')
// i objectes { value, channel } que han de sonar pel bus del seu canal de
// mixer. Normalitza a Set de valors + Map valor→canal. Amb només números
// el Set conté els valors tal qual (semàntica de l'antic toSet) i el Map
// queda buit — cap canvi de comportament per a la resta d'apps. Si un
// valor arriba repetit amb
// canals diferents, la PRIMERA etiqueta guanya (el Set ja deduplica el
// so: cada valor sona per exactament un bus).
function normalizeSelection(indices) {
  const set = new Set();
  const channels = new Map();
  const add = (entry) => {
    if (entry != null && typeof entry === 'object') {
      const value = Number(entry.value);
      if (!Number.isFinite(value)) return;
      set.add(value);
      const channel = (typeof entry.channel === 'string' && entry.channel) ? entry.channel : null;
      if (channel && !channels.has(value)) channels.set(value, channel);
      return;
    }
    if (entry == null) return;
    set.add(entry);
  };
  if (indices instanceof Set || Array.isArray(indices)) {
    indices.forEach(add);
  } else if (indices != null && typeof indices[Symbol.iterator] === 'function') {
    for (const entry of indices) add(entry);
  }
  return { set, channels };
}

export class TimelineAudio {
  constructor() {
    this.isReady = false;
    this.isPlaying = false;

    // Flag que distingeix "la seqüència ha acabat sola" (final natural,
    // posat a true al missatge 'done' del worklet) de "l'usuari prem Stop".
    // El consumeix stop(): si és true, deixem que les cues ADSR ja
    // programades sonin senceres en lloc del tall ràpid de 50ms.
    this._endedNaturally = false;

    this.totalRef = 0;
    this.intervalRef = 0;
    this.loopRef = true;

    // Gamification hooks
    this._gamificationHooks = null;

    this._onPulseRef = null;
    this._onScheduleRef = null;
    this._noteProviders = new Map();
    this._onVoiceRef = null;
    this.onCompleteRef = null;
    this._cycleConfig = null;
    this._patternBeats = null;

    this._lastStep = null;
    this._lastPulseTime = null;
    this._lastAbsoluteStep = null;
    this._zeroOffset = null;
    this._pulseCounter = -1;
    this._lastCycleState = null;

    // Map of scheduled times by step index (for passing precise timing to onPulse)
    this._scheduledTimes = new Map();

    this.selectedRef = new Set();
    this._selectedResolution = 1;
    // F4b: valor seleccionat → canal de mixer propi (només per als valors
    // arribats com a objectes { value, channel }; els números legacy no hi
    // són i segueixen sortint pel bus 'seleccionados').
    this._selectedChannels = new Map();
    this._voiceDefs = new Map();
    this._baseResolution = 1;
    this.baseResolution = 1;

    this._ctx = null;
    this._node = null;
    this._schedulerId = null;
    // LA-01: arrenquem amb el preset 'balanced' documentat — abans 0.12 de
    // lookAhead (2-6x els perfils), que era el que patia qualsevol consumidor
    // sense el scheduling bridge del header (mute/so/selecció trigaven fins a
    // 120ms a sentir-se). El bridge segueix sobreescrivint per dispositiu.
    this._lookAheadSec = SCHEDULING_PRESETS.balanced.lookAhead;
    this._schedulerEverySec = SCHEDULING_PRESETS.balanced.updateInterval;
    this._schedulerOverrideSec = null;
    this._sampleOffsetSec = SCHEDULING_PRESETS.balanced.sampleOffset;

    this._bus = { master: null, pulso: null, start: null, seleccionados: null, cycle: null, effects: null };
    // F4 (veus amb canal propi): un GainNode per canal de mixer de veu,
    // creat lazy a _ensureVoiceBus i governat per _applyMixerState.
    this._voiceBuses = new Map();
    // Mapa pla canal→muted (inclou master), refrescat a _applyMixerState;
    // el consulta l'agenda de veus igual que _cycleMutedForFallback.
    this._mixerChannelMuted = new Map();
    // Canal de mixer que governa el bus de cicle ('subdivision' per defecte;
    // les apps multi-fracció el poden re-apuntar amb setCycleChannel).
    this._cycleChannelId = 'subdivision';
    // F4c: canal de mixer → sample PROPI (setChannelSound). Precedència en
    // temps d'agenda: override de canal > sample de ROL (setBase/setAccent/
    // setCycle — els selects del header dev fixen els defaults). El mapa
    // sobreviu el teardown del context (els buffers es re-carreguen a
    // _initPlayers); buit = comportament byte-idèntic al d'abans.
    this._channelSounds = new Map();
    this._previewGain = null;
    this._stopFadeTimer = null;
    this._stopFadeRestore = null;
    this._effectsEnabled = true; // Master effects chain enabled for testing

    this._sampleMap = null;

    this._fallbackGain = null;

    this._buffers = new Map();
    this._activeSources = new Set();
    // absStep → Set<BufferSource>: fonts agendades al lookahead, indexades
    // pel pas absolut perquè el rebobinat de setTempo pugui cancel·lar-les.
    this._futureSources = new Map();

    this._tapTimes = [];
    this._tapWindowMs = 2000;
    this._tapMinCount = 3;
    this._tapMaxHistory = 8;

    this._pendingTempo = null;
    this._setScheduledStep = null;
    this._tickFn = null;

    this._defaultAssignments = {
      pulso: 'click9',
      pulso0: 'click7',
      seleccionados: 'click8',
      start: 'click7',
      cycle: 'click10'
    };
    this._soundAssignments = { ...this._defaultAssignments };
    this._channelAssignments = {
      base: 'pulse',
      accent: 'accent',
      start: 'pulse',
      cycle: 'subdivision',
      selected: 'accent'
    };

    this.mixer = mixer;
    mixer.registerChannel('pulse', { allowSolo: true, label: 'Pulso' });
    mixer.registerChannel('start', { allowSolo: true, label: 'P0' });
    mixer.registerChannel('accent', { allowSolo: true, label: 'Seleccionado' });
    mixer.registerChannel('subdivision', { allowSolo: true, label: 'Subdivisión' });

    this._pendingMixerState = null;
    this._pulseMutedForFallback = false;
    this._cycleMutedForFallback = false;
    this._startEnabled = true; // P1 additional sound enabled by default

    // Measure/Compás system: plays pulso0 at specific steps (cycle starts)
    this._measureStarts = new Set([0]); // Default: only step 0
    this._measureEnabled = true; // Whether measure sounds are enabled

    this._ensureContextPromise = null;

    this._unsubscribeMixer = mixer.subscribe((state) => this._applyMixerState(state));

    try { window.NuzicAudioEngine = this; } catch {}
  }

  async ready() {
    await ensureAudio();
    await this._ensureContext();
    return this;
  }

  setGamificationHooks(hooks) {
    this._gamificationHooks = hooks;
  }

  _teardownAudioGraph() {
    if (this._node) {
      try { this._node.disconnect(); } catch {}
      try { this._node.port.onmessage = null; } catch {}
    }
    this._node = null;

    Object.keys(this._bus).forEach((key) => {
      const node = this._bus[key];
      if (key === 'effects' && node) {
        // Disconnect all effects nodes
        Object.values(node).forEach((effectNode) => {
          if (effectNode) {
            try { effectNode.disconnect(); } catch {}
          }
        });
      } else if (node) {
        try { node.disconnect(); } catch {}
      }
      this._bus[key] = null;
    });

    // F4: els busos de veu viuen fora de _bus — desconnectar-los també.
    if (this._voiceBuses) {
      for (const bus of this._voiceBuses.values()) {
        try { bus.disconnect(); } catch {}
      }
      this._voiceBuses.clear();
    }

    this._stopAllPlayers();
    if (this._buffers) this._buffers.clear();
    if (this._activeSources) this._activeSources.clear();
    if (this._fallbackGain) {
      try { this._fallbackGain.disconnect(); } catch {}
    }
    this._fallbackGain = null;
    // A-09: sense això, després d'un canvi de context preview() connectava
    // un buffer del context NOU al GainNode del context VELL
    // (InvalidAccessError empassat pel catch → previews muts per sempre).
    // preview() el recrea lazy sobre el context vigent.
    if (this._previewGain) {
      try { this._previewGain.disconnect(); } catch {}
    }
    this._previewGain = null;
    this.isReady = false;
    this._lastAbsoluteStep = null;
    this._zeroOffset = null;
    this._pulseCounter = -1;
    this._lastCycleState = null;
    this._patternBeats = null;
    this._pendingTempo = null;
    this._setScheduledStep = null;
    this._tickFn = null;
  }

  // A-06: sense això, un context suspès pel SO a mig playback (iOS
  // 'interrupted' per trucada/Siri, canvi de dispositiu Bluetooth, tab
  // descartada) deixava l'app en estat zombie: isPlaying true, el
  // setInterval del scheduler girant sobre un currentTime congelat i cap
  // so fins que l'usuari parava a mà. En recuperar el control intentem
  // reprendre; si el navegador refusa (cal un gest nou), fem stop()
  // perquè UI i àudio tornin a coincidir.
  _watchContextState(ctx) {
    if (!ctx || typeof ctx.addEventListener !== 'function') return;
    if (watchedContexts.has(ctx)) return;
    watchedContexts.add(ctx);
    ctx.addEventListener('statechange', () => {
      if (this._ctx !== ctx) return; // context substituït des d'aleshores
      if (ctx.state === 'running' || !this.isPlaying) return;
      if (ctx.state === 'closed') {
        // A-08: 'closed' és irreversible (resume() hi és impossible) — a
        // diferència de 'suspended', cal desmuntar el graf i deixar anar
        // el context; si no, _ensureContext trobava _node viu (o
        // re-adoptava aquest mateix ctx tancat via preferExisting) i cap
        // play() posterior tornava a sonar: Play visible però mut per
        // sempre. Ordre: stop() ABANS de nul·lar _ctx (stop() comença amb
        // `if (!this._ctx) return`). Els instruments melòdics JA carregats
        // queden lligats al context mort (limitació coneguda: cal
        // recarregar); els que es carreguin després reben el bus nou via
        // engine-ready re-armable.
        this.stop();
        this._teardownAudioGraph();
        this._ctx = null;
        return;
      }
      // 'suspended' (i l''interrupted' d'iOS, que hi mapeja)
      tryResumeContext(ctx)
        .then((resumed) => { if (!resumed && this.isPlaying) this.stop(); })
        .catch(() => { if (this.isPlaying) this.stop(); });
    });
  }

  async _ensureContext() {
    // Wait for user interaction before creating any AudioContext
    await waitForUserInteraction();

    const preferredToneCtx = resolveToneContext();
    const existingCtx = normalizeAudioContext(this._ctx);
    const desiredCtx = preferredToneCtx || existingCtx || null;

    if (desiredCtx) {
      await tryResumeContext(desiredCtx);
    }

    if (this._node && desiredCtx && this._ctx && this._ctx !== desiredCtx) {
      this._teardownAudioGraph();
    }

    if (this._node) {
      const activeCtx = normalizeAudioContext(this._ctx) || desiredCtx || null;
      if (activeCtx) {
        await tryResumeContext(activeCtx);
      }
      return;
    }
    if (this._ensureContextPromise) {
      await this._ensureContextPromise;
      return;
    }

    const FallbackCtor = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext))
      ? (window.AudioContext || window.webkitAudioContext)
      : null;

    const buildContext = async () => {
      const toneCtx = resolveToneContext();
      const preferExisting = normalizeAudioContext(this._ctx);
      let ctx = toneCtx || preferExisting || null;

      if (!ctx && this._ctx && this._ctx !== preferExisting) {
        const normalized = normalizeAudioContext(this._ctx);
        if (normalized) ctx = normalized;
      }

      if (!ctx && FallbackCtor) {
        ctx = new FallbackCtor({ latencyHint: 'interactive', sampleRate: 44100 });
      }

      if (!ctx || !isBaseAudioContext(ctx)) {
        if (!FallbackCtor) throw new Error('AudioContext not available');
        ctx = new FallbackCtor({ latencyHint: 'interactive', sampleRate: 44100 });
      }

      if (!ctx || !isBaseAudioContext(ctx) || typeof ctx.audioWorklet === 'undefined' ||
          typeof ctx.audioWorklet.addModule !== 'function') {
        throw new Error('AudioWorklet not available');
      }

      this._ctx = ctx;
      this._watchContextState(ctx);

      await tryResumeContext(ctx);

      let modulePromise = workletModulePromises.get(ctx);
      if (!modulePromise) {
        modulePromise = ctx.audioWorklet.addModule(new URL('./timeline-processor.js', import.meta.url));
        workletModulePromises.set(ctx, modulePromise);
      }

      try {
        await modulePromise;
      } catch (err) {
        const message = String(err?.message || '');
        const alreadyRegistered = err?.name === 'NotSupportedError' && /already registered/i.test(message);
        if (!alreadyRegistered) {
          workletModulePromises.delete(ctx);
          throw err;
        }
        workletModulePromises.set(ctx, Promise.resolve());
      }

      this._node = new AudioWorkletNode(ctx, 'timeline-processor');

      this._bus.master = ctx.createGain();
      this._bus.master.gain.value = 0.75; // Default master volume at 75%
      this._bus.pulso = ctx.createGain();
      this._bus.pulso.gain.value = 0.75; // Default channel volume at 75%
      this._bus.start = ctx.createGain();
      this._bus.seleccionados = ctx.createGain();
      this._bus.seleccionados.gain.value = 0.75; // Default channel volume at 75%
      this._bus.cycle = ctx.createGain();
      this._bus.cycle.gain.value = 0.75; // Default channel volume at 75%
      this._bus.melodic = ctx.createGain(); // Channel for melodic instruments (piano, violin)
      this._bus.melodic.gain.value = 0.75; // Default channel volume at 75%
      signalMelodicChannelReady(this._bus.melodic); // LA-08: desbloqueja piano/flute sense polling

      // Fixar canal count explícit (stereo) a tots els buses. Sense
      // això, GainNode usa 'max' i canvia de canals dinàmicament segons
      // les fonts que rep — pot crear glitches breus quan una font
      // mono nova entra (Salamander piano és mono, click samples també).
      const busNodes = [
        this._bus.master, this._bus.pulso, this._bus.start,
        this._bus.seleccionados, this._bus.cycle, this._bus.melodic
      ];
      for (const node of busNodes) {
        try {
          node.channelCount = 2;
          node.channelCountMode = 'explicit';
          node.channelInterpretation = 'speakers';
        } catch {
          // Mock de test
        }
      }

      this._bus.pulso.connect(this._bus.master);
      this._bus.start.connect(this._bus.master);
      this._bus.seleccionados.connect(this._bus.master);
      this._bus.cycle.connect(this._bus.master);
      this._bus.melodic.connect(this._bus.master);

      // Create master effects chain: EQ → Compressor → Limiter → Reverb → destination
      // Only create if context supports these methods (not available in some test mocks)
      const supportsEffects = typeof ctx.createBiquadFilter === 'function' &&
                              typeof ctx.createDynamicsCompressor === 'function' &&
                              typeof ctx.createConvolver === 'function';

      if (supportsEffects) {
        this._bus.effects = {
          eq: ctx.createBiquadFilter(),
          compressor: ctx.createDynamicsCompressor(),
          limiter: ctx.createDynamicsCompressor(),
          // Reverb: dry/wet parallel mix using native ConvolverNode
          reverb: ctx.createConvolver(),
          reverbDry: ctx.createGain(),
          reverbWet: ctx.createGain(),
          reverbMix: ctx.createGain()  // Output node after dry/wet mixing
        };

        // Fixar canal count explícit a stereo a tota la cadena master.
        // Sense això, BiquadFilterNode i DynamicsCompressorNode usen
        // `channelCountMode: 'max'` per defecte: cada vegada que una nova
        // font mono/stereo entra, el node reconfigura els canals → glitch
        // audible (Firefox avisa: "channelCount changes for
        // BiquadFilterNode may produce audio issues"). És una causa
        // documentada de salts de volum per nota en escales.
        const masterChain = [
          this._bus.effects.eq,
          this._bus.effects.compressor,
          this._bus.effects.limiter,
          this._bus.effects.reverbDry,
          this._bus.effects.reverbWet,
          this._bus.effects.reverbMix
        ];
        for (const node of masterChain) {
          try {
            node.channelCount = 2;
            node.channelCountMode = 'explicit';
            node.channelInterpretation = 'speakers';
          } catch {
            // Algun mock de test pot no acceptar aquestes assignacions
          }
        }

        // Configure EQ (highshelf for subtle presence boost)
        this._bus.effects.eq.type = 'highshelf';
        this._bus.effects.eq.frequency.value = 3000;  // 3kHz - presence range
        this._bus.effects.eq.gain.value = 1.5;        // Subtle +1.5dB boost

        // Configure Compressor (canonical Nuzic glue — values harmonitzats
        // a libs/app-common/audio-init.js → CANONICAL_FX)
        const comp = this._bus.effects.compressor;
        comp.threshold.value = -6;   // Comp threshold canònic (era -12)
        comp.knee.value = 30;        // Soft knee = transparent transition
        comp.ratio.value = 2;        // Low ratio = gentle glue
        comp.attack.value = 0.02;    // 20ms - lets transients through
        comp.release.value = 0.25;   // 250ms - natural release

        // Configure Limiter (safety only - transparent unless clipping)
        const lim = this._bus.effects.limiter;
        lim.threshold.value = -0.5;  // Limiter threshold canònic (era -1)
        lim.knee.value = 0;          // Hard knee for true limiting
        lim.ratio.value = 20;        // Maximum ratio
        lim.attack.value = 0.003;    // 3ms - fast but not instant
        lim.release.value = 0.1;     // 100ms - smoother recovery

        // Configure Reverb (synthetic impulse response). Wet canònic 12%
        // (harmonitzat amb CANONICAL_FX a libs/app-common/audio-init.js).
        this._bus.effects.reverb.buffer = this._createReverbImpulse(ctx, 1.5, 2);
        this._bus.effects.reverbDry.gain.value = 0.88;  // 88% dry (12% wet)
        this._bus.effects.reverbWet.gain.value = 0.12;  // 12% wet by default
        this._reverbWetValue = 0.12;

        // Wire up reverb dry/wet parallel paths:
        // limiter → [dry path] → reverbMix
        // limiter → [wet path: reverb] → reverbMix
        this._bus.effects.limiter.connect(this._bus.effects.reverbDry);
        this._bus.effects.limiter.connect(this._bus.effects.reverb);
        this._bus.effects.reverb.connect(this._bus.effects.reverbWet);
        this._bus.effects.reverbDry.connect(this._bus.effects.reverbMix);
        this._bus.effects.reverbWet.connect(this._bus.effects.reverbMix);

        // A-04: la cadena INTERNA es cableja SEMPRE, fora del condicional.
        // Abans només es cablejava a la branca enabled: si el graf es
        // (re)construïa amb FX off, setEffectsEnabled(true) feia
        // master→eq amb l'eq sense sortida (i reverbMix sense destination)
        // → silenci total fins a recarregar. Amb FX off la cadena no rep
        // senyal (el master va directe a destination) → comportament
        // audible idèntic al d'abans.
        this._bus.effects.eq.connect(this._bus.effects.compressor);
        this._bus.effects.compressor.connect(this._bus.effects.limiter);
        this._bus.effects.reverbMix.connect(ctx.destination);

        // Només la SORTIDA del master depèn de l'estat d'efectes (el
        // mateix que setEffectsEnabled commuta en calent).
        if (this._effectsEnabled) {
          this._bus.master.connect(this._bus.effects.eq);
        } else {
          this._bus.master.connect(ctx.destination);
        }
      } else {
        // Fallback: connect master directly to destination (no effects)
        this._bus.effects = null;
        this._bus.master.connect(ctx.destination);
      }

      await this._initPlayers();

      this._node.connect(this._bus.master);
      this._node.port.onmessage = (e) => this._handleClockMessage(e.data);

      this._refreshFallbackGain();

      if (this._pendingMixerState) {
        this._applyMixerState(this._pendingMixerState);
      }

      await tryResumeContext(ctx);

      // Warm-up del graf: un cop el context està running i el graf
      // connectat, el "escalfem" perquè la primera nota/seqüència real
      // no caigui en un graf fred (1a nota muda) ni en un rellotge de
      // worklet inestable (primer play atropellat). Vegeu _primeGraph.
      this._primeGraph();

      this.isReady = true;
    };

    this._ensureContextPromise = buildContext();
    try {
      await this._ensureContextPromise;
    } finally {
      this._ensureContextPromise = null;
    }
  }

  async _initPlayers() {
    this._sampleMap = await loadSampleMap();
    this._applySampleMap(this._sampleMap);

    if (!this._ctx) return;

    const buffers = new Map();
    await Promise.all(PLAYER_KEYS.map(async (key) => {
      const { key: resolved, url } = normalizeSound(this._soundAssignments[key], this._defaultAssignments[key]);
      this._soundAssignments[key] = resolved;
      if (!url) return;
      try {
        const buffer = await loadBufferForContext(this._ctx, url);
        if (buffer) buffers.set(key, { url, buffer });
      } catch (error) {
        console.warn(`Failed to load buffer for ${key}`, error);
      }
    }));

    // F4c: overrides de sample per canal (setChannelSound) — es carreguen
    // aquí tant si l'app els va demanar abans del primer gest (assignació
    // lazy sense context) com en un rebuild després d'un teardown.
    if (this._channelSounds?.size) {
      await Promise.all(Array.from(this._channelSounds, async ([channelId, soundKey]) => {
        const { url } = normalizeSound(soundKey, null);
        if (!url) return;
        try {
          const buffer = await loadBufferForContext(this._ctx, url);
          if (buffer) buffers.set(`channel:${channelId}`, { url, buffer });
        } catch (error) {
          console.warn(`Failed to load channel sound for ${channelId}`, error);
        }
      }));
    }

    this._buffers = buffers;
  }

  _applySampleMap(map) {
    if (!map) return;
    const defaults = this._defaultAssignments;
    if (map.pulso) defaults.pulso = map.pulso;
    if (map.pulso0) defaults.pulso0 = map.pulso0;
    if (map.seleccionados) defaults.seleccionados = map.seleccionados;
    if (map.start) defaults.start = map.start;
    if (map.cycle) defaults.cycle = map.cycle;
    defaults.pulso0 = defaults.pulso0 || defaults.pulso;

    // Only apply sample map to _soundAssignments if they haven't been explicitly set
    // (i.e., they still match the original defaults from constructor)
    const assignments = this._soundAssignments;
    const originalDefaults = {
      pulso: 'click9',
      pulso0: 'click7',
      seleccionados: 'click8',
      start: 'click7',
      cycle: 'click10'
    };

    // Only overwrite if still at original default value (not user-set)
    if (assignments.pulso === originalDefaults.pulso) assignments.pulso = defaults.pulso;
    if (assignments.pulso0 === originalDefaults.pulso0) assignments.pulso0 = map.pulso0 || assignments.pulso;
    if (assignments.seleccionados === originalDefaults.seleccionados && map.seleccionados) {
      assignments.seleccionados = map.seleccionados;
    }
    if (assignments.start === originalDefaults.start && map.start) {
      assignments.start = map.start;
    }
    if (assignments.cycle === originalDefaults.cycle && map.cycle) {
      assignments.cycle = map.cycle;
    }
  }

  _applyMixerState(state) {
    this._pendingMixerState = state;
    if (!state || !this._bus.master) return;

    const channels = new Map((state.channels || []).map(ch => [ch.id, ch]));
    const masterMuted = !!state.master?.effectiveMuted;
    const masterVolume = state.master?.volume ?? 0.75;

    this._pulseMutedForFallback = masterMuted || !!channels.get('pulse')?.effectiveMuted;
    this._cycleMutedForFallback = masterMuted || !!channels.get(this._cycleChannelId)?.effectiveMuted;

    // F4: mapa pla canal→muted per a les rutes que decideixen en temps
    // d'agenda (veus amb canal propi); mateixa semàntica que els flags
    // *MutedForFallback (master O effectiveMuted del canal).
    const mutedMap = new Map();
    channels.forEach((ch, id) => { mutedMap.set(id, masterMuted || !!ch.effectiveMuted); });
    this._mixerChannelMuted = mutedMap;

    const applyGain = (node, channelId) => {
      if (!node) return;
      const ch = channels.get(channelId);
      const vol = ch?.volume ?? 0.75;
      const muted = masterMuted || !!ch?.effectiveMuted;
      try { node.gain.value = muted ? 0 : vol; } catch {}
    };

    try { this._bus.master.gain.value = masterMuted ? 0 : masterVolume; } catch {}
    applyGain(this._bus.pulso, 'pulse');
    applyGain(this._bus.start, 'start');
    applyGain(this._bus.seleccionados, 'accent');
    applyGain(this._bus.cycle, this._cycleChannelId);
    // F4: cada bus de veu segueix el seu canal de mixer.
    if (this._voiceBuses) {
      this._voiceBuses.forEach((bus, channelId) => applyGain(bus, channelId));
    }
    // Sense aquesta línia el fader/mute/solo del canal 'instrument' no
    // arriba mai al bus melòdic (piano/flauta). Per apps rítmiques sense
    // canal registrat, `?? 0.75` coincideix amb el default del bus.
    applyGain(this._bus.melodic, 'instrument');
  }

  _stopAllPlayers() {
    if (this._futureSources) this._futureSources.clear();
    if (!this._activeSources) return;
    for (const source of Array.from(this._activeSources)) {
      try { source.stop(0); } catch {}
      try { source.disconnect(); } catch {}
      this._activeSources.delete(source);
    }
  }

  // LA-04: stop manual sense clic — rampa els busos rítmics a 0 en ~40ms,
  // atura les fonts quan ja són inaudibles i llavors restaura els guanys
  // (mixer si en tenim estat; si no, els valors pre-fade). play() buida el
  // timer pendent perquè els fluxos stop()+play() immediats (resync de tap,
  // restart d'apps) no arrenquin amb busos a mig esvair.
  _fadeOutAndStopPlayers() {
    const ctx = this._ctx;
    const buses = [
      this._bus.pulso, this._bus.start, this._bus.seleccionados, this._bus.cycle,
      ...(this._voiceBuses ? this._voiceBuses.values() : []) // F4: veus també
    ].filter(Boolean);
    if (!ctx || ctx.state !== 'running' || !buses.length) {
      this._stopAllPlayers();
      return;
    }
    this._flushPendingStopFade();
    const now = ctx.currentTime;
    const prevGains = buses.map((bus) => bus.gain.value);
    for (const bus of buses) {
      try {
        bus.gain.cancelScheduledValues(now);
        bus.gain.setValueAtTime(bus.gain.value, now);
        bus.gain.linearRampToValueAtTime(0, now + 0.04);
      } catch {}
    }
    this._stopFadeRestore = () => this._restoreBusGains(buses, prevGains);
    this._stopFadeTimer = setTimeout(() => this._flushPendingStopFade(), 50);
  }

  _flushPendingStopFade() {
    if (this._stopFadeTimer == null) return;
    clearTimeout(this._stopFadeTimer);
    this._stopFadeTimer = null;
    this._stopAllPlayers();
    this._stopFadeRestore?.();
    this._stopFadeRestore = null;
  }

  _restoreBusGains(buses, prevGains) {
    // SEMPRE cancel·lar l'automatització ABANS de restaurar: mentre la
    // rampa del fade és activa, una assignació a .value és IGNORADA (Web
    // Audio: l'automatització mana) — la rampa acabava a 0 i als fluxos
    // stop()+play() del mateix tick (restart de startPlayback) tot
    // emmudia just després del primer pols. cancel + setValueAtTime
    // tanca la rampa; després l'estat del mixer ja pot escriure .value.
    const now = this._ctx?.currentTime ?? 0;
    buses.forEach((bus, i) => {
      try {
        bus.gain.cancelScheduledValues(now);
        bus.gain.setValueAtTime(prevGains[i], now);
      } catch {}
    });
    // I a sobre, l'estat viu del mixer (mute/volum poden haver canviat
    // durant la finestra del fade) — ara que no hi ha automatització,
    // les seves assignacions a .value s'apliquen de debò.
    if (this._pendingMixerState) {
      this._applyMixerState(this._pendingMixerState);
    }
  }

  // A-10: quan setTempo rebobina el scheduler per re-temporitzar la finestra
  // de lookahead, les fonts ja emeses per als passos invalidats seguirien
  // sonant a més de les còpies noves (flam/doble clic a cada canvi de tempo
  // en viu). Encara no han començat (viuen més enllà de l'àncora), així que
  // stop(0) les silencia abans que arrenquin.
  _cancelSourcesAfterStep(afterStep) {
    if (!this._futureSources?.size) return;
    for (const [step, sources] of Array.from(this._futureSources)) {
      if (step <= afterStep) continue;
      for (const source of sources) {
        try { source.stop(0); } catch {}
        try { source.disconnect(); } catch {}
        this._activeSources.delete(source);
      }
      this._futureSources.delete(step);
    }
  }

  /**
   * Escalfa el graf d'àudio reproduint un buffer silenciós d'1 sample a
   * través del bus master. Patró estàndard de Web Audio (iOS-unlock +
   * graph priming): força el context a processar render quanta des de
   * la inicialització, de manera que (1) la primera nota audible no es
   * perdi en un graf fred i (2) el rellotge del worklet ja estigui
   * estable quan arribi el primer `play()` (evita el "primer play
   * atropellat"). Idempotent i silenciós si el context no existeix.
   */
  _primeGraph() {
    try {
      const ctx = this._ctx;
      if (!ctx || typeof ctx.createBuffer !== 'function') return;
      const buffer = ctx.createBuffer(1, 1, ctx.sampleRate || 44100);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(this._bus?.master || ctx.destination);
      src.start();
    } catch {
      // Mock de test o navegador sense suport: ignorem.
    }
  }

  _refreshFallbackGain() {
    if (!this._ctx || !this._bus?.pulso) return;
    const hasPulseBuffer = this._buffers?.has('pulso') || this._buffers?.has('pulso0');
    if (!hasPulseBuffer) {
      if (!this._fallbackGain) {
        const g = this._ctx.createGain();
        g.gain.value = 1.0;
        g.connect(this._bus.pulso);
        this._fallbackGain = g;
      }
    } else if (this._fallbackGain) {
      try { this._fallbackGain.disconnect(); } catch {}
      this._fallbackGain = null;
    }
  }

  /**
   * Create a synthetic reverb impulse response buffer
   * Uses exponential decay noise to simulate room reverb
   * @param {AudioContext} ctx - The audio context
   * @param {number} duration - Reverb duration in seconds (default: 1.5)
   * @param {number} decay - Decay rate (higher = faster decay, default: 2)
   * @returns {AudioBuffer} The impulse response buffer
   */
  _createReverbImpulse(ctx, duration = 1.5, decay = 2) {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const impulse = ctx.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        // Exponential decay envelope applied to white noise
        const envelope = Math.pow(1 - i / length, decay);
        channelData[i] = (Math.random() * 2 - 1) * envelope;
      }
    }

    return impulse;
  }

  _resolveBusForSampleKey(key) {
    if (key === 'seleccionados') return this._bus.seleccionados;
    if (key === 'cycle') return this._bus.cycle;
    if (key === 'pulso0' || key === 'start') return this._bus.start;
    return this._bus.pulso;
  }

  // F4: bus de guany per a un canal de mixer de veu, creat lazy (el context
  // pot no existir quan arriba setVoices) i connectat al master amb el
  // mateix perfil stereo explícit que la resta de busos.
  _ensureVoiceBus(channelId) {
    if (!channelId || !this._ctx || !this._bus?.master) return null;
    let bus = this._voiceBuses.get(channelId);
    if (bus) return bus;
    try {
      bus = this._ctx.createGain();
      bus.gain.value = 0.75; // mateix default que la resta de canals
    } catch {
      return null;
    }
    try {
      bus.channelCount = 2;
      bus.channelCountMode = 'explicit';
      bus.channelInterpretation = 'speakers';
    } catch {
      // Mock de test
    }
    try { bus.connect(this._bus.master); } catch {}
    this._voiceBuses.set(channelId, bus);
    // Aplica l'estat viu del mixer (volum/mute del canal) al bus nou.
    if (this._pendingMixerState) {
      this._applyMixerState(this._pendingMixerState);
    }
    return bus;
  }

  /**
   * F4: re-apunta el canal de mixer que governa el bus de cicle (mute del
   * fallback inclòs). Per defecte 'subdivision'; les apps multi-fracció hi
   * posen el canal de la fracció principal. Additiu: sense cridar-lo, el
   * comportament és idèntic al d'abans.
   */
  setCycleChannel(channelId) {
    const id = (typeof channelId === 'string' && channelId) ? channelId : 'subdivision';
    if (id === this._cycleChannelId) return;
    this._cycleChannelId = id;
    if (this._pendingMixerState) {
      this._applyMixerState(this._pendingMixerState);
    }
  }

  /**
   * F4c: assigna un sample PROPI a un canal de mixer (override per canal).
   * Regla de precedència: override de canal > sample de ROL (setBase/
   * setAccent/setCycle — els selects dev del header continuen fixant els
   * DEFAULTS); la resolució es fa en temps d'agenda via
   * _resolveChannelBufferKey, així que el canvi s'aplica al lookahead
   * següent fins i tot en ple playback. `soundKey` null/'' elimina
   * l'override (el canal torna al rol). Additiu: sense cap crida el
   * comportament és byte-idèntic al d'abans.
   * Lazy: sense context encara (pre-gest) només es desa l'assignació;
   * _initPlayers carregarà el buffer quan el motor neixi.
   */
  async setChannelSound(channelId, soundKey) {
    if (typeof channelId !== 'string' || !channelId) return;
    const bufferKey = `channel:${channelId}`;
    if (soundKey == null || soundKey === '') {
      this._channelSounds.delete(channelId);
      this._buffers?.delete(bufferKey);
      return;
    }
    const { key: resolved, url } = normalizeSound(soundKey, null);
    if (!url) return;
    this._channelSounds.set(channelId, resolved);
    if (!this._ctx) return;
    try {
      const buffer = await loadBufferForContext(this._ctx, url);
      // Guarda anti-cursa: l'assignació pot haver canviat durant l'await
      // (l'usuari navega ràpid pel dropdown) — només mana l'última.
      if (buffer && this._channelSounds.get(channelId) === resolved && this._buffers) {
        this._buffers.set(bufferKey, { url, buffer });
      }
    } catch (error) {
      console.warn(`Failed to set channel sound ${soundKey} for ${channelId}`, error);
    }
  }

  getChannelSound(channelId) {
    return this._channelSounds?.get(channelId) ?? null;
  }

  // F4c: clau de buffer efectiva per a un canal de mixer en temps d'agenda.
  // Si el canal té override carregat → la seva clau 'channel:<id>'; si no
  // (o el buffer encara s'està descarregant) → la clau de ROL rebuda. Mai
  // retorna una clau sense buffer si roleKey en té: zero forats d'àudio.
  _resolveChannelBufferKey(channelId, roleKey) {
    if (channelId && this._channelSounds?.has(channelId)) {
      const key = `channel:${channelId}`;
      if (this._buffers?.has(key)) return key;
    }
    return roleKey;
  }

  _schedulePlayerStart(key, when, duration = null, absStep = null, destination = null) {
    if (!this._ctx || !this._buffers) return;
    const entry = this._buffers.get(key);
    if (!entry?.buffer) return;
    try {
      const ctx = this._ctx;
      const source = ctx.createBufferSource();
      source.buffer = entry.buffer;
      const bucket = Number.isFinite(absStep) ? absStep : null;
      source.onended = () => {
        this._activeSources.delete(source);
        if (bucket != null) {
          const sources = this._futureSources.get(bucket);
          if (sources) {
            sources.delete(source);
            if (!sources.size) this._futureSources.delete(bucket);
          }
        }
        try { source.disconnect(); } catch {}
      };
      const dest = destination || this._resolveBusForSampleKey(key) || this._bus.master;
      if (dest) source.connect(dest);
      const startTime = Math.max(ctx.currentTime, when);
      source.start(startTime);
      // Si se especifica duración, detener el sonido después de ese tiempo
      if (duration != null && duration > 0) {
        source.stop(startTime + duration);
      }
      this._activeSources.add(source);
      if (bucket != null) {
        let sources = this._futureSources.get(bucket);
        if (!sources) {
          sources = new Set();
          this._futureSources.set(bucket, sources);
        }
        sources.add(source);
      }
    } catch {}
  }

  async _setSound(key, soundKey, fallbackKey) {
    this._soundAssignments[key] = soundKey || fallbackKey || this._soundAssignments[key];
    if (!this._ctx) return;
    if (!this._buffers) this._buffers = new Map();
    const { key: resolved, url } = normalizeSound(this._soundAssignments[key], fallbackKey || this._defaultAssignments[key]);
    this._soundAssignments[key] = resolved;
    if (!url) {
      this._buffers.delete(key);
      return;
    }
    try {
      const buffer = await loadBufferForContext(this._ctx, url);
      if (buffer) this._buffers.set(key, { url, buffer });
    } catch (error) {
      console.warn(`Failed to set sound ${soundKey} for ${key}`, error);
    }
    this._refreshFallbackGain();
  }

  async setBase(key) {
    await this.ready();
    await this._setSound('pulso', key, this._defaultAssignments.pulso);
    await this._setSound('pulso0', key, this._defaultAssignments.pulso0);
  }

  async setAccent(key) {
    await this.ready();
    await this._setSound('seleccionados', key, this._defaultAssignments.seleccionados);
  }

  async setStart(key) {
    await this.ready();
    await this._setSound('start', key, this._defaultAssignments.start);
    await this._setSound('pulso0', key, this._defaultAssignments.pulso0);
  }

  async setCycle(key) {
    await this.ready();
    await this._setSound('cycle', key, this._defaultAssignments.cycle);
  }

  // Legacy API - delegates to Measure system for backwards compatibility
  setStartEnabled(enabled) {
    this._startEnabled = !!enabled;
    this._measureEnabled = !!enabled;
  }

  getStartEnabled() {
    return this._startEnabled;
  }

  // Measure/Compás system methods
  // Set which steps trigger the pulso0 sound (measure starts)
  setMeasureStarts(steps) {
    if (steps instanceof Set) {
      this._measureStarts = steps;
    } else if (Array.isArray(steps)) {
      this._measureStarts = new Set(steps);
    } else {
      this._measureStarts = new Set([0]);
    }
  }

  getMeasureStarts() {
    return this._measureStarts;
  }

  // Enable/disable measure sounds (P0 toggle)
  setMeasureEnabled(enabled) {
    this._measureEnabled = !!enabled;
  }

  getMeasureEnabled() {
    return this._measureEnabled;
  }

  // Configure measure from compás value: 0, compás, compás*2, etc.
  configureMeasure(compas, totalPulses) {
    if (!Number.isFinite(compas) || compas < 1) {
      this._measureStarts = new Set([0]);
      return;
    }
    const starts = new Set();
    for (let i = 0; i < totalPulses; i++) {
      if (i % compas === 0) starts.add(i);
    }
    this._measureStarts = starts;
  }

  async preview(soundKey) {
    const { url } = normalizeSound(soundKey, this._defaultAssignments.pulso);
    if (!url) return;
    await ensureAudio();
    try {
      // A-14: si el motor ja té context (sempre, un cop inicialitzat),
      // previsualitzem per un GainNode directe a ctx.destination — manté el
      // bypass del mixer (mutes no afecten el preview) sense pagar un segon
      // AudioContext persistent ni re-descodificar samples que el motor ja
      // té (la cache de buffers és per context). El context dedicat queda
      // només com a fallback pre-init.
      let ctx, destination;
      if (this._ctx) {
        ctx = this._ctx;
        if (!this._previewGain) {
          this._previewGain = ctx.createGain();
          this._previewGain.gain.value = 0.8;
          this._previewGain.connect(ctx.destination);
        }
        destination = this._previewGain;
      } else {
        ctx = await getPreviewContext();
        destination = previewGain || ctx.destination;
      }
      const buffer = await loadBufferForContext(ctx, url);
      if (!buffer) return;
      for (const src of Array.from(previewSources)) {
        try { src.stop(0); } catch {}
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.onended = () => {
        previewSources.delete(source);
        try { source.disconnect(); } catch {}
      };
      if (destination) source.connect(destination);
      const startTime = ctx.currentTime + 0.01;
      const stopTime = startTime + Math.max(0.05, buffer.duration + 0.05);
      source.start(startTime);
      source.stop(stopTime);
      previewSources.add(source);
    } catch (error) {
      console.warn('Failed to preview sound', error);
    }
  }

  /**
   * Play a sound through the master bus (affected by mixer controls)
   * Unlike preview(), this uses the main audio context and respects mute/volume
   * @param {string} soundKey - Sound key to play (e.g., 'click9')
   * @param {string} channel - Channel to use: 'pulse', 'accent', 'subdivision' (default: 'pulse')
   */
  async playSound(soundKey, channel = 'pulse') {
    await this._ensureContext();
    if (!this._ctx || !this._bus.master) return;

    const { url } = normalizeSound(soundKey, this._defaultAssignments.pulso);
    if (!url) return;

    try {
      const buffer = await loadBufferForContext(this._ctx, url);
      if (!buffer) return;

      const source = this._ctx.createBufferSource();
      source.buffer = buffer;

      // Route to appropriate bus based on channel
      let targetBus;
      switch (channel) {
        case 'accent':
          targetBus = this._bus.seleccionados;
          break;
        case 'subdivision':
          targetBus = this._bus.cycle;
          break;
        case 'pulse':
        default:
          targetBus = this._bus.pulso;
          break;
      }

      if (targetBus) {
        source.connect(targetBus);
      } else {
        source.connect(this._bus.master);
      }

      source.onended = () => {
        try { source.disconnect(); } catch {}
      };

      source.start(this._ctx.currentTime + 0.01);
    } catch (error) {
      console.warn('Failed to play sound:', error);
    }
  }

  setSelected(indices) {
    let resolution = 1;
    let values = indices;
    const isIterableSet = (candidate) => Array.isArray(candidate) || candidate instanceof Set;
    if (indices && typeof indices === 'object' && !(indices instanceof Set) && !Array.isArray(indices)) {
      const {
        values: providedValues,
        indices: providedIndices,
        steps,
        resolution: providedResolution
      } = indices;
      if (isIterableSet(providedValues)) {
        values = providedValues;
      } else if (isIterableSet(providedIndices)) {
        values = providedIndices;
      } else if (isIterableSet(steps)) {
        values = steps;
      }
      if (Number.isFinite(providedResolution) && providedResolution > 0) {
        resolution = Math.max(1, Math.round(providedResolution));
      }
    }
    // F4b: els valors poden ser números (legacy) o objectes { value, channel }.
    const { set, channels } = normalizeSelection(values);
    this.selectedRef = set;
    this._selectedChannels = channels;
    this._selectedResolution = resolution;
    this._adaptSchedulerInterval();
  }

  setLoop(enabled) {
    this.loopRef = !!enabled;
    this._node?.port?.postMessage({ action: 'setLoop', loop: this.loopRef });
  }

  setScheduling({ lookAhead, updateInterval, sampleOffset } = {}) {
    if (Number.isFinite(lookAhead) && lookAhead > 0) {
      this._lookAheadSec = clamp(lookAhead, 0.01, 0.5);
    }
    if (Number.isFinite(updateInterval) && updateInterval > 0) {
      this._schedulerOverrideSec = clamp(updateInterval, 0.005, 0.1);
    } else if (updateInterval === null) {
      this._schedulerOverrideSec = null;
    }
    if (Number.isFinite(sampleOffset) && sampleOffset >= 0) {
      this._sampleOffsetSec = clamp(sampleOffset, 0, 0.02);
    }
    this._adaptSchedulerInterval();
  }

  setSampleOffset(seconds) {
    if (Number.isFinite(seconds) && seconds >= 0) {
      this._sampleOffsetSec = clamp(seconds, 0, 0.02);
    }
  }

  setSchedulingProfile(profile) {
    const preset = SCHEDULING_PRESETS[profile] || SCHEDULING_PRESETS.balanced;
    this.setScheduling(preset);
  }

  setScheduleHandler(fn) {
    this._onScheduleRef = typeof fn === 'function' ? fn : null;
  }

  registerNoteProvider(id, fn) {
    if (typeof id === 'string' && typeof fn === 'function') {
      this._noteProviders.set(id, fn);
    }
  }

  removeNoteProvider(id) {
    this._noteProviders.delete(id);
  }

  getBaseResolution() {
    return Math.max(1, Math.round(this._baseResolution || 1));
  }

  setPulseEnabled(enabled) {
    mixer.setChannelMute('pulse', !enabled);
  }

  setCycleEnabled(enabled) {
    mixer.setChannelMute('subdivision', !enabled);
  }

  setMute(value) {
    setMute(value);
  }

  getMixer() {
    return mixer;
  }

  async play(totalPulses, intervalSec, selectedPulses, loop, onPulse, onComplete, options = {}) {
    // LA-04: si un stop() amb fade encara té el timer pendent, resol-lo ARA
    // (fonts fora + guanys restaurats) perquè aquest play no arrenqui amb
    // els busos a mig esvair.
    this._flushPendingStopFade();
    await this._ensureContext();

    this.totalRef = Math.max(1, +totalPulses || 1);
    this.intervalRef = Math.max(1e-6, +intervalSec || 0.5);
    this.loopRef = !!loop;
    let selectionValues = selectedPulses;
    let selectionResolution = this._selectedResolution || 1;
    const isIterableSet = (candidate) => Array.isArray(candidate) || candidate instanceof Set;
    if (selectedPulses && typeof selectedPulses === 'object' && !(selectedPulses instanceof Set) && !Array.isArray(selectedPulses)) {
      const {
        values: providedValues,
        indices: providedIndices,
        steps,
        resolution: providedResolution
      } = selectedPulses;
      if (isIterableSet(providedValues)) {
        selectionValues = providedValues;
      } else if (isIterableSet(providedIndices)) {
        selectionValues = providedIndices;
      } else if (isIterableSet(steps)) {
        selectionValues = steps;
      }
      if (Number.isFinite(providedResolution) && providedResolution > 0) {
        selectionResolution = Math.max(1, Math.round(providedResolution));
      }
    }
    // F4b: mateix contracte que setSelected — números legacy o objectes
    // { value, channel } amb canal de mixer propi.
    const normalizedSelection = normalizeSelection(selectionValues);
    this.selectedRef = normalizedSelection.set;
    this._selectedChannels = normalizedSelection.channels;
    this._selectedResolution = selectionResolution;
    this._onPulseRef = (typeof onPulse === 'function') ? onPulse : null;
    if (typeof options?.onSchedule === 'function') {
      this._onScheduleRef = options.onSchedule;
    }
    this.onCompleteRef = (typeof onComplete === 'function') ? onComplete : null;
    this._pulseCounter = -1;
    this._lastAbsoluteStep = null;
    this._lastCycleState = null;
    // A-05: desenganxa la comptabilitat del lookahead de la sessió ANTERIOR.
    // En un stop() graceful (final natural) _futureSources no es buida
    // expressament (les cues acaben de sonar); però els seus passos absoluts
    // no porten marca de sessió, i un restart immediat + setTempo les
    // tallava en sec via _cancelSourcesAfterStep. clear() les DESENGANXA
    // sense tallar-les (l'onended té guard `if (sources)`). Guard isPlaying:
    // si algú crida play() amb so en marxa, no desenganxem fonts vives del
    // cancel·lador d'A-10 (aquell camí conserva el comportament d'avui).
    if (!this.isPlaying) this._futureSources?.clear();
    // Nova seqüència: encara no ha acabat de forma natural.
    this._endedNaturally = false;

    const resolutionOpt = Number.isFinite(options?.baseResolution)
      ? options.baseResolution
      : Number.isFinite(options?.resolution)
        ? options.resolution
        : 1;
    const normalizedResolution = Math.max(1, Math.round(resolutionOpt || 1));
    this._baseResolution = normalizedResolution;
    this.baseResolution = normalizedResolution;

    const cyc = options?.cycle;
    if (cyc && Number.isFinite(+cyc.numerator) && Number.isFinite(+cyc.denominator)) {
      const handler = (typeof cyc.onTick === 'function')
        ? cyc.onTick
        : (typeof cyc.onCycle === 'function')
          ? cyc.onCycle
          : null;
      this._cycleConfig = {
        numerator: +cyc.numerator,
        denominator: +cyc.denominator,
        onCycle: handler
      };
    } else {
      this._cycleConfig = null;
    }

    const patternOpt = Number.isFinite(options?.patternBeats) && options.patternBeats > 0
      ? +options.patternBeats
      : null;
    if (patternOpt != null) {
      this._patternBeats = patternOpt;
    } else if (!(Number.isFinite(this._patternBeats) && this._patternBeats > 0)) {
      this._patternBeats = null;
    }

    const effectivePattern = Number.isFinite(this._patternBeats) && this._patternBeats > 0
      ? this._patternBeats
      : this.totalRef;

    this._node.port.postMessage({
      action: 'start',
      total: this.totalRef,
      interval: this.intervalRef,
      loop: this.loopRef,
      numerator: this._cycleConfig?.numerator || 0,
      denominator: this._cycleConfig?.denominator || 0,
      pattern: effectivePattern
    });

    this._startScheduler();
    this.isPlaying = true;
    this.resetTapTempo();
    this._pendingTempo = null;
    this._adaptSchedulerInterval();

    // Trigger gamification hook for play start
    if (this._gamificationHooks?.onPlayStart) {
      try {
        this._gamificationHooks.onPlayStart({
          totalPulses: this.totalRef,
          intervalSec: this.intervalRef,
          selectedCount: this.selectedRef.size,
          loop: this.loopRef,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('Gamification hook error:', error);
      }
    }
  }

  stop(opts = {}) {
    if (!this._ctx) return;

    // graceful: final natural → deixem que els sons ja programats acabin
    // la seva cua en lloc de tallar-los. Es pot forçar amb opts.graceful;
    // si no, s'infereix del flag _endedNaturally (posat al 'done' del worklet).
    const graceful = opts.graceful ?? this._endedNaturally;
    this._endedNaturally = false;

    // Capture timing info before clearing
    const wasPlaying = this.isPlaying;
    const pulseCount = this._pulseCounter;

    this.isPlaying = false;
    this._onPulseRef = null;
    this._onScheduleRef = null;
    this._noteProviders.clear();
    this.onCompleteRef = null;
    this._scheduledTimes.clear();

    if (this._schedulerId != null) {
      clearInterval(this._schedulerId);
      this._schedulerId = null;
    }
    this._node?.port?.postMessage({ action: 'stop' });
    // Tall dels BufferSources rítmics només si NO és final natural.
    // En final natural, els sources ja programats acaben el seu buffer i
    // s'auto-netegen via source.onended (cap clic, cap tall sec).
    // LA-04: el tall manual esvaeix els busos ~40ms abans d'aturar les
    // fonts — source.stop(0) a mig buffer feia clic audible.
    if (!graceful) {
      this._fadeOutAndStopPlayers();
    }
    this._lastStep = null;
    this._lastPulseTime = null;
    this._lastAbsoluteStep = null;
    this._zeroOffset = null;
    this._pulseCounter = -1;
    this._lastCycleState = null;
    this.resetTapTempo();
    this._pendingTempo = null;
    this._setScheduledStep = null;
    this._tickFn = null;

    // Trigger gamification hook for stop
    if (wasPlaying && this._gamificationHooks?.onPlayStop) {
      try {
        this._gamificationHooks.onPlayStop({
          pulsesPlayed: Math.max(0, pulseCount + 1),
          totalPulses: this.totalRef,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('Gamification hook error:', error);
      }
    }
  }

  setTempo(bpm, opts = {}) {
    if (!Number.isFinite(+bpm) || bpm <= 0) return;
    const requestedAlign = typeof opts.align === 'string' ? opts.align : 'nextPulse';
    const align = (requestedAlign === 'immediate' || requestedAlign === 'cycle')
      ? requestedAlign
      : 'nextPulse';
    const rampMs = Number.isFinite(opts.rampMs) ? Math.max(0, +opts.rampMs) : 80;
    const interval = 60 / Math.max(1e-6, +bpm || 120);

    if (!this.isPlaying || align === 'immediate') {
      this.intervalRef = interval;
      this._pendingTempo = null;
    } else {
      this._pendingTempo = this._computePendingTempo({ interval, align });
      if (typeof this._setScheduledStep === 'function') {
        const baseStep = Number.isFinite(this._lastAbsoluteStep) ? this._lastAbsoluteStep : -1;
        this._setScheduledStep(baseStep);
      }
    }

    this._node?.port?.postMessage({ action: 'setTempo', bpm: +bpm, interval, align, rampMs });
  }

  setTotal(totalPulses) {
    this.totalRef = Math.max(1, +totalPulses || 1);
    this._node?.port?.postMessage({ action: 'updateTotal', total: this.totalRef });
  }

  setPattern(patternBeats) {
    const pattern = Number.isFinite(+patternBeats) && +patternBeats > 0 ? +patternBeats : null;
    this._patternBeats = pattern != null ? pattern : null;
    const payload = pattern != null ? pattern : 0;
    this._node?.port?.postMessage({ action: 'updatePattern', pattern: payload });
  }

  updateCycleConfig({ numerator, denominator, onTick, onCycle } = {}) {
    const handler = (typeof onTick === 'function') ? onTick
                  : (typeof onCycle === 'function') ? onCycle
                  : (this._cycleConfig?.onCycle || null);

    const n = Number.isFinite(+numerator) ? Math.max(0, +numerator) : (this._cycleConfig?.numerator || 0);
    const d = Number.isFinite(+denominator) ? Math.max(0, +denominator) : (this._cycleConfig?.denominator || 0);

    this._cycleConfig = { numerator: n, denominator: d, onCycle: handler };
    this._node?.port?.postMessage({ action: 'updateCycle', numerator: n, denominator: d });
  }

  getVisualState() {
    if (this._lastStep == null) return null;
    const state = { step: this._lastStep };
    if (this._lastCycleState && Number.isFinite(this._lastCycleState.cycleIndex) && Number.isFinite(this._lastCycleState.subdivisionIndex)) {
      state.cycle = { ...this._lastCycleState };
    }
    return state;
  }

  updateTransport({ totalPulses, bpm, cycle, patternBeats, baseResolution, align = 'nextPulse', rampMs = 80 } = {}) {
    if (Number.isFinite(+totalPulses) && +totalPulses > 0) {
      this.setTotal(+totalPulses);
    }
    if (Number.isFinite(+bpm) && +bpm > 0) {
      this.setTempo(+bpm, { align, rampMs });
    }
    if (Number.isFinite(+baseResolution) && +baseResolution > 0) {
      const normalizedResolution = Math.max(1, Math.round(+baseResolution));
      if (normalizedResolution !== this._baseResolution) {
        this._baseResolution = normalizedResolution;
        this.baseResolution = normalizedResolution;
      }
    }
    if (Number.isFinite(+patternBeats) && +patternBeats > 0) {
      this.setPattern(+patternBeats);
    }
    if (cycle && typeof cycle === 'object') {
      const payload = {
        numerator: Number.isFinite(+cycle.numerator) ? +cycle.numerator : null,
        denominator: Number.isFinite(+cycle.denominator) ? +cycle.denominator : null,
        onTick: cycle.onTick,
        onCycle: cycle.onCycle
      };
      this.updateCycleConfig(payload);
    }
  }

  setVoices(voices = []) {
    const map = new Map();
    const workletVoices = [];
    if (Array.isArray(voices)) {
      voices.forEach((voice) => {
        if (!voice || !voice.id) return;
        const numerator = Number(voice.numerator);
        const denominator = Number(voice.denominator);
        map.set(voice.id, {
          numerator: Number.isFinite(numerator) ? numerator : null,
          denominator: Number.isFinite(denominator) ? denominator : null,
          // F4: canal de mixer propi → l'àudio s'agenda al lookahead
          // (_scheduleVoiceAudio) en lloc del camí reactiu legacy.
          channel: (typeof voice.channel === 'string' && voice.channel) ? voice.channel : null
        });
        // El worklet només necessita id + raó (camps extra fora).
        workletVoices.push({ id: voice.id, numerator: voice.numerator, denominator: voice.denominator });
      });
    }
    this._voiceDefs = map;
    this._node?.port?.postMessage({ action: 'setVoices', voices: workletVoices });
    this._adaptSchedulerInterval();
  }

  setVoiceHandler(handler) {
    this._onVoiceRef = (typeof handler === 'function') ? handler : null;
  }

  addVoice(voice) {
    if (voice && voice.id) {
      const numerator = Number(voice.numerator);
      const denominator = Number(voice.denominator);
      this._voiceDefs.set(voice.id, {
        numerator: Number.isFinite(numerator) ? numerator : null,
        denominator: Number.isFinite(denominator) ? denominator : null,
        channel: (typeof voice.channel === 'string' && voice.channel) ? voice.channel : null
      });
      this._node?.port?.postMessage({
        action: 'addVoice',
        voice: { id: voice.id, numerator: voice.numerator, denominator: voice.denominator }
      });
      this._adaptSchedulerInterval();
    }
  }

  removeVoice(id) {
    if (id) {
      this._voiceDefs.delete(id);
      this._node?.port?.postMessage({ action: 'removeVoice', id });
    }
  }

  // H-15 (auditoria 2026-07-06): el paràmetre `requestedSampleRate` s'ha
  // ELIMINAT. La seva branca creava un AudioContext sense esperar el gest
  // d'usuari, amb qualsevol sample rate (violava el pin 44100) i abandonava
  // el context anterior sense close() (classe de bug LA-02). Cap caller el
  // passava (la fila Sample Rate del menú de rendiment es va retirar
  // expressament — vegeu performance-audio-menu.js:10-13). El camp es manté
  // al retorn (sempre null) per estabilitat de forma.
  async configurePerformance({ scheduleHorizonMs, sampleOffsetMs } = {}) {
    if (Number.isFinite(+scheduleHorizonMs)) {
      this._lookAheadSec = clamp(+scheduleHorizonMs / 1000, 0.02, 0.4);
      this._adaptSchedulerInterval();
    }
    if (Number.isFinite(+sampleOffsetMs) && +sampleOffsetMs >= 0) {
      this._sampleOffsetSec = clamp(+sampleOffsetMs / 1000, 0, 0.02);
    }
    return {
      requestedSampleRate: null,
      actualSampleRate: this._ctx ? this._ctx.sampleRate : null,
      scheduleHorizonMs: Math.round(this._lookAheadSec * 1000),
      schedulerIntervalMs: Math.round(this._schedulerEverySec * 1000),
      sampleOffsetMs: Math.round(this._sampleOffsetSec * 1000 * 10) / 10
    };
  }

  _startScheduler() {
    if (!this._ctx) return;
    const ctx = this._ctx;
    const scheduleHorizon = () => ctx.currentTime + this._lookAheadSec;
    const clickDur = Math.max(0.01, this.intervalRef * 0.8);

    if (this._schedulerId != null) clearInterval(this._schedulerId);
    this._adaptSchedulerInterval();

    const triggerBeep = (when, freq = 1000, gain = 0.3, dur = clickDur) => {
      if (!this._fallbackGain || this._pulseMutedForFallback) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(freq, when);
      g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(gain, when + 0.002);
      g.gain.linearRampToValueAtTime(0, when + dur);
      o.connect(g).connect(this._fallbackGain);
      o.start(when);
      o.stop(when + dur + 0.01);
    };

    // Pas absolut que tick() està agendant ara mateix; triggerPlayer el
    // propaga perquè el rebobinat de setTempo pugui cancel·lar per pas.
    let schedulingStep = null;
    // F4b: destination opcional — un bus de canal de veu en lloc del bus
    // per defecte del sample (el rebobinat per pas absolut segueix igual).
    const triggerPlayer = (key, when, duration = null, destination = null) => {
      if (!this._buffers?.has(key)) return;
      this._schedulePlayerStart(key, when, duration, schedulingStep, destination);
    };

    this._stepTime = (absoluteStep) => {
      if (this._lastAbsoluteStep == null || this._lastPulseTime == null) return null;
      if (!Number.isFinite(absoluteStep)) return null;
      const baseStep = this._lastAbsoluteStep;
      if (absoluteStep <= baseStep) return this._lastPulseTime;

      const pending = this._pendingTempo;
      const hasPending = pending && Number.isFinite(pending.interval) && pending.interval > 0;
      let time = this._lastPulseTime;
      let currentInterval = this.intervalRef;

      for (let step = baseStep + 1; step <= absoluteStep; step++) {
        if (hasPending) {
          const threshold = pending.effectiveStep;
          if (Number.isFinite(threshold) && (step - 1) >= threshold) {
            currentInterval = pending.interval;
          }
        }
        time += currentInterval;
      }
      return time;
    };

    let scheduledStep = this._lastAbsoluteStep ?? -1;
    this._setScheduledStep = (value) => {
      const target = Number.isFinite(value) ? value : (this._lastAbsoluteStep ?? -1);
      if (target < scheduledStep) {
        // A-10: el rebobinat farà que tick() re-agendi els passos > target
        // amb el nou interval; sense cancel·lar primer les fonts antigues
        // sonarien dues còpies de cada pas del lookahead.
        this._cancelSourcesAfterStep(target);
        if (this._noteProviders?.size > 0 || typeof this._onScheduleRef === 'function') {
          this._cancelScheduledNotes?.();
        }
      }
      scheduledStep = target;
    };

    // A-03: els sons de cicle s'agenden al lookahead, no al missatge del
    // worklet. Les subdivisions són deterministes (numerator/denominator/
    // pattern), així que es poden pre-agendar amb la mateixa finestra que
    // els polsos base; el camí reactiu arribava TARD per als beats
    // fraccionaris (agafava el temps del pols anterior, ja al passat).
    // La fórmula replica _recomputeCycleEvents del worklet exactament.
    let cycleBeatsKey = null;
    let cycleBeatsList = [];
    const cycleEventBeats = () => {
      const num = +(this._cycleConfig?.numerator) || 0;
      const den = +(this._cycleConfig?.denominator) || 0;
      const total = (Number.isFinite(this._patternBeats) && this._patternBeats > 0)
        ? this._patternBeats
        : this.totalRef;
      const key = `${num}/${den}/${total}`;
      if (key === cycleBeatsKey) return cycleBeatsList;
      cycleBeatsKey = key;
      cycleBeatsList = [];
      if (num > 0 && den > 0 && total > 0) {
        const cycles = Math.floor(total / num);
        const subBeats = num / den;
        for (let ci = 0; ci < cycles; ci++) {
          for (let s = 0; s < den; s++) {
            const beat = ci * num + s * subBeats;
            if (beat < total) cycleBeatsList.push(beat);
          }
        }
      }
      return cycleBeatsList;
    };

    const tick = () => {
      if (!this.isPlaying) return;
      const horizon = scheduleHorizon();

      const intv = this.intervalRef;
      if (intv <= 0) return;

      const baseStep = (this._lastAbsoluteStep != null) ? this._lastAbsoluteStep : null;
      if (baseStep == null) return;
      let n = Math.max(baseStep, scheduledStep + 1);

      while (true) {
        // Single-shot playback: do not pre-schedule beyond the final step.
        // _resolveStepIndex would wrap n → 0, and the worklet's 'done' message
        // can race with the tick's look-ahead, producing an extra pulse at the
        // wrapped index before stop() propagates.
        if (!this.loopRef && this.totalRef > 0 && n >= this.totalRef) break;

        const when = this._stepTime(n);
        if (when == null || when > horizon) break;

        const stepIndex = this._resolveStepIndex(n);
        schedulingStep = n;

        // Store scheduled time for this step (used by onPulse callback for sample-accurate timing)
        this._scheduledTimes.set(stepIndex, when);

        // Proactive instrument scheduling: fire onSchedule with the same future time as samples
        if (typeof this._onScheduleRef === 'function') {
          this._onScheduleRef(stepIndex, when);
        }

        // Declarative note providers: engine-managed instrument scheduling
        if (this._noteProviders.size > 0) {
          for (const [, provider] of this._noteProviders) {
            const notes = provider(stepIndex);
            if (notes && notes.length) {
              for (const note of notes) {
                if (typeof this._playScheduledNote === 'function') {
                  this._playScheduledNote(note.midi, note.duration, when, note.velocity);
                }
              }
            }
          }
        }

        // Measure system: check if this step is a measure start (compás beginning)
        const isMeasureStart = this._measureStarts?.has(stepIndex) ?? (stepIndex === 0);
        const resolution = Math.max(1, Math.round(this._baseResolution || 1));
        const isBaseStep = Number.isFinite(stepIndex) && (resolution <= 1 || (stepIndex % resolution === 0));
        const selectionResolution = Math.max(1, Math.round(this._selectedResolution || 1));
        const selectionIndex = selectionResolution === 1
          ? stepIndex
          : Math.round(stepIndex * selectionResolution);
        const isSelected = this.selectedRef.has(selectionIndex);

        let triggered = false;
        // Apply sample offset to compensate for instrument callback latency
        const sampleWhen = when + this._sampleOffsetSec;
        if (this._buffers && this._buffers.size) {
          const baseKey = (() => {
            if (!this._buffers || this._buffers.size === 0 || this._pulseMutedForFallback) return null;
            if (this._buffers.has('pulso')) return 'pulso';
            if (this._buffers.has('pulso0')) return 'pulso0';
            return null;
          })();

          // Play base pulse sound on ALL base steps (including step 0)
          if (baseKey && isBaseStep) {
            // F4c: l'override del canal 'pulse' (setChannelSound) guanya
            // sobre el sample de rol; el bus segueix sent el de pols
            // (destination explícit perquè _resolveBusForSampleKey no
            // coneix les claus 'channel:*').
            const pulseKey = this._resolveChannelBufferKey('pulse', baseKey);
            triggerPlayer(pulseKey, sampleWhen, null, pulseKey === baseKey ? null : this._bus.pulso);
            triggered = true;
          }

          // Measure/P0: If measureEnabled, play ADDITIONAL special pulse0 sound on measure starts
          // This sound is ADDED to the base pulse, not replacing it
          if (isMeasureStart && this._measureEnabled && this._buffers.has('pulso0')) {
            triggerPlayer('pulso0', sampleWhen);
            triggered = true;
          }

          if (isSelected && this._buffers.has('seleccionados')) {
            // Sense duration: cap canal rítmic talla el seu sample. Cada
            // tret és un BufferSource independent (polifonia real), així
            // que la cua de l'accent ringa sencera encara que el següent
            // pols/subdivisió comenci abans que acabi. (La truncadura a
            // 1 interval venia de l'època del click11/Ruido Rosa i feia
            // que l'accent "es tallés" amb el pols següent.)
            // F4b: una selecció amb canal de mixer propi (objecte
            // { value, channel } a setSelected) surt pel bus del seu canal
            // — mateix sample 'seleccionados', bus diferent. Cada valor
            // sona per EXACTAMENT un bus. Canal silenciat al mixer → no
            // s'agenda cap font (paritat amb _scheduleVoiceAudio), però
            // triggered queda a true perquè el beep de fallback no
            // "supleixi" un canal mutat expressament.
            // F4c: el sample efectiu pot ser l'override del canal de la
            // selecció ('accent' per als números legacy, fracSelN per a les
            // etiquetades) — _resolveChannelBufferKey cau al rol
            // 'seleccionados' si no n'hi ha.
            const selectedChannel = this._selectedChannels?.get(selectionIndex) || null;
            const selKey = this._resolveChannelBufferKey(selectedChannel || 'accent', 'seleccionados');
            if (!selectedChannel) {
              triggerPlayer(selKey, sampleWhen, null, selKey === 'seleccionados' ? null : this._bus.seleccionados);
            } else if (!this._mixerChannelMuted?.get(selectedChannel)) {
              // Si el bus no es pot crear (context a mig morir), destination
              // null fa caure _schedulePlayerStart al bus legacy: mai zero
              // ni dos busos per a un mateix valor.
              triggerPlayer(selKey, sampleWhen, null, this._ensureVoiceBus(selectedChannel));
            }
            triggered = true;
          }
        }

        // Fallback beep: Play on all base steps (including step 0) or selected steps
        if (!triggered && !this._pulseMutedForFallback) {
          if (isSelected) {
            // Always beep for selected steps
            triggerBeep(sampleWhen, 1100);
          } else if (isBaseStep) {
            // Beep for all base steps (including step 0)
            triggerBeep(sampleWhen, 900);
          }
        }

        // Durada real del segment [n, n+1): incorpora canvis de tempo
        // pendents via _stepTime. La comparteixen els sons de cicle i les
        // veus amb canal propi (F4).
        const nextWhen = this._stepTime(n + 1);
        const segDur = Number.isFinite(nextWhen) ? (nextWhen - when) : intv;

        // Sons de cicle del segment [stepIndex, stepIndex+1): pre-agendats
        // amb el temps fraccionari exacte (interval real del segment).
        // F4c: el canal que governa el cicle (_cycleChannelId, p.ex. fracN
        // a App4) pot dur sample propi — override sobre el rol 'cycle'.
        if (!this._cycleMutedForFallback && this._buffers?.has('cycle')) {
          const beats = cycleEventBeats();
          if (beats.length) {
            const cycleKey = this._resolveChannelBufferKey(this._cycleChannelId, 'cycle');
            const cycleDest = cycleKey === 'cycle' ? null : this._bus.cycle;
            for (const beat of beats) {
              if (beat >= stepIndex && beat < stepIndex + 1) {
                triggerPlayer(cycleKey, sampleWhen + (beat - stepIndex) * segDur, null, cycleDest);
              }
            }
          }
        }

        // F4: àudio de les veus polirítmiques amb canal de mixer propi —
        // mateix patró de pre-agenda del lookahead que els sons de cicle.
        this._scheduleVoiceAudio({ stepIndex, sampleWhen, segDur, absStep: n });

        scheduledStep = n;
        n++;
      }
      schedulingStep = null;
    };

    // A-04: el handler del missatge 'pulse' invoca tick() directament via
    // _tickFn (MessagePort no throttlejable); el setInterval és el backup.
    this._tickFn = tick;
    this._schedulerId = setInterval(tick, Math.round(this._schedulerEverySec * 1000));
  }

  _resolveStepIndex(absoluteStep) {
    const total = this.totalRef > 0 ? this.totalRef : 0;
    if (!total || !Number.isFinite(absoluteStep)) {
      return Number.isFinite(absoluteStep) ? absoluteStep : 0;
    }
    const offset = Number.isFinite(this._zeroOffset) ? this._zeroOffset : 0;
    const relative = absoluteStep - offset;
    const mod = ((relative % total) + total) % total;
    return mod;
  }

  /**
   * F4: pre-agenda l'àudio de les veus polirítmiques que porten canal de
   * mixer propi (def.channel). Mateix mecanisme que els sons de cicle
   * (A-03): esdeveniments deterministes (múltiples del període n/d) dins
   * del segment [stepIndex, stepIndex+1), amb el sample 'cycle' i el temps
   * fraccionari exacte. Es calcula en espai de mesura (stepIndex, que
   * embolcalla amb el loop): si el període divideix el patró — el model
   * d'App4 ho garanteix (Lg = mcm de numeradors × m) — coincideix amb el
   * comptador free-running del worklet a cada volta.
   * Les veus SENSE channel conserven el camí reactiu legacy ('seleccionados'
   * a _handleClockMessage) i no passen per aquí.
   */
  _scheduleVoiceAudio({ stepIndex, sampleWhen, segDur, absStep }) {
    if (!this._voiceDefs?.size) return;
    if (!this._buffers?.has('cycle')) return;
    // Mateix límit que cycleEventBeats: cap so de subdivisió al pols final
    // (totalRef = patternBeats + 1 en reproducció single-shot).
    const limit = (Number.isFinite(this._patternBeats) && this._patternBeats > 0)
      ? this._patternBeats
      : this.totalRef;
    for (const def of this._voiceDefs.values()) {
      const channel = def?.channel;
      if (!channel) continue;
      if (this._mixerChannelMuted?.get(channel)) continue;
      const num = Number(def.numerator);
      const den = Number(def.denominator);
      if (!(num > 0 && den > 0)) continue;
      const period = num / den;
      const bus = this._ensureVoiceBus(channel);
      if (!bus) continue;
      // F4c: sample propi del canal de la veu (override) o rol 'cycle'.
      const voiceKey = this._resolveChannelBufferKey(channel, 'cycle');
      // Primer múltiple del període dins del segment. Epsilon 1e-9 (el
      // mateix conveni que el worklet i els sons de cicle): l'esdeveniment
      // a la frontera pertany exactament a un segment, mai a tots dos.
      let k = Math.ceil((stepIndex - 1e-9) / period);
      for (;;) {
        const beat = k * period;
        if (beat >= stepIndex + 1 - 1e-9) break;
        if (!(limit > 0) || beat < limit - 1e-9) {
          this._schedulePlayerStart(
            voiceKey,
            sampleWhen + (beat - stepIndex) * segDur,
            null,
            absStep,
            bus
          );
        }
        k += 1;
      }
    }
  }

  _adaptSchedulerInterval() {
    if (this._schedulerOverrideSec != null) {
      this._schedulerEverySec = this._schedulerOverrideSec;
      return;
    }
    const streams =
      1 + (this.selectedRef.size > 0 ? 1 : 0) +
      (this._cycleConfig?.denominator ? 1 : 0) +
      (this._voiceDefs?.size ? 1 : 0); // F4: veus actives = un flux més
    const ms = clamp(20 - (streams - 1) * 3, 10, 30);
    this._schedulerEverySec = ms / 1000;
  }

  _handleClockMessage(msg) {
    const now = this._ctx?.currentTime ?? 0;
    if (msg.type === 'pulse') {
      this._lastStep = msg.step;
      this._pulseCounter = (this._pulseCounter ?? -1) + 1;
      this._lastAbsoluteStep = this._pulseCounter;
      // Àncora sample-accurate: temps d'àudio exacte del pols segons el
      // worklet; l'arribada del missatge (now) només com a fallback — porta
      // latència de MessagePort + jank del fil principal.
      this._lastPulseTime = Number.isFinite(msg.time) ? msg.time : now;
      if (Number.isFinite(this._lastAbsoluteStep) && Number.isFinite(this._lastStep)) {
        this._zeroOffset = this._lastAbsoluteStep - this._lastStep;
      }
      if (Number.isFinite(msg.interval)) {
        this.intervalRef = msg.interval;
      }
      this._evaluatePendingTempo();
      // A-04: omplir el lookahead AQUÍ, no esperar el proper setInterval.
      // El MessagePort no es throttleja mai: (1) el primer pols sona al
      // moment (abans esperava fins a _schedulerEverySec després del
      // missatge), i (2) en pestanyes en segon pla (setInterval clavat a
      // ≥1s) l'agenda no es mor de gana. El setInterval queda com a xarxa
      // de seguretat. Abans del callback onPulse perquè _scheduledTimes
      // ja tingui el temps exacte d'aquest pas.
      this._tickFn?.();
      if (typeof this._onPulseRef === 'function') {
        // Pass the scheduled time (when) as second parameter for sample-accurate timing
        // Falls back to current time if not available (backwards compatible)
        const scheduledTime = this._scheduledTimes.get(msg.step) ?? now;
        this._onPulseRef(msg.step, scheduledTime);
      }
    } else if (msg.type === 'cycle') {
      if (msg.payload && typeof msg.payload === 'object') {
        this._lastCycleState = {
          cycleIndex: Number(msg.payload.cycleIndex),
          subdivisionIndex: Number(msg.payload.subdivisionIndex),
          numerator: Number(msg.payload.numerator),
          denominator: Number(msg.payload.denominator),
          totalCycles: Number(msg.payload.totalCycles),
          totalSubdivisions: Number(msg.payload.totalSubdivisions)
        };
      }
      if (this._cycleConfig?.onCycle) this._cycleConfig.onCycle(msg.payload);
      // L'ÀUDIO del cicle s'agenda per avançat al tick() del lookahead
      // (cycleEventBeats); aquest missatge només condueix la part visual.
    } else if (msg.type === 'voice') {
      const payload = { id: msg.id, index: msg.index };
      if (typeof this._onVoiceRef === 'function') {
        this._onVoiceRef(payload);
      }
      const def = payload.id ? this._voiceDefs?.get(payload.id) : null;
      // F4: les veus amb canal propi ja sonen pel lookahead
      // (_scheduleVoiceAudio) — el fallback reactiu només per a la resta.
      if (def && !def.channel && this._buffers?.has('seleccionados')) {
        const numerator = Number(def.numerator);
        const denominator = Number(def.denominator);
        const idx = Number(payload.index);
        if (Number.isFinite(numerator) && numerator > 0 && Number.isFinite(idx)) {
          const perCycle = Math.max(1, Number.isFinite(denominator) ? Math.floor(denominator) : 1);
          const cycleIndex = Math.floor(idx / perCycle);
          const subdivisionIndex = ((idx % perCycle) + perCycle) % perCycle;
          const fractionalStep = numerator * cycleIndex + (numerator / perCycle) * subdivisionIndex;
          if (Math.abs(fractionalStep - Math.round(fractionalStep)) > 1e-6) {
            // Àncora sample-accurate del worklet; el temps del pols anterior
            // només com a fallback (per a beats fraccionaris ja era al passat)
            const voiceTime = Number.isFinite(msg.time)
              ? msg.time
              : (this._scheduledTimes.get(this._lastStep) ?? (now + 0.001));
            this._schedulePlayerStart('seleccionados', voiceTime);
          }
        }
      }
    } else if (msg.type === 'done') {
      // Final natural de seqüència: marquem el flag perquè el stop() que
      // l'app cridi (directament o via onComplete) sigui graceful i deixi
      // sonar la cua de l'última nota.
      this._endedNaturally = true;
      // Call onComplete callback - app is responsible for calling stop() when ready
      // This allows apps to add delays to let the last pulse ring out
      if (typeof this.onCompleteRef === 'function') {
        this.onCompleteRef();
      } else {
        // No callback provided: stop immediately (backwards compatibility)
        this.stop();
      }
    }
  }

  _computePendingTempo({ interval, align }) {
    if (!Number.isFinite(interval) || interval <= 0) return null;
    if (!this.isPlaying) return null;

    const lastStep = Number.isFinite(this._lastAbsoluteStep) ? this._lastAbsoluteStep : null;
    if (align === 'nextPulse') {
      if (lastStep == null) return null;
      return {
        interval,
        align,
        effectiveStep: lastStep + 1
      };
    }

    if (align === 'cycle') {
      const numerator = Number.isFinite(this._cycleConfig?.numerator) ? this._cycleConfig.numerator : null;
      if (lastStep == null || !(numerator > 0)) {
        if (lastStep == null) return null;
        return {
          interval,
          align: 'nextPulse',
          effectiveStep: lastStep + 1
        };
      }
      let firstStep = Math.floor((lastStep + 1) / numerator) * numerator;
      if (firstStep <= lastStep) firstStep += numerator;
      const lastOldStep = firstStep - 1;
      return {
        interval,
        align,
        effectiveStep: lastOldStep
      };
    }

    return null;
  }

  _evaluatePendingTempo() {
    if (!this._pendingTempo) return;
    const pending = this._pendingTempo;
    if (!Number.isFinite(pending.interval) || pending.interval <= 0) {
      this._pendingTempo = null;
      return;
    }

    const absoluteStep = Number.isFinite(this._lastAbsoluteStep) ? this._lastAbsoluteStep : null;
    if (absoluteStep == null) return;
    if (Number.isFinite(pending.effectiveStep) && absoluteStep < pending.effectiveStep) {
      return;
    }

    const tolerance = Math.max(1e-6, pending.interval * 1e-3);
    if (Math.abs(this.intervalRef - pending.interval) <= tolerance) {
      this._pendingTempo = null;
    }
  }

  resetTapTempo() {
    this._tapTimes = [];
  }

  tapTempo(nowMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()), options = {}) {
    const maxInterval = Number.isFinite(options.windowMs) ? Math.max(0, options.windowMs) : this._tapWindowMs;
    const minTaps = Number.isFinite(options.minTaps) ? Math.max(2, options.minTaps) : this._tapMinCount;
    const maxHistory = Number.isFinite(options.maxHistory) ? Math.max(minTaps, options.maxHistory) : this._tapMaxHistory;

    const threshold = maxInterval;
    const filtered = [];
    for (const time of this._tapTimes) {
      if (nowMs - time <= threshold) filtered.push(time);
    }
    filtered.push(nowMs);
    while (filtered.length > maxHistory) filtered.shift();
    this._tapTimes = filtered;

    const taps = filtered.length;
    const remaining = Math.max(0, minTaps - taps);

    if (taps < 2) {
      return { bpm: null, taps, remaining, applied: false };
    }

    const intervals = [];
    for (let i = 1; i < filtered.length; i++) {
      intervals.push(filtered[i] - filtered[i - 1]);
    }
    if (!intervals.length) {
      return { bpm: null, taps, remaining, applied: false };
    }

    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const bpm = 60000 / Math.max(1, avg);

    const shouldApply = options.apply == null ? this.isPlaying : !!options.apply;
    let applied = false;
    if (shouldApply && Number.isFinite(bpm) && bpm > 0) {
      const align = options.align || 'nextPulse';
      const rampMs = Number.isFinite(options.rampMs) ? Math.max(0, options.rampMs) : 80;
      this.setTempo(bpm, { align, rampMs });
      applied = true;
    }

    return { bpm, taps, remaining, applied };
  }

  // ========== MASTER EFFECTS CHAIN CONTROL ==========

  /**
   * Enable or disable the master effects chain (EQ + Compressor + Limiter)
   * When disabled, audio goes directly from master to destination (bypass)
   * @param {boolean} enabled - Whether effects should be enabled
   */
  setEffectsEnabled(enabled) {
    if (!this._bus.master || !this._ctx) return;

    const wasEnabled = this._effectsEnabled;
    this._effectsEnabled = !!enabled;

    if (wasEnabled === this._effectsEnabled) return;

    try {
      if (enabled) {
        // Reconnect through effects chain
        this._bus.master.disconnect();
        this._bus.master.connect(this._bus.effects.eq);
      } else {
        // Bypass: connect master directly to destination
        this._bus.master.disconnect();
        this._bus.master.connect(this._ctx.destination);
      }
    } catch (err) {
      console.warn('Failed to toggle effects chain:', err);
    }
  }

  /**
   * Check if master effects chain is enabled
   * @returns {boolean}
   */
  getEffectsEnabled() {
    return this._effectsEnabled;
  }

  /**
   * Set compressor threshold
   * @param {number} db - Threshold in dB (typical range: -50 to 0)
   */
  setCompressorThreshold(db) {
    if (this._bus.effects?.compressor && Number.isFinite(db)) {
      this._bus.effects.compressor.threshold.value = db;
    }
  }

  /**
   * Set limiter threshold
   * @param {number} db - Threshold in dB (typical range: -10 to 0)
   */
  setLimiterThreshold(db) {
    if (this._bus.effects?.limiter && Number.isFinite(db)) {
      this._bus.effects.limiter.threshold.value = db;
    }
  }

  /**
   * Set reverb wet amount (dry/wet mix)
   * @param {number} wet - Wet amount 0-1 (0 = fully dry, 1 = fully wet)
   */
  setReverbWet(wet) {
    if (!this._bus.effects?.reverbDry || !this._bus.effects?.reverbWet) return;
    if (!Number.isFinite(wet)) return;

    const wetValue = Math.max(0, Math.min(1, wet));
    const dryValue = 1 - wetValue;

    this._reverbWetValue = wetValue;
    this._bus.effects.reverbDry.gain.value = dryValue;
    this._bus.effects.reverbWet.gain.value = wetValue;
  }

  /**
   * Get current effects parameters
   * @returns {Object|null} Current effects configuration
   */
  getEffectsConfig() {
    if (!this._bus.effects) return null;

    const { eq, compressor, limiter } = this._bus.effects;
    return {
      enabled: this._effectsEnabled,
      // Quick access for mixer knobs
      compressorThreshold: compressor.threshold.value,
      limiterThreshold: limiter.threshold.value,
      reverbWet: this._reverbWetValue ?? 0.18,
      // Detailed config
      eq: {
        type: eq.type,
        frequency: eq.frequency.value,
        gain: eq.gain.value
      },
      compressor: {
        threshold: compressor.threshold.value,
        knee: compressor.knee.value,
        ratio: compressor.ratio.value,
        attack: compressor.attack.value,
        release: compressor.release.value
      },
      limiter: {
        threshold: limiter.threshold.value,
        knee: limiter.knee.value,
        ratio: limiter.ratio.value,
        attack: limiter.attack.value,
        release: limiter.release.value
      }
    };
  }

  /**
   * Get the melodic channel GainNode for external instruments (piano, violin)
   * @returns {GainNode|null} The melodic channel GainNode or null if not initialized
   */
  getMelodicChannel() {
    return this._bus?.melodic || null;
  }

  /**
   * Set the volume of the melodic channel
   * @param {number} volume - Volume level (0 to 1)
   */
  setMelodicVolume(volume) {
    if (this._bus?.melodic && Number.isFinite(volume)) {
      this._bus.melodic.gain.value = Math.max(0, Math.min(1, volume));
    }
  }
}

export default TimelineAudio;
