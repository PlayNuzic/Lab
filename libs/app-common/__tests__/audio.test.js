import { jest } from '@jest/globals';

import { createSchedulingBridge, bindSharedSoundEvents } from '../audio.js';

describe('createSchedulingBridge', () => {
  test('queues scheduling detail until audio is ready', () => {
    let audioInstance = null;
    const bridge = createSchedulingBridge({
      getAudio: () => audioInstance,
      defaultProfile: 'desktop'
    });

    bridge.handleSchedulingEvent({ detail: { lookAhead: 0.25, updateInterval: 0.1 } });

    expect(bridge.getPending()).toEqual({ lookAhead: 0.25, updateInterval: 0.1, profile: undefined });

    const audio = {
      setScheduling: jest.fn(),
      setSchedulingProfile: jest.fn()
    };
    audioInstance = audio;

    bridge.applyTo(audio);

    expect(audio.setScheduling).toHaveBeenCalledWith({ lookAhead: 0.25, updateInterval: 0.1 });
    expect(audio.setSchedulingProfile).not.toHaveBeenCalled();
    expect(bridge.getPending()).toBeNull();

    bridge.applyTo(audio);
    expect(audio.setSchedulingProfile).not.toHaveBeenCalled();
  });

  test('applies default profile when no pending detail exists', () => {
    const audio = {
      setScheduling: jest.fn(),
      setSchedulingProfile: jest.fn()
    };
    const bridge = createSchedulingBridge({
      getAudio: () => audio,
      defaultProfile: 'mobile'
    });

    bridge.applyTo(audio);

    expect(audio.setSchedulingProfile).toHaveBeenCalledTimes(1);
    expect(audio.setSchedulingProfile).toHaveBeenCalledWith('mobile');
    expect(audio.setScheduling).not.toHaveBeenCalled();

    bridge.applyTo(audio);
    expect(audio.setSchedulingProfile).toHaveBeenCalledTimes(1);
  });

  test('applies scheduling event immediately when audio is available', () => {
    const audio = {
      setScheduling: jest.fn(),
      setSchedulingProfile: jest.fn()
    };
    const bridge = createSchedulingBridge({
      getAudio: () => audio,
      defaultProfile: 'desktop'
    });

    bridge.handleSchedulingEvent({ detail: { profile: 'mobile', lookAhead: 0.2 } });

    expect(audio.setScheduling).toHaveBeenCalledWith({ lookAhead: 0.2 });
    expect(audio.setSchedulingProfile).toHaveBeenCalledWith('mobile');
    expect(bridge.getPending()).toBeNull();
  });
});

describe('bindSharedSoundEvents', () => {
  test('maps sound events to audio methods and unsubscribes cleanly', async () => {
    const listeners = {};
    const target = {
      addEventListener: jest.fn((type, handler) => {
        listeners[type] = handler;
      }),
      removeEventListener: jest.fn((type, handler) => {
        if (listeners[type] === handler) {
          delete listeners[type];
        }
      })
    };
    const audio = {
      setBase: jest.fn().mockResolvedValue()
    };

    const unsubscribe = bindSharedSoundEvents({
      getAudio: () => audio,
      mapping: { baseSound: 'setBase' },
      target
    });

    expect(target.addEventListener).toHaveBeenCalledWith('sharedui:sound', expect.any(Function));
    const handler = listeners['sharedui:sound'];
    expect(typeof handler).toBe('function');

    await handler({ detail: { type: 'baseSound', value: 'click9' } });
    expect(audio.setBase).toHaveBeenCalledWith('click9');

    unsubscribe();
    expect(target.removeEventListener).toHaveBeenCalledWith('sharedui:sound', handler);
    expect(listeners['sharedui:sound']).toBeUndefined();
  });

  test('ignores events without audio methods or values', async () => {
    const listeners = {};
    const target = {
      addEventListener: jest.fn((type, handler) => {
        listeners[type] = handler;
      }),
      removeEventListener: jest.fn()
    };
    let audio = null;
    const unsubscribe = bindSharedSoundEvents({
      getAudio: () => audio,
      mapping: { baseSound: 'setBase' },
      target
    });

    const handler = listeners['sharedui:sound'];

    await expect(handler({ detail: { type: 'baseSound', value: 'click9' } })).resolves.toBeUndefined();

    audio = { setBase: jest.fn(() => Promise.reject(new Error('boom'))) };
    await expect(handler({ detail: { type: 'baseSound', value: null } })).resolves.toBeUndefined();
    await expect(handler({ detail: { type: 'unknown', value: 'click9' } })).resolves.toBeUndefined();
    await expect(handler({ detail: { type: 'baseSound', value: 'click9' } })).resolves.toBeUndefined();
    expect(audio.setBase).toHaveBeenCalledTimes(1);

    unsubscribe();
  });
});
