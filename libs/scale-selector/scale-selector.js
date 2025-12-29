/**
 * Scale Selector Module
 *
 * Selector d'escales amb suport per:
 * - Totes les escales mare amb TOTES les seves rotacions/modes
 * - Selector de nota de sortida (transposició 0-11)
 * - Filtres per App: escollir quines escales/rotacions mostrar
 * - Integració amb preferències i factory reset
 *
 * @module scale-selector
 */

import { motherScalesData, scaleSemis } from '../scales/index.js';
import { createPreferenceStorage, registerFactoryReset } from '../app-common/preferences.js';

// ============================================================================
// CONSTANTS - Totes les escales mare disponibles
// ============================================================================

/**
 * IDs de totes les escales mare disponibles
 */
export const SCALE_IDS = Object.keys(motherScalesData);

/**
 * Genera la llista completa d'escales amb totes les rotacions
 * @returns {Array<{id: string, rotation: number, value: string, name: string, scaleName: string, rotationName: string}>}
 */
export function getAllScalesWithRotations() {
  const scales = [];

  for (const scaleId of SCALE_IDS) {
    const scaleData = motherScalesData[scaleId];
    if (!scaleData) continue;

    scaleData.rotNames.forEach((rotName, rotation) => {
      scales.push({
        id: scaleId,
        rotation,
        value: `${scaleId}-${rotation}`,
        name: scaleId === 'DIAT' ? rotName : `${scaleData.name} - ${rotName}`,
        scaleName: scaleData.name,
        rotationName: rotName,
        intervalStructure: scaleData.ee,
        noteCount: scaleData.ee.length
      });
    });
  }

  return scales;
}

/**
 * Llista completa pre-generada de totes les escales amb rotacions
 */
export const ALL_SCALES = getAllScalesWithRotations();

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Rota els semitons d'una escala segons el mode
 * @param {string} scaleId - ID de l'escala (DIAT, ACUS, etc.)
 * @param {number} rotation - Índex de rotació/mode
 * @returns {number[]} Array de semitons rotats
 */
export function getRotatedScaleNotes(scaleId, rotation) {
  const baseSemis = scaleSemis(scaleId);
  if (rotation === 0) return baseSemis;

  // Per rotacions, calculem els semitons relatius al nou mode
  const ee = motherScalesData[scaleId].ee;
  const rotatedEE = [...ee.slice(rotation), ...ee.slice(0, rotation)];

  let acc = 0;
  const result = [0];
  for (let i = 0; i < rotatedEE.length - 1; i++) {
    acc += rotatedEE[i];
    result.push(acc);
  }
  return result;
}

/**
 * Obté el nom de visualització d'una escala
 * Per la diatònica usa els noms dels modes (Mayor, Dórica, etc.)
 * Per la resta d'escales usa el format "NomEscala - NomRotació"
 * @param {string} scaleId - ID de l'escala
 * @param {number} rotation - Índex de rotació
 * @returns {string} Nom de l'escala
 */
export function getScaleDisplayName(scaleId, rotation) {
  const scaleData = motherScalesData[scaleId];
  if (!scaleData) return 'Escala';

  // Només per la diatònica usem els noms dels modes sols
  if (scaleId === 'DIAT' && scaleData.rotNames && scaleData.rotNames[rotation]) {
    return scaleData.rotNames[rotation];
  }

  // Per la resta d'escales, usar "NomEscala - NomRotació" si té múltiples modes
  // o només el nom de l'escala si és simètrica (un sol mode)
  if (scaleData.rotNames.length === 1) {
    return scaleData.name;
  }

  return `${scaleData.name} - ${scaleData.rotNames[rotation]}`;
}

/**
 * Obté el nom curt d'una escala (només el nom del mode/rotació)
 * @param {string} scaleId - ID de l'escala
 * @param {number} rotation - Índex de rotació
 * @returns {string}
 */
export function getScaleShortName(scaleId, rotation) {
  const scaleData = motherScalesData[scaleId];
  if (!scaleData) return 'Escala';
  return scaleData.rotNames[rotation] || scaleData.name;
}

/**
 * Parseja un valor de selector d'escala (format: "SCALEKEY-ROTATION")
 * @param {string} value - Valor del selector (ex: "DIAT-0", "ACUS-2")
 * @returns {{scaleId: string, rotation: number}}
 */
