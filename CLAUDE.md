# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Setup and Environment
- **Initial setup**: `./setup.sh` - Run once per session to install dependencies and configure Git
- **Run tests**: `npm test` - Execute Jest test suite (24 test suites, 109 tests)
- **Run specific test**: `npm test -- --testNamePattern="test name"`
- **Serve files locally**: `npx http-server` - For testing with proper ES module support

## Project Architecture

This is a **monorepo** with **workspaces** for rhythm-based musical applications. The project focuses on temporal formulas, rhythmic fractions, and audio timing patterns.

### High-Level Structure
- **Apps/**: Individual rhythm applications (App1-App4, SoundGrid placeholder)
- **libs/**: Modular libraries for shared functionality
- **packages/**: Additional workspace packages

### Core Libraries (`libs/`)

#### **`libs/app-common/`** - Shared App Logic (32 modules)
Core initialization and management:
- **`audio-init.js`**: Standardized audio initialization with warning suppression
- **`app-init.js`**: Unified app initialization helper (deprecated in favor of modular approach)
- **`dom.js`**: DOM utilities and element binding with LED support
- **`led-manager.js`**: LED state management for rhythm parameters
- **`preferences.js`**: Centralized preference storage with factory reset support
- **`template.js`**: App template rendering system

Audio and timing:
- **`audio.js`**: Audio scheduling bridges and shared sound events (`createSchedulingBridge`, `bindSharedSoundEvents`)
- **`audio-schedule.js`**: Tap tempo resync delay calculations
- **`audio-toggles.js`**: Audio channel toggle management with mixer integration
- **`loop-control.js`**: Shared loop controllers (`createLoopController`, `createPulseMemoryLoopController`)
- **`subdivision.js`**: Temporal subdivision calculations (`fromLgAndTempo`, `gridFromOrigin`, `toPlaybackPulseCount`)
- **`timeline-layout.js`**: Timeline rendering utilities (circular/linear layouts)

UI components and interaction:
- **`fraction-editor.js`**: Reusable fraction editing components with full CRUD operations
- **`pulse-seq.js`**: Pulse sequence controller with drag selection and memory management
- **`mixer-menu.js`**: Audio mixer menu functionality with longpress support
- **`mixer-longpress.js`**: Longpress interaction for mixer controls
- **`random-menu.js`**: Randomization controls
- **`random-config.js`**: Random configuration management

Utilities:
- **`events.js`**: Standardized event binding utilities
- **`number.js`**: Safe number parsing utilities
- **`range.js`**: Range validation and clamping
- **`utils.js`**: Math utilities (font size, hit size calculations)

#### **`libs/shared-ui/`** - UI Components
- **`header.js`**: Common header with audio controls
- **`sound-dropdown.js`**: Sound selection dropdowns
- **`hover.js`**: Hover effect utilities
- **`index.css`**: Base styles (includes slider-vertical fix)

#### **`libs/sound/`** - Audio Engine
- **`index.js`**: Tone.js wrapper with TimelineAudio class
- **`mixer.js`**: Audio mixer functionality
- **`sample-map.js`**: Sound sample management

#### **`libs/notation/`** - Music Notation
- **VexFlow integration**: Staff notation rendering

#### **Other Libraries**
- **`libs/cards/`**: Interactive note-component cards
- **`libs/ear-training/`**: Audio training utilities
- **`libs/random/`**: Randomization utilities
- **`libs/utils/`**: General utilities
- **`libs/vendor/`**: Third-party libraries (Tone.js)

### New Modularization Patterns (2024)

#### **DOM Management**
```javascript
// Instead of multiple document.getElementById calls:
import { bindRhythmElements } from '../../libs/app-common/dom.js';

const { elements, leds, ledHelpers } = bindRhythmElements({
  inputLg: 'inputLg',
  inputV: 'inputV',
  ledLg: 'ledLg',
  // ... more elements
});

// LED state management:
ledHelpers.setLedAuto('Lg', true);
ledHelpers.setLedActive('V', false);
```

#### **App Initialization**
```javascript
import { initRhythmApp, createStandardElementMap } from '../../libs/app-common/app-init.js';

const { audio, schedulingBridge, elements, ledManagers } = await initRhythmApp({
  title: 'App Title',
  elementMap: createStandardElementMap({
    // additional elements specific to this app
  }),
  audioMapping: {
    baseSound: 'setBase',
    accentSound: 'setAccent'
  },
  templateConfig: {
    showSelectColor: true,
    randomMenuContent: '...'
  }
});
```

#### **Event Binding**
```javascript
import { bindRhythmAppEvents } from '../../libs/app-common/events.js';

bindRhythmAppEvents(elements, {
  numberInputs: {
    Lg: {
      onChange: () => handleLgChange(),
      onIncrement: () => incrementLg(),
      onDecrement: () => decrementLg()
    }
  },
  buttons: {
    playBtn: () => togglePlayback(),
    resetBtn: () => resetValues()
  },
  toggles: {
    loopBtn: {
      onToggle: () => toggleLoop(),
      getState: () => isLooping
    }
  }
});
```

#### **LED Management**
```javascript
import { createRhythmLEDManagers, syncLEDsWithInputs } from '../../libs/app-common/led-manager.js';

const ledManagers = createRhythmLEDManagers(leds);

// Update LED states
ledManagers.Lg.setAuto(true);
ledManagers.V.setActive(false);

// Sync with input elements
syncLEDsWithInputs(ledManagers, elements);
```

### Application Types

All apps share common architecture with rhythm parameters (Lg, V, T) and audio playback:

1. **App1**: Temporal Formula
   - Basic rhythm timeline with circular/linear visualization
   - Three-parameter system with auto-calculation (one auto, two manual)
   - Tap tempo with resync capability
   - Features: Loop, random parameter generation, theme switching

2. **App2**: Pulse Sequence Editor
   - Editable pulse patterns with contenteditable sequence field
   - Pulse memory persistence across Lg changes
   - Drag selection for rapid pattern creation
   - Synchronized timeline scrolling with visual highlighting
   - Mixer controls for pulse/accent channels
   - Features: Auto-sync between text field and visual timeline

3. **App3**: Fraction Editor
   - Complex rhythm fraction editing (n/d subdivisions)
   - Visual cycle markers on timeline
   - Dedicated fraction editor component with validation
   - Cycle audio with subdivision tracking
   - Features: Integer cycles, fractional pulses, visual subdivision labels

4. **App4**: Multi-Fraction Selection (READ.md available)
   - Advanced fraction management with multiple selections
   - Detailed implementation documented in Apps/App4/README.md
   - Complex pattern generation capabilities

## 🚨 **CRITICAL DEVELOPMENT PRINCIPLES**

### **ALWAYS PRIORITIZE SHARED COMPONENTS**

When implementing new features or fixing bugs, **ALWAYS** follow this hierarchy:

1. **🔍 FIRST**: Check if a shared component already exists in `libs/app-common/`
2. **🛠️ SECOND**: If no shared component exists, create one that can be reused
3. **❌ LAST RESORT**: Only implement app-specific code when truly necessary

### **Modular Component Usage Examples**

#### **Loop Controllers** ⭐ NEW
```javascript
// ✅ CORRECT: Use shared loop controller
import { createPulseMemoryLoopController } from '../../libs/app-common/loop-control.js';

const loopController = createPulseMemoryLoopController({
  audio: { setLoop: (enabled) => audio?.setLoop?.(enabled) },
  loopBtn: elements.loopBtn,
  state: { get loopEnabled() { return loopEnabled; }, set loopEnabled(v) { loopEnabled = v; } },
  ensurePulseMemory,
  getLg: () => parseInt(inputLg.value),
  isPlaying: () => isPlaying,
  onToggle: (enabled) => {
    syncSelectedFromMemory();
    updateNumbers();
    // app-specific callback logic
  }
});
loopController.attach();

// ❌ WRONG: Manual loop button event listeners
loopBtn.addEventListener('click', () => {
  loopEnabled = !loopEnabled;
  // This creates duplicate code and potential audio sync bugs
});
```

#### **Bug Fix Priority**
When fixing bugs that affect multiple apps:

1. **Create shared component** that handles the bug properly
2. **Migrate all affected apps** to use the shared component
3. **Verify consistent behavior** across all apps

### **Testing Shared Components**

All shared components MUST have corresponding tests. Current test coverage:

**Test locations**:
- `libs/app-common/__tests__/` - Core app-common tests (subdivision, audio, fraction-editor, etc.)
- `tests/` - Legacy tests and integration tests
- 24 test suites, 109 passing tests

**Key test files**:
- `libs/app-common/__tests__/subdivision.test.js` - Temporal calculations
- `libs/app-common/__tests__/audio.test.js` - Audio bridges and scheduling
- `libs/app-common/__tests__/fraction-editor.test.js` - Fraction editing logic
- `libs/app-common/__tests__/audio-toggles.test.js` - Toggle state management
- `libs/app-common/__tests__/loop-resize.test.js` - Loop resizing behavior
- `libs/app-common/__tests__/tap-resync.test.js` - Tap tempo resync logic
- `libs/app-common/loop-control.test.js` - Loop controller components
- `libs/app-common/range.test.js` - Range validation
- `libs/app-common/utils.test.js` - Math utilities

Before creating new shared components:
1. **Check existing tests**: `npm test`
2. **Create test file**: `libs/app-common/__tests__/[component-name].test.js`
3. **Test critical paths**: Audio sync, DOM management, state persistence, edge cases

### **Technical Architecture**

#### **Module System**
- **ES6 modules** throughout with **type: "module"** in package.json
- **Workspace dependencies** managed by npm
- **Tone.js** loaded globally before module scripts

#### **State Management**
- **Plain JavaScript objects** for app state
- **Preference storage** via `libs/app-common/preferences.js`
- **Local storage** for persistent settings

#### **Audio Architecture**
- **TimelineAudio class** for scheduled playback
- **Scheduling bridges** for mobile/desktop optimization
- **Mixer system** for multi-sound management
- **AudioContext warnings** handled gracefully

#### **LED System**
- **Auto/Manual states** for rhythm parameters (Lg, V, T)
- **Visual feedback** via CSS classes
- **Click handlers** for toggling states
- **Synchronized state** between LEDs and inputs

### Development Patterns

#### **Creating New Apps**

**Modern modular approach** (recommended for all new apps):
1. Use `bindAppRhythmElements('appN')` from `dom.js` to bind DOM elements
2. Use `createRhythmAudioInitializer()` from `audio-init.js` for audio setup
3. Use `createSchedulingBridge()` and `bindSharedSoundEvents()` from `audio.js`
4. Use specialized controllers:
   - `createPulseMemoryLoopController()` for loop management
   - `createFractionEditor()` for fraction inputs
   - `createPulseSeqController()` for pulse sequence editing
5. Import utilities from `libs/app-common/` as needed

**Legacy monolithic approach** (being phased out):
- `initRhythmApp()` from `app-init.js` (deprecated)
- `createStandardElementMap()` (deprecated)
- `bindRhythmAppEvents()` (deprecated)

The modular approach provides better tree-shaking, clearer dependencies, and easier testing.

#### **Common Element IDs**
Standard rhythm apps use these element IDs:
- **Inputs**: `inputLg`, `inputV`, `inputT`
- **Controls**: `inputLgUp`, `inputLgDown`, etc.
- **LEDs**: `ledLg`, `ledV`, `ledT`
- **Buttons**: `playBtn`, `loopBtn`, `resetBtn`
- **Random**: `randLgToggle`, `randLgMin`, `randLgMax`

#### **Audio Initialization**
- Use `createRhythmAudioInitializer()` to handle audio context warnings
- Audio context starts only on user interaction (no warnings on page load)
- Scheduling profiles auto-detected (mobile/desktop)
- Sound selection handled by shared header (`header.js`)
- Mixer integration via `initMixerMenu()` and `initAudioToggles()`
- Tap tempo with resync capability via `computeResyncDelay()`

#### **CSS and Styling**
- **Base styles**: `libs/shared-ui/index.css`
- **App-specific styles**: `Apps/AppX/styles.css`
- **Theme support**: `data-theme` attribute
- **Deprecated warnings fixed**: slider-vertical replaced with writing-mode

### Testing

Test infrastructure:
- **Jest 29.x** with Node.js environment (`testEnvironment: 'node'`)
- **ES modules** support via experimental VM modules
- **24 test suites**, 109 passing tests
- **Test locations**:
  - `libs/app-common/__tests__/` - Core shared component tests
  - `libs/sound/*.test.js` - Audio engine tests
  - `libs/random/*.test.js`, `libs/utils/*.test.js` - Utility tests
  - `tests/` - Legacy integration and domain-specific tests

**Test patterns**:
- Unit tests for pure functions (subdivision, range, number parsing)
- Integration tests for complex components (fraction-editor, pulse-seq)
- Audio behavior tests (audio-toggles, loop-control, tap-resync)
- Edge case validation (loop-resize, audio-schedule)

### Console Warnings Resolution

#### **Fixed Issues**
1. **slider-vertical deprecation**: Replaced with `writing-mode: vertical-lr; direction: rtl`
2. **AudioContext warnings**: Deferred audio start until user interaction
3. **Tone.js startup**: Graceful handling of context state

#### **Best Practices**
- Never call `Tone.start()` automatically on page load
- Use `ensureAudioSilent()` for warning-free audio checks
- Handle audio context state in user interaction handlers

### Scaling and Code Reuse

#### **Current Modularization Achievements**
- **~70% code reduction** vs. monolithic apps
- **32 shared modules** in `libs/app-common/`
- **DOM queries**: Centralized through `bindAppRhythmElements()`
- **Audio**: Unified initialization via `createRhythmAudioInitializer()`
- **State management**: Shared preference storage and factory reset
- **UI components**: Reusable controllers (fraction-editor, pulse-seq, loop-control)

#### **Shared Components Status**
✅ **Production-ready**:
- Audio initialization and scheduling
- DOM element binding
- LED management
- Loop controllers (basic, rhythm, pulse-memory variants)
- Fraction editor with validation
- Pulse sequence editor with drag selection
- Mixer menu and audio toggles
- Random parameter generation
- Timeline layout (circular/linear)
- Tap tempo with resync
- Preference storage with factory reset

🚧 **In development** (see `libs/app-common/AGENTS.md`):
- Advanced subdivision rendering
- Multi-app state synchronization

#### **Development Speed**
- **New app from scratch**: 4-6 hours (with mature patterns)
- **New feature in existing app**: 1-2 hours
- **Legacy refactor to modular**: 2-3 hours per app

#### **Recommended Patterns**
1. **Start with bindAppRhythmElements()** for DOM access
2. **Use specialized controllers** instead of manual event listeners
3. **Import only what you need** for better tree-shaking
4. **Test shared components** before app-specific logic
5. **Document new patterns** in AGENTS.md for future apps

### File Organization
- **App structure**: HTML + styles.css + main.js + utils.js (re-export)
- **Shared code**: Factored into `libs/app-common/`
- **Utils pattern**: Apps re-export from `libs/app-common/utils.js`
- **Import paths**: Relative imports from app to libs

### Key Dependencies
- **Tone.js 15.x**: Audio synthesis and timing
- **VexFlow 5.0.0**: Music notation rendering
- **Jest 29.x**: Testing framework
- **ES2022**: Modern JavaScript features