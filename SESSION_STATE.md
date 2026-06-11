# SESSION_STATE — Auditoria 2026-06-10: BAIXES completades (2026-06-11)

Cap feina activa en curs. Tot el treball de l'auditoria està arxivat:

- **Informe amb checkboxes per troballa:** `docs/audit-report-2026-06-10.md`
  — estat: **128 tancades / 144** (les baixes: 13 verificadors adversaris en
  paral·lel sobre el codi actual, després aplicades en 4 commits per grup)
- **Arxius de sessió:** `docs/session-history/2026-06-10-auditoria-completa-i-aplicacio.md`
  i `docs/session-history/2026-06-11-auditoria-mitjanes-completades.md`

## Únic pendent

**16 MITJANES mai demanades** (la sessió del 2026-06-10/11 va fer les U-xx i les
H-xx que l'usuari va anar demanant; aquestes van quedar fora de tots els lots):
- Àudio: A-05 (hot loop del worklet — ALT RISC: timeline-processor.js), A-06
  (statechange del context), A-08 (Tone.js innecessari a les apps rítmiques),
  A-13 (valors transitoris de BPM/Lg al transport)
- Rendiment: P-03..P-07, P-09, P-11, P-13, P-15 (rebuilds per tecla, reflows
  per etiqueta, observer de gamificació, VexFlow al resize, JPEG de fons,
  fonts de VexFlow, @import de Google Fonts)
- Higiene: H-03 (loop-control captura audio per valor), H-10 (MODULES.md — pot
  estar ja resolt pels docs-sync; re-verificar), H-20 (App30/31 — majoritàriament
  resolt per H-02/H-21/H-07; queda només validar el residu)

Totes tenen verificació adversària d'origen a l'informe, però són d'abans dels
refactors grans: **re-verificar vigència abans d'aplicar-les**.

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
