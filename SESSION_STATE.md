# SESSION_STATE — Auditoria 2026-06-10: aplicació COMPLETADA (ALTES + MITJANES)

Cap feina activa en curs. Tot el treball de l'auditoria està arxivat:

- **Informe amb checkboxes per troballa:** `docs/audit-report-2026-06-10.md`
  — estat: 67 tancades + 3 refutades / 144
- **Arxius de sessió:** `docs/session-history/2026-06-10-auditoria-completa-i-aplicacio.md`
  i `docs/session-history/2026-06-11-auditoria-mitjanes-completades.md`

## Únic pendent

Les **~90 troballes BAIXES** (seccions LA/LP/LU/LH de l'informe). NO estan verificades
adversàriament: **re-verificar cadascuna contra el codi actual abans d'aplicar-la** (el
codi ha canviat molt des de l'auditoria — diverses ja poden estar resoltes o obsoletes).

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
