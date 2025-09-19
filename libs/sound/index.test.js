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

    class FakeGainNode {
      constructor() {
        this.gain = { value: 1 };
        this.connect = jest.fn();
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

  test('setSelected stores selection as Set', () => {
    const audio = new TimelineAudio();
    audio.setSelected([1, 3, 5]);
    expect(audio.selectedRef instanceof Set).toBe(true);
    expect(Array.from(audio.selectedRef)).toEqual([1, 3, 5]);
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
