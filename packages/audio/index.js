// TimelineAudio.js - Sistema d'àudio professional per metrònom
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

export class TimelineAudio {
  constructor() {
    // Configuració inicial
    this.baseKey = 'click2';
    this.accentKey = 'click3';
    
    // Samplers
    this.samplers = {
      base: null,
      accent: null,
      selected: null
    };
    
    // Control d'estat
    this.isReady = false;
    this.isPlaying = false;
    this.currentScheduleId = 0;
    this._repeatId = null;
    this._stopId = null;
    // Scheduling (look-ahead i interval per a plataformes diverses)
    this.lookAhead = 0.03;       // 30ms: perfil equilibrat
    this.updateInterval = 0.015; // 15ms
    
    // Carregar samplers inicialment
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
      this._createSampler(this.baseKey) // selected usa el mateix so que base inicialment
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
  
  // Public API
  async ready() {
    return this._readyPromise;
  }
  
setScheduling({ lookAhead, updateInterval } = {}) {
  if (typeof lookAhead === 'number') this.lookAhead = Math.max(0, lookAhead);
  if (typeof updateInterval === 'number') this.updateInterval = Math.max(0.005, updateInterval);
  // Apliquem al context de Tone si existeix
  try {
    const ctx = (typeof Tone.getContext === 'function') ? Tone.getContext() : Tone.context;
    if (ctx) {
      if (typeof ctx.lookAhead !== 'undefined') ctx.lookAhead = this.lookAhead;
      if (typeof ctx.updateInterval !== 'undefined') ctx.updateInterval = this.updateInterval;
    }
  } catch {}
}

setSchedulingProfile(profile) {
  const map = {
    desktop:  { lookAhead: 0.02, updateInterval: 0.01 },
    balanced: { lookAhead: 0.03, updateInterval: 0.015 },
    mobile:   { lookAhead: 0.06, updateInterval: 0.03 },
  };
  this.setScheduling(map[profile] || map.balanced);
}

  async setBase(key) {
    if (this.baseKey === key) return;
    this.baseKey = key;
    
    // Dispose old sampler
    if (this.samplers.base) {
      this.samplers.base.dispose();
    }
    
    // Load new sampler
    this.samplers.base = await this._createSampler(key);
  }
  
  async setAccent(key) {
    if (this.accentKey === key) return;
    this.accentKey = key;
    
    // Dispose old sampler
    if (this.samplers.accent) {
      this.samplers.accent.dispose();
    }
    
    // Load new sampler
    this.samplers.accent = await this._createSampler(key);
  }
  
  setMute(mute) {
    Tone.Destination.mute = mute;
  }
  
  /**
   * Programa una seqüència de polsos
   * @param {number} totalPulses - Nombre total de polsos (Lg)
   * @param {number} interval - Interval entre polsos en segons (60/V)
   * @param {Set} selectedPulses - Polsos seleccionats
   * @param {boolean} loop - Mode loop
   * @param {Function} onPulse - Callback per cada pols (índex)
   * @param {Function} onComplete - Callback quan acaba (només no-loop)
   */
  play(totalPulses, interval, selectedPulses, loop, onPulse, onComplete) {
    if (!this.isReady) {
      console.warn('Audio not ready');
      return;
    }
    
    // Atura qualsevol reproducció anterior i neteja
    this.stop();
    
    // Invalida callbacks antics
    this.currentScheduleId++;
    const scheduleId = this.currentScheduleId;
    
    // Assegura Transport net i no en loop (gestió pròpia del loop)
    try { Tone.Transport.cancel(); } catch {}
    try { Tone.Transport.stop(); } catch {}
    try { Tone.Transport.position = 0; } catch {}
    Tone.Transport.loop = false;
    
    // Congela la selecció per coherència durant el play
    const selected = new Set(selectedPulses ? Array.from(selectedPulses) : []);
    
    // Opcional: BPM coherent amb l'interval (per si s'usa duració relativa a futur)
    try { Tone.Transport.bpm.value = 60 / interval; } catch {}
    // Durada del clic basada en BPM (constant en segons, no en valors musicals).
    // Clampejada per mantenir transitori consistent a tempos extrems.
    const bpm = 60 / interval;
    const clickDur = Math.max(0.025, Math.min(0.12, interval / 4)); // ~1/16 de negra, 25–120ms
    
    let i = 0;
    // Un sol scheduler periòdic amb "guard-first" per evitar l'event de frontera
    this._repeatId = Tone.Transport.scheduleRepeat((t) => {
      // Invalida si hi ha hagut un nou play/stop
      if (scheduleId !== this.currentScheduleId) return;
      
      // Guard-first: si no hi ha loop i ja hem completat tots els polsos, no disparem res més
      if (!loop && i >= totalPulses) {
        if (typeof onComplete === 'function') {
          // Notifiquem la UI abans de stop(); sense comprobació de scheduleId,
          // perquè aquest stop() invalidarà currentScheduleId.
          Tone.Draw.schedule(onComplete, t);
        }
        // Atura i neteja completament
        this.stop();
        return;
      }
      
      const step = i % totalPulses;
      const pulseType = (step === 0) ? 'accent' : (selected.has(step) ? 'selected' : 'base');
      const sampler = this.samplers[pulseType];
      if (sampler) {
        try { sampler.triggerAttackRelease('C3', clickDur, t); } catch {}
      }
      
      if (typeof onPulse === 'function') {
        Tone.Draw.schedule(() => {
          if (scheduleId === this.currentScheduleId) onPulse(step);
        }, t);
      }
      
      // Increment; si hi ha loop, utilitza i cíclic per estabilitat visual
      i = loop ? (step + 1) : (i + 1);
    }, interval, 0);
    
    this.isPlaying = true;
    // Arrencada amb look-ahead configurable
    try { Tone.Transport.start('+' + this.lookAhead.toFixed(3)); }
    catch { Tone.Transport.start(); }
  }
  
  stop() {
    this.isPlaying = false;
    // Invalida qualsevol callback pendent
    this.currentScheduleId++;
    
    // Neteja de schedulers
    if (this._repeatId != null) {
      try { Tone.Transport.clear(this._repeatId); } catch {}
      this._repeatId = null;
    }
    if (this._stopId != null) {
      try { Tone.Transport.clear(this._stopId); } catch {}
      this._stopId = null;
    }
    
    // Atura i cancel·la tot el Transport
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
    
    // Crear sampler temporal
    const sampler = await this._createSampler(soundKey);
    sampler.triggerAttackRelease('C3', '8n');
    
    // Dispose després d'un segon
    setTimeout(() => sampler.dispose(), 1000);
  }
  
  // Cleanup
  dispose() {
    this.stop();
    Object.values(this.samplers).forEach(sampler => {
      if (sampler) sampler.dispose();
    });
  }
}