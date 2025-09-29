# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Setup and Testing
- **Run tests**: `npm test` - Execute Jest test suite with experimental VM modules
- **Run specific test**: `npm test -- --testNamePattern="test name"`

## Project Architecture

This is a **monorepo** with **workspaces** for rhythm-based musical applications. The project focuses on temporal formulas, rhythmic fractions, and audio timing patterns.

### High-Level Structure
- **Apps/**: Individual rhythm applications (App1-App4, SoundGrid placeholder)
- **libs/**: Modular libraries for shared functionality
- **packages/**: Additional workspace packages

### Core Libraries (`libs/`)

#### **`libs/app-common/`** - Shared App Logic
- **`app-init.js`**: Unified app initialization helper
- **`dom.js`**: DOM utilities and element binding with LED support
- **`led-manager.js`**: LED state management for rhythm parameters
- **`events.js`**: Standardized event binding utilities
- **`audio.js`**: Audio scheduling bridges and shared sound events
- **`loop-control.js`**: **NEW** - Shared loop controllers for consistent audio sync
- **`template.js`**: App template rendering system
- **`utils.js`**: Math utilities (font size, hit size calculations)
- **`preferences.js`**: Centralized preference storage
- **`fraction-editor.js`**: Reusable fraction editing components
- **`mixer-menu.js`**: Audio mixer menu functionality
- **`random-menu.js`**: Randomization controls
- **`subdivision.js`**: Temporal subdivision calculations
- **`timeline-layout.js`**: Timeline rendering utilities

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

1. **App1**: Temporal Formula - Basic rhythm timeline
2. **App2**: Pulse Sequence - Editable pulse patterns
3. **App3**: Fraction Editor - Complex rhythm fraction editing
4. **App4**: Multi-Fraction Selection - Advanced fraction management
5. **SoundGrid**: Placeholder for future grid-based sound app

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

All shared components MUST have corresponding tests in `/tests/`. Before creating new shared components:

1. **Check existing tests**: `npm test`
2. **Create test file**: `tests/[component-name].test.js`
3. **Test critical paths**: Audio sync, DOM management, state persistence

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
1. Use `initRhythmApp()` for consistent setup
2. Define element map with `createStandardElementMap()`
3. Use `bindRhythmAppEvents()` for event handling
4. Import utilities from `libs/app-common/`

#### **Common Element IDs**
Standard rhythm apps use these element IDs:
- **Inputs**: `inputLg`, `inputV`, `inputT`
- **Controls**: `inputLgUp`, `inputLgDown`, etc.
- **LEDs**: `ledLg`, `ledV`, `ledT`
- **Buttons**: `playBtn`, `loopBtn`, `resetBtn`
- **Random**: `randLgToggle`, `randLgMin`, `randLgMax`

#### **Audio Initialization**
- Use `initRhythmApp()` to handle audio context warnings
- Audio context starts only on user interaction
- Scheduling profiles auto-detected (mobile/desktop)

#### **CSS and Styling**
- **Base styles**: `libs/shared-ui/index.css`
- **App-specific styles**: `Apps/AppX/styles.css`
- **Theme support**: `data-theme` attribute
- **Deprecated warnings fixed**: slider-vertical replaced with writing-mode

### Testing
- **Jest** with jsdom environment
- **ES modules** support via NODE_OPTIONS
- **Test files**: `libs/app-common/__tests__/` and `*.test.js`

### Console Warnings Resolution

#### **Fixed Issues**
1. **slider-vertical deprecation**: Replaced with `writing-mode: vertical-lr; direction: rtl`
2. **AudioContext warnings**: Deferred audio start until user interaction
3. **Tone.js startup**: Graceful handling of context state

#### **Best Practices**
- Never call `Tone.start()` automatically on page load
- Use `ensureAudioSilent()` for warning-free audio checks
- Handle audio context state in user interaction handlers

### Scaling to 30+ Apps

#### **Current Efficiency Gains**
- **60-70% reduction** in duplicate code
- **DOM queries**: Centralized through `bindRhythmElements()`
- **Event handling**: Standardized patterns
- **Initialization**: One-line app setup

#### **Future App Categories**
- **Distance apps**: Will use `libs/app-common/distance-calculator.js` (TBD)
- **Multi-cycle apps**: Will use `libs/app-common/multi-cycle.js` (TBD)
- **Sound apps**: Already supported with mixer, random controls, and audio engine

#### **Development Speed**
- **Current apps**: 2-3 days per app
- **With new utilities**: 4-6 hours per app
- **Mature patterns**: 1-2 hours per app

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