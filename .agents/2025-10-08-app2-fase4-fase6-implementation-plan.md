# Plan de Implementación: App2 FASES 4 y 6

**Fecha creación**: 2025-10-08
**Para sesión**: Nueva sesión (continuación)
**Prerequisito**: Tener FASES 1-3-5-7 completadas (59 líneas reducidas)
**Objetivo**: Completar refactoring App2 con las 2 fases restantes

---

## Resumen Ejecutivo

**Reducción adicional proyectada**: ~155 líneas
**Tiempo estimado**: 2.5 horas
**Nuevo módulo a crear**: `simple-notation-renderer.js`
**Riesgo**: Bajo (ambas fases evaluadas y documentadas)

---

## FASE 4: Timeline Layout Integration

### Objetivo
Reemplazar `animateTimelineCircle()` con `timeline-layout.js` module

### Archivos a modificar
- `Apps/App2/main.js` líneas 1381-1531 (~150 líneas)

### Paso 1: Añadir import (2 min)

```javascript
// En Apps/App2/main.js línea ~21
import { createTimelineRenderer } from '../../libs/app-common/timeline-layout.js';
```

### Paso 2: Crear timeline renderer (10 min)

**Ubicación**: Después de crear `pulseSeqController` (línea ~160)

```javascript
// Create timeline renderer for circular/linear layout
const timelineRenderer = createTimelineRenderer({
  timeline,
  timelineWrapper,
  getLg: () => pulses.length - 1,
  getPulses: () => pulses,
  getBars: () => Array.from(timeline.querySelectorAll('.bar')),
  computeNumberFontRem,
  pulseNumberHideThreshold: 100, // NUMBER_HIDE_THRESHOLD
  numberCircleOffset: 34,        // NUMBER_CIRCLE_OFFSET
  isCircularEnabled: () => loopEnabled && circularTimeline,
  scheduleIndicatorReveal: scheduleTIndicatorReveal,
  tIndicatorTransitionDelay: T_INDICATOR_TRANSITION_DELAY,
  callbacks: {
    onAfterCircularLayout: (ctx) => {
      // Position pulse hits in circular mode
      pulseHits.forEach((h, i) => {
        const angle = ctx.angleForIndex(i);
        const x = ctx.centerX + ctx.radius * Math.cos(angle);
        const y = ctx.centerY + ctx.radius * Math.sin(angle);
        h.style.left = `${x}px`;
        h.style.top = `${y}px`;
        h.style.transform = 'translate(-50%, -50%)';
      });
      // Call App2-specific hooks
      syncSelectedFromMemory();
      updateNumbers();
    },
    onAfterLinearLayout: (ctx) => {
      // Position pulse hits in linear mode
      const lg = ctx.lg;
      pulseHits.forEach((h, i) => {
        const percent = (i / lg) * 100;
        h.style.left = `${percent}%`;
        h.style.top = '50%';
        h.style.transform = 'translate(-50%, -50%)';
      });
      // Call App2-specific hooks
      syncSelectedFromMemory();
      updateNumbers();
    }
  }
});
```

### Paso 3: Reemplazar animateTimelineCircle() (15 min)

**Buscar y reemplazar** (línea 1381):

**ANTES**:
```javascript
function animateTimelineCircle(isCircular, opts = {}){
  const silent = !!opts.silent;
  const desiredCircular = !!isCircular;
  // ... 150 líneas de código ...
}
```

**DESPUÉS**:
```javascript
function animateTimelineCircle(isCircular, opts = {}) {
  const silent = !!opts.silent;
  timelineRenderer.applyLayout(isCircular, { silent });
}
```

### Paso 4: Verificar constantes (3 min)

Asegurar que estas constantes existen cerca de la línea 50:

```javascript
const NUMBER_HIDE_THRESHOLD = 100;
const NUMBER_CIRCLE_OFFSET = 34;
```

### Paso 5: Testing manual (10 min)

1. Cargar App2
2. Cambiar Lg varias veces
3. Activar/desactivar modo circular
4. Verificar que pulsos, hits, números se posicionan correctamente
5. Probar con Loop activado/desactivado

