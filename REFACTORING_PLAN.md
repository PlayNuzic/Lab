# Plan de Refactorización App4 → Módulos Reutilizables

**Objetivo**: Reducir [main.js](/Users/workingburcet/Lab/Apps/App4/main.js) de **4225 líneas** a ~**1200-1500 líneas**, extrayendo funcionalidades reutilizables para futuras apps.

**Reducción estimada**: ~2700 líneas movidas a módulos compartidos.

---

## Estado Actual del Código

### Archivo Principal
- **main.js**: 4225 líneas
- **fraction-selection.js**: Módulo específico de App4 para gestión de fracciones
- **utils.js**: Utilidades locales (cálculos de tamaño, fuentes)

### Variables Globales Problemáticas (50+)
```javascript
// Estado de reproducción
let audio, isPlaying, loopEnabled, isUpdating, circularTimeline

// Elementos del timeline
let pulses = [], pulseNumberLabels = [], cycleMarkers = [], cycleLabels = []
let bars = [], pulseHits = [], cycleMarkerHits = []

// Cachés de highlighting
let lastPulseScrollCache, lastPulseHighlightState, lastFractionHighlightNodes
let lastCycleHighlightState, lastVisualStep, lastNormalizedStep

// Controladores de fracción
let numeratorInput, denominatorInput, pulseSeqFractionWrapper
let fractionEditorController, currentFractionInfo

// Notación
let notationRenderer, notationPanelController

// Otros
let visualSyncHandle, tIndicatorRevealHandle, currentAudioResolution
const fractionStore = createFractionSelectionStore()
const fractionMemory = new Map()
```

---

## Módulos a Crear

### 📦 **FASE 1: Utilidades Puras** (Bajo riesgo, alta reutilización)

#### 1.1 `libs/app-common/pulse-seq-parser.js` ✅ NUEVO
**Líneas a extraer**: ~200 (de sanitizePulseSeq)

**Responsabilidad**: Parseo y validación de tokens del campo de secuencia de pulsos.

```javascript
/**
 * Parsea el texto del pulseSeq en tokens con posiciones
 * @param {string} text - Texto del input (ej: "  1  3.2  5  ")
 * @returns {Array<{raw: string, start: number, type: 'int'|'fraction'}>}
 */
export function parseTokens(text) {
  const tokenRegex = /\d+\.\d+|\.\d+|\d+/g;
  const tokens = [];
  let match;
  while ((match = tokenRegex.exec(text)) !== null) {
    const raw = match[0];
    tokens.push({
      raw,
      start: match.index,
      type: raw.includes('.') ? 'fraction' : 'int'
    });
  }
  return tokens;
}

/**
 * Valida un token de pulso entero
 * @returns {{valid: boolean, value?: number, error?: string}}
 */
export function validateInteger(token, { lg }) {
  const n = Number.parseInt(token.raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    return { valid: false, error: 'not-finite' };
  }
  if (!Number.isNaN(lg) && n >= lg) {
    return { valid: false, error: 'too-big', value: n };
  }
  return { valid: true, value: n };
}

/**
 * Valida un token de fracción
 * @param {object} token
 * @param {object} context - {numerator, denominator, lg, position}
 * @returns {{valid: boolean, entry?: object, error?: string}}
 */
export function validateFraction(token, context) {
  // Lógica compleja de validación de fracciones
  // Manejo de notación .n (ej: .2) vs n.m (ej: 3.2)
  // Conversión de notación cíclica a fraccionaria
  // ...
}

/**
 * Normaliza display de fracción (base.numerator vs cycleIndex.subdivisionIndex)
 */
export function normalizeFractionDisplay(entry, { cycleNotation = false, numeratorPerCycle }) {
  if (!cycleNotation || !numeratorPerCycle) {
    return `${entry.base}.${entry.numerator}`;
  }
  // Convertir a notación cíclica
  const cycleIndex = Math.floor(entry.base / numeratorPerCycle);
  return `${cycleIndex}.${entry.subdivisionIndex}`;
}

/**
 * Resuelve el gap (base, next) para una posición del caret
 */
export function resolvePulseSeqGap(position, lg, ranges) {
  // Lógica de main.js:2264-2288
}
```

**Archivos afectados**:
- `main.js`: Eliminar parseTokens interno, usar importado

---

#### 1.2 `libs/app-common/pulse-seq-state.js` ✅ NUEVO
**Líneas a extraer**: ~150

**Responsabilidad**: Gestión de estado de pulseSeq (pulseMemory + fractionStore).

```javascript
/**
 * Crea gestor de estado para pulseSeq
 */
export function createPulseSeqStateManager({ fractionStore, pulseMemoryApi }) {
  return {
    /**
     * Aplica tokens validados al estado
     * @param {Array<number>} integers - Pulsos enteros válidos
     * @param {Array<object>} fractions - Fracciones válidas
     */
    applyValidatedTokens(integers, fractions) {
      // Actualizar pulseMemory
      integers.forEach(i => { pulseMemoryApi.data[i] = true; });

      // Actualizar fractionStore
      fractionStore.selectionState.clear();
      fractions.forEach(entry => {
        fractionStore.selectionState.set(entry.key, entry);
      });
    },

    /**
     * Genera texto formateado del campo pulseSeq
     * @param {object} opts - {lg, ranges, fractionStore}
     * @returns {string}
     */
    generateFieldText({ lg, ranges, includeIntegers = true }) {
      if (Number.isFinite(lg) && lg > 0) {
        // Usar pulseMemory para generar texto
        const ints = [];
        for (let i = 1; i < lg; i++) {
          if (pulseMemoryApi.data[i]) ints.push(i);
        }
        const fracs = Array.from(fractionStore.selectionState.values())
          .map(f => f.display)
          .sort();
        return '  ' + [...ints, ...fracs].join('  ') + '  ';
      }

      // Sin Lg válido: usar orden de entrada
      const combined = [...];
      return '  ' + combined.map(e => e.display).join('  ') + '  ';
    },

    /**
     * Sincroniza pulseMemory con lg
     */
    syncMemory(lg) {
      pulseMemoryApi.ensure(lg);
    }
  };
}
```

**Archivos afectados**:
- `main.js`: Usar en lugar de lógica dispersa

---

### 📦 **FASE 2: Editor de Secuencia de Pulsos**

#### 2.1 `libs/app-common/pulse-seq-editor.js` ✅ NUEVO
**Líneas a extraer**: ~180 (eventos de teclado + helpers)

**Responsabilidad**: Manejo del contenteditable con navegación personalizada.

```javascript
/**
 * Crea editor de secuencia de pulsos con navegación por gaps
 */
export function createPulseSeqEditor({
  editElement,
  visualLayer,
  onTextChange,
  getMidpoints // función que extrae posiciones entre números
}) {

  function handleKeyDown(e) {
    if (e.key === 'ArrowLeft' || e.key === 'Home') {
      e.preventDefault();
      moveCaretStep(-1);
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'End') {
      e.preventDefault();
      moveCaretStep(1);
      return;
    }

    // Solo dígitos, espacio y navegación
    const allowed = new Set([
      'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight',
      'ArrowUp', 'ArrowDown', 'Home', 'End', 'Tab', ' '
    ]);
    if (!allowed.has(e.key) && !/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  }

  function handleBackspaceDelete(e) {
    if (e.key !== 'Backspace' && e.key !== 'Delete') return;

    const node = editElement.firstChild;
    if (!node || node.nodeType !== 3) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const offset = sel.getRangeAt(0).startOffset;

    // Lógica de borrado inteligente (insertar '  ' en lugar de borrar)
    // ... (de main.js:1922-1990)
  }

  function moveCaretToNearestGap() {
    const text = getText();
    const midpoints = getMidpoints(text);
    // Mover caret al gap más cercano
    // ... (de main.js:1193-1198)
  }

  function moveCaretStep(direction) {
    // Navegar entre gaps
    // ... (de main.js:1196-1198)
  }

  function getText() {
    const node = editElement.firstChild;
    return node && node.nodeType === 3 ? node.textContent : '';
  }

  function setText(str) {
    const node = editElement.firstChild || editElement;
    if (node.nodeType === 3) {
      node.textContent = str;
    } else {
      editElement.textContent = str;
    }
    updateVisualLayer(str);
    onTextChange?.(str);
  }

  function updateVisualLayer(text) {
    if (!visualLayer) return;
    // Renderizar spans coloreados para tokens
    // ... (de main.js:1074-1104)
  }

  function setSelection(start, end) {
    const node = editElement.firstChild;
    if (!node) return;
    const range = document.createRange();
    range.setStart(node, Math.min(start, node.textContent?.length ?? 0));
    range.setEnd(node, Math.min(end, node.textContent?.length ?? 0));
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  // API pública
  return {
    attach() {
      editElement.addEventListener('keydown', handleKeyDown);
      editElement.addEventListener('keydown', handleBackspaceDelete);
      editElement.addEventListener('blur', () => {
        onTextChange?.(getText(), { cause: 'blur' });
      });
      editElement.addEventListener('mouseup', () => {
        setTimeout(moveCaretToNearestGap, 0);
      });
      editElement.addEventListener('focus', () => {
        setTimeout(() => {
          const text = getText();
          if (text.length === 0) {
            setText('  ');
            setSelection(1, 1);
          } else {
            const normalized = normalizeGaps(text);
            if (normalized !== text) setText(normalized);
            moveCaretToNearestGap();
          }
        }, 0);
      });
    },

    detach() {
      // Unbind eventos
    },

    getValue() {
      return getText();
    },

    setValue(str) {
      setText(str);
    },

    setSelection,
    moveCaretToNearestGap
  };
}

/**
 * Normaliza gaps (asegura espacios dobles)
 */
export function normalizeGaps(text) {
  // Lógica de main.js:1066-1072
  return text.replace(/(\S)\s+(\S)/g, '$1  $2').replace(/^\s+/, '  ').replace(/\s+$/, '  ');
}

/**
 * Extrae midpoints (posiciones entre números)
 */
export function getMidpoints(text) {
  const a = [];
  for (let i = 1; i < text.length; i++) {
    if (text[i - 1] === ' ' && text[i] === ' ') a.push(i);
  }
  return a;
}
```

