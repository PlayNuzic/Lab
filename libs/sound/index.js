// libs/sound/index.js
// TimelineAudio (motor híbrido): AudioWorklet = reloj; main = disparo de samples.
// API compatible (play/stop/setTempo/updateCycleConfig/setTotal), con extras:
//   - setVoices/addVoice/removeVoice (polirritmos arbitrarios)
//   - configurePerformance({ requestedSampleRate, scheduleHorizonMs })  // schedulerIntervalMs es lectura
// Integración de samples desde libs/sound/samples/ + buses de mixer: Master, Pulso, P.Seleccionados.

import { loadSampleMap } from './sample-map.js';

/* global Tone */
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

export class TimelineAudio {
  constructor() {
    this.isReady = false;
    this.isPlaying = false;

    // Parámetros musicales
    this.totalRef = 0;              // nº pulsos/medida
    this.intervalRef = 0;           // seg/pulso = 60/BPM
    this.loopRef = true;

    // Callbacks
    this._onPulseRef = null;
    this.onCompleteRef = null;
    this._cycleConfig = null;       // { numerator, denominator, onCycle }

    // UI
    this._lastStep = null;
    this._lastPulseTime = null;

    // Selecciones de usuario (acentos)
    this.selectedRef = new Set();

    // WebAudio / Worklet / scheduler
    this._ctx = null;
    this._node = null;
    this._schedulerId = null;
    this._lookAheadSec = 0.12;      // horizonte de programación
    this._schedulerEverySec = 0.02; // adaptativo (lectura sugerida ~20ms)

    // Buses de mezcla (Master, Pulso, Seleccionados)
    this._bus = { master: null, pulso: null, seleccionados: null };

    // Players Tone (si está cargado)
    this._players = null;           // Tone.Players
    this._sampleMap = null;         // rutas resueltas

    // Fallback synth si no hay Tone
    this._fallbackGain = null;

    // Tap-tempo
    this._tapTimes = [];

    // Exponer motor para el menú de “Rendimiento Audio”
    try { window.NuzicAudioEngine = this; } catch {}
  }

  // ---- init ---------------------------------------------------------------