### Verificación

- [ ] Import añadido
- [ ] timelineRenderer creado con todos los callbacks
- [ ] animateTimelineCircle() reducido a 3 líneas
- [ ] Constantes definidas
- [ ] Tests manuales pasados
- [ ] Líneas reducidas: ~120

---

## FASE 6: Simple Notation Renderer

### Objetivo
Crear módulo `simple-notation-renderer.js` y usarlo en App2

### Parte A: Crear el módulo (45 min)

#### Paso 1: Crear archivo (5 min)

**Ubicación**: `/Users/workingburcet/Lab/libs/app-common/simple-notation-renderer.js`

**Contenido**:

```javascript
/**
 * simple-notation-renderer.js
 *
 * Simple notation renderer for apps without fractions
 * Renders integer pulse selections with fixed or dynamic denominator
 *
 * @module libs/app-common/simple-notation-renderer
 */

import { createRhythmStaff } from '../notation/rhythm-staff.js';
import { durationValueFromDenominator, buildPulseEvents } from './notation-utils.js';

/**
 * Creates a simple notation renderer for integer pulses
 *
 * @param {Object} config - Configuration options
 * @param {HTMLElement} config.notationContentEl - Container element for notation
 * @param {Object} config.notationPanelController - Panel controller with `isOpen` property
 * @param {Function} config.getLg - Returns current Lg value
 * @param {Function} config.getSelectedPulses - Returns array or Set of selected pulse indices
 * @param {Function} [config.inferDenominator] - Custom denominator inference function
 * @param {Object} [config.staffOptions] - Additional options for createRhythmStaff
 * @returns {Object} Renderer controller API
 *
 * @example
 * const notationRenderer = createSimpleNotationRenderer({
 *   notationContentEl: document.getElementById('notation'),
 *   notationPanelController: { isOpen: true },
 *   getLg: () => parseInt(inputLg.value, 10),
 *   getSelectedPulses: () => selectedPulsesArray,
 *   inferDenominator: (lg) => 4  // Fixed denominator
 * });
 *
 * notationRenderer.render();
 * notationRenderer.updateCursor(3, true);
 */
export function createSimpleNotationRenderer(config) {
  const {
    notationContentEl,
    notationPanelController,
    getLg,
    getSelectedPulses,
    inferDenominator = defaultInferDenominator,
    staffOptions = {}
  } = config;

  let renderer = null;

  /**
   * Default denominator inference: uses Lg rounded to nearest integer
   */
  function defaultInferDenominator(lg) {
    if (!Number.isFinite(lg) || lg <= 0) return 4;
    return Math.max(2, Math.round(lg));
  }

  /**
   * Builds render state from current app state
   * @returns {Object|null} Render state or null if invalid
   */
  function buildRenderState() {
    const lg = getLg();
    if (!Number.isFinite(lg) || lg <= 0) {
      return null;
    }

    const selected = getSelectedPulses();
    const selectedSet = new Set(Array.isArray(selected) ? selected : Array.from(selected));

    const denominator = inferDenominator(lg);
    const durationValue = durationValueFromDenominator(denominator);
    const events = buildPulseEvents({ lg, selectedSet, duration: durationValue });
    const positions = events.map(event => event.pulseIndex);
    const selectedIndices = Array.from(new Set([0, ...selectedSet])).sort((a, b) => a - b);

    return {
      lg,
      events,
      positions,
      selectedIndices
    };
  }

  /**
   * Renders notation if panel is visible
   * @param {Object} options - Render options
   * @param {boolean} [options.force=false] - Force render even if panel closed
   */
  function render(options = {}) {
    const { force = false } = options;

    if (!notationContentEl || !notationPanelController) {
      return;
    }

    if (!force && !notationPanelController.isOpen) {
      return;
    }

    // Create renderer on first use
    if (!renderer) {
      renderer = createRhythmStaff({
        container: notationContentEl,
        pulseFilter: 'whole',
        ...staffOptions
      });
    }

    const state = buildRenderState();

    if (!state) {
      // Render empty staff
      renderer.render({ lg: 0, rhythm: [] });
      return;
    }

    renderer.render({
      lg: state.lg,
      selectedIndices: state.selectedIndices,
      positions: state.positions,
      rhythm: state.events
    });
  }

  /**
   * Updates cursor position during playback
   * @param {number} index - Current pulse index
   * @param {boolean} isPlaying - Whether playback is active
   */
  function updateCursor(index, isPlaying) {
    if (renderer && typeof renderer.updateCursor === 'function') {
      renderer.updateCursor(index, isPlaying);
    }
  }

  /**
   * Resets cursor to initial state
   */
  function resetCursor() {
    if (renderer && typeof renderer.resetCursor === 'function') {
      renderer.resetCursor();
    }
  }

  /**
   * Returns the underlying VexFlow renderer
   * @returns {Object|null} VexFlow renderer instance
   */
  function getRenderer() {
    return renderer;
  }

  return {
    render,
    updateCursor,
    resetCursor,
    getRenderer
  };
}
```

