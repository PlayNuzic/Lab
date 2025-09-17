let synth;
let audioReady;
let muted = false;
let volume = 1;

function _setMute(val) {
  muted = !!val;
  if (typeof Tone !== 'undefined' && Tone.Destination) {
    Tone.Destination.mute = muted;
  }
}

function _setVolume(val) {
  const v = Math.max(0, Math.min(1, Number(val)));
  volume = v;
  if (typeof Tone !== 'undefined' && Tone.Destination && Tone.Destination.volume) {
    try { Tone.Destination.volume.value = v > 0 ? (20 * Math.log10(v)) : -Infinity; } catch {}
  }
}

export function ensureAudio() {
  if (!audioReady) {
    audioReady = Tone.start();
  }
  return audioReady;
}

export function setMute(val) {
  _setMute(val);
}

export function setVolume(val) {
  _setVolume(val);
}

export function getVolume() {
  return volume;
}

export function toggleMute() {
  _setMute(!muted);
  return muted;
}

export function isMuted() {
  return muted;
}

export async function init(type = 'piano') {
  if (synth) synth.dispose();
  if (type === 'piano') {
    const urls = {};
    for (let o = 1; o <= 7; o++) {
      urls[`C${o}`] = `C${o}.mp3`;
      urls[`F#${o}`] = `Fs${o}.mp3`;
    }
    synth = new Tone.Sampler({
      urls,
      release: 1,
      baseUrl: "https://tonejs.github.io/audio/salamander/"
    }).toDestination();
    try {
      await Tone.loaded();
    } catch (e) {
      console.error('Error carregant mostres:', e);
    }
  } else if (type === 'woodblocks') {
    synth = new Tone.MembraneSynth({
      octaves: 2,
      pitchDecay: 0.01,
      envelope: { attack: 0.001, decay: 0.1, sustain: 0.001, release: 0.01 }
    }).toDestination();
  } else {
    synth = new Tone.PolySynth(Tone.Synth).toDestination();
  }
  _setMute(muted);
  _setVolume(volume);
}

export function playNote(midi, duration = 1.5) {
  if (!synth || muted) return;
  synth.triggerAttackRelease(Tone.Frequency(midi, 'midi'), duration);
}

export function playChord(midis, duration = 1.5) {
  if (!synth || muted) return;
  synth.triggerAttackRelease(midis.map(n => Tone.Frequency(n, 'midi')), duration);
}

export function playMelody(midis, duration = 1.5, gap = 0.2) {
  if (!synth || muted) return;
  midis.forEach((n, i) => {
    setTimeout(() => {
      synth.triggerAttackRelease(Tone.Frequency(n, 'midi'), duration);
    }, i * (duration * 1000 + gap * 1000));
  });
}

export function playRhythm(permutation, bpm) {
  if (!synth || muted) return;
  const iT = permutation.reduce((a, b) => a + b, 0);
  const beatDur = 60 / (bpm || 120);
  const unit = beatDur / iT;
  let time = Tone.now();
  permutation.forEach((n, idx) => {
    const note = idx === 0 ? 'C4' : 'C5';
    synth.triggerAttackRelease(note, 0.05, time);
    time += unit * n;
  });
}

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
  click10: 'Ride',
};

/**
 * Gestor d'àudio per a línies de temps rítmiques. Carrega els sons necessaris
 * i permet programar pulsacions amb accentuacions i repeticions.
 */
