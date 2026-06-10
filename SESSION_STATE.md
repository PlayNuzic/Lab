# SESSION_STATE — Aplicació de l'auditoria 2026-06-10 (en curs)

## Documents mestres

- **Troballes + seguiment (checkboxes per ítem):** `docs/audit-report-2026-06-10.md`
- **Tot el completat fins ara (QWs 12/12, ALTES 4/4, H-02, tàctil, fixos d'usuari):**
  `docs/session-history/2026-06-10-auditoria-completa-i-aplicacio.md`

El detall viu allà; aquí només l'estat. Marca `[x]` a l'informe quan completis una troballa.

## Pendent (següents per impacte)

- [x] ~~A-10 (flams setTempo), P-12 (payload primer Play), A-12 (vendoritzar piano/flauta),
  U-22 (menú capítols amb teclat), H-21 (motor iTfr compartit App30/31), H-09/H-18
  (re-comentat quirúrgic), tempo en calent App27-31 (bug d'usuari)~~ — fets 2026-06-10
- Següents candidates: troballes mitjanes restants de l'informe (H-07 addRepeatPress ×11,
  H-14 shell d'àudio duplicat, A-04 scheduler throttlejable, U-xx teclat/spinners...)

## Funciona i NO s'ha de trencar

- Suite completa verda (75 suites / 1493 tests) — `npm test` després de cada batch
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
