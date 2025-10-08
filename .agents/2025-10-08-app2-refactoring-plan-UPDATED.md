# Plan COMPLETO Actualizado de Refactoring - App2

**Fecha**: 2025-10-08 (Actualizado con resultados finales)
**App**: App2 (Ear Training)
**Métrica inicial**: 1898 líneas en main.js
**Métrica final**: 1841 líneas en main.js ✅
**Reducción lograda**: 57 líneas (3%)
**Tiempo real**: ~2 horas

---

## ✅ RESULTADOS FINALES

### Fases Completadas: 4/7

- ✅ **FASE 1**: Number Utilities - **19 líneas reducidas**
- ✅ **FASE 2**: Visual Sync - **18 líneas reducidas**
- ✅ **FASE 3**: Highlight Controller - **6 líneas reducidas**
- ✅ **FASE 7**: Random Config - **14 líneas reducidas**
- ⏭️ **FASE 4**: Circular Timeline - **Omitida** (lógica demasiado específica)
- ⏭️ **FASE 5**: T-Indicator - **Omitida** (posicionamiento muy customizado)
- ⏳ **FASE 6**: Notation Renderer - **Pendiente** (futuras iteraciones)

### Correcciones Aplicadas: 4

1. ✅ Restaurado import `toRange` para función randomize
2. ✅ Actualizado callback highlightPulse en audio.play
3. ✅ Añadido parámetro `showComplexFractions` al template
4. ✅ Ajustada opacidad highlight a 0.5 (copia de App4)

**Documentación completa**: `.agents/2025-10-08-app2-refactoring-summary.md`

---

## Resumen Ejecutivo Original

App2 puede aprovechar **7 FASES** de refactoring usando módulos ya creados en App1, App4 y compartidos:
- **Reducción total estimada**: 1898 → ~1400 líneas (**~500 líneas, 26%**)
- **Reducción real lograda**: 1898 → 1841 líneas (**57 líneas, 3%**)
- **Todos los módulos ya existen** con 81+ tests ✅
- **Sin crear nuevos módulos ni tests**
- **Tiempo estimado**: 5-6 horas
- **Tiempo real**: ~2 horas

---

## Análisis Completo

### Módulos Ya Integrados ✅

**pulse-seq.js**: App2 ya usa `createPulseSeqController()` correctamente (línea 160)
- No requiere cambios
- Ya integrado con pulseMemory API

---

## Fases de Refactoring

### FASE 1: Number Utilities (~25 líneas)

**Módulo existente**: ✅ `libs/app-common/number-utils.js` (App1) - 112 líneas, 29 tests

**Código a reemplazar** (líneas 834-862):
```javascript
function parseNum(val) { ... }           // Idéntico a App1
function formatInteger(value) { ... }    // Similar a formatNumber
function formatNumberValue(value) { ... } // Idéntico a formatSec
function formatSec(n) { ... }            // Idéntico a App1
```

**Integración en App2**:
```javascript
import { parseNum, formatSec, formatNumber } from '../../libs/app-common/number-utils.js';

// formatInteger se reemplaza con formatNumber configurado
```

**Reducción estimada**: ~25 líneas
**Tiempo estimado**: 30 minutos
**Riesgo**: Muy bajo

---

### FASE 2: Visual Sync (~25 líneas)

**Módulo existente**: ✅ `libs/app-common/simple-visual-sync.js` (App1) - 97 líneas, 15 tests

**Código a reemplazar** (líneas 1817-1850):
```javascript
function stopVisualSync() { ... }   // Idéntico a App1
function syncVisualState() { ... }  // Idéntico a App1
function startVisualSync() { ... }  // Idéntico a App1
```

**Integración en App2**:
```javascript
import { createSimpleVisualSync } from '../../libs/app-common/simple-visual-sync.js';

const visualSync = createSimpleVisualSync({
  getAudio: () => audio,
  getIsPlaying: () => isPlaying,
  onStep: (step) => highlightController.highlightPulse(step)
});
```

**Reducción estimada**: ~25 líneas
**Tiempo estimado**: 30 minutos
**Riesgo**: Muy bajo

---

