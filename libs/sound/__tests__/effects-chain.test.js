/**
 * A-04 (auditoria 2026-07-06): la cadena d'efectes del màster
 * (eq→compressor→limiter→reverb→destination) es cableja SEMPRE al build;
 * només la sortida del màster depèn de l'estat d'efectes. Sense això, un
 * rebuild del graf amb FX off + setEffectsEnabled(true) deixava el motor
 * en silenci total (master→eq sense sortida) fins a recarregar la pàgina.
 *
 * Fitxer propi amb un mock CAPAÇ d'efectes: el FakeAudioContext
 * d'index.test.js no té createBiquadFilter/createDynamicsCompressor/
 * createConvolver, així que tota aquella suite pren el fallback i la
 * branca d'efectes quedava sense cap cobertura (caveat de l'informe).
 *
 * Estratègia d'assert: es registren totes les arestes connect()/disconnect()
 * i es comprova per ABASTABILITAT (BFS) que des del màster s'arriba a
 * destination — més fort que assertar arestes concretes.
 */

import { jest } from '@jest/globals';
import { TimelineAudio } from '../index.js';

// ── Graf d'arestes compartit entre tots els FakeNode ──
const edges = new Set();
let nextId = 1;

function edgeKey(a, b) { return a.__name + '→' + b.__name; }

class FakeNode {
  constructor(kind) {
    this.__name = kind + '#' + (nextId++);
  }
  connect(target) {
    edges.add(edgeKey(this, target));
    return target;
  }
  disconnect() {
    for (const e of [...edges]) {
      if (e.startsWith(this.__name + '→')) edges.delete(e);
    }
  }
}

function mkParam(value = 0) {
  return { value, setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn() };
}

class FakeAudioContext {
  constructor() {
    this.audioWorklet = { addModule: jest.fn(() => Promise.resolve()) };
    this.destination = new FakeNode('destination');
    this.currentTime = 0;
    this.sampleRate = 48000;
    this.state = 'running';
    this._listeners = {};
  }
  addEventListener(type, fn) {
    (this._listeners[type] ??= []).push(fn);
  }
  _fire(type) {
    (this._listeners[type] || []).forEach((fn) => fn());
  }
  createGain() {
    const n = new FakeNode('gain');
    n.gain = mkParam(1);
    return n;
  }
  createBiquadFilter() {
    const n = new FakeNode('biquad');
    n.type = 'lowpass';
    n.frequency = mkParam(350);
    n.gain = mkParam(0);
    return n;
  }
  createDynamicsCompressor() {
    const n = new FakeNode('comp');
    n.threshold = mkParam(-24);
    n.knee = mkParam(30);
    n.ratio = mkParam(12);
    n.attack = mkParam(0.003);
    n.release = mkParam(0.25);
    return n;
  }
  createConvolver() {
    const n = new FakeNode('convolver');
    n.buffer = null;
    return n;
  }
  createBuffer(channels, length, sampleRate) {
    return {
      numberOfChannels: channels,
      length,
      sampleRate,
      getChannelData: () => new Float32Array(length)
    };
  }
  createBufferSource() {
    const n = new FakeNode('bufsrc');
    n.start = jest.fn();
    n.stop = jest.fn();
    n.onended = null;
    return n;
  }
  createOscillator() {
    const n = new FakeNode('osc');
    n.frequency = mkParam(440);
    n.type = 'sine';
    n.start = jest.fn();
    n.stop = jest.fn();
    return n;
  }
  decodeAudioData() {
    return Promise.resolve({ duration: 0.1, length: 4800, sampleRate: 48000 });
  }
  resume() { return Promise.resolve(); }
}

class FakeWorkletNode extends FakeNode {
  constructor() {
    super('worklet');
    this.port = { postMessage: jest.fn(), onmessage: null };
  }
}

