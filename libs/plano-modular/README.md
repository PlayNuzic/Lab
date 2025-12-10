# plano-modular

Módulo reutilizable para crear grids 2D musicales con soundline (Y), timeline (X), matrix y playhead.

## Características

- **Grid 2D completo**: soundline + timeline + matrix
- **Scroll vertical bloqueado** para usuario, controlable programáticamente
- **Scroll horizontal libre**
- **Playhead sincronizado** con posicionamiento por columna
- **Selección de celdas**: monophonic (1 por columna) o polyphonic
- **CSS custom properties** para personalización
- **Responsive** con breakpoints predefinidos
- **Dark theme** soporte
- **Out of the box**: Presets listos para usar (App19, piano roll, etc.)
- **Registry helpers**: Utilidades para construir grids basados en registros musicales

## Instalación

El módulo está disponible en `libs/plano-modular/`:

```javascript
// High-level API (recomendado)
import { createApp19Grid, createPlanoMusical } from '../../libs/plano-modular/index.js';

// Low-level API
import { createPlanoModular } from '../../libs/plano-modular/index.js';
```

## Uso Rápido (Out of the Box)

### Para App19 o grids similares

```javascript
import { createApp19Grid } from '../../libs/plano-modular/index.js';

const grid = createApp19Grid({
  parent: document.getElementById('gridContainer'),
  columns: 16,  // totalPulses
  cycleConfig: { compas: 4 },
  bpm: 100,
  onCellClick: (rowData, colIndex, isSelected) => {
    if (isSelected) {
      playNote(rowData.midi, 0.3);  // MIDI ya calculado
    }
  },
  onSelectionChange: (selected) => {
    savePreferences(grid.exportApp19Selection());
  }
});

// Cargar selección guardada
grid.loadApp19Selection(['5-7-0', '4-4-3', '3-11-10']);

// Navegar registros
grid.setRegistry(5);           // Ir a registro 5
grid.nextRegistry();           // Ir al registro más alto
grid.prevRegistry();           // Ir al registro más bajo

// Obtener notas MIDI para playback
const midiMap = grid.getSelectedMidiNotes();  // Map<pulseIndex, midiNote>
```

### Para grids con configuración personalizada

```javascript
import { createPlanoMusical } from '../../libs/plano-modular/index.js';

const grid = createPlanoMusical({
  parent: container,
  columns: 32,
  registryConfig: {
    registries: [
      { id: 5, notes: { from: 11, to: 0 } },
      { id: 4, notes: { from: 11, to: 0 } }
    ],
    visibleRows: 24,
    selectableRegistries: [4, 5]
  },
  selectionMode: 'polyphonic',
  bpm: 120
});
```

## Uso Básico (Low-level)

```javascript
import { createPlanoModular } from '../../libs/plano-modular/index.js';

// Definir filas
const rows = [
  { id: '11r5', label: '11r5', data: { registry: 5, note: 11 } },
  { id: '10r5', label: '10r5', data: { registry: 5, note: 10 } },
  { id: '0r5', label: '0r5', data: { registry: 5, note: 0 } },
  // ...
];

// Crear instancia
const plano = createPlanoModular({
  parent: document.querySelector('#grid-container'),
  rows: rows,
  columns: 16,
  cycleConfig: {
    compas: 4,
    showCycle: true
  },
  bpm: 100,
  scrollConfig: {
    blockVerticalWheel: true,
    visibleRows: 15,
    note0RowMap: { 5: 7, 4: 19, 3: 31 }
  },
  selectionMode: 'monophonic',
  onCellClick: (rowData, colIndex, isSelected) => {
    console.log(`Cell clicked: ${rowData.id} at column ${colIndex}`);
  },
  onSelectionChange: (selectedCells) => {
    console.log('Selection:', selectedCells);
  },
  showPlayhead: true
});
```

## API

### `createPlanoModular(config)`

Crea una nueva instancia del grid.

#### Config Options

