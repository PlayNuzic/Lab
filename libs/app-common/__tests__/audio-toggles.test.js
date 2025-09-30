import { describe, expect, it, jest } from '@jest/globals';
import { initAudioToggles } from '../audio-toggles.js';

describe('audio toggles setState', () => {
  function createFakeButton() {
    return {
      classList: { toggle: jest.fn() },
      setAttribute: jest.fn(),
      dataset: {},
      addEventListener: jest.fn()
    };
  }

  it('skips mixer mute changes when originated from the mixer source', () => {
    const setChannelMute = jest.fn();
    const onChange = jest.fn();
    const button = createFakeButton();

    const { get } = initAudioToggles({
      toggles: [
        {
          id: 'master',
          button,
          mixerChannel: 'master',
          onChange,
          defaultEnabled: true
        }
      ],
      mixer: { setChannelMute }
    });

    const controller = get('master');
    expect(controller).toBeDefined();

    setChannelMute.mockClear();
    onChange.mockClear();

    controller.set(false, { source: 'mixer', persist: false });

    expect(setChannelMute).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith(false, { persist: false, source: 'mixer' });

    controller.set(true, { source: 'ui' });

    expect(setChannelMute).toHaveBeenCalledTimes(1);
    expect(setChannelMute).toHaveBeenCalledWith('master', false);
  });
});
