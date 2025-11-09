# matrix-seq - Matrix Sequencer Components

Reusable components for editing and displaying Note-Pulse (N-P) pairs in grid layouts.

## Components

### `grid-editor.js` - Dynamic Grid Editor

A fully encapsulated, production-ready component for editing N-P pairs with dynamic columns.

#### Features

- ✅ **Dynamic columns** - One column per pulse, created on demand
- ✅ **Multi-voice support** - Polyphony/monophony modes
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

#### CSS Custom Properties

The grid-editor respects these CSS variables:

- `--notes-height`: Dynamic height (calculated by module)
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
- ✅ Flexible configuration
- ✅ CSS extracted to shared file
- ✅ Zero app-specific dependencies
- ✅ Comprehensive JSDoc documentation
- ✅ Used successfully in App12

## File Structure

```
libs/matrix-seq/
├── grid-editor.js       # Main component (945 lines)
├── grid-editor.css      # Shared styles (258 lines)
├── index.js             # Module exports
└── README.md            # This file
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