export function parseScaleValue(value) {
  const [scaleId, rot] = value.split('-');
  return {
    scaleId,
    rotation: parseInt(rot, 10)
  };
}

/**
 * Obté informació d'una escala pel seu valor
 * @param {string} value - Valor (ex: "DIAT-2")
 * @returns {Object|null} Informació de l'escala
 */
export function getScaleInfo(value) {
  return ALL_SCALES.find(s => s.value === value) || null;
}

/**
 * Filtra escales segons criteris
 * @param {Object} filter - Criteris de filtre
 * @param {string[]} [filter.scaleIds] - IDs d'escales a incloure (totes si no s'especifica)
 * @param {Object} [filter.rotations] - Rotacions per escala: { DIAT: [0,1,2], ACUS: 'all' }
 * @param {boolean} [filter.onlyFirstRotation=false] - Només primera rotació de cada escala
 * @param {number} [filter.minNotes] - Mínim de notes per escala
 * @param {number} [filter.maxNotes] - Màxim de notes per escala
 * @returns {Array} Escales filtrades
 */
export function filterScales(filter = {}) {
  const {
    scaleIds,
    rotations,
    onlyFirstRotation = false,
    minNotes,
    maxNotes
  } = filter;

  return ALL_SCALES.filter(scale => {
    // Filtre per ID d'escala
    if (scaleIds && !scaleIds.includes(scale.id)) {
      return false;
    }

    // Filtre per rotacions específiques
    if (rotations && rotations[scale.id]) {
      const allowedRots = rotations[scale.id];
      if (allowedRots !== 'all' && !allowedRots.includes(scale.rotation)) {
        return false;
      }
    }

    // Només primera rotació
    if (onlyFirstRotation && scale.rotation !== 0) {
      return false;
    }

    // Filtre per nombre de notes
    if (minNotes !== undefined && scale.noteCount < minNotes) {
      return false;
    }
    if (maxNotes !== undefined && scale.noteCount > maxNotes) {
      return false;
    }

    return true;
  });
}

// ============================================================================
// PRESET FILTERS - Configuracions predefinides per Apps
// ============================================================================

/**
 * Presets de filtres per diferents apps/casos d'ús
 */
export const SCALE_PRESETS = {
  /**
   * App21 original: DIAT amb tots els modes + altres escales només mode 0
   */
  app21: {
    scaleIds: ['DIAT', 'ACUS', 'ARMme', 'ARMma', 'OCT', 'HEX', 'TON', 'CROM'],
    rotations: {
      DIAT: 'all',
      ACUS: [0],
      ARMme: [0],
      ARMma: [0],
      OCT: [0],
      HEX: [0],
      TON: [0],
      CROM: [0]
    }
  },

  /**
   * Totes les escales amb totes les rotacions
   */
  all: {},

  /**
   * Només escales diatòniques (tots els modes)
   */
  diatonic: {
    scaleIds: ['DIAT']
  },

  /**
   * Escales de 7 notes (diatòniques i similars)
   */
  heptatonic: {
    minNotes: 7,
    maxNotes: 7
  },

  /**
   * Escales simètriques (cromàtica, tons enters, octatònica, hexatònica)
   */
  symmetric: {
    scaleIds: ['CROM', 'TON', 'OCT', 'HEX']
  },

  /**
   * Només primera rotació de cada escala
   */
  motherScalesOnly: {
    onlyFirstRotation: true
  }
};

/**
 * Obté escales segons un preset
 * @param {string} presetName - Nom del preset
 * @returns {Array} Escales filtrades
 */
export function getScalesByPreset(presetName) {
  const preset = SCALE_PRESETS[presetName];
  if (!preset) return ALL_SCALES;
  return filterScales(preset);
}

// ============================================================================
// SCALE SELECTOR COMPONENT
// ============================================================================

/**
 * Crea un selector d'escales complet
 * @param {Object} config - Configuració
 * @param {HTMLElement} config.container - Element contenidor
 * @param {string} [config.appId='app'] - ID de l'app per preferències
 * @param {string} [config.initialScale='CROM-0'] - Escala inicial
 * @param {string} [config.preset] - Nom del preset de filtres (ex: 'app21', 'all', 'diatonic')
 * @param {Object} [config.filter] - Filtre personalitzat (alternativa a preset)
 * @param {Array} [config.scales] - Llista d'escales personalitzada (alternativa a preset/filter)
 * @param {Function} [config.onScaleChange] - Callback quan canvia l'escala
 * @param {Function} [config.onTransposeChange] - Callback quan canvia la transposició
 * @param {boolean} [config.enableTranspose=true] - Habilitar selector de transposició
 * @param {boolean} [config.transposeHiddenByDefault=true] - Transposició oculta per defecte
 * @param {string} [config.title] - Títol del selector
 * @param {number} [config.selectSize=14] - Nombre de files visibles del select
 * @returns {Object} API del component
 */