| Opción | Tipo | Default | Descripción |
|--------|------|---------|-------------|
| `parent` | HTMLElement | required | Contenedor padre |
| `rows` | Array | [] | Array de filas `{id, label, data}` |
| `buildRows` | Function | null | Función alternativa para construir filas |
| `columns` | number | required | Número de columnas (pulsos) |
| `cycleConfig.compas` | number | 4 | Pulsos por ciclo |
| `cycleConfig.showCycle` | boolean | true | Mostrar superíndice de ciclo |
| `bpm` | number | 100 | Tempo en BPM |
| `scrollConfig.blockVerticalWheel` | boolean | true | Bloquear scroll vertical con wheel |
| `scrollConfig.visibleRows` | number | 15 | Filas visibles |
| `scrollConfig.note0RowMap` | Object | {} | Mapa registry → rowIndex para navegación |
| `selectionMode` | string | 'monophonic' | 'monophonic', 'polyphonic', o 'none' |
| `onCellClick` | Function | null | Callback al hacer click en celda |
| `onSelectionChange` | Function | null | Callback al cambiar selección |
| `showPlayhead` | boolean | true | Mostrar playhead |
| `playheadOffset` | number | 0 | Offset horizontal del playhead |

### Instance Methods

#### Configuration

```javascript
plano.updateColumns(20);      // Cambiar número de columnas
plano.updateRows(newRows);    // Cambiar filas
plano.setBpm(120);            // Cambiar BPM
plano.getBpm();               // Obtener BPM actual
plano.setCompas(8);           // Cambiar compás
plano.getCompas();            // Obtener compás actual
plano.refresh();              // Re-renderizar grid
```

#### Selection

```javascript
plano.selectCell('11r5', 3);           // Seleccionar celda
plano.deselectCell('11r5', 3);         // Deseleccionar celda
plano.clearSelection();                 // Limpiar toda la selección
plano.getSelectedCells();              // Map de celdas seleccionadas
plano.getSelectedArray();              // Array de {rowId, colIndex, data}
plano.isSelected('11r5', 3);           // Verificar si está seleccionada
plano.loadSelection(['11r5-3', '0r4-7']); // Cargar selección desde keys
plano.exportSelection();               // Exportar keys de selección
```

#### Scroll

```javascript
await plano.scrollToRow(10, true);      // Scroll a fila (animated)
await plano.scrollToColumn(8, true);    // Scroll a columna (animated)
await plano.scrollToRegistry(4, true);  // Scroll a registro usando note0RowMap
```

#### Playhead

```javascript
plano.updatePlayhead(5);               // Mover playhead a columna 5
plano.hidePlayhead();                  // Ocultar playhead
plano.isPlayheadVisible();             // Verificar visibilidad
```

#### Highlights

```javascript
const remove = plano.highlightCell('11r5', 3, 500);  // Highlight temporal
plano.highlightTimelineNumber(3, 500);               // Highlight número timeline
plano.clearHighlights();                              // Limpiar todos los highlights
```

#### Utilities

```javascript
plano.getContainer();                  // Obtener container DOM
plano.getElements();                   // Obtener todos los elementos DOM
plano.getCellWidth();                  // Ancho de celda actual
plano.getCellHeight();                 // Alto de celda actual
plano.getRows();                       // Obtener filas actuales
plano.getColumns();                    // Obtener número de columnas
plano.destroy();                       // Destruir instancia y limpiar
```

## Estructura de Filas

Cada fila debe tener la siguiente estructura:

```javascript
{
  id: 'unique-id',    // Identificador único
  label: 'Display',   // Texto mostrado en soundline
  data: {             // Datos arbitrarios
    registry: 5,
    note: 11,
    // ... cualquier dato adicional
  }
}
```

## CSS Custom Properties

El módulo usa CSS custom properties para personalización:

