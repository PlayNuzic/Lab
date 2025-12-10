import { loadSampleMap } from './sample-map.js';
import { AudioMixer } from './mixer.js';
import { waitForUserInteraction, hasUserInteracted } from './user-interaction.js';
import { ensureToneLoaded } from './tone-loader.js';

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
  click11: new URL('Click11.wav', SAMPLE_BASE_URL).href,
  click12: new URL('Click12.wav', SAMPLE_BASE_URL).href,
  click13: new URL('Click13.wav', SAMPLE_BASE_URL).href,
  click14: new URL('Click14.wav', SAMPLE_BASE_URL).href,
  click15: new URL('Click15.wav', SAMPLE_BASE_URL).href,
  click16: new URL('Click16.wav', SAMPLE_BASE_URL).href,
  click17: new URL('Click17.wav', SAMPLE_BASE_URL).href
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
  click11: 'Ruido Rosa',
  click12: 'Ruido Sintetizado 1',
  click13: 'Ruido Sintetizado 2',
  click14: 'Ruido Sintetizado 3',
  click15: 'Ruido Sintetizado 4',
  click16: 'Ruido Sintetizado 5',
  click17: 'Ruido Sintetizado 6'
};

const mixer = new AudioMixer({ masterLabel: 'Master' });
const PLAYER_KEYS = ['pulso', 'pulso0', 'seleccionados', 'start', 'cycle'];
let audioReadyPromise = null;
let toneStartPromise = null;
const workletModulePromises = new WeakMap();
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
          const ctx = new Ctor({ latencyHint: 'interactive' });
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
  desktop: { lookAhead: 0.02, updateInterval: 0.01 },
  balanced: { lookAhead: 0.03, updateInterval: 0.015 },
  mobile: { lookAhead: 0.06, updateInterval: 0.03 }
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

