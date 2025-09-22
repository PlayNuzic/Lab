import {
  TimelineAudio,
  ensureAudio,
  getMixer,
  subscribeMixer,
  setChannelVolume,
  setChannelMute,
  setChannelSolo
} from '../../libs/sound/index.js';
import { initSoundDropdown } from '../../libs/shared-ui/sound-dropdown.js';
import { createSchedulingBridge, bindSharedSoundEvents } from '../../libs/app-common/audio.js';
import { initMixerMenu } from '../../libs/app-common/mixer-menu.js';

const APP_STORAGE_PREFIX = 'app4';
const STORE_KEY = (key) => `${APP_STORAGE_PREFIX}::${key}`;

let audio = null;
let mixerSyncGuard = false;

const schedulingBridge = createSchedulingBridge({ getAudio: () => audio });
window.addEventListener('sharedui:scheduling', schedulingBridge.handleSchedulingEvent);

bindSharedSoundEvents({
  getAudio: () => audio,
  mapping: {
    baseSound: 'setBase',
    selectedSound: 'setAccent',
    startSound: 'setStart',
    cycleSound: 'setCycle'
  }
});

const state = {
  isPlaying: false,
  audioReady: false
};

const selectors = {
  playBtn: () => document.getElementById('playBtn'),
  baseSoundSelect: () => document.getElementById('baseSoundSelect'),
  selectedSoundSelect: () => document.getElementById('accentSoundSelect'),
  startSoundSelect: () => document.getElementById('startSoundSelect'),
  mixerMenu: () => document.getElementById('mixerMenu')
};

function createPlaceholder() {
  const middleSection = document.querySelector('.middle');
  if (!middleSection) return null;
  const container = document.createElement('div');
  container.className = 'app4-placeholder';
  const title = document.createElement('h2');
  title.textContent = 'Pulsos Fraccionados';
  const message = document.createElement('p');
  message.textContent = 'La interfaz interactiva estará disponible en los siguientes pasos.';
  const status = document.createElement('p');
  status.className = 'app4-placeholder__status';
  status.textContent = 'Detenido';
  container.append(title, message, status);
  middleSection.appendChild(container);
  return container;
}

function updatePlaceholder(placeholder) {
  if (!placeholder) return;
  const status = placeholder.querySelector('.app4-placeholder__status');
  if (!status) return;
  status.textContent = state.isPlaying ? 'Reproduciendo (placeholder)' : 'Detenido';
}

function ensureMixerChannels() {
  const mixer = getMixer();
  if (!mixer || ensureMixerChannels._done) return;
  mixer.registerChannel('pulse', { allowSolo: true, label: 'Pulso/Pulso 0' });
  mixer.registerChannel('selected', { allowSolo: true, label: 'Seleccionados' });
  ensureMixerChannels._done = true;
}

async function initAudio() {
  if (audio) return audio;
  await ensureAudio();
  audio = new TimelineAudio();
  await audio.ready();
  ensureMixerChannels();
  audio.mixer?.registerChannel('pulse', { allowSolo: true, label: 'Pulso/Pulso 0' });
  audio.mixer?.registerChannel('accent', { allowSolo: true, label: 'Seleccionados' });
  const baseSoundSelect = selectors.baseSoundSelect();
  const selectedSoundSelect = selectors.selectedSoundSelect();
  const startSoundSelect = selectors.startSoundSelect();
  if (baseSoundSelect?.dataset.value) {
    audio.setBase(baseSoundSelect.dataset.value);
  }
  if (selectedSoundSelect?.dataset.value) {
    audio.setAccent(selectedSoundSelect.dataset.value);
  }
  if (startSoundSelect?.dataset.value) {
    audio.setStart(startSoundSelect.dataset.value);
  }
  schedulingBridge.applyTo(audio);
  state.audioReady = true;
  return audio;
}

async function handlePlayClick(placeholder) {
  try {
    await initAudio();
    state.isPlaying = !state.isPlaying;
    updatePlaceholder(placeholder);
  } catch (error) {
    console.error('No se pudo inicializar el audio de App4', error);
  }
}

function wirePlayButton(placeholder) {
  const playBtn = selectors.playBtn();
  if (!playBtn) return;
  playBtn.addEventListener('click', () => handlePlayClick(placeholder));
}

function initMixerMenuForApp() {
  const mixerMenu = selectors.mixerMenu();
  const playBtn = selectors.playBtn();
  ensureMixerChannels();
  initMixerMenu({
    menu: mixerMenu,
    triggers: [playBtn].filter(Boolean),
    channels: [
      { id: 'pulse', label: 'Pulso/Pulso 0', allowSolo: true },
      { id: 'selected', label: 'Seleccionados', allowSolo: true },
      { id: 'master', label: 'Master', allowSolo: false, isMaster: true }
    ]
  });
}

function syncSelectedChannel() {
  subscribeMixer((snapshot) => {
    if (!snapshot || mixerSyncGuard) return;
    const channels = Array.isArray(snapshot.channels) ? snapshot.channels : [];
    const selected = channels.find((ch) => ch.id === 'selected');
    if (!selected) return;
    const accent = channels.find((ch) => ch.id === 'accent');
    mixerSyncGuard = true;
    try {
      if (!accent || Math.abs((accent.volume ?? 1) - (selected.volume ?? 1)) > 0.0001) {
        setChannelVolume('accent', selected.volume ?? 1);
      }
      if (!accent || !!accent.muted !== !!selected.muted) {
        setChannelMute('accent', !!selected.muted);
      }
      if (!accent || !!accent.solo !== !!selected.solo) {
        setChannelSolo('accent', !!selected.solo);
      }
    } finally {
      mixerSyncGuard = false;
    }
  });
}

function initSoundMenus() {
  const baseSoundSelect = selectors.baseSoundSelect();
  const selectedSoundSelect = selectors.selectedSoundSelect();
  const startSoundSelect = selectors.startSoundSelect();
  initSoundDropdown(baseSoundSelect, {
    storageKey: STORE_KEY('baseSound'),
    eventType: 'baseSound',
    getAudio: initAudio,
    apply: (instance, value) => instance?.setBase(value)
  });
  initSoundDropdown(selectedSoundSelect, {
    storageKey: STORE_KEY('selectedSound'),
    eventType: 'selectedSound',
    getAudio: initAudio,
    apply: (instance, value) => instance?.setAccent(value)
  });
  initSoundDropdown(startSoundSelect, {
    storageKey: STORE_KEY('startSound'),
    eventType: 'startSound',
    getAudio: initAudio,
    apply: (instance, value) => instance?.setStart(value)
  });
}

function init() {
  document.body.dataset.appId = APP_STORAGE_PREFIX;
  const placeholder = createPlaceholder();
  wirePlayButton(placeholder);
  initSoundMenus();
  initMixerMenuForApp();
  syncSelectedChannel();
}

window.addEventListener('DOMContentLoaded', init);