```css
.plano-container {
  /* Dimensiones */
  --plano-cell-height: 32px;
  --plano-cell-min-width: 50px;
  --plano-cell-width: 50px;
  --plano-visible-rows: 15;
  --plano-soundline-width: 50px;
  --plano-timeline-height: 40px;

  /* Colores */
  --plano-bg-color: #fff;
  --plano-cell-bg: #fafafa;
  --plano-cell-hover: rgba(0, 0, 0, 0.05);
  --plano-grid-line-color: rgba(0, 0, 0, 0.1);
  --plano-select-color: #EA570C;
  --plano-cycle-color: #4A90D9;
  --plano-highlight-color: rgba(234, 87, 12, 0.3);
  --plano-text-color: #333;
  --plano-boundary-color: rgba(74, 144, 217, 0.2);

  /* Playhead */
  --plano-playhead-width: 2px;
  --plano-playhead-color: var(--plano-select-color);

  /* Spacing */
  --plano-grid-gap: 0;
  --plano-margin-left: 15px;
}
```

## Dark Theme

El módulo soporta dark theme automáticamente:

```html
<body data-theme="dark">
  <!-- Grid usará colores oscuros -->
</body>
```

## Breakpoints Responsive

| Breakpoint | Cambios |
|------------|---------|
| ≤900px | 12 visible rows, 28px cell height |
| ≤768px | 10 visible rows, 24px cell height |
| ≤600px | 39 visible rows, 18px cell height |
| ≤500px | 16px cell height, soundline más compacto |

## Modos de Selección

### Monophonic

Solo una celda seleccionada por columna. Al seleccionar una celda, se deselecciona automáticamente cualquier otra en la misma columna.

```javascript
createPlanoModular({
  selectionMode: 'monophonic',
  // ...
});
```

### Polyphonic

Múltiples celdas pueden seleccionarse por columna.

```javascript
createPlanoModular({
  selectionMode: 'polyphonic',
  // ...
});
```

### None

Sin sistema de selección. Solo se disparan callbacks de click.

```javascript
createPlanoModular({
  selectionMode: 'none',
  // ...
});
```

## Navegación por Registros

Para apps con estructura de registros musicales, configura `note0RowMap`:

```javascript
createPlanoModular({
  scrollConfig: {
    // Mapeo de registry ID al índice de fila donde está nota 0
    note0RowMap: {
      5: 7,   // Registry 5, nota 0 está en fila 7
      4: 19,  // Registry 4, nota 0 está en fila 19
      3: 31   // Registry 3, nota 0 está en fila 31
    }
  }
});

// Después puedes navegar por registro
plano.scrollToRegistry(4);  // Scroll centrado en registry 4
```

## API de Presets (High-level)

### `createApp19Grid(config)`

Grid preconfigured con 39 filas, 15 visibles, scroll bloqueado, selección monophonic.

```javascript
const grid = createApp19Grid({
  parent: HTMLElement,           // Contenedor
  columns: number,               // Total de pulsos
  cycleConfig?: { compas, showCycle },
  bpm?: number,                  // Default: 100
  defaultRegistry?: number,      // Default: 4
  onCellClick?: Function,
  onSelectionChange?: Function
});
```

**Métodos adicionales:**
- `setRegistry(id, animated)` - Navegar a registro
- `nextRegistry()` / `prevRegistry()` - Navegación secuencial
- `getCurrentRegistry()` - Registro actual
- `getSelectableRegistries()` - [3, 4, 5]
- `exportApp19Selection()` - Array de keys "registry-note-pulse"
- `loadApp19Selection(keys)` - Cargar desde keys
- `getMidi(registry, note)` - Calcular MIDI
- `getSelectedMidiNotes()` - Map<pulse, midi>
- `getNote0RowMap()` - { 5: 7, 4: 19, 3: 31 }

### `createPlanoMusical(config)`

API genérica con soporte de registros personalizable.

```javascript
const grid = createPlanoMusical({
  parent: HTMLElement,
  columns: number,
  registryConfig?: {
    registries: Array<{id, notes: {from, to}}>,
    visibleRows: number,
    selectableRegistries: Array<number>,
    notesPerRegistry: number,
    midiOffset: number
  },
  cycleConfig?: Object,
  bpm?: number,
  selectionMode?: 'monophonic' | 'polyphonic' | 'none',
  onCellClick?: Function,
  onSelectionChange?: Function,
  showPlayhead?: boolean
});
```

### `createSimpleGrid(config)`

Grid simple sin sistema de registros.

