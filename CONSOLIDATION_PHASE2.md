# Consolidación de Módulos - Fase 2

## Estado
🚧 **Pendiente** | Planificado para sesiones futuras

**Fecha de creación:** 2025-10-30
**Última actualización:** 2025-10-30

---

## Fase 1 Completada ✅

### Consolidaciones Implementadas
1. ✅ **Mixer modules** - Verificado (no requería consolidación - arquitecturas diferentes)
2. ✅ **Click-outside** - Ya integrado en header.js anteriormente
3. ✅ **Pulse-seq modules** - pulse-seq.js + pulse-seq-intervals.js consolidados
4. 🔄 **Number modules** - Movido a Fase 2 (complejidad mayor a la estimada)

### Resultados Fase 1
- **Módulos eliminados:** 1 (pulse-seq-intervals.js)
- **Líneas ahorradas:** ~502 líneas (85% duplicación eliminada)
- **Apps migradas:** App5 (App2 ya usaba pulse-seq.js estándar)
- **Tests:** 280/280 passing ✅
- **Impacto:** Eliminación masiva de código duplicado en pulse sequence controllers

---

## Consolidaciones de Fase 2

### 🔴 HIGH PRIORITY

#### 1. Consolidar Number Modules (CRÍTICO - Movido desde Fase 1)
**Merge:** `number.js` + `number-utils.js` + `range.js` → `number-utils.js`

**Análisis detallado:**

**Archivos actuales:**
- `number.js` (89 líneas): parsePositiveInt, parseIntSafe, parseFloatSafe, gcd, lcm, resolveRange, resolveIntRange
- `number-utils.js` (140 líneas): parseNum (Catalan locale), formatNumber, formatSec, randomInt
- `range.js` (27 líneas): toNumber, toRange + TODO indicando consolidación pendiente

**Overlaps identificados:**
- `toNumber` (range.js) ≈ `parseFloatSafe` (number.js) - funcionalidad casi idéntica
- `toRange` (range.js) ≈ `resolveRange` (number.js) - resolveRange más complejo pero similar
- `parseNum` (number-utils.js) es versión avanzada con locale vs parseFloatSafe básico

**Estrategia propuesta:**
```javascript
// libs/app-common/number-utils.js (consolidado ~220 líneas)
export {
  // Parsing (safe, locale-aware)
  parsePositiveInt,
  parseIntSafe,
  parseFloatSafe,
  parseNum, // Catalan locale support

  // Formatting
  formatNumber,
  formatSec,
  createNumberFormatter, // locale factory

  // Math utilities
  gcd,  // Greatest common divisor
  lcm,  // Least common multiple
  randomInt,

  // Range utilities
  toNumber,
  toRange,
  resolveRange,
  resolveIntRange
}
```

**Apps afectadas:** TODAS (App1, 2, 3, 4, 5)

**Pasos de implementación:**
1. Leer todos los imports actuales de number.js y range.js en las 5 apps
2. Añadir las funciones de number.js y range.js a number-utils.js
3. Actualizar todos los imports app por app:
   - App1: ~3-4 imports
   - App2: ~2-3 imports
   - App3: ~2-3 imports
   - App4: ~3-4 imports
   - App5: ~2-3 imports
4. Eliminar number.js y range.js obsoletos
5. Consolidar tests (number.test.js, range.test.js, number-utils.test.js)
6. Ejecutar `npm test` → validar 280/280 passing

**Líneas ahorradas:** ~35 líneas
**Imports reducidos:** 10-15 total (2-3 por app)
**Esfuerzo estimado:** 3-4 horas
**Riesgo:** MEDIO-ALTO (afecta todas las apps, parsing crítico)

---

#### 2. Consolidar Highlight Controllers
**Merge:** `highlight-controller.js` + `simple-highlight-controller.js` + `highlight-interval.js`

**Estado actual:**
- `highlight-controller.js` (522 líneas): Full-featured con fractions, cycles, pulse numbers, scrolling
- `simple-highlight-controller.js` (85 líneas): Basic pulse highlighting con loop support
- `highlight-interval.js` (102 líneas): Interval-specific highlighting

