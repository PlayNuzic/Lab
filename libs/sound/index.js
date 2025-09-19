import { loadSampleMap } from './sample-map.js';
import { AudioMixer } from './mixer.js';

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
  click10: new URL('click10.wav', SAMPLE_BASE_URL).href
};

export const soundNames = Object.keys(SOUND_URLS);
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
  click10: 'Ride'
};

const mixer = new AudioMixer({ masterLabel: 'Master' });
let audioReadyPromise = null;
const workletModulePromises = new WeakMap();

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

export function ensureAudio() {
  if (!audioReadyPromise) {
    if (typeof Tone !== 'undefined' && typeof Tone.start === 'function') {
      try {
        audioReadyPromise = Promise.resolve(Tone.start());
      } catch {
        audioReadyPromise = Promise.resolve();
      }
    } else if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
      try {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        const ctx = new Ctor({ latencyHint: 'interactive' });
        ctx.close?.();
      } catch {}
      audioReadyPromise = Promise.resolve();
    } else {
      audioReadyPromise = Promise.resolve();
    }
  }
  return audioReadyPromise;
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
  const candidates = [];
  if (typeof Tone.getContext === 'function') {
    try { candidates.push(Tone.getContext()); } catch {}
  }
  if (Tone?.context) candidates.push(Tone.context);
  for (const candidate of candidates) {
    const resolved = normalizeAudioContext(candidate);
    if (resolved) return resolved;
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

    this._onPulseRef = null;
    this.onCompleteRef = null;
    this._cycleConfig = null;

    this._lastStep = null;
    this._lastPulseTime = null;

    this.selectedRef = new Set();

    this._ctx = null;
    this._node = null;
    this._schedulerId = null;
    this._lookAheadSec = 0.12;
    this._schedulerEverySec = 0.02;
    this._schedulerOverrideSec = null;

    this._bus = { master: null, pulso: null, seleccionados: null, cycle: null };

    this._players = null;
    this._sampleMap = null;

    this._fallbackGain = null;

    this._tapTimes = [];

    this._defaultAssignments = {
      pulso: 'click1',
      pulso0: 'click1',
      seleccionados: 'click2',
      start: 'click3',
      cycle: 'click4'
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
    mixer.registerChannel('accent', { allowSolo: true, label: 'Seleccionado' });
    mixer.registerChannel('subdivision', { allowSolo: true, label: 'Subdivisión' });

    this._pendingMixerState = null;
    this._pulseMutedForFallback = false;
    this._cycleMutedForFallback = false;

    this._ensureContextPromise = null;

    this._unsubscribeMixer = mixer.subscribe((state) => this._applyMixerState(state));

    try { window.NuzicAudioEngine = this; } catch {}
  }

  async ready() {
    await ensureAudio();
    await this._ensureContext();
    return this;
  }

  async _ensureContext() {
    if (this._node) return;
    if (this._ensureContextPromise) {
      await this._ensureContextPromise;
      return;
    }

    const FallbackCtor = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext))
      ? (window.AudioContext || window.webkitAudioContext)
      : null;

    const buildContext = async () => {
      const preferExisting = normalizeAudioContext(this._ctx);
      const toneCtx = resolveToneContext();
      let ctx = preferExisting || toneCtx || null;

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
      this._bus.seleccionados = ctx.createGain();
      this._bus.cycle = ctx.createGain();

      this._bus.pulso.connect(this._bus.master);
      this._bus.seleccionados.connect(this._bus.master);
      this._bus.cycle.connect(this._bus.master);
      this._bus.master.connect(ctx.destination);

      await this._initPlayers();

      this._node.connect(this._bus.master);
      this._node.port.onmessage = (e) => this._handleClockMessage(e.data);

      if (typeof Tone === 'undefined') {
        const g = ctx.createGain();
        g.gain.value = 0.0;
        g.connect(this._bus.pulso);
        this._fallbackGain = g;
      } else {
        this._fallbackGain = null;
      }

      if (this._pendingMixerState) {
        this._applyMixerState(this._pendingMixerState);
      }

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
    if (typeof Tone === 'undefined') return;
    this._sampleMap = await loadSampleMap();
    this._applySampleMap(this._sampleMap);

    const sources = {};
    ['pulso', 'pulso0', 'seleccionados', 'start', 'cycle'].forEach((key) => {
      const { key: resolved, url } = normalizeSound(this._soundAssignments[key], this._defaultAssignments[key]);
      this._soundAssignments[key] = resolved;
      if (url) sources[key] = url;
    });

    if (!Object.keys(sources).length) return;

    this._players = new Tone.Players(sources);

    const connectSafe = (key, dest) => {
      try {
        const player = this._players.player(key);
        player.disconnect();
        if (dest) player.connect(dest);
      } catch {}
    };

    connectSafe('pulso', this._bus.pulso);
    connectSafe('pulso0', this._bus.pulso);
    connectSafe('seleccionados', this._bus.seleccionados);
    connectSafe('start', this._bus.pulso);
    connectSafe('cycle', this._bus.cycle);
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

    const assignments = this._soundAssignments;
    assignments.pulso = defaults.pulso;
    assignments.pulso0 = map.pulso0 || assignments.pulso;
    if (map.seleccionados) assignments.seleccionados = map.seleccionados;
    if (map.start) assignments.start = map.start;
    if (map.cycle) assignments.cycle = map.cycle;
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
    applyGain(this._bus.seleccionados, 'accent');
    applyGain(this._bus.cycle, 'subdivision');
  }

  async _setSound(key, soundKey, fallbackKey) {
    this._soundAssignments[key] = soundKey || fallbackKey || this._soundAssignments[key];
    if (!this._players) return;
    const { key: resolved, url } = normalizeSound(this._soundAssignments[key], fallbackKey || this._defaultAssignments[key]);
    this._soundAssignments[key] = resolved;
    if (!url) return;
    try {
      const player = this._players.player(key);
      await player.load(url);
    } catch (error) {
      console.warn(`Failed to set sound ${soundKey} for ${key}`, error);
    }
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
  }

  async setCycle(key) {
    await this.ready();
    await this._setSound('cycle', key, this._defaultAssignments.cycle);
  }

  async preview(soundKey) {
    const { url } = normalizeSound(soundKey, this._defaultAssignments.pulso);
    if (!url || typeof Tone === 'undefined') return;
    await ensureAudio();
    try {
      const player = new Tone.Player({ url, autostart: false });
      if (this._bus.pulso) {
        player.connect(this._bus.pulso);
      } else {
        player.toDestination();
      }
      await player.load(url);
      player.start('+0.01');
      setTimeout(() => { try { player.dispose(); } catch {} }, 800);
    } catch (error) {
      console.warn('Failed to preview sound', error);
    }
  }

  setSelected(indices) {
    this.selectedRef = toSet(indices);
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
    this.selectedRef = toSet(selectedPulses);
    this._onPulseRef = (typeof onPulse === 'function') ? onPulse : null;
    this.onCompleteRef = (typeof onComplete === 'function') ? onComplete : null;

    const cyc = options?.cycle;
    this._cycleConfig = (cyc && Number.isFinite(+cyc.numerator) && Number.isFinite(+cyc.denominator))
      ? { numerator: +cyc.numerator, denominator: +cyc.denominator, onCycle: (cyc.onCycle || null) }
      : null;

    this._node.port.postMessage({
      action: 'start',
      total: this.totalRef,
      interval: this.intervalRef,
      loop: this.loopRef,
      numerator: this._cycleConfig?.numerator || 0,
      denominator: this._cycleConfig?.denominator || 0
    });

    this._startScheduler();
    this.isPlaying = true;
  }

  stop() {
    if (!this._ctx) return;
    this.isPlaying = false;
    this._onPulseRef = null;
    this.onCompleteRef = null;

    if (this._schedulerId != null) {
      clearInterval(this._schedulerId);
      this._schedulerId = null;
    }
    this._node?.port?.postMessage({ action: 'stop' });
  }

  setTempo(bpm, opts = {}) {
    const align = opts.align || 'nextPulse';
    const rampMs = Number.isFinite(opts.rampMs) ? Math.max(0, +opts.rampMs) : 80;
    const interval = 60 / Math.max(1e-6, +bpm || 120);

    this.intervalRef = interval;
    this._node?.port?.postMessage({ action: 'setBpm', bpm: +bpm, interval, align, rampMs });
  }

  setTotal(totalPulses) {
    this.totalRef = Math.max(1, +totalPulses || 1);
    this._node?.port?.postMessage({ action: 'updateTotal', total: this.totalRef });
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
    return (this._lastStep != null) ? { step: this._lastStep } : null;
  }

  setVoices(voices = []) {
    this._node?.port?.postMessage({ action: 'setVoices', voices });
  }

  addVoice(voice) {
    if (voice && voice.id) this._node?.port?.postMessage({ action: 'addVoice', voice });
  }

  removeVoice(id) {
    if (id) this._node?.port?.postMessage({ action: 'removeVoice', id });
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

    const triggerPlayer = (key, when) => {
      if (!this._players) return;
      try { this._players.player(key).start(when); } catch {}
    };

    this._stepTime = (stepIndex) => {
      if (this._lastStep == null || this._lastPulseTime == null) return null;
      const deltaSteps = stepIndex - this._lastStep;
      return this._lastPulseTime + deltaSteps * this.intervalRef;
    };

    let scheduledStep = -1;

    const tick = () => {
      if (!this.isPlaying) return;
      const horizon = scheduleHorizon();

      const intv = this.intervalRef;
      if (intv <= 0) return;

      const last = (this._lastStep != null) ? this._lastStep : 0;
      let n = Math.max(last, scheduledStep + 1);

      while (true) {
        const when = this._stepTime(n);
        if (when == null || when > horizon) break;

        const isStart = (n % this.totalRef) === 0;
        const isSelected = this.selectedRef.has(n % this.totalRef);

        if (this._players) {
          if (isStart && !this._pulseMutedForFallback && this._players.player('start')) {
            triggerPlayer('start', when);
          } else if (isSelected && this._players.player('seleccionados')) {
            triggerPlayer('seleccionados', when);
          } else if (!this._pulseMutedForFallback && this._players.player('pulso')) {
            triggerPlayer('pulso', when);
          } else if (!this._pulseMutedForFallback && this._players.player('pulso0')) {
            triggerPlayer('pulso0', when);
          }
        } else if (!this._pulseMutedForFallback) {
          const f = isStart ? 1400 : (isSelected ? 1100 : 900);
          triggerBeep(when, f);
        }

        scheduledStep = n;
        n++;
      }
    };

    this._schedulerId = setInterval(tick, Math.round(this._schedulerEverySec * 1000));
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
      this._lastPulseTime = now;
      if (typeof this._onPulseRef === 'function') this._onPulseRef(msg.step);
    } else if (msg.type === 'cycle') {
      if (this._cycleConfig?.onCycle) this._cycleConfig.onCycle(msg.payload);
      if (!this._cycleMutedForFallback && this._players?.player('cycle')) {
        try { this._players.player('cycle').start(now + 0.001); } catch {}
      }
    } else if (msg.type === 'voice') {
      // future hook
    } else if (msg.type === 'done') {
      if (typeof this.onCompleteRef === 'function') this.onCompleteRef();
      this.stop();
    }
  }

  tap(nowMs = performance.now()) {
    this._tapTimes.push(nowMs);
    if (this._tapTimes.length > 6) this._tapTimes.shift();
    if (this._tapTimes.length < 2) return null;

    const deltas = [];
    for (let i = 1; i < this._tapTimes.length; i++) deltas.push(this._tapTimes[i] - this._tapTimes[i - 1]);
    if (!deltas.length) return null;

    const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const bpm = 60000 / Math.max(1, avg);
    return bpm;
  }
}

export default TimelineAudio;