export class TimelineAudio {
  constructor() {
    this.baseKey = 'click1';
    this.accentKey = 'click2';
    this.startKey = 'click3';
    this.cycleKey = 'click4';
    this.cycleStartKey = 'click5';

    this.samplers = {
      base: null,
      accent: null,
      start: null,
      selected: null,
      cycle: null,
      cycleStart: null
    };

    this.isReady = false;
    this.isPlaying = false;
    this.currentScheduleId = 0;
    this._repeatId = null;
    this._stopId = null;
    this.lookAhead = 0.03;
    this.updateInterval = 0.015;
    this.selectedRef = new Set();
    this.loopRef = false;
    this.totalRef = 0;
    this.pulseIndex = 0;
    this.onCompleteRef = null;
    this._onPulseRef = null;
    this._remainingPulses = Infinity;
    this._cyclePart = null;
    this._cycleConfig = null;
    this._clickDur = 0.05;
    this._startContextTime = null;
    this._hasTriggeredPulse = false;
    this._emittedPulses = 0;
    this._lastPulseSeconds = null;

    this._readyPromise = this._initialize();
  }

  async _initialize() {
    try {
      await this._loadAllSamplers();
      this.isReady = true;
    } catch (error) {
      console.error('Error initializing audio:', error);
      throw error;
    }
  }

  async _loadAllSamplers() {
    const [base, accent, start, selected, cycle, cycleStart] = await Promise.all([
      this._createSampler(this.baseKey),
      this._createSampler(this.accentKey),
      this._createSampler(this.startKey),
      this._createSampler(this.baseKey),
      this._createSampler(this.cycleKey),
      this._createSampler(this.cycleStartKey)
    ]);

    this.samplers.base = base;
    this.samplers.accent = accent;
    this.samplers.start = start;
    this.samplers.selected = selected;
    this.samplers.cycle = cycle;
    this.samplers.cycleStart = cycleStart;
  }

  async _createSampler(soundKey) {
    return new Promise((resolve, reject) => {
      const sampler = new Tone.Sampler({
        urls: { C3: SOUND_URLS[soundKey] },
        onload: () => resolve(sampler),
        onerror: (error) => reject(error)
      }).toDestination();
    });
  }

  async ready() {
    return this._readyPromise;
  }

  /**
   * Ajusta els paràmetres de planificació interna.
   * @param {Object} opts
   * @param {number} [opts.lookAhead] temps amb què es programa per avançat
   * @param {number} [opts.updateInterval] interval d'actualització del context
   */
  setScheduling({ lookAhead, updateInterval } = {}) {
    if (typeof lookAhead === 'number') this.lookAhead = Math.max(0, lookAhead);
    if (typeof updateInterval === 'number') this.updateInterval = Math.max(0.005, updateInterval);
    try {
      const ctx = (typeof Tone.getContext === 'function') ? Tone.getContext() : Tone.context;
      if (ctx) {
        if (typeof ctx.lookAhead !== 'undefined') ctx.lookAhead = this.lookAhead;
        if (typeof ctx.updateInterval !== 'undefined') ctx.updateInterval = this.updateInterval;
      }
    } catch {}
  }

  /**
   * Aplica una configuració predefinida de planificació.
   * @param {('desktop'|'balanced'|'mobile')} profile
   */
  setSchedulingProfile(profile) {
    const map = {
      desktop: { lookAhead: 0.02, updateInterval: 0.01 },
      balanced: { lookAhead: 0.03, updateInterval: 0.015 },
      mobile: { lookAhead: 0.06, updateInterval: 0.03 },
    };
    this.setScheduling(map[profile] || map.balanced);
  }

  /**
   * Defineix les pulsacions seleccionades que es destacaran.
   * Accepta un array o un Set d'índexs.
   * @param {number[]|Set<number>} indices
   */
  setSelected(indices) {
    const next = (indices instanceof Set) ? indices : new Set(Array.isArray(indices) ? indices : []);
    this.selectedRef = next;
  }

