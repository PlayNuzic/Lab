# musical-grid - 2D Musical Grid Visualization

Production-ready module for rendering interactive 2D musical grids with soundline, timeline, and matrix visualization.

## Features

- ✅ **Complete grid system** - Soundline (vertical notes), Timeline (horizontal pulses), Matrix (cells)
- ✅ **Interval system** - Integrated interval bars and numbers with playback highlighting (plug&play)
- ✅ **Scroll support** - Optional horizontal/vertical scroll for large grids with synchronized axes
- ✅ **Interactive cells** - Click handlers, hover states, highlight support for playback
- ✅ **Flexible layout** - fillSpaces mode (cells between pulses) or direct alignment
- ✅ **Custom formatters** - Custom note/pulse labels
- ✅ **Responsive design** - 4 breakpoints with automatic resize handling
- ✅ **Theme support** - Light/dark theme compatibility
- ✅ **Auto-render** - Renders immediately on creation
- ✅ **Full test coverage** - 26 passing tests

## Quick Start

```javascript
// 1. Import module and CSS (CSS includes interval styles - plug&play)
import { createMusicalGrid } from '../../libs/musical-grid/index.js';
import '../../libs/musical-grid/musical-grid.css';

// 2. HTML container
// <div id="gridContainer"></div>

// 3. Initialize (basic with intervals)
const grid = createMusicalGrid({
  parent: document.getElementById('gridContainer'),
  notes: 12,                                         // Vertical divisions (0-11)
  pulses: 9,                                         // Horizontal markers (0-8)
  startMidi: 60,                                     // C4 as lowest note
  fillSpaces: true,                                  // Cells between pulses (8 spaces for 9 pulses)
  showIntervals: { horizontal: true, vertical: false }, // Enable interval bars
  intervalColor: '#4A9EFF',                          // Interval bar color
  onCellClick: (note, pulse, cell) => {
    console.log(`Clicked: Note ${note}, Pulse ${pulse}`);
  }
});

// 4. Use API
grid.highlight(5, 2, 500);  // Highlight cell at note 5, pulse 2 for 500ms
grid.clear();               // Clear all highlights

// 5. Native interval highlighting during playback
// Simple one-liner for each pulse step:
grid.onPulseStep(3, 500);  // Auto-highlights interval 4 for 500ms

// 6. Cleanup
grid.destroy();
```

## API Reference

### Creating the Grid

```javascript
const grid = createMusicalGrid(config);
```

#### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `parent` | HTMLElement | **required** | Container element |
| `notes` | number | `12` | Number of vertical note divisions |
| `pulses` | number | `9` | Number of horizontal pulse markers |
| `startMidi` | number | `60` | Starting MIDI note (C4) |
| `fillSpaces` | boolean | `true` | If true, cells fill spaces BETWEEN pulses (n-1 horizontally) |
| `showIntervals` | object | `null` | Enable intervals: `{horizontal: true, vertical: false}` |
| `intervalColor` | string | `'#4A9EFF'` | Interval bar and number color |
| `scrollEnabled` | boolean | `false` | Enable scroll for larger grids |
| `containerSize` | object | `null` | Fixed container size: `{width, height, maxWidth, maxHeight}` |
| `visibleCells` | object | `null` | Visible cell counts: `{notes, pulses}` |
| `cellSize` | object | `null` | Minimum cell size in scroll mode: `{minWidth, minHeight}` |
| `onCellClick` | function | `null` | `(noteIndex, pulseIndex, cellElement) => void` |
| `onNoteClick` | function | `null` | `(noteIndex, midi, noteElement) => void` |
| `cellRenderer` | function | `null` | `(noteIndex, pulseIndex, cellElement) => void` |
| `noteFormatter` | function | `null` | `(noteIndex, midi) => string` |
| `pulseFormatter` | function | `null` | `(pulseIndex) => string` |
| `cellClassName` | string | `'musical-cell'` | CSS class for cells |
| `activeClassName` | string | `'active'` | CSS class for active cells |
| `highlightClassName` | string | `'highlight'` | CSS class for highlighted cells |
| `insertBefore` | HTMLElement | `null` | Insert grid before this element |

### Methods

| Method | Description |
|--------|-------------|
| `render()` | Re-render grid (auto-called on creation) |
| `clear()` | Clear all active/highlight states |
| `update()` | Update cell positions (auto-called on resize) |
| `destroy()` | Remove grid and clean up |
| `getCellElement(noteIndex, pulseIndex)` | Get cell element by indices |
| `highlight(noteIndex, pulseIndex, duration)` | Highlight cell temporarily |
| `getNoteElement(noteIndex)` | Get note label element |
| `getPulseElement(pulseIndex)` | Get pulse marker element |
| `getMidiForNote(noteIndex)` | Get MIDI number for note index |
| `highlightInterval(axis, index, duration)` | Highlight an interval bar (native) |
| `clearIntervalHighlights(axis)` | Clear interval highlights |
| `onPulseStep(pulseIndex, duration)` | Helper for playback - auto-highlights intervals |
| `getTimelineContainer()` | Get timeline inner container |
| `getSoundlineContainer()` | Get soundline inner container |