  async _ensureContext() {
    if (this._ctx) return;

    // 1) Contexto (nota: el navegador puede ignorar el sampleRate solicitado)
    this._ctx = (typeof Tone !== 'undefined' && Tone?.context?.rawContext)
      ? Tone.context.rawContext
      : new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });

    // 2) Worklet
    await this._ctx.audioWorklet.addModule(new URL('./timeline-processor.js', import.meta.url));
    this._node = new AudioWorkletNode(this._ctx, 'timeline-processor');

    // 3) Buses de mezcla
    this._bus.master = this._ctx.createGain();
    this._bus.pulso = this._ctx.createGain();
    this._bus.seleccionados = this._ctx.createGain();
    this._bus.pulso.connect(this._bus.master);
    this._bus.seleccionados.connect(this._bus.master);
    this._bus.master.connect(this._ctx.destination);

    // 4) Players de samples (si Tone está presente)
    await this._initPlayers();

    // 5) Conexión Node
    this._node.connect(this._bus.master);
    this._node.port.onmessage = (e) => this._handleClockMessage(e.data);

    // 6) Fallback synth si no hay Tone
    if (typeof Tone === 'undefined') {
      const g = this._ctx.createGain();
      g.gain.value = 0.0;
      g.connect(this._bus.pulso); // mismo bus de pulso
      this._fallbackGain = g;
    }

    // 7) Integración con mixer.js si expone registro de buses
    try {
      const Mixer = await import('./mixer.js');
      const reg = Mixer?.registerExternalBuses || Mixer?.default?.registerExternalBuses;
      if (typeof reg === 'function') {
        reg({
          master: this._bus.master,
          pulso: this._bus.pulso,
          seleccionados: this._bus.seleccionados
        }, this._ctx);
      }
    } catch { /* si no existe mixer.js o no exporta, seguimos */ }

    this.isReady = true;
  }

  async _initPlayers() {
    if (typeof Tone === 'undefined') return;
    this._sampleMap = await loadSampleMap();

    const sources = {};
    if (this._sampleMap.pulso) sources.pulso = this._sampleMap.pulso;
    if (this._sampleMap.pulso0) sources.pulso0 = this._sampleMap.pulso0;
    if (this._sampleMap.seleccionados) sources.seleccionados = this._sampleMap.seleccionados;
    if (this._sampleMap.start) sources.start = this._sampleMap.start;
    if (this._sampleMap.cycle) sources.cycle = this._sampleMap.cycle;

    if (Object.keys(sources).length === 0) return;

    this._players = new Tone.Players(sources).toDestination();

    // Reenrutamos cada player a su bus correspondiente
    const connectSafe = (key, dest) => {
      try { this._players.player(key).connect(dest); } catch {}
    };
    connectSafe('pulso', this._bus.pulso);
    connectSafe('pulso0', this._bus.pulso);
    connectSafe('seleccionados', this._bus.seleccionados);
    connectSafe('start', this._bus.pulso);
    connectSafe('cycle', this._bus.pulso);
  }

  // ---- API pública (compat) -----------------------------------------------

  async play(totalPulses, intervalSec, selectedPulses, loop, onPulse, onComplete, options = {}) {
    await this._ensureContext();

    this.totalRef = Math.max(1, +totalPulses || 1);
    this.intervalRef = Math.max(1e-6, +intervalSec || 0.5);
    this.loopRef = !!loop;
    this.selectedRef = new Set(Array.isArray(selectedPulses) ? selectedPulses : (selectedPulses || []));
    this._onPulseRef = (typeof onPulse === 'function') ? onPulse : null;
    this.onCompleteRef = (typeof onComplete === 'function') ? onComplete : null;

    const cyc = options?.cycle;
    this._cycleConfig = (cyc && Number.isFinite(+cyc.numerator) && Number.isFinite(+cyc.denominator))
      ? { numerator: +cyc.numerator, denominator: +cyc.denominator, onCycle: (cyc.onCycle || null) }
      : null;

    // Arranca reloj
    this._node.port.postMessage({
      action: 'start',
      total: this.totalRef,
      interval: this.intervalRef,
      loop: this.loopRef,
      numerator: this._cycleConfig?.numerator || 0,
      denominator: this._cycleConfig?.denominator || 0
    });

    // Scheduler de audio
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
    const align = opts.align || 'nextPulse';   // 'immediate' | 'nextPulse'
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

  // ---- Polirritmos (voces arbitrarias) -----------------------------------

  setVoices(voices = []) { this._node?.port?.postMessage({ action: 'setVoices', voices }); }
  addVoice(voice) { if (voice && voice.id) this._node?.port?.postMessage({ action: 'addVoice', voice }); }
  removeVoice(id) { if (id) this._node?.port?.postMessage({ action: 'removeVoice', id }); }

  // ---- Rendimiento (para el menú compartido) ------------------------------

  async configurePerformance({ requestedSampleRate, scheduleHorizonMs } = {}) {
    // El SR SOLO se aplica si aún no hay contexto. Si ya existe, solo informativo.
    if (requestedSampleRate && !this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)({
        latencyHint: 'interactive',
        sampleRate: +requestedSampleRate
      });
      // re‑ejecuta init con este contexto
      await this._ensureContext();
    }
    if (Number.isFinite(+scheduleHorizonMs)) {
      this._lookAheadSec = clamp(+scheduleHorizonMs / 1000, 0.02, 0.4);
      this._adaptSchedulerInterval(); // interval auto en función de streams
    }
    return {
      requestedSampleRate: requestedSampleRate || null,
      actualSampleRate: this._ctx ? this._ctx.sampleRate : null,
      scheduleHorizonMs: Math.round(this._lookAheadSec * 1000),
      schedulerIntervalMs: Math.round(this._schedulerEverySec * 1000) // solo lectura
    };
  }

  // ---- Interna: scheduler de audio (disparo de samples) -------------------

  _startScheduler() {
    if (!this._ctx) return;
    const ctx = this._ctx;
    const scheduleHorizon = () => ctx.currentTime + this._lookAheadSec;
    const clickDur = Math.max(0.01, this.intervalRef * 0.8);

    // Limpia anterior
    if (this._schedulerId != null) clearInterval(this._schedulerId);
    this._adaptSchedulerInterval();

    // Funciones de disparo
    const triggerBeep = (when, freq = 1000, gain = 0.3, dur = clickDur) => {
      if (!this._fallbackGain) return;
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

    // Cálculo de tiempo absoluto de un step n usando la última marca de Worklet
    this._stepTime = (stepIndex) => {
      if (this._lastStep == null || this._lastPulseTime == null) return null;
      const deltaSteps = stepIndex - this._lastStep;
      return this._lastPulseTime + deltaSteps * this.intervalRef;
    };

    // Cursor de steps programados
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

        // ¿acento/selección?
        const isStart = (n % this.totalRef) === 0;
        const isSelected = this.selectedRef.has(n % this.totalRef);

        if (this._players) {
          if (isStart && this._players.player('start')) triggerPlayer('start', when);
          else if (isSelected && this._players.player('seleccionados')) triggerPlayer('seleccionados', when);
          else if (this._players.player('pulso')) triggerPlayer('pulso', when);
          else if (this._players.player('pulso0')) triggerPlayer('pulso0', when);
        } else {
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
    // Heurística: cuanto más streams activos (pulso, seleccionados, ciclo, voces),
    // más corto el intervalo (hasta 10 ms); pocos streams → 20–30 ms.
    const streams =
      1 + (this.selectedRef.size > 0 ? 1 : 0) +
      (this._cycleConfig?.denominator ? 1 : 0);
    const ms = clamp(20 - (streams - 1) * 3, 10, 30);
    this._schedulerEverySec = ms / 1000;
  }

  // ---- Reloj: mensajes de Worklet -----------------------------------------

  _handleClockMessage(msg) {
    const now = this._ctx.currentTime;
    if (msg.type === 'pulse') {
      this._lastStep = msg.step;
      this._lastPulseTime = now;
      if (typeof this._onPulseRef === 'function') this._onPulseRef(msg.step);
    } else if (msg.type === 'cycle') {
      if (this._cycleConfig?.onCycle) this._cycleConfig.onCycle(msg.payload);
      // Si hay sample específico de ciclo:
      if (this._players?.player('cycle')) {
        try { this._players.player('cycle').start(now + 0.001); } catch {}
      }
    } else if (msg.type === 'voice') {
      // Gancho futuro: mapear voces a samples específicos si lo deseáis
    } else if (msg.type === 'done') {
      if (typeof this.onCompleteRef === 'function') this.onCompleteRef();
      this.stop();
    }
  }

  // ---- Utilidades ---------------------------------------------------------

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
