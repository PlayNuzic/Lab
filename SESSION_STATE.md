# SESSION_STATE — Auditoria 2026-06-10: BAIXES completades (2026-06-11)

Cap feina activa en curs. Tot el treball de l'auditoria està arxivat:

- **Informe amb checkboxes per troballa:** `docs/audit-report-2026-06-10.md`
  — estat: **128 tancades / 144** (les baixes: 13 verificadors adversaris en
  paral·lel sobre el codi actual, després aplicades en 4 commits per grup)
- **Arxius de sessió:** `docs/session-history/2026-06-10-auditoria-completa-i-aplicacio.md`
  i `docs/session-history/2026-06-11-auditoria-mitjanes-completades.md`

## Únic pendent

**13 MITJANES re-verificades adversàriament el 2026-06-11** (7 agents; els
veredictes detallats són a l'informe, per troballa). De les 16 originals, 3 es
van tancar a la verificació: P-11 (asset ja re-exportat: 114KB/1280px), H-10
(docs-sync ho havia resolt) i H-20 (residu = deltes genuïnes de model).

VIGENTS llestes per aplicar (cap bloqueig):
- A-06 statechange del context (zombie playing) — compte amb el fade LA-04
- P-03 rebuild de timeline per tecla (App1/App2) + P-05 reflows per etiqueta
  (circular-timeline ×2 per passada) — parella natural
- P-04 callback scrollPulseSeqToRect ombrejat (App4 perd el timeline-follow)
- P-06 gBCR per cel·la a musical-grid (rect un cop per passada)
- P-07 observer de gamificació d'App5 (disconnect durant playback)
- P-09 resize d'App24 sense debounce (patró rAF d'App33)
- P-13 entry de VexFlow amb 6 fonts (~399KB inútils) → entry/vexflow-nuzic.js
- P-15 @import de Google Fonts → vendoritzar woff2 (el "risc" 550/600 és fals:
  Google tampoc no els serveix avui)
- H-03 loop-control amb resolveAudio (fora els 5 wrappers boilerplate)

VIGENTS amb condicions:
- A-05 hot loop del worklet — ALT RISC (timeline-processor.js): diff complet +
  suite + aprovació explícita; el fix és mecànic i no toca cap epsilon
- A-13 (PARCIAL): U-11 va cobrir la V d'App2; queda V a App1/App4 i els
  transitoris de Lg a totes tres (patró: estendre U-11)
- A-08 (PARCIAL): payload de Tone real al primer Play rítmic, però treure
  l'await trenca el pinning de sampleRate (ensurePreferredSampleRateContext
  necessita Tone) — cal redissenyar el pinning natiu primer.

## Invariants nous d'aquesta aplicació (no trencar)

- Epsilons 1e-9 del worklet; ordre init àudio (Tone → gest → start); `void offsetWidth`
  dels highlights és load-bearing; polsos 0 i Lg mai seleccionables
- Cap canal rítmic passa `duration` a `_schedulePlayerStart` (polifonia — test de regressió)
- El rebobinat de `setTempo` cancel·la `_futureSources` (anti-flam — test de regressió)
- El preload de Tone.js i el prefetch de samples només mouen bytes (mai AudioContext)
- BPM: apps 9+ política 50-150; App2 30-240 amb sanitize en idle/blur; mai clamp mentre s'escriu
- Apps de fraccions (26-31): shell/timeline/highlights/CSS via factories compartides —
  els canvis es fan a libs/app-common/fraction-*.js i libs/interval-sequencer/itfr-engine.js
- Identificadors interns (body.app13, prefixos d'storage) NO segueixen el nom del
  directori — renombrar-los esborraria preferències guardades
- Eines de dev i logs: opt-in amb `?dev` o localStorage `nuzic-debug='1'`
- Fitxers d'alt risc: `libs/sound/timeline-processor.js`, `libs/app-common/subdivision.js`,
  `libs/app-common/audio-schedule.js` → diff complet + suite + aprovació
- Verificacions de navegador: events de confiança (CDP `Input.*`) amb cache desactivada
  i perfil de Chrome net; mai `.value`+`blur()` sintètics
- Suite: 71 suites / 1389 tests — `npm test` després de cada batch