### Getters (Read-only)

| Getter | Type | Description |
|--------|------|-------------|
| `isRendered` | boolean | Render status |
| `cellCount` | number | Total cells rendered |
| `noteCount` | number | Number of notes |
| `pulseCount` | number | Number of pulses |
| `cells` | array | Copy of cells array |
| `containers` | object | Container elements: `{grid, soundline, matrix, timeline}` |

## Interval System (Plug&Play)

The musical-grid module includes a **complete interval system** with bars and numbers that show the spaces between pulses/notes. All interval styles are included in `musical-grid.css` - no additional CSS imports needed.

### Enable Intervals

```javascript
const grid = createMusicalGrid({
  parent: document.getElementById('gridContainer'),
  notes: 12,
  pulses: 9,
  showIntervals: {
    horizontal: true,    // Show intervals on timeline (spaces between pulses)
    vertical: false      // Show intervals on soundline (spaces between notes)
  },
  intervalColor: '#4A9EFF'  // Custom color for interval bars/numbers
});
```

### Interval Highlighting During Playback (Native Support)

The musical-grid module now includes **native interval highlighting** - no external dependencies needed!

```javascript
// Simple one-line integration for playback
audio.play(totalPulses, intervalSec, selectedNotes, false,
  (pulseIndex) => {
    // Automatically highlights the correct interval bar
    grid.onPulseStep(pulseIndex, intervalSec * 1000);
  }
);

// Or use the low-level API for custom control
grid.highlightInterval('horizontal', 3, 500);  // Highlight interval 3 for 500ms
grid.clearIntervalHighlights('horizontal');     // Clear all horizontal highlights
```

### CSS Variables for Intervals

Customize interval appearance with CSS variables:

```css
:root {
  --interval-color: #4A9EFF;           /* Bar and number color */
  --interval-bar-height: 6px;          /* Bar height */
  --interval-bar-width: 6px;           /* Bar width (vertical) */
}
```

### What's Included

The `musical-grid.css` file includes all interval styles:
- ✅ Interval bars (horizontal and vertical)
- ✅ Interval numbers
- ✅ Active/highlight states for playback
- ✅ Dark theme support
- ✅ Transition animations

**No need to import `timeline-intervals.css`** - everything is in `musical-grid.css`.

## Scroll Mode

Enable scroll for grids larger than the viewport:

```javascript
const grid = createMusicalGrid({
  parent: document.getElementById('gridContainer'),
  notes: 24,           // More than viewport can show
  pulses: 16,
  scrollEnabled: true,
  containerSize: {
    width: '100%',
    maxHeight: '600px'
  },
  cellSize: {
    minWidth: 60,      // Fixed cell width when scrolling
    minHeight: 40      // Fixed cell height when scrolling
  }
});
```

### Scroll Features

- **Synchronized scroll** - Matrix, soundline, and timeline scroll together
- **Hidden scrollbars on axes** - Only matrix shows scrollbar
- **Inner expandible containers** - Content expands beyond viewport
- **Fixed cell sizing** - Cells maintain consistent size when scrolling
- **Smooth scrolling** - CSS `scroll-behavior: smooth` applied

### Scroll Synchronization

The module automatically synchronizes scroll between:
- **Matrix → Soundline** (vertical)
- **Matrix → Timeline** (horizontal)
- **Soundline → Matrix** (vertical)
- **Timeline → Matrix** (horizontal)

Prevents infinite loops using `requestAnimationFrame` debouncing.

## CSS Custom Properties

The module respects these CSS variables:

```css
:root {
  --line-color: #666;                    /* Grid lines */
  --soundline-width: 3px;                /* Vertical line width */
  --timeline-height: 2px;                /* Horizontal line height */
  --cell-highlight-color: #F97C39;       /* Cell hover/active */
  --pulse-marker-height: 15px;           /* Pulse marker lines */
  --note-highlight-color: #F97C39;       /* Note highlight */
  --select-color: #F97C39;               /* Global selection */
  --text-color: #333;                    /* Light theme text */
  --text-dark: #e0e0e0;                  /* Dark theme text */
  --text-light: #666;                    /* Secondary text */
  --z-base: 1;                           /* Z-index levels */
  --z-content: 5;
  --z-interactive: 10;
  --z-active: 15;
  --z-overlay: 20;
}
```

