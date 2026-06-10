/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';

// Mocks de les peces que el shell composa — aquí només es verifica el cablejat.
const mixerMock = { registerChannel: jest.fn() };
const subscribeMixerMock = jest.fn(() => () => {});
const setupAudioDefaultsMock = jest.fn();
const rhythmInitMock = jest.fn();
const melodicInitMock = jest.fn();
const bindSharedSoundEventsMock = jest.fn();
const createSchedulingBridgeMock = jest.fn(() => ({ handleSchedulingEvent: jest.fn() }));
const initMixerMenuMock = jest.fn();
const setupThemeSyncMock = jest.fn();
const setupMutePersistenceMock = jest.fn();
const registerFactoryResetMock = jest.fn();

jest.unstable_mockModule('../../sound/index.js', () => ({
  getMixer: () => mixerMock,
  subscribeMixer: subscribeMixerMock
}));
jest.unstable_mockModule('../audio-init.js', () => ({
  createRhythmAudioInitializer: jest.fn(() => rhythmInitMock),
  createMelodicAudioInitializer: jest.fn(() => melodicInitMock),
  setupAudioDefaults: setupAudioDefaultsMock
}));
jest.unstable_mockModule('../audio.js', () => ({
  createSchedulingBridge: createSchedulingBridgeMock,
  bindSharedSoundEvents: bindSharedSoundEventsMock
}));
jest.unstable_mockModule('../mixer-menu.js', () => ({
  initMixerMenu: initMixerMenuMock
}));
jest.unstable_mockModule('../preferences.js', () => ({
  createPreferenceStorage: jest.fn(({ prefix }) => {
    const data = new Map();
    return {
      load: jest.fn((k) => data.get(`${prefix}::${k}`) ?? null),
      save: jest.fn((k, v) => data.set(`${prefix}::${k}`, v)),
      clear: jest.fn((k) => data.delete(`${prefix}::${k}`)),
      _data: data
    };
  }),
  registerFactoryReset: registerFactoryResetMock,
  setupThemeSync: setupThemeSyncMock,
  setupMutePersistence: setupMutePersistenceMock
}));

const { createFractionAppShell } = await import('../fraction-app-shell.js');

function makeEngine() {
  return {
    setPulseEnabled: jest.fn(),
    setCycleEnabled: jest.fn(),
    setMute: jest.fn(),
    setBase: jest.fn().mockResolvedValue(),
    setCycle: jest.fn().mockResolvedValue()
  };
}

function makeShell(overrides = {}) {
  let audio = null;
  const pulseBtn = document.createElement('button');
  const cycleBtn = document.createElement('button');
  const shell = createFractionAppShell({
    prefix: 'apptest',
    getAudio: () => audio,
    setAudio: (a) => { audio = a; },
    audio: { type: 'rhythm', channelTier: ['x'], ...overrides.audio },
    toggles: overrides.toggles ?? [
      { id: 'pulse', button: pulseBtn, storageKey: 'pulseAudio', mixerChannel: 'pulse', engineSetter: 'setPulseEnabled' },
      { id: 'cycle', button: cycleBtn, storageKey: 'cycleAudio', mixerChannel: 'subdivision', engineSetter: 'setCycleEnabled' }
    ],
    mixer: { menu: document.createElement('div'), triggers: [], channels: [{ id: 'master' }] },
    theme: {}
  });
  return { shell, getAudio: () => audio };
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('createFractionAppShell', () => {
  test('valida prefix i accessors', () => {
    expect(() => createFractionAppShell({})).toThrow(/prefix/);
    expect(() => createFractionAppShell({ prefix: 'x' })).toThrow(/getAudio/);
  });

  test('rhythm: bridge + sound events + mixer menu + theme/mute cablejats', () => {
    makeShell({ audio: { soundEventMapping: { baseSound: 'setBase' } } });
    expect(createSchedulingBridgeMock).toHaveBeenCalled();
    expect(bindSharedSoundEventsMock).toHaveBeenCalledWith(expect.objectContaining({
      mapping: { baseSound: 'setBase' }
    }));
    expect(initMixerMenuMock).toHaveBeenCalled();
    expect(setupThemeSyncMock).toHaveBeenCalled();
    expect(setupMutePersistenceMock).toHaveBeenCalled();
    expect(registerFactoryResetMock).toHaveBeenCalled();
  });

  test('melodic: sense bridge; initAudio aplica tier, mute desat i selects', async () => {
    const engine = makeEngine();
    melodicInitMock.mockResolvedValue(engine);

    const baseSoundSelect = document.createElement('div');
    baseSoundSelect.dataset.value = 'click9';
    const { shell, getAudio } = makeShell({
      audio: {
        type: 'melodic',
        channelTier: ['m'],
        getSoundSelects: () => ({ baseSoundSelect })
      },
      toggles: []
    });
    expect(createSchedulingBridgeMock).not.toHaveBeenCalled();

    shell.save('mute', '1');
    const instance = await shell.initAudio();

    expect(instance).toBe(engine);
    expect(getAudio()).toBe(engine);
    expect(setupAudioDefaultsMock).toHaveBeenCalledWith(engine, { channels: ['m'] });
    expect(engine.setMute).toHaveBeenCalledWith(true);
    expect(engine.setBase).toHaveBeenCalledWith('click9');
    expect(window.NuzicAudioEngine).toBe(engine);
    expect(window.__labAudio).toBe(engine);

    // Segona crida: retorna la mateixa instància sense re-executar el base init
    melodicInitMock.mockClear();
    await expect(shell.initAudio()).resolves.toBe(engine);
    expect(melodicInitMock).not.toHaveBeenCalled();
  });

  test('initAudio re-aplica l\'estat dels toggles via engineSetter', async () => {
    const engine = makeEngine();
    rhythmInitMock.mockResolvedValue(engine);

    const { shell } = makeShell();
    shell.setToggle('pulse', false, { persist: false });
    await shell.initAudio();

    expect(engine.setPulseEnabled).toHaveBeenLastCalledWith(false);
    expect(engine.setCycleEnabled).toHaveBeenLastCalledWith(true);
  });

  test('el factory reset reinicia tots els toggles a actiu', () => {
    const engine = makeEngine();
    rhythmInitMock.mockResolvedValue(engine);
    const { shell } = makeShell();
    shell.setToggle('pulse', false, { persist: false });

    const { onBeforeReload } = registerFactoryResetMock.mock.calls[0][0];
    onBeforeReload();

    expect(shell.getToggle('pulse').isEnabled()).toBe(true);
    expect(shell.getToggle('cycle').isEnabled()).toBe(true);
  });
});
