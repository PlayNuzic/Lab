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

### 2025-10-07 - FASE 1 Completada
- ✅ Creado pulse-seq-parser.js (520 líneas)
- ✅ Creado pulse-seq-state.js (175 líneas)
- ✅ Tests: 17 tests pasando
- ✅ Integrado en main.js
- ✅ Corrección de errores de inicialización
- ✅ Mensaje hover con denominador real (en lugar de 'd')

**Reducción**: main.js 4225 → 4032 líneas (~193 líneas)

---

## Roadmap

Ver [REFACTORING_PLAN.md](../../REFACTORING_PLAN.md) para el plan completo.

**Próximas fases**:
- FASE 2: pulse-seq-editor.js (navegación por gaps, eventos de teclado)
- FASE 3: Simplificación completa de sanitizePulseSeq
- FASE 4: highlight-controller.js + visual-sync.js
