// libs/sound/timeline-processor.js
// AudioWorklet: reloj polirrítmico sample-accurate (sin swing).
// Emite eventos de "pulse" (pulso base), "cycle" (subdivisión tipo ciclo)
// y "voice" (voces/razones independientes). No produce audio.

class TimelineProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sr = sampleRate;

    // Estado base
    this.active = false;
    this.intervalSamples = 0;   // duración del pulso (60/BPM * sr)
    this.totalPulses = 0;
    this.loop = false;

    // Fase y contadores
    this.pulseCountdown = 0.0;  // decrementa por muestra; cuando <=0 emite "pulse"
    this.step = 0;              // índice de pulso (0..total-1)
    this.measureElapsed = 0;    // muestras transcurridas dentro de la medida (para "cycle")

    // Ciclo (compat API antigua)
    this.cycleNum = 0;          // acento cada N pulsos
    this.cycleDen = 0;          // subdivisiones dentro del ciclo
    this.cycleEvents = [];      // [[timeSecDentroMedida, payload], ...]
    this.nextCycleIndex = 0;

    // Voces polirrítmicas arbitrarias
    // Map<string, {id, num, den, tick, countdown, subIndex}>
    this.voices = new Map();

    // Cambios de tempo (rampa)
    this.rampRemaining = 0;       // muestras restantes de rampa
    this.targetInterval = 0;      // intervalo objetivo en muestras
    this.alignAtNextPulse = false;// aplicar al próximo pulso

    this.port.onmessage = (e) => this._onMessage(e.data);
  }

  _onMessage(msg) {
    switch (msg.action) {
      case 'start': {
        const total = +msg.total || 0;
        const interval = +msg.interval || 0;
        this.loop = !!msg.loop;
        this._start(total, interval, msg.numerator, msg.denominator);
        break;
      }
      case 'stop': {
        this.active = false;
        break;
      }
      case 'updateInterval': {
        const intervalSec = +msg.interval;
        if (intervalSec > 0) {
          this.intervalSamples = intervalSec * this.sr;
          this._recomputeVoiceTicks();
          this._recomputeCycleEvents();
        }
        break;
      }
      case 'setBpm': {
        const intervalSec = msg.interval ? +msg.interval : (msg.bpm ? 60 / (+msg.bpm) : 0);
        const align = msg.align || 'nextPulse';       // 'immediate' | 'nextPulse'
        const rampMs = Math.max(0, +msg.rampMs || 0);
        if (intervalSec > 0) {
          const target = intervalSec * this.sr;
          if (align === 'nextPulse') {
            this.alignAtNextPulse = true;
            this.targetInterval = target;
            this.rampRemaining = Math.round((rampMs / 1000) * this.sr);
          } else {
            this.alignAtNextPulse = false;
            this.targetInterval = target;
            this.rampRemaining = Math.round((rampMs / 1000) * this.sr);
            if (this.rampRemaining === 0) {
              this.intervalSamples = this.targetInterval;
              this._recomputeVoiceTicks();
              this._recomputeCycleEvents();
            }
          }
        }
        break;
      }
      case 'updateTotal': {
        const total = +msg.total;
        if (Number.isFinite(total) && total > 0) {
          this.totalPulses = total;
          if (this.loop && this.step >= this.totalPulses) this.step %= this.totalPulses;
          this._recomputeCycleEvents();
        }
        break;
      }
      case 'updateCycle': {
        this.cycleNum = Math.max(0, +msg.numerator || 0);
        this.cycleDen = Math.max(0, +msg.denominator || 0);
        this._recomputeCycleEvents();
        break;
      }
      case 'setVoices': {
        this.voices.clear();
        if (Array.isArray(msg.voices)) {
          for (const v of msg.voices) this._addVoice(v);
        }
        break;
      }
      case 'addVoice': {
        this._addVoice(msg.voice);
        break;
      }
      case 'removeVoice': {
        if (msg && msg.id) this.voices.delete(msg.id);
        break;
      }
      case 'setLoop': {
        this.loop = !!msg.loop;
        break;
      }
      default: break;
    }
  }

  _start(total, intervalSec, cycNum, cycDen) {
    this.totalPulses = Math.max(0, +total || 0);
    this.intervalSamples = Math.max(0, (+intervalSec || 0) * this.sr);
    this.pulseCountdown = 0.0;
    this.step = 0;
    this.measureElapsed = 0;
    this.cycleNum = Math.max(0, +cycNum || 0);
    this.cycleDen = Math.max(0, +cycDen || 0);
    this._recomputeCycleEvents();
    this._recomputeVoiceTicks();
    this.rampRemaining = 0;
    this.alignAtNextPulse = false;
    this.active = (this.totalPulses > 0 && this.intervalSamples > 0);
  }

  _addVoice(v) {
    if (!v || !v.id) return;
    const num = Math.max(1, +v.numerator || 1);
    const den = Math.max(1, +v.denominator || 1);
    const tick = (this.intervalSamples * num) / den;
    this.voices.set(v.id, {
      id: String(v.id),
      num, den,
      tick,
      countdown: 0.0,
      subIndex: 0
    });
  }

  _recomputeVoiceTicks() {
    for (const voice of this.voices.values()) {
      voice.tick = (this.intervalSamples * voice.num) / voice.den;
    }
  }

  _recomputeCycleEvents() {
    this.cycleEvents = [];
    this.nextCycleIndex = 0;
    if (!this.cycleNum || !this.cycleDen || !this.totalPulses || !this.intervalSamples) return;

    const intervalSec = this.intervalSamples / this.sr;
    const totalDuration = this.totalPulses * intervalSec;
    const cycles = Math.floor(this.totalPulses / this.cycleNum);
    if (cycles <= 0) return;

    const cycleDur = this.cycleNum * intervalSec;
    const subDur = cycleDur / this.cycleDen;
    for (let ci = 0; ci < cycles; ci++) {
      const startT = ci * cycleDur;
      for (let s = 0; s < this.cycleDen; s++) {
        const t = startT + s * subDur;
        if (t < totalDuration) {
          this.cycleEvents.push([t, {
            cycleIndex: ci,
            subdivisionIndex: s,
            totalSubdivisions: this.cycleDen,
            numerator: this.cycleNum,
            denominator: this.cycleDen,
            totalCycles: cycles
          }]);
        }
      }
    }
  }

  _tickBasePulse() {
    this.port.postMessage({ type: 'pulse', step: this.step });

    if (!this.loop && this.step + 1 >= this.totalPulses) {
      this.port.postMessage({ type: 'done' });
      this.active = false;
      return;
    }
    this.step = this.loop ? ((this.step + 1) % this.totalPulses) : (this.step + 1);
    if (this.loop && this.step === 0) {
      this.measureElapsed = 0;
      this.nextCycleIndex = 0;
    }
    this.pulseCountdown += this.intervalSamples;

    if (this.alignAtNextPulse && this.targetInterval > 0) {
      if (this.rampRemaining === 0) {
        this.intervalSamples = this.targetInterval;
        this._recomputeVoiceTicks();
        this._recomputeCycleEvents();
      }
      this.alignAtNextPulse = false;
    }
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (output) output.forEach(ch => ch.fill(0)); // silencio
    if (!this.active) return true;

    const block = 128;
    for (let i = 0; i < block; i++) {
      if (!this.alignAtNextPulse && this.rampRemaining > 0) {
        const delta = this.targetInterval - this.intervalSamples;
        const step = delta / this.rampRemaining;
        this.intervalSamples += step;
        this.rampRemaining--;
        if (this.rampRemaining === 0) {
          this.intervalSamples = this.targetInterval;
          this._recomputeVoiceTicks();
          this._recomputeCycleEvents();
        }
      }

      if (this.pulseCountdown <= 0) this._tickBasePulse();

      if (this.cycleEvents.length) {
        const currentSec = this.measureElapsed / this.sr;
        while (this.nextCycleIndex < this.cycleEvents.length &&
               currentSec >= this.cycleEvents[this.nextCycleIndex][0] - 1e-9) {
          this.port.postMessage({ type: 'cycle', payload: this.cycleEvents[this.nextCycleIndex][1] });
          this.nextCycleIndex++;
          if (this.loop && this.nextCycleIndex >= this.cycleEvents.length) {
            this.nextCycleIndex = 0;
          }
        }
      }

      if (this.voices.size) {
        for (const voice of this.voices.values()) {
          if (voice.countdown <= 0) {
            this.port.postMessage({
              type: 'voice',
              id: voice.id,
              index: voice.subIndex++
            });
            voice.countdown += voice.tick;
          }
          voice.countdown -= 1;
        }
      }

      this.pulseCountdown -= 1;
      this.measureElapsed += 1;
    }
    return true;
  }
}

registerProcessor('timeline-processor', TimelineProcessor);
