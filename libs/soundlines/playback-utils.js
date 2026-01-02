// libs/soundlines/playback-utils.js
// Utilitats de reproducció compartides per soundlines Apps 21, 23, 24

/**
 * Sleep promise helper
 * @param {number} ms - Mil·lisegons a esperar
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Canvia la icona d'un botó play entre play i stop
 * @param {HTMLElement} btn - Element del botó
 * @param {boolean} playing - Si s'està reproduint
 */
export function setPlayIcon(btn, playing) {
  const iconPlay = btn.querySelector('.icon-play');
  const iconStop = btn.querySelector('.icon-stop');
  if (iconPlay) iconPlay.style.display = playing ? 'none' : 'block';
  if (iconStop) iconStop.style.display = playing ? 'block' : 'none';
}

/**
 * Crea el HTML d'un botó play per soundline
 * @param {string} id - ID del botó
 * @param {string} ariaLabel - Label d'accessibilitat
 * @returns {string} HTML del botó
 */
export function createPlayButtonHTML(id, ariaLabel) {
  return `
    <button id="${id}" class="play soundline-play" aria-label="${ariaLabel}">
      <svg class="icon-play" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor">
        <path d="M73 39c-14.8-9-33 2.5-33 19v396c0 16.5 18.2 28 33 19l305-198c13.3-8.6 13.3-29.4 0-38L73 39z"/>
      </svg>
      <svg class="icon-stop" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor" style="display:none">
        <path d="M400 32H48C21.5 32 0 53.5 0 80v352c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48V80c0-26.5-21.5-48-48-48z"/>
      </svg>
    </button>
  `;
}

/**
 * Crea un controlador de reproducció que gestiona els dos plays (cromàtic i escala)
 * amb bloqueig mutu i estat
 * @param {Object} options - Opcions de configuració
 * @param {HTMLElement} options.chromaticBtn - Botó de play cromàtic
 * @param {HTMLElement} options.scaleBtn - Botó de play d'escala
 * @param {Function} options.onPlayChromatic - Callback per reproduir cromàtica
 * @param {Function} options.onPlayScale - Callback per reproduir escala
 * @returns {Object} API del controlador
 */
export function createPlaybackController(options) {
  const { chromaticBtn, scaleBtn, onPlayChromatic, onPlayScale } = options;

  let isPlayingChromatic = false;
  let isPlayingScale = false;
  let stopChromaticRequested = false;
  let stopScaleRequested = false;

  /**
   * Gestiona el click del botó cromàtic
   */
  async function handleChromaticClick() {
    if (isPlayingChromatic) {
      stopChromaticRequested = true;
      return;
    }

    // Bloqueig mutu: no permetre si l'altre play està actiu
    if (isPlayingScale) return;

    isPlayingChromatic = true;
    stopChromaticRequested = false;
    chromaticBtn.classList.add('playing');
    setPlayIcon(chromaticBtn, true);

    try {
      await onPlayChromatic({
        shouldStop: () => stopChromaticRequested
      });
    } finally {
      isPlayingChromatic = false;
      stopChromaticRequested = false;
      chromaticBtn.classList.remove('playing');
      setPlayIcon(chromaticBtn, false);
    }
  }

  /**
   * Gestiona el click del botó d'escala
   */
  async function handleScaleClick() {
    if (isPlayingScale) {
      stopScaleRequested = true;
      return;
    }

    // Bloqueig mutu: no permetre si l'altre play està actiu
    if (isPlayingChromatic) return;

    isPlayingScale = true;
    stopScaleRequested = false;
    scaleBtn.classList.add('playing');
    setPlayIcon(scaleBtn, true);

    try {
      await onPlayScale({
        shouldStop: () => stopScaleRequested
      });
    } finally {
      isPlayingScale = false;
      stopScaleRequested = false;
      scaleBtn.classList.remove('playing');
      setPlayIcon(scaleBtn, false);
    }
  }

  /**
   * Configura els event listeners
   */
  function attach() {
    chromaticBtn.addEventListener('click', handleChromaticClick);
    scaleBtn.addEventListener('click', handleScaleClick);
  }

  /**
   * Elimina els event listeners
   */
  function detach() {
    chromaticBtn.removeEventListener('click', handleChromaticClick);
    scaleBtn.removeEventListener('click', handleScaleClick);
  }

  /**
   * Atura qualsevol reproducció activa
   */
  function stopAll() {
    if (isPlayingChromatic) {
      stopChromaticRequested = true;
    }
    if (isPlayingScale) {
      stopScaleRequested = true;
    }
  }

  return {
    attach,
    detach,
    stopAll,
    get isPlayingChromatic() { return isPlayingChromatic; },
    get isPlayingScale() { return isPlayingScale; }
  };
}

/**
 * Crea el HTML de l'ee-display (estructura escalar)
 * @param {number[]} ee - Array d'intervals de l'estructura escalar
 * @returns {string} HTML de l'ee-display
 */
export function createEEDisplayHTML(ee) {
  const eeNumbers = ee.map(n => `<span class="ee-number">${n}</span>`).join(' ');
  return `
    <div class="ee-display">
      <span class="ee-label">eE:</span>
      <span class="ee-function">iS(</span>${eeNumbers}<span class="ee-function">)</span>
    </div>
  `;
}

/**
 * Actualitza el contingut d'un ee-display existent
 * @param {HTMLElement} container - Contenidor de l'ee-display
 * @param {number[]} ee - Array d'intervals de l'estructura escalar
 */
export function updateEEDisplay(container, ee) {
  if (!container) return;

  const eeNumbers = ee.map(n => `<span class="ee-number">${n}</span>`).join(' ');
  container.innerHTML = `
    <span class="ee-label">eE:</span>
    <span class="ee-function">iS(</span>${eeNumbers}<span class="ee-function">)</span>
  `;
}