**Archivos afectados**:
- `main.js`: Reemplazar eventos inline por `createPulseSeqEditor()`

---

### 📦 **FASE 3: Refactorización de `sanitizePulseSeq`**

#### 3.1 Simplificar `sanitizePulseSeq` usando nuevos módulos
**Líneas antes**: 330
**Líneas después**: ~80

```javascript
// main.js (simplificado)
import { parseTokens, validateInteger, validateFraction } from '../../libs/app-common/pulse-seq-parser.js';
import { createPulseSeqStateManager } from '../../libs/app-common/pulse-seq-state.js';

const pulseSeqState = createPulseSeqStateManager({
  fractionStore,
  pulseMemoryApi
});

function sanitizePulseSeq(opts = {}) {
  if (!pulseSeqEl) return { hadTooBig: false, hadFractionTooBig: false };

  const lg = parseInt(inputLg.value);
  const text = getPulseSeqText();
  const caretBefore = getCaretPosition();

  // 1. Parsear tokens
  const tokens = parseTokens(text);

  // 2. Validar y separar enteros vs fracciones
  const { numerator, denominator } = getFraction();
  const integers = [];
  const fractions = [];
  const errors = { tooBig: [], fractionTooBig: [] };

  for (const token of tokens) {
    if (token.type === 'int') {
      const result = validateInteger(token, { lg });
      if (result.valid) {
        integers.push(result.value);
      } else if (result.error === 'too-big') {
        errors.tooBig.push(result.value);
      }
    } else {
      const result = validateFraction(token, {
        numerator, denominator, lg,
        position: token.start
      });
      if (result.valid) {
        fractions.push(result.entry);
      } else if (result.error === 'too-big') {
        errors.fractionTooBig.push(token.raw);
      }
    }
  }

  // 3. Aplicar al estado
  pulseSeqState.applyValidatedTokens(integers, fractions);

  // 4. Regenerar texto del campo
  const newText = pulseSeqState.generateFieldText({ lg });
  setPulseSeqText(newText);

  // 5. Restaurar caret
  if (!opts.skipCaret) {
    const newPos = Math.min(caretBefore, newText.length);
    setPulseSeqSelection(newPos, newPos);
    pulseSeqEditor.moveCaretToNearestGap();
  }

  // 6. Mostrar errores
  if (errors.tooBig.length > 0) {
    showPulseSeqAutoTip(`El número <strong>${errors.tooBig[0]}</strong> es mayor que Lg...`);
  }
  if (errors.fractionTooBig.length > 0) {
    showPulseSeqAutoTip(`El Pfr '<strong>${errors.fractionTooBig[0]}</strong>' es mayor que d...`);
  }

  return {
    hadTooBig: errors.tooBig.length > 0,
    hadFractionTooBig: errors.fractionTooBig.length > 0
  };
}
```

---

### 📦 **FASE 4: Sistema de Highlighting**

#### 4.1 `libs/app-common/highlight-controller.js` ✅ NUEVO
**Líneas a extraer**: ~280 (highlightPulse + highlightCycle + syncVisualState)

**Responsabilidad**: Gestión unificada de highlighting con scroll automático.

```javascript
/**
 * Crea controlador de highlighting para timeline y pulseSeq
 */
export function createHighlightController({
  timeline,
  pulseSeq,
  getPulses, // función que devuelve array de elementos .pulse
  getCycleMarkers,
  fractionStore,
  epsilon = 0.001
}) {

  // Estado interno privado
  const cache = {
    pulse: {
      type: null,
      index: null,
      fractionKey: null,
      trailingIndex: null,
      rect: null,
      scrollLeft: null
    },
    cycle: {
      cycleIndex: null,
      subdivisionIndex: null,
      activeMarkers: []
    }
  };

  let lastNormalizedStep = null;

  /**
   * Highlighting de pulso entero
   */
  function highlightInteger(index, { loopEnabled = false } = {}) {
    const pulses = getPulses();
    if (!pulses || index < 0 || index >= pulses.length) return;

    // Limpiar highlights anteriores
    pulses.forEach(p => p?.classList.remove('active'));

    const current = pulses[index];
    if (current) {
      void current.offsetWidth; // Force reflow
      current.classList.add('active');
    }

    // Trailing pulse si loopEnabled y volvemos a 0
    let trailingIndex = null;
    if (loopEnabled && index === 0 && pulses.length > 0) {
      trailingIndex = pulses.length - 1;
      pulses[trailingIndex]?.classList.add('active');
    }

    // Scroll automático en pulseSeq
    if (pulseSeq) {
      scrollPulseSeqToIndex(index, trailingIndex);
    }

    cache.pulse = { type: 'int', index, trailingIndex, fractionKey: null };
  }

  /**
   * Highlighting de fracción
   */
  function highlightFraction(key) {
    const pulses = getPulses();
    pulses?.forEach(p => p?.classList.remove('active'));

    // Aplicar clase a marcador de fracción
    setFractionHighlightKey(key);

    // Scroll automático
    if (pulseSeq) {
      scrollPulseSeqToFractionKey(key);
    }

    cache.pulse = { type: 'fraction', index: null, fractionKey: key, trailingIndex: null };
  }

  /**
   * Highlighting de ciclo
   */
  function highlightCycle({ cycleIndex, subdivisionIndex }) {
    const markers = getCycleMarkers();

    // Limpiar highlights previos
    cache.cycle.activeMarkers.forEach(m => m?.classList.remove('active'));
    cache.cycle.activeMarkers = [];

    // Buscar y activar marcador correspondiente
    const target = markers.find(m =>
      parseInt(m.dataset.cycleIndex) === cycleIndex &&
      parseInt(m.dataset.subdivision) === subdivisionIndex
    );

    if (target) {
      target.classList.add('active');
      cache.cycle.activeMarkers.push(target);
    }

    cache.cycle = { cycleIndex, subdivisionIndex, activeMarkers: cache.cycle.activeMarkers };
  }

  /**
   * Highlighting automático desde payload (entero o fracción)
   */
  function highlightPulse(payload, { loopEnabled = false, resolution = 1 } = {}) {
    const rawStep = payload?.step ?? payload?.rawStep ?? payload;
    if (!Number.isFinite(rawStep)) return;

    const pulses = getPulses();
    const baseCount = pulses.length > 1 ? pulses.length - 1 : 0;
    if (baseCount <= 0) return;

    // Normalizar step
    const scaledSpan = baseCount * resolution;
    let normalizedScaled = rawStep;
    if (loopEnabled) {
      normalizedScaled = ((rawStep % scaledSpan) + scaledSpan) % scaledSpan;
    } else {
      normalizedScaled = Math.max(0, Math.min(rawStep, scaledSpan));
    }

    const normalizedValue = normalizedScaled / resolution;
    const nearestInt = Math.round(normalizedValue);
    const isIntegerStep = Math.abs(normalizedValue - nearestInt) <= epsilon;

    if (isIntegerStep) {
      highlightInteger(nearestInt, { loopEnabled });
    } else {
      // Buscar fracción coincidente
      const match = findFractionMatch(normalizedValue);
      if (match?.key) {
        highlightFraction(match.key);
      }
    }

    lastNormalizedStep = normalizedScaled;
  }

  /**
   * Busca fracción cercana al valor
   */
  function findFractionMatch(value) {
    for (const [key, info] of fractionStore.selectionState) {
      if (Math.abs(info.value - value) <= epsilon) {
        return { key, ...info };
      }
    }
    return null;
  }

  /**
   * Scroll automático a índice de pulso
   */
  function scrollPulseSeqToIndex(index, trailingIndex = null) {
    // Lógica de scroll (similar a main.js:3723-3750)
  }

  /**
   * Scroll automático a clave de fracción
   */
  function scrollPulseSeqToFractionKey(key) {
    // Lógica de scroll
  }

  function setFractionHighlightKey(key) {
    // Aplicar clase .active-fraction a marcadores
  }

  function clearAll() {
    const pulses = getPulses();
    pulses?.forEach(p => p?.classList.remove('active'));
    cache.cycle.activeMarkers.forEach(m => m?.classList.remove('active'));
    cache.pulse = { type: null, index: null, fractionKey: null, trailingIndex: null };
    cache.cycle = { cycleIndex: null, subdivisionIndex: null, activeMarkers: [] };
  }

  // API pública
  return {
    highlightInteger,
    highlightFraction,
    highlightCycle,
    highlightPulse,
    clearAll,
    getCache: () => ({ ...cache })
  };
}
```

**Archivos afectados**:
- `main.js`: Reemplazar `highlightPulse`, `highlightCycle`, `clearHighlights` por controlador

---

#### 4.2 `libs/app-common/visual-sync.js` ✅ NUEVO
**Líneas a extraer**: ~60

**Responsabilidad**: Loop de sincronización visual con requestAnimationFrame.

```javascript
/**
 * Crea gestor de sincronización visual
 */
export function createVisualSyncManager({
  getAudio, // función que devuelve instancia de audio
  getIsPlaying, // función que devuelve estado de reproducción
  highlightController,
  notationRenderer = null
}) {

  let rafHandle = null;
  let lastVisualStep = null;

  function syncVisualState() {
    if (!getIsPlaying()) return;

    const audio = getAudio();
    if (!audio || typeof audio.getVisualState !== 'function') return;

    const state = audio.getVisualState();
    if (!state || !Number.isFinite(state.step)) return;

    // Evitar duplicados
    if (lastVisualStep === state.step) return;
    lastVisualStep = state.step;

    // Actualizar cursor de notación
    if (notationRenderer && typeof notationRenderer.updateCursor === 'function') {
      const resolution = state.resolution ?? 1;
      const currentPulse = state.step / resolution;
      notationRenderer.updateCursor(currentPulse, getIsPlaying());
    }

    // Highlighting de pulsos
    highlightController.highlightPulse(state, {
      loopEnabled: audio.getLoop?.() ?? false,
      resolution: state.resolution ?? 1
    });

    // Highlighting de ciclos
    if (state.cycle) {
      highlightController.highlightCycle(state.cycle);
    }
  }

  function start() {
    stop();
    const step = () => {
      rafHandle = null;
      if (!getIsPlaying()) return;
      syncVisualState();
      rafHandle = requestAnimationFrame(step);
    };
    rafHandle = requestAnimationFrame(step);
  }

  function stop() {
    if (rafHandle != null) {
      cancelAnimationFrame(rafHandle);
      rafHandle = null;
    }
    lastVisualStep = null;
  }

  return { start, stop, syncVisualState };
}
```

