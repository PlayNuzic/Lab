# Plan de Refactoring - App2

**Fecha**: 2025-10-08
**App**: App2 (Ear Training)
**Métrica inicial**: 1898 líneas en main.js
**Reducción objetivo**: ~200-250 líneas (11-13%)
**Tiempo estimado**: 2-4 horas

---

## Análisis Inicial

### Código Actual de App2

**Módulos ya utilizados** de `libs/app-common`:
- ✅ `audio-init.js` - Inicialización de audio
- ✅ `random-menu.js` - Menú de randomización
- ✅ `range.js` - Utilidades de rangos
- ✅ `audio.js` - Scheduling bridge
- ✅ `subdivision.js` - Cálculos de Lg/V/T
- ✅ `dom.js` - Binding de elementos DOM
- ✅ `led-manager.js` - Gestión de LEDs
- ✅ `loop-control.js` - Control de loop
- ✅ `pulse-seq.js` - Pulse sequence controller
- ✅ `notation-panel.js` - Panel de notación
- ✅ `notation-utils.js` - Utilidades de notación

**Código duplicado con App1 a refactorizar**:
1. Number utilities (parseNum, formatSec, formatInteger, formatNumberValue) - ~30 líneas
2. Visual sync (startVisualSync, stopVisualSync, syncVisualState) - ~25 líneas
3. Highlight logic (highlightPulse) - ~25 líneas
4. Timeline circular rendering (animateTimelineCircle + geometría) - ~120 líneas

---

## Fases de Refactoring

### FASE 1: Number Utilities
**Módulo existente**: ✅ `libs/app-common/number-utils.js` (ya creado en App1)

**Código a reemplazar** (líneas 834-862):
```javascript
function parseNum(val) { ... }           // Idéntico a App1
function formatInteger(value) { ... }    // Similar a formatNumber
function formatNumberValue(value) { ... } // Idéntico a formatSec
function formatSec(n) { ... }            // Idéntico a App1
```

**Integración en App2**:
```javascript
import { parseNum, formatSec } from '../../libs/app-common/number-utils.js';

// formatInteger y formatNumberValue se reemplazan con formatNumber
```

**Reducción estimada**: ~25 líneas
**Tiempo estimado**: 30 minutos
**Riesgo**: Muy bajo

---

### FASE 2: Visual Sync
**Módulo existente**: ✅ `libs/app-common/simple-visual-sync.js` (ya creado en App1)

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

### FASE 3: Highlight Controller
**Módulo existente**: ✅ `libs/app-common/simple-highlight-controller.js` (ya creado en App1)

