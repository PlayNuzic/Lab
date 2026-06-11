import { jest } from '@jest/globals';

import {
  TimelineAudio,
  ensureAudio,
  getMixer,
  getVolume,
  setVolume,
  setMute
} from './index.js';

describe('TimelineAudio (new engine)', () => {
  let audioCtxMock;
  let workletMock;
  let gainNodes;

  beforeEach(() => {
    gainNodes = [];
    global.window = global.window || globalThis;
    // Mock fetch to return empty audio buffer to avoid console warnings
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
      })
    );

    class FakeGainNode {
      constructor() {
        this.gain = {
          value: 1,
          setValueAtTime: jest.fn(),
          linearRampToValueAtTime: jest.fn()
        };
      }

      connect(node) {
        this._connected = node;
        return node;
      }
    }

    class FakeOscillatorNode {
      constructor() {
        this.frequency = { setValueAtTime: jest.fn() };
        this.type = 'sine';
        this.start = jest.fn();
        this.stop = jest.fn();
      }

      connect(node) {
        this._connected = node;
        return node;
      }
    }

    class FakeBufferSourceNode {
      constructor() {
        this.connect = jest.fn((node) => node);
        this.start = jest.fn();
        this.stop = jest.fn();
        this.onended = null;
      }
    }

    class FakeAudioContext {
      constructor() {
        audioCtxMock = this;
        this.audioWorklet = { addModule: jest.fn(() => Promise.resolve()) };
        this.createGain = jest.fn(() => {
          const node = new FakeGainNode();
          gainNodes.push(node);
          return node;
        });
        this.createOscillator = jest.fn(() => new FakeOscillatorNode());
        this.createBufferSource = jest.fn(() => new FakeBufferSourceNode());
        this.decodeAudioData = jest.fn(() => Promise.resolve({
          duration: 0.1,
          length: 4800,
          sampleRate: 48000
        }));
        this.destination = {};
        this.currentTime = 0;
        this.sampleRate = 48000;
      }
    }

    class FakeWorkletNode {
      constructor() {
        workletMock = this;
        this.port = { postMessage: jest.fn(), onmessage: null };
        this.connect = jest.fn();
      }
    }

    global.AudioWorkletNode = FakeWorkletNode;
    window.AudioContext = FakeAudioContext;
    window.webkitAudioContext = undefined;
    delete global.Tone;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete global.fetch;
  });

  test('ensureAudio resolves without Tone', async () => {
    await expect(ensureAudio()).resolves.toBeUndefined();
  });

  test('ready initializes audio context and mixer buses', async () => {
    const audio = new TimelineAudio();
    await audio.ready();
    expect(audio.isReady).toBe(true);
    expect(audioCtxMock).toBeTruthy();
    expect(workletMock).toBeTruthy();
    // master + pulso + seleccionados + cycle
    expect(gainNodes.length).toBeGreaterThanOrEqual(4);
  });

  test('setLoop posts message to worklet', async () => {
    const audio = new TimelineAudio();
    await audio.ready();
    audio.setLoop(false);
    expect(workletMock.port.postMessage).toHaveBeenCalledWith({ action: 'setLoop', loop: false });
  });

  test('setPattern posts updatePattern message', async () => {
    const audio = new TimelineAudio();
    await audio.ready();
    workletMock.port.postMessage.mockClear();
    audio.setPattern(7);
    expect(workletMock.port.postMessage).toHaveBeenCalledWith({ action: 'updatePattern', pattern: 7 });
    audio.setPattern(null);
    expect(workletMock.port.postMessage).toHaveBeenCalledWith({ action: 'updatePattern', pattern: 0 });
  });

  test('setSelected stores selection as Set', () => {
    const audio = new TimelineAudio();
    audio.setSelected([1, 3, 5]);
    expect(audio.selectedRef instanceof Set).toBe(true);
    expect(Array.from(audio.selectedRef)).toEqual([1, 3, 5]);
  });

  test('setSelected accepts resolution payloads', () => {
    const audio = new TimelineAudio();
    audio.setSelected({ values: [2, 4], resolution: 6 });
    expect(Array.from(audio.selectedRef)).toEqual([2, 4]);
    expect(audio._selectedResolution).toBe(6);
  });

  test('play respects baseResolution for base pulses while keeping accents', async () => {
    const scheduledTicks = [];
    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;
    global.setInterval = jest.fn((fn) => {
      scheduledTicks.push(fn);
      return 123;
    });
    global.clearInterval = jest.fn();

    let scheduleSpy;
    let audio;
    try {
      audio = new TimelineAudio();
      audio._initPlayers = jest.fn().mockResolvedValue();
      await audio.ready();

      audio._buffers = new Map([
        ['pulso', { buffer: {} }],
        ['pulso0', { buffer: {} }],
        ['seleccionados', { buffer: {} }]
      ]);

      scheduleSpy = jest.spyOn(audio, '_schedulePlayerStart').mockImplementation(() => {});

      audio._lookAheadSec = 2;

      await audio.play(12, 0.5, new Set([4]), false, null, null, { baseResolution: 3 });

      expect(audio.baseResolution).toBe(3);
      expect(audio.getBaseResolution()).toBe(3);

      audio._lastAbsoluteStep = 0;
      audio._lastPulseTime = audio._ctx.currentTime;
      audio._zeroOffset = 0;

      const tick = scheduledTicks[0];
      expect(typeof tick).toBe('function');
      tick();

      const pulsoCalls = scheduleSpy.mock.calls.filter(([key]) => key === 'pulso');
      const pulso0Calls = scheduleSpy.mock.calls.filter(([key]) => key === 'pulso0');
      const accentCalls = scheduleSpy.mock.calls.filter(([key]) => key === 'seleccionados');

      // With baseResolution=3, in a 2-second lookahead at 0.5 sec/pulse (4 pulses total),
      // base steps occur at indices 0, 3. Index 0 is pulso0, so we get 2 pulso calls (indices 0, 3)
      expect(pulsoCalls.length).toBe(2);
      expect(pulso0Calls.length).toBe(1);
      expect(accentCalls.length).toBe(1);

      // Polifonia: cap canal rítmic passa duration — les cues dels samples
      // no es tallen quan comença el següent tret (regressió del fix
      // "seleccionado es talla amb pulso/subdivisión").
      for (const call of [...pulsoCalls, ...pulso0Calls, ...accentCalls]) {
        expect(call[2] ?? null).toBeNull();
      }
    } finally {
      if (audio) audio.stop();
      if (scheduleSpy) scheduleSpy.mockRestore();
      global.setInterval = originalSetInterval;
      global.clearInterval = originalClearInterval;
    }
  });

  test('setTempo while playing cancels lookahead sources before re-scheduling (A-10)', async () => {
    const scheduledTicks = [];
    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;
    global.setInterval = jest.fn((fn) => {
      scheduledTicks.push(fn);
      return 123;
    });
    global.clearInterval = jest.fn();

    let audio;
    try {
      audio = new TimelineAudio();
      audio._initPlayers = jest.fn().mockResolvedValue();
      await audio.ready();

      audio._buffers = new Map([['pulso', { buffer: {} }]]);
      audio._lookAheadSec = 2;

      await audio.play(12, 0.5, new Set(), true);

      audio._lastAbsoluteStep = 0;
      audio._lastPulseTime = audio._ctx.currentTime;
      audio._zeroOffset = 0;

      const tick = scheduledTicks[0];
      tick();

      // Lookahead de 2s a 0.5s/pols → passos 0..4 agendats
      const firstBatch = audioCtxMock.createBufferSource.mock.results.map((r) => r.value);
      expect(firstBatch.length).toBe(5);
      expect(firstBatch.every((s) => s.stop.mock.calls.length === 0)).toBe(true);

      // Canvi de tempo en viu (align nextPulse): rebobina el scheduler.
      // Les fonts dels passos > àncora (1..4) s'han de cancel·lar; la del
      // pas 0 (l'àncora, ja sonant) es manté.
      audio.setTempo(240);

      const stopped = firstBatch.filter((s) => s.stop.mock.calls.length > 0);
      expect(stopped.length).toBe(4);
      expect(firstBatch[0].stop.mock.calls.length).toBe(0);

      // El tick següent re-agenda els passos invalidats amb el nou interval:
      // exactament UNA font viva per pas (cap flam/doble clic).
      tick();
      for (const [, sources] of audio._futureSources) {
        expect(sources.size).toBe(1);
      }

      // stop() neteja el registre de fonts futures
      audio.stop();
      expect(audio._futureSources.size).toBe(0);
    } finally {
      if (audio && audio.isPlaying) audio.stop();
      global.setInterval = originalSetInterval;
      global.clearInterval = originalClearInterval;
    }
  });

  test('pulse message fills the lookahead immediately without waiting for setInterval (A-04)', async () => {
    const scheduledTicks = [];
    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;
    // El setInterval mai es dispara en aquest test: si s'agenda res, ha
    // vingut del camí del MessagePort (_tickFn), no del backup.
    global.setInterval = jest.fn((fn) => {
      scheduledTicks.push(fn);
      return 123;
    });
    global.clearInterval = jest.fn();

    let audio;
    try {
      audio = new TimelineAudio();
      audio._initPlayers = jest.fn().mockResolvedValue();
      await audio.ready();

      audio._buffers = new Map([['pulso', { buffer: {} }]]);
      audio._lookAheadSec = 2;

      await audio.play(12, 0.5, new Set(), true);
      expect(audioCtxMock.createBufferSource.mock.calls.length).toBe(0);

      // Arriba el primer missatge de pols del worklet (àncora del pas 0)
      audio._handleClockMessage({ type: 'pulse', step: 0, time: 0.001, interval: 0.5 });

      // El lookahead s'ha omplert al moment: passos 0..3 agendats (el pas 4
      // cau a 2.001s, just fora de l'horitzó de 2s)
      expect(audioCtxMock.createBufferSource.mock.calls.length).toBe(4);
      // I el temps exacte del pas 0 ja era disponible per a onPulse
      expect(audio._scheduledTimes.get(0)).toBeCloseTo(0.001);
    } finally {
      if (audio) audio.stop();
      global.setInterval = originalSetInterval;
      global.clearInterval = originalClearInterval;
    }
  });

  test('voice handler receives events', async () => {
    const audio = new TimelineAudio();
    await audio.ready();
    const handler = jest.fn();
    audio.setVoiceHandler(handler);
    audio._handleClockMessage({ type: 'voice', id: 'cycle-4x3', index: 2 });
    expect(handler).toHaveBeenCalledWith({ id: 'cycle-4x3', index: 2 });
  });

  test('voice events schedule accent for fractional subdivisions', () => {
    const audio = new TimelineAudio();
    audio._schedulePlayerStart = jest.fn();
    audio._buffers = new Map([['seleccionados', { buffer: {} }]]);
    audio.setVoices([{ id: 'cycle-4x3', numerator: 4, denominator: 3 }]);
    audio._handleClockMessage({ type: 'voice', id: 'cycle-4x3', index: 1 });
    expect(audio._schedulePlayerStart).toHaveBeenCalled();
    const [key, when] = audio._schedulePlayerStart.mock.calls[0];
    expect(key).toBe('seleccionados');
    expect(typeof when).toBe('number');
  });

  test('play keeps interval tied to base pulses', async () => {
    const scheduledTicks = [];
    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;
    global.setInterval = jest.fn((fn) => { scheduledTicks.push(fn); return 123; });
    global.clearInterval = jest.fn();

    try {
      const audio = new TimelineAudio();
      audio._initPlayers = jest.fn().mockResolvedValue();
      await audio.ready();
      audio.setSelected({ values: [2, 4], resolution: 4 });
      await audio.play(8, 0.3, new Set([8]), false, null, null, { baseResolution: 1 });
      expect(audio.intervalRef).toBeCloseTo(0.3);
    } finally {
      global.setInterval = originalSetInterval;
      global.clearInterval = originalClearInterval;
    }
  });

  test('cycle events reset to subdivision 0 after denominator change', async () => {
    const previousSampleRate = global.sampleRate;
    const previousProcessorBase = global.AudioWorkletProcessor;
    const previousRegister = global.registerProcessor;

    try {
      global.sampleRate = 48000;
      class FakeProcessorBase {
        constructor() {
          this.port = { postMessage: jest.fn(), onmessage: null };
        }
      }

      let ProcessorCtor = null;
      global.AudioWorkletProcessor = FakeProcessorBase;
      global.registerProcessor = jest.fn((_, ctor) => { ProcessorCtor = ctor; });

      await import('./timeline-processor.js');
      expect(typeof ProcessorCtor).toBe('function');

      const processor = new ProcessorCtor();
      const cyclePayloads = [];
      processor.port.postMessage = jest.fn((msg) => {
        if (msg && msg.type === 'cycle') {
          cyclePayloads.push(msg.payload);
        }
      });

      processor.port.onmessage({
        data: {
          action: 'start',
          total: 8,
          interval: 0.5,
          loop: true,
          numerator: 4,
          denominator: 4,
          pattern: 8
        }
      });

      const outputs = [[new Float32Array(128)]];
      for (let i = 0; i < 200; i++) {
        processor.process([], outputs);
      }

      processor.measurePhaseBeats = 5e-10;
      processor.nextCycleIndex = processor.cycleEvents.length;

      cyclePayloads.length = 0;

      processor.port.onmessage({
        data: {
          action: 'updateCycle',
          numerator: 4,
          denominator: 6
        }
      });

      expect(processor.nextCycleIndex).toBe(0);

      let firstAfterChange = null;
      for (let i = 0; i < 200 && !firstAfterChange; i++) {
        processor.process([], outputs);
        if (cyclePayloads.length) {
          [firstAfterChange] = cyclePayloads;
        }
      }

      expect(firstAfterChange).toBeTruthy();
      expect(firstAfterChange.subdivisionIndex).toBe(0);
    } finally {
      if (previousSampleRate === undefined) {
        delete global.sampleRate;
      } else {
        global.sampleRate = previousSampleRate;
      }
      if (previousProcessorBase === undefined) {
        delete global.AudioWorkletProcessor;
      } else {
        global.AudioWorkletProcessor = previousProcessorBase;
      }
      if (previousRegister === undefined) {
        delete global.registerProcessor;
      } else {
        global.registerProcessor = previousRegister;
      }
    }
  });

  test('setSchedulingProfile applies preset values', () => {
    const audio = new TimelineAudio();
    audio.setSchedulingProfile('mobile');
    expect(audio._lookAheadSec).toBeCloseTo(0.06);
    expect(audio._schedulerEverySec).toBeCloseTo(0.03);
  });

  test('setPulseEnabled toggles mixer channel', async () => {
    const audio = new TimelineAudio();
    await audio.ready();
    const mixer = getMixer();
    expect(mixer.getChannelState('pulse').muted).toBe(false);
    audio.setPulseEnabled(false);
    expect(mixer.getChannelState('pulse').muted).toBe(true);
    audio.setPulseEnabled(true);
    expect(mixer.getChannelState('pulse').muted).toBe(false);
  });

  test('setBase updates sound assignment even without Tone', async () => {
    const audio = new TimelineAudio();
    await audio.ready();
    await audio.setBase('click2');
    expect(audio._soundAssignments.pulso).toBe('click2');
  });
});