**Archivos afectados**:
- `main.js`: Usar en lugar de `startVisualSync`, `stopVisualSync`, `syncVisualState`

---

### 📦 **FASE 5: renderTimeline() Modular**

#### 5.1 `libs/app-common/timeline-renderer.js` (AMPLIAR EXISTENTE)
**Líneas a extraer**: ~350 (renderTimeline completo)

**Responsabilidad**: Renderizado de timeline con fracciones, pulsos, ciclos.

```javascript
/**
 * Crea renderizador de timeline con soporte de fracciones
 * AMPLÍA createTimelineRenderer existente
 */
export function createFractionalTimelineRenderer({
  timeline,
  timelineWrapper,
  getLg,
  getFraction, // función que devuelve {numerator, denominator}
  fractionStore,
  fractionMemory,
  attachSelectionListeners,
  computeHitSizePx,
  computeNumberFontRem,
  computeSubdivisionFontRem,
  constants = {
    FRACTION_POSITION_EPSILON: 0.001,
    SUBDIVISION_HIDE_THRESHOLD: 41,
    PULSE_NUMBER_HIDE_THRESHOLD: 71
  }
}) {

  let pulses = [];
  let pulseHits = [];
  let cycleMarkers = [];
  let cycleMarkerHits = [];
  let cycleLabels = [];
  let bars = [];
  let pulseNumberLabels = [];

  /**
   * Renderiza timeline completo
   */
  function render() {
    // Reset state
    pulses = [];
    pulseHits = [];
    cycleMarkers = [];
    cycleMarkerHits = [];
    cycleLabels = [];
    bars = [];
    pulseNumberLabels = [];

    fractionStore.hitMap.clear();
    fractionStore.markerMap.clear();
    fractionStore.labelLookup.clear();

    timeline.innerHTML = '';

    const lg = getLg();
    if (!Number.isFinite(lg) || lg <= 0) return;

    const { numerator, denominator } = getFraction();

    // 1. Renderizar pulsos enteros (0 a lg)
    renderIntegerPulses({ lg, numerator, denominator });

    // 2. Renderizar subdivisiones fraccionarias
    renderFractionalSubdivisions({ lg, numerator, denominator });

    // 3. Gestionar selecciones suspendidas/restauradas
    manageFractionMemory({ lg, numerator, denominator });

    // 4. Retornar referencias a elementos
    return {
      pulses,
      pulseHits,
      cycleMarkers,
      cycleMarkerHits,
      cycleLabels,
      bars,
      pulseNumberLabels
    };
  }

  function renderIntegerPulses({ lg, numerator, denominator }) {
    for (let i = 0; i <= lg; i++) {
      const pulse = document.createElement('div');
      pulse.className = 'pulse';
      if (i === 0) pulse.classList.add('zero');
      else if (i === lg) pulse.classList.add('lg');
      pulse.dataset.index = String(i);

      // Aplicar clase si no es seleccionable
      const selectable = isIntegerPulseSelectable(i, numerator, denominator, lg);
      if (i !== 0 && i !== lg && !selectable) {
        pulse.classList.add('non-selectable');
      }

      timeline.appendChild(pulse);
      pulses.push(pulse);

      // Barras
      if (i === 0 || i === lg) {
        const bar = document.createElement('div');
        bar.className = 'bar';
        timeline.appendChild(bar);
        bars.push(bar);
      }

      // Hit área
      const hit = createPulseHit({ index: i, lg, selectable });
      timeline.appendChild(hit);
      pulseHits.push(hit);
    }
  }

  function renderFractionalSubdivisions({ lg, numerator, denominator }) {
    const grid = gridFromOrigin({ lg, numerator, denominator });
    if (grid.cycles <= 0 || !grid.subdivisions.length) return;

    const hideFractionLabels = lg >= constants.SUBDIVISION_HIDE_THRESHOLD;
    const validFractionKeys = new Set();

    grid.subdivisions.forEach(({ cycleIndex, subdivisionIndex, position }) => {
      const marker = createCycleMarker({
        cycleIndex,
        subdivisionIndex,
        position,
        lg,
        numerator,
        denominator,
        hideFractionLabels
      });

      timeline.appendChild(marker.element);
      cycleMarkers.push(marker.element);

      if (marker.fractionKey) {
        validFractionKeys.add(marker.fractionKey);
        fractionStore.markerMap.set(marker.fractionKey, marker.element);

        // Hit área para fracción
        const hit = createFractionHit(marker);
        timeline.appendChild(hit);
        cycleMarkerHits.push(hit);
        fractionStore.hitMap.set(marker.fractionKey, hit);

        // Label
        if (!hideFractionLabels && marker.label) {
          const label = createFractionLabel(marker);
          timeline.appendChild(label);
          cycleLabels.push(label);
        }
      }
    });

    return validFractionKeys;
  }

  function createPulseHit({ index, lg, selectable }) {
    // Lógica de main.js:2963-2988
  }

  function createCycleMarker({ cycleIndex, subdivisionIndex, position, lg, numerator, denominator, hideFractionLabels }) {
    // Lógica de main.js:3037-3177
  }

  function createFractionHit(markerInfo) {
    // Lógica de main.js:3101-3133
  }

  function createFractionLabel(markerInfo) {
    // Lógica de main.js:3184-3213
  }

  function manageFractionMemory({ lg, numerator, denominator }) {
    // Suspender fracciones inválidas
    // Restaurar fracciones válidas desde memoria
    // Lógica de main.js:3217-3254
  }

  return {
    render,
    getPulses: () => pulses,
    getPulseHits: () => pulseHits,
    getCycleMarkers: () => cycleMarkers,
    getCycleMarkerHits: () => cycleMarkerHits,
    getCycleLabels: () => cycleLabels,
    getBars: () => bars,
    getPulseNumberLabels: () => pulseNumberLabels
  };
}
```

**Archivos afectados**:
- `main.js`: Reemplazar `renderTimeline()` por `timelineRenderer.render()`
- `libs/app-common/timeline-layout.js`: Ampliar para soportar fracciones

---

### 📦 **FASE 6: Randomización con Fracciones**

#### 6.1 `libs/app-common/random-config.js` (AMPLIAR EXISTENTE)
**Líneas a añadir**: ~100

**Responsabilidad**: Extender randomización para soportar n, d y fracciones.

```javascript
// Ampliar funciones existentes
export function applyBaseRandomConfig(cfg, controls = {}) {
  // ... código existente ...

  // Añadir soporte para n, d
  const { n, d, allowComplex } = controls;
  if (n) {
    if (cfg.n?.enabled != null) n.toggle.checked = cfg.n.enabled;
    if (cfg.n?.range) {
      n.min.value = cfg.n.range[0];
      n.max.value = cfg.n.range[1];
    }
  }
  if (d) {
    if (cfg.d?.enabled != null) d.toggle.checked = cfg.d.enabled;
    if (cfg.d?.range) {
      d.min.value = cfg.d.range[0];
      d.max.value = cfg.d.range[1];
    }
  }
  if (allowComplex && typeof cfg.allowComplex === 'boolean') {
    allowComplex.checked = cfg.allowComplex;
  }
}

export function updateBaseRandomConfig(randomConfig, controls = {}, defaults = {}) {
  // ... código existente ...

  // Añadir n, d
  const { n, d, allowComplex } = controls;
  if (n) {
    let [min, max] = cfg.n?.range ?? defaults.n?.range ?? [1, 1];
    if (!allowComplex?.checked) {
      min = 1;
      max = 1;
    }
    randomConfig.n = {
      enabled: n.toggle?.checked ?? true,
      range: resolveIntRange(n.min.value, n.max.value, [min, max])
    };
  }
  if (d) {
    randomConfig.d = {
      enabled: d.toggle?.checked ?? true,
      range: resolveIntRange(d.min.value, d.max.value, defaults.d?.range ?? [1, 8])
    };
  }
  if (allowComplex) {
    randomConfig.allowComplex = !!allowComplex.checked;
  }

  return randomConfig;
}
```

#### 6.2 Mover `randomize()` de App4 a módulo
**Archivo nuevo**: `libs/app-common/random-fractional.js`
**Líneas a extraer**: ~120