**Overlap:** Todos gestionan pulse highlighting con CSS classes, todos manejan loop edge cases, todos tienen `highlightPulse` y `clearHighlights`

**Estrategia propuesta:**
```javascript
// libs/app-common/highlight-controller.js (consolidado ~550 líneas)
export function createHighlightController(config = {}) {
  const mode = config.mode || 'full'; // 'full', 'simple', 'interval'
  // Unified implementation con mode-specific features
}

// Convenience factories
export const createSimpleHighlightController = (config) =>
  createHighlightController({ ...config, mode: 'simple' });

export const createIntervalHighlightController = (config) =>
  createHighlightController({ ...config, mode: 'interval' });
```

**Apps afectadas:** App1, App2 (simple), App4 (full), App5 (interval)
**Líneas ahorradas:** ~150 líneas
**Imports reducidos:** 0 (mantener named exports por compatibilidad)
**Esfuerzo estimado:** 4-5 horas
**Riesgo:** MEDIO (require careful testing de cada modo)

**Beneficios:**
- Unified highlighting logic
- Easier to share features across modes
- Reduced cognitive load (one API to learn)

---

#### 3. Consolidar Visual Sync Modules
**Merge:** `visual-sync.js` + `simple-visual-sync.js` → `visual-sync.js`

**Estado actual:**
- `visual-sync.js` (140 líneas): Full sync con resolution changes, notation cursor, cycle highlighting
- `simple-visual-sync.js` (94 líneas): Basic sync con step callback only

**Overlap:** RAF management logic ~60% duplicado, `syncVisualState` similar pattern, `lastVisualStep` tracking idéntico

**Estrategia propuesta:**
```javascript
// libs/app-common/visual-sync.js (consolidado ~150 líneas)
export function createVisualSyncManager(config = {}) {
  const features = {
    resolution: config.trackResolution !== false,
    notation: Boolean(config.getNotationRenderer),
    cycles: Boolean(config.highlightCycles)
  };
  // Unified RAF loop con opt-in features
}

// Convenience factory
export const createSimpleVisualSync = ({ getAudio, getIsPlaying, onStep }) =>
  createVisualSyncManager({
    getAudio,
    getIsPlaying,
    onStepChange: onStep,
    trackResolution: false,
    highlightCycles: false
  });
```

**Apps afectadas:** App1, App2, App5 (simple), App4 (full)
**Líneas ahorradas:** ~80 líneas
**Esfuerzo estimado:** 2-3 horas
**Riesgo:** BAJO (logic is very similar)

**Beneficios:**
- Single RAF management implementation
- Opt-in features instead of separate modules
- Easier to add new features

---

### 🟡 MEDIUM PRIORITY

#### 4. Crear Sub-package: pulse-seq/
**Organizar:** `pulse-seq-parser.js` + `pulse-seq-state.js` + `pulse-seq-editor.js`

**Razón:** Estos 3 módulos (467+184+499 = 1,150 líneas) están tightly coupled y siempre usados juntos en App4

**Estructura propuesta:**
```
libs/app-common/pulse-seq/
├── index.js      # Exports unificados
├── parser.js     # parseTokens, validateInteger, validateFraction
├── state.js      # PulseSeqStateManager
└── editor.js     # PulseSeqEditor
```

**Import en App4:**
```javascript
// Antes (3 imports separados):
import { parseTokens } from '../../libs/app-common/pulse-seq-parser.js';
import { createPulseSeqStateManager } from '../../libs/app-common/pulse-seq-state.js';
import { createPulseSeqEditor } from '../../libs/app-common/pulse-seq-editor.js';

// Después (1 import):
import * as PulseSeq from '../../libs/app-common/pulse-seq/index.js';
// o:
import { parseTokens, createPulseSeqStateManager, createPulseSeqEditor }
  from '../../libs/app-common/pulse-seq/index.js';
```

