# App5 "Pulsaciones" - Implementation Plan & Progress Tracker

**Created**: 2025-10-09
**Status**: 🟡 In Progress
**Last Updated**: 2025-10-09

---

## 📋 Table of Contents

1. [Core Concepts](#core-concepts)
2. [Implementation Phases](#implementation-phases)
3. [Testing Matrix](#testing-matrix)
4. [Files to Modify](#files-to-modify)
5. [Implementation Log](#implementation-log)
6. [Known Issues & Fixes](#known-issues--fixes)

---

## 🎯 Core Concepts

### The Interval Paradigm Shift

**Current State (App2)**: Pulse selection
- Selectable entities: Pulses (indices 1 to Lg-1)
- State: `pulseMemory` array

**Target State (App5)**: Interval selection
- Selectable entities: Intervals (numbered 1 to Lg)
- State: `intervalMemory` array
- Pulses: Visual markers only (non-interactive)

### Mathematical Foundation

**Lg parameter represents BOTH**:
- The number/index of the last pulse (pulse Lg)
- The total count of intervals (Lg intervals)

**Example: Lg = 3**
```
Pulses:    0 ──── 1 ──── 2 ──── 3
           ↑      ↑      ↑      ↑
           zero                 lg

Intervals:   [  1  ] [  2  ] [  3  ]
             (0→1)   (1→2)   (2→3)
```

**Key Properties**:
- **Pulses rendered**: 0, 1, 2, 3, ..., Lg
- **Pulse 0**: Neutral starting point (doesn't "count" as adding an interval)
- **Total intervals**: Lg (exactly)
- **Interval k**: Connects pulse (k-1) to pulse k
- **Valid P sequence range**: 1 ≤ n ≤ Lg

---

## 🚀 Implementation Phases

### Phase 1: State Management Refactoring
**Goal**: Replace `pulseMemory` with `intervalMemory` throughout App5

- [x] 1.1 Rename global state variables
  - [x] `pulseMemory` → `intervalMemory`
  - [x] `selectedPulses` → `selectedIntervals`
  - [x] `pulseMemoryApi` → `intervalMemoryApi`
  - [x] `clearPersistentPulses` → `clearPersistentIntervals`
- [x] 1.2 Update `ensurePulseMemory` → `ensureIntervalMemory`
  - [x] Array size: `lg + 1` (indices 1 to Lg)
  - [x] All references updated (10+ occurrences)
- [x] 1.3 Update `selectedForAudioFromState()`
  - [x] Loop already correct: `i = 1; i <= lg` (inclusive)
  - [x] Uses `intervalMemory[i]` ✓
- [x] 1.4 Update all array operations
  - [x] Random generation logic (line 714, 734): `i <= lg`
  - [x] P sequence parsing (line 1107): `i <= lg` ✓
  - [x] updatePulseSeqField (line 1238): `i <= lg`
  - [x] Updated comments to use "intervals" terminology
- [x] 1.5 Test: No runtime errors after renaming

**Status**: ✅ Complete

---

### Phase 2: Remove Pulse Interactivity
**Goal**: Simplify timeline - pulses become visual markers only

- [x] 2.1 Modify `renderTimeline()` function (~line 1329)
  - [x] Changed pulse loop: `for (let i = 0; i <= lg; i++)` - now includes pulse 0!
  - [x] Removed all pulse click handlers
  - [x] Removed all hit target creation
  - [x] Added `.zero` class for pulse 0, kept `.lg` for pulse Lg
- [x] 2.2 Clean up remnants
  - [x] Removed `pulseHits` array declaration
  - [x] Deleted `togglePulse()` function
  - [x] Commented out `dragController.attach()` (will reconfigure in Phase 4)
  - [x] Removed `pulseHits` positioning in circular/linear callbacks
  - [x] Removed `.selected` class application in `syncSelectedFromMemory()`
- [x] 2.3 Test: Pulses render but are non-interactive

**Status**: ✅ Complete

---

### Phase 3: Interval Rendering - Always All Lg Intervals
**Goal**: Refactor interval system to always render all intervals

#### 3.1 Refactor it-calculator.js
- [x] Create `calculateAllIntervals(lg)` function
  - [x] Returns array of Lg interval objects
  - [x] Each object: `{ number, startPulse, endPulse }`
  - [x] Interval k: `{ number: k, startPulse: k-1, endPulse: k }`
  - [x] Comprehensive JSDoc with examples
- [x] Mark old `calculateIntervals` as deprecated
- [x] Test: Function returns correct Lg intervals

#### 3.2 Rewrite it-renderer.js
- [x] Update `createIntervalRenderer` config
  - [x] Add `getSelectedIntervals` callback
  - [x] Add `onIntervalClick` callback
- [x] Implement `render()` function
  - [x] Always render all Lg intervals
  - [x] Apply `.selected` class based on selection state
  - [x] Add click handlers to interval blocks
- [x] Implement `createIntervalBlock()`
  - [x] Create div with class `interval-block`
  - [x] Add data attributes: `intervalNumber`, `startPulse`, `endPulse`
  - [x] Add centered number label (`.interval-number`)
  - [x] Attach click handler
  - [x] Add pointerenter for drag support
- [x] Implement `updateLinearPositions()`
  - [x] Position between `startPulse` and `endPulse`
  - [x] Center horizontally: `(startPercent + endPercent) / 2`
  - [x] Fixed vertical: `top: -32px`
  - [x] Width: percentage of interval span
- [x] Implement `updateCircularPositions()`
  - [x] Calculate mid-angle between pulses
  - [x] Offset outward from circle (20px)
  - [x] Rotate to align with arc
- [x] Implement `updateSelection()`
  - [x] Update `.selected` class without full re-render
- [x] Add `setDragEnterHandler()` for drag support
- [x] Test: All Lg intervals render in linear mode

#### 3.3 Update it-styles.css
- [x] Set interval block height to 24px (3x original ~8px)
- [x] Unselected opacity: 0.25 (very subtle)
- [x] Selected opacity: 0.8 (clearly visible)
- [x] Linear positioning: `top: -32px` (fixed above timeline)
- [x] Add hover effects (scale 1.05, opacity 0.9)
- [x] Style interval number labels (centered, white, text-shadow)
- [x] Add circular layout rules (border-radius 12px, transform-origin)
- [x] Add timeline margin-top: 40px for interval space
- [x] Add responsive media queries
- [x] Test: Intervals positioned above timeline

#### 3.4 Update it-index.js
- [x] Export `calculateAllIntervals` as primary function
- [x] Mark `calculateIntervals` as deprecated
- [x] Update barrel exports with comments
- [x] Test: Imports work correctly

#### 3.5 Update App5/main.js configuration
- [x] Update intervalRenderer config with new parameters
- [x] Set `onIntervalClick: null` (for Phase 4)

**Status**: ✅ Complete

---

### Phase 4: Interval Selection Logic
**Goal**: Make intervals clickable and draggable

- [x] 4.1 Add `handleIntervalClick(intervalNumber)` function
  - [x] Validate interval number (1 to Lg)
  - [x] Toggle `intervalMemory[intervalNumber]`
  - [x] Update `selectedIntervals` Set
  - [x] Call `intervalRenderer.updateSelection()`
  - [x] Update pulse sequence display
  - [x] Update audio if playing
- [x] 4.2 Initialize interval renderer
  - [x] Pass `getLg`, `isCircular`, `getSelectedIntervals`
  - [x] Pass `onIntervalClick: handleIntervalClick`
- [x] 4.3 Setup drag selection
  - [x] Configure `dragController.attach()` for intervals
  - [x] `resolveTarget`: Find `.interval-block`, return `{ key, intervalNumber }`
  - [x] `applySelection`: Update `intervalMemory[intervalNumber]` and Set
  - [x] `isSelectionActive`: Check `intervalMemory[intervalNumber]`
  - [x] `onDragEnd`: Update displays and audio
  - [x] Connect `intervalRenderer.setDragEnterHandler()`
- [x] 4.4 Verify `syncSelectedFromMemory()` already correct
  - [x] Uses `intervalMemory` and `selectedIntervals` ✓
  - [x] Loop: `i = 1; i <= maxIdx` ✓
  - [x] No ephemeral endpoints ✓
- [x] 4.5 Test: Clicking intervals toggles selection
- [x] 4.6 Test: Dragging across intervals works

**Status**: ✅ Complete

---

### Phase 5: Pulse Sequence (P) Editing
**Goal**: Integrate editable P field with sanitization

- [x] 5.1 Add `sanitizePulseSequence(text, lg)` to pulse-seq-intervals.js
  - [x] Split by whitespace, parse integers
  - [x] Filter: `1 <= n <= lg`
  - [x] Remove duplicates, sort
  - [x] Export function
- [x] 5.2 Create `handlePulseSeqInput()` in App5/main.js
  - [x] Import `sanitizePulseSequence`
  - [x] Parse text, get valid intervals
  - [x] Reset all intervals: `intervalMemory[i] = false`
  - [x] Mark valid intervals: `intervalMemory[i] = true`
  - [x] Update display with sanitized values
  - [x] Update `selectedIntervals` Set
  - [x] Re-render intervals
  - [x] Update audio if playing
  - [x] Preserve caret positioning
  - [x] Show error tooltips for invalid numbers
- [x] 5.3 Attach handler to event listeners
  - [x] keydown (Enter): calls handlePulseSeqInput
  - [x] blur: calls handlePulseSeqInput
- [x] 5.4 Update `updatePulseSeqField()`
  - [x] Already correctly collects intervals 1 to Lg
  - [x] Format and display working
- [x] 5.5 Update Lg suffix display
  - [x] Already shows Lg value in `.lg` span
- [x] 5.6 Remove old `sanitizePulseSeq()` function
  - [x] Replaced with shared module approach
- [x] 5.7 Test: Typing "1 3 5" selects correct intervals
- [x] 5.8 Test: Invalid numbers are filtered out

**Status**: ✅ Complete

---

### Phase 6: Audio Integration - Intervalo 1
**Goal**: Add optional separate sound for interval 1

- [x] 6.1 Verify template.js includes checkbox
  - ✅ Checkbox `#startIntervalToggle` exists at line 161 of template.js
  - ✅ Sound select `#startSoundSelect` exists at line 166
  - ✅ CSS styles for `.interval-select-row.enabled` already in styles.css
- [x] 6.2 Wire up checkbox in App5/main.js
  - ✅ Added `startIntervalToggle` to element binding (line 50)
  - ✅ Extracted element in destructuring (line 100)
  - ✅ Added checkbox change event listener (lines 884-918)
  - ✅ Toggle `.enabled` class on `.interval-select-row` based on checkbox state
- [x] 6.3 Leverage existing pulso0 infrastructure
  - ✅ TimelineAudio already has `pulso0` player for step 0 (interval 1)
  - ✅ `setStart()` method sets both `start` and `pulso0` sounds
  - ✅ No need to modify core audio engine
- [x] 6.4 Implement custom sound event handling
  - ✅ Added `sharedui:sound` event listener (lines 96-119)
  - ✅ When checkbox checked: startSound applies to pulso0
  - ✅ When checkbox unchecked: pulso0 matches pulso (base sound)
  - ✅ Base sound changes update pulso0 when checkbox unchecked
- [x] 6.5 Test functionality
  - ✅ Checkbox controls visibility of startSoundSelect dropdown
  - ✅ Checkbox controls which sound plays for interval 1 (step 0)
  - ✅ Proper synchronization with dropdown changes

**Status**: ✅ Complete (Commit: 722d6c1)

---

### Phase 7: Visual Polish & Positioning
**Goal**: Clean up visuals, remove pulse numbers, finalize styles

- [ ] 7.1 Remove pulse numbering from App5/main.js
  - [ ] Delete `updateNumbers()` function
  - [ ] Remove all calls to `updateNumbers()`
  - [ ] Delete `showNumber()` function
  - [ ] Remove `.pulse-number` element creation
  - [ ] Delete pulse number positioning code
- [ ] 7.2 Update App5/styles.css
  - [ ] Remove all `.pulse-number` styles
  - [ ] Simplify `.pulse` styles (non-interactive)
  - [ ] Keep `.pulse.zero` and `.pulse.lg` distinctions
- [ ] 7.3 Finalize it-styles.css
  - [ ] Confirm 24px height
  - [ ] Confirm `-32px` top position in linear mode
  - [ ] Add timeline margin-top to accommodate intervals
- [ ] 7.4 Add timeline-layout.js callback hook
  - [ ] Add `onAfterLayout` callback in timeline-layout.js
  - [ ] Call `intervalRenderer.updatePositions()` after layout changes
  - [ ] Pass callback from App5/main.js
- [ ] 7.5 Test: No pulse numbers visible
- [ ] 7.6 Test: Interval numbers visible and centered
- [ ] 7.7 Test: Layout transitions are smooth

**Status**: ⬜ Not Started

---

### Phase 8: Testing & Validation
**Goal**: Comprehensive testing before declaring complete

See [Testing Matrix](#testing-matrix) below for detailed test cases.

- [ ] 8.1 Run all basic rendering tests
- [ ] 8.2 Run all interval selection tests
- [ ] 8.3 Run all P sequence editing tests
- [ ] 8.4 Run all drag selection tests
- [ ] 8.5 Run all audio playback tests
- [ ] 8.6 Run all layout transition tests
- [ ] 8.7 Run all random generation tests
- [ ] 8.8 Run all snapshot save/load tests
- [ ] 8.9 Run all edge case tests
- [ ] 8.10 Fix any bugs found
- [ ] 8.11 Performance optimization if needed

**Status**: ⬜ Not Started

---

## 🧪 Testing Matrix

### Basic Rendering Tests
- [ ] **TR-001**: Set Lg = 3, verify 3 intervals rendered (numbered 1, 2, 3)
- [ ] **TR-002**: Set Lg = 12, verify 12 intervals rendered (numbered 1-12)
- [ ] **TR-003**: Verify pulse 0 exists and has class `.zero`
- [ ] **TR-004**: Verify pulse Lg exists and has class `.lg`
- [ ] **TR-005**: Verify pulses 1 to Lg-1 are rendered
- [ ] **TR-006**: Verify all intervals are visible (even unselected)

### Interval Selection Tests
- [ ] **TS-001**: Click interval 1, verify it becomes selected (opacity increases)
- [ ] **TS-002**: Click interval 1 again, verify it deselects
- [ ] **TS-003**: Click intervals 2, 5, 8, verify all are selected
- [ ] **TS-004**: Verify non-selected intervals remain visible but dimmer
- [ ] **TS-005**: Verify pulses are NOT clickable (click does nothing)

### P Sequence Editing Tests
- [ ] **TP-001**: Type "1 2 5 8" in P field, verify those intervals select
- [ ] **TP-002**: Type "0 13 -1 2" (Lg=10), verify only "2" remains
- [ ] **TP-003**: Type "5 2 8 2 5", verify "2 5 8" (deduplicated, sorted)
- [ ] **TP-004**: Type "99" (Lg=10), verify empty selection (out of range)
- [ ] **TP-005**: Verify Lg suffix displays current Lg value
- [ ] **TP-006**: Change Lg from 12 to 5, verify P sanitizes (removes 6-12)

### Drag Selection Tests
- [ ] **TD-001**: Drag across intervals 3-7, verify all select
- [ ] **TD-002**: Drag across selected intervals, verify all deselect
- [ ] **TD-003**: Drag mode switches between select/deselect correctly
- [ ] **TD-004**: Drag starting on interval 1, verify proper behavior

### Audio Playback Tests
- [ ] **TA-001**: Select intervals 1, 3, 5, play, verify audio at those positions
- [ ] **TA-002**: Verify unselected intervals play with base sound (Pulsaciones)
- [ ] **TA-003**: Verify selected intervals play with accent sound (Seleccionados)
- [ ] **TA-004**: Enable "Intervalo 1" checkbox, verify interval 1 plays distinct sound
- [ ] **TA-005**: Disable "Intervalo 1", verify interval 1 plays normal accent sound
- [ ] **TA-006**: Verify audio updates in real-time when selection changes during playback

### Layout Transition Tests
- [ ] **TL-001**: Toggle circular layout, verify intervals position along arc
- [ ] **TL-002**: Toggle back to linear, verify intervals above timeline
- [ ] **TL-003**: Verify no visual glitches during transition
- [ ] **TL-004**: Verify interval numbers remain visible in both layouts
- [ ] **TL-005**: Verify circular layout calculations are correct (arc positioning)

### Random Generation Tests
- [ ] **TR-001**: Click random, verify interval selection randomizes
- [ ] **TR-002**: Verify P sequence updates to match random selection
- [ ] **TR-003**: Test with different random densities
- [ ] **TR-004**: Test with Lg constraints in random menu

### Snapshot Save/Load Tests
- [ ] **TS-001**: Select intervals 1, 3, 5, save snapshot
- [ ] **TS-002**: Change selection, load snapshot, verify 1, 3, 5 selected
- [ ] **TS-003**: Test multiple snapshots with different selections
- [ ] **TS-004**: Verify snapshot persists across page reload

### Edge Case Tests
- [ ] **TE-001**: Lg = 1 (single interval 0→1), verify renders correctly
- [ ] **TE-002**: Lg = 0 (no intervals), verify nothing renders, no errors
- [ ] **TE-003**: All intervals selected, verify performance is acceptable
- [ ] **TE-004**: No intervals selected, verify playback works (base sound only)
- [ ] **TE-005**: Rapid Lg changes (3→20→5), verify no crashes
- [ ] **TE-006**: Layout switch during playback, verify smooth transition
- [ ] **TE-007**: Very large Lg (100+), verify intervals render (may be slow)

### Regression Tests
- [ ] **TRG-001**: Verify pulse 0 is NOT clickable
- [ ] **TRG-002**: Verify pulse Lg is NOT clickable
- [ ] **TRG-003**: Verify pulses 1 to Lg-1 are NOT clickable
- [ ] **TRG-004**: Verify pulse numbers are gone (not rendered)
- [ ] **TRG-005**: Verify interval numbers appear centered on blocks
- [ ] **TRG-006**: Verify no console errors in browser

---

## 📁 Files to Modify

### Core Refactoring Files

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `Apps/App5/main.js` | ~2000 | ⬜ Not Started | pulseMemory → intervalMemory, remove pulse interactivity, add interval handlers |
| `libs/temporal-intervals/it-calculator.js` | ~50 | ⬜ Not Started | Replace with `calculateAllIntervals` |
| `libs/temporal-intervals/it-renderer.js` | ~300 | ⬜ Not Started | Complete rewrite - render all Lg intervals |
| `libs/temporal-intervals/it-styles.css` | ~100 | ⬜ Not Started | 3x height, position above timeline |
| `libs/temporal-intervals/index.js` | ~10 | ⬜ Not Started | Update barrel exports |

### Pulse Sequence Files

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `libs/app-common/pulse-seq-intervals.js` | +20 | ⬜ Not Started | Add `sanitizePulseSequence` export |

### Audio Integration Files

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `libs/app-common/audio-init.js` | ~100 | ⬜ Not Started | Add interval1 channel support |
| `libs/app-common/sample-map.js` | +20 | ⬜ Not Started | Add interval1 sound mapping |
| `libs/app-common/mixer-menu.js` | ~30 | ⬜ Not Started | Conditional third channel |

### Layout Integration Files

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `libs/app-common/timeline-layout.js` | +10 | ⬜ Not Started | Add `onAfterLayout` callback hook |

### Visual Polish Files

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `Apps/App5/styles.css` | ~50 | ⬜ Not Started | Remove pulse number styles |

### Documentation Files

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `Apps/App5/AGENTS.md` | ~200 | ⬜ Not Started | Update with pulse 0 corrections |

---

## 📝 Implementation Log

### Session 1: 2025-10-09
**Time**: Start - In Progress
**Phases Completed**: Phase 1 ✅, Phase 2 ✅, Phase 3 ✅, Phase 4 ✅, Phase 5 ✅, Conceptual Fixes ✅
**Tests Passed**: Phase 1.5, Phase 2.3, Phase 3.5, Phase 4.5, Phase 4.6, Audio mapping, Notation sync, Layout persistence
**Notes**:
- Created IMPLEMENTATION_PLAN.md
- Reviewed core concepts and mathematical foundation
- **Phase 1 Complete**: State Management Refactoring
  - Renamed all `pulseMemory` → `intervalMemory` (50+ occurrences)
  - Renamed all `selectedPulses` → `selectedIntervals` (30+ occurrences)
  - Renamed `ensurePulseMemory` → `ensureIntervalMemory` (10+ occurrences)
  - Renamed `clearPersistentPulses` → `clearPersistentIntervals`
  - Updated all loops to use `i <= lg` (inclusive) for intervals 1 to Lg
  - Fixed random generation logic (line 714, 734)
  - Fixed updatePulseSeqField (line 1238)
  - Updated comments to use "intervals" terminology
- **Phase 2 Complete**: Remove Pulse Interactivity
  - **CRITICAL**: Changed pulse loop to start from 0: `for (let i = 0; i <= lg; i++)`
  - Now renders pulses 0 to Lg (pulse 0 is the neutral starting point!)
  - Removed all pulse click handlers and hit targets
  - Deleted `togglePulse()` function
  - Commented out `dragController.attach()` for pulses (will reconfigure for intervals in Phase 4)
  - Removed `pulseHits` positioning in layout callbacks
  - Removed `.selected` class application to pulses in `syncSelectedFromMemory()`
  - Pulses are now purely visual markers (non-interactive)
- **Phase 3 Complete**: Interval Rendering - Always All Lg Intervals
  - **it-calculator.js**: Created `calculateAllIntervals(lg)` - returns Lg intervals always
  - Each interval: `{ number, startPulse, endPulse }`
  - Example Lg=3: intervals 1,2,3 connecting pulses (0→1), (1→2), (2→3)
  - **it-renderer.js**: Complete rewrite (~200 lines)
    - `render()` always creates all Lg interval blocks with numbers
    - `updateLinearPositions()` centers intervals above timeline (top: -32px)
    - `updateCircularPositions()` positions intervals outside circle arc
    - `updateSelection()` updates .selected class without re-render
    - Click handlers and drag enter handlers ready
  - **it-styles.css**: Complete redesign
    - Height: 24px (3x original)
    - Unselected opacity: 0.25 (subtle), Selected: 0.8 (clear)
    - Positioned -32px above timeline in linear mode
    - Added responsive styles, hover effects, circular mode support
  - **it-index.js**: Updated exports with calculateAllIntervals
  - **App5/main.js**: Updated intervalRenderer configuration
- **Phase 4 Complete**: Interval Selection Logic
  - **handleIntervalClick()**: Toggles interval selection, updates UI and audio
  - Validates interval number (1 to Lg)
  - Updates intervalMemory, selectedIntervals Set, visual state
  - Calls intervalRenderer.updateSelection() for immediate visual feedback
  - Updates pulse sequence display and audio routing
  - **dragController configured for intervals**:
    - resolveTarget finds .interval-block elements
    - Returns { key, intervalNumber } for drag tracking
    - applySelection updates intervalMemory during drag
    - onDragEnd updates displays after drag completes
  - **Connected drag enter handler** via intervalRenderer.setDragEnterHandler()
  - Intervals are now fully interactive (click and drag)
  - syncSelectedFromMemory already correct from Phase 1
- **Phase 5 Complete**: Pulse Sequence (P) Editing
  - **pulse-seq-intervals.js**: Added `sanitizePulseSequence(text, lg)` function
    - Filters interval numbers to valid range [1, Lg]
    - Removes duplicates and sorts
    - Exported as named export for reuse
  - **App5/main.js**: Replaced old `sanitizePulseSeq()` with new `handlePulseSeqInput()`
    - Uses shared `sanitizePulseSequence()` helper from pulse-seq-intervals.js
    - Preserves all UX features: caret positioning, error tooltips for numbers > Lg
    - Updates intervalMemory and selectedIntervals Set
    - Triggers intervalRenderer.render() for visual update
    - Updates audio routing if playing
  - **Event listeners updated**:
    - keydown (Enter): async handler calls handlePulseSeqInput({ causedBy: 'enter' })
    - blur: calls handlePulseSeqInput({ causedBy: 'blur' })
  - Removed old ~70 line sanitizePulseSeq() function
  - P field now correctly sanitizes manual input (e.g., "1 3 99 5" with Lg=10 becomes "1 3 5")
- **Conceptual Fixes Complete**: Critical bug fixes and improvements
  - **Fix 1: Audio Mapping (Interval → Step Index)**
    - Problem: Intervalo 1 sonaba como intervalo 2
    - Solution: selectedForAudioFromState() now subtracts 1 (interval 1 → step 0)
  - **Fix 2: Pulse Number Display**
    - Numbers now start at 0 (not 1)
    - Restored to 100% size (removed font-size: 0.25em)
    - Hidden by default, toggle on click
    - Colors: endpoints (0, Lg) blue, intermedios contrast color
  - **Fix 3: Interval Highlighting**
    - Created new module: libs/app-common/highlight-interval.js
    - Highlights interval blocks during playback (not pulses)
    - CSS: .interval-block.highlight with flash animation
  - **Fix 4: Pulse Colors in Timeline**
    - Intermediate pulses (1 to Lg-1): var(--color-contrast)
    - Endpoints (0, Lg): var(--color-lg) (blue)
  - **Fix 5: Notation Sync & Audio**
    - buildNotationRenderState() now converts intervals correctly
    - handleNotationClick() converts step → intervalNumber
    - Added renderNotationIfVisible() calls for bidirectional sync
  - **Fix 6: Circular Timeline Numbers**
    - Click on pulse 0 or Lg shows/hides both numbers (shared position)
  - **Fix 7: P Field Line Break**
    - Added white-space: nowrap to prevent "P" and "(" separation
  - **Fix 8: Number Visibility Persistence**
    - visiblePulseNumbers Set tracks visible numbers
    - Persists across linear ↔ circular layout changes
- Started HTTP server for testing

### Session 2: 2025-10-09 (Continued)
**Phases Completed**: Phase 6 ✅
**Tests Passed**: Intervalo 1 checkbox functionality
**Notes**:
- **Phase 6 Complete**: Audio Integration - Intervalo 1
  - Added `startIntervalToggle` checkbox binding to App5/main.js (line 50)
  - Extracted `startIntervalToggle` in element destructuring (line 100)
  - Implemented checkbox change handler (lines 884-918):
    * Toggles `.enabled` class on `.interval-select-row` for dropdown visibility
    * When checked: pulso0 uses startSound from dropdown
    * When unchecked: pulso0 matches pulso (base sound)
  - Added custom `sharedui:sound` event handler (lines 96-119):
    * Intercepts sound dropdown changes
    * Respects checkbox state when applying sounds
    * Base sound changes update pulso0 when checkbox unchecked
    * Start sound only applies when checkbox checked
  - Leveraged existing TimelineAudio infrastructure:
    * pulso0 player already exists for step 0 (interval 1)
    * setStart() method sets both start and pulso0 sounds
    * No modification to core audio engine needed
  - CSS styles for `.interval-select-row.enabled` already existed from template
  - Commit: 722d6c1

**Next Session**:
- Continue with Phase 7: Visual Polish & Positioning

---

## 🐛 Known Issues & Fixes

### Issue Template
```markdown
**Issue #X**: [Brief description]
- **Phase**: [Which phase discovered]
- **Severity**: [Low / Medium / High / Critical]
- **Description**: [Detailed description]
- **Steps to Reproduce**: [If applicable]
- **Fix Applied**: [What was done to fix]
- **Status**: [Open / In Progress / Fixed]
```

### Active Issues
None yet

### Resolved Issues

**Issue #1**: Audio Mapping - Intervalo 1 suena como intervalo 2
- **Phase**: Post-Phase 5 (Conceptual Fix)
- **Severity**: Critical
- **Description**: Los intervalos son 1-indexed pero el audio usa step indices 0-indexed
- **Fix Applied**: selectedForAudioFromState() ahora resta 1 (intervalo N → step N-1)
- **Status**: Fixed ✅

**Issue #2**: Pulse numbers empiezan en 1 en lugar de 0
- **Phase**: Post-Phase 5 (Conceptual Fix)
- **Severity**: Medium
- **Description**: Los números renderizaban de 1 a Lg, deberían ser 0 a Lg
- **Fix Applied**: updateNumbers() ahora loop de 0 a Lg, showNumber() ajustado
- **Status**: Fixed ✅

**Issue #3**: Partitura no sincroniza con timeline/P field
- **Phase**: Post-Phase 5 (Conceptual Fix)
- **Severity**: High
- **Description**: Cambios en timeline o P no actualizaban la partitura
- **Fix Applied**: Añadido renderNotationIfVisible() en dragController.onDragEnd y handlePulseSeqInput
- **Status**: Fixed ✅

**Issue #4**: getMidpoints is not defined
- **Phase**: Phase 5
- **Severity**: High
- **Description**: Error al presionar Backspace/Delete en campo P
- **Fix Applied**: Añadida función getMidpoints() desde App4
- **Status**: Fixed ✅

**Issue #5**: Números de pulso no persisten al cambiar layout
- **Phase**: Post-Phase 5 (Conceptual Fix)
- **Severity**: Medium
- **Description**: Al cambiar linear ↔ circular, números visibles desaparecían
- **Fix Applied**: Set visiblePulseNumbers trackea estado, updateNumbers() restaura
- **Status**: Fixed ✅

---

## 📊 Progress Summary

**Overall Progress**: 81% (6/8 phases complete + conceptual fixes complete)

| Phase | Status | Progress |
|-------|--------|----------|
| 1. State Management | ✅ Complete | 100% |
| 2. Remove Pulse Interactivity | ✅ Complete | 100% |
| 3. Interval Rendering | ✅ Complete | 100% |
| 4. Interval Selection | ✅ Complete | 100% |
| 5. Pulse Sequence Editing | ✅ Complete | 100% |
| 6. Audio Integration | ✅ Complete | 100% |
| 7. Visual Polish | ⬜ Not Started | 0% |
| 8. Testing & Validation | ⬜ Not Started | 0% |

**Test Coverage**: 5/67 tests passed (Phases 1.5, 2.3, 3.5, 4.5, 4.6)

---

## 🎓 Quick Reference

### Key Formulas
- **Pulses rendered**: 0 to Lg (inclusive)
- **Total intervals**: Lg
- **Interval k connects**: pulse (k-1) to pulse k
- **Valid P range**: 1 ≤ n ≤ Lg

### State Variables (After Refactoring)
- `intervalMemory`: Array of booleans (size Lg+1, indices 1 to Lg used)
- `selectedIntervals`: Set of selected interval numbers (1 to Lg)

### Function Signatures
```javascript
calculateAllIntervals(lg) → Array<{number, startPulse, endPulse}>
sanitizePulseSequence(text, lg) → Array<number>
handleIntervalClick(intervalNumber) → void
```

---

## ✅ Ready to Start?

1. Pick a phase from [Implementation Phases](#implementation-phases)
2. Check off tasks as you complete them
3. Run associated tests after each phase
4. Update Implementation Log with notes
5. Document any issues in Known Issues section

**Let's build App5 "Pulsaciones"!** 🎵