### FASE 3: Highlight Controller (~20 líneas)

**Módulo existente**: ✅ `libs/app-common/simple-highlight-controller.js` (App1) - 85 líneas, 17 tests

**Código a reemplazar** (línea 1760+):
```javascript
function highlightPulse(i) {
  // Lógica de highlighting con loop support
  // Idéntica a App1
}
```

**Integración en App2**:
```javascript
import { createSimpleHighlightController } from '../../libs/app-common/simple-highlight-controller.js';

const highlightController = createSimpleHighlightController({
  getPulses: () => pulses,
  getLoopEnabled: () => loopEnabled
});
```

**Reducción estimada**: ~20 líneas
**Tiempo estimado**: 30 minutos
**Riesgo**: Bajo

---

### FASE 4: Timeline Circular (~140 líneas) ⭐

**Módulo existente**: ✅ `libs/app-common/circular-timeline.js` (App1) - 330 líneas, 20 tests

**Código a reemplazar** (líneas 1314-1700+):
```javascript
function renderTimeline() { ... }           // ~80 líneas
function animateTimelineCircle() { ... }    // ~120 líneas
function showNumber(), removeNumber(), updateNumbers() // ~60 líneas
```

**Integración en App2**:
```javascript
import { createCircularTimeline } from '../../libs/app-common/circular-timeline.js';

const timelineController = createCircularTimeline({
  timeline,
  timelineWrapper,
  getPulses: () => pulses,
  getNumberFontSize: (lg) => computeNumberFontRem(lg)
});

// Simplificar renderTimeline y animateTimelineCircle
```

**Consideración especial**:
- Mantener integración con pulseMemory para selección de pulsos
- Click handlers deben seguir funcionando

**Reducción estimada**: ~140 líneas
**Tiempo estimado**: 2 horas
**Riesgo**: Medio

---

### FASE 5: T Indicator (~60 líneas) 🆕

**Módulo existente**: ✅ `libs/app-common/t-indicator.js` (App4) - ~50 líneas, tests existentes

**Código a reemplazar** (líneas 351-412):
```javascript
function updateTIndicatorText(value) { ... }     // 10 líneas
function updateTIndicatorPosition() { ... }       // 25 líneas
function scheduleTIndicatorReveal(delay) { ... }  // 25 líneas
```

**Cambio de enfoque**:
- **Antes (App2)**: Positioning custom con anchor al pulse Lg, cálculos complejos
- **Después**: Usar módulo simple t-indicator.js, positioning con CSS (igual que App4)

**Integración en App2**:
```javascript
import { createTIndicator } from '../../libs/app-common/t-indicator.js';

const tIndicatorController = inputT ? createTIndicator() : null;
if (tIndicatorController) {
  tIndicatorController.element.id = 'tIndicator';
  tIndicatorController.hide(); // Start hidden
  timeline.appendChild(tIndicatorController.element);
}

// Actualizar texto:
tIndicatorController.updateText(tValue);

// Show/hide:
tIndicatorController.show();
tIndicatorController.hide();
```

**CSS Positioning** (en App2/styles.css):
```css
#tIndicator {
  position: absolute;
  /* Positioning calculado automáticamente por layout del timeline */
  left: var(--t-indicator-left, 50%);
  top: var(--t-indicator-top, 100px);
  transform: translate(-50%, 0);
}
```

**Reducción estimada**: ~60 líneas
**Tiempo estimado**: 1 hora
**Riesgo**: Bajo
**Beneficio adicional**: Código mucho más simple y mantenible

---

### FASE 6: Notation Renderer (~80 líneas) 🆕

**Módulo existente**: ✅ `libs/app-common/notation-renderer.js` (App4) - 225 líneas, tests existentes

**Código a reemplazar** (líneas 85-156):
```javascript
function buildNotationRenderState() { ... }   // ~25 líneas
function renderNotationIfVisible() { ... }    // ~25 líneas
function handleNotationClick(event) { ... }   // ~20 líneas
```

**Diferencia con App4**:
- **App4**: Usa fractionStore para pulsos fraccionarios
- **App2**: Usa pulseMemory para pulsos enteros (selectedSet)
- **App2**: Siempre denominador 4 (negras)

