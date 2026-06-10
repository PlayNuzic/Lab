# SESSION_STATE — Aplicació de l'auditoria 2026-06-10 (en curs)

## Documents mestres

- **Troballes + seguiment (checkboxes per ítem):** `docs/audit-report-2026-06-10.md`
- **Tot el completat fins ara (QWs 12/12, ALTES 4/4, H-02, tàctil, fixos d'usuari):**
  `docs/session-history/2026-06-10-auditoria-completa-i-aplicacio.md`

El detall viu allà; aquí només l'estat. Marca `[x]` a l'informe quan completis una troballa.

## Pendent (següents per impacte)

- [x] ~~A-10, P-12, A-12, U-22, H-21, H-09/H-18, tempo en calent App27-31, A-04, H-07,
  H-14, H-15/H-16/H-17 (timeline/highlights/CSS de fraccions compartits)~~ — fets
  2026-06-10, detall a l'informe
- [x] ~~H-11 (applyTo de toggles), H-08 (reorderControls compartit ×13), H-05/H-06 (eines
  de debug opt-in amb ?dev)~~ — fets 2026-06-10
- [x] ~~H-12 (9 mòduls orfes + 6 suites mortes fora), H-13 (logger compartit gated per
  ?dev/nuzic-debug als camins calents)~~ — fets 2026-06-10
- [x] ~~H-19 (app9/10/11/13 → App9/10/11/13; identificadors interns intactes), H-23 (JSDoc
  del scheduling-bridge)~~ — fets 2026-06-10
- Resta de l'informe: U-xx mitjanes d'UX i les ~90 baixes (LA/LP/LU/LH, no verificades
  adversàriament — re-verificar abans d'aplicar)

## Funciona i NO s'ha de trencar

- Suite completa verda (71 suites / 1389 tests — H-12 va treure 6 suites de codi mort) — `npm test` després de cada batch
- Invariants: epsilons 1e-9 del worklet; ordre init àudio (Tone → gest → start; el preload
  de Tone.js i el prefetch de samples només mouen bytes, mai creen AudioContext); BPM sense
  clamp mentre s'escriu (lib 30-240; **apps 9+ política 50-150**); `void offsetWidth` del
  highlight és load-bearing; polsos 0 i Lg mai seleccionables; cap canal rítmic passa
  `duration` a `_schedulePlayerStart` (polifonia — test de regressió); el rebobinat de
  setTempo cancel·la les fonts del lookahead (`_futureSources` — test de regressió);
  piano/flauta carreguen de `samples/instruments/` local amb fallback CDN
- Fitxers d'alt risc: `libs/sound/timeline-processor.js`, `libs/app-common/subdivision.js`,
  `libs/app-common/audio-schedule.js` → diff complet + suite + aprovació
- Verificacions de navegador: events de confiança (CDP `Input.*`), mai `.value`+`blur()` sintètics

## En reprendre

1. Llegir "Pendent" aquí + la taula de l'informe; agafar el primer ítem.
2. Després de cada batch: `npm test`, marcar `[x]` a l'informe, actualitzar aquest fitxer,
   commit amb llista explícita de fitxers (sessions paral·leles comparteixen el repo).
