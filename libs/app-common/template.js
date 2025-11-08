export const FRACTION_INLINE_SLOT_ID = 'fractionInlineSlot';
export const PULSE_TOGGLE_BTN_ID = 'pulseToggleBtn';
export const SELECTED_TOGGLE_BTN_ID = 'selectedToggleBtn';
export const CYCLE_TOGGLE_BTN_ID = 'cycleToggleBtn';
export const NOTATION_TOGGLE_BTN_ID = 'notationToggleBtn';
export const NOTATION_PANEL_ID = 'notationPanel';
export const NOTATION_CLOSE_BTN_ID = 'notationCloseBtn';
export const NOTATION_CONTENT_ID = 'notationContent';

// Gamification event dispatcher
let gamificationDispatcher = null;

/**
 * Set gamification event dispatcher for UI interactions
 * @param {Function} dispatcher - Function to dispatch gamification events
 */
export function setGamificationDispatcher(dispatcher) {
  gamificationDispatcher = dispatcher;
}

/**
 * Dispatch gamification event if dispatcher is set
 */
function dispatchGamificationEvent(eventName, data = {}) {
  if (gamificationDispatcher && typeof gamificationDispatcher === 'function') {
    try {
      gamificationDispatcher(eventName, data);
    } catch (error) {
      console.error('Gamification dispatcher error:', error);
    }
  }
}

