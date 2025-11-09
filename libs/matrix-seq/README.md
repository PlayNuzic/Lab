# matrix-seq - Matrix Sequencer Components

Reusable components for editing and displaying Note-Pulse (N-P) pairs in grid layouts.

## Components

### `grid-editor.js` - Dynamic Grid Editor

A fully encapsulated, production-ready component for editing N-P pairs with dynamic columns.

#### Features

- ✅ **Dynamic columns** - One column per pulse, created on demand
- ✅ **Multi-voice support** - Polyphony/monophony modes
- ✅ **Scroll support** - Optional horizontal/vertical scroll for large grids (>8 pairs)
- ✅ **Auto-jump navigation** - 300ms delay allows two-digit input
- ✅ **Auto-blur on P=7** - Closes last pulse without blocking note entry
- ✅ **Auto-merge duplicates** - Merges notes when duplicate pulses detected
- ✅ **Auto-sort columns** - Visual reorganization when pulse order changes
- ✅ **Keyboard navigation** - Arrow keys, Tab, Enter, Backspace
- ✅ **Range validation** - Contextual tooltips for out-of-range values
- ✅ **Playback highlight** - Sync visual feedback during playback
- ✅ **Responsive design** - 4 breakpoints (desktop → mobile)

#### Quick Start

```javascript
// 1. Import module and CSS
import { createGridEditor } from '../../libs/matrix-seq/index.js';
import '../../libs/matrix-seq/grid-editor.css';

// 2. HTML container
// <div id="editorContainer"></div>

// 3. Initialize
const editor = createGridEditor({
  container: document.getElementById('editorContainer'),
  noteRange: [0, 11],      // Optional: valid note range
  pulseRange: [0, 7],      // Optional: valid pulse range
  maxPairs: 8,             // Optional: max N-P pairs
  getPolyphonyEnabled: () => true, // Optional: polyphony mode
  onPairsChange: (pairs) => {
    console.log('Pairs changed:', pairs);
    // Sync with audio, storage, etc.
  }
});

// 4. Use API
editor.setPairs([
  { note: 5, pulse: 0 },
  { note: 7, pulse: 2 }
]);

// Highlight during playback
editor.highlightCell(5, 2);
setTimeout(() => editor.clearHighlights(), 300);

// Clear all
editor.clear();
```

#### API Reference

| Method | Description |
|--------|-------------|
| `render(pairs)` | Re-render grid with new pairs |
| `getPairs()` | Get current pairs array |
| `setPairs(pairs)` | Set pairs programmatically |
| `clear()` | Clear all inputs |
| `highlightCell(row, col)` | Highlight cell at (note, pulse) |
| `clearHighlights()` | Clear all highlights |

#### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `container` | HTMLElement | **required** | Container element |
| `noteRange` | [number, number] | `[0, 11]` | Valid note range [min, max] |
| `pulseRange` | [number, number] | `[0, 7]` | Valid pulse range [min, max] |
| `maxPairs` | number | `8` | Maximum N-P pairs allowed |
| `getPolyphonyEnabled` | Function | `() => true` | Function returning polyphony state |
| `onPairsChange` | Function | `() => {}` | Callback when pairs change |
| `scrollEnabled` | boolean | `false` | Enable horizontal/vertical scroll for large grids |
| `containerSize` | Object | `null` | Fixed container size: `{width, height, maxWidth, maxHeight}` |
| `columnSize` | Object | `null` | Fixed column size in scroll mode: `{width, minHeight}` |

#### CSS Custom Properties

The grid-editor respects these CSS variables:

- `--notes-height`: Dynamic height (calculated by module)
- `--column-width`: Fixed column width in scroll mode (optional)
- `--column-min-height`: Fixed column min-height in scroll mode (optional)
- `--select-color`: Highlight/accent color (default: `#F97C39`)
- `--text-color`: Main text color (default: `#333`)
- `--text-dark`: Dark theme text color (default: `#e0e0e0`)

#### Dependencies

- `libs/app-common/info-tooltip.js` - For validation tooltips

#### Interaction Behavior

**Auto-jump:**
- After entering a valid digit, waits 300ms before jumping to next field
- Allows entering two-digit numbers (e.g., "11")
- Jump destination: next column's first empty note input

