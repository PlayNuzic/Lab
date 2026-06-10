# SESSION_STATE — Aplicació de l'auditoria 2026-06-10

## Document mestre (seguiment de troballes)

`docs/audit-report-2026-06-10.md` — 96 troballes confirmades + 48 menors, amb checkbox i ID (A/P/U/H-nn).
**El detall viu allà; aquí només l'estat de sessió. Marca `[x]` a l'informe quan completis una troballa.**

## Estat actual

- [x] Auditoria completa (workflow 50 agents) + informe guardat
- [x] **Quick wins COMPLETS (12/12)** (taula QW-1..12 de l'informe):
  - [x] Batch 1 (2026-06-10, tests verds): QW-1 (docs clock.js→timeline-processor.js, 4 fitxers), QW-4 (guard random App20), QW-8 (promesa compartida initAudio)
  - [x] Batch 2 (2026-06-10, tests verds): QW-2 (canal instrument→bus melòdic, index.js), QW-9 (onPulse null a App1/App2/App5)
  - [x] QW-12 (2026-06-10, OK de l'usuari): app-init.js + events.js esborrats (git rm), refs tretes de CLAUDE.md arrel i app-common
  - [x] Batch 3 (2026-06-10, tests verds): QW-5 (modulepreload ×37 apps), QW-10 (teclat a spinner-repeat.js + :focus-visible a nuzic-theme.css i mixer slider), QW-11 (parallax: frontera → go(±1))
  - [x] Batch 4 (2026-06-10, tests verds): QW-6 (9 clicks estèreo→mono −1,7MB, Descartados/ esborrat −2,8MB, paso-1.jpg/paso-7.png esborrats −3,2MB, paso-11.jpg 428→114KB, DRAFT.md mogut a docs/), QW-7 (ubuntu-bold.ttf→woff2 270→15KB + preloads fonts)
  - [x] QW-3 (2026-06-10, aprovat per l'usuari, tests verds): timestamp sample-accurate al missatge de pols (timeline-processor.js + index.js, via globalThis.currentTime amb fallback NaN→now als tests)
- [x] ALTES (2026-06-10, tests verds): A-03 (cicle→lookahead a tick() + veus amb msg.time sample-accurate, aprovat), P-01 (loadSelection fa diff, no rebuild), P-02 (VexFlow lazy via libs/notation/lazy.js a App2/4/5; App23/24 estàtic intencionat)
- [x] Extra usuari (2026-06-10): Click12/13 esborrats del motor+dropdown (app9 migra a click2); fix octava cromàtica App23/24 (i=12 → cel·la 12, el 0' de dalt)
- [x] Extra usuari (2026-06-10, 2a tanda): BPM 50-150 a totes les apps 9+ (app10/11/11A/13/18 i App19/20 + inputs random); App19 random sense la nota frontera 0r3; **fix geometria scroll plano-modular** (min-height fora del matrix-container → floor al .plano-container; clientHeight/maxScroll idèntics soundline↔matriu, verificat amb Chrome headless+CDP) + scroll single-writer a App19/App20 (només s'anima la matriu, la soundline segueix via setupScrollSync)
- [x] **H-02 (última ALTA, 2026-06-10)**: editor de cel·les extret a `libs/pulse-seq/cell-editor.js` (createCellSequenceEditor + fractionTokenValue/normalizeFractionToken; 24 tests jsdom). App28/29/30/31 recablejades (−516 línies; només hi queda model+validació). Paritat verificada amb CDP (Pfr: defer 1000/500ms, "N.M" immediat, wrap Lg→0 a App29; iTfr: sanitize, guard anti doble-commit, límit de suma). Troballa nova preexistent: LH-20 (App31 accepta edicions de cel·la que excedeixen l'espai; A/B confirmat contra baseline)
- [ ] Següents per impacte: U-02/U-03 (drag tàctil Pointer Events + touch-action), A-04 (setTempo re-agenda finestra lookahead), A-05/A-06 (payload primer play), H-03 (App30↔App31 83% idèntiques)

## Funciona i NO s'ha de trencar

- Suite completa verda (73 suites / 1456 tests, 2026-06-10) — executar `npm test` després de cada batch
- Invariants: epsilons 1e-9 del worklet; ordre init àudio (Tone → gest → start); BPM sense clamp mentre s'escriu (sanitize 1500ms/blur); `void offsetWidth` del highlight és load-bearing (reinicia animacions CSS); polsos 0 i Lg mai seleccionables
- Fitxers d'alt risc REALS (l'informe H-01 ja ha corregit els docs): `libs/sound/timeline-processor.js`, `libs/app-common/subdivision.js`, `libs/app-common/audio-schedule.js`

## En reprendre

1. Llegir taula Quick wins de l'informe; continuar pel primer batch sense `[x]`.
2. Després de cada batch: `npm test` + marcar checkboxes a l'informe + actualitzar aquest fitxer.