/** BFS: es pot arribar de `from` a `to` seguint les arestes registrades? */
function abastable(from, to) {
  const objectiu = to.__name;
  const vistos = new Set([from.__name]);
  const cua = [from.__name];
  while (cua.length) {
    const actual = cua.shift();
    if (actual === objectiu) return true;
    for (const e of edges) {
      const [a, b] = e.split('→');
      if (a === actual && !vistos.has(b)) { vistos.add(b); cua.push(b); }
    }
  }
  return false;
}

describe('cadena d\'efectes del màster (A-04)', () => {
  beforeEach(() => {
    edges.clear();
    nextId = 1;
    global.window = global.window || globalThis;
    global.fetch = jest.fn(() => Promise.resolve({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
    }));
    global.AudioWorkletNode = FakeWorkletNode;
    window.AudioContext = FakeAudioContext;
    window.webkitAudioContext = undefined;
    delete global.Tone;
  });

  test('build normal (FX on): el màster arriba a destination per la cadena', async () => {
    const audio = new TimelineAudio();
    await audio.ready();
    expect(audio._bus.effects).toBeTruthy();          // el mock capaç activa la branca real
    expect(abastable(audio._bus.master, audio._ctx.destination)).toBe(true);
  });

  test('toggle off→on en calent (sense rebuild): sempre hi ha so', async () => {
    const audio = new TimelineAudio();
    await audio.ready();
    audio.setEffectsEnabled(false);
    expect(abastable(audio._bus.master, audio._ctx.destination)).toBe(true); // directe
    audio.setEffectsEnabled(true);
    expect(abastable(audio._bus.master, audio._ctx.destination)).toBe(true); // per la cadena
  });

  test('A-04: rebuild amb FX off + re-activar NO deixa el motor mut', async () => {
    const audio = new TimelineAudio();
    await audio.ready();
    audio.setEffectsEnabled(false);

    // Rebuild fidel al camí :718 (canvi de context): teardown + _ensureContext
    // amb _effectsEnabled=false → el build pren la branca else.
    audio._teardownAudioGraph();
    await audio._ensureContext();
    expect(audio._bus.effects).toBeTruthy();
    expect(abastable(audio._bus.master, audio._ctx.destination)).toBe(true); // FX off: directe

    // El punt del bug: re-activar després del rebuild-off. Sense el fix,
    // master→eq no tenia continuació (eq→comp i reverbMix→destination
    // només es cablejaven a la branca enabled) → destination inabastable.
    audio.setEffectsEnabled(true);
    expect(abastable(audio._bus.master, audio._ctx.destination)).toBe(true);
  });

  test('A-08: context tancat pel SO a mig playback → teardown + recuperació al següent ready()', async () => {
    const audio = new TimelineAudio();
    try {
      await audio.ready();
      await audio.play(4, 0.5, new Set(), false);
      const ctxVell = audio._ctx;
      expect(audio._node).toBeTruthy();

      // El SO tanca el context (Android/WebView): 'closed' és irreversible.
      ctxVell.state = 'closed';
      ctxVell._fire('statechange');

      // Sense el fix: stop() però _node/_ctx vius → zombie mut per sempre.
      expect(audio.isPlaying).toBe(false);
      expect(audio._node).toBeNull();
      expect(audio._ctx).toBeNull();

      // Recuperació: el següent ready() construeix context i graf NOUS.
      await audio.ready();
      expect(audio._ctx).toBeTruthy();
      expect(audio._ctx).not.toBe(ctxVell);
      expect(audio._node).toBeTruthy();
      expect(abastable(audio._bus.master, audio._ctx.destination)).toBe(true);
    } finally {
      audio.stop();
    }
  });

  test('paritat amb FX off: el màster va directe (cap senyal per la cadena)', async () => {
    const audio = new TimelineAudio();
    await audio.ready();
    audio.setEffectsEnabled(false);
    audio._teardownAudioGraph();
    await audio._ensureContext();
    // Directe sí; per l'eq no (la cadena viva però sense entrada de senyal).
    expect(edges.has(edgeKey(audio._bus.master, audio._ctx.destination))).toBe(true);
    expect(edges.has(edgeKey(audio._bus.master, audio._bus.effects.eq))).toBe(false);
  });
});