  /**
   * Activa o desactiva la repetició en bucle de la seqüència.
   * @param {boolean} enabled
   */
  setLoop(enabled) {
    const next = !!enabled;
    const prev = this.loopRef;
    this.loopRef = next;
    if (this._cyclePart) {
      this._cyclePart.loop = this.loopRef;
    }
    if (!this.loopRef) {
      this._refreshPulsePhase(this.intervalRef, { clampToCycle: true });
      const total = Number.isFinite(this.totalRef) && this.totalRef > 0 ? this.totalRef : 1;
      const currentStep = total ? (this.pulseIndex % total) : 0;
      let remaining = total - currentStep;
      if (!Number.isFinite(remaining) || remaining <= 0) remaining = total;
      this._remainingPulses = remaining;
    } else if (!prev && this.loopRef) {
      this._remainingPulses = Infinity;
    }

    if (this.isPlaying && this._cycleConfig) {
      const cfg = this._cycleConfig;
      this.updateCycleConfig({
        numerator: Number.isFinite(cfg.numerator) ? cfg.numerator : null,
        denominator: Number.isFinite(cfg.denominator) ? cfg.denominator : null,
        totalPulses: Number.isFinite(cfg.totalPulses) ? cfg.totalPulses : null,
        interval: Number.isFinite(cfg.interval) ? cfg.interval : null,
        onTick: cfg && typeof cfg.onCycle === 'function' ? cfg.onCycle : null
      });
    }
  }

  /**
   * Actualitza el tempo de reproducció.
   * @param {number} bpm valors en BPM
   */
  setTempo(bpm) {
    if (typeof bpm !== 'number' || bpm <= 0) return;
    try {
      if (Tone.Transport && Tone.Transport.bpm) {
        const tBpm = Tone.Transport.bpm;
        if (typeof tBpm.rampTo === 'function') {
          tBpm.rampTo(bpm, 0.01);
        } else {
          tBpm.value = bpm;
        }
      }
    } catch {}
    this._refreshPulsePhase(60 / bpm, { clampToCycle: this.loopRef });
  }

  /**
   * Carrega el so base utilitzat per a les pulsacions normals.
   * @param {string} key identificador del so
   */
  async setBase(key) {
    if (!key) return;
    this._baseReqId = (this._baseReqId || 0) + 1;
    const reqId = this._baseReqId;
    const prev = this.samplers.base;
    try {
      const sampler = await this._createSampler(key);
      if (reqId !== this._baseReqId) { sampler.dispose(); return; }
      this.baseKey = key;
      this.samplers.base = sampler;
      if (prev) prev.dispose();
    } catch (e) {
      console.warn('Failed to set base sound', e);
    }
  }

  /**
   * Carrega el so utilitzat per a les pulsacions accentuades.
   * @param {string} key identificador del so
   */
  async setAccent(key) {
    if (!key) return;
    this._accentReqId = (this._accentReqId || 0) + 1;
    const reqId = this._accentReqId;
    const prev = this.samplers.accent;
    try {
      const sampler = await this._createSampler(key);
      if (reqId !== this._accentReqId) { sampler.dispose(); return; }
      this.accentKey = key;
      this.samplers.accent = sampler;
      if (prev) prev.dispose();
    } catch (e) {
      console.warn('Failed to set accent sound', e);
    }
  }

  /**
   * Carrega el so utilitzat per al pols inicial.
   * @param {string} key identificador del so
   */
  async setStart(key) {
    if (!key) return;
    this._startReqId = (this._startReqId || 0) + 1;
    const reqId = this._startReqId;
    const prev = this.samplers.start;
    try {
      const sampler = await this._createSampler(key);
      if (reqId !== this._startReqId) { sampler.dispose(); return; }
      this.startKey = key;
      this.samplers.start = sampler;
      if (prev) prev.dispose();
    } catch (e) {
      console.warn('Failed to set start sound', e);
    }
  }

  async setCycle(key) {
    if (!key) return;
    this._cycleReqId = (this._cycleReqId || 0) + 1;
    const reqId = this._cycleReqId;
    const prev = this.samplers.cycle;
    try {
      const sampler = await this._createSampler(key);
      if (reqId !== this._cycleReqId) { sampler.dispose(); return; }
      this.cycleKey = key;
      this.samplers.cycle = sampler;
      if (prev) prev.dispose();
    } catch (e) {
      console.warn('Failed to set cycle sound', e);
    }
  }