export function createScaleSelector(config) {
  const {
    container,
    appId = 'app',
    initialScale = 'CROM-0',
    preset,
    filter,
    scales: customScales,
    onScaleChange,
    onTransposeChange,
    enableTranspose = true,
    transposeHiddenByDefault = true,
    title = 'Escoge una escala',
    selectSize = 14
  } = config;

  // Preference storage
  const preferenceStorage = createPreferenceStorage(appId);

  // Determinar quines escales mostrar
  let availableScales;
  if (customScales) {
    availableScales = customScales;
  } else if (preset) {
    availableScales = getScalesByPreset(preset);
  } else if (filter) {
    availableScales = filterScales(filter);
  } else {
    availableScales = ALL_SCALES;
  }

  // State
  let currentScale = initialScale;
  let transposeValue = 0;
  let transposeEnabled = !transposeHiddenByDefault;

  // DOM elements
  let selectElement = null;
  let transposeSelector = null;
  let transposeButtons = null;

  /**
   * Genera el HTML del component
   */
  function render() {
    container.innerHTML = '';
    container.classList.add('scale-selector');

    // Títol
    if (title) {
      const titleEl = document.createElement('h2');
      titleEl.className = 'scale-selector-title';
      titleEl.textContent = title;
      container.appendChild(titleEl);
    }

    // Select d'escales
    selectElement = document.createElement('select');
    selectElement.id = `${appId}-scaleSel`;
    selectElement.className = 'scale-select';
    selectElement.setAttribute('size', String(selectSize));
    container.appendChild(selectElement);

    // Poblar selector
    populateScaleSelector();

    // Event listener per canvis d'escala
    selectElement.addEventListener('change', handleScaleChange);

    // Selector de transposició (si està habilitat)
    if (enableTranspose) {
      transposeSelector = document.createElement('div');
      transposeSelector.className = 'transpose-selector';
      transposeSelector.innerHTML = `
        <span class="transpose-label">Nota de Salida</span>
        <div class="transpose-buttons">
          ${Array.from({ length: 12 }, (_, i) =>
            `<button class="transpose-btn${i === 0 ? ' active' : ''}" data-transpose="${i}">${i}</button>`
          ).join('')}
        </div>
      `;
      container.appendChild(transposeSelector);

      transposeButtons = transposeSelector.querySelectorAll('.transpose-btn');

      // Event listeners per botons de transposició
      transposeButtons.forEach(btn => {
        btn.addEventListener('click', () => handleTransposeChange(btn));
      });

      // Carregar preferència de visibilitat
      const stored = preferenceStorage.load('transposeEnabled');
      if (stored !== null) {
        transposeEnabled = stored === 'true';
      }
      updateTransposeVisibility();
    }

    // Establir escala inicial
    selectElement.value = currentScale;
  }

  /**
   * Pobla el selector amb les escales disponibles
   */
  function populateScaleSelector() {
    selectElement.innerHTML = '';

    availableScales.forEach(scale => {
      const opt = document.createElement('option');
      opt.value = scale.value;
      opt.textContent = scale.name;
      selectElement.appendChild(opt);
    });
  }

  /**
   * Handler per canvi d'escala
   */
  function handleScaleChange(e) {
    const value = e.target.value;
    currentScale = value;

    const { scaleId, rotation } = parseScaleValue(value);
    const scaleNotes = getRotatedScaleNotes(scaleId, rotation);
    const displayName = getScaleDisplayName(scaleId, rotation);
    const scaleInfo = getScaleInfo(value);

    if (onScaleChange) {
      onScaleChange({
        value,
        scaleId,
        rotation,
        scaleNotes,
        displayName,
        info: scaleInfo
      });
    }
  }

  /**
   * Handler per canvi de transposició
   */
  function handleTransposeChange(btn) {
    const value = parseInt(btn.dataset.transpose, 10);
    transposeValue = value;

    // Actualitzar estat visual
    transposeButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (onTransposeChange) {
      onTransposeChange(transposeValue);
    }
  }

  /**
   * Actualitza la visibilitat del selector de transposició
   */
  function updateTransposeVisibility() {
    if (!transposeSelector) return;

    if (transposeEnabled) {
      transposeSelector.style.display = 'flex';
    } else {
      transposeSelector.style.display = 'none';
      // Reset a 0 quan es desactiva
      if (transposeValue !== 0) {
        transposeValue = 0;
        transposeButtons.forEach(b => b.classList.remove('active'));
        const zeroBtn = transposeSelector.querySelector('.transpose-btn[data-transpose="0"]');
        if (zeroBtn) zeroBtn.classList.add('active');

        if (onTransposeChange) {
          onTransposeChange(0);
        }
      }
    }
  }

  /**
   * Afegeix l'opció de transposició al menú d'opcions de l'app
   * @param {HTMLElement} [menuContainer] - Contenidor del menú (per defecte: busca factoryResetBtn)
   */
  function addTransposeOptionToMenu(menuContainer) {
    const factoryResetBtn = menuContainer || document.getElementById('factoryResetBtn');
    if (!factoryResetBtn) {
      // El header encara no s'ha creat, reintentar després
      setTimeout(() => addTransposeOptionToMenu(menuContainer), 100);
      return;
    }

    const parentNode = menuContainer ? menuContainer : factoryResetBtn.parentNode;

    // Crear el label amb checkbox
    const label = document.createElement('label');
    label.htmlFor = `${appId}-enableTranspose`;
    label.innerHTML = `Activar N de Salida <input type="checkbox" id="${appId}-enableTranspose">`;
    label.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; cursor: pointer;';

    // Inserir just abans del botó factory reset (o al final del container)
    if (menuContainer) {
      parentNode.appendChild(label);
    } else {
      parentNode.insertBefore(label, factoryResetBtn);
    }

    const checkbox = document.getElementById(`${appId}-enableTranspose`);

    // Carregar preferència guardada
    const stored = preferenceStorage.load('transposeEnabled');
    if (stored !== null) {
      transposeEnabled = stored === 'true';
    }
    checkbox.checked = transposeEnabled;

    // Aplicar visibilitat inicial
    updateTransposeVisibility();

    // Event listener per canvis
    checkbox.addEventListener('change', () => {
      transposeEnabled = checkbox.checked;
      preferenceStorage.save('transposeEnabled', String(transposeEnabled));
      updateTransposeVisibility();
    });

    // Escoltar factory reset per resetejar el checkbox
    window.addEventListener('sharedui:factoryreset', () => {
      transposeEnabled = false;
      checkbox.checked = false;
      updateTransposeVisibility();
    });
  }

  // API pública
  const api = {
    /**
     * Renderitza el component
     */
    render,

    /**
     * Obté l'escala actual
     * @returns {string} Valor de l'escala (ex: "DIAT-0")
     */
    getScale: () => currentScale,

    /**
     * Estableix l'escala
     * @param {string} value - Valor de l'escala
     * @param {boolean} [triggerCallback=true] - Si true, crida el callback onScaleChange
     */
    setScale: (value, triggerCallback = true) => {
      currentScale = value;
      if (selectElement) {
        selectElement.value = value;
        if (triggerCallback) {
          handleScaleChange({ target: selectElement });
        }
      }
    },

    /**
     * Obté les notes de l'escala actual
     * @returns {number[]} Array de semitons
     */
    getScaleNotes: () => {
      const { scaleId, rotation } = parseScaleValue(currentScale);
      return getRotatedScaleNotes(scaleId, rotation);
    },

    /**
     * Obté el nom de l'escala actual
     * @returns {string}
     */
    getScaleDisplayName: () => {
      const { scaleId, rotation } = parseScaleValue(currentScale);
      return getScaleDisplayName(scaleId, rotation);
    },

    /**
     * Obté informació completa de l'escala actual
     * @returns {Object|null}
     */
    getScaleInfo: () => getScaleInfo(currentScale),

    /**
     * Obté el valor de transposició
     * @returns {number} 0-11
     */
    getTranspose: () => transposeValue,

    /**
     * Estableix la transposició
     * @param {number} value - 0-11
     * @param {boolean} [triggerCallback=true]
     */
    setTranspose: (value, triggerCallback = true) => {
      if (value < 0 || value > 11) return;
      transposeValue = value;

      if (transposeButtons) {
        transposeButtons.forEach(b => b.classList.remove('active'));
        const btn = Array.from(transposeButtons).find(b =>
          parseInt(b.dataset.transpose, 10) === value
        );
        if (btn) btn.classList.add('active');
      }

      if (triggerCallback && onTransposeChange) {
        onTransposeChange(transposeValue);
      }
    },

    /**
     * Mostra/oculta el selector de transposició
     * @param {boolean} enabled
     */
    setTransposeEnabled: (enabled) => {
      transposeEnabled = enabled;
      preferenceStorage.save('transposeEnabled', String(enabled));
      updateTransposeVisibility();
    },

    /**
     * Retorna si la transposició està habilitada
     * @returns {boolean}
     */
    isTransposeEnabled: () => transposeEnabled,

    /**
     * Afegeix l'opció de transposició al menú d'opcions
     * @param {HTMLElement} [menuContainer]
     */
    addTransposeOptionToMenu,

    /**
     * Aplica una nota MIDI amb transposició
     * @param {number} midiNote - Nota MIDI original
     * @returns {number} Nota MIDI transposada
     */
    applyTranspose: (midiNote) => midiNote + transposeValue,

    /**
     * Obté l'element select
     * @returns {HTMLSelectElement}
     */
    getSelectElement: () => selectElement,

    /**
     * Obté les escales disponibles configurades
     * @returns {Array}
     */
    getAvailableScales: () => availableScales,

    /**
     * Actualitza les escales disponibles
     * @param {Array|string|Object} newScales - Llista d'escales, nom de preset, o objecte de filtre
     */
    setAvailableScales: (newScales) => {
      if (Array.isArray(newScales)) {
        availableScales = newScales;
      } else if (typeof newScales === 'string') {
        availableScales = getScalesByPreset(newScales);
      } else {
        availableScales = filterScales(newScales);
      }
      populateScaleSelector();
    },

    /**
     * Registra factory reset
     */
    registerFactoryReset: () => {
      registerFactoryReset({ storage: preferenceStorage });
    },

    /**
     * Destrueix el component i neteja events
     */
    destroy: () => {
      if (selectElement) {
        selectElement.removeEventListener('change', handleScaleChange);
      }
      if (transposeButtons) {
        transposeButtons.forEach(btn => {
          btn.removeEventListener('click', () => {});
        });
      }
      container.innerHTML = '';
    }
  };

  return api;
}

