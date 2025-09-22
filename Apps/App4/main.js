import { ensureAudio } from '../../libs/sound/index.js';

const APP_STORAGE_PREFIX = 'app4';
const state = {
  isPlaying: false,
  audioReady: false,
  audioInstance: null
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
  container.append(title, message);
  middleSection.appendChild(container);
  return container;
}

function updatePlaceholder(placeholder) {
  if (!placeholder) return;
  const status = placeholder.querySelector('.app4-placeholder__status');
  if (!status) return;
  status.textContent = state.isPlaying ? 'Reproduciendo (placeholder)' : 'Detenido';
}

async function handlePlayClick(placeholder) {
  try {
    if (!state.audioReady) {
      state.audioInstance = await ensureAudio();
      state.audioReady = true;
    }
    state.isPlaying = !state.isPlaying;
    updatePlaceholder(placeholder);
  } catch (error) {
    console.error('No se pudo inicializar el audio de App4', error);
  }
}

function wirePlayButton(placeholder) {
  const playBtn = document.getElementById('playBtn');
  if (!playBtn) return;
  playBtn.addEventListener('click', () => handlePlayClick(placeholder));
}

function init() {
  document.body.dataset.appId = APP_STORAGE_PREFIX;
  const placeholder = createPlaceholder();
  if (placeholder) {
    const status = document.createElement('p');
    status.className = 'app4-placeholder__status';
    status.textContent = 'Detenido';
    placeholder.appendChild(status);
  }
  wirePlayButton(placeholder);
}

window.addEventListener('DOMContentLoaded', init);