```javascript
/**
 * Randomización con soporte de fracciones
 * Extiende la randomización básica de Lg/V con n/d y pulsos fraccionarios
 */
export function randomizeFractional({
  randomConfig,
  defaults,
  inputs, // {inputLg, inputV}
  fractionEditor, // controller de fracción
  pulseMemoryApi,
  fractionStore,
  randomCount,
  isIntegerPulseSelectable,
  nearestPulseIndex,
  callbacks = {
    onLgChange: null,
    onVChange: null,
    onFractionChange: null,
    onPulsesChange: null
  }
}) {
  const cfg = randomConfig || defaults;
  const randomRanges = {};

  // 1. Preparar rangos
  if (cfg.Lg?.enabled) {
    randomRanges.Lg = { min: cfg.Lg.range[0], max: cfg.Lg.range[1] };
  }
  if (cfg.V?.enabled) {
    randomRanges.V = { min: cfg.V.range[0], max: cfg.V.range[1] };
  }
  if (cfg.n?.enabled) {
    let [min, max] = cfg.n.range;
    if (!cfg.allowComplex) {
      min = 1;
      max = 1;
    }
    randomRanges.n = { min, max };
  }
  if (cfg.d?.enabled) {
    randomRanges.d = { min: cfg.d.range[0], max: cfg.d.range[1] };
  }

  // 2. Randomizar valores
  const randomized = randomizeValues(randomRanges);

  // 3. Aplicar Lg
  if (cfg.Lg?.enabled && inputs.inputLg) {
    const value = Math.max(randomRanges.Lg.min, Math.min(randomRanges.Lg.max, randomized.Lg));
    inputs.inputLg.value = value;
    callbacks.onLgChange?.({ value });
  }

  // 4. Aplicar V
  if (cfg.V?.enabled && inputs.inputV) {
    const value = Math.max(randomRanges.V.min, Math.min(randomRanges.V.max, randomized.V));
    inputs.inputV.value = value;
    callbacks.onVChange?.({ value });
  }

  // 5. Aplicar n/d
  const fractionUpdates = {};
  if (cfg.n?.enabled) {
    fractionUpdates.numerator = Math.max(1, randomized.n);
  }
  if (cfg.d?.enabled) {
    fractionUpdates.denominator = Math.max(1, randomized.d);
  }
  if (fractionEditor && Object.keys(fractionUpdates).length > 0) {
    fractionEditor.setFraction(fractionUpdates, { cause: 'randomize' });
    callbacks.onFractionChange?.(fractionUpdates);
  }

  // 6. Randomizar pulsos (si habilitado)
  if (cfg.Pulses?.enabled) {
    const lg = parseInt(inputs.inputLg.value);
    if (Number.isFinite(lg) && lg > 0) {
      const { numerator, denominator } = fractionEditor.getFraction();

      // Filtrar pulsos seleccionables
      const available = [];
      for (let i = 1; i < lg; i++) {
        if (isIntegerPulseSelectable(i, numerator, denominator, lg)) {
          available.push(i);
        }
      }

      // Seleccionar aleatoriamente
      const count = parseRandomCount(randomCount);
      const selected = selectRandomPulses(available, count);

      // Aplicar a memoria
      pulseMemoryApi.ensure(lg);
      for (let i = 1; i < lg; i++) pulseMemoryApi.data[i] = false;
      selected.forEach(i => { pulseMemoryApi.data[i] = true; });

      callbacks.onPulsesChange?.({ selected });

      // Randomizar fracciones también
      randomizeFractionSelection(fractionStore, {
        lg,
        count,
        nearestPulseIndex
      });
    }
  }
}

function parseRandomCount(randomCountInput) {
  const raw = randomCountInput?.value?.trim() || '';
  if (raw === '') return { type: 'density', value: 0.5 };
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return { type: 'density', value: 0.5 };
  return { type: 'count', value: parsed };
}

function selectRandomPulses(available, count) {
  if (count.type === 'density') {
    return available.filter(() => Math.random() < count.value);
  }
  const target = Math.min(count.value, available.length);
  const selected = new Set();
  while (selected.size < target) {
    const idx = available[Math.floor(Math.random() * available.length)];
    selected.add(idx);
  }
  return Array.from(selected).sort((a, b) => a - b);
}

function randomizeFractionSelection(fractionStore, { lg, count, nearestPulseIndex }) {
  // Lógica de applyRandomFractionSelection (de fraction-selection.js)
}
```

**Archivos afectados**:
- `main.js`: Usar `randomizeFractional()` en lugar de `randomize()`
- `fraction-selection.js`: Mover `applyRandomFractionSelection` a módulo común

---

### 📦 **FASE 7: Fórmulas y Title Info Tip**

#### 7.1 `libs/app-common/formula-display.js` ✅ NUEVO
**Líneas a extraer**: ~120

**Responsabilidad**: Generación de fórmulas matemáticas en HTML.

```javascript
/**
 * Crea generador de contenido de fórmulas
 */
export function createFormulaBuilder({
  getLg,
  getV,
  getT,
  getFraction, // {numerator, denominator}
  formatters = {
    integer: (n) => String(Math.round(n)),
    number: (n) => String(Math.round(n * 100) / 100),
    bpm: (n) => String(Math.round(n * 10) / 10) + ' BPM',
    sec: (n) => String(Math.round(n * 10) / 10) + ' s'
  }
}) {

  /**
   * Construye fragmento HTML con fórmulas
   */
  function buildFormulaFragment() {
    const fragment = document.createDocumentFragment();
    const lg = getLg();
    const v = getV();
    const t = getT();
    const { numerator, denominator } = getFraction();

    // 1. Pulsos enteros
    if (Number.isFinite(lg) && lg > 0) {
      appendLine(fragment, {
        label: 'Pulsos enteros (Lg):',
        value: formatters.integer(lg)
      });

      // Pulsos fraccionados
      if (numerator && denominator) {
        const fractionalLg = (lg * denominator) / numerator;
        appendLine(fragment, {
          label: 'Pulsos fraccionados (Lg·d/n):',
          value: formatters.number(fractionalLg)
        });
      }
    } else {
      appendHint(fragment, 'Define una Lg válida para contar los Pfr.');
    }

    // 2. Tempo base
    const derivedT = (lg && v) ? (lg * 60) / v : null;
    const tempoFromT = (lg && t) ? (lg / t) * 60 : null;
    const effectiveTempo = v ?? tempoFromT;
    const tForFormula = t ?? derivedT;

    if (lg && tForFormula && effectiveTempo) {
      appendFormula(fragment, {
        label: 'V base',
        formula: `(${formatters.integer(lg)} / ${formatters.number(tForFormula)})·60`,
        result: formatters.bpm(effectiveTempo)
      });
    } else if (effectiveTempo) {
      appendLine(fragment, {
        label: 'V base:',
        value: formatters.bpm(effectiveTempo)
      });
    } else if (lg && !v) {
      appendHint(fragment, 'Completa V para calcular la fórmula de V base.');
    }

    // 3. Tempo de fracción
    if (effectiveTempo && numerator && denominator) {
      const fractionTempo = effectiveTempo * (denominator / numerator);
      appendFormula(fragment, {
        label: `V ${numerator}/${denominator}`,
        formula: `(${formatters.bpm(effectiveTempo)}·${denominator})/${numerator}`,
        result: formatters.bpm(fractionTempo)
      });
    } else {
      appendHint(fragment, 'Completa V, n y d para obtener la velocidad de la fracción.');
    }

    // 4. Duración T
    if (lg && v && derivedT) {
      appendFormula(fragment, {
        label: 'T',
        formula: `(${formatters.integer(lg)} / ${formatters.bpm(v)})·60`,
        result: formatters.sec(derivedT)
      });
    } else if (t) {
      appendLine(fragment, {
        label: 'T:',
        value: formatters.sec(t)
      });
    }

    return fragment;
  }

  function appendLine(fragment, { label, value }) {
    const p = document.createElement('p');
    p.className = 'top-bar-info-tip__line';
    const strong = document.createElement('strong');
    strong.textContent = label;
    p.append(strong, ' ', value);
    fragment.append(p);
  }

  function appendFormula(fragment, { label, formula, result }) {
    const p = document.createElement('p');
    p.className = 'top-bar-info-tip__line';
    const strong = document.createElement('strong');
    strong.textContent = label;
    p.append(strong, ` = ${formula} = ${result}`);
    fragment.append(p);
  }

  function appendHint(fragment, text) {
    const p = document.createElement('p');
    p.className = 'top-bar-info-tip__hint';
    p.textContent = text;
    fragment.append(p);
  }

  return { buildFormulaFragment };
}
```

#### 7.2 `libs/app-common/info-tooltip.js` ✅ NUEVO
**Líneas a extraer**: ~80

**Responsabilidad**: Tooltip flotante con información contextual.

```javascript
/**
 * Crea gestor de tooltip flotante
 */
export function createInfoTooltip({
  className = 'top-bar-info-tip',
  offset = { x: 0, y: 8 }
}) {
  let tipEl = null;

  function show(contentFragment, anchorElement) {
    hide();

    tipEl = document.createElement('div');
    tipEl.className = className;
    tipEl.tabIndex = -1;

    // Aplicar tema
    applyTheme(tipEl);

    // Añadir contenido
    tipEl.appendChild(contentFragment);

    // Posicionar
    document.body.appendChild(tipEl);
    positionRelativeTo(tipEl, anchorElement);

    // Auto-hide en scroll/resize
    window.addEventListener('scroll', hide, { passive: true, once: true });
    window.addEventListener('resize', hide, { once: true });
  }

  function hide() {
    if (tipEl) {
      tipEl.remove();
      tipEl = null;
    }
  }

  function positionRelativeTo(tip, anchor) {
    const anchorRect = anchor.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();

    let left = anchorRect.left + anchorRect.width / 2 - tipRect.width / 2 + offset.x;
    let top = anchorRect.bottom + offset.y;

    // Ajustar si sale del viewport
    const margin = 12;
    if (left < margin) left = margin;
    if (left + tipRect.width > window.innerWidth - margin) {
      left = window.innerWidth - tipRect.width - margin;
    }

    tip.style.position = 'fixed';
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tip.style.zIndex = '1000';
  }

  function applyTheme(panel) {
    const theme = document.body?.dataset?.theme === 'dark' ? 'dark' : 'light';
    const rootStyles = getComputedStyle(document.documentElement);
    const textVar = theme === 'dark' ? '--text-dark' : '--text-light';
    const fallbackText = rootStyles.getPropertyValue(textVar)?.trim() || (theme === 'dark' ? '#EEE8D8' : '#43433B');

    panel.style.backgroundColor = theme === 'dark' ? 'rgba(40, 40, 40, 0.92)' : 'rgba(255, 255, 255, 0.9)';
    panel.style.color = fallbackText;
    panel.style.borderColor = theme === 'dark' ? 'rgba(238, 232, 216, 0.2)' : 'rgba(0, 0, 0, 0.08)';
    panel.style.boxShadow = theme === 'dark'
      ? '0 18px 36px rgba(0, 0, 0, 0.6)'
      : '0 12px 28px rgba(0, 0, 0, 0.25)';
    panel.style.backdropFilter = 'blur(8px)';
  }

  return { show, hide };
}
```