  async setCycleStart(key) {
    if (!key) return;
    this._cycleStartReqId = (this._cycleStartReqId || 0) + 1;
    const reqId = this._cycleStartReqId;
    const prev = this.samplers.cycleStart;
    try {
      const sampler = await this._createSampler(key);
      if (reqId !== this._cycleStartReqId) { sampler.dispose(); return; }
      this.cycleStartKey = key;
      this.samplers.cycleStart = sampler;
      if (prev) prev.dispose();
    } catch (e) {
      console.warn('Failed to set cycle start sound', e);
    }
  }

  async setSelectedSound(key) {
    if (this.samplers.selected) {
      this.samplers.selected.dispose();
    }
    this.samplers.selected = await this._createSampler(key);
  }

  setMute(mute) {
    _setMute(mute);
  }

  /**
   * Comença la reproducció del metrònom configurat.
   * @param {number} totalPulses nombre total de pulsacions del compàs
   * @param {number} interval durada en segons de cada pulsació
   * @param {Iterable<number>} [selectedPulses] pulsacions seleccionades
   * @param {boolean} [loop] si s'ha de repetir en bucle
   * @param {Function} [onPulse] callback en cada pulsació
   * @param {Function} [onComplete] callback en finalitzar
   */
  play(totalPulses, interval, selectedPulses, loop, onPulse, onComplete, options) {
    if (typeof onComplete === 'object' && typeof options === 'undefined') {
      options = onComplete;
      onComplete = undefined;
    }
    options = options || {};
    if (!this.isReady) {
      console.warn('Audio not ready');
      return;
    }

    this.stop();

    this.currentScheduleId++;
    const scheduleId = this.currentScheduleId;

    try { Tone.Transport.cancel(); } catch {}
    try { Tone.Transport.stop(); } catch {}
    try { Tone.Transport.position = 0; } catch {}
    this._disposeCyclePart();
    Tone.Transport.loop = false;

    this.selectedRef = new Set(selectedPulses ? Array.from(selectedPulses) : []);
    this.loopRef = !!loop;

    this.totalRef = totalPulses;
    this.intervalRef = interval;
    this.onCompleteRef = onComplete;
    this._onPulseRef = typeof onPulse === 'function' ? onPulse : null;
    this.pulseIndex = 0;
    this._hasTriggeredPulse = false;
    this._emittedPulses = 0;
    this._lastPulseSeconds = null;
    this._remainingPulses = this.loopRef ? Infinity : totalPulses;
    const hasLookAhead = Number.isFinite(this.lookAhead) ? this.lookAhead : 0;
    const ctxNow = (typeof Tone !== 'undefined' && Tone && typeof Tone.now === 'function') ? Tone.now() : null;

    try { Tone.Transport.bpm.value = 60 / interval; } catch {}
    const fadeOut = Math.min(0.05, interval / 2);
    const clickDur = Math.max(0.01, interval - fadeOut);
    this._clickDur = clickDur;
    Object.values(this.samplers).forEach(s => { if (s) s.release = fadeOut; });

    this._repeatId = Tone.Transport.scheduleRepeat((t) => {
      if (scheduleId !== this.currentScheduleId) return;

      if (!this.loopRef && this._remainingPulses <= 0) {
        if (typeof this.onCompleteRef === 'function') {
          Tone.Draw.schedule(this.onCompleteRef, t);
        }
        this.stop();
        return;
      }

      const step = this.pulseIndex % this.totalRef;
      let pulseType = 'base';
      if (step === 0) pulseType = 'start';
      else if (this.selectedRef.has(step)) pulseType = 'accent';
      const sampler = this.samplers[pulseType];
      if (sampler) {
        try { sampler.triggerAttackRelease('C3', clickDur, t); } catch {}
      }

      if (this._onPulseRef) {
        Tone.Draw.schedule(() => {
          if (scheduleId === this.currentScheduleId) this._onPulseRef(step);
        }, t);
      }

      this._hasTriggeredPulse = true;
      if (Number.isFinite(t)) {
        this._lastPulseSeconds = t;
      } else {
        const inferred = this._getTransportSeconds();
        if (Number.isFinite(inferred)) this._lastPulseSeconds = inferred;
      }
      this._emittedPulses = (this._emittedPulses || 0) + 1;

      this.pulseIndex = this.loopRef ? (step + 1) : (this.pulseIndex + 1);
      if (!this.loopRef && Number.isFinite(this._remainingPulses)) {
        this._remainingPulses -= 1;
      }
    }, interval, 0);

    const cycleOpts = options.cycle || null;
    if (cycleOpts && typeof cycleOpts === 'object') {
      const onCycle = typeof cycleOpts.onTick === 'function'
        ? cycleOpts.onTick
        : (typeof cycleOpts.onCycle === 'function' ? cycleOpts.onCycle : null);
      this._configureCyclePart({
        numerator: cycleOpts.numerator,
        denominator: cycleOpts.denominator,
        totalPulses,
        interval,
        onCycle,
        scheduleId,
        offset: 0,
        startAt: 0
      });
    }

    this.isPlaying = true;
    let started = false;
    let appliedLookAhead = false;
    try {
      Tone.Transport.start('+' + hasLookAhead.toFixed(3));
      started = true;
      appliedLookAhead = hasLookAhead > 0;
    } catch {
      try {
        Tone.Transport.start();
        started = true;
      } catch {}
    }
    if (started) {
      const startDelay = appliedLookAhead ? hasLookAhead : 0;
      let inferred = ctxNow;
      if (inferred == null && typeof Tone !== 'undefined' && Tone && typeof Tone.now === 'function') {
        inferred = Tone.now();
      }
      this._startContextTime = inferred != null ? inferred + startDelay : null;
    } else {
      this._startContextTime = null;
    }
  }