#### Paso 2: Crear tests (20 min)

**Ubicación**: `/Users/workingburcet/Lab/libs/app-common/__tests__/simple-notation-renderer.test.js`

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSimpleNotationRenderer } from '../simple-notation-renderer.js';

describe('createSimpleNotationRenderer', () => {
  let mockContainer;
  let mockPanelController;
  let mockRhythmStaff;

  beforeEach(() => {
    mockContainer = document.createElement('div');
    mockPanelController = { isOpen: true };

    // Mock createRhythmStaff
    mockRhythmStaff = {
      render: vi.fn(),
      updateCursor: vi.fn(),
      resetCursor: vi.fn()
    };
  });

  it('creates renderer with valid config', () => {
    const renderer = createSimpleNotationRenderer({
      notationContentEl: mockContainer,
      notationPanelController: mockPanelController,
      getLg: () => 4,
      getSelectedPulses: () => [1, 2]
    });

    expect(renderer).toBeDefined();
    expect(renderer.render).toBeInstanceOf(Function);
    expect(renderer.updateCursor).toBeInstanceOf(Function);
    expect(renderer.resetCursor).toBeInstanceOf(Function);
  });

  it('does not render when panel is closed', () => {
    mockPanelController.isOpen = false;
    const renderer = createSimpleNotationRenderer({
      notationContentEl: mockContainer,
      notationPanelController: mockPanelController,
      getLg: () => 4,
      getSelectedPulses: () => [1, 2]
    });

    renderer.render();
    expect(renderer.getRenderer()).toBeNull();
  });

  it('uses custom inferDenominator', () => {
    const customInfer = vi.fn(() => 8);
    const renderer = createSimpleNotationRenderer({
      notationContentEl: mockContainer,
      notationPanelController: mockPanelController,
      getLg: () => 4,
      getSelectedPulses: () => [1],
      inferDenominator: customInfer
    });

    renderer.render({ force: true });
    expect(customInfer).toHaveBeenCalledWith(4);
  });
});
```

#### Paso 3: Documentar módulo (10 min)

Añadir a `/Users/workingburcet/Lab/libs/app-common/README.md`:

```markdown
## simple-notation-renderer.js

Simple notation renderer for apps using integer pulses without fractions.

### Features
- Integer pulse notation only
- Configurable or fixed denominator
- Cursor support for playback
- Panel visibility awareness

### Used by
- App2 (Ear Training)
- Future apps with simple notation needs

