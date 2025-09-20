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
    this.loop = false;
    this.totalBeats = 0;

    // Parámetros de tempo
    this.secondsPerBeat = 0;      // duración actual d'un pols en segons
    this.targetSpb = 0;           // objectiu de la rampa (segons per pols)
    this.rampSamplesLeft = 0;     // mostres restants per completar la rampa
    this.rampStep = 0;            // increment de spb per mostra
    this.pendingTempoChange = null; // { targetSpb, rampSamples, align }

    // Fase i contadors
    this.secondsPerSample = 1 / this.sr;
    this.pulseCountdownBeats = 0; // decrementa per mostra; quan <=0 emet "pulse"
    this.currentStep = 0;         // índex del pols (0..total-1)
    this.measurePhaseBeats = 0;   // beats transcorreguts dins la mesura

    // Ciclo (compat API antiga)
    this.cycleNum = 0;          // acento cada N pulsos
    this.cycleDen = 0;          // subdivisiones dentro del ciclo
    this.cycleEvents = [];      // [{ beat, payload }, ...]
    this.nextCycleIndex = 0;

    // Voces polirrítmicas arbitrarias
    // Map<string, {id, num, den, periodBeats, countdownBeats, subIndex}>
    this.voices = new Map();

    this.patternBeats = 0;

    this.port.onmessage = (e) => this._onMessage(e.data);
  }

  _onMessage(msg) {
    switch (msg.action) {
      case 'start': {
        const total = +msg.total || 0;
        const interval = +msg.interval || 0;
        this.loop = !!msg.loop;
        this._start(total, interval, msg.numerator, msg.denominator, msg.pattern);
        break;
      }
      case 'stop': {
        this.active = false;
        break;
      }
      case 'updateInterval': {
        const intervalSec = +msg.interval;
        if (intervalSec > 0) {
          this._scheduleTempoChange({ targetSpb: intervalSec, rampSamples: 0, align: 'immediate' });
        }
        break;
      }
      case 'setBpm':
      case 'setTempo': {
        const intervalSec = msg.interval ? +msg.interval : (msg.bpm ? 60 / (+msg.bpm) : 0);
        const align = (msg.align === 'immediate' || msg.align === 'cycle') ? msg.align
          : 'nextPulse';
        const rampMs = Math.max(0, +msg.rampMs || 0);
        if (intervalSec > 0) {
          const rampSamples = Math.round((rampMs / 1000) * this.sr);
          this._scheduleTempoChange({ targetSpb: intervalSec, rampSamples, align });
        }
        break;
      }
      case 'updateTotal': {
        const total = +msg.total;
        if (Number.isFinite(total) && total > 0) {
          this.totalBeats = total;
          if (this.loop && this.currentStep >= this.totalBeats) this.currentStep %= this.totalBeats;
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
      case 'updatePattern': {
        this._updatePattern(msg.pattern);
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

  _start(total, intervalSec, cycNum, cycDen, pattern) {
    this.totalBeats = Math.max(0, +total || 0);
    this.secondsPerBeat = Math.max(1e-6, +intervalSec || 0.5);
    this.targetSpb = this.secondsPerBeat;
    this.rampSamplesLeft = 0;
    this.rampStep = 0;
    this.pendingTempoChange = null;

    this.pulseCountdownBeats = 0;
    this.currentStep = 0;
    this.measurePhaseBeats = 0;
    this.cycleNum = Math.max(0, +cycNum || 0);
    this.cycleDen = Math.max(0, +cycDen || 0);
    this._updatePattern(pattern, { fallback: this.totalBeats });
    this._resetVoicesCountdown();

    this.active = (this.totalBeats > 0 && this.secondsPerBeat > 0);
  }

  _updatePattern(pattern, { fallback } = {}) {
    const fallbackValue = Number.isFinite(fallback) && fallback > 0
      ? fallback
      : (this.totalBeats > 0 ? this.totalBeats : 0);
    const next = Number.isFinite(+pattern) && +pattern > 0 ? +pattern : fallbackValue;
    this.patternBeats = next;
    this._recomputeCycleEvents();
  }

  _addVoice(v) {
    if (!v || !v.id) return;
    const num = Math.max(1, +v.numerator || 1);
    const den = Math.max(1, +v.denominator || 1);
    const periodBeats = num / den;
    this.voices.set(v.id, {
      id: String(v.id),
      num, den,
      periodBeats,
      countdownBeats: 0.0,
      subIndex: 0
    });
  }

  _resetVoicesCountdown() {
    for (const voice of this.voices.values()) {
      voice.countdownBeats = 0.0;
      voice.subIndex = 0;
    }
  }

  _recomputeCycleEvents() {
    this.cycleEvents = [];
    this.nextCycleIndex = 0;
    if (!this.cycleNum || !this.cycleDen) return;

    const total = this.patternBeats || this.totalBeats;
    if (!total) return;

    const cycles = Math.floor(total / this.cycleNum);
    if (cycles <= 0) return;

    const cycleBeats = this.cycleNum;
    const subBeats = cycleBeats / this.cycleDen;
    for (let ci = 0; ci < cycles; ci++) {
      const startBeat = ci * cycleBeats;
      for (let s = 0; s < this.cycleDen; s++) {
        const beat = startBeat + s * subBeats;
        if (beat < total) {
          this.cycleEvents.push({
            beat,
            cycleIndex: ci,
            subdivisionIndex: s,
            totalSubdivisions: this.cycleDen,
            numerator: this.cycleNum,
            denominator: this.cycleDen,
            totalCycles: cycles
          });
        }
      }
    }

    if (this.cycleEvents.length) {
      const epsilon = 1e-9;
      const totalBeats = this.patternBeats || this.totalBeats || 0;
      let phase = this.measurePhaseBeats || 0;
      if (this.loop && totalBeats > 0) {
        phase %= totalBeats;
      }
      phase = Math.max(0, phase);

      let idx = 0;
      while (idx < this.cycleEvents.length && this.cycleEvents[idx].beat < phase - epsilon) {
        idx++;
      }
      this.nextCycleIndex = idx;
    }
  }

  _emitPulse() {
    this.port.postMessage({ type: 'pulse', step: this.currentStep, interval: this.secondsPerBeat });

    if (!this.loop && this.currentStep + 1 >= this.totalBeats) {
      this.port.postMessage({ type: 'done' });
      this.active = false;
      return;
    }

    if (this.pendingTempoChange && this.pendingTempoChange.align === 'nextPulse') {
      this._applyPendingTempoChange();
    }

    this.currentStep = this.loop && this.totalBeats > 0
      ? (this.currentStep + 1) % this.totalBeats
      : (this.currentStep + 1);

    if (this.loop && this.currentStep === 0) {
      this.measurePhaseBeats = 0;
      this.nextCycleIndex = 0;
      if (this.pendingTempoChange && this.pendingTempoChange.align === 'cycle') {
        this._applyPendingTempoChange();
      }
    }
  }

  _applyPendingTempoChange() {
    if (!this.pendingTempoChange) return;
    const change = this.pendingTempoChange;
    this.pendingTempoChange = null;
    this._beginTempoRamp(change);
  }

  _scheduleTempoChange({ targetSpb, rampSamples, align }) {
    if (!(targetSpb > 0)) return;
    const normalizedAlign = align === 'cycle' ? 'cycle'
      : (align === 'immediate' ? 'immediate' : 'nextPulse');
    const change = {
      targetSpb,
      rampSamples: Math.max(0, Number.isFinite(rampSamples) ? rampSamples : 0),
      align: normalizedAlign
    };
    if (!this.active || change.align === 'immediate') {
      this._beginTempoRamp(change);
    } else {
      this.pendingTempoChange = change;
    }
  }

  _beginTempoRamp({ targetSpb, rampSamples }) {
    if (!(targetSpb > 0)) return;
    const startSpb = this.secondsPerBeat || targetSpb;
    this.targetSpb = targetSpb;
    if (!Number.isFinite(rampSamples) || rampSamples <= 0) {
      this.secondsPerBeat = this.targetSpb;
      this.rampSamplesLeft = 0;
      this.rampStep = 0;
      return;
    }

    this.rampSamplesLeft = rampSamples;
    this.rampStep = (this.targetSpb - startSpb) / rampSamples;
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (output) output.forEach(ch => ch.fill(0)); // silencio
    if (!this.active) return true;

    const block = 128;
    for (let i = 0; i < block; i++) {
      if (this.rampSamplesLeft > 0) {
        this.secondsPerBeat += this.rampStep;
        this.rampSamplesLeft--;
        if (this.rampSamplesLeft <= 0) {
          this.secondsPerBeat = this.targetSpb;
          this.rampStep = 0;
        }
      }

      const beatsPerSample = this.secondsPerSample / this.secondsPerBeat;

      if (this.pendingTempoChange && this.pendingTempoChange.align === 'immediate') {
        this._applyPendingTempoChange();
      }

      this.pulseCountdownBeats -= beatsPerSample;
      this.measurePhaseBeats += beatsPerSample;

      if (this.loop && this.totalBeats > 0) {
        while (this.measurePhaseBeats >= this.totalBeats) {
          this.measurePhaseBeats -= this.totalBeats;
          this.nextCycleIndex = 0;
          if (this.pendingTempoChange && this.pendingTempoChange.align === 'cycle') {
            this._applyPendingTempoChange();
          }
        }
      }

      while (this.pulseCountdownBeats <= 1e-9) {
        this._emitPulse();
        if (!this.active) return true;
        this.pulseCountdownBeats += 1;
      }

      if (this.cycleEvents.length) {
        while (this.nextCycleIndex < this.cycleEvents.length &&
               this.measurePhaseBeats >= this.cycleEvents[this.nextCycleIndex].beat - 1e-9) {
          const payload = this.cycleEvents[this.nextCycleIndex];
          this.port.postMessage({ type: 'cycle', payload });
          this.nextCycleIndex++;
        }
      }

      if (this.voices.size) {
        for (const voice of this.voices.values()) {
          voice.countdownBeats -= beatsPerSample;
          if (voice.countdownBeats <= 1e-9) {
            this.port.postMessage({
              type: 'voice',
              id: voice.id,
              index: voice.subIndex++
            });
            voice.countdownBeats += voice.periodBeats;
          }
        }
      }
    }
    return true;
  }
}

registerProcessor('timeline-processor', TimelineProcessor);
