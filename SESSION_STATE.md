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
- Següents candidates: H-05/H-06 (debug tools en producció), H-08 (reorder controls ×13),
  H-11 (toggles pre-init), H-12/H-13 (mòduls orfes, console.log), U-xx restants

## Funciona i NO s'ha de trencar

- Suite completa verda (77 suites / 1509 tests) — `npm test` després de cada batch
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