### API
See module documentation for `createSimpleNotationRenderer()`
```

#### Paso 4: Ejecutar tests (10 min)

```bash
npm test -- simple-notation-renderer.test.js
```

### Parte B: Integrar en App2 (30 min)

#### Paso 1: Añadir import (2 min)

**Ubicación**: `Apps/App2/main.js` línea ~21

```javascript
import { createSimpleNotationRenderer } from '../../libs/app-common/simple-notation-renderer.js';
```

#### Paso 2: Crear renderer (10 min)

**Buscar** la creación de variables de notación (línea ~98)

**Reemplazar**:
```javascript
let notationRenderer = null;
```

**Con**:
```javascript
const notationRenderer = createSimpleNotationRenderer({
  notationContentEl,
  notationPanelController,
  getLg: () => parseInt(inputLg.value, 10),
  getSelectedPulses: () => {
    const lg = parseInt(inputLg.value, 10);
    if (!Number.isFinite(lg) || lg <= 0) return [];

    ensurePulseMemory(lg);
    const selected = [];
    const maxIdx = Math.min(pulseMemory.length - 1, lg - 1);
    for (let i = 1; i <= maxIdx; i++) {
      if (pulseMemory[i]) selected.push(i);
    }
    return selected;
  },
  inferDenominator: (lg) => {
    // App2 always uses 4 (quarter notes)
    return 4;
  }
});
```

#### Paso 3: Eliminar funciones obsoletas (5 min)

**Eliminar** (líneas 106-156):
- `buildNotationRenderState()`
- `renderNotationIfVisible()`

#### Paso 4: Actualizar llamadas (8 min)

**Buscar y reemplazar** todas las llamadas:

1. `renderNotationIfVisible()` → `notationRenderer.render()`
2. `renderNotationIfVisible({ force: true })` → `notationRenderer.render({ force: true })`

**Ubicaciones típicas**:
- Después de cambios en inputLg
- Después de cambios en selección de pulsos
- En toggle de panel de notación

#### Paso 5: Testing manual (5 min)

1. Abrir panel de notación
2. Cambiar Lg
3. Seleccionar/deseleccionar pulsos
4. Verificar que la notación se actualiza
5. Probar cursor durante playback

### Verificación FASE 6

- [ ] Módulo creado con documentación completa
- [ ] Tests escritos y pasando
- [ ] Import añadido en App2
- [ ] Renderer creado con config correcta
- [ ] Funciones obsoletas eliminadas
- [ ] Llamadas actualizadas
- [ ] Tests manuales pasados
- [ ] Líneas reducidas: ~35

---

## Checklist Final

### Pre-implementación
- [ ] Git status clean (commits previos aplicados)
- [ ] App2 funcionando correctamente con FASES 1-3-5-7
- [ ] Leer este plan completo

### Durante implementación
- [ ] FASE 4: Timeline layout integrado
- [ ] FASE 4: Tests manuales pasados
- [ ] FASE 6: Módulo creado y testeado
- [ ] FASE 6: Integración en App2 completa
- [ ] FASE 6: Tests manuales pasados

### Post-implementación
- [ ] Contar líneas finales: `wc -l Apps/App2/main.js`
- [ ] Verificar reducción total: debería ser ~214 líneas (1898 → ~1684)
- [ ] Actualizar documentación con resultados reales
- [ ] Commit con mensaje descriptivo
- [ ] Actualizar plan con estado "COMPLETADO"

---

## Notas Importantes

1. **Orden de implementación**: Hacer FASE 4 primero, luego FASE 6
2. **Testing continuo**: Probar después de cada fase
3. **Commits separados**: Un commit por fase
4. **Documentación**: Actualizar summary después de completar

---

## Comandos Útiles

```bash
# Contar líneas
wc -l Apps/App2/main.js

# Ejecutar tests del nuevo módulo
npm test -- simple-notation-renderer.test.js

# Ver diff de cambios
git diff Apps/App2/main.js | head -100

# Commit FASE 4
git add Apps/App2/main.js
git commit -m "Refactor: App2 FASE 4 - Timeline layout integration"

# Commit FASE 6
git add Apps/App2/main.js libs/app-common/simple-notation-renderer.js libs/app-common/__tests__/simple-notation-renderer.test.js
git commit -m "Refactor: App2 FASE 6 - Simple notation renderer"
```

---

## Resultado Esperado

```
Estado final App2:
- Líneas: ~1684 (reducción 214, 11.3%)
- Módulos integrados: 7
- Nuevo módulo creado: simple-notation-renderer.js
- Todas las fases: 7/7 completadas
- Tests: Todos pasando
```
