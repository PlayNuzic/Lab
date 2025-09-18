import { jest } from '@jest/globals';

function createToneMock() {
  let repeatId = 0;
  const repeats = new Map();
  const destination = { mute: false, volume: { value: 0 }, connect: jest.fn() };
  const volumeNodes = [];
  const transport = {
    scheduleRepeat: jest.fn((cb, interval) => {
      repeatId += 1;
      repeats.set(repeatId, { cb, interval });
      return repeatId;
    }),
    start: jest.fn(),
    stop: jest.fn(),
    cancel: jest.fn(),
    clear: jest.fn((id) => {
      repeats.delete(id);
    }),
    bpm: {
      value: 0,
      rampTo: jest.fn(function (value) {
        this.value = value;
      })
    },
    loop: false,
    position: 0,
    seconds: 0,
  };
  class VolumeNode {
    constructor(db = 0) {
      this.volume = { value: db };
      this.mute = false;
      this.disposed = false;
      this.destination = null;
      this.connect = jest.fn((destination) => {
        this.destination = destination;
        return destination;
      });
      this.toDestination = jest.fn(() => {
        this.destination = destination;
        return this;
      });
      this.dispose = jest.fn(() => {
        this.disposed = true;
      });
      volumeNodes.push(this);
    }
  }
  const samplerFactory = jest.fn((opts = {}) => {
    const sampler = {
      toDestination: () => sampler,
      dispose: jest.fn(),
      triggerAttackRelease: jest.fn(),
      connect: jest.fn(() => sampler),
    };
    setTimeout(() => {
      if (typeof opts.onload === 'function') opts.onload();
    }, 0);
    return sampler;
  });
  const partFactory = jest.fn((cb = () => {}, events = []) => {
    const part = {
      callback: cb,
      events,
      start: jest.fn(),
      stop: jest.fn(),
      dispose: jest.fn(),
      loop: false,
      loopEnd: 0,
    };
    return part;
  });
  return {
    Sampler: samplerFactory,
    Volume: VolumeNode,
    Transport: transport,
    Draw: { schedule: jest.fn() },
    getContext: jest.fn(() => ({ lookAhead: 0, updateInterval: 0 })),
    Destination: destination,
    Part: partFactory,
    now: jest.fn(() => transport.seconds),
    __volumeNodes: volumeNodes,
  };
}

global.Tone = createToneMock();

import { TimelineAudio, setVolume, getVolume, getMixer } from './index.js';

describe('TimelineAudio', () => {
  let audio;
  beforeEach(async () => {
    global.Tone = createToneMock();
    audio = new TimelineAudio();
    await audio.ready();
  });

  test('setSelected converts arrays to Set', () => {
    audio.setSelected([1, 3]);
    expect(audio.selectedRef instanceof Set).toBe(true);
    expect([...audio.selectedRef]).toEqual([1, 3]);
  });

  test('setLoop toggles loopRef', () => {
    audio.setLoop(true);
    expect(audio.loopRef).toBe(true);
    audio.setLoop(false);
    expect(audio.loopRef).toBe(false);
  });

  test('setTempo updates transport bpm', () => {
    audio.setTempo(150);
    expect(Tone.Transport.bpm.value).toBe(150);
  });

  test('setTotal updates totalRef', () => {
    audio.setTotal(8);
    expect(audio.totalRef).toBe(8);
  });

  test('setVolume updates mixer master node', () => {
    setVolume(0.5);
    const masterNode = getMixer().master.node;
    expect(masterNode).toBeTruthy();
    expect(masterNode.volume.value).toBeCloseTo(-6.02, 2);
    expect(getVolume()).toBeCloseTo(0.5);
  });

  test('setSchedulingProfile applies presets', () => {
    audio.setSchedulingProfile('mobile');
    expect(audio.lookAhead).toBeCloseTo(0.06);
    expect(audio.updateInterval).toBeCloseTo(0.03);
  });

  test('setBase replaces sampler and updates key', async () => {
    const first = audio.samplers.base;
    await audio.setBase('click1');
    expect(audio.baseKey).toBe('click1');
    expect(audio.samplers.base).not.toBe(first);
    expect(first.dispose).toHaveBeenCalled();
  });

  test('play starts and stop clears transport', () => {
    audio.play(4, 0.5);
    expect(Tone.Transport.scheduleRepeat).toHaveBeenCalled();
    expect(audio.isPlaying).toBe(true);
    audio.stop();
    expect(Tone.Transport.clear).toHaveBeenCalledWith(1);
    expect(audio.isPlaying).toBe(false);
  });

  test('setPulseEnabled syncs with mixer channel mute', () => {
    const mixer = audio.getMixer();
    expect(mixer.getChannelState('pulse').muted).toBe(false);
    audio.setPulseEnabled(false);
    expect(audio.getMixer().getChannelState('pulse').muted).toBe(true);
    audio.setPulseEnabled(true);
    expect(audio.getMixer().getChannelState('pulse').muted).toBe(false);
  });

  test('setCycleEnabled syncs with mixer channel mute', () => {
    const mixer = audio.getMixer();
    expect(mixer.getChannelState('subdivision').muted).toBe(false);
    audio.setCycleEnabled(false);
    expect(mixer.getChannelState('subdivision').muted).toBe(true);
    audio.setCycleEnabled(true);
    expect(mixer.getChannelState('subdivision').muted).toBe(false);
  });

  test('play uses interval-based duration with fade out', () => {
    audio.play(4, 0.5);
    const repeatCb = Tone.Transport.scheduleRepeat.mock.calls[0][0];
    repeatCb(0);
    const fade = Math.min(0.05, 0.5 / 2);
    const dur = 0.5 - fade;
    expect(audio.samplers.start.release).toBeCloseTo(fade, 5);
    expect(audio.samplers.start.triggerAttackRelease).toHaveBeenCalledWith('C3', dur, 0);
  });

  test('updateCycleConfig keeps pulses aligned when adjusting during playback', () => {
    const onCycle = jest.fn();
    const onPulse = jest.fn();
    audio.play(8, 0.5, undefined, true, onPulse, undefined, { cycle: { numerator: 2, denominator: 2, onTick: onCycle } });

    const repeatCb = Tone.Transport.scheduleRepeat.mock.calls[0][0];

    Tone.Transport.seconds = 0;
    repeatCb(0);
    Tone.Transport.seconds = 0.5;
    repeatCb(0.5);
    Tone.Transport.seconds = 1.0;
    repeatCb(1.0);
    expect(audio.pulseIndex).toBe(3);

    Tone.Transport.seconds = 1.25;
    audio.updateCycleConfig({
      numerator: 2,
      denominator: 2,
      totalPulses: 8,
      interval: 0.5,
      onTick: onCycle,
    });
    expect(audio.pulseIndex).toBe(3);

    Tone.Transport.seconds = 1.5;
    repeatCb(1.5);
    Tone.Transport.seconds = 2.0;
    repeatCb(2.0);
    Tone.Transport.seconds = 2.5;
    repeatCb(2.5);
    Tone.Transport.seconds = 3.0;
    repeatCb(3.0);
    Tone.Transport.seconds = 3.5;
    repeatCb(3.5);
    expect(audio.pulseIndex).toBe(8);

    Tone.Transport.seconds = 3.75;
    audio.updateCycleConfig({
      numerator: 2,
      denominator: 2,
      totalPulses: 8,
      interval: 0.5,
      onTick: onCycle,
    });
    expect(audio.pulseIndex).toBe(0);
  });
});
