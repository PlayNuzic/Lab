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
    global.fetch = jest.fn(() =>
      Promise.reject(Object.assign(new Error('fetch failed'), { name: 'TypeError' }))
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

      expect(pulsoCalls.length).toBe(1);
      expect(pulso0Calls.length).toBe(1);
      expect(accentCalls.length).toBe(1);
    } finally {
      if (audio) audio.stop();
      if (scheduleSpy) scheduleSpy.mockRestore();
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
