# App Common Modules

Módulos compartidos para aplicaciones de App4+.

## Módulos de Pulse Sequence

### pulse-seq-parser.js

**Responsabilidad**: Parseo y validación de tokens del campo de secuencia de pulsos.

**Funciones principales**:

```javascript
// Parsea texto en tokens con posiciones
parseTokens(text) → Array<{raw, start, type}>

// Valida token de pulso entero
validateInteger(token, { lg }) → {valid, value?, error?}

// Valida token de fracción (.n o n.m)
validateFraction(token, context) → {valid, entry?, error?}

// Encuentra el índice de pulso más cercano a un valor
nearestPulseIndex(value) → number

// Resuelve el gap (base, next) para posición del caret
resolvePulseSeqGap(position, lg, pulseSeqRanges) → {base, next, index}

// Epsilon para comparación flotante de fracciones
FRACTION_POSITION_EPSILON = 0.001
```

**Uso**:
```javascript
import { parseTokens, validateInteger, validateFraction } from '../../libs/app-common/pulse-seq-parser.js';

const tokens = parseTokens("  1  3.2  5  ");
// [{raw: "1", start: 2, type: "int"}, {raw: "3.2", start: 5, type: "fraction"}, ...]

const result = validateInteger({raw: "12", start: 0, type: "int"}, { lg: 24 });
// {valid: true, value: 12}
```

**Casos soportados**:
- Notación `.n` → fracción en ciclo actual (ej: `.2`)
- Notación `n.m` → fracción base.numerador (ej: `3.2`)
- Validación contra Lg para enteros
- Validación contra denominador para fracciones
- Conversión de notación cíclica a fraccionaria

---

### pulse-seq-state.js

**Responsabilidad**: Gestión de estado de pulseSeq (pulseMemory + fractionStore).

**API principal**:

```javascript
createPulseSeqStateManager({ fractionStore, pulseMemoryApi }) → {
  applyValidatedTokens(integers, fractions, { lg }),
  generateFieldText({ lg, pulseSeqRanges }),
  syncMemory(lg),
  getCurrentSelection(),
  clearAll()
}
```

**Uso**:
```javascript
import { createPulseSeqStateManager } from '../../libs/app-common/pulse-seq-state.js';

const stateManager = createPulseSeqStateManager({
  fractionStore,
  pulseMemoryApi
});

// Aplicar tokens validados
stateManager.applyValidatedTokens([1, 3, 5], [
  { key: "2.1", base: 2, numerator: 1, value: 2.25, display: "2.1" }
], { lg: 12 });

// Regenerar texto del campo
const newText = stateManager.generateFieldText({ lg: 12 });
// "  1  2.1  3  5  "
```

**Características**:
- Sincronización automática entre pulseMemory y fractionStore
- Generación de texto con orden preservado (por Lg) o por entrada
- Conversión automática a notación cíclica si está habilitada
- Gestión de selección actual

---

### pulse-seq-editor.js

**Responsabilidad**: Editor contenteditable con navegación personalizada por gaps.

**API principal**:

```javascript
createPulseSeqEditor({
  editElement,
  visualLayer?,
  onTextChange?,
  onUpdateVisualLayer?,
  onSanitize?
}) → {
  attach(),
  detach(),
  getText(),
  setText(str),
  setSelection(start, end),
  getCaretPosition(),
  moveCaretToNearestMidpoint(),
  moveCaretStep(dir)
}
```

**Funciones utilitarias**:

```javascript
// Extrae posiciones de midpoints (doble espacio)
getMidpoints(text) → number[]

// Normaliza gaps entre tokens
normalizeGaps(text) → string
```

**Uso**:
```javascript
import { createPulseSeqEditor } from '../../libs/app-common/pulse-seq-editor.js';

const editor = createPulseSeqEditor({
  editElement: document.querySelector('[contenteditable]'),
  onUpdateVisualLayer: (text) => {
    // Renderizar tokens coloreados
  },
  onSanitize: (opts) => {
    // Validar y limpiar texto
    sanitizePulseSeq(opts);
  }
});

editor.attach(); // Adjunta event listeners
```

**Características**:
- **Navegación por gaps**: ArrowLeft/Right/Home/End saltan entre tokens
- **Backspace/Delete**: Borra token completo + espacio
- **Espacio**: Normaliza gaps automáticamente
- **Enter**: Ejecuta sanitización
- **Focus**: Normaliza y posiciona en midpoint
- **Blur**: Ejecuta sanitización
- **Mouseup**: Ajusta caret al midpoint más cercano

**Eventos manejados**:
- `keydown`: Navegación, validación de teclas, borrado inteligente
- `focus`: Normalización inicial
- `blur`: Sanitización
- `mouseup`: Ajuste de caret

