import { jest } from '@jest/globals';

function createToneMock() {
  const transport = {
    scheduleRepeat: jest.fn(() => 1),
    start: jest.fn(),
    stop: jest.fn(),
    cancel: jest.fn(),
    clear: jest.fn(),
    bpm: { value: 0 },
    loop: false,
    position: 0,
  };
  const samplerFactory = jest.fn((opts = {}) => {
    const sampler = {
      toDestination: () => sampler,
      dispose: jest.fn(),
      triggerAttackRelease: jest.fn(),
    };
    setTimeout(() => {
      if (typeof opts.onload === 'function') opts.onload();
    }, 0);
    return sampler;
  });
  return {
    Sampler: samplerFactory,
    Transport: transport,
    Draw: { schedule: jest.fn() },
    getContext: jest.fn(() => ({ lookAhead: 0, updateInterval: 0 })),
    Destination: { mute: false, volume: { value: 0 } },
  };
}

global.Tone = createToneMock();

import { TimelineAudio, setVolume, getVolume } from './index.js';

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

  test('setVolume updates Destination volume', () => {
    setVolume(0.5);
    expect(Tone.Destination.volume.value).toBeCloseTo(-6.02, 2);
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

  test('play uses interval-based duration with fade out', () => {
    audio.play(4, 0.5);
    const repeatCb = Tone.Transport.scheduleRepeat.mock.calls[0][0];
    repeatCb(0);
    const fade = Math.min(0.05, 0.5 / 2);
    const dur = 0.5 - fade;
    expect(audio.samplers.start.release).toBeCloseTo(fade, 5);
    expect(audio.samplers.start.triggerAttackRelease).toHaveBeenCalledWith('C3', dur, 0);
  });
});