  /**
   * Actualitza el nombre total de pulsacions del compàs.
   * @param {number} totalPulses
   */
  setTotal(totalPulses) {
    if (typeof totalPulses === 'number' && totalPulses > 0) {
      this.totalRef = totalPulses;
      this._refreshPulsePhase(this.intervalRef, { clampToCycle: this.loopRef });
      if (!this.loopRef) {
        const total = Number.isFinite(this.totalRef) && this.totalRef > 0 ? this.totalRef : 1;
        const current = this.pulseIndex % total;
        let remaining = total - current;
        if (!Number.isFinite(remaining) || remaining <= 0) remaining = total;
        this._remainingPulses = remaining;
      }
    }
  }

  /**
   * Atura la reproducció i neteja qualsevol planificació pendent.
   */
  stop() {
    this.isPlaying = false;
    this.currentScheduleId++;
    this._startContextTime = null;
    this._onPulseRef = null;
    this._remainingPulses = Infinity;
    this._hasTriggeredPulse = false;
    this._emittedPulses = 0;
    this._lastPulseSeconds = null;

    if (this._repeatId != null) {
      try { Tone.Transport.clear(this._repeatId); } catch {}
      this._repeatId = null;
    }
    if (this._stopId != null) {
      try { Tone.Transport.clear(this._stopId); } catch {}
      this._stopId = null;
    }
    this._disposeCyclePart();

    try { Tone.Transport.stop(); } catch {}
    try { Tone.Transport.cancel(); } catch {}
    try { Tone.Transport.position = 0; } catch {}
  }

  _disposeCyclePart() {
    if (this._cyclePart) {
      try { this._cyclePart.stop(); } catch {}
      try { this._cyclePart.dispose(); } catch {}
      this._cyclePart = null;
    }
    this._cycleConfig = null;
  }

  _getTransportSeconds() {
    try {
      if (Tone && Tone.Transport) {
        const secondsProp = Tone.Transport.seconds;
        if (typeof secondsProp === 'number' && Number.isFinite(secondsProp)) {
          return secondsProp;
        }
        if (typeof secondsProp === 'function') {
          const value = secondsProp.call(Tone.Transport);
          if (Number.isFinite(value)) return value;
        }
      }
    } catch {}
    return null;
  }