describe('mixer helpers', () => {
  test('setVolume updates mixer and getter reflects it', () => {
    global.Tone = { Destination: { volume: { value: 0 }, mute: false } };
    setVolume(0.5);
    expect(getVolume()).toBeCloseTo(0.5);
    setMute(true);
    expect(getMixer().isMasterMuted()).toBe(true);
  });
});

describe('sample offset (Tier 1)', () => {
  test('_sampleOffsetSec defaults to the balanced preset (LA-01)', () => {
    const audio = new TimelineAudio();
    expect(audio._sampleOffsetSec).toBe(0.006);
    expect(audio._lookAheadSec).toBe(0.03);
    expect(audio._schedulerEverySec).toBe(0.015);
  });

  test('setSampleOffset sets value within bounds', () => {
    const audio = new TimelineAudio();
    audio.setSampleOffset(0.005);
    expect(audio._sampleOffsetSec).toBe(0.005);
  });

  test('setSampleOffset clamps to max 0.02', () => {
    const audio = new TimelineAudio();
    audio.setSampleOffset(0.05);
    expect(audio._sampleOffsetSec).toBe(0.02);
  });

  test('setSampleOffset ignores negative values', () => {
    const audio = new TimelineAudio();
    audio.setSampleOffset(0.01);
    audio.setSampleOffset(-0.005);
    expect(audio._sampleOffsetSec).toBe(0.01);
  });

  test('setScheduling accepts sampleOffset', () => {
    const audio = new TimelineAudio();
    audio.setScheduling({ sampleOffset: 0.008 });
    expect(audio._sampleOffsetSec).toBe(0.008);
  });

  test('configurePerformance accepts sampleOffsetMs and returns it', async () => {
    const audio = new TimelineAudio();
    await audio.ready();
    const info = await audio.configurePerformance({ sampleOffsetMs: 6 });
    expect(audio._sampleOffsetSec).toBeCloseTo(0.006);
    expect(info.sampleOffsetMs).toBeCloseTo(6);
  });

  test('SCHEDULING_PRESETS include sampleOffset', async () => {
    const audio = new TimelineAudio();
    audio.setSchedulingProfile('desktop');
    expect(audio._sampleOffsetSec).toBe(0.005);
    audio.setSchedulingProfile('mobile');
    expect(audio._sampleOffsetSec).toBe(0.008);
  });
});

