# PlayNuzic Lab — Guide for Claude

## Identity
Monorepo for rhythmic/temporal music apps (Nuzic method). ES2022 modules, no build step, runs directly in browser.
~70% shared code in `libs/`, individual apps in `Apps/`. 71 test suites, 1380+ tests.

## Session Management (MANDATORY)
- If `SESSION_STATE.md` exists at root → **READ IT FIRST** before any edit. It contains working features that must not break.
- Incomplete tasks → create/update `SESSION_STATE.md`
- Completed tasks → archive to `docs/session-history/YYYY-MM-DD-description.md`, then clear SESSION_STATE.md
- Check `docs/session-history/` for previously solved problems when facing recurring errors

## Development Rules
1. **SEARCH libs/ FIRST** for existing components. Create reusable module SECOND. App-specific code is LAST RESORT.
2. Show code BEFORE creating files. Wait for explicit approval.
3. Write tests for new components.
4. Run `npm test` after changes. All tests must pass.
5. Never break existing functionality.
6. Comments (LH-12): write NEW/edited comments in `libs/` in català; do NOT mass-rewrite existing English/Spanish ones — normalize a line only when already touching it. Apps may keep their local language.

## High-Risk Files (modify with extreme caution)
These files affect timing and synchronization across ALL apps. Before modifying:
read existing tests, run full test suite, and show the complete diff for approval.
- `libs/sound/timeline-processor.js` — AudioWorklet timing + polyrhythmic voice sync, epsilon 1e-9 for double-trigger prevention
- `libs/app-common/subdivision.js` — Pulse/subdivision interval calculations (60/bpm) used across apps
- `libs/app-common/audio-schedule.js` — Resync/look-ahead scheduling math (computeResyncDelay)

## Architecture
```
Apps/          → App1-App35 (individual rhythm apps)
libs/
  sound/       → Audio engine (TimelineAudio, mixer, samples)
  app-common/  → 50 core modules (DOM, audio-init, loop, fractions, LED, visual-sync...)
  pulse-seq/   → Pulse sequence editor with parser and memory
  matrix-seq/  → 2D grid editor for N-P pairs
  notation/    → VexFlow rhythm staff rendering
  random/      → Randomization system with menu UI
  shared-ui/   → Header, dropdowns, tooltips, theme events
  gamification/→ Achievement system, scoring, event tracking
  interval-sequencer/ → Interval-based sequencing with drag editing
  musical-grid/→ 2D musical grid with scroll and interval support
  temporal-intervals/ → Visual interval blocks (iT) for timeline
  scales/      → Musical scale definitions
  vendor/      → Tone.js, VexFlow, chromatone-theory
```

## Standard App Initialization Pattern
```javascript
import { bindRhythmElements } from '../../libs/app-common/dom.js';
import { createRhythmAudioInitializer } from '../../libs/app-common/audio-init.js';
import TimelineAudio from '../../libs/sound/index.js';

const { elements, leds, ledHelpers } = bindRhythmElements({...});
const initAudio = createRhythmAudioInitializer({...});
const audio = await initAudio();
```

## LEGACY Patterns (DO NOT USE)
`initRhythmApp()`, `createStandardElementMap()`, `bindRhythmAppEvents()` — deprecated; their modules
(`app-common/app-init.js`, `app-common/events.js`) were deleted 2026-06. Do not reintroduce.

## Reference Documentation (consult on demand, not loaded automatically)
- `LAB_SYSTEM_RULES.md` — Complete technical rules for timing, audio, loop, mixer (12KB+)
- `MODULES.md` — Full module index with import patterns
- `docs/agents-context.md` — Detailed skill/agent documentation

## Commands
```bash
npm test                                    # Run all tests
npm test -- --testPathPattern="module-name" # Specific module
npx http-server                             # Serve apps locally
```