**Adaptación necesaria**:
Crear wrapper o adaptar buildNotationRenderState:
```javascript
import { createNotationRenderer } from '../../libs/app-common/notation-renderer.js';

// Adaptar para pulseMemory
function buildNotationRenderStateFromMemory() {
  const lgValue = parseInt(inputLg.value, 10);
  if (!Number.isFinite(lgValue) || lgValue <= 0) return null;

  ensurePulseMemory(lgValue);
  const selectedSet = new Set();
  for (let i = 1; i <= lgValue - 1; i++) {
    if (pulseMemory[i]) selectedSet.add(i);
  }

  return {
    lg: lgValue,
    denominator: 4, // App2 siempre usa negras
    selectedSet,
    pulseFilter: 'whole'
  };
}

const notationRenderer = createNotationRenderer({
  container: notationContentEl,
  buildState: buildNotationRenderStateFromMemory,
  onPulseClick: (pulseIndex) => {
    const shouldSelect = !pulseMemory[pulseIndex];
    setPulseSelected(pulseIndex, shouldSelect);
  }
});
```

**Reducción estimada**: ~80 líneas
**Tiempo estimado**: 1 hora
**Riesgo**: Medio

---

### FASE 7: Random Config (~80 líneas) 🆕

**Módulo existente**: ✅ `libs/app-common/random-config.js` (compartido)

**Código a reemplazar** (líneas 229-293):
```javascript
function loadRandomConfig() { ... }       // 10 líneas
function saveRandomConfig(cfg) { ... }    // 5 líneas
function applyRandomConfig(cfg) { ... }   // 20 líneas
function updateRandomConfig() { ... }     // 25 líneas
```

**Cómo lo usa App4**:
```javascript
import { applyBaseRandomConfig, updateBaseRandomConfig } from '../../libs/app-common/random-config.js';

function applyRandomConfig(cfg, controls = {}) {
  applyBaseRandomConfig(cfg, {
    Lg: { toggle: controls.randLgToggle, min: controls.randLgMin, max: controls.randLgMax },
    V: { toggle: controls.randVToggle, min: controls.randVMin, max: controls.randVMax },
    T: { toggle: controls.randTToggle, min: controls.randTMin, max: controls.randTMax },
    allowComplex: controls.allowComplexToggle
  });
}
```

**Integración en App2**:
```javascript
import { applyBaseRandomConfig, updateBaseRandomConfig } from '../../libs/app-common/random-config.js';

function applyRandomConfig(cfg) {
  applyBaseRandomConfig(cfg, {
    Lg: { toggle: randLgToggle, min: randLgMin, max: randLgMax },
    V: { toggle: randVToggle, min: randVMin, max: randVMax },
    T: { toggle: randTToggle, min: randTMin, max: randTMax }
  });

  // Pulses es custom de App2
  if (randPulsesToggle && randomCount && cfg.Pulses) {
    randPulsesToggle.checked = cfg.Pulses.enabled;
    randomCount.value = cfg.Pulses.count ?? '';
  }
}

function updateRandomConfig() {
  updateBaseRandomConfig(randomConfig, {
    Lg: { toggle: randLgToggle, min: randLgMin, max: randLgMax },
    V: { toggle: randVToggle, min: randVMin, max: randVMax },
    T: { toggle: randTToggle, min: randTMin, max: randTMax }
  }, randomDefaults);

  // Pulses es custom de App2
  if (randPulsesToggle && randomCount) {
    randomConfig.Pulses = {
      enabled: randPulsesToggle.checked,
      count: randomCount.value
    };
  }

  saveRandomConfig(randomConfig);
}
```

**Reducción estimada**: ~80 líneas
**Tiempo estimado**: 30 minutos
**Riesgo**: Bajo

---

## Reducción Total Detallada

