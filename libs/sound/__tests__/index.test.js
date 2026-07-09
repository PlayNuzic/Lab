import { jest } from '@jest/globals';

import {
  TimelineAudio,
  ensureAudio,
  getMixer,
  getVolume,
  setVolume,
  setMute
} from '../index.js';

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

  test('voice events with own channel skip the reactive accent fallback (F4)', () => {
    const audio = new TimelineAudio();
    audio._schedulePlayerStart = jest.fn();
    audio._buffers = new Map([['seleccionados', { buffer: {} }]]);
    // Canal propi → l'àudio surt pre-agendat de _scheduleVoiceAudio; el
    // camí reactiu no ha de doblar-lo.
    audio.setVoices([{ id: 'frac-f2', numerator: 4, denominator: 3, channel: 'frac2' }]);
    audio._handleClockMessage({ type: 'voice', id: 'frac-f2', index: 1 });
    expect(audio._schedulePlayerStart).not.toHaveBeenCalled();
  });

  test('setVoices strips channel before posting to the worklet (F4)', async () => {
    const audio = new TimelineAudio();
    await audio.ready();
    workletMock.port.postMessage.mockClear();
    audio.setVoices([{ id: 'frac-f2', numerator: 1, denominator: 3, channel: 'frac2' }]);
    expect(workletMock.port.postMessage).toHaveBeenCalledWith({
      action: 'setVoices',
      voices: [{ id: 'frac-f2', numerator: 1, denominator: 3 }]
    });
    expect(audio._voiceDefs.get('frac-f2').channel).toBe('frac2');
  });

  test('voice audio is pre-scheduled on its own channel bus (F4)', async () => {
    const audio = new TimelineAudio();
    audio._initPlayers = jest.fn().mockResolvedValue();
    await audio.ready();
    audio._buffers = new Map([['cycle', { buffer: {} }]]);
    audio.setVoices([{ id: 'frac-f2', numerator: 1, denominator: 3, channel: 'frac2' }]);
    const spy = jest.spyOn(audio, '_schedulePlayerStart').mockImplementation(() => {});
    audio._patternBeats = 4;
    audio.totalRef = 5; // single-shot: pols final inclòs però sense subdivisió

    // Segment [0, 1): període 1/3 → esdeveniments a 0, 1/3 i 2/3
    audio._scheduleVoiceAudio({ stepIndex: 0, sampleWhen: 10, segDur: 0.5, absStep: 0 });
    const calls = spy.mock.calls.filter(([key]) => key === 'cycle');
    expect(calls.length).toBe(3);
    expect(calls[0][1]).toBeCloseTo(10);
    expect(calls[1][1]).toBeCloseTo(10 + 0.5 / 3);
    expect(calls[2][1]).toBeCloseTo(10 + 1 / 3);
    const bus = audio._voiceBuses.get('frac2');
    expect(bus).toBeTruthy();
    expect(calls.every((call) => call[4] === bus)).toBe(true);

    // Pols final (stepIndex = patternBeats): cap so de subdivisió, com el
    // camí de cicle legacy (cycleEventBeats talla a beat < pattern).
    spy.mockClear();
    audio._scheduleVoiceAudio({ stepIndex: 4, sampleWhen: 12, segDur: 0.5, absStep: 4 });
    expect(spy).not.toHaveBeenCalled();

    // Canal silenciat al mixer → res s'agenda (paritat amb el cicle legacy)
    spy.mockClear();
    audio._mixerChannelMuted = new Map([['frac2', true]]);
    audio._scheduleVoiceAudio({ stepIndex: 1, sampleWhen: 11, segDur: 0.5, absStep: 1 });
    expect(spy).not.toHaveBeenCalled();
  });

  test('setCycleChannel re-routes the cycle mute mapping (F4)', async () => {
    const audio = new TimelineAudio();
    await audio.ready();
    audio.setCycleChannel('frac1');
    audio._applyMixerState({
      master: { volume: 0.8, effectiveMuted: false },
      channels: [
        { id: 'subdivision', volume: 0.75, effectiveMuted: false },
        { id: 'frac1', volume: 0.5, effectiveMuted: true }
      ]
    });
    expect(audio._cycleMutedForFallback).toBe(true);
    // El bus de cicle segueix el canal re-apuntat (gain = 0 per mute)
    expect(audio._bus.cycle.gain.value).toBe(0);
  });

  test('setSelected accepts { value, channel } entries alongside legacy numbers (F4b)', () => {
    const audio = new TimelineAudio();
    // Només números → comportament idèntic al d'abans (cap canal etiquetat)
    audio.setSelected({ values: [1, 3, 5], resolution: 2 });
    expect(Array.from(audio.selectedRef)).toEqual([1, 3, 5]);
    expect(audio._selectedChannels.size).toBe(0);
    expect(audio._selectedResolution).toBe(2);

    // Barreja: el Set conté tots els valors; el Map només els etiquetats.
    // Valor repetit amb canals diferents → la primera etiqueta guanya
    // (cada valor sona per exactament un bus).
    audio.setSelected({
      values: [2, { value: 3.5, channel: 'fracSel1' }, { value: 7 }, { value: 3.5, channel: 'fracSel2' }],
      resolution: 1
    });
    expect(Array.from(audio.selectedRef).sort((a, b) => a - b)).toEqual([2, 3.5, 7]);
    expect(audio._selectedChannels.get(3.5)).toBe('fracSel1');
    expect(audio._selectedChannels.has(2)).toBe(false);
    expect(audio._selectedChannels.has(7)).toBe(false);
  });

  test('selected values with channel are scheduled on their own channel bus (F4b)', async () => {
    const scheduledTicks = [];
    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;
    global.setInterval = jest.fn((fn) => { scheduledTicks.push(fn); return 123; });
    global.clearInterval = jest.fn();

    let audio;
    let spy;
    try {
      audio = new TimelineAudio();
      audio._initPlayers = jest.fn().mockResolvedValue();
      await audio.ready();
      audio._buffers = new Map([
        ['pulso', { buffer: {} }],
        ['seleccionados', { buffer: {} }]
      ]);
      spy = jest.spyOn(audio, '_schedulePlayerStart').mockImplementation(() => {});
      audio._lookAheadSec = 2;

      // Pas 1 etiquetat (fracSel1), pas 2 legacy (número pelat)
      await audio.play(8, 0.5, { values: [{ value: 1, channel: 'fracSel1' }, 2], resolution: 1 }, false);

      audio._lastAbsoluteStep = 0;
      audio._lastPulseTime = audio._ctx.currentTime;
      audio._zeroOffset = 0;
      scheduledTicks[0]();

      const selCalls = spy.mock.calls.filter(([key]) => key === 'seleccionados');
      expect(selCalls.length).toBe(2);
      // Pas 1 → bus lazy del canal fracSel1 (creat per _ensureVoiceBus)
      const bus = audio._voiceBuses.get('fracSel1');
      expect(bus).toBeTruthy();
      expect(selCalls[0][4]).toBe(bus);
      // Pas 2 → destination null: _schedulePlayerStart cau al bus legacy
      // 'seleccionados' (camí intacte per als números)
      expect(selCalls[1][4] ?? null).toBeNull();
    } finally {
      if (audio) audio.stop();
      if (spy) spy.mockRestore();
      global.setInterval = originalSetInterval;
      global.clearInterval = originalClearInterval;
    }
  });

  test('selected channel muted in the mixer skips scheduling but keeps the rest (F4b)', async () => {
    const scheduledTicks = [];
    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;
    global.setInterval = jest.fn((fn) => { scheduledTicks.push(fn); return 123; });
    global.clearInterval = jest.fn();

    let audio;
    let spy;
    try {
      audio = new TimelineAudio();
      audio._initPlayers = jest.fn().mockResolvedValue();
      await audio.ready();
      audio._buffers = new Map([['seleccionados', { buffer: {} }]]);
      spy = jest.spyOn(audio, '_schedulePlayerStart').mockImplementation(() => {});
      audio._lookAheadSec = 2;

      await audio.play(8, 0.5, { values: [{ value: 1, channel: 'fracSel1' }, 2], resolution: 1 }, false);
      // Canal etiquetat silenciat al mixer → cap font per al pas 1
      // (paritat amb _scheduleVoiceAudio); el pas 2 legacy segueix sonant.
      audio._mixerChannelMuted = new Map([['fracSel1', true]]);

      audio._lastAbsoluteStep = 0;
      audio._lastPulseTime = audio._ctx.currentTime;
      audio._zeroOffset = 0;
      scheduledTicks[0]();

      const selCalls = spy.mock.calls.filter(([key]) => key === 'seleccionados');
      expect(selCalls.length).toBe(1);
      expect(selCalls[0][4] ?? null).toBeNull();
      // I el mute no s'ha "suplert" amb el beep de fallback: sense buffer
      // de pols, els passos base NO seleccionats (0, 3, 4) beepegen com
      // sempre; el pas 1 (seleccionat amb canal mutat) ha de quedar marcat
      // com a triggered i NO afegir-ne un quart.
      expect(audioCtxMock.createOscillator.mock.calls.length).toBe(3);
    } finally {
      if (audio) audio.stop();
      if (spy) spy.mockRestore();
      global.setInterval = originalSetInterval;
      global.clearInterval = originalClearInterval;
    }
  });

  test('teardown clears selected-channel buses and channel map survives re-set (F4b)', async () => {
    const audio = new TimelineAudio();
    await audio.ready();
    expect(audio._ensureVoiceBus('fracSel2')).toBeTruthy();
    expect(audio._voiceBuses.size).toBe(1);
    audio._teardownAudioGraph();
    expect(audio._voiceBuses.size).toBe(0);
    // Una selecció nova substitueix el mapa de canals sencer (cap residu)
    audio.setSelected({ values: [{ value: 4, channel: 'fracSel3' }], resolution: 1 });
    audio.setSelected({ values: [4], resolution: 1 });
    expect(audio._selectedChannels.size).toBe(0);
  });

  test('teardown desconnecta i neteja _previewGain (A-09)', async () => {
    const audio = new TimelineAudio();
    await audio.ready();
    // Simula un preview previ: el GainNode memoitzat del context vell.
    // Sense el fix, sobrevivia al teardown i el preview següent connectava
    // el buffer del context NOU al gain del VELL (InvalidAccessError mut).
    const fake = { disconnect: jest.fn() };
    audio._previewGain = fake;
    audio._teardownAudioGraph();
    expect(fake.disconnect).toHaveBeenCalled();
    expect(audio._previewGain).toBeNull();
  });

  test('setChannelSound stores assignments lazily and loads them at init (F4c)', async () => {
    const audio = new TimelineAudio();
    // Pre-gest (sense context): només es desa l'assignació
    await audio.setChannelSound('frac1', 'click3');
    expect(audio.getChannelSound('frac1')).toBe('click3');
    expect(audio._buffers.has('channel:frac1')).toBe(false);

    // _initPlayers (dins ready) carrega el buffer de l'override pendent
    await audio.ready();
    expect(audio._buffers.has('channel:frac1')).toBe(true);

    // Amb context viu: càrrega immediata
    await audio.setChannelSound('fracSel2', 'click4');
    expect(audio._buffers.has('channel:fracSel2')).toBe(true);

    // null/'' elimina l'override (torna al sample de ROL)
    await audio.setChannelSound('frac1', null);
    expect(audio.getChannelSound('frac1')).toBeNull();
    expect(audio._buffers.has('channel:frac1')).toBe(false);

    // El teardown buida els buffers però CONSERVA les assignacions
    // (es re-carregaran al proper _initPlayers)
    audio._teardownAudioGraph();
    expect(audio.getChannelSound('fracSel2')).toBe('click4');
  });

  test('channel buffer resolution: override wins, role is the fallback (F4c)', () => {
    const audio = new TimelineAudio();
    // Sense override → rol
    expect(audio._resolveChannelBufferKey('frac1', 'cycle')).toBe('cycle');
    // Override assignat però buffer ENCARA no carregat → rol (cap forat)
    audio._channelSounds.set('frac2', 'click4');
    expect(audio._resolveChannelBufferKey('frac2', 'cycle')).toBe('cycle');
    // Buffer carregat → la clau del canal guanya
    audio._buffers.set('channel:frac2', { buffer: {} });
    expect(audio._resolveChannelBufferKey('frac2', 'cycle')).toBe('channel:frac2');
    // Canal sense channelId (rutes legacy) → rol
    expect(audio._resolveChannelBufferKey(null, 'pulso')).toBe('pulso');
  });

  test('voice audio uses the per-channel sample override (F4c)', async () => {
    const audio = new TimelineAudio();
    audio._initPlayers = jest.fn().mockResolvedValue();
    await audio.ready();
    audio._buffers = new Map([
      ['cycle', { buffer: {} }],
      ['channel:frac2', { buffer: {} }]
    ]);
    audio._channelSounds.set('frac2', 'click4');
    audio.setVoices([
      { id: 'frac-f2', numerator: 1, denominator: 2, channel: 'frac2' },
      { id: 'frac-f3', numerator: 1, denominator: 2, channel: 'frac3' }
    ]);
    const spy = jest.spyOn(audio, '_schedulePlayerStart').mockImplementation(() => {});
    audio._patternBeats = 4;
    audio.totalRef = 4;

    audio._scheduleVoiceAudio({ stepIndex: 0, sampleWhen: 10, segDur: 0.5, absStep: 0 });
    // frac2 (amb override) sona amb el seu sample; frac3 (sense) amb el rol
    const frac2Calls = spy.mock.calls.filter(([key]) => key === 'channel:frac2');
    const roleCalls = spy.mock.calls.filter(([key]) => key === 'cycle');
    expect(frac2Calls.length).toBe(2); // període 1/2 → beats 0 i 0.5
    expect(roleCalls.length).toBe(2);
    expect(frac2Calls.every((call) => call[4] === audio._voiceBuses.get('frac2'))).toBe(true);
    expect(roleCalls.every((call) => call[4] === audio._voiceBuses.get('frac3'))).toBe(true);
  });

  test('pulse, selected and cycle paths resolve channel overrides at schedule time (F4c)', async () => {
    const scheduledTicks = [];
    const originalSetInterval = global.setInterval;
    const originalClearInterval = global.clearInterval;
    global.setInterval = jest.fn((fn) => { scheduledTicks.push(fn); return 123; });
    global.clearInterval = jest.fn();

    let audio;
    let spy;
    try {
      audio = new TimelineAudio();
      audio._initPlayers = jest.fn().mockResolvedValue();
      await audio.ready();
      audio._buffers = new Map([
        ['pulso', { buffer: {} }],
        ['seleccionados', { buffer: {} }],
        ['cycle', { buffer: {} }],
        ['channel:pulse', { buffer: {} }],
        ['channel:accent', { buffer: {} }],
        ['channel:fracSel1', { buffer: {} }],
        ['channel:frac1', { buffer: {} }]
      ]);
      audio._channelSounds = new Map([
        ['pulse', 'click3'],
        ['accent', 'click5'],
        ['fracSel1', 'click4'],
        ['frac1', 'click6']
      ]);
      audio.setCycleChannel('frac1');
      spy = jest.spyOn(audio, '_schedulePlayerStart').mockImplementation(() => {});
      audio._lookAheadSec = 2;

      // Pas 1 etiquetat (fracSel1) + pas 2 legacy (canal 'accent')
      await audio.play(8, 0.5, { values: [{ value: 1, channel: 'fracSel1' }, 2], resolution: 1 }, false);
      audio._cycleConfig = { numerator: 1, denominator: 2 };
      audio._lastAbsoluteStep = 0;
      audio._lastPulseTime = audio._ctx.currentTime;
      audio._zeroOffset = 0;
      scheduledTicks[0]();

      // Pols base → override del canal 'pulse' pel bus de pols
      const pulseCalls = spy.mock.calls.filter(([key]) => key === 'channel:pulse');
      expect(pulseCalls.length).toBeGreaterThan(0);
      expect(spy.mock.calls.some(([key]) => key === 'pulso')).toBe(false);
      expect(pulseCalls.every((call) => call[4] === audio._bus.pulso)).toBe(true);

      // Selecció legacy → override del canal 'accent' pel bus de seleccionats
      const accentCalls = spy.mock.calls.filter(([key]) => key === 'channel:accent');
      expect(accentCalls.length).toBe(1);
      expect(accentCalls[0][4]).toBe(audio._bus.seleccionados);

      // Selecció etiquetada → override del seu canal pel bus lazy del canal
      const selCalls = spy.mock.calls.filter(([key]) => key === 'channel:fracSel1');
      expect(selCalls.length).toBe(1);
      expect(selCalls[0][4]).toBe(audio._voiceBuses.get('fracSel1'));
      expect(spy.mock.calls.some(([key]) => key === 'seleccionados')).toBe(false);

      // Cicle → override del canal de cicle re-apuntat (frac1) pel bus de cicle
      const cycleCalls = spy.mock.calls.filter(([key]) => key === 'channel:frac1');
      expect(cycleCalls.length).toBeGreaterThan(0);
      expect(spy.mock.calls.some(([key]) => key === 'cycle')).toBe(false);
      expect(cycleCalls.every((call) => call[4] === audio._bus.cycle)).toBe(true);
    } finally {
      if (audio) audio.stop();
      if (spy) spy.mockRestore();
      global.setInterval = originalSetInterval;
      global.clearInterval = originalClearInterval;
    }
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

      await import('../timeline-processor.js');
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