  _computeElapsedSeconds(intervalHint) {
    const transportSeconds = this._getTransportSeconds();
    if (Number.isFinite(transportSeconds)) {
      return Math.max(0, transportSeconds);
    }

    if (typeof Tone !== 'undefined' && Tone && typeof Tone.now === 'function' && Number.isFinite(this._startContextTime)) {
      const diff = Tone.now() - this._startContextTime;
      if (Number.isFinite(diff)) {
        return Math.max(0, diff);
      }
    }

    const interval = Number.isFinite(intervalHint) && intervalHint > 0
      ? intervalHint
      : (Number.isFinite(this.intervalRef) && this.intervalRef > 0 ? this.intervalRef : null);

    if (interval) {
      const total = Number.isFinite(this.totalRef) && this.totalRef > 0 ? this.totalRef : null;
      const pulsesPlayed = this.loopRef && total
        ? (this.pulseIndex % total)
        : this.pulseIndex;
      return Math.max(0, pulsesPlayed * interval);
    }

    return 0;
  }

  getVisualState() {
    if (!this.isPlaying) return null;
    const interval = this.intervalRef;
    const total = this.totalRef;
    if (!Number.isFinite(interval) || interval <= 0 || !Number.isFinite(total) || total <= 0) {
      return null;
    }

    const elapsed = this._computeElapsedSeconds(interval);
    if (!Number.isFinite(elapsed)) return null;

    const pulsesFloat = elapsed / interval;
    let step;
    if (this.loopRef) {
      const modulo = total;
      const normalized = ((pulsesFloat % modulo) + modulo) % modulo;
      step = Math.floor(normalized + 1e-6);
    } else {
      const clamped = Math.min(pulsesFloat, total - 1 + 1e-6);
      step = Math.floor(Math.max(0, clamped));
    }

    if (!Number.isFinite(step)) step = 0;
    return { step };
  }

  _refreshPulsePhase(intervalHint, { clampToCycle = false } = {}) {
    if (!this.isPlaying) return;
    const interval = Number.isFinite(intervalHint) && intervalHint > 0
      ? intervalHint
      : (Number.isFinite(this.intervalRef) && this.intervalRef > 0 ? this.intervalRef : null);
    if (!interval) return;

    const elapsed = this._computeElapsedSeconds(interval);
    if (!Number.isFinite(elapsed)) return;
    const ratio = elapsed / interval;
    const base = Math.max(0, Math.floor(ratio + 1e-6));
    const emitted = Number.isFinite(this._emittedPulses) ? this._emittedPulses : 0;
    let pulsesElapsed = base;
    if (emitted > pulsesElapsed) {
      pulsesElapsed = emitted;
    } else if ((emitted > 0 || pulsesElapsed > 0) && (ratio - base) > 1e-6) {
      pulsesElapsed = base + 1;
    }

    if (!this.loopRef && Number.isFinite(this.totalRef) && this.totalRef > 0) {
      pulsesElapsed = Math.min(pulsesElapsed, this.totalRef);
    }

    if (clampToCycle && Number.isFinite(this.totalRef) && this.totalRef > 0) {
      this.pulseIndex = pulsesElapsed % this.totalRef;
    } else {
      this.pulseIndex = pulsesElapsed;
    }
  }