**Auto-blur on P=7:**
- When entering pulse 7 (last valid pulse), auto-blurs pulse input
- Does NOT auto-jump to note input
- User can manually click note input to add notes
- Notes sync correctly with external systems via `onPairsChange`

**Auto-merge duplicates:**
- Detects duplicate pulse columns automatically
- Merges notes from duplicate into existing column
- Shows tooltip: "El Pulso X ya existe"
- Jumps to next column after merge

**Auto-sort:**
- Detects when pulse order changes
- Reorganizes columns visually (left-to-right by pulse value)
- Shows tooltip: "Ordenando Pulsos"

#### Responsive Breakpoints

- **Desktop**: > 1024px (default sizing)
- **Tablet**: ≤ 1024px (slightly smaller fonts)
- **Mobile**: ≤ 768px (compact layout)
- **Small Mobile**: ≤ 480px (minimal sizing)

#### Scroll Mode

Enable scroll for grids with more than 8 N-P pairs or for apps that need many voices in polyphony mode:

```javascript
const editor = createGridEditor({
  container: document.getElementById('editorContainer'),
  noteRange: [0, 11],
  pulseRange: [0, 15],      // 16 pulses (0-15)
  maxPairs: 16,              // Allow 16 columns
  scrollEnabled: true,       // Enable scroll
  containerSize: {
    width: '100%',
    maxHeight: '500px'       // Fixed max height
  },
  columnSize: {
    width: '100px',          // Fixed column width
    minHeight: '250px'       // Fixed min height
  },
  onPairsChange: (pairs) => {
    console.log('Pairs:', pairs);
  }
});
```

**Scroll Features:**
- **Horizontal scroll** - Columns scroll left/right when content exceeds container width
- **Fixed column sizing** - Columns maintain consistent size (no wrapping)
- **Smooth scrolling** - CSS `scroll-behavior: smooth` applied
- **Backward compatible** - Scroll disabled by default (scrollEnabled: false)
- **Custom scrollbar** - Styled scrollbar with light/dark theme support

**Use Cases:**
- Apps with >8 pairs (e.g., 16-step sequencers)
- Polyphony mode with many voices per pulse
- Small screens that need more pairs
- Future apps with extended pulse ranges

#### Example: App12 Usage

```javascript
// Apps/App12/main.js
import { createGridEditor } from '../../libs/matrix-seq/index.js';
import '../../libs/matrix-seq/grid-editor.css';

let polyphonyEnabled = false;

const editor = createGridEditor({
  container: document.getElementById('gridEditorContainer'),
  noteRange: [0, 11],
  pulseRange: [0, 7],
  maxPairs: 8,
  getPolyphonyEnabled: () => polyphonyEnabled,
  onPairsChange: (pairs) => {
    // Sync with grid2D visual
    syncGridFromPairs(pairs);

    // Save to preferences
    savePreferences({ pairs });
  }
});

// Toggle polyphony mode
document.getElementById('polyphonyToggle').addEventListener('click', () => {
  polyphonyEnabled = !polyphonyEnabled;
});

// Playback sync
audio.on('note', ({ note, pulse }) => {
  editor.highlightCell(note, pulse);
  setTimeout(() => editor.clearHighlights(), 300);
});
```

## Maturity Level: 10/10

The `grid-editor.js` module is **production-ready** and fully modular:

- ✅ All interaction logic encapsulated
- ✅ Clear, documented API
- ✅ Flexible configuration with scroll support
- ✅ CSS extracted to shared file
- ✅ Zero app-specific dependencies
- ✅ Comprehensive JSDoc documentation
- ✅ Full test coverage (24 tests including scroll)
- ✅ Used successfully in App12
- ✅ Backward compatible (scroll optional)

## File Structure

```
libs/matrix-seq/
├── grid-editor.js           # Main component (985 lines)
├── grid-editor.css          # Shared styles (320 lines)
├── index.js                 # Module exports
├── README.md                # This file
└── __tests__/
    └── grid-editor.test.js  # 24 passing tests (includes scroll)
```

## Migration Guide

If you have existing grid-editor CSS in your app styles:

1. **Remove duplicate CSS** from your app's `styles.css`
2. **Add import** at the top of your `styles.css`:
   ```css
   @import url('../../libs/matrix-seq/grid-editor.css');
   ```
3. **No JS changes required** - the module API remains unchanged

## License

Part of the Lab monorepo rhythm applications suite.
