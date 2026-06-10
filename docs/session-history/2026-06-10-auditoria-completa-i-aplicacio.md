# 2026-06-10 — Auditoria completa del repo + aplicació (QWs, ALTES, H-02, tàctil)

## Auditoria

Workflow multi-agent (6 lectors de docs → 16 auditors → 27 verificadors adversaris → crítica):
**146 troballes brutes → 96 confirmades + 48 menors + 2 refutades**, en 4 dimensions
(motor d'àudio, rendiment, UX, higiene de codi/comentaris). Informe mestre amb checkboxes:
`docs/audit-report-2026-06-10.md`.

Veredicte re-comentat: quirúrgic, no massiu — Apps/ i sistema/js són la millor qualitat del repo;
calen WHY-comments a `timeline-processor.js` i re-comentat de `timeline-layout.js` (pendents).

## Aplicat (commits 19d8f30 → feecc08+)

### Quick wins (12/12)
- Docs alt-risc: `clock.js` fantasma → `timeline-processor.js` (+`subdivision.js`/`audio-schedule.js`)
- Motor: timestamp sample-accurate del worklet als missatges de pols; canal *instrument* connectat
  al bus melòdic; `initAudio` amb promesa compartida (race del doble clic + retry)
- Apps: guard `isPlaying` al random d'App20; doble camí visual (`onPulse`) eliminat a App1/2/5;
  `modulepreload` a les 37 apps
- UX: teclat als spinners; `:focus-visible` al tema nuzic; el parallax escapa al paso adjacent
- Assets: clicks estèreo→mono (−52%), `Descartados/` i imatges mortes esborrades (−6MB),
  `paso-11.jpg` 428→114KB, `ubuntu-bold` ttf→woff2 (−94%) + preloads
- APIs deprecades esborrades físicament (`app-init.js`, `events.js`)

### ALTES (4/4)
- **A-03**: sons de cicle pre-agendats al lookahead amb temps fraccionari exacte (replica
  `_recomputeCycleEvents`); veus polirítmiques ancorades a `msg.time` del worklet
- **P-01**: `loadSelection` de plano-modular fa diff de seleccions (abans rebuild total per commit)
- **P-02**: VexFlow (~1,6MB) lazy via `libs/notation/lazy.js` al primer toggle (App2/4/5);
  `panel.js`/`utils.js`/`fraction-notation.js` són lliures de VexFlow i s'importen directes
- **H-02**: editor de cel·les Pfr/iTfr extret a `libs/pulse-seq/cell-editor.js`
  (`createCellSequenceEditor` + `fractionTokenValue`/`normalizeFractionToken`, 24 tests jsdom);
  App28/29/30/31 recablejades (−516 línies). Paritat verificada amb CDP per app.

### Fixos reportats per l'usuari
- **BPM 50-150 a totes les apps 9+** (app10/11/11A/13/18, App19/20 + inputs del menú random)
- **App19 random**: mai genera la nota frontera `0r3` (es pintava mig fora de la graella)
- **Dessincronització soundline↔matriu (plano-modular)**: el `min-height` del matrix-container
  la inflava més enllà de la fila (clientH 624 vs 415 → maxScroll diferents → mirall clampat).
  Fix: contenidors a alçada de fila exacta; floor anticol·lapse mogut a `.plano-container`.
  + scroll single-writer a App19/App20 (s'anima només la matriu; la soundline segueix via
  setupScrollSync). Verificat amb Chrome headless (CDP) amb mesures i captures.
- **Click12/Click13 eliminats** (motor + dropdown; app9 migra `accentSound` a `click2`)
- **Fix octava App23/24**: l'octava de la cromàtica (i=12) il·lumina el 0' de DALT de la
  soundline escala (abans repetia el 0 de baix per `indexOf` de classe de nota)
- **Polifonia de samples**: el canal *seleccionado* era l'únic amb truncadura a 1 interval
  (`source.stop(start+intervalRef)`, herència del click11); eliminada + test de regressió.
  El motor ja era polifònic (BufferSource independent per tret) — ara cap cua es talla.
- **LH-20 refutada**: la validació d'edició iT d'App31 funciona; l'observació era un artefacte
  del sondeig sintètic (`.value` directe + `blur()` headless sense event). Lliçó: verificar
  fluxos de focus/blur amb events de confiança (CDP `Input.*`), mai mutació directa.

### Tàctil (U-21/U-12)
Drag de notes/intervals migrat a Pointer Events (pointerId guard + pointercancel):
`interval-note-drag.js` (App20), drag inline d'App15, `matrix-seq/drag.js`
(elementFromPoint per la captura implícita; fix de listeners duplicats) i
`interval-drag-handler.js` (òrfena, llesta per a adopció H-03: listeners només durant el
drag + rect cachejat). `touch-action: none` quirúrgic: `.np-dot`, `.mixer-channel__slider`,
`.timeline` — les graelles segueixen scrollant. Verificat amb touch real
(CDP `dispatchTouchEvent`): App20 crea nota iT=3 amb el dit; App15 crea barra d'interval.

## Metodologia consolidada
- Harness CDP (Chrome headless + `http-server`) per a mesures de DOM reals, captures,
  events de confiança (`Input.dispatchMouseEvent/TouchEvent/insertText`) i A/B contra
  worktrees baseline. Scripts a `/tmp/cdp-*.mjs` (no es versionen).
- Sessions paral·leles comparteixen el repo: staging sempre amb llista explícita de fitxers.

## Estat final
- Suite: **74 suites / 1480 tests** verds a cada commit
- Informe: **27/144 tancades** (25 marcades + 2 de la passada docs) + 3 refutades
- Docs sincronitzats: comptes (53 mòduls app-common, 74/1480 tests), enllaços de MODULES.md,
  referències a mòduls esborrats, READMEs de pulse-seq/interval-sequencer, política BPM 9+
