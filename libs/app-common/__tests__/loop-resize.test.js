/** @jest-environment jsdom */
import { jest } from '@jest/globals';

const originalRAF = global.requestAnimationFrame;

if (typeof global.structuredClone !== 'function') {
  global.structuredClone = (value) => JSON.parse(JSON.stringify(value));
}

beforeAll(() => {
  global.requestAnimationFrame = (cb) => cb();
  if (typeof global.PointerEvent === 'undefined') {
    global.PointerEvent = class PointerEvent extends Event {
      constructor(type, init = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
        this.button = init.button ?? 0;
        this.clientX = init.clientX ?? 0;
        this.clientY = init.clientY ?? 0;
      }
    };
  }
  // Mock window.matchMedia for jsdom
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

afterAll(() => {
  global.requestAnimationFrame = originalRAF;
});

function setupDom() {
  document.body.innerHTML = `
    <div>
      <button id="muteBtn"></button>
      <select id="themeSelect"><option value="light">light</option></select>
      <div id="controls">
        <input id="inputLg" type="number" value="" />
        <input id="inputV" type="number" value="" />
        <input id="inputT" type="number" value="" />
        <button id="inputVUp"></button>
        <button id="inputVDown"></button>
        <button id="inputLgUp"></button>
        <button id="inputLgDown"></button>
        <span id="ledLg"></span>
        <span id="ledV"></span>
        <span id="ledT"></span>
        <span id="unitLg"></span>
        <span id="unitV"></span>
        <span id="unitT"></span>
        <div id="pulseSeq" contenteditable="true"></div>
        <div id="formula"></div>
        <div id="timelineWrapper" class="timeline-wrapper">
          <div id="timeline"></div>
        </div>
        <button id="playBtn"></button>
        <button id="loopBtn"></button>
        <button id="resetBtn"></button>
        <button id="tapTempoBtn"></button>
        <div id="tapHelp"></div>
        <input id="circularTimelineToggle" type="checkbox" />
        <button id="randomBtn"></button>
        <div id="randomMenu"></div>
        <input id="randLgToggle" type="checkbox" />
        <input id="randLgMin" value="2" />
        <input id="randLgMax" value="30" />
        <input id="randVToggle" type="checkbox" />
        <input id="randVMin" value="40" />
        <input id="randVMax" value="320" />
        <input id="randPulsesToggle" type="checkbox" />
        <input id="randomCount" value="" />
        <input id="randTToggle" type="checkbox" />
        <input id="randTMin" value="0.1" />
        <input id="randTMax" value="10" />
        <select id="selectColor"><option value="default">default</option></select>
        <select id="baseSoundSelect"></select>
        <select id="accentSoundSelect"></select>
        <select id="startSoundSelect"></select>
      </div>
      <details class="menu">
        <summary>Menu</summary>
        <div class="options-content"></div>
      </details>
    </div>
  `;

  const timeline = document.getElementById('timeline');
  const wrapper = document.getElementById('timelineWrapper');
  if (timeline) {
    timeline.getBoundingClientRect = () => ({
      width: 400,
      height: 400,
      top: 0,
      left: 0,
      right: 400,
      bottom: 400,
    });
  }
  if (wrapper) {
    wrapper.getBoundingClientRect = () => ({
      width: 420,
      height: 420,
      top: 0,
      left: 0,
      right: 420,
      bottom: 420,
    });
  }
}

describe('loop resize keeps circular selection', () => {
  beforeEach(() => {
    jest.resetModules();
    setupDom();
    localStorage.clear();
  });

  test('expand/contract loop redraws timeline while preserving selection', async () => {
    const audioInstance = {
      ready: jest.fn(() => Promise.resolve()),
      setBase: jest.fn(() => Promise.resolve()),
      setAccent: jest.fn(() => Promise.resolve()),
      setStart: jest.fn(() => Promise.resolve()),
      setSelected: jest.fn(),
      setLoop: jest.fn(),
      setTotal: jest.fn(),
      setTempo: jest.fn(),
      stop: jest.fn(),
      play: jest.fn(),
    };

    const ensureAudioMock = jest.fn(() => Promise.resolve(audioInstance));
    const timelineCtor = jest.fn(() => audioInstance);

    const fakeChannelState = { id: 'pulse', label: 'Pulso', volume: 1, muted: false, solo: false, allowSolo: true, effectiveMuted: false };
    const fakeMixer = { registerChannel: jest.fn(), getChannelState: jest.fn(() => fakeChannelState) };
    jest.unstable_mockModule('../../sound/index.js', () => ({
      TimelineAudio: timelineCtor,
      ensureAudio: ensureAudioMock,
      waitForUserInteraction: jest.fn(() => Promise.resolve()),
      subscribeMixer: jest.fn(() => () => {}),
      setChannelVolume: jest.fn(),
      setChannelMute: jest.fn(),
      toggleChannelSolo: jest.fn(),
      setChannelSolo: jest.fn(),
      setVolume: jest.fn(),
      getVolume: jest.fn(() => 1),
      setMute: jest.fn(),
      isMuted: jest.fn(() => false),
      getChannelState: jest.fn(() => fakeChannelState),
      getMixer: jest.fn(() => fakeMixer)
    }));
    jest.unstable_mockModule('../../shared-ui/sound-dropdown.js', () => ({
      initSoundDropdown: jest.fn(),
    }));
    jest.unstable_mockModule('../../shared-ui/hover.js', () => ({
      attachHover: jest.fn(),
    }));
    jest.unstable_mockModule('../../random/index.js', () => ({
      initRandomMenu: jest.fn(),
      mergeRandomConfig: jest.fn((defaults, stored) => ({ ...defaults, ...stored })),
      applyBaseRandomConfig: jest.fn(),
      updateBaseRandomConfig: jest.fn(),
    }));
    jest.unstable_mockModule('../audio.js', () => ({
      createSchedulingBridge: jest.fn(() => ({
        handleSchedulingEvent: jest.fn(),
        applyTo: jest.fn(),
      })),
      bindSharedSoundEvents: jest.fn(),
    }));

    await import('../../../Apps/App2/main.js');

    const inputLg = document.getElementById('inputLg');
    const inputV = document.getElementById('inputV');
    const loopBtn = document.getElementById('loopBtn');
    const circularToggle = document.getElementById('circularTimelineToggle');
    const timeline = document.getElementById('timeline');
    const wrapper = document.getElementById('timelineWrapper');

    inputLg.value = '6';
    inputV.value = '120';
    inputLg.dispatchEvent(new Event('input', { bubbles: true }));
    inputV.dispatchEvent(new Event('input', { bubbles: true }));

    const hits = Array.from(document.querySelectorAll('.pulse-hit'));
    expect(hits.length).toBeGreaterThan(4);

    const selectPulse = (index) => {
      const target = hits[index];
      target.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, button: 0, bubbles: true }));
      document.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, button: 0, bubbles: true }));
    };

    selectPulse(2);
    selectPulse(3);

    loopBtn.click();
    circularToggle.checked = true;
    circularToggle.dispatchEvent(new Event('change', { bubbles: true }));

    const selectedIndexes = () => Array.from(document.querySelectorAll('.pulse.selected')).map(el => Number(el.dataset.index));

    expect(timeline.classList.contains('circular')).toBe(true);
    expect(wrapper.classList.contains('circular')).toBe(true);
    expect(selectedIndexes()).toEqual(expect.arrayContaining([2, 3]));

    inputLg.value = '8';
    inputLg.dispatchEvent(new Event('input', { bubbles: true }));

    expect(timeline.querySelectorAll('.pulse').length).toBe(9);
    expect(selectedIndexes()).toEqual(expect.arrayContaining([2, 3]));
    expect(timeline.classList.contains('circular')).toBe(true);

    inputLg.value = '5';
    inputLg.dispatchEvent(new Event('input', { bubbles: true }));

    expect(timeline.querySelectorAll('.pulse').length).toBe(6);
    expect(selectedIndexes()).toEqual(expect.arrayContaining([2, 3]));
    expect(timeline.classList.contains('circular')).toBe(true);
  });
});
