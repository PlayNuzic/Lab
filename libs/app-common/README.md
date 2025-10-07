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

## Changelog

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
