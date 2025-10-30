## Objectiu
- Centralitzar inicialització, UI i lògica rítmica reutilitzable entre Apps.
- Servir com a capa intermèdia entre la UI i el motor `TimelineAudio`/mixer.
- Proporcionar helpers cohesionats per fomentar noves apps basades en components compartits.

## Mòduls principals (ACTUALITZAT Fase 2 - Oct 2025)

**NOTA:** Diversos mòduls s'han reorganitzat en sub-packages. Vegeu imports actualitzats a continuació.

- **Inicialització**: `app-init.js` (bootstrap d'apps amb template + LEDs),
  `audio-init.js` (creació lazy de `TimelineAudio` sense warnings) i
  `dom.js` (`bindAppRhythmElements`).
- **Audio & control**: `audio.js` (ponts `sharedui:*`), `audio-schedule.js`
  (`computeResyncDelay`), `audio-toggles.js` (mute declaratiu), `loop-control.js`
  (controladors base/rhythm/pulse-memory), `visual-sync.js` (consolidat: simple + completo),
  i `preferences.js` (persistència, theme sync, factory reset).
- **UI avançada**: `fraction-editor.js`, `timeline-layout.js`,
  `template.js` (slots compartits), `tap-tempo-handler.js` (tap tempo amb feedback visual).
- **Utilitats**: `subdivision.js`, `number-utils.js` (consolidat: number + range + formatting),
  `utils.js`, `mixer-menu.js` + `mixer-longpress.js`, `led-manager.js`, `events.js`.

### ⭐ MÒDULS MOGUTS A SUB-PACKAGES (Fase 2):

**`libs/pulse-seq/`** (abans en app-common):
- `pulse-seq.js`, `pulse-seq-parser.js` → `parser.js`, `pulse-seq-state.js` → `state.js`, `pulse-seq-editor.js` → `editor.js`
- Import: `import { createPulseSeqController } from '../pulse-seq/index.js'`

**`libs/notation/`** (abans en app-common):
- `fraction-notation.js`, `notation-panel.js` → `panel.js`, `notation-utils.js` → `utils.js`, `notation-renderer.js` → `renderer.js`
- Import: `import { resolveFractionNotation, createNotationPanelController } from '../notation/index.js'`

**`libs/random/`** (abans en app-common):
- `random-config.js` → `config.js`, `random-menu.js` → `menu.js`, `random-fractional.js` → `fractional.js`
- Import: `import { initRandomMenu, randomize, applyBaseRandomConfig } from '../random/index.js'`

Mantén aquestes peces modulars; si detectes lògica duplicada a les apps,
mou-la als sub-packages corresponents i dóna-li API clara.

## Tests
- Execució amb `npm test` des de l'arrel.
- **Cobertura (Fase 2)**: 27 test suites, 280 tests ✅
- Suites actives: `__tests__/` (audio, audio-schedule, audio-toggles,
  fraction-editor, loop-resize, subdivision, tap-resync, simple-visual-sync) + tests unitaris
  dedicats (`audio-init.test.js`, `loop-control.test.js`, `range.test.js`,
  `utils.test.js`).
- **Tests moguts**:
  - `notation-utils.test.js` → `libs/notation/fraction-notation.test.js`
  - `pulse-seq-parser.test.js` → Tests movits al sub-package `libs/pulse-seq/`
- **Destacat Oct 2025**: `fraction-notation.test.js` (abans notation-utils) amb cobertura exhaustiva de
  construcció d'events per partituras (pulsos remainder, múltiples, tuplets).
- L'entorn és `node` amb `jsdom` puntual. Mockeja WebAudio/DOM quan ampliïs APIs.

## Bones pràctiques
- Exporta fàbriques pures; evita estat global compartit fora de `preferences`.
- Documenta noves APIs a l'arxiu (JSDoc) i actualitza els AGENTS d'apps que les
  utilitzin.
- Abans d'introduir nous paràmetres, comprova si els helpers existents (p.ex.
  `createPulseMemoryLoopController`, `mergeRandomConfig`) ja ho resolen.
