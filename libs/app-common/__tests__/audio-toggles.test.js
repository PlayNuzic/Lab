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

  it('applyTo replica l\'estat actual (mixer + onChange) per a la init tardana (H-11)', () => {
    const setChannelMute = jest.fn();
    const onChange = jest.fn();

    const manager = initAudioToggles({
      toggles: [
        {
          id: 'pulse',
          button: createFakeButton(),
          mixerChannel: 'pulse',
          defaultEnabled: true,
          onChange
        }
      ],
      mixer: { setChannelMute }
    });

    // Canvi fet ABANS que el motor existeixi (l'onChange de l'app el
    // deixaria caure perquè audio === null)
    manager.get('pulse').set(false, { persist: false });

    setChannelMute.mockClear();
    onChange.mockClear();

    // El motor ja existeix: replicar estat
    manager.applyTo();

    expect(setChannelMute).toHaveBeenCalledWith('pulse', true); // mute (enabled=false)
    expect(onChange).toHaveBeenCalledWith(false, { persist: false, source: 'applyTo' });
  });
});