  _configureCyclePart({ numerator, denominator, totalPulses, interval, onCycle, scheduleId, offset = 0, startAt = 0 } = {}) {
    this._disposeCyclePart();

    const num = Math.floor(Number(numerator));
    const den = Math.floor(Number(denominator));
    const validNum = Number.isFinite(num) && num > 0 ? num : 0;
    const validDen = Number.isFinite(den) && den > 0 ? den : 0;
    const total = Number.isFinite(totalPulses) && totalPulses > 0 ? totalPulses : this.totalRef;
    const stepInterval = Number.isFinite(interval) && interval > 0 ? interval : this.intervalRef;

    if (!validNum || !validDen || !total || !stepInterval) {
      this._cycleConfig = {
        numerator: validNum || null,
        denominator: validDen || null,
        totalPulses: total || null,
        interval: stepInterval || null,
        onCycle: typeof onCycle === 'function' ? onCycle : null
      };
      return;
    }

    const cycles = Math.floor(total / validNum);
    if (cycles <= 0) {
      this._cycleConfig = {
        numerator: validNum,
        denominator: validDen,
        totalPulses: total,
        interval: stepInterval,
        onCycle: typeof onCycle === 'function' ? onCycle : null,
        cycles: 0
      };
      return;
    }

    const totalDuration = total * stepInterval;
    const subInterval = (validNum * stepInterval) / validDen;
    const events = [];
    const wrap = !!this.loopRef;
    const rawOffset = Math.max(0, Number(offset) || 0);
    const offsetNormalized = totalDuration > 0
      ? ((rawOffset % totalDuration) + totalDuration) % totalDuration
      : 0;

    for (let cycleIndex = 0; cycleIndex < cycles; cycleIndex++) {
      const cycleStart = cycleIndex * validNum * stepInterval;
      for (let sub = 0; sub < validDen; sub++) {
        const baseTime = cycleStart + sub * subInterval;
        let eventTime = baseTime - offsetNormalized;
        if (wrap) {
          while (eventTime < 0) eventTime += totalDuration;
          eventTime = eventTime % totalDuration;
        } else if (eventTime < 0) {
          continue;
        }
        events.push([eventTime, {
          cycleIndex,
          subdivisionIndex: sub,
          totalSubdivisions: validDen,
          numerator: validNum,
          denominator: validDen,
          absoluteIndex: cycleIndex * validDen + sub,
          totalCycles: cycles
        }]);
      }
    }

    if (!events.length) {
      this._cycleConfig = {
        numerator: validNum,
        denominator: validDen,
        totalPulses: total,
        interval: stepInterval,
        onCycle: typeof onCycle === 'function' ? onCycle : null,
        cycles
      };
      return;
    }

    events.sort((a, b) => a[0] - b[0]);
    const handler = typeof onCycle === 'function' ? onCycle : null;
    const clickDur = this._clickDur || Math.max(0.01, stepInterval - Math.min(0.05, stepInterval / 2));

    try {
      const part = new Tone.Part((t, payload) => {
        if (scheduleId != null && scheduleId !== this.currentScheduleId) return;
        const isCycleStart = payload && payload.subdivisionIndex === 0;
        let sampler = null;
        if (isCycleStart) {
          sampler = this.samplers.cycleStart || this.samplers.cycle || this.samplers.accent || this.samplers.base;
        } else {
          sampler = this.samplers.cycle || this.samplers.accent || this.samplers.base;
        }
        if (sampler) {
          try { sampler.triggerAttackRelease('C3', clickDur, t); } catch {}
        }
        if (handler) {
          Tone.Draw.schedule(() => {
            if (scheduleId == null || scheduleId === this.currentScheduleId) handler(payload);
          }, t);
        }
      }, events);
      part.loop = wrap;
      part.loopEnd = totalDuration;
      const launchAt = Number.isFinite(startAt) ? startAt : 0;
      part.start(launchAt);
      this._cyclePart = part;
      this._cycleConfig = {
        numerator: validNum,
        denominator: validDen,
        totalPulses: total,
        interval: stepInterval,
        onCycle: handler,
        cycles
      };
    } catch (err) {
      console.warn('Failed to schedule cycle loop', err);
    }
  }