export function renderApp({
  root,
  title,
  showSelectColor = false,
  randomMenuContent = '',
  pulseSequence = false,
  hideT = false,
  hideLeds = false,
  showAccent = true,
  showPulseToggle = false,
  showSelectedToggle = false,
  showCycleToggle = false,
  inlineFractionSlot = false,
  showNotationToggle = false,
  showComplexFractions = true,
  useIntervalMode = false,
  showP1Toggle = false,
  showGamificationToggle = false,
  showCircularTimelineToggle = true,
  showHoverToggle = true,
  showStartSoundDropdown = true,
  showInstrumentDropdown = false,
  showPolyphonyToggle = false,
  controlsLayout = null
}) {
  if (!root) throw new Error('root element required');
  document.title = title;
  const selectColor = showSelectColor ? `
        <label for="selectColor">Color selección <input type="color" id="selectColor" value="#F97C39" /></label>
        <hr class="menu-separator" />
        ` : '';
  const led = id => hideLeds ? '' : `<span class="led" id="${id}"></span>`;
  const tParam = hideT ? '' : `
        <div class="param t">
          <span class="abbr">T</span>
          <div class="circle"><span class="unit" id="unitT">segundos</span>${led('ledT')}<input id="inputT" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="decimal">
            <div class="spinner">
              <button id="inputTUp" class="spin up" type="button" aria-label="Incrementar T"></button>
              <button id="inputTDown" class="spin down" type="button" aria-label="Decrementar T"></button>
            </div></div>
        </div>`;
  const toggleMarkup = [];

  if (showPulseToggle) {
    toggleMarkup.push(`<div class="control-sound-toggle-container control-sound-toggle-container--pulse">
          <button id="${PULSE_TOGGLE_BTN_ID}" class="control-sound-toggle control-sound-toggle--pulse active" type="button" aria-pressed="true" aria-label="Alternar pulso">
            <svg class="control-sound-toggle__svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120">
              <defs>
                <path id="controlPulseLabelPath" d="M 15 129 A 90 90 0 0 1 64 56" />
              </defs>
              <path class="control-sound-toggle__shape" d="M -10 100 A 120 120 0 0 1 40 15 L 70 55 A 70 70 0 0 0 40 100 Z" />
              <text class="control-sound-toggle__label" dy="2" style="font-size:15px;font-weight:700;letter-spacing:1px">
                <textPath href="#controlPulseLabelPath" startOffset="55%" text-anchor="middle">Pulso</textPath>
              </text>
            </svg>
          </button>
        </div>`);
  }

  if (showSelectedToggle) {
    toggleMarkup.push(`<div class="control-sound-toggle-container control-sound-toggle-container--selected">
          <button id="${SELECTED_TOGGLE_BTN_ID}" class="control-sound-toggle control-sound-toggle--selected active" type="button" aria-pressed="true" aria-label="Alternar seleccionado">
            <svg class="control-sound-toggle__svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120">
              <defs>
                <!-- Corba per al text centrada al segment del mig -->
                <path id="controlSelectedLabelPath" d="M 70 46 A 68 68 0 0 1 130 46" />
              </defs>
              <!-- Segment central: corona circular simètrica segons l'esbós -->
              <path class="control-sound-toggle__shape" d="M 42 9 A 120 120 0 0 1 158 9 L 129 49 A 70 70 0 0 0 72 50 Z" />
              <text class="control-sound-toggle__label" dy="2" style="font-size:15px;font-weight:700;letter-spacing:1px">
                <textPath href="#controlSelectedLabelPath" startOffset="50%" text-anchor="middle">SEL</textPath>
              </text>
            </svg>
          </button>
        </div>`);
  }

  if (showCycleToggle) {
    toggleMarkup.push(`<div class="control-sound-toggle-container control-sound-toggle-container--cycle">
          <button id="${CYCLE_TOGGLE_BTN_ID}" class="control-sound-toggle control-sound-toggle--cycle active" type="button" aria-pressed="true" aria-label="Alternar subdivisión">
            <svg class="control-sound-toggle__svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120">
              <defs>
                <path id="controlCycleLabelPath" d="M 152 66 A 76 76 0 0 1 175 96" />
              </defs>
              <path class="control-sound-toggle__shape" d="M 210 100 A 120 120 0 0 0 160 15 L 130 55 A 70 70 0 0 1 160 100 Z" />
              <text class="control-sound-toggle__label" dy="2" style="font-size:15px;font-weight:700;letter-spacing:1px">
                <textPath href="#controlCycleLabelPath" startOffset="50%" text-anchor="middle">Sub</textPath>
              </text>
            </svg>
          </button>
        </div>`);
  }

  const togglesMarkup = toggleMarkup.map(markup => `          ${markup}`).join('\n');
  const soundToggleMarkup = toggleMarkup.length ? `
        <div class="control-sound-toggles" role="group" aria-label="Controles de sonido">
${togglesMarkup}
        </div>
    ` : '';

  const gamificationToggleButton = showGamificationToggle ? `
      <button
        id="gamificationToggleBtn"
        class="top-bar-gamification-button"
        type="button"
        aria-label="Alternar gamificación"
        aria-pressed="false"
      >
        <svg class="top-bar-gamification-button__icon" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" fill="currentColor" aria-hidden="true" focusable="false">
          <path d="m16 3c.5522847 0 1 .44771525 1 1v6h6c4.9705627 0 9 4.0294373 9 9s-4.0294373 9-9 9h-14c-4.97056275 0-9-4.0294373-9-9s4.02943725-9 9-9h6v-6c0-.55228475.4477153-1 1-1zm-7 12c-.55228475 0-1 .4477153-1 1v2h-2c-.55228475 0-1 .4477153-1 1s.44771525 1 1 1h2v2c0 .5522847.44771525 1 1 1s1-.4477153 1-1v-2h2c.5522847 0 1-.4477153 1-1s-.4477153-1-1-1h-2v-2c0-.5522847-.44771525-1-1-1zm16.5 5c-.8284271 0-1.5.6715729-1.5 1.5s.6715729 1.5 1.5 1.5 1.5-.6715729 1.5-1.5-.6715729-1.5-1.5-1.5zm-2-5c-.8284271 0-1.5.6715729-1.5 1.5s.6715729 1.5 1.5 1.5 1.5-.6715729 1.5-1.5-.6715729-1.5-1.5-1.5z"/>
        </svg>
      </button>
  ` : '';

  const notationToggleButton = showNotationToggle ? `
      <button
        id="${NOTATION_TOGGLE_BTN_ID}"
        class="top-bar-notation-button"
        type="button"
        aria-label="Alternar partitura"
        aria-pressed="false"
        aria-expanded="false"
        aria-controls="${NOTATION_PANEL_ID}"
      >
        <svg class="top-bar-notation-button__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 276.164 276.164" fill="currentColor" aria-hidden="true" focusable="false">
          <path d="M156.716,61.478c-4.111,6.276-8.881,11.511-14.212,15.609l-8.728,6.962c-13.339,11.855-22.937,21.433-28.542,28.464 c-10.209,12.788-15.806,25.779-16.65,38.611c-0.942,14.473,3.187,28.21,12.275,40.84c9.636,13.458,21.8,20.754,36.164,21.69 c3.291,0.218,6.897,0.182,9.896-0.015l-1.121-10.104c-2.09,0.192-4.306,0.223-6.628,0.068c-9.437-0.617-17.864-4.511-25.064-11.573 c-7.524-7.333-10.895-15.415-10.287-24.7c1.149-17.59,12.562-35.004,33.925-51.792l9.543-7.599 c8.394-7.174,15.192-16.191,20.216-26.825c4.971-10.556,7.886-21.983,8.673-33.96c0.466-7.037-0.513-15.775-2.874-25.965 c-3.241-13.839-7.854-20.765-14.136-21.179c-2.232-0.138-4.676,0.986-7.658,3.617c-7.252,6.548-12.523,14.481-15.683,23.542 c-2.438,6.926-4.057,16.189-4.805,27.529c-0.313,4.72,0.313,13.438,1.805,23.962l8.844-8.192c-0.028-1.183,0.005-2.413,0.096-3.703 c0.466-7.221,2.289-15.062,5.394-23.293c3.956-10.296,7.689-13.409,10.133-14.204c0.668-0.218,1.32-0.298,2.015-0.254 c3.185,0.212,6.358,1.559,5.815,9.979C164.664,46.132,161.831,53.693,156.716,61.478z"/>
          <path d="M164.55,209.161c5.728-2.568,10.621-6.478,14.576-11.651c5.055-6.561,7.897-14.316,8.467-23.047 c0.72-10.719-1.854-20.438-7.617-28.895c-6.322-9.264-14.98-14.317-25.745-15.026c-1.232-0.081-2.543-0.075-3.895,0.025 l-2.304-17.191l-9.668,7.112l1.483,12.194c-5.789,2.393-10.827,6.17-15.017,11.255c-4.823,5.924-7.508,12.443-7.964,19.382 c-0.466,7.208,1.142,13.81,4.782,19.583c1.895,3.081,4.507,5.82,7.498,8.058c4.906,3.65,10.563,3.376,11.459,1.393 c0.906-1.983-2.455-5.095-5.09-9.248c-1.502-2.351-2.242-5.173-2.242-8.497c0-7.053,4.256-13.116,10.317-15.799l5.673,44.211 l1.325,10.258c0.864,4.873,1.719,9.725,2.537,14.52c1,6.488,1.352,12.112,1.041,16.715c-0.419,6.375-2.408,11.584-5.919,15.493 c-2.234,2.485-4.844,4.055-7.795,4.925c3.961-3.962,6.414-9.43,6.414-15.478c0-12.075-9.792-21.872-21.87-21.872 c-3.353,0-6.491,0.812-9.329,2.159c-0.36,0.155-0.699,0.388-1.054,0.574c-0.779,0.425-1.559,0.85-2.286,1.362 c-0.249,0.187-0.487,0.403-0.732,0.605c-4.888,3.816-8.091,9.616-8.375,16.229c0,0.01-0.011,0.021-0.011,0.031 c0,0.005,0,0.01,0,0.016c-0.013,0.311-0.09,0.59-0.09,0.896c0,0.259,0.067,0.492,0.078,0.74 c-0.011,7.084,2.933,13.179,8.839,18.118c5.584,4.666,12.277,7.28,19.892,7.777c4.327,0.28,8.505-0.217,12.407-1.485 c3.189-1.041,6.275-2.62,9.149-4.687c6.96-5.022,10.75-11.584,11.272-19.532c0.399-6.063,0.094-13.235-0.937-21.411l-2.838-18.429 l-7.156-52.899c7.984,1.532,14.027,8.543,14.027,16.968c0,5.986-1.937,15.431-5.551,20.376L164.55,209.161z"/>
        </svg>
      </button>
  ` : '';

  const notationPanelMarkup = showNotationToggle ? `
    <section
      id="${NOTATION_PANEL_ID}"
      class="notation-panel notation-panel--inline"
      data-notation-inline="true"
      aria-hidden="true"
      hidden
    >
      <div class="notation-panel__dialog" role="region" aria-label="Partitura musical">
        <div
          id="${NOTATION_CONTENT_ID}"
          class="notation-panel__canvas"
          role="img"
          aria-label="Partitura musical"
        ></div>
      </div>
    </section>
  ` : '';

  root.innerHTML = `
  <header class="top-bar">
    <details class="menu" id="optionsMenu">
      <summary>☰</summary>
      <div class="options-content">
        <label for="themeSelect">Tema:
          <select id="themeSelect">
            <option value="system" selected>Sistema</option>
            <option value="light">Claro</option>
            <option value="dark">Oscuro</option>
          </select>
        </label>
        ${showHoverToggle ? '<label for="hoverToggle">Etiquetas de ayuda <input type="checkbox" id="hoverToggle" checked /></label>' : ''}
        ${selectColor}
        ${showCircularTimelineToggle ? '<label for="circularTimelineToggle">Línea temporal circular <input type="checkbox" id="circularTimelineToggle" /></label>' : ''}
        ${showComplexFractions ? '<label for="enableComplexFractions">Activar fracciones complejas <input type="checkbox" id="enableComplexFractions" /></label>' : ''}
        ${showPolyphonyToggle ? '<label for="polyphonyToggle">Permitir Polifonía <input type="checkbox" id="polyphonyToggle" /></label>' : ''}
        <button type="button" id="factoryResetBtn" class="factory-reset">Volver a ajustes de fábrica</button>
        <details>
          <summary>Sonidos</summary>
          <div class="sound-group">
            ${(useIntervalMode || showP1Toggle) ? `
            <div class="interval-sound-group">
              <label for="startIntervalToggle" class="interval-toggle-label">
                <input type="checkbox" id="startIntervalToggle" />
                ${useIntervalMode ? 'Intervalo 1' : 'Pulso 1'}
              </label>
              ${showStartSoundDropdown ? `
              <div class="preview-row interval-select-row">
                <label for="startSoundSelect" style="display:none"></label>
                <div id="startSoundSelect"></div>
              </div>` : `
              <div class="preview-row interval-select-row" style="display:none;"></div>`}
            </div>` : showStartSoundDropdown ? `
            <p>Pulso 0</p>
            <div class="preview-row">
              <label for="startSoundSelect" style="display:none"></label>
              <div id="startSoundSelect"></div>
            </div>` : ''}
            ${showInstrumentDropdown ? `
            <p>Instrumento</p>
            <div class="preview-row">
              <label for="instrumentSelect" style="display:none"></label>
              <div id="instrumentSelect"></div>
            </div>
            ` : ''}
            <p>${useIntervalMode ? 'Pulsaciones' : 'Pulso'}</p>
            <div class="preview-row">
              <label for="baseSoundSelect" style="display:none"></label>
              <div id="baseSoundSelect"></div>
            </div>
            ${showAccent ? `
            <p>Seleccionado${useIntervalMode ? 's' : ''}</p>
            <div class="preview-row">
              <label for=\"accentSoundSelect\" style=\"display:none\"></label>
              <div id=\"accentSoundSelect\"></div>
            </div>` : ''}

          </div>
        </details>
      </div>
    </details>
    <h1>${gamificationToggleButton}<span class="top-bar-title-text">${title}</span>${notationToggleButton}</h1>
    <div class="sound-wrapper">
      <button id="muteBtn" class="sound" aria-label="Sonido"></button>
      <input type="range" id="volumeSlider" min="0" max="1" step="0.01" value="1" />
    </div>
  </header>

  <main>
    <section class="inputs">
        <div class="param lg">
          <span class="abbr">Lg</span>
          <div class="circle"><span class="unit" id="unitLg">Pulsos</span>${led('ledLg')}<input id="inputLg" type="number" min="1" step="1" />
            <div class="spinner">
              <button id="inputLgUp" class="spin up" type="button" aria-label="Incrementar Lg"></button>
              <button id="inputLgDown" class="spin down" type="button" aria-label="Decrementar Lg"></button>
            </div>
          </div>
        </div>
        <div class="param v">
          <span class="abbr">V</span>
          <div class="circle"><span class="unit" id="unitV">BPM</span>${led('ledV')}<input id="inputV" type="number" min="1" step="1" />
            <div class="spinner">
              <button id="inputVUp" class="spin up" type="button" aria-label="Incrementar V"></button>
              <button id="inputVDown" class="spin down" type="button" aria-label="Decrementar V"></button>
            </div>
          </div>
        </div>
        ${tParam}
    </section>

    <section class="middle">
      ${pulseSequence ? '<div id="pulseSeq"></div>' : '<div id="formula" class="formula"></div>'}
    </section>

    ${notationPanelMarkup}

    <section class="timeline-wrapper" id="timelineWrapper">
      <section class="timeline" id="timeline"></section>

      <div class="controls"${controlsLayout ? ` data-layout="${controlsLayout.mode}"` : ''}>
      ${soundToggleMarkup}
      ${controlsLayout?.mode === 'vertical' ? '<div class="control-buttons-row">' : ''}
      <button id="randomBtn" class="random" aria-label="Random">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor" stroke="currentColor">
    <path d="M449.531,105.602L288.463,8.989C278.473,2.994,267.235,0,256.01,0c-11.238,0-22.483,2.994-32.466,8.989 L62.475,105.602c-19.012,11.406-30.647,31.949-30.647,54.117v192.562c0,22.168,11.635,42.711,30.647,54.117l161.069,96.613 c9.982,5.988,21.228,8.989,32.466,8.989c11.226,0,22.463-3.001,32.453-8.989l161.069-96.613 c19.013-11.406,30.64-31.95,30.64-54.117V159.719C480.172,137.551,468.544,117.008,449.531,105.602z M250.599,492.733 c-6.028-0.745-11.929-2.713-17.32-5.949L72.209,390.171c-13.306-7.989-21.456-22.369-21.456-37.89V159.719 c0-6.022,1.235-11.862,3.518-17.234l196.328,117.76V492.733z M59.669,133.114c3.364-4.464,7.593-8.318,12.54-11.286l161.069-96.613 c6.995-4.196,14.85-6.29,22.731-6.29c7.868,0,15.724,2.095,22.718,6.29l161.069,96.613c4.942,2.968,9.184,6.821,12.54,11.286 L256.01,250.881L59.669,133.114z M461.253,352.281c0,15.521-8.15,29.901-21.456,37.89l-161.069,96.613 c-5.397,3.236-11.292,5.204-17.32,5.949V260.246l196.328-117.76c2.282,5.371,3.518,11.212,3.518,17.234V352.281z"/>
    <path d="M382.343,115.779c-9.828-7.284-26.022-7.465-36.159-0.416c-10.15,7.049-10.405,18.677-0.577,25.948 c9.828,7.277,26.022,7.466,36.159,0.416C391.917,134.671,392.172,123.057,382.343,115.779z"/>
    <path d="M165.62,113.564c-9.828-7.278-26.022-7.459-36.172-0.41c-10.137,7.056-10.392,18.67-0.571,25.948 c9.835,7.284,26.028,7.459,36.165,0.416C175.194,132.456,175.449,120.842,165.62,113.564z"/>
    <path d="M273.358,115.102c-9.493-7.029-25.136-7.21-34.937-0.396c-9.801,6.814-10.056,18.039-0.557,25.068 c9.499,7.028,25.142,7.21,34.943,0.396C282.609,133.356,282.864,122.131,273.358,115.102z"/>
    <path d="M89.289,248.303c11.158,6.083,20.194,1.96,20.194-9.19c0-11.158-9.036-25.129-20.194-31.211 c-11.158-6.082-20.208-1.967-20.208,9.191C69.081,228.243,78.131,242.22,89.289,248.303z"/>
    <path d="M202.061,309.771c11.158,6.082,20.207,1.967,20.207-9.184c0-11.158-9.05-25.135-20.207-31.218 c-11.151-6.075-20.194-1.96-20.194,9.198C181.867,289.718,190.91,303.688,202.061,309.771z"/>
    <path d="M89.289,361.082c11.158,6.082,20.194,1.967,20.194-9.19c0-11.158-9.036-25.129-20.194-31.211 c-11.158-6.083-20.208-1.967-20.208,9.19C69.081,341.029,78.131,355,89.289,361.082z"/>
    <path d="M202.061,422.55c11.158,6.082,20.207,1.967,20.207-9.191c0-11.151-9.05-25.128-20.207-31.211 c-11.151-6.076-20.194-1.96-20.194,9.191C181.867,402.497,190.91,416.468,202.061,422.55z"/>
    <path d="M361.948,282.911c-17.858,9.728-32.319,32.084-32.319,49.928c0,17.85,14.461,24.437,32.319,14.709 c17.844-9.734,32.319-32.09,32.319-49.941C394.267,279.762,379.792,273.176,361.948,282.911z"/>
  </svg>
</button>
      <div id="randomMenu" class="random-menu options-content menu-surface"><h2 class="random-menu-title">Parámetros
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor" stroke="currentColor">
      <path d="M449.531,105.602L288.463,8.989C278.473,2.994,267.235,0,256.01,0c-11.238,0-22.483,2.994-32.466,8.989 L62.475,105.602c-19.012,11.406-30.647,31.949-30.647,54.117v192.562c0,22.168,11.635,42.711,30.647,54.117l161.069,96.613 c9.982,5.988,21.228,8.989,32.466,8.989c11.226,0,22.463-3.001,32.453-8.989l161.069-96.613 c19.013-11.406,30.64-31.95,30.64-54.117V159.719C480.172,137.551,468.544,117.008,449.531,105.602z M250.599,492.733 c-6.028-0.745-11.929-2.713-17.32-5.949L72.209,390.171c-13.306-7.989-21.456-22.369-21.456-37.89V159.719 c0-6.022,1.235-11.862,3.518-17.234l196.328,117.76V492.733z M59.669,133.114c3.364-4.464,7.593-8.318,12.54-11.286l161.069-96.613 c6.995-4.196,14.85-6.29,22.731-6.29c7.868,0,15.724,2.095,22.718,6.29l161.069,96.613c4.942,2.968,9.184,6.821,12.54,11.286 L256.01,250.881  L59.669,133.114z M461.253,352.281c0,15.521-8.15,29.901-21.456,37.89l-161.069,96.613 c-5.397,3.236-11.292,5.204-17.32,5.949V260.246l196.328-117.76c2.282,5.371,3.518,11.212,3.518,17.234V352.281z"/>
      <path d="M382.343,115.779c-9.828-7.284-26.022-7.465-36.159-0.416c-10.15,7.049-10.405,18.677-0.577,25.948 c9.828,7.277,26.022,7.466,36.159,0.416C391.917,134.671,392.172,123.057,382.343,115.779z"/>
      <path d="M165.62,113.564c-9.828-7.278-26.022-7.459-36.172-0.41c-10.137,7.056-10.392,18.67-0.571,25.948 c9.835,7.284,26.028,7.459,36.165,0.416C175.194,132.456,175.449,120.842,165.62,113.564z"/>
      <path d="M273.358,115.102c-9.493-7.029-25.136-7.21-34.937-0.396c-9.801,6.814-10.056,18.039-0.557,25.068 c9.499,7.028,25.142,7.21,34.943,0.396C282.609,133.356,282.864,122.131,273.358,115.102z"/>
      <path d="M89.289,248.303c11.158,6.083,20.194,1.96,20.194-9.19c0-11.158-9.036-25.129-20.194-31.211 c-11.158-6.082-20.208-1.967-20.208,9.191C69.081,228.243,78.131,242.22,89.289,248.303z"/>
      <path d="M202.061,309.771c11.158,6.082,20.207,1.967,20.207-9.184c0-11.158-9.05-25.135-20.207-31.218 c-11.151-6.075-20.194-1.96-20.194,9.198C181.867,289.718,190.91,303.688,202.061,309.771z"/>
      <path d="M89.289,361.082c11.158,6.082,20.194,1.967,20.194-9.19c0-11.158-9.036-25.129-20.194-31.211 c-11.158-6.083-20.208-1.967-20.208,9.19C69.081,341.029,78.131,355,89.289,361.082z"/>
      <path d="M202.061,422.55c11.158,6.082,20.207,1.967,20.207-9.191c0-11.151-9.05-25.128-20.207-31.211 c-11.151-6.076-20.194-1.96-20.194,9.191C181.867,402.497,190.91,416.468,202.061,422.55z"/>
      <path d="M361.948,282.911c-17.858,9.728-32.319,32.084-32.319,49.928c0,17.85,14.461,24.437,32.319,14.709 c17.844-9.734,32.319-32.09,32.319-49.941C394.267,279.762,379.792,273.176,361.948,282.911z"/>
      </svg></h2>${randomMenuContent}</div>
      <div id="mixerMenu"></div>
      <button id="loopBtn" class="loop" aria-label="Loop">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="-5.2 -5.2 62.4 62.4" fill="currentColor" transform="matrix(-1 0 0 -1 0 0)">
    <path d="M47.2,32.6c0,0.1,0,0.1-0.1,0.2c-0.3,0.9-0.5,1.8-0.9,2.6c-0.4,0.9-0.8,1.9-1.3,2.7c-1,1.8-2.2,3.4-3.6,4.8 c-1.4,1.4-3,2.7-4.7,3.7c-1.7,1-3.6,1.9-5.6,2.4c-2,0.6-4.1,0.8-6.2,0.8C12.3,50,2,39.7,2,27.1S12.3,4.2,24.9,4.2 c4.3,0,8.3,1.2,11.7,3.2c0,0,0,0,0,0c1.7,1,3.2,2.2,4.5,3.5c0.4,0.3,0.7,0.6,1,1c0.8,0.6,1.3,0.2,1.3-0.8V3.6C43.4,2.8,44.2,2,45,2 h3.2c0.9,0,1.6,0.8,1.7,1.6v19.6c0,0.8-0.6,1.4-1.4,1.4H28.9c-0.9,0-1.5-0.6-1.5-1.5v-3.3c0-0.9,0.8-1.6,1.6-1.6h7.5 c0.6,0,1.2-0.2,1.4-0.5c-2.9-4-7.6-6.6-13-6.6c-8.9,0-16,7.2-16,16s7.2,16,16,16c7,0,12.9-4.4,15.1-10.6c0,0,0.3-1.4,1.4-1.4 c1.1,0,3.8,0,4.6,0c0.7,0,1.3,0.5,1.3,1.2C47.2,32.4,47.2,32.5,47.2,32.6z"/>
  </svg>
  </button>
      <div class="play-group">
     <button id="playBtn" class="play" aria-label="Play">
  <!-- Icona Play (triangle) -->
  <svg class="icon-play" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor">
    <path d="M73 39c-14.8-9-33 2.5-33 19v396c0 16.5 18.2 28 33 19l305-198c13.3-8.6 13.3-29.4 0-38L73 39z"/>
  </svg>
  <!-- Icona Stop (quadrat) -->
  <svg class="icon-stop" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor" style="display:none">
    <path d="M400 32H48C21.5 32 0 53.5 0 80v352c0 26.5 21.5 48 48 48h352c26.5 0 48-21.5 48-48V80c0-26.5-21.5-48-48-48z"/>
  </svg>
</button>
     <button id="tapTempoBtn" class="tap" aria-label="Tap Tempo">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512.003 512.003" fill="currentColor" stroke="currentColor">
    <path d="M136.533,247.596c0-4.71-3.823-8.533-8.533-8.533c-61.167,0-110.933-49.766-110.933-110.933 C17.067,66.962,66.833,17.196,128,17.196s110.933,49.766,110.933,110.933c0,16.904-3.703,33.135-11.008,48.23 c-2.048,4.241-0.273,9.344,3.968,11.401c4.25,2.057,9.344,0.282,11.401-3.968C251.725,166.359,256,147.637,256,128.129 c0-70.579-57.421-128-128-128S0,57.55,0,128.129s57.421,128,128,128C132.71,256.129,136.533,252.307,136.533,247.596z"/>
    <path d="M511.369,407.758c-8.491-20.787-10.402-35.977-12.254-50.662c-2.517-20.002-5.129-40.678-23.791-72.465l-50.884-86.639 c-8.38-14.268-29.175-19.772-43.648-11.554c-4.591,2.594-8.44,6.417-11.204,10.982c-11.853-15.838-34.21-20.753-51.9-10.709 c-8.243,4.676-14.387,11.913-17.587,20.625c-12.407-9.609-30.02-11.392-44.484-3.174c-8.294,4.71-14.464,12.015-17.638,20.804 l-74.522-101.931c-14.182-19.678-32.913-25.609-50.082-15.855c-8.516,4.83-14.293,12.109-16.7,21.06 c-2.662,9.941-0.879,20.966,5.197,31.317l116.378,182.775c2.534,3.977,7.808,5.154,11.785,2.62 c3.977-2.534,5.146-7.808,2.62-11.784L116.437,150.657c-3.584-6.11-4.753-12.501-3.277-17.988 c1.203-4.506,4.113-8.081,8.636-10.641c9.353-5.325,18.722-1.63,27.853,11.042l91.836,125.611 c2.68,3.669,7.774,4.591,11.571,2.091c3.797-2.492,4.975-7.526,2.671-11.452c-2.987-5.094-3.797-11.025-2.278-16.7 c1.545-5.777,5.308-10.615,10.59-13.619c10.931-6.187,24.926-2.526,31.206,8.166l7.825,13.338 c2.381,4.07,7.603,5.419,11.682,3.038c4.062-2.381,5.427-7.612,3.038-11.674l-0.009-0.017c-2.987-5.086-3.797-11.017-2.27-16.691 c1.545-5.777,5.308-10.607,10.598-13.611c10.914-6.212,24.9-2.534,31.189,8.175l11.742,19.985 c2.398,4.07,7.62,5.427,11.682,3.038c4.062-2.389,5.419-7.612,3.038-11.674l-0.017-0.026c-1.843-3.149-2.287-6.972-1.271-10.778 c1.033-3.874,3.49-7.151,6.741-8.994c6.443-3.652,16.802-0.964,20.514,5.35l50.876,86.647 c16.896,28.757,19.063,45.995,21.581,65.954c1.775,14.123,3.61,28.681,10.667,47.966l-150.409,85.376 c-55.441-58.615-158.788-112.691-210.782-126.379c-9.242-2.441-25.89-7.663-28.988-8.627l1.254-4.352 c3.268-11.998,29.227-26.658,41.498-23.467l36.873,9.719c4.582,1.195,9.225-1.519,10.428-6.076 c1.203-4.557-1.519-9.225-6.076-10.419l-36.881-9.728c-21.154-5.547-56.644,14.677-62.276,35.362l-1.399,4.838 c-0.085,0.299-0.154,0.614-0.213,0.922c-1.434,8.422,2.116,15.42,9.515,18.731c0.29,0.128,0.597,0.239,0.896,0.341 c0.828,0.256,20.258,6.417,31.019,9.259c51.43,13.542,155.085,68.156,207.087,126.336c1.664,1.86,4.002,2.842,6.366,2.842 c1.442,0,2.884-0.358,4.207-1.109l162.714-92.356C511.411,416.292,512.99,411.726,511.369,407.758z"/>
    <path d="M128,68.396c32.939,0,59.733,26.795,59.733,59.733c0,4.71,3.823,8.533,8.533,8.533s8.533-3.823,8.533-8.533 c0-42.342-34.458-76.8-76.8-76.8s-76.8,34.458-76.8,76.8c0,27.443,14.797,52.975,38.622,66.645 c1.34,0.768,2.799,1.135,4.232,1.135c2.961,0,5.837-1.536,7.415-4.292c2.347-4.087,0.93-9.301-3.157-11.639 c-18.534-10.633-30.046-30.507-30.046-51.849C68.267,95.191,95.061,68.396,128,68.396z"/>
  </svg>
     </button>
     <span id="tapHelp" class="tap-help" style="display:none;">Se necesitan 3 clicks</span>
     </div>
     <button id="resetBtn" class="reset" aria-label="Reset">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 25" fill="none">
    <path d="M18 7L7 18M7 7L18 18" stroke="currentColor" stroke-width="1.2"/>
  </svg>
</button>
      ${controlsLayout?.mode === 'vertical' ? '</div>' : ''}
      </div>
    </section>
  </main>`;
}