describe('onSchedule callback (Tier 2)', () => {
  test('_onScheduleRef defaults to null', () => {
    const audio = new TimelineAudio();
    expect(audio._onScheduleRef).toBeNull();
  });

  test('setScheduleHandler sets and clears callback', () => {
    const audio = new TimelineAudio();
    const fn = jest.fn();
    audio.setScheduleHandler(fn);
    expect(audio._onScheduleRef).toBe(fn);
    audio.setScheduleHandler(null);
    expect(audio._onScheduleRef).toBeNull();
  });

  test('play() accepts onSchedule in options', async () => {
    const audio = new TimelineAudio();
    await audio.ready();
    const fn = jest.fn();
    try { await audio.play(4, 0.5, [], false, null, null, { onSchedule: fn }); } catch {}
    expect(audio._onScheduleRef).toBe(fn);
    // Sense stop(), el setInterval real del scheduler queda viu i Jest
    // no surt mai en runs in-band d'aquest fitxer sol.
    audio.stop();
  });

  test('stop() clears onScheduleRef', async () => {
    const audio = new TimelineAudio();
    await audio.ready();
    const fn = jest.fn();
    audio.setScheduleHandler(fn);
    try { await audio.play(4, 0.5, [], false, null, null); } catch {}
    audio.stop();
    expect(audio._onScheduleRef).toBeNull();
  });
});

