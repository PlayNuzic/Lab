# SESSION_STATE — Neteja dead code + visual cel·la sonant (Apps 9-35)

> Inici: 2026-05-22. Apps 9+ són ara nuzic-only (cap retro-compat amb
> tema pre-nuzic). Es neteja dead code a passades petites i s'està
> polint el visual de cel·la sonant + clamps de tipografia.
>
> SESSION_STATE anterior (refactor nuzic complet, ~2300 línies)
> arxivat a `docs/session-history/2026-05-14-nuzic-migration-complete.md`.

## Estat actual

### Fet i validat

- `32a0977` — Eliminat `.musical-cell.pulse-highlight` (halo groc per
  columna) + paràmetre `highlightActiveCells` retirat del
  `matrix-highlight-controller` (sempre `false` en pràctica). ✅ User
  confirma no apareix halo groc a cap app.
- `7509493` — Mida unificada via `libs/shared-ui/nuzic-theme.css` (font
  canònica) a `.soundline-number`/`.pulse-marker`/`.plano-soundline-note`.

### Fet, PENDENT validació

- `a782142` — `.musical-cell.playing::before` amb `content` + selectors
  `body[data-visual="nuzic"]` per igualar specificity. Clamp max
  reduït a `1.25rem`. User reporta encara bugs (vegeu B1, B2, B3).

## Bugs oberts (per resoldre)

### B1 — App12/25/25B no mostren blau intens a la cel·la sonant

- App11 SÍ funciona (té `.playing` afegit explícitament + `cell.classList.add('active')`)
- App12/25/25B afegeixen `.playing` via JS però visualment no canvia res
- Hipòtesi: el `.musical-cell.playing { background: blue !important }`
  hauria de guanyar contra `body[data-visual="nuzic"] .musical-cell
  { background: transparent }` per `!important`, però potser hi ha
  alguna altra regla amb specificity superior. Cal verificar amb
  DevTools live quina regla guanya per la propietat `background`.

### B2 — App15: halo blau "per darrera" la nota

- El `.play-note-highlight` té `box-shadow: 0 0 12px var(--nuzic-blue)`
- El glow es projecta fora del rectangle → visible com a halo
- Solució: reduir glow a 4-6px o eliminar-lo

### B3 — Clamp 1.25rem encara massa gran a viewports grans

- Captura de l'usuari mostra "11" ~3x més gran que els dashes adjacents
- Cal baixar el max a `1rem` o `0.9rem`
- Possible també reduir el vw de `1.5vw` a `1.2vw` per pujada més
  conservadora

## Plà immediat

1. **B1**: Diagnostic live (l'usuari obre DevTools, comprova què
   guanya). Si la regla `.playing` realment no s'aplica, pujar
   specificity fins guanyar inequívocament o canviar enfocament
   (e.g. pseudo-element absolut layer-aware).
2. **B2**: Reduir `box-shadow` del `.play-note-highlight` d'App15.
3. **B3**: Provar `clamp(0.6rem, 1.2vw, 1rem)` a les 3 propietats del
   `nuzic-theme.css`.

## Findings d'auditoria pendents (per fases futures)

Després de resoldre B1/B2/B3, atacar la resta de dead code per ordre
de risc creixent:

### Risc nul (pot fer-se sense validació visual)

- **App19**: 4 backup files orphans (~97KB) — `index-original-backup.html`,
  `index-test-migrated-backup.html`, `main-backup-original.js`,
  `main.js.backup`
- **App32-35**: `gridFromOrigin` import no usat + `subdivToPosition`
  import + wrapper local no cridat (4 apps)
- **App21**: `createPlayButton()` mai cridada

### Risc baix (validació visual rapida d'una app)

- **8 apps** amb `--nuzic-controls-offset-x/y` declarats al CSS però
  mai consumits: app9, app10, app11, App11A, App12, app13, App14, App15
- **App22**: `transform: translateX(--soundline-header-offset)` (override
  mort, ja sobreescrit per `transform: none`)
- **App22**: `sleep()` (línies 50-52) i `setPlayIcon()` (línies 204-209)
  duplicats — substituir per imports de `libs/soundlines/index.js`
- **App25/25B**: `main { padding: 0 }` redundant (cobert per
  `libs/shared-ui/app-viewport.css`)
- **App30**: `pulseNumberLabels` (4 referències) duplicat exacte de
  `pulses` array

### Risc mitjà (afecten múltiples apps via libs)

- **App11/11A/12/15**: `<link>` musical-grid.css duplicat amb `@import`
  al styles.css
- **libs/musical-grid/musical-grid.css**: base `.soundline-number` /
  `.pulse-marker` rules — parcialment sobreescrits per nuzic-theme.
  Removible només si confirmem que NINGÚ usa musical-grid sense
  nuzic tema (validat: cap App1-10 ho fa).
- **libs/plano-modular/plano-modular.css**: variables
  `--plano-cell-bg`/`--plano-grid-line-color` (overrides via
  nuzic-theme) — segures de mantenir com a fallback.

### Risc alt (canvis grans, validació extensiva)

- **libs/shared-ui/bpm-inline.css**: ~170 línies de regles pre-nuzic
  sobreescrites per nuzic-theme. Requereix validar TOTES les apps
  amb BPM display.

## Finalització

Quan tot estigui resolt: arxivar aquest fitxer a
`docs/session-history/YYYY-MM-DD-nuzic-cleanup.md` i deixar
SESSION_STATE.md buit (o eliminar-lo) fins a la pròxima tasca llarga.