**Apps afectadas:** Solo App4
**Líneas ahorradas:** 0 (organizational change)
**Imports reducidos:** 3 → 1
**Esfuerzo:** 1-2 horas
**Riesgo:** MUY BAJO

**Beneficios:**
- Clear module boundaries
- Better cohesion (related code together)
- Easier to navigate and understand
- Follows standard sub-package pattern

---

#### 5. Crear Sub-package: notation/
**Organizar:** `notation-utils.js` + `notation-renderer.js` + `fraction-notation.js`

**Razón:** 3 módulos relacionados (202+228+216 = 646 líneas) usados juntos para VexFlow rendering

**Estructura propuesta:**
```
libs/app-common/notation/
├── index.js             # Exports unificados
├── utils.js             # buildPulseEvents, durationValueFromDenominator
├── renderer.js          # createNotationRenderer
└── fraction-notation.js # resolveFractionNotation
```

**Apps afectadas:** App2, App4
**Líneas ahorradas:** 0 (organizational)
**Imports reducidos:** 2-3 per app → 1
**Esfuerzo:** 1-2 horas
**Riesgo:** BAJO

**Beneficios:**
- Logical grouping of notation logic
- Easier to extend notation features
- Clear dependency on VexFlow

---

#### 6. Crear Sub-package: random/
**Organizar:** `random-menu.js` + `random-config.js` + `random-fractional.js`

**Razón:** 3 módulos de randomización (109+49+232 = 390 líneas) forman sistema cohesivo

**Estructura propuesta:**
```
libs/app-common/random/
├── index.js        # Exports
├── menu.js         # initRandomMenu, mergeRandomConfig
├── config.js       # applyBaseRandomConfig, updateBaseRandomConfig
└── fractional.js   # randomizeFractional
```

**Apps afectadas:** App1-5
**Esfuerzo:** 2 horas
**Riesgo:** BAJO

---

#### 7. Consolidar Tap Tempo Modules
**Merge:** `tap-tempo-handler.js` + `audio-schedule.js` → `tap-tempo.js`

**Razón:** `audio-schedule.js` (70 líneas) contiene tap tempo resync logic. Debería ser parte de `tap-tempo-handler.js` (104 líneas).

**⚠️ VERIFICAR PRIMERO:** Confirmar que `computeNextZero` de audio-schedule no se usa fuera de tap tempo

**Estrategia propuesta:**
```javascript
// libs/app-common/tap-tempo.js (consolidado ~160 líneas)
export function createTapTempoHandler() { ... }
export function computeResyncDelay() { ... }
export function computeNextZero() { ... } // si solo se usa en tap tempo
```

**Apps afectadas:** App1-3, App5
**Líneas ahorradas:** ~10 líneas
**Esfuerzo:** 1-2 horas
**Riesgo:** BAJO (si computeNextZero solo se usa en tap tempo)

---

### 🟢 LOW PRIORITY / ORGANIZATIONAL

#### 8. Considerar: formula-renderer.js
**Opción A:** Merge en fraction-editor.js si está relacionado
**Opción B:** Crear formula/ sub-package si va a crecer

**Requiere análisis:** Verificar si formula-renderer es fraction-specific o general-purpose

---

#### 9. Considerar: Audio sub-package
**Módulos:** audio.js, audio-init.js, audio-toggles.js, audio-schedule.js

**Estructura posible:**
```
libs/app-common/audio/
├── index.js
├── init.js
├── bridges.js
├── toggles.js
└── schedule.js
```

**Beneficio:** Organizational clarity, no reduction
**Esfuerzo:** 3 horas

---

#### 10. Considerar: Timeline sub-package
**Módulos:** circular-timeline.js, timeline-layout.js, timeline-renderer.js, t-indicator.js

**Análisis:** Son suficientemente diferentes para mantener separados, pero sub-package mejoraría navegación

---

## Roadmap de Implementación

### Orden Sugerido para Fase 2:

**Primera Sesión** (4-5 horas):
1. Number modules consolidation (crítico, afecta todas las apps)
2. Highlight controllers consolidation

