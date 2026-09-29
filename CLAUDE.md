# PlayNuzic Lab — Guide for Claude

## Identity
Monorepo for rhythmic/temporal music apps (Nuzic method). ES2022 modules, no build step, runs directly in browser.
~70% shared code in `libs/`, individual apps in `Apps/`. See `npm test` for the current test suite/test count.

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
These files affect timing and synchronization across ALL apps.

**Nivell 1** — before modifying: read existing tests, run full test suite, and show the complete diff for approval.

- `libs/sound/timeline-processor.js` — AudioWorklet timing + polyrhythmic voice sync, epsilon 1e-9 for double-trigger prevention
- `libs/app-common/subdivision.js` — Pulse/subdivision interval calculations (60/bpm) used across apps
- `libs/app-common/audio-schedule.js` — Resync/look-ahead scheduling math (computeResyncDelay)
- `libs/sound/index.js` — TimelineAudio engine (play/pause/scheduler); +391 lines and 20 importers as of 2026-07, the June regressions landed here, outside the 3 files above

**Nivell 2** — sensitive init chain: read existing tests and run the full suite before merging (massive fan-in, no formal approval gate but never auto-fix).

- `libs/app-common/audio-init.js` — lazy TimelineAudio creation, imported by most apps
- `libs/sound/user-interaction.js` — gesture-gated AudioContext bootstrap
- `libs/sound/tone-loader.js` — Tone.js lazy loader
- Any module handling live timing or with a similarly massive importer count

## Architecture
```
Apps/          → App1, App1B … App35 (individual rhythm apps)
libs/
  sound/       → Audio engine (TimelineAudio, mixer, samples)
  app-common/  → core modules (DOM, audio-init, loop, fractions, LED, visual-sync...)
  pulse-seq/   → Pulse sequence editor with parser and memory
  matrix-seq/  → Interval parsing utilities (sound/temporal)
  notation/    → VexFlow rhythm staff rendering
  random/      → Randomization system with menu UI
  shared-ui/   → Header, dropdowns, tooltips, theme events
  gamification/→ Achievement system, scoring, event tracking
  interval-sequencer/ → iTfr timeline engine + interval/gap conversion
  musical-grid/→ 2D musical grid with scroll and interval support
  temporal-intervals/ → Visual interval blocks (iT) for timeline
  scales/      → Musical scale definitions
  vendor/      → Tone.js, VexFlow, chromatone-theory
```

## Standard App Initialization Pattern
```javascript
import { bindAppRhythmElements } from '../../libs/app-common/dom.js';
import { createRhythmAudioInitializer } from '../../libs/app-common/audio-init.js';
import TimelineAudio from '../../libs/sound/index.js';

const { elements } = bindAppRhythmElements('appId');
const initAudio = createRhythmAudioInitializer({...});
const audio = await initAudio();
```

## LEGACY Patterns (DO NOT USE)
`initRhythmApp()`, `createStandardElementMap()`, `bindRhythmAppEvents()` — deprecated; their modules
(`app-common/app-init.js`, `app-common/events.js`) were deleted 2026-06. Do not reintroduce.

## Reference Documentation (consult on demand, not loaded automatically)
- `docs/LAB_SYSTEM_RULES.md` — Complete technical rules for timing, audio, loop, mixer (~35 KB)
- `docs/MODULES.md` — Full module index with import patterns
- `docs/agents-context.md` — Claude Code harness: skills, hooks, permissions

## Commands
```bash
npm test                                    # Run all tests
npm test -- --testPathPattern="module-name" # Specific module
npm run smoke                               # Load every page in headless Chromium (catches app main.js errors)
npx http-server                             # Serve apps locally
```

## Knowledge graph (graphify) — Mac only
For architecture questions ("which app/lib implements X?", "how does A relate to B?"), the
`graphify-lab` skill queries the graphify graph of Lab code + Nuzic theory before grepping.
It lives outside the repo (`~/Documents/Nuzic/Corpus/`), so it only works in local sessions;
the skill also covers refreshing the graph and syncing the Obsidian vault.
