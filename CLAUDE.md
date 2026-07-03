# PlayNuzic Lab — Guide for Claude

## Identity
Monorepo for rhythmic/temporal music apps (Nuzic method). ES2022 modules, no build step, runs directly in browser.
~70% shared code in `libs/`, individual apps in `Apps/`. 76 test suites, 1370 tests.

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
- `LAB_SYSTEM_RULES.md` — Complete technical rules for timing, audio, loop, mixer (12KB+)
- `docs/MODULES.md` — Full module index with import patterns
- `docs/agents-context.md` — Detailed skill/agent documentation

## Commands
```bash
npm test                                    # Run all tests
npm test -- --testPathPattern="module-name" # Specific module
npx http-server                             # Serve apps locally
```

## Knowledge graph (graphify) — CONSULT FIRST for code/architecture questions
This repo's code is indexed (together with the Nuzic theory corpus) in a graphify
knowledge graph. **Before grepping across `Apps/` and `libs/`** to answer a question about
architecture, how a concept is implemented, or which files relate to what:

1. Query the graph first:
   `graphify query "<the question>" --graph "/Users/workingburcet/Documents/Nuzic/Corpus/graphify-out/graph.json"`
2. Trace how two things connect: `graphify path "A" "B" --graph <same path>`
   Explain a node: `graphify explain "NodeName" --graph <same path>`
3. Use the graph to locate the relevant modules/apps, then open those files.

The graph's value here is that it links **Nuzic theory** (Pulso/iT, Nota/iS, iA = intervalo
Armónico, fraccions, polirítmia, simbiosi) to the **Lab code** that implements it — so you can
ask e.g. "which app/lib implements polyrhythm?" and get theory + code together.

Note: Lab's local `graphify-out/` holds only the converted Nuzic corpus (`converted/`,
versioned) plus a gitignored `cache/` — there is **no local `graph.json`**, so a bare
`graphify query "..."` prints `error: graph file not found`. Always pass the explicit
`--graph <path>` to the **external Corpus graph** shown above; with it the query works and
returns results (the error line, if any, is harmless).

Caveats (be honest about them):

- The searchable graph lives in the **Corpus** project, not here: `~/Documents/Nuzic/Corpus/graphify-out/graph.json` (verified: indexes all 403 Lab **source** files — every `.js`/`.json` under `Lab/…`, deduplicated, each appearing exactly once under the canonical `Lab/<path>` form). Nuance: those 403 are 336 `Lab/libs/` + 62 `Lab/Apps/` + 5 outside Apps/libs (`package.json`, `sistema/js/…`, `docs/*.mjs`) — so it's "all source", not strictly "across Apps + libs". **CSS (67 files) and HTML (41 files) are NOT indexed** (it's an AST graph of code) — for styling/markup questions, read the files directly.
- The graph is a **snapshot** (last reindexed once). For brand-new or just-edited code, fall back
  to reading the actual files — the graph won't have those changes until re-indexed.
- To refresh Lab's slice: from the Corpus dir run `graphify /Users/workingburcet/Lab --update`
  (re-extracts changed files). Note: `cluster-only`/`export obsidian` regenerate community names
  as "Community NNN" and need re-labelling afterwards.
- graphify Python interpreter: `~/.local/share/uv/tools/graphifyy/bin/python3`