**Segunda Sesión** (3-4 horas):
3. Visual sync consolidation
4. pulse-seq/ sub-package

**Tercera Sesión** (3-4 horas):
5. notation/ sub-package
6. random/ sub-package
7. Tap tempo consolidation

**Total Fase 2:** 10-13 horas (~2-3 semanas)

---

## Beneficios Totales Esperados (Fase 1 + Fase 2)

### Cuantitativos:
- **Módulos reducidos:** 46 → ~35-38 (reducción del 17-24%)
- **Líneas ahorradas:** 500 (Fase 1) + 240-280 (Fase 2) = **~740-780 líneas** (16-17% reducción)
- **Imports por app reducidos:** 40-60 fewer import statements across all apps
- **Test files consolidados:** 5-7 fewer test files to maintain

### Cualitativos:
- **Arquitectura más clara:** Related code grouped together
- **Easier discovery:** Less module hunting, clearer APIs
- **Better maintainability:** Single source of truth for features
- **Reduced cognitive load:** Fewer files to understand, clearer module boundaries
- **Easier testing:** Consolidated test coverage
- **Better onboarding:** New developers understand structure faster

---

## Testing Strategy

Para cada consolidación de Fase 2:

1. **Unit tests:**
   - Actualizar imports en test files
   - Ejecutar `npm test`
   - Validar 280/280 passing

2. **Integration tests:**
   - Test affected apps manualmente
   - Verificar funcionalidad completa

3. **Visual regression:**
   - Compare before/after screenshots si necesario
   - Especialmente importante para highlight y visual-sync

4. **Performance:**
   - Verify no bundle size increase (should decrease slightly)
   - Check no performance degradation

---

## Riesgos y Mitigación

### Riesgos Identificados:

1. **Number modules (HIGH):**
   - **Riesgo:** Parsing incorrecto rompe todas las apps
   - **Mitigación:** Test exhaustivo, migración app por app, rollback plan

2. **Highlight controllers (MEDIUM):**
   - **Riesgo:** Diferentes modos requieren careful testing
   - **Mitigación:** Unit tests por modo, visual regression testing

3. **Sub-packages (LOW):**
   - **Riesgo:** Path changes pueden romper imports
   - **Mitigación:** Update all imports before removing old files

### Rollback Plan:

Para cada consolidación:
1. Commit antes de empezar
2. Test completo después de cada cambio
3. Si algo falla: `git revert` inmediato
4. Re-evaluar strategy antes de reintentar

---

## Criterios de Éxito - Fase 2

✅ **Debe cumplir:**
- [ ] Todos los tests passing (280/280)
- [ ] Todas las apps funcionando correctamente (manual testing)
- [ ] No performance regression
- [ ] MODULES.md actualizado con nueva estructura
- [ ] Commits descriptivos con métricas (líneas ahorradas, apps afectadas)

✅ **Deseable:**
- [ ] Bundle size reducido
- [ ] Imports reducidos visiblemente en cada app
- [ ] Código más legible y mantenible
- [ ] Documentación mejorada

---

## Notas para Sesiones Futuras

### Al Iniciar Fase 2:

1. **Leer este documento completo**
2. **Ejecutar tests baseline:** `npm test` → validar 280/280 passing
3. **Elegir consolidación:** Empezar por number modules (crítico)
4. **Seguir flujo:**
   - Analizar imports actuales
   - Crear módulo consolidado
   - Migrar app por app
   - Test después de cada app
   - Commit cuando todo funcione

### Recordatorios:

- **NUNCA consolidar múltiples cosas a la vez** - una consolidación a la vez
- **SIEMPRE test después de cada cambio** - no acumular cambios sin test
- **DOCUMENTAR decisiones** - si algo no funciona como esperado, documentar por qué
- **Actualizar este documento** - marcar completed, añadir findings

---

**Última actualización:** 2025-10-30
**Estado:** 🚧 Pendiente de inicio
**Próxima acción:** Consolidar number modules (item #1)