---

## Integración en App4

Los módulos están integrados en [main.js](../../Apps/App4/main.js):

```javascript
import { parseTokens, validateInteger, validateFraction, nearestPulseIndex, resolvePulseSeqGap }
  from '../../libs/app-common/pulse-seq-parser.js';
import { createPulseSeqStateManager }
  from '../../libs/app-common/pulse-seq-state.js';

// Inicializar gestor (después de pulseMemoryApi)
const pulseSeqStateManager = createPulseSeqStateManager({
  fractionStore,
  pulseMemoryApi
});

// Usar en sanitizePulseSeq
function sanitizePulseSeq(opts = {}) {
  const tokens = parseTokens(text);
  // ... validar ...
  pulseSeqStateManager.applyValidatedTokens(ints, fracs, { lg });
  const newText = pulseSeqStateManager.generateFieldText({ lg, pulseSeqRanges });
}
```

---

## Tests

Tests unitarios en `__tests__/pulse-seq-parser.test.js`:

```bash
npm test -- pulse-seq-parser.test.js
```

**17 tests** cubriendo:
- Parseo de tokens (enteros, fracciones `.n` y `n.m`)
- Validación de enteros (válidos, > Lg)
- Validación de fracciones (válidas, > denominador, notación cíclica)
- Búsqueda de índice más cercano con epsilon
- Resolución de gaps para navegación por caret

---

---

## Módulos de App1 (Rhythm Timeline)

### number-utils.js

**Responsabilidad**: Parseo y formateo de números con soporte multi-locale (catalán/US).

**API principal**:

```javascript
createNumberFormatter(options = {}) → {
  parseNum(val),
  formatNumber(n, decimals)
}

// Exports directos
parseNum(val) → number
formatSec(n) → string
```

**Uso**:
```javascript
import { parseNum, formatSec } from '../../libs/app-common/number-utils.js';

// Parseo inteligente (detecta formato catalán vs US)
parseNum("1.234,56") // → 1234.56 (catalán)
parseNum("1,234.56") // → 1234.56 (US)

// Formateo con locale
formatSec(1234.56) // → "1.234,56" (ca-ES)
```

**Características**:
- Detección automática de formato basada en posición de separadores
- Soporte `ca-ES` (1.234,56) y `en-US` (1,234.56)
- Factory function para configuración personalizada
- 29 tests unitarios ✅

**Apps aplicables**: App1, App2, App3, App4 (todas usan parseNum)

---

### simple-visual-sync.js

**Responsabilidad**: Sincronización visual con audio usando requestAnimationFrame.

**API principal**:

```javascript
createSimpleVisualSync({
  getAudio,
  getIsPlaying,
  onStep
}) → {
  start(),
  stop(),
  syncVisualState()
}
```

**Uso**:
```javascript
import { createSimpleVisualSync } from '../../libs/app-common/simple-visual-sync.js';

const visualSync = createSimpleVisualSync({
  getAudio: () => audio,
  getIsPlaying: () => isPlaying,
  onStep: (step) => highlightController.highlightPulse(step)
});

// Iniciar loop de sincronización
visualSync.start();

// Detener y limpiar
visualSync.stop();
```

**Características**:
- Loop con `requestAnimationFrame` para 60fps
- Evita llamadas duplicadas con `lastVisualStep`
- Manejo robusto de estados inválidos
- Cleanup automático en stop()
- 15 tests unitarios ✅

**Apps aplicables**: App1, App2, App3, App4 (apps con playback visual)

---

### simple-highlight-controller.js

**Responsabilidad**: Highlighting de pulsos con soporte de loop.

**API principal**:

```javascript
createSimpleHighlightController({
  getPulses,
  getLoopEnabled,
  highlightClass?
}) → {
  highlightPulse(index),
  clearHighlights()
}
```

**Uso**:
```javascript
import { createSimpleHighlightController } from '../../libs/app-common/simple-highlight-controller.js';

const highlightController = createSimpleHighlightController({
  getPulses: () => pulses,
  getLoopEnabled: () => loopEnabled,
  highlightClass: 'active' // Default
});

// Highlight pulse con wrapping automático
highlightController.highlightPulse(7); // 7 % pulses.length

// Limpiar todos los highlights
highlightController.clearHighlights();
```

**Características**:
- Highlighting automático de primer y último pulso cuando loop habilitado
- Index wrapping con modulo
- Force reflow para animaciones CSS
- Clase de highlight personalizable
- 17 tests unitarios ✅

**Apps aplicables**: App1, App2, App3 (apps sin pulseSeq)

**Diferencia con highlight-controller.js**: Versión simplificada sin soporte de `pulseSeq` fraccional (App4).

---