function decodeAudioBuffer(ctx, arrayBuffer) {
  if (!ctx || !arrayBuffer) return Promise.reject(new Error('AudioContext or buffer missing'));
  return new Promise((resolve, reject) => {
    try {
      const copy = arrayBuffer.slice ? arrayBuffer.slice(0) : arrayBuffer;
      const result = ctx.decodeAudioData(copy, resolve, reject);
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
    previewContext = new Ctor({ latencyHint: 'interactive' });
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

function toSet(indices) {
  if (indices instanceof Set) return new Set(indices);
  if (Array.isArray(indices)) return new Set(indices);
  if (indices == null) return new Set();
  return new Set(indices);
}

export class TimelineAudio {
  constructor() {
    this.isReady = false;
    this.isPlaying = false;

    this.totalRef = 0;
    this.intervalRef = 0;
    this.loopRef = true;

    // Gamification hooks
    this._gamificationHooks = null;

    this._onPulseRef = null;
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

    this.selectedRef = new Set();
    this._selectedResolution = 1;
    this._voiceDefs = new Map();
    this._baseResolution = 1;
    this.baseResolution = 1;

    this._ctx = null;
    this._node = null;
    this._schedulerId = null;
    this._lookAheadSec = 0.12;
    this._schedulerEverySec = 0.02;
    this._schedulerOverrideSec = null;

    this._bus = { master: null, pulso: null, start: null, seleccionados: null, cycle: null };

    this._sampleMap = null;

    this._fallbackGain = null;

    this._buffers = new Map();
    this._activeSources = new Set();

    this._tapTimes = [];
    this._tapWindowMs = 2000;
    this._tapMinCount = 3;
    this._tapMaxHistory = 8;

    this._pendingTempo = null;
    this._setScheduledStep = null;

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
      if (node) {
        try { node.disconnect(); } catch {}
      }
      this._bus[key] = null;
    });

    this._stopAllPlayers();
    if (this._buffers) this._buffers.clear();
    if (this._activeSources) this._activeSources.clear();
    if (this._fallbackGain) {
      try { this._fallbackGain.disconnect(); } catch {}
    }
    this._fallbackGain = null;
    this.isReady = false;
    this._lastAbsoluteStep = null;
    this._zeroOffset = null;
    this._pulseCounter = -1;
    this._lastCycleState = null;
    this._patternBeats = null;
    this._pendingTempo = null;
    this._setScheduledStep = null;
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
        ctx = new FallbackCtor({ latencyHint: 'interactive' });
      }

      if (!ctx || !isBaseAudioContext(ctx)) {
        if (!FallbackCtor) throw new Error('AudioContext not available');
        ctx = new FallbackCtor({ latencyHint: 'interactive' });
      }

      if (!ctx || !isBaseAudioContext(ctx) || typeof ctx.audioWorklet === 'undefined' ||
          typeof ctx.audioWorklet.addModule !== 'function') {
        throw new Error('AudioWorklet not available');
      }

      this._ctx = ctx;

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
      this._bus.pulso = ctx.createGain();
      this._bus.start = ctx.createGain();
      this._bus.seleccionados = ctx.createGain();
      this._bus.cycle = ctx.createGain();

      this._bus.pulso.connect(this._bus.master);
      this._bus.start.connect(this._bus.master);
      this._bus.seleccionados.connect(this._bus.master);
      this._bus.cycle.connect(this._bus.master);
      this._bus.master.connect(ctx.destination);

      await this._initPlayers();

      this._node.connect(this._bus.master);
      this._node.port.onmessage = (e) => this._handleClockMessage(e.data);

      this._refreshFallbackGain();

      if (this._pendingMixerState) {
        this._applyMixerState(this._pendingMixerState);
      }

      await tryResumeContext(ctx);

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
    const masterVolume = state.master?.volume ?? 1;

    this._pulseMutedForFallback = masterMuted || !!channels.get('pulse')?.effectiveMuted;
    this._cycleMutedForFallback = masterMuted || !!channels.get('subdivision')?.effectiveMuted;

    const applyGain = (node, channelId) => {
      if (!node) return;
      const ch = channels.get(channelId);
      const vol = ch?.volume ?? 1;
      const muted = masterMuted || !!ch?.effectiveMuted;
      try { node.gain.value = muted ? 0 : vol; } catch {}
    };

    try { this._bus.master.gain.value = masterMuted ? 0 : masterVolume; } catch {}
    applyGain(this._bus.pulso, 'pulse');
    applyGain(this._bus.start, 'start');
    applyGain(this._bus.seleccionados, 'accent');
    applyGain(this._bus.cycle, 'subdivision');
  }

  _stopAllPlayers() {
    if (!this._activeSources) return;
    for (const source of Array.from(this._activeSources)) {
      try { source.stop(0); } catch {}
      try { source.disconnect(); } catch {}
      this._activeSources.delete(source);
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

  _resolveBusForSampleKey(key) {
    if (key === 'seleccionados') return this._bus.seleccionados;
    if (key === 'cycle') return this._bus.cycle;
    if (key === 'pulso0' || key === 'start') return this._bus.start;
    return this._bus.pulso;
  }

  _schedulePlayerStart(key, when, duration = null) {
    if (!this._ctx || !this._buffers) return;
    const entry = this._buffers.get(key);
    if (!entry?.buffer) return;
    try {
      const ctx = this._ctx;
      const source = ctx.createBufferSource();
      source.buffer = entry.buffer;
      source.onended = () => {
        this._activeSources.delete(source);
        try { source.disconnect(); } catch {}
      };
      const destination = this._resolveBusForSampleKey(key) || this._bus.master;
      if (destination) source.connect(destination);
      const startTime = Math.max(ctx.currentTime, when);
      source.start(startTime);
      // Si se especifica duración, detener el sonido después de ese tiempo
      if (duration != null && duration > 0) {
        source.stop(startTime + duration);
      }
      this._activeSources.add(source);
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
      const ctx = await getPreviewContext();
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
      const destination = previewGain || ctx.destination;
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
    this.selectedRef = toSet(values);
    this._selectedResolution = resolution;
    this._adaptSchedulerInterval();
  }

  setLoop(enabled) {
    this.loopRef = !!enabled;
    this._node?.port?.postMessage({ action: 'setLoop', loop: this.loopRef });
  }

  setScheduling({ lookAhead, updateInterval } = {}) {
    if (Number.isFinite(lookAhead) && lookAhead > 0) {
      this._lookAheadSec = clamp(lookAhead, 0.01, 0.5);
    }
    if (Number.isFinite(updateInterval) && updateInterval > 0) {
      this._schedulerOverrideSec = clamp(updateInterval, 0.005, 0.1);
    } else if (updateInterval === null) {
      this._schedulerOverrideSec = null;
    }
    this._adaptSchedulerInterval();
  }

  setSchedulingProfile(profile) {
    const preset = SCHEDULING_PRESETS[profile] || SCHEDULING_PRESETS.balanced;
    this.setScheduling(preset);
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
    this.selectedRef = toSet(selectionValues);
    this._selectedResolution = selectionResolution;
    this._onPulseRef = (typeof onPulse === 'function') ? onPulse : null;
    this.onCompleteRef = (typeof onComplete === 'function') ? onComplete : null;
    this._pulseCounter = -1;
    this._lastAbsoluteStep = null;
    this._lastCycleState = null;

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

  stop() {
    if (!this._ctx) return;

    // Capture timing info before clearing
    const wasPlaying = this.isPlaying;
    const pulseCount = this._pulseCounter;

    this.isPlaying = false;
    this._onPulseRef = null;
    this.onCompleteRef = null;

    if (this._schedulerId != null) {
      clearInterval(this._schedulerId);
      this._schedulerId = null;
    }
    this._node?.port?.postMessage({ action: 'stop' });
    this._stopAllPlayers();
    this._lastStep = null;
    this._lastPulseTime = null;
    this._lastAbsoluteStep = null;
    this._zeroOffset = null;
    this._pulseCounter = -1;
    this._lastCycleState = null;
    this.resetTapTempo();
    this._pendingTempo = null;
    this._setScheduledStep = null;

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
    if (Array.isArray(voices)) {
      voices.forEach((voice) => {
        if (!voice || !voice.id) return;
        const numerator = Number(voice.numerator);
        const denominator = Number(voice.denominator);
        map.set(voice.id, {
          numerator: Number.isFinite(numerator) ? numerator : null,
          denominator: Number.isFinite(denominator) ? denominator : null
        });
      });
    }
    this._voiceDefs = map;
    this._node?.port?.postMessage({ action: 'setVoices', voices });
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
        denominator: Number.isFinite(denominator) ? denominator : null
      });
      this._node?.port?.postMessage({ action: 'addVoice', voice });
    }
  }

  removeVoice(id) {
    if (id) {
      this._voiceDefs.delete(id);
      this._node?.port?.postMessage({ action: 'removeVoice', id });
    }
  }

  async configurePerformance({ requestedSampleRate, scheduleHorizonMs } = {}) {
    if (requestedSampleRate && !this._node) {
      const Ctor = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext))
        ? (window.AudioContext || window.webkitAudioContext)
        : null;
      if (Ctor) {
        this._ctx = new Ctor({ latencyHint: 'interactive', sampleRate: +requestedSampleRate });
        this._node = null;
        this._fallbackGain = null;
        await this._ensureContext();
      }
    }
    if (Number.isFinite(+scheduleHorizonMs)) {
      this._lookAheadSec = clamp(+scheduleHorizonMs / 1000, 0.02, 0.4);
      this._adaptSchedulerInterval();
    }
    return {
      requestedSampleRate: requestedSampleRate || null,
      actualSampleRate: this._ctx ? this._ctx.sampleRate : null,
      scheduleHorizonMs: Math.round(this._lookAheadSec * 1000),
      schedulerIntervalMs: Math.round(this._schedulerEverySec * 1000)
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

    const triggerPlayer = (key, when, duration = null) => {
      if (!this._buffers?.has(key)) return;
      this._schedulePlayerStart(key, when, duration);
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
      if (Number.isFinite(value)) {
        scheduledStep = value;
      } else {
        scheduledStep = this._lastAbsoluteStep ?? -1;
      }
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
        const when = this._stepTime(n);
        if (when == null || when > horizon) break;

        const stepIndex = this._resolveStepIndex(n);
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
        if (this._buffers && this._buffers.size) {
          const baseKey = (() => {
            if (!this._buffers || this._buffers.size === 0 || this._pulseMutedForFallback) return null;
            if (this._buffers.has('pulso')) return 'pulso';
            if (this._buffers.has('pulso0')) return 'pulso0';
            return null;
          })();

          // Play base pulse sound on ALL base steps (including step 0)
          if (baseKey && isBaseStep) {
            triggerPlayer(baseKey, when);
            triggered = true;
          }

          // Measure/P0: If measureEnabled, play ADDITIONAL special pulse0 sound on measure starts
          // This sound is ADDED to the base pulse, not replacing it
          if (isMeasureStart && this._measureEnabled && this._buffers.has('pulso0')) {
            triggerPlayer('pulso0', when);
            triggered = true;
          }

          if (isSelected && this._buffers.has('seleccionados')) {
            triggerPlayer('seleccionados', when, this.intervalRef);
            triggered = true;
          }
        }

        // Fallback beep: Play on all base steps (including step 0) or selected steps
        if (!triggered && !this._pulseMutedForFallback) {
          if (isSelected) {
            // Always beep for selected steps
            triggerBeep(when, 1100);
          } else if (isBaseStep) {
            // Beep for all base steps (including step 0)
            triggerBeep(when, 900);
          }
        }

        scheduledStep = n;
        n++;
      }
    };

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

  _adaptSchedulerInterval() {
    if (this._schedulerOverrideSec != null) {
      this._schedulerEverySec = this._schedulerOverrideSec;
      return;
    }
    const streams =
      1 + (this.selectedRef.size > 0 ? 1 : 0) +
      (this._cycleConfig?.denominator ? 1 : 0);
    const ms = clamp(20 - (streams - 1) * 3, 10, 30);
    this._schedulerEverySec = ms / 1000;
  }

  _handleClockMessage(msg) {
    const now = this._ctx?.currentTime ?? 0;
    if (msg.type === 'pulse') {
      this._lastStep = msg.step;
      this._pulseCounter = (this._pulseCounter ?? -1) + 1;
      this._lastAbsoluteStep = this._pulseCounter;
      this._lastPulseTime = now;
      if (Number.isFinite(this._lastAbsoluteStep) && Number.isFinite(this._lastStep)) {
        this._zeroOffset = this._lastAbsoluteStep - this._lastStep;
      }
      if (Number.isFinite(msg.interval)) {
        this.intervalRef = msg.interval;
      }
      this._evaluatePendingTempo();
      if (typeof this._onPulseRef === 'function') this._onPulseRef(msg.step);
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
      if (!this._cycleMutedForFallback && this._buffers?.has('cycle')) {
        this._schedulePlayerStart('cycle', now + 0.001);
      }
    } else if (msg.type === 'voice') {
      const payload = { id: msg.id, index: msg.index };
      if (typeof this._onVoiceRef === 'function') {
        this._onVoiceRef(payload);
      }
      const def = payload.id ? this._voiceDefs?.get(payload.id) : null;
      if (def && this._buffers?.has('seleccionados')) {
        const numerator = Number(def.numerator);
        const denominator = Number(def.denominator);
        const idx = Number(payload.index);
        if (Number.isFinite(numerator) && numerator > 0 && Number.isFinite(idx)) {
          const perCycle = Math.max(1, Number.isFinite(denominator) ? Math.floor(denominator) : 1);
          const cycleIndex = Math.floor(idx / perCycle);
          const subdivisionIndex = ((idx % perCycle) + perCycle) % perCycle;
          const fractionalStep = numerator * cycleIndex + (numerator / perCycle) * subdivisionIndex;
          if (Math.abs(fractionalStep - Math.round(fractionalStep)) > 1e-6) {
            this._schedulePlayerStart('seleccionados', now + 0.001);
          }
        }
      }
    } else if (msg.type === 'done') {
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
}

export default TimelineAudio;