| Fase | Módulo | Líneas | Tests | Riesgo | Tiempo |
|------|--------|--------|-------|--------|--------|
| 0 | pulse-seq.js | ✅ Ya integrado | ✅ | - | - |
| 1 | number-utils.js | ~25 | 29 | Muy bajo | 30 min |
| 2 | simple-visual-sync.js | ~25 | 15 | Muy bajo | 30 min |
| 3 | simple-highlight-controller.js | ~20 | 17 | Bajo | 30 min |
| 4 | circular-timeline.js | ~140 | 20 | Medio | 2 h |
| 5 | t-indicator.js | ~60 | ✅ | Bajo | 1 h |
| 6 | notation-renderer.js | ~80 | ✅ | Medio | 1 h |
| 7 | random-config.js | ~80 | ✅ | Bajo | 30 min |
| **TOTAL** | | **~430** | **81+** | | **6 h** |

**Con optimizaciones adicionales**: hasta **~500 líneas (26%)**

---

## Orden de Implementación Óptimo

### Sesión 1: Fases Simples (2 horas)
1. **FASE 1**: Number Utilities (30 min)
2. **FASE 2**: Visual Sync (30 min)
3. **FASE 3**: Highlight Controller (30 min)
4. **FASE 7**: Random Config (30 min)

### Sesión 2: Timeline Circular (2 horas)
5. **FASE 4**: Timeline Circular + integración pulseMemory

### Sesión 3: Features Avanzados (2 horas)
6. **FASE 5**: T Indicator simplificado (1 hora)
7. **FASE 6**: Notation Renderer adaptado (1 hora)

**Tiempo total: 5-6 horas**

---

## Módulos Aplicables Completos

### De App1 Refactoring (4 módulos) ✅
1. `number-utils.js` (112 líneas, 29 tests)
2. `simple-visual-sync.js` (97 líneas, 15 tests)
3. `simple-highlight-controller.js` (85 líneas, 17 tests)
4. `circular-timeline.js` (330 líneas, 20 tests)

### De App4 Refactoring (2 módulos) ✅
5. `t-indicator.js` (~50 líneas, tests existentes)
6. `notation-renderer.js` (225 líneas, tests existentes)

### Compartidos (1 módulo) ✅
7. `random-config.js` (compartido, tests existentes)

**Total módulos reutilizados**: 7
**Total tests existentes**: 81+ ✅

---

## Checklist de Implementación

### Pre-requisitos
- [x] Módulos de App1 completados y tested (81 tests)
- [x] Módulos de App4 disponibles
- [ ] Branch: `refactor/app2-integrate-shared-modules`
- [ ] Backup de App2/main.js

### FASE 1: Number Utilities
- [ ] Importar number-utils.js en App2
- [ ] Reemplazar parseNum, formatSec, formatInteger, formatNumberValue
- [ ] Verificar inputs (parseNum)
- [ ] Verificar fórmula (formatSec)
- [ ] Testing manual
- [ ] Commit: `refactor(app2): FASE 1 - Integrate number-utils module`

### FASE 2: Visual Sync
- [ ] Importar simple-visual-sync.js
- [ ] Crear visualSync controller
- [ ] Reemplazar startVisualSync, stopVisualSync, syncVisualState
- [ ] Verificar highlighting durante playback
- [ ] Testing manual
- [ ] Commit: `refactor(app2): FASE 2 - Integrate visual-sync module`

### FASE 3: Highlight Controller
- [ ] Importar simple-highlight-controller.js
- [ ] Crear highlightController
- [ ] Reemplazar highlightPulse function
- [ ] Verificar highlighting de pulsos y loop
- [ ] Testing manual
- [ ] Commit: `refactor(app2): FASE 3 - Integrate highlight-controller module`

### FASE 7: Random Config
- [ ] Importar random-config.js (applyBaseRandomConfig, updateBaseRandomConfig)
- [ ] Refactorizar applyRandomConfig
- [ ] Refactorizar updateRandomConfig
- [ ] Mantener Pulses custom de App2
- [ ] Verificar random menu persistence
- [ ] Testing manual
- [ ] Commit: `refactor(app2): FASE 7 - Integrate random-config module`