describe('note providers (Tier 3)', () => {
  test('_noteProviders defaults to empty Map', () => {
    const audio = new TimelineAudio();
    expect(audio._noteProviders).toBeInstanceOf(Map);
    expect(audio._noteProviders.size).toBe(0);
  });

  test('registerNoteProvider adds provider', () => {
    const audio = new TimelineAudio();
    const fn = (step) => [{ midi: 60, duration: 0.5, velocity: 0.8 }];
    audio.registerNoteProvider('melody', fn);
    expect(audio._noteProviders.size).toBe(1);
    expect(audio._noteProviders.get('melody')).toBe(fn);
  });

  test('removeNoteProvider removes provider', () => {
    const audio = new TimelineAudio();
    audio.registerNoteProvider('melody', () => []);
    audio.removeNoteProvider('melody');
    expect(audio._noteProviders.size).toBe(0);
  });

  test('registerNoteProvider rejects invalid args', () => {
    const audio = new TimelineAudio();
    audio.registerNoteProvider(123, () => []);
    audio.registerNoteProvider('test', 'not a function');
    expect(audio._noteProviders.size).toBe(0);
  });

  test('stop() clears note providers', async () => {
    const audio = new TimelineAudio();
    await audio.ready();
    audio.registerNoteProvider('melody', () => []);
    try { await audio.play(4, 0.5, [], false, null, null); } catch {}
    audio.stop();
    expect(audio._noteProviders.size).toBe(0);
  });

  test('multiple providers can coexist', () => {
    const audio = new TimelineAudio();
    audio.registerNoteProvider('melody', (step) => step === 0 ? [{ midi: 60 }] : []);
    audio.registerNoteProvider('bass', (step) => step === 0 ? [{ midi: 36 }] : []);
    expect(audio._noteProviders.size).toBe(2);
    audio.removeNoteProvider('melody');
    expect(audio._noteProviders.size).toBe(1);
    expect(audio._noteProviders.has('bass')).toBe(true);
  });
});
