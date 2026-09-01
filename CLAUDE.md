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

- `libs/app-common/audio-init.js` — lazy TimelineAudio creation, 41 importers
- `libs/sound/user-interaction.js` — gesture-gated AudioContext bootstrap
- `libs/sound/tone-loader.js` — Tone.js lazy loader
- Any module handling live timing or with a similarly massive importer count

## Architecture
```
Apps/          → App1-App35 (individual rhythm apps)
libs/
  sound/       → Audio engine (TimelineAudio, mixer, samples)
  app-common/  → 54 core modules (DOM, audio-init, loop, fractions, LED, visual-sync...)
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

- The searchable graph lives in the **Corpus** project, not here: `~/Documents/Nuzic/Corpus/graphify-out/graph.json` (verified 2026-09-01: indexes 424 Lab **source** files — every `.js`/`.json` under `Lab/…`, each appearing exactly once under the canonical `Lab/<path>` form: 344 `Lab/libs/` + 64 `Lab/Apps/` + 14 `Lab/sistema/js/` + `package.json` + `docs/*.mjs`; 8483 nodes / 19872 edges in total with the theory corpus). **CSS and HTML are NOT indexed** (it's an AST graph of code) — for styling/markup questions, read the files directly.
- The graph is a **snapshot** (Lab slice fully re-extracted 2026-09-01 with graphify 0.9.4, AST-only; `built_at_commit` in graph.json says which Lab commit). For brand-new or just-edited code, fall back to reading the actual files — the graph won't have those changes until re-indexed.
- To refresh Lab's slice, run the dedicated script (cwd must be the Corpus dir):
  `cd ~/Documents/Nuzic/Corpus && "$(cat graphify-out/.graphify_python)" /Users/workingburcet/Lab/docs/graphify-update-lab.py [--all]`
  It re-extracts only changed code files (`--all`: every code file — use it after upgrading graphify or if edges look missing), keeps the `Lab/…` paths and `lab_…` ids, **inherits** the ~280 curated community names (never re-clusters) and backs up `graph.json` + `manifest.json` first. Do **not** use `graphify update`, `/graphify --update` or `cluster-only` on this graph directly: they would re-key the Lab ids (duplicating every node) and/or replace the community names with "Community NNN".
  `.graphifyignore` (repo root) keeps `docs/textos ideas sistema nuzic/` (docx/xlsx sources — otherwise `detect()` regenerates `graphify-out/converted/` sidecars inside Lab) and the two graph scripts out of the graph.
- The Obsidian vault `~/Documents/Nuzic/Corpus/graphify-out/Nuzic+Code` mirrors the graph but was hand-reorganised (code notes in `CODI/`, `comunitat/…` tags, per-node community names). After refreshing the graph, sync it with
  `cd ~/Documents/Nuzic/Corpus && python3 /Users/workingburcet/Lab/docs/graphify-vault-sync.py [--dry-run] [--colors]`
  (idempotent; state in the vault's `.nuzic_lab_vault_state.json`; retired notes go to `graphify-out/Nuzic+Code-obsoletes/<ts>/`; `--colors` regenerates the graph-view colour groups in `.obsidian/graph.json`: one per `comunitat/…` tag, same hue per family such as «Motor àudio (Tone.js) (N)»). Never run `graphify export obsidian` on that vault. The other two vaults (`Nuzic teoria`, `Nuzic Teoria Core`) come from their own theory graphs and are unrelated to Lab.
- graphify Python interpreter: `~/.local/share/uv/tools/graphifyy/bin/python3`