**Archivos afectados**:
- `main.js`: Usar módulos en lugar de `buildTitleInfoContent`, `showTitleInfoTip`, `hideTitleInfoTip`

---

### 📦 **FASE 8: T Indicator**

#### 8.1 `libs/app-common/t-indicator.js` ✅ NUEVO
**Líneas a extraer**: ~60

**Responsabilidad**: Indicador flotante de duración T.

```javascript
/**
 * Crea indicador flotante de T
 */
export function createTIndicator({
  timeline,
  getLg,
  isCircular, // función que devuelve si timeline es circular
  offset = { below: 15, circularShift: -16 }
}) {
  const el = document.createElement('div');
  el.className = 't-indicator';
  el.style.position = 'absolute';
  el.style.visibility = 'hidden';

  function updateText(value) {
    if (value === '' || value == null) {
      el.textContent = '';
      return;
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
      el.textContent = String(value);
      return;
    }
    const rounded = Math.round(n * 10) / 10;
    el.textContent = String(rounded);
  }

  function updatePosition() {
    if (!timeline) return false;

    const lg = getLg();
    if (!Number.isFinite(lg) || lg <= 0) return false;

    // Anclar al elemento Lg
    let anchor = timeline.querySelector(`.pulse-number[data-index="${lg}"]`);
    if (!anchor) anchor = timeline.querySelector('.pulse.lg');
    if (!anchor) return false;

    const tlRect = timeline.getBoundingClientRect();
    const aRect = anchor.getBoundingClientRect();
    const circular = isCircular();
    const isLabel = anchor.classList.contains('pulse-number');

    const offsetX = circular && isLabel ? offset.circularShift : 0;
    const centerX = aRect.left + aRect.width / 2 - tlRect.left + offsetX;
    const topY = aRect.bottom - tlRect.top + offset.below;

    el.style.left = `${centerX}px`;
    el.style.top = `${topY}px`;
    el.style.transform = 'translate(-50%, 0)';

    if (el.parentNode !== timeline) timeline.appendChild(el);
    return true;
  }

  function scheduleReveal(delay = 0) {
    const ms = Math.max(0, Number(delay) || 0);

    el.style.visibility = 'hidden';

    const reveal = () => {
      requestAnimationFrame(() => {
        const anchored = updatePosition();
        el.style.visibility = anchored && el.textContent ? 'visible' : 'hidden';
      });
    };

    if (ms === 0) {
      reveal();
    } else {
      setTimeout(reveal, ms);
    }
  }

  return {
    element: el,
    updateText,
    updatePosition,
    scheduleReveal
  };
}
```

**Archivos afectados**:
- `main.js`: Usar en lugar de lógica inline de tIndicator

---

### 📦 **FASE 9: Notación Musical Abstracta**

#### 9.1 `libs/app-common/notation-state-builder.js` ✅ NUEVO
**Líneas a extraer**: ~90

**Responsabilidad**: Construcción de estado para renderizado de notación.

```javascript
/**
 * Construye estado de renderizado de notación para apps rítmicas
 */
export function buildRhythmNotationState({
  getLg,
  getFraction,
  pulseMemory,
  fractionStore,
  inferNotationDenominator // función opcional para calcular denominador de notación
}) {
  const lgValue = getLg();
  if (!Number.isFinite(lgValue) || lgValue <= 0) {
    return null;
  }

  // 1. Selección base (pulsos enteros)
  const baseSelected = new Set();
  const maxIdx = Math.min(pulseMemory.length - 1, lgValue - 1);
  for (let i = 1; i <= maxIdx; i++) {
    if (pulseMemory[i]) baseSelected.add(i);
  }

  // 2. Fracción activa
  const fractionInfo = getFraction();
  const fraction = (Number.isFinite(fractionInfo?.numerator) && Number.isFinite(fractionInfo?.denominator))
    ? { numerator: fractionInfo.numerator, denominator: fractionInfo.denominator }
    : null;

  const fractionNotation = fraction
    ? resolveFractionNotation(fraction.numerator, fraction.denominator)
    : null;

  const normalizedFraction = fraction
    ? { ...fraction, notation: fractionNotation }
    : null;

  // 3. Denominador de notación
  const denominatorValue = inferNotationDenominator
    ? inferNotationDenominator(lgValue, fraction)
    : (fraction?.denominator ?? Math.max(2, Math.round(lgValue)));

  // 4. Duración y dots base
  let baseDuration = fractionNotation?.duration
    ?? durationValueFromDenominator(denominatorValue);
  let baseDots = Number.isFinite(fractionNotation?.dots)
    ? Math.max(0, Math.floor(fractionNotation.dots))
    : 0;

  // Caso especial: n === d → negra sin dots
  if (fraction?.numerator === fraction?.denominator) {
    baseDuration = 'q';
    baseDots = 0;
  }

  // 5. Eventos fraccionarios
  const selectedValues = new Set([0]);
  baseSelected.forEach(v => selectedValues.add(v));

  const fractionSelections = Array.isArray(fractionStore.pulseSelections)
    ? fractionStore.pulseSelections
    : [];

  const fractionalEvents = [];
  fractionSelections.forEach((item) => {
    if (!item?.key) return;
    const value = Number(item.value);
    if (!Number.isFinite(value) || value <= 0 || value >= lgValue) return;

    const itemDenominator = Number.isFinite(item.denominator) && item.denominator > 0
      ? Math.round(item.denominator)
      : denominatorValue;

    const notationInfo = resolveFractionNotation(item.numerator, itemDenominator);

    fractionalEvents.push({
      pulseIndex: value,
      duration: notationInfo.duration,
      rest: false,
      selectionKey: item.key,
      source: 'fraction',
      dots: notationInfo.dots || 0
    });

    selectedValues.add(value);
  });

  // 6. Construir eventos completos
  const events = buildPulseEvents({
    lg: lgValue,
    selectedSet: baseSelected,
    duration: baseDuration,
    dots: baseDots,
    fractionalSelections: fractionalEvents
  });

  events.sort((a, b) => a.pulseIndex - b.pulseIndex);

  const positions = events.map(e => e.pulseIndex);
  const selectedIndices = Array.from(selectedValues).sort((a, b) => a - b);

  return {
    lg: lgValue,
    fraction: normalizedFraction,
    events,
    positions,
    selectedIndices
  };
}
```

#### 9.2 `libs/app-common/notation-click-handler.js` ✅ NUEVO
**Líneas a extraer**: ~40

**Responsabilidad**: Manejo de clicks en elementos de notación.

```javascript
/**
 * Crea manejador de clicks en notación
 */
export function createNotationClickHandler({
  notationPanel,
  getLg,
  fractionStore,
  pulseMemory,
  onPulseToggle, // callback(pulseIndex, shouldSelect)
  onFractionToggle, // callback(fractionKey, shouldSelect)
  onInvalidClick // callback()
}) {

  function handleClick(event) {
    if (!notationPanel.isOpen) return;

    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const noteEl = target.closest('[data-pulse-index]');
    if (!noteEl) return;
    if (noteEl.dataset.nonSelectable === 'true') return;

    const pulseValue = Number.parseFloat(noteEl.dataset.pulseIndex);
    if (!Number.isFinite(pulseValue)) return;

    const lgValue = getLg();
    if (!Number.isFinite(lgValue) || lgValue <= 0) return;
    if (pulseValue <= 0 || pulseValue >= lgValue) return;

    // Click en fracción
    const selectionKey = noteEl.dataset.selectionKey;
    if (selectionKey) {
      const info = fractionStore.selectionState.get(selectionKey);
      if (info) {
        const currentlySelected = fractionStore.selectionState.has(selectionKey);
        onFractionToggle?.(info, !currentlySelected);
        return;
      }
    }

    // Click en pulso entero
    if (Number.isInteger(pulseValue)) {
      if (pulseMemory[pulseValue] != null) {
        const shouldSelect = !pulseMemory[pulseValue];
        onPulseToggle?.(pulseValue, shouldSelect);
      }
      return;
    }

    // Click inválido
    onInvalidClick?.();
  }

  return { handleClick };
}
```

**Archivos afectados**:
- `main.js`: Usar módulos en lugar de `buildNotationRenderState`, `handleNotationClick`

---

### 📦 **FASE 10: Centralización de Estado Global**

#### 10.1 `libs/app-common/app-state.js` ✅ NUEVO
**Líneas a extraer**: 0 (nuevo patrón)

**Responsabilidad**: Estado centralizado reactivo.

```javascript
/**
 * Crea objeto de estado centralizado para apps rítmicas
 */
export function createAppState(initialState = {}) {
  const state = {
    // Reproducción
    audio: null,
    isPlaying: false,
    loopEnabled: false,
    isUpdating: false,

    // Timeline
    circularMode: false,
    pulses: [],
    pulseNumberLabels: [],
    cycleMarkers: [],
    cycleLabels: [],
    bars: [],
    pulseHits: [],
    cycleMarkerHits: [],

    // Highlighting
    highlighting: {
      pulse: {
        lastCache: {
          type: null,
          index: null,
          fractionKey: null,
          trailingIndex: null,
          rect: null,
          scrollLeft: null
        },
        lastState: {
          type: null,
          index: null,
          fractionKey: null,
          trailingIndex: null
        }
      },
      fraction: {
        lastNodes: {
          key: null,
          marker: null,
          hit: null
        }
      },
      cycle: {
        lastState: {
          cycleIndex: null,
          subdivisionIndex: null,
          activeMarkers: []
        }
      }
    },

    // Fracción
    fraction: {
      memory: new Map(),
      store: null, // asignado externamente
      lastGap: { base: null, next: null, index: null },
      lastStructureSignature: {
        lg: null,
        numerator: null,
        denominator: null
      }
    },

    // Visual sync
    visual: {
      syncHandle: null,
      lastVisualStep: null,
      lastNormalizedStep: null,
      currentResolution: 1
    },

    // Notación
    notation: {
      renderer: null,
      panelController: null
    },

    // T indicator
    tIndicator: {
      element: null,
      revealHandle: null
    },

    ...initialState
  };

  // Opcional: Getters/setters reactivos con Proxy
  return state;
}
```