### FASE 4: Timeline Circular
- [ ] Importar circular-timeline.js
- [ ] Crear timelineController
- [ ] Refactorizar renderTimeline
- [ ] Refactorizar animateTimelineCircle
- [ ] Mantener integración con pulseMemory
- [ ] Verificar modo linear
- [ ] Verificar modo circular
- [ ] Verificar selección de pulsos con click
- [ ] Testing manual exhaustivo
- [ ] Commit: `refactor(app2): FASE 4 - Integrate circular-timeline module`

### FASE 5: T Indicator
- [ ] Importar t-indicator.js
- [ ] Crear tIndicatorController
- [ ] Eliminar updateTIndicatorPosition y scheduleTIndicatorReveal
- [ ] Añadir CSS positioning si es necesario
- [ ] Verificar display correcto del indicador
- [ ] Testing manual
- [ ] Commit: `refactor(app2): FASE 5 - Simplify T indicator with shared module`

### FASE 6: Notation Renderer
- [ ] Importar notation-renderer.js
- [ ] Adaptar buildNotationRenderStateFromMemory
- [ ] Crear notationRenderer con adaptación
- [ ] Verificar rendering de notación
- [ ] Verificar click en pulsos (selección)
- [ ] Verificar sync con pulseMemory
- [ ] Testing manual
- [ ] Commit: `refactor(app2): FASE 6 - Integrate notation-renderer module`

### Final
- [ ] Ejecutar `npm test`
- [ ] Testing manual completo de todas las funcionalidades
- [ ] Verificar pulse memory
- [ ] Verificar notation panel
- [ ] Verificar random menu
- [ ] Verificar T indicator
- [ ] Actualizar Apps/App2/AGENTS.md
- [ ] Crear `.agents/2025-10-08-app2-refactoring-complete.md`
- [ ] Merge a main

---

## Consideraciones Especiales por Fase

### FASE 4: Timeline Circular + Pulse Memory
**Desafío**: App2 tiene selección de pulsos que debe integrarse con el timeline
**Solución**:
- timelineController solo renderiza
- Click handlers en main.js llaman setPulseSelected
- pulseMemory se mantiene sincronizado

### FASE 5: T Indicator Simplificado
**Cambio clave**: Eliminar toda la lógica de positioning custom
**Antes**: 60 líneas de código JavaScript para calcular posición
**Después**: CSS automático con variables o positioning absoluto
**Beneficio**: Código 80% más simple, más fácil de mantener

### FASE 6: Notation Renderer Adaptado
**Diferencia con App4**: pulseMemory vs fractionStore
**Solución**: Wrapper buildNotationRenderStateFromMemory que convierte pulseMemory → selectedSet
**Denominador fijo**: App2 siempre usa 4 (negras), simplifica lógica

### FASE 7: Random Config con Pulses Custom
**Caso especial**: App2 tiene campo "Pulses" que no existe en App4
**Solución**: Usar módulos base para Lg/V/T, mantener Pulses como custom en applyRandomConfig/updateRandomConfig

---

## Estado Final Esperado

**Inicial**: 1898 líneas
**Final**: ~1400 líneas
**Reducción**: ~500 líneas (26%)

**Código compartido aplicado**: 7 módulos (1029+ líneas)
**Tests que ya existen**: 81+ tests ✅

**Beneficios**:
- ✅ Código más mantenible
- ✅ Consistencia total con App1 y App4
- ✅ Todos los tests ya existen
- ✅ Bugs se arreglan una vez, benefician 3 apps
- ✅ Base sólida para refactorizar App3

---

## Próximos Pasos Después de App2

1. **Aplicar módulos a App3** (Chord Generation)
   - number-utils, circular-timeline probablemente aplicables
   - Revisar si tiene timeline similar

2. **Unificar timeline-renderer de App4** con circular-timeline de App1
   - App4 tiene timeline fraccional complejo
   - Considerar si circular-timeline puede extenderse

3. **Documentar patrones de integración**
   - Crear guías para adaptar módulos a diferentes apps
   - Documentar diferencias entre pulseMemory y fractionStore

---

*Generado: 2025-10-08 (Actualizado)*
*Basado en: Análisis completo de App2 (1898 líneas), módulos de App1 y App4*
*Actualización: Añadidas FASES 5, 6, 7 tras revisión exhaustiva*
