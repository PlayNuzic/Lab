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
- [ ] Després dels QW: troballes ALTA restants (A-03 scheduling reactiu cycle/voice, P-01 rebuild plano-modular, P-02 VexFlow lazy, H-02 editor duplicat 4×, U-02 drag tàctil)

## Funciona i NO s'ha de trencar

- Suite completa verda (73 suites / 1456 tests, 2026-06-10) — executar `npm test` després de cada batch
- Invariants: epsilons 1e-9 del worklet; ordre init àudio (Tone → gest → start); BPM sense clamp mentre s'escriu (sanitize 1500ms/blur); `void offsetWidth` del highlight és load-bearing (reinicia animacions CSS); polsos 0 i Lg mai seleccionables
- Fitxers d'alt risc REALS (l'informe H-01 ja ha corregit els docs): `libs/sound/timeline-processor.js`, `libs/app-common/subdivision.js`, `libs/app-common/audio-schedule.js`

## En reprendre

1. Llegir taula Quick wins de l'informe; continuar pel primer batch sense `[x]`.
2. Després de cada batch: `npm test` + marcar checkboxes a l'informe + actualitzar aquest fitxer.