```javascript
const grid = createSimpleGrid({
  parent: HTMLElement,
  rows: number,
  columns: number,
  rowLabelFormatter?: (index) => string,
  selectionMode?: string,
  onCellClick?: Function
});
```

### `PRESETS`

Configuraciones predefinidas:

```javascript
import { PRESETS } from '../../libs/plano-modular/index.js';

// PRESETS.APP19 - 39 filas, 15 visibles, monophonic
// PRESETS.PIANO_ROLL - 48 filas, 24 visibles, polyphonic
// PRESETS.SINGLE_OCTAVE - 12 filas, todas visibles
```

## Registry Helpers

Utilidades para construir y manipular grids basados en registros:

```javascript
import {
  buildRegistryRows,
  calculateNote0RowMap,
  convertToApp19Keys,
  convertFromApp19Keys,
  calculateMidi,
  isBoundaryRow
} from '../../libs/plano-modular/index.js';

// Construir 39 filas estilo App19
const rows = buildRegistryRows();  // Usa APP19_CONFIG por defecto

// Calcular mapa para scroll
const note0RowMap = calculateNote0RowMap(rows);
// { 5: 7, 4: 19, 3: 31 }

// Convertir formatos de selección
const app19Keys = convertToApp19Keys(moduleSelection);
const moduleItems = convertFromApp19Keys(['5-7-0', '4-4-3']);

// Calcular MIDI
const midi = calculateMidi(4, 0);  // 60 (Middle C)
```

## Módulos Internos

Para uso avanzado, puedes importar módulos individuales:

```javascript
import { createSelectionManager } from '../../libs/plano-modular/plano-selection.js';
import { setupScrollSync, blockVerticalWheel } from '../../libs/plano-modular/plano-scroll.js';
import { createPlayheadController } from '../../libs/plano-modular/plano-playhead.js';
import { buildGridDOM, updateMatrix } from '../../libs/plano-modular/plano-grid.js';
```

## Tests

```bash
npm test -- --testPathPattern="plano-modular"
```

**205 tests** en 6 suites:
- `plano-selection.test.js` - Selection manager
- `plano-scroll.test.js` - Scroll sync and navigation
- `plano-playhead.test.js` - Playhead controller
- `plano-grid.test.js` - Grid DOM construction
- `registry-helpers.test.js` - Registry building and conversion (41 tests)
- `presets.test.js` - High-level presets API (33 tests)

## Ejemplo Completo

```javascript
import { createPlanoModular } from '../../libs/plano-modular/index.js';

// Construir filas para 3 registros (5, 4, 3)
function buildRows() {
  const rows = [];
  for (let registry = 5; registry >= 3; registry--) {
    for (let note = 11; note >= 0; note--) {
      rows.push({
        id: `${note}r${registry}`,
        label: `${note}r${registry}`,
        data: { registry, note }
      });
    }
  }
  return rows;
}

// Crear grid
const plano = createPlanoModular({
  parent: document.querySelector('#grid'),
  buildRows,
  columns: 16,
  cycleConfig: { compas: 4, showCycle: true },
  bpm: 100,
  scrollConfig: {
    blockVerticalWheel: true,
    visibleRows: 15,
    note0RowMap: { 5: 11, 4: 23, 3: 35 }
  },
  selectionMode: 'monophonic',
  onCellClick: (row, col, selected) => {
    if (selected) {
      playNote(row.data.note, row.data.registry);
    }
  },
  onSelectionChange: (cells) => {
    saveToLocalStorage(cells);
  }
});

// Iniciar en registry 4
plano.scrollToRegistry(4);

// Playback loop
let currentPulse = 0;
function tick() {
  plano.updatePlayhead(currentPulse);
  plano.highlightTimelineNumber(currentPulse, 100);

  const cell = plano.getSelectedArray().find(c => c.colIndex === currentPulse);
  if (cell) {
    plano.highlightCell(cell.rowId, currentPulse, 100);
  }

  currentPulse = (currentPulse + 1) % plano.getColumns();
}

// Cleanup
window.addEventListener('beforeunload', () => {
  plano.destroy();
});
```