**Código a reemplazar** (línea 1760+):
```javascript
function highlightPulse(i) {
  // Lógica de highlighting con loop support
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

### FASE 4: Timeline Circular ⭐
**Módulo existente**: ✅ `libs/app-common/circular-timeline.js` (ya creado en App1)

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

**Reducción estimada**: ~140 líneas
**Tiempo estimado**: 2 horas
**Riesgo**: Medio (App2 tiene pulse selection memory, puede requerir ajustes)

---

## Orden de Implementación Recomendado

### Sesión 1: Fases Simples (1.5 horas)
1. ✅ **FASE 1: Number Utilities** (30 min) - Sin riesgo, reutilización directa
2. ✅ **FASE 2: Visual Sync** (30 min) - Reutilización directa
3. ✅ **FASE 3: Highlight Controller** (30 min) - Reutilización directa

### Sesión 2: Fase Compleja (2 horas)
4. ⚠️ **FASE 4: Timeline Circular** (2 horas) - Adaptar a pulse memory de App2

---

## Métricas Objetivo

### Reducción Total
- **FASE 1**: ~25 líneas
- **FASE 2**: ~25 líneas
- **FASE 3**: ~20 líneas
- **FASE 4**: ~140 líneas
- **Total**: ~210 líneas (11% de 1898)

### Estado Final Esperado
- **Inicial**: 1898 líneas
- **Final**: ~1688 líneas
- **Reducción**: 210 líneas (11%)

### Sin Crear Nuevos Módulos
**Todos los módulos ya existen** de App1 refactoring:
1. `libs/app-common/number-utils.js` (112 líneas, 29 tests) ✅
2. `libs/app-common/simple-visual-sync.js` (97 líneas, 15 tests) ✅
3. `libs/app-common/simple-highlight-controller.js` (85 líneas, 17 tests) ✅
4. `libs/app-common/circular-timeline.js` (330 líneas, 20 tests) ✅

**Total**: 81 tests ya creados

---

## Diferencias de App2 vs App1

### Características Adicionales de App2
1. **Pulse Memory**: Sistema de memoria de pulsos seleccionados (pulseMemory array)
2. **Pulse Sequence UI**: Campo editable para secuencia de pulsos
3. **Notation Panel**: Panel de notación musical con createRhythmStaff
4. **Pulse Selection**: Click en pulsos para seleccionar/deseleccionar
5. **T Indicator**: Indicador visual del tiempo total

### Consideraciones Especiales
- `renderTimeline()` debe mantener integración con pulseMemory
- `highlightPulse()` debe coordinar con pulse selection
- Timeline debe mantener click handlers para selección de pulsos

---

## Riesgos y Mitigaciones

### Riesgo 1: Pulse Memory Integration
**Probabilidad**: Media
**Impacto**: Medio
**Mitigación**:
- Mantener lógica de pulseMemory en main.js
- Controllers solo manejan rendering/highlighting
- Testing exhaustivo de selección de pulsos

### Riesgo 2: Notation Panel Sync
**Probabilidad**: Baja
**Impacto**: Bajo
**Mitigación**:
- Notation panel ya está bien encapsulado
- Solo necesita callbacks correctos de timeline

---

## Beneficios Esperados

### Inmediatos (App2)
1. ✅ Reducción 11% de código
2. ✅ Código más mantenible
3. ✅ Consistencia con App1
4. ✅ Todos los tests ya existen (81 tests)

### A Largo Plazo
1. ✅ Mismos módulos funcionan en App1 y App2
2. ✅ Bugs se arreglan una vez, benefician ambas apps
3. ✅ Base sólida para refactorizar App3

---

## Checklist de Implementación

### Pre-requisitos
- [x] Módulos de App1 completados y tested
- [x] 81 tests pasando
- [ ] Branch: `refactor/app2-integrate-app1-modules`
- [ ] Backup de App2/main.js

### FASE 1: Number Utilities
- [ ] Importar number-utils.js en App2
- [ ] Reemplazar parseNum, formatSec, formatInteger, formatNumberValue
- [ ] Verificar que inputs funcionan (parseNum)
- [ ] Verificar que fórmula se muestra bien (formatSec)
- [ ] Commit: `refactor(app2): FASE 1 - Integrate number-utils module`

### FASE 2: Visual Sync
- [ ] Importar simple-visual-sync.js en App2
- [ ] Crear visualSync controller
- [ ] Reemplazar startVisualSync, stopVisualSync, syncVisualState
- [ ] Verificar highlighting durante playback
- [ ] Commit: `refactor(app2): FASE 2 - Integrate visual-sync module`

### FASE 3: Highlight Controller
- [ ] Importar simple-highlight-controller.js en App2
- [ ] Crear highlightController
- [ ] Reemplazar highlightPulse function
- [ ] Verificar highlighting de pulsos y loop
- [ ] Commit: `refactor(app2): FASE 3 - Integrate highlight-controller module`

### FASE 4: Timeline Circular
- [ ] Importar circular-timeline.js en App2
- [ ] Crear timelineController
- [ ] Refactorizar renderTimeline
- [ ] Refactorizar animateTimelineCircle
- [ ] Mantener integración con pulseMemory
- [ ] Verificar modo linear
- [ ] Verificar modo circular
- [ ] Verificar selección de pulsos con click
- [ ] Verificar sync con notation panel
- [ ] Commit: `refactor(app2): FASE 4 - Integrate circular-timeline module`

### Final
- [ ] Ejecutar `npm test`
- [ ] Testing manual completo en App2
- [ ] Verificar todas las funcionalidades específicas de App2
- [ ] Actualizar AGENTS.md de App2
- [ ] Crear `.agents/2025-10-08-app2-refactoring-complete.md`
- [ ] Merge a main

---

## Próximos Pasos Después de App2

1. **Aplicar módulos a App3** (Chord Generation)
2. **Considerar adaptar App4** para usar circular-timeline.js en lugar de timeline-renderer.js
3. **Documentar patrones de integración**

---

*Generado: 2025-10-08*
*Basado en: Análisis de App2 (1898 líneas) y módulos de App1 refactoring*