**Archivos afectados**:
- `main.js`: Migrar variables `let` dispersas a `state.*`

---

## Estrategia de Implementación

### Orden de Ejecución (Por Fases)

#### **FASE 1** (1-2 días) - Fundamentos
1. Crear `pulse-seq-parser.js` con funciones puras
2. Crear `pulse-seq-state.js`
3. Testear parseo y validación independientemente

#### **FASE 2** (2-3 días) - Editor
4. Crear `pulse-seq-editor.js`
5. Refactorizar eventos de teclado en main.js
6. Testear navegación y edición

#### **FASE 3** (1-2 días) - Simplificar sanitizePulseSeq
7. Reescribir `sanitizePulseSeq` usando módulos FASE 1 + 2
8. Testear exhaustivamente con casos edge (fracciones, ciclos, errores)

#### **FASE 4** (3-4 días) - Highlighting (crítico)
9. Crear `highlight-controller.js`
10. Crear `visual-sync.js`
11. Migrar lógica de highlighting
12. Testear con reproducción de audio en diferentes modos (circular/lineal, loop on/off)

#### **FASE 5** (2-3 días) - Timeline
13. Ampliar `timeline-layout.js` o crear `timeline-renderer.js`
14. Migrar `renderTimeline()` completo
15. Testear renderizado con diferentes valores de Lg, n, d

#### **FASE 6** (1-2 días) - Randomización
16. Ampliar `random-config.js`
17. Crear `random-fractional.js`
18. Migrar `randomize()` de App4
19. Testear randomización con fracciones

#### **FASE 7** (1 día) - Fórmulas
20. Crear `formula-display.js`
21. Crear `info-tooltip.js`
22. Migrar `buildTitleInfoContent` y tooltips

#### **FASE 8** (1 día) - T Indicator
23. Crear `t-indicator.js`
24. Migrar lógica de posicionamiento

#### **FASE 9** (1-2 días) - Notación
25. Crear `notation-state-builder.js`
26. Crear `notation-click-handler.js`
27. Migrar funciones de notación

#### **FASE 10** (2-3 días) - Estado Global
28. Crear `app-state.js`
29. Migrar variables globales gradualmente
30. Refactorizar accesos a estado

---

## Reducción de Líneas Estimada

| Módulo | Líneas Extraídas | Archivo Destino |
|--------|-----------------|-----------------|
| pulse-seq-parser.js | ~200 | libs/app-common/ |
| pulse-seq-state.js | ~150 | libs/app-common/ |
| pulse-seq-editor.js | ~180 | libs/app-common/ |
| highlight-controller.js | ~280 | libs/app-common/ |
| visual-sync.js | ~60 | libs/app-common/ |
| timeline-renderer.js | ~350 | libs/app-common/ |
| random-fractional.js | ~120 | libs/app-common/ |
| formula-display.js | ~120 | libs/app-common/ |
| info-tooltip.js | ~80 | libs/app-common/ |
| t-indicator.js | ~60 | libs/app-common/ |
| notation-state-builder.js | ~90 | libs/app-common/ |
| notation-click-handler.js | ~40 | libs/app-common/ |
| **TOTAL** | **~1730** | |

**Líneas adicionales eliminadas por simplificación**: ~970
- `sanitizePulseSeq`: 330 → 80 (ahorro: 250)
- Variables globales consolidadas: ~150
- Duplicación de lógica: ~300
- Imports y boilerplate optimizado: ~270

**Reducción total**: ~2700 líneas
**main.js final**: ~1500 líneas (de 4225)

---

## Validación y Testing

### Tests Unitarios a Crear
1. **pulse-seq-parser.test.js**: Validación de tokens
2. **pulse-seq-state.test.js**: Gestión de estado
3. **pulse-seq-editor.test.js**: Navegación por gaps
4. **highlight-controller.test.js**: Lógica de highlighting
5. **timeline-renderer.test.js**: Renderizado de elementos
6. **random-fractional.test.js**: Randomización

### Tests de Integración
1. Ciclo completo: editar pulseSeq → renderTimeline → reproducir → highlight
2. Cambio de Lg con fracciones activas
3. Cambio de n/d con pulsos seleccionados
4. Randomización completa con todas las opciones

### Tests Manuales
1. Reproducción con loop en modo circular
2. Notación con clicks en pulsos y fracciones
3. Tooltip de fórmulas con diferentes valores
4. T indicator en diferentes posiciones

---

## Riesgos y Mitigaciones

### Riesgos Alto
1. **Highlighting roto**: Testear exhaustivamente FASE 4
   - Mitigación: Crear suite de tests automatizados con casos edge

2. **Timeline no renderiza fracciones**: Validar FASE 5 con diferentes grids
   - Mitigación: Comparar visual con versión original (screenshots)

3. **Estado global inconsistente**: FASE 10 puede romper flujos
   - Mitigación: Migrar gradualmente, mantener compatibilidad temporal

### Riesgos Medio
4. **Editor de pulseSeq con bugs**: Navegación por gaps delicada
   - Mitigación: Tests interactivos con diferentes secuencias

5. **Randomización no respeta fracciones**: Lógica compleja
   - Mitigación: Tests con snapshots de estados

### Riesgos Bajo
6. **Tooltips mal posicionados**: Fácil de detectar
7. **T indicator escondido**: Visual, fácil de corregir

---

## Próximos Pasos

### Iteración 1 (Fases 1-3)
- Crear módulos de parseo y editor
- Simplificar `sanitizePulseSeq`
- Validar con tests unitarios

### Iteración 2 (Fases 4-5)
- Sistema de highlighting
- Timeline renderer
- Tests de integración de reproducción

### Iteración 3 (Fases 6-9)
- Randomización
- Fórmulas y tooltips
- Notación abstracta

### Iteración 4 (Fase 10)
- Estado centralizado
- Refactorización final
- Optimización de imports

---

## Notas Finales

- **Prioridad**: Mantener funcionalidad idéntica a la original
- **Compatibilidad**: Los módulos deben funcionar en Apps futuras (App5, App6...)
- **Documentación**: Cada módulo debe tener JSDoc completo
- **Performance**: No degradar el rendering ni la sincronización de audio

**Archivo de seguimiento**: Este documento se actualizará al final de cada fase para reflejar el progreso real y ajustar el plan de las fases siguientes.

---

*Plan generado: 2025-10-07*
*Última actualización: [Pendiente]*

## 📋 Progreso de Implementación

### ✅ FASE 1 COMPLETADA (2025-10-07)
- [x] Creado pulse-seq-parser.js (520 líneas)
- [x] Creado pulse-seq-state.js (175 líneas)
- [x] Tests: 17 tests pasando ✓
- [x] Integrado en main.js:sanitizePulseSeq
- [x] Resueltos errores de inicialización y duplicación
- [x] Corregido mensaje hover de validación fraccionaria

**Reducción lograda**: main.js de 4225 → 4032 líneas (~193 líneas)

**Estado**: ✅ FASE 1 VALIDADA - Módulos funcionan correctamente en producción

---

### ✅ FASE 2 COMPLETADA (2025-10-07)
- [x] Creado pulse-seq-editor.js (499 líneas)
- [x] Navegación por gaps con ArrowLeft/Right/Home/End
- [x] Backspace/Delete inteligente (borra tokens completos)
- [x] Normalización automática de espacios
- [x] Handlers: focus, blur, mouseup, keydown
- [x] Integrado en main.js (líneas 1879-1894)
- [x] Event listeners antiguos comentados (líneas 1897-2034)
- [x] Funciones wrapper adaptadas

**Reducción lograda**: main.js de 4032 → 3882 líneas (~150 líneas)

**Estado**: ✅ FASE 2 VALIDADA - Editor funciona correctamente

---

### ✅ FASE 4 COMPLETADA (2025-10-07)
- [x] Creado highlight-controller.js (517 líneas)
- [x] Creado visual-sync.js (137 líneas)
- [x] Sistema de highlighting para pulsos enteros y fracciones
- [x] Scroll automático en pulseSeq
- [x] Sincronización con audio via requestAnimationFrame
- [x] Force reflow para animaciones CSS de fracciones
- [x] Gestión de resolución de audio (callback a main.js)
- [x] Highlighting de ciclos
- [x] Integrado en main.js (líneas 2770-2793, funciones delegadas)

**Reducción lograda**: main.js de 4032 → 3573 líneas (~459 líneas adicionales)

**Módulos FASE 4**:
- `highlight-controller.js`: highlightIntegerPulse, highlightFraction, highlightPulse, highlightCycle
- `visual-sync.js`: Loop RAF, syncVisualState, control de resolución

**Bug Crítico Resuelto (2025-10-07)**:
- **Problema**: Cursor de notación no visible durante playback en App4
- **Causa**: `visual-sync.js` esperaba `getNotationRenderer` como función, pero App4 pasaba objeto directo
- **Solución**: Apps/App4/main.js:2788 - Cambio de `notationRenderer` a `getNotationRenderer: () => notationRenderer`
- **Validación**: Cursor ahora se sincroniza correctamente con audio, moviéndose por la partitura durante reproducción

**Estado**: ✅ FASE 4 VALIDADA - Highlighting y cursor funcionan correctamente

---

### 🚧 FASE 5: renderTimeline() Modular (EN PREPARACIÓN)

**Objetivo**: Extraer `renderTimeline()` completo (~350 líneas) a módulo reutilizable.