/**
 * Initialize gamification hooks for UI elements
 * Called after DOM is ready
 */
export function initializeGamificationHooks() {
  // Gamification toggle button
  const gamificationBtn = document.getElementById('gamificationToggleBtn');
  if (gamificationBtn) {
    gamificationBtn.addEventListener('click', () => {
      const isActive = gamificationBtn.getAttribute('aria-pressed') === 'true';
      gamificationBtn.setAttribute('aria-pressed', (!isActive).toString());
      gamificationBtn.classList.toggle('active', !isActive);
      dispatchGamificationEvent('gamification_toggled', {
        enabled: !isActive,
        timestamp: Date.now()
      });
    });
  }

  // Play button
  const playBtn = document.getElementById('playBtn');
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      dispatchGamificationEvent('play_clicked', { timestamp: Date.now() });
    });
  }

  // Random button
  const randomBtn = document.getElementById('randomBtn');
  if (randomBtn) {
    randomBtn.addEventListener('click', () => {
      dispatchGamificationEvent('randomize_used', { timestamp: Date.now() });
    });
  }

  // Loop button
  const loopBtn = document.getElementById('loopBtn');
  if (loopBtn) {
    loopBtn.addEventListener('click', () => {
      const isActive = loopBtn.classList.contains('active');
      dispatchGamificationEvent('loop_toggled', { enabled: !isActive, timestamp: Date.now() });
    });
  }

  // Tap tempo button
  const tapBtn = document.getElementById('tapTempoBtn');
  if (tapBtn) {
    tapBtn.addEventListener('click', () => {
      dispatchGamificationEvent('tap_tempo_used', { timestamp: Date.now() });
    });
  }

  // Parameter changes (Lg, V, T)
  const paramInputs = ['inputLg', 'inputV', 'inputT'];
  paramInputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('change', () => {
        dispatchGamificationEvent('parameter_changed', {
          param: id.replace('input', ''),
          value: input.value,
          timestamp: Date.now()
        });
      });
    }
  });

  // Toggle buttons for sound modes
  [PULSE_TOGGLE_BTN_ID, SELECTED_TOGGLE_BTN_ID, CYCLE_TOGGLE_BTN_ID].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', () => {
        const isActive = btn.getAttribute('aria-pressed') === 'true';
        dispatchGamificationEvent('toggle_changed', {
          toggle: id,
          enabled: !isActive,
          timestamp: Date.now()
        });
      });
    }
  });
}