  updateCycleConfig({ numerator, denominator, totalPulses, interval, onTick, onCycle } = {}) {
    if (typeof totalPulses === 'number' && totalPulses > 0) {
      this.totalRef = totalPulses;
    }
    if (typeof interval === 'number' && interval > 0) {
      this.intervalRef = interval;
    }

    const handler = typeof onTick === 'function'
      ? onTick
      : (typeof onCycle === 'function' ? onCycle : (this._cycleConfig && typeof this._cycleConfig.onCycle === 'function' ? this._cycleConfig.onCycle : null));

    const effectiveNum = Number.isFinite(numerator) ? numerator : (this._cycleConfig ? this._cycleConfig.numerator : numerator);
    const effectiveDen = Number.isFinite(denominator) ? denominator : (this._cycleConfig ? this._cycleConfig.denominator : denominator);
    const effectiveTotal = Number.isFinite(totalPulses) && totalPulses > 0
      ? totalPulses
      : (this._cycleConfig && Number.isFinite(this._cycleConfig.totalPulses) ? this._cycleConfig.totalPulses : this.totalRef);
    const effectiveInterval = Number.isFinite(interval) && interval > 0
      ? interval
      : (this._cycleConfig && Number.isFinite(this._cycleConfig.interval) ? this._cycleConfig.interval : this.intervalRef);

    if (Number.isFinite(effectiveInterval) && effectiveInterval > 0) {
      this.intervalRef = effectiveInterval;
      const fade = Math.min(0.05, effectiveInterval / 2);
      const dur = Math.max(0.01, effectiveInterval - fade);
      this._clickDur = dur;
      Object.values(this.samplers).forEach(s => { if (s) s.release = fade; });
    }

    if (!this.isPlaying) {
      this._cycleConfig = {
        numerator: Number.isFinite(effectiveNum) ? effectiveNum : null,
        denominator: Number.isFinite(effectiveDen) ? effectiveDen : null,
        totalPulses: Number.isFinite(effectiveTotal) ? effectiveTotal : null,
        interval: Number.isFinite(effectiveInterval) ? effectiveInterval : null,
        onCycle: handler || null
      };
      return;
    }

    if (!Number.isFinite(effectiveNum) || effectiveNum <= 0 || !Number.isFinite(effectiveDen) || effectiveDen <= 0) {
      this._disposeCyclePart();
      this._cycleConfig = {
        numerator: Number.isFinite(effectiveNum) ? effectiveNum : null,
        denominator: Number.isFinite(effectiveDen) ? effectiveDen : null,
        totalPulses: Number.isFinite(effectiveTotal) ? effectiveTotal : null,
        interval: Number.isFinite(effectiveInterval) ? effectiveInterval : null,
        onCycle: handler || null
      };
      return;
    }

    const elapsed = this._computeElapsedSeconds(effectiveInterval);
    this._refreshPulsePhase(effectiveInterval, { clampToCycle: this.loopRef });
    if (!this.loopRef && Number.isFinite(this.totalRef) && this.totalRef > 0) {
      const total = this.totalRef;
      const current = this.pulseIndex % total;
      let remaining = total - current;
      if (!Number.isFinite(remaining) || remaining <= 0) remaining = total;
      this._remainingPulses = remaining;
    }
    let startAt = this._getTransportSeconds();
    if (!Number.isFinite(startAt)) {
      startAt = elapsed;
    }

    this._configureCyclePart({
      numerator: effectiveNum,
      denominator: effectiveDen,
      totalPulses: effectiveTotal,
      interval: effectiveInterval,
      onCycle: handler,
      scheduleId: this.currentScheduleId,
      offset: elapsed,
      startAt
    });
  }

  async preview(soundKey) {
    if (!SOUND_URLS[soundKey]) {
      console.warn(`Sound ${soundKey} not found`);
      return;
    }

    await Tone.start();

    const sampler = await this._createSampler(soundKey);
    sampler.triggerAttackRelease('C3', '8n');

    setTimeout(() => sampler.dispose(), 1000);
  }

  dispose() {
    this.stop();
    Object.values(this.samplers).forEach(sampler => {
      if (sampler) sampler.dispose();
    });
  }
}