### circular-timeline.js ⭐

**Responsabilidad**: Renderizado de timeline con layouts circular y lineal. **Módulo estrella** reutilizable en 4 apps.

**API principal**:

```javascript
createCircularTimeline({
  timeline,
  timelineWrapper,
  getPulses,
  getNumberFontSize?
}) → {
  render(lg, options),
  setCircular(isCircular, options),
  updateNumbers(),
  showNumber(i),
  removeNumber(i)
}
```

**Uso**:
```javascript
import { createCircularTimeline } from '../../libs/app-common/circular-timeline.js';

const timelineController = createCircularTimeline({
  timeline: document.getElementById('timeline'),
  timelineWrapper: document.getElementById('timeline-wrapper'),
  getPulses: () => pulses,
  getNumberFontSize: (lg) => lg > 50 ? 1.2 : 1.6
});

// Render inicial
const pulses = timelineController.render(13, {
  isCircular: true,
  silent: true
});

// Cambiar layout
timelineController.setCircular(false); // Linear
timelineController.setCircular(true);  // Circular

// Actualizar números
timelineController.updateNumbers();
```

**Características**:
- **Geometría circular**: Cálculo trigonométrico de posiciones en círculo
- **Geometría linear**: Posicionamiento por porcentaje
- **Transiciones suaves**: CSS transitions coordinadas con JS
- **Números adaptativos**: Oculta números intermedios si lg >= 100
- **Circle guide visual**: Guía circular con fade in/out
- **Rotación de barras**: Barras de endpoint rotadas radialmente
- **Silent mode**: Sin animaciones para render inicial
- 20 tests unitarios ✅

**Apps aplicables**: App1, App2, App3, App4 (todas usan timeline circular)

**Casos de uso**:
- App1: Timeline rítmica con pulsos
- App2: Ear training con pulsos seleccionables
- App3: Chord generation timeline
- App4: Timeline fraccional con pulseSeq

---

## Changelog

### 2025-10-08 - App1 Refactoring Completado
- ✅ Creado number-utils.js (112 líneas, 29 tests)
- ✅ Creado simple-visual-sync.js (97 líneas, 15 tests)
- ✅ Creado simple-highlight-controller.js (85 líneas, 17 tests)
- ✅ Creado circular-timeline.js (330 líneas, 20 tests) ⭐
- ✅ App1 reducido: 1097 → 858 líneas (-239 líneas, -21.8%)
- ✅ Módulos reutilizables en App2, App3, App4

**Reducción App1**: 1097 → 858 líneas (**239 líneas, 21.8%**)
**Código compartido App1**: 624 líneas en 4 módulos reutilizables

### 2025-10-07 - FASE 4 Completada
- ✅ Creado highlight-controller.js (517 líneas)
- ✅ Creado visual-sync.js (137 líneas)
- ✅ Sistema de highlighting completo (pulsos, fracciones, ciclos)
- ✅ Scroll automático en pulseSeq
- ✅ Sincronización visual con RAF
- ✅ Force reflow para animaciones CSS
- ✅ Gestión de resolución de audio

**Reducción**: main.js 4032 → 3573 líneas (~459 líneas)

### 2025-10-07 - FASE 2 Completada
- ✅ Creado pulse-seq-editor.js (499 líneas)
- ✅ Navegación por gaps, Backspace/Delete inteligente
- ✅ Integrado en main.js (líneas 1879-1894)
- ✅ Event listeners antiguos comentados

**Reducción**: main.js 4032 → 3882 líneas (~150 líneas)

### 2025-10-07 - FASE 1 Completada
- ✅ Creado pulse-seq-parser.js (459 líneas)
- ✅ Creado pulse-seq-state.js (184 líneas)
- ✅ Tests: 17 tests pasando
- ✅ Integrado en main.js
- ✅ Corrección de errores de inicialización
- ✅ Mensaje hover con denominador real

**Reducción**: main.js 4225 → 4032 líneas (~193 líneas)

---

## Roadmap

Ver [REFACTORING_PLAN.md](../../REFACTORING_PLAN.md) para el plan completo.

**Fases completadas**:
- ~~FASE 1: pulse-seq-parser.js + pulse-seq-state.js~~ ✅
- ~~FASE 2: pulse-seq-editor.js~~ ✅
- ~~FASE 3: Simplificación sanitizePulseSeq~~ ✅ (implícita en FASE 1-2)
- ~~FASE 4: highlight-controller.js + visual-sync.js~~ ✅

**Reducción total**: 4225 → 3573 líneas (**652 líneas, 15.4%**)
**Código compartido**: 1796 líneas en 5 módulos reutilizables

**Próximas fases**:
- FASE 5: timeline-renderer.js
- FASE 6: random-fractional.js