**Estado actual de main.js**: 3574 líneas (reducción total: 651 líneas / 15.4% del objetivo)

#### Archivos a crear/modificar

##### 5.1 Ampliar `libs/app-common/timeline-renderer.js`
**Líneas a extraer**: ~350 (de main.js:2796-3254 aproximadamente)

**Responsabilidad**: Renderizado completo de timeline con soporte de fracciones, pulsos, ciclos y memoria.

**Funciones a modularizar**:
- `renderIntegerPulses()` - Renderizado de pulsos base (0 a lg)
- `renderFractionalSubdivisions()` - Subdivisions con gridFromOrigin
- `createPulseHit()` - Áreas de click para pulsos enteros
- `createCycleMarker()` - Marcadores de fracción con posicionamiento
- `createFractionHit()` - Áreas de click para fracciones
- `createFractionLabel()` - Labels de fracciones
- `manageFractionMemory()` - Suspender/restaurar fracciones según validez

**Interfaz del módulo**:
```javascript
export function createFractionalTimelineRenderer({
  timeline,                  // elemento DOM contenedor
  getLg,                     // función que devuelve Lg actual
  getFraction,               // función que devuelve {numerator, denominator}
  fractionStore,             // store con selectionState, hitMap, markerMap
  fractionMemory,            // Map con memoria de fracciones
  computeHitSizePx,          // función de cálculo de tamaño de hit
  computeNumberFontRem,      // función de cálculo de fuente de números
  computeSubdivisionFontRem, // función de cálculo de fuente de subdivisiones
  attachSelectionListeners,  // función para adjuntar eventos de selección
  constants = {
    FRACTION_POSITION_EPSILON,
    SUBDIVISION_HIDE_THRESHOLD,
    PULSE_NUMBER_HIDE_THRESHOLD
  }
}) {
  // Variables internas
  let pulses = [];
  let pulseHits = [];
  let cycleMarkers = [];
  let cycleMarkerHits = [];
  let cycleLabels = [];
  let bars = [];
  let pulseNumberLabels = [];

  function render() {
    // Lógica completa de renderTimeline()
    // ...
    return {
      pulses,
      pulseHits,
      cycleMarkers,
      cycleMarkerHits,
      cycleLabels,
      bars,
      pulseNumberLabels
    };
  }

  return {
    render,
    getPulses: () => pulses,
    getPulseHits: () => pulseHits,
    getCycleMarkers: () => cycleMarkers,
    getCycleMarkerHits: () => cycleMarkerHits,
    getCycleLabels: () => cycleLabels,
    getBars: () => bars,
    getPulseNumberLabels: () => pulseNumberLabels
  };
}
```

**Integración en main.js**:
```javascript
// Inicialización (una vez)
const timelineRenderer = createFractionalTimelineRenderer({
  timeline,
  getLg: () => parseInt(inputLg.value),
  getFraction: () => fractionEditorController.getFraction(),
  fractionStore,
  fractionMemory,
  computeHitSizePx,
  computeNumberFontRem,
  computeSubdivisionFontRem,
  attachSelectionListeners,
  constants: {
    FRACTION_POSITION_EPSILON,
    SUBDIVISION_HIDE_THRESHOLD,
    PULSE_NUMBER_HIDE_THRESHOLD
  }
});

// Uso (reemplazar renderTimeline())
function renderTimeline() {
  const result = timelineRenderer.render();

  // Actualizar referencias globales
  pulses = result.pulses;
  pulseHits = result.pulseHits;
  cycleMarkers = result.cycleMarkers;
  cycleMarkerHits = result.cycleMarkerHits;
  cycleLabels = result.cycleLabels;
  bars = result.bars;
  pulseNumberLabels = result.pulseNumberLabels;

  // Actualizar highlight controller
  initHighlightingControllers();
}
```

**Reducción esperada**: main.js → ~3220 líneas (~354 líneas extraídas)

**Tiempo estimado**: 2-3 días

**Riesgo**: MEDIO (muchos elementos interconectados, gestión de memoria de fracciones, posicionamiento preciso)

#### Tests requeridos
1. Renderizado con diferentes valores de Lg (pequeños: 4, medianos: 16, grandes: 64)
2. Subdivisiones fraccionarias con n/d variados (simples: 1/2, complejos: 3/5, 5/7)
3. Memoria de fracciones: suspender cuando Lg cambia, restaurar cuando vuelve a ser válido
4. Hit areas clickeables para pulsos y fracciones
5. Umbrales de ocultación de labels (SUBDIVISION_HIDE_THRESHOLD, PULSE_NUMBER_HIDE_THRESHOLD)
6. Modo circular vs lineal

#### Validación
- Comparar visual con versión original (screenshots)
- Verificar que clicks funcionan en pulsos y fracciones
- Confirmar que memoria de fracciones persiste correctamente
- Testear con highlighting activo durante reproducción

**Estado**: 🚧 PENDIENTE - Listo para iniciar implementación

---

### ✅ FASE 5 COMPLETADA (2025-10-07)
- [x] Creado timeline-renderer.js (640 líneas)
- [x] Extraídas 8 funciones principales de renderTimeline()
- [x] Integrado en main.js con initTimelineRenderer()
- [x] Gestión de memoria de fracciones (suspender/restaurar)
- [x] API limpia con getters para todos los arrays

**Reducción lograda**: main.js de 3574 → 3308 líneas (**266 líneas**, 7.4%)

**Funciones Extraídas**:
- `renderIntegerPulses()` - Renderizado de pulsos base (0 a lg)
- `createPulseHit()` - Áreas de click para pulsos enteros
- `renderFractionalSubdivisions()` - Subdivisions con gridFromOrigin
- `createCycleMarker()` - Marcadores de fracción con posicionamiento
- `createFractionHit()` - Áreas de click para fracciones
- `createFractionLabel()` - Labels de fracciones
- `registerAllLabels()` - Registro de múltiples labels por fracción
- `manageFractionMemory()` - Suspender/restaurar fracciones según validez

**Integración en main.js**:
- Línea 30: Import de createFractionalTimelineRenderer
- Línea 160: Variable global `timelineRenderer`
- Líneas 2798-2823: Función `initTimelineRenderer()`
- Líneas 2825-2877: Función `renderTimeline()` refactorizada (de ~350 → 53 líneas)

**Archivos Modificados**:
- Creado: `libs/app-common/timeline-renderer.js`
- Modificado: `Apps/App4/main.js`
- Backups: `main.js.backup-fase5`, `main.js.bak2`

**Validación Completada** ✅:
- [x] Tests manuales con diferentes valores de Lg (2-10, 16-32, 64+) - ✅ Renderizado correcto
- [x] Fracciones simples y complejas (1/2, 3/5, 5/7) - ✅ Subdivisiones correctas
- [x] Memoria de fracciones (suspender/restaurar con cambios de Lg) - ✅ Funcionando perfectamente
- [x] Clicks en pulsos y fracciones - ✅ Selección interactiva correcta
- [x] Highlighting durante playback - ✅ Sincronización perfecta con cursor

**Progreso Acumulado**:
- **Inicio**: 4225 líneas
- **Actual**: 3308 líneas
- **Reducción total**: **917 líneas (21.7%)**
- **Meta final**: 1200-1500 líneas
- **Progreso**: **34% del objetivo total**

**Estado**: ✅ FASE 5 COMPLETADA Y VALIDADA - Todos los tests pasaron exitosamente

---

### 🚧 FASE 6: Randomización con Fracciones (EN PREPARACIÓN)

**Objetivo**: Extraer lógica de randomización con soporte de fracciones (~120 líneas) a módulo reutilizable.

**Estado actual de main.js**: 3308 líneas (reducción acumulada: 917 líneas / 21.7%)

#### Archivos a crear/modificar

##### 6.1 Ampliar `libs/app-common/random-config.js` (EXISTENTE)
**Líneas a añadir**: ~50

**Responsabilidad**: Extender configuración de randomización para soportar n/d y fracciones complejas.

**Funciones a ampliar**:
```javascript
/**
 * Aplica configuración de randomización incluyendo n, d
 */
export function applyFractionalRandomConfig(cfg, controls = {}) {
  // Código existente para Lg, V, T, Pulses...

  // Añadir soporte para n, d
  const { n, d, allowComplex } = controls;
  if (n) {
    if (cfg.n?.enabled != null) n.toggle.checked = cfg.n.enabled;
    if (cfg.n?.range) {
      n.min.value = cfg.n.range[0];
      n.max.value = cfg.n.range[1];
    }
  }
  if (d) {
    if (cfg.d?.enabled != null) d.toggle.checked = cfg.d.enabled;
    if (cfg.d?.range) {
      d.min.value = cfg.d.range[0];
      d.max.value = cfg.d.range[1];
    }
  }
  if (allowComplex && typeof cfg.allowComplex === 'boolean') {
    allowComplex.checked = cfg.allowComplex;
  }
}

/**
 * Actualiza configuración desde controles
 */
export function updateFractionalRandomConfig(randomConfig, controls = {}, defaults = {}) {
  // Código existente...

  // Añadir n, d
  const { n, d, allowComplex } = controls;
  if (n) {
    let [min, max] = cfg.n?.range ?? defaults.n?.range ?? [1, 1];
    if (!allowComplex?.checked) {
      min = 1;
      max = 1;
    }
    randomConfig.n = {
      enabled: n.toggle?.checked ?? true,
      range: resolveIntRange(n.min.value, n.max.value, [min, max])
    };
  }
  if (d) {
    randomConfig.d = {
      enabled: d.toggle?.checked ?? true,
      range: resolveIntRange(d.min.value, d.max.value, defaults.d?.range ?? [1, 8])
    };
  }
  if (allowComplex) {
    randomConfig.allowComplex = !!allowComplex.checked;
  }

  return randomConfig;
}
```

##### 6.2 Crear `libs/app-common/random-fractional.js` (NUEVO)
**Líneas a extraer**: ~130 (de main.js:1685-1806)

