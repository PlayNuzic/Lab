import { AudioMixer } from './mixer.js';

describe('AudioMixer solo behaviour', () => {
  function createMixerWithChannels() {
    const mixer = new AudioMixer();
    mixer.registerChannel('a', { allowSolo: true, label: 'A' });
    mixer.registerChannel('b', { allowSolo: true, label: 'B' });
    mixer.registerChannel('c', { allowSolo: true, label: 'C' });
    return mixer;
  }

  test('solo mutes other channels and restores them afterwards', () => {
    const mixer = createMixerWithChannels();
    mixer.setChannelSolo('a', true);

    const aState = mixer.getChannelState('a');
    const bState = mixer.getChannelState('b');
    const cState = mixer.getChannelState('c');

    expect(aState.solo).toBe(true);
    expect(aState.muted).toBe(false);
    expect(bState.muted).toBe(true);
    expect(cState.muted).toBe(true);

    mixer.setChannelSolo('a', false);

    expect(mixer.getChannelState('a').muted).toBe(false);
    expect(mixer.getChannelState('b').muted).toBe(false);
    expect(mixer.getChannelState('c').muted).toBe(false);
  });

  test('activating another solo switches focus and keeps others suppressed', () => {
    const mixer = createMixerWithChannels();
    mixer.setChannelSolo('a', true);
    mixer.setChannelSolo('b', true);

    const aState = mixer.getChannelState('a');
    const bState = mixer.getChannelState('b');
    const cState = mixer.getChannelState('c');

    expect(aState.solo).toBe(false);
    expect(aState.muted).toBe(true);
    expect(bState.solo).toBe(true);
    expect(bState.muted).toBe(false);
    expect(cState.muted).toBe(true);
  });

  test('manual mute preferences survive solo overrides', () => {
    const mixer = createMixerWithChannels();
    mixer.setChannelMute('b', true);
    mixer.setChannelSolo('a', true);

    expect(mixer.getChannelState('b').muted).toBe(true);

    mixer.setChannelSolo('a', false);
    expect(mixer.getChannelState('b').muted).toBe(true);
  });

  test('manual changes while soloed are restored afterwards', () => {
    const mixer = createMixerWithChannels();
    mixer.setChannelSolo('a', true);
    mixer.setChannelMute('b', false);
    mixer.setChannelMute('a', true);

    expect(mixer.getChannelState('b').muted).toBe(true);
    expect(mixer.getChannelState('a').muted).toBe(false);

    mixer.setChannelSolo('a', false);

    expect(mixer.getChannelState('b').muted).toBe(false);
    expect(mixer.getChannelState('a').muted).toBe(true);
  });
});