// ============================================================================
// STANDALONE TRANSPOSE SELECTOR
// ============================================================================

/**
 * Crea un selector de transposició independent (sense selector d'escales)
 * @param {Object} config - Configuració
 * @param {HTMLElement} config.container - Element contenidor
 * @param {string} [config.appId='app'] - ID de l'app per preferències
 * @param {number} [config.initialValue=0] - Valor inicial (0-11)
 * @param {Function} [config.onChange] - Callback quan canvia
 * @param {string} [config.label='Nota de Salida'] - Etiqueta
 * @returns {Object} API del component
 */
export function createTransposeSelector(config) {
  const {
    container,
    appId = 'app',
    initialValue = 0,
    onChange,
    label = 'Nota de Salida'
  } = config;

  let value = initialValue;
  let buttons = null;

  function render() {
    container.innerHTML = '';
    container.classList.add('transpose-selector');
    container.innerHTML = `
      <span class="transpose-label">${label}</span>
      <div class="transpose-buttons">
        ${Array.from({ length: 12 }, (_, i) =>
          `<button class="transpose-btn${i === value ? ' active' : ''}" data-transpose="${i}">${i}</button>`
        ).join('')}
      </div>
    `;

    buttons = container.querySelectorAll('.transpose-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const newValue = parseInt(btn.dataset.transpose, 10);
        value = newValue;
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (onChange) onChange(value);
      });
    });
  }

  return {
    render,
    getValue: () => value,
    setValue: (v, triggerCallback = true) => {
      if (v < 0 || v > 11) return;
      value = v;
      if (buttons) {
        buttons.forEach(b => b.classList.remove('active'));
        const btn = Array.from(buttons).find(b => parseInt(b.dataset.transpose, 10) === v);
        if (btn) btn.classList.add('active');
      }
      if (triggerCallback && onChange) onChange(value);
    },
    applyTranspose: (midi) => midi + value,
    destroy: () => {
      container.innerHTML = '';
    }
  };
}