## Examples

### Basic Grid (No Scroll)

```javascript
const grid = createMusicalGrid({
  parent: document.getElementById('app'),
  notes: 12,
  pulses: 9,
  startMidi: 60,
  fillSpaces: true,
  onCellClick: (note, pulse) => {
    console.log(`Cell clicked: N${note} P${pulse}`);
  }
});
```

### Grid with Scroll (Large Grid)

```javascript
const grid = createMusicalGrid({
  parent: document.getElementById('app'),
  notes: 36,       // 3 octaves
  pulses: 32,      // 32 pulses
  scrollEnabled: true,
  containerSize: {
    width: '100%',
    maxHeight: '70vh'
  },
  cellSize: {
    minWidth: 50,
    minHeight: 35
  },
  onCellClick: (note, pulse) => {
    // Handle cell clicks...
  }
});
```

### Custom Formatters

```javascript
const grid = createMusicalGrid({
  parent: document.getElementById('app'),
  notes: 12,
  pulses: 8,
  noteFormatter: (index, midi) => {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return names[midi % 12];
  },
  pulseFormatter: (index) => `P${index}`
});
```

### Playback Highlighting

```javascript
// During playback, highlight active cell
audio.on('note', ({ note, pulse }) => {
  grid.highlight(note, pulse, 300);  // Highlight for 300ms
});

// Or manually clear all highlights
grid.clear();
```

### Dynamic Cell Rendering

```javascript
const grid = createMusicalGrid({
  parent: document.getElementById('app'),
  notes: 12,
  pulses: 9,
  cellRenderer: (noteIndex, pulseIndex, cellElement) => {
    // Custom cell content
    if (isActive(noteIndex, pulseIndex)) {
      cellElement.classList.add('active');
      cellElement.innerHTML = `<span>N${noteIndex}P${pulseIndex}</span>`;
    }
  }
});
```

## fillSpaces Mode

### fillSpaces: true (default)

Cells fill the **spaces BETWEEN** pulse markers:

```
Pulses:     0   1   2   3   4
Spaces:       [0] [1] [2] [3]
Cells:      4 cells (spaces 0-3)
```

Use this when pulses represent **boundaries** between cells.

### fillSpaces: false

Cells align **WITH** pulse markers:

```
Pulses:     0   1   2   3   4
Cells:     [0] [1] [2] [3] [4]
Cells:      5 cells (pulses 0-4)
```

Use this when pulses represent **positions** of cells.

## Responsive Breakpoints

- **Desktop**: > 1024px (default sizing)
- **Tablet**: ≤ 1024px (grid: 120px left column, 65vh height)
- **Mobile**: ≤ 768px (grid: 100px left column, 60vh height)
- **Small Mobile**: ≤ 480px (grid: 80px left column, minimal sizing)

## Dependencies

- None (standalone module)

## Integration Example (App12)

```javascript
// Apps/App12/main.js
import { createMusicalGrid } from '../../libs/musical-grid/index.js';
import '../../libs/musical-grid/musical-grid.css';

const grid = createMusicalGrid({
  parent: document.querySelector('.app12-main-grid'),
  notes: 12,
  pulses: 9,
  startMidi: 60,
  fillSpaces: true,
  onCellClick: (note, pulse, cell) => {
    toggleCell(note, pulse);
    updateAudio();
  }
});

// Sync with audio playback
audio.on('note', ({ note, pulse }) => {
  grid.highlight(note, pulse, 300);
});
```

## Maturity Level: 10/10

The `musical-grid` module is **production-ready** and fully modular:

- ✅ Complete API with scroll support
- ✅ Comprehensive test coverage (26 tests)
- ✅ CSS extracted to shared file
- ✅ Zero app-specific dependencies
- ✅ Backward compatible (scroll optional)
- ✅ Full JSDoc documentation
- ✅ Used successfully in App12

## File Structure

```
libs/musical-grid/
├── musical-grid.js         # Main module (565 lines)
├── musical-grid.css        # Shared styles (357 lines)
├── index.js                # Module exports
├── README.md               # This file
└── __tests__/
    └── musical-grid.test.js # 26 passing tests
```

## Migration Guide

If you have existing grid2D code in your app:

1. **Remove duplicate code** from your app's `main.js`
2. **Add import** at the top:
   ```javascript
   import { createMusicalGrid } from '../../libs/musical-grid/index.js';
   import '../../libs/musical-grid/musical-grid.css';
   ```
3. **Replace grid initialization** with `createMusicalGrid(config)`
4. **Update callback signatures** to match new API
5. **Test scroll mode** (optional) by adding `scrollEnabled: true`

## License

Part of the Lab monorepo rhythm applications suite.
