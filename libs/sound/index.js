let synth;
let audioReady;
let muted = false;

function _setMute(val) {
  muted = !!val;
  if (typeof Tone !== 'undefined' && Tone.Destination) {
    Tone.Destination.mute = muted;
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
};

export const soundNames = Object.keys(SOUND_URLS);

/**
 * Gestor d'àudio per a línies de temps rítmiques. Carrega els sons necessaris
 * i permet programar pulsacions amb accentuacions i repeticions.
 */
export class TimelineAudio {
  constructor() {
    this.baseKey = 'click2';
    this.accentKey = 'click3';

    this.samplers = {
      base: null,
      accent: null,
      selected: null
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
    const [base, accent, selected] = await Promise.all([
      this._createSampler(this.baseKey),
      this._createSampler(this.accentKey),
      this._createSampler(this.baseKey)
    ]);

    this.samplers.base = base;
    this.samplers.accent = accent;
    this.samplers.selected = selected;
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
    this.loopRef = !!enabled;
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
  }

  /**
   * Carrega el so base utilitzat per a les pulsacions normals.
   * @param {string} key identificador del so
   */
  async setBase(key) {
    if (this.baseKey === key) return;
    this.baseKey = key;

    if (this.samplers.base) {
      this.samplers.base.dispose();
    }

    this.samplers.base = await this._createSampler(key);
  }

  /**
   * Carrega el so utilitzat per a les pulsacions accentuades.
   * @param {string} key identificador del so
   */
  async setAccent(key) {
    if (this.accentKey === key) return;
    this.accentKey = key;

    if (this.samplers.accent) {
      this.samplers.accent.dispose();
    }

    this.samplers.accent = await this._createSampler(key);
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
  play(totalPulses, interval, selectedPulses, loop, onPulse, onComplete) {
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
    Tone.Transport.loop = false;

    this.selectedRef = new Set(selectedPulses ? Array.from(selectedPulses) : []);
    this.loopRef = !!loop;

    try { Tone.Transport.bpm.value = 60 / interval; } catch {}
    const bpm = 60 / interval;
    const clickDur = Math.max(0.025, Math.min(0.12, interval / 4));

    let i = 0;
    this._repeatId = Tone.Transport.scheduleRepeat((t) => {
      if (scheduleId !== this.currentScheduleId) return;

      if (!this.loopRef && i >= totalPulses) {
        if (typeof onComplete === 'function') {
          Tone.Draw.schedule(onComplete, t);
        }
        this.stop();
        return;
      }

      const step = i % totalPulses;
      const isAccent = (step === 0) || this.selectedRef.has(step);
      const pulseType = isAccent ? 'accent' : 'base';
      const sampler = this.samplers[pulseType];
      if (sampler) {
        try { sampler.triggerAttackRelease('C3', clickDur, t); } catch {}
      }

      if (typeof onPulse === 'function') {
        Tone.Draw.schedule(() => {
          if (scheduleId === this.currentScheduleId) onPulse(step);
        }, t);
      }

      i = this.loopRef ? (step + 1) : (i + 1);
    }, interval, 0);

    this.isPlaying = true;
    try { Tone.Transport.start('+' + this.lookAhead.toFixed(3)); }
    catch { Tone.Transport.start(); }
  }

  /**
   * Atura la reproducció i neteja qualsevol planificació pendent.
   */
  stop() {
    this.isPlaying = false;
    this.currentScheduleId++;

    if (this._repeatId != null) {
      try { Tone.Transport.clear(this._repeatId); } catch {}
      this._repeatId = null;
    }
    if (this._stopId != null) {
      try { Tone.Transport.clear(this._stopId); } catch {}
      this._stopId = null;
    }

    try { Tone.Transport.stop(); } catch {}
    try { Tone.Transport.cancel(); } catch {}
    try { Tone.Transport.position = 0; } catch {}
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