**Responsabilidad**: Randomización con soporte de fracciones, pulsos seleccionables y memoria.

**Interfaz del módulo**:
```javascript
/**
 * Randomiza parámetros con soporte de fracciones
 *
 * @param {object} config
 * @param {object} config.randomConfig - Configuración de randomización
 * @param {object} config.randomDefaults - Valores por defecto
 * @param {object} config.inputs - {inputLg, inputV, inputT}
 * @param {object} config.fractionEditor - Controller de fracción
 * @param {object} config.pulseMemoryApi - API de memoria de pulsos
 * @param {object} config.fractionStore - Store de fracciones
 * @param {HTMLElement} config.randomCount - Input de cantidad de pulsos
 * @param {Function} config.isIntegerPulseSelectable - Función de validación
 * @param {Function} config.nearestPulseIndex - Función de snap
 * @param {Function} config.applyRandomFractionSelection - Función de randomización de fracciones
 * @param {object} config.callbacks - Callbacks opcionales
 * @returns {object} - Resultado de randomización
 */
export function randomizeFractional({
  randomConfig,
  randomDefaults,
  inputs,
  fractionEditor,
  pulseMemoryApi,
  fractionStore,
  randomCount,
  isIntegerPulseSelectable,
  nearestPulseIndex,
  applyRandomFractionSelection,
  callbacks = {
    onLgChange: null,
    onVChange: null,
    onFractionChange: null,
    onPulsesChange: null,
    renderNotation: null
  }
}) {
  const cfg = randomConfig || randomDefaults;
  const randomRanges = {};

  // 1. Preparar rangos de randomización
  prepareRandomRanges(cfg, randomDefaults, randomRanges);

  // 2. Randomizar valores
  const randomized = randomizeValues(randomRanges);

  // 3. Aplicar Lg
  if (cfg.Lg?.enabled && inputs.inputLg) {
    const value = clampToRange(randomized.Lg, cfg.Lg.range, randomDefaults.Lg.range);
    setValue(inputs.inputLg, value);
    callbacks.onLgChange?.({ value, input: inputs.inputLg });
  }

  // 4. Aplicar V
  if (cfg.V?.enabled && inputs.inputV) {
    const value = clampToRange(randomized.V, cfg.V.range, randomDefaults.V.range);
    setValue(inputs.inputV, value);
    callbacks.onVChange?.({ value, input: inputs.inputV });
  }

  // 5. Aplicar n/d
  const fractionUpdates = buildFractionUpdates(cfg, randomized, randomDefaults);
  if (fractionEditor && Object.keys(fractionUpdates).length > 0) {
    fractionEditor.setFraction(fractionUpdates, { cause: 'randomize' });
    callbacks.onFractionChange?.(fractionUpdates);
  }

  // 6. Randomizar pulsos
  if (cfg.Pulses?.enabled) {
    randomizePulses({
      inputs,
      pulseMemoryApi,
      fractionStore,
      randomCount,
      isIntegerPulseSelectable,
      nearestPulseIndex,
      applyRandomFractionSelection,
      callbacks
    });
  }

  // 7. Renderizar notación si existe callback
  callbacks.renderNotation?.();

  return {
    randomized,
    applied: {
      lg: cfg.Lg?.enabled,
      v: cfg.V?.enabled,
      fraction: Object.keys(fractionUpdates).length > 0,
      pulses: cfg.Pulses?.enabled
    }
  };
}

/**
 * Helper: Prepara rangos de randomización
 */
function prepareRandomRanges(cfg, defaults, ranges) {
  if (cfg.Lg?.enabled) {
    const [lo, hi] = cfg.Lg.range ?? defaults.Lg.range;
    ranges.Lg = { min: lo, max: hi };
  }
  if (cfg.V?.enabled) {
    const [lo, hi] = cfg.V.range ?? defaults.V.range;
    ranges.V = { min: lo, max: hi };
  }
  if (cfg.n?.enabled) {
    let [min, max] = cfg.n.range ?? defaults.n.range;
    if (!cfg.allowComplex) {
      min = 1;
      max = 1;
    }
    ranges.n = { min, max };
  }
  if (cfg.d?.enabled) {
    const [min, max] = cfg.d.range ?? defaults.d.range;
    ranges.d = { min, max };
  }
}

/**
 * Helper: Construye objeto de actualizaciones de fracción
 */
function buildFractionUpdates(cfg, randomized, defaults) {
  const updates = {};

  if (cfg.n?.enabled) {
    const [min, max] = cfg.n.range ?? defaults.n.range;
    const bounded = cfg.allowComplex ? [min, max] : [1, 1];
    const randomValue = randomized.n ?? bounded[0];
    updates.numerator = Math.max(1, Math.min(bounded[1], randomValue));
  }

  if (cfg.d?.enabled) {
    const [min, max] = cfg.d.range ?? defaults.d.range;
    const randomValue = randomized.d ?? min;
    updates.denominator = Math.max(1, Math.min(max, randomValue));
  }

  return updates;
}

/**
 * Helper: Randomiza selección de pulsos
 */
function randomizePulses(opts) {
  const { inputs, pulseMemoryApi, fractionStore, randomCount,
          isIntegerPulseSelectable, nearestPulseIndex,
          applyRandomFractionSelection, callbacks } = opts;

  // Limpiar selección persistente
  pulseMemoryApi.clear();
  fractionStore.selectionState.clear();
  fractionStore.selectedFractionKeys.clear();

  const lg = parseInt(inputs.inputLg.value);
  if (isNaN(lg) || lg <= 0) return;

  pulseMemoryApi.ensure(lg);

  // Obtener pulsos seleccionables según fracción activa
  const fraction = opts.fractionEditor?.getFraction?.() ?? {};
  const available = [];
  for (let i = 1; i < lg; i++) {
    if (isIntegerPulseSelectable(i, fraction.numerator, fraction.denominator, lg)) {
      available.push(i);
    }
  }

  // Seleccionar aleatoriamente
  const rawCount = randomCount?.value?.trim() || '';
  const selected = selectRandomPulses(available, rawCount);

  // Aplicar a memoria
  for (let i = 1; i < lg; i++) pulseMemoryApi.data[i] = false;
  selected.forEach(i => { pulseMemoryApi.data[i] = true; });

  // Randomizar fracciones
  const applied = applyRandomFractionSelection(fractionStore, {
    lg,
    randomCountValue: rawCount,
    parseIntSafe: parseInt,
    nearestPulseIndex
  });

  callbacks.onPulsesChange?.({ selected, fractionsApplied: applied });
}

/**
 * Helper: Selecciona pulsos aleatorios según densidad o cantidad
 */
function selectRandomPulses(available, rawCount) {
  const selected = new Set();

  if (rawCount === '') {
    const density = 0.5;
    available.forEach(i => { if (Math.random() < density) selected.add(i); });
  } else {
    const parsed = Number.parseInt(rawCount, 10);
    if (Number.isNaN(parsed)) {
      const density = 0.5;
      available.forEach(i => { if (Math.random() < density) selected.add(i); });
    } else if (parsed > 0) {
      const target = Math.min(parsed, available.length);
      while (selected.size < target && available.length > 0) {
        const idx = available[Math.floor(Math.random() * available.length)];
        selected.add(idx);
      }
    }
  }

  return Array.from(selected).sort((a, b) => a - b);
}

/**
 * Helper: Clamp value to range
 */
function clampToRange(value, range, defaultRange) {
  const [lo, hi] = range ?? defaultRange;
  return Math.max(lo, Math.min(hi, value ?? lo));
}

/**
 * Helper: Set value to input element
 */
function setValue(input, value) {
  if (!input) return;
  input.value = String(value);
}
```

**Integración en main.js**:
```javascript
// Import
import { randomizeFractional } from '../../libs/app-common/random-fractional.js';

// Reemplazar función randomize()
function randomize() {
  randomizeFractional({
    randomConfig,
    randomDefaults,
    inputs: { inputLg, inputV, inputT },
    fractionEditor: fractionEditorController,
    pulseMemoryApi,
    fractionStore,
    randomCount,
    isIntegerPulseSelectable,
    nearestPulseIndex,
    applyRandomFractionSelection,
    callbacks: {
      onLgChange: ({ value, input }) => handleInput({ target: input }),
      onVChange: ({ value, input }) => handleInput({ target: input }),
      onFractionChange: (updates) => {
        // Fallback si no hay fractionEditor
        if (!fractionEditorController) {
          if (updates.numerator != null && numeratorInput) {
            setValue(numeratorInput, updates.numerator);
          }
          if (updates.denominator != null && denominatorInput) {
            setValue(denominatorInput, updates.denominator);
          }
          refreshFractionUI({ reveal: true });
          handleInput();
        }
      },
      onPulsesChange: ({ selected, fractionsApplied }) => {
        syncSelectedFromMemory();
        updatePulseNumbers();
        layoutTimeline({ silent: true });
        rebuildFractionSelections();
        if (fractionsApplied && isPlaying) {
          applySelectionToAudio();
        }
      },
      renderNotation: () => renderNotationIfVisible()
    }
  });
}
```

**Reducción esperada**: main.js → ~3190 líneas (~118 líneas extraídas)

**Tiempo estimado**: 1-2 días

**Riesgo**: MEDIO (lógica compleja de selección de pulsos según fracción activa)

#### Tests requeridos
1. Randomización con Lg/V habilitados
2. Randomización con n/d y allowComplex
3. Randomización de pulsos con fracción activa (verificar seleccionables)
4. Randomización de fracciones
5. Combinación de todos los parámetros
6. Edge cases: Lg=2, fracción compleja 5/7, densidad vs cantidad

#### Validación
- Verificar que pulsos randomizados respetan `isIntegerPulseSelectable`
- Confirmar que fracciones se randomizan correctamente
- Verificar que memoria de pulsos se limpia antes de randomizar
- Testear con allowComplex true/false

**Estado**: 🚧 PENDIENTE - Listo para iniciar implementación

