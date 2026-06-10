# Interval Sequencer Module

Sistema completo para secuenciación basada en intervalos musicales (iS-iT).
Proporciona drag-based editing, visualización de barras temporales, y conversión pairs ↔ intervals.

## Instalación

```javascript
import { createIntervalSequencer } from '../../libs/interval-sequencer/index.js';
```

## Uso Básico

```javascript
const sequencer = createIntervalSequencer({
  musicalGrid,
  gridEditor,
  totalSpaces: 8,
  basePair: { note: 0, pulse: 0 },
  autoFillGaps: true,
  onIntervalsChange: (intervals, pairs) => {
    console.log('Intervals changed:', intervals);
  }
});

// Establecer pares iniciales
sequencer.setPairs(initialPairs);

// Obtener intervalos actuales
const intervals = sequencer.getIntervals();

// Limpiar
sequencer.destroy();
```

## API

### `createIntervalSequencer(config)`

Crea un controlador de secuenciador de intervalos.

#### Configuración

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `musicalGrid` | Object | Instancia de musical-grid |
| `gridEditor` | Object | Instancia de grid-editor (opcional) |
| `totalSpaces` | number | Total de espacios/celdas (ej: 8) |
| `basePair` | Object | Par base para cálculos `{note, pulse}` |
| `autoFillGaps` | boolean | Auto-rellenar huecos con silencios |
| `polyphonyEnabled` | boolean | Permitir notas superpuestas |
| `onIntervalsChange` | Function | Callback cuando cambian intervalos |
| `onPairsChange` | Function | Callback cuando cambian pares |
| `onNotePreview` | Function | Callback para preview de nota |
| `onDragStart` | Function | Callback al iniciar drag |
| `onDragEnd` | Function | Callback al terminar drag |

#### Métodos Retornados

**Gestión de Pares:**
- `setPairs(pairs)` - Establecer pares
- `getPairs()` - Obtener pares actuales
- `addPair(pair)` - Añadir un par
- `removePair(index)` - Eliminar par por índice
- `removePairAt(noteIndex, pulse)` - Eliminar par por posición
- `clear()` - Limpiar todos los pares

**Gestión de Intervalos:**
- `setIntervals(intervals)` - Establecer intervalos (convierte a pares)
- `getIntervals()` - Obtener intervalos actuales

**Control de Drag:**
- `setDragEnabled(enabled)` - Habilitar/deshabilitar drag
- `isDragging()` - Verificar si hay drag activo
- `startDrag(noteIndex, spaceIndex, event)` - Iniciar drag programáticamente
- `cancelDrag()` - Cancelar drag actual

**Polifonía:**
- `setPolyphony(enabled)` - Establecer modo polifónico
- `isPolyphonyEnabled()` - Verificar si polifonía está habilitada

**Gestión de Huecos:**
- `checkGaps()` - Verificar si hay huecos
- `getGaps()` - Obtener información de huecos
- `fillCurrentGaps()` - Rellenar huecos con silencios

**Visualización:**
- `highlightInterval(index, duration)` - Resaltar barra de intervalo
- `refresh()` - Re-renderizar barras

**Ciclo de Vida:**
- `destroy()` - Limpiar y destruir
- `getRenderer()` - Acceso al renderer interno
- `getDragHandler()` - Acceso al drag handler interno

## Módulos Individuales

Para casos de uso avanzados, se pueden importar módulos individuales:

### Gap Filler

```javascript
import {
  fillGapsWithSilences,
  detectGaps,
  hasGaps,
  calculateTotalDuration,
  removeSilences
} from '../../libs/interval-sequencer/index.js';

// Rellenar huecos con silencios
const filledPairs = fillGapsWithSilences(pairs, { note: 0, pulse: 0 });

// Detectar huecos
const gaps = detectGaps(pairs);
// Returns: [{ startPulse: 2, size: 3 }, ...]
```

### Interval Converter

```javascript
import {
  pairsToIntervals,
  buildPairsFromIntervals,
  validatePairSequence,
  validateIntervalSequence
} from '../../libs/interval-sequencer/index.js';

// Convertir pares a intervalos
const intervals = pairsToIntervals(pairs, basePair);

// Construir pares desde intervalos
const pairs = buildPairsFromIntervals(basePair, intervals, { wrapAround: true });

// Validar secuencia
const result = validatePairSequence(pairs, { noteRange: [0, 11], maxPulse: 8 });
```

### Interval Renderer

```javascript
import {
  createIntervalRenderer,
  DEFAULT_INTERVAL_BAR_STYLES,
  injectIntervalBarStyles
} from '../../libs/interval-sequencer/index.js';

const renderer = createIntervalRenderer({
  getTimelineContainer: () => timeline,
  getMatrixContainer: () => matrix,
  totalSpaces: 8
});

renderer.render(intervals);
renderer.highlightBar(1, 300);
renderer.clear();
renderer.destroy();
```

### Interval Drag Handler

```javascript
import {
  createIntervalDragHandler,
  getSpaceIndexFromPair,
  getEndSpaceFromPair
} from '../../libs/interval-sequencer/index.js';

const dragHandler = createIntervalDragHandler({
  musicalGrid,
  gridEditor,
  totalSpaces: 8,
  getPolyphonyEnabled: () => false,
  onDragEnd: (pairs, info) => console.log('Drag ended', info)
});

// Pointer Events (ratolí + tàctil + llapis): els listeners de document
// (pointermove/pointerup/pointercancel) només viuen mentre dura el drag.
// Para iniciar un drag (des d'un pointerdown del consumidor):
dragHandler.startDrag(noteIndex, spaceIndex, event);
```

## Estructura de Datos

### Par (Pair)

```javascript
{
  note: 5,              // Índice de nota (0-11)
  pulse: 2,             // Posición de inicio (0-7)
  temporalInterval: 3,  // Duración en pulsos
  isRest: false         // true si es silencio
}
```

### Intervalo (Interval)

```javascript
{
  soundInterval: 3,     // Intervalo de sonido (diferencia de nota)
  temporalInterval: 2,  // Duración en pulsos
  isRest: false         // true si es silencio
}
```

## Semántica pulse=START

Este módulo usa la semántica **pulse=START**:
- `pulse` indica dónde **comienza** la nota
- `temporalInterval` (iT) indica cuántos pulsos **dura**
- La nota ocupa pulsos desde `pulse` hasta `pulse + iT - 1`

Ejemplo:
```javascript
{ note: 5, pulse: 2, temporalInterval: 3 }
// La nota 5 comienza en pulso 2 y dura 3 pulsos
// Ocupa: pulsos 2, 3, 4
```

## Tests

```bash
npm test -- --testPathPattern="interval-sequencer"
```

**Cobertura:** 113 tests en 5 suites

## Apps Usando Este Módulo

- **App15**: Plano y Sucesión de Intervalos

## Dependencias

- `libs/matrix-seq/interval-parser.js` (re-exports)

## Archivos

```
libs/interval-sequencer/
├── index.js                    # Exports unificados
├── interval-controller.js      # Controlador principal
├── interval-converter.js       # Conversión pairs ↔ intervals
├── interval-drag-handler.js    # Sistema de drag para iT
├── interval-renderer.js        # Renderizado de iT-bars
├── gap-filler.js              # Auto-inserción de silencios
├── README.md                   # Esta documentación
└── __tests__/
    ├── gap-filler.test.js
    ├── interval-converter.test.js
    ├── interval-drag-handler.test.js
    ├── interval-renderer.test.js
    └── interval-controller.test.js
```
