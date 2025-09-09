export function renderApp({ root, title, showSelectColor = false, randomMenuContent = '' }) {
  if (!root) throw new Error('root element required');
  document.title = title;
  const selectColor = showSelectColor ? `
        <label for="selectColor">Color selección <input type="color" id="selectColor" value="#FFBB97" /></label>
        <hr class="menu-separator" />
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
        <label for="hoverToggle">Etiquetas de ayuda <input type="checkbox" id="hoverToggle" checked /></label>
        ${selectColor}
        <label for="circularTimelineToggle">Línea temporal circular <input type="checkbox" id="circularTimelineToggle" /></label>
        <details>
          <summary>Sonidos</summary>
          <div class="sound-group">
            <p>Metrónomo</p>
            <div class="preview-row">
              <label for="baseSoundSelect" style="display:none"></label>
              <select id="baseSoundSelect"></select>
              <button type="button" id="previewBaseBtn" class="preview-btn">Escuchar</button>
            </div>
            <p>Acento</p>
            <div class="preview-row">
              <label for="accentSoundSelect" style="display:none"></label>
              <select id="accentSoundSelect"></select>
              <button type="button" id="previewAccentBtn" class="preview-btn">Escuchar</button>
            </div>
          </div>
        </details>
        <label for="schedProfileSelect">Rendimiento:
          <select id="schedProfileSelect">
            <option value="mobile">Móvil</option>
            <option value="balanced" selected>Equilibrado</option>
            <option value="desktop">Escritorio</option>
          </select>
        </label>
      </div>
    </details>
    <h1>${title}</h1>
    <button id="muteBtn" class="sound" aria-label="Sonido"></button>
  </header>

  <main>
    <section class="inputs">
      <div class="param lg">
        <span class="abbr">Lg</span>
        <div class="circle"><span class="unit" id="unitLg">Pulsos</span><span class="led" id="ledLg"></span><input id="inputLg" type="number" min="1" step="1" />
          <div class="spinner">
            <button id="inputLgUp" class="spin up" type="button" aria-label="Incrementar Lg"></button>
            <button id="inputLgDown" class="spin down" type="button" aria-label="Decrementar Lg"></button>
          </div>
        </div>
      </div>
      <div class="param v">
        <span class="abbr">V</span>
        <div class="circle"><span class="unit" id="unitV">BPM</span><span class="led" id="ledV"></span><input id="inputV" type="number" min="1" step="1" />
          <div class="spinner">
            <button id="inputVUp" class="spin up" type="button" aria-label="Incrementar V"></button>
            <button id="inputVDown" class="spin down" type="button" aria-label="Decrementar V"></button>
          </div>
        </div>
      </div>
      <div class="param t">
        <span class="abbr">T</span>
        <div class="circle"><span class="unit" id="unitT">segundos</span><span class="led" id="ledT"></span><input id="inputT" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="decimal">
          <div class="spinner">
            <button id="inputTUp" class="spin up" type="button" aria-label="Incrementar T"></button>
            <button id="inputTDown" class="spin down" type="button" aria-label="Decrementar T"></button>
          </div></div>
      </div>
    </section>

    <section class="middle">
      <div id="formula" class="formula"></div>
    </section>

    <section class="timeline-wrapper" id="timelineWrapper">
      <section class="timeline" id="timeline"></section>

      <div class="controls">
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
      <div id="randomMenu" class="random-menu options-content">${randomMenuContent}</div>
      <button id="loopBtn" class="loop" aria-label="Loop">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
    <path d="M370.7 133.3C338 100.6 297.9 85.3 256 85.3c-84.6 0-154.7 61.4-169.3 141.3H32l74.7 74.7 74.7-74.7H117.3c13.3-56.9 64.4-100 126.7-100 36.5 0 70.6 14.2 96.3 39.9l30.4-30.2zm70.6 152.1l-74.7-74.7-74.7 74.7h42.1c-13.3 56.9-64.4 100-126.7 100-36.5 0-70.6-14.2-96.3-39.9l-30.4 30.2C174 411.4 214.1 426.7 256 426.7c84.6 0 154.7-61.4 169.3-141.3h42.1z"/>
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
     <span id="tapHelp" class="tap-help">Se necesitan 3 clicks</span>
     </div>
     <button id="resetBtn" class="reset" aria-label="Reset">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor">
    <path d="M256 32C114.6 32 0 146.6 0 288h64c0-97.2 78.8-176 176-176 43 0 82.5 15.3 113.1 40.8L304 224h208V16L454.6 73.4C408.4 29.3 335.1 0 256 0z"/>
  </svg>
</button>
      </div>
    </section>
  </main>`;
}
