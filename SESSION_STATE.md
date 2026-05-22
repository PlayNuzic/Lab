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
  `matrix-highlight-controller` (sempre `false` en pràctica). ✅
- `7509493` — Mida unificada via `libs/shared-ui/nuzic-theme.css` (font
  canònica) a `.soundline-number`/`.pulse-marker`/`.plano-soundline-note`.
- `cc5f003` — **B1 RESOLT**. `matrix-highlight-controller` cridava
  `gridEditor.highlightCell('N', pulse)` que llançava `TypeError` als
  editors nuzic custom d'App12/15/25/25B. El throw avortava TOT el
  pulse callback. Fix: `typeof ... === 'function'` abans de cridar. ✅
- `608749f` — **B2 RESOLT**. `.play-highlight-layer` d'App15 z-index
  `4 → 15` (sobre cells, sota playhead). ✅
- `6f70d07` — **B2 (parcial) + B3 RESOLT**. `.play-note-highlight` sense
  `box-shadow`. Clamp reduït a `clamp(0.6rem, 1.2vw, 1rem)`. Pendent
  confirmar visual del clamp definitiu.
- `bc52d7a` — Cel·la sonant amb `var(--nuzic-blue, #7bb4cd)` (paleta
  canònica nuzic). Selectors prefixats `body[data-visual="nuzic"]` i
  `!important`.

### Bugs oberts

Cap actualment. Pendent confirmar visual del clamp `1rem` (si encara
és massa gran, anar a `0.9rem`).

---

## Pla de neteja — pendent (per ordre de risc creixent)

### Fase A — Risc nul (eliminar directament, sense validació visual)

- [ ] **App19**: eliminar 4 backup files orphans (~97KB)
  - `Apps/App19/index-original-backup.html`
  - `Apps/App19/index-test-migrated-backup.html`
  - `Apps/App19/main-backup-original.js`
  - `Apps/App19/main.js.backup`
- [ ] **App32-35**: eliminar imports `gridFromOrigin` (no usat) +
  `subdivToPosition` + wrapper local `subdivToPosition()` no cridat
  (4 apps).
- [ ] **App21**: eliminar funció local `createPlayButton()` (línia
  268) mai cridada (App21 usa la importada de `libs/soundlines/`).
- [ ] **App22**: eliminar funcions locals `sleep()` (línies 50-52) i
  `setPlayIcon()` (línies 204-209) duplicades — substituir per imports
  de `libs/soundlines/index.js` (com fa App21).

### Fase B — Risc baix (validació visual ràpida d'una app per canvi)

- [ ] **8 apps amb `--nuzic-controls-offset-x/y`** declarats mai
  consumits: app9, app10, app11, App11A, App12, app13, App14, App15.
  Eliminar la declaració del CSS.
- [ ] **App22**: eliminar `transform: translateX(--soundline-header-offset)`
  (línia 394 d'styles.css) — override ja sobreescrit pel selector
  amb `transform: none`.
- [ ] **App25/25B**: eliminar `main { padding: 0 }` redundant
  (cobert per `libs/shared-ui/app-viewport.css`).
- [ ] **App30**: substituir array `pulseNumberLabels` (línies 57,
  804, 828, 882) per ús directe de `pulses` (duplicat exacte).
- [ ] **App28/App29**: investigar `pulseSequence: true` al
  `index.html` — `#pulseSeq` es detach i mai s'usa. Si es
  confirma innecessari, canviar a `pulseSequence: false`.
- [ ] **Apps 32-35**: eliminar comentaris vestigials sobre
  `injectBpmAndSoundGroup` (línies 1269/1291/1845/1873 segons app —
  cap codi associat).

### Fase C — Risc mitjà (afecten múltiples apps via libs)

- [ ] **App11/11A/12/15**: eliminar `<link>` a `musical-grid.css`
  del `index.html` — ja s'importa via `@import` al `styles.css`.
  Doble càrrega + ordre de cascada confús.
- [ ] **libs/musical-grid/musical-grid.css**: eliminar regles base
  `.soundline-number { font-size: 1.1rem; ... }` (línia 147+) i
  `.pulse-marker { font-size: 1.4rem; ... }` (línia 486+) — totes
  les apps consumidores (App11/11A/12/15/25/25B) són nuzic-only
  i el tema sobreescriu via `body[data-visual="nuzic"]`. Cap App1-10
  fa servir musical-grid (validat amb grep).
- [ ] **libs/plano-modular/plano-modular.css**: avaluar si eliminar
  variables `--plano-cell-bg` / `--plano-grid-line-color` (línies
  24-34) — el nuzic-theme les fa transparents. Conservador: mantenir
  com a fallback.

### Fase D — Risc alt (canvis grans, validació extensiva)

- [ ] **libs/shared-ui/bpm-inline.css**: ~170 línies de regles
  pre-nuzic completament sobreescrites pel tema (línies 8-176).
  Requereix validar TOTES les apps amb BPM display (App9-35
  bàsicament). Patró: mantenir només les regles que el tema NO
  toca, eliminar la resta.
- [ ] **Auditoria semestral**: una vegada totes les fases A-C
  fetes, re-executar la skill `nuzic-migrate` punt Step 15 (audit
  script) per detectar nous orphans, imports no usats o overrides
  morts.

---

## Lliçons apreses

- **TypeError silenciós a pulse callbacks**: si un mètode opcional
  d'un objecte (`gridEditor.highlightCell`) no existeix i el codi
  l'invoca sense check, el throw avorta TOT el callback. Símptoma
  típic: una funcionalitat posterior al throw "no s'aplica" sense
  cap pista visible. Sempre usar `typeof X === 'function'` o
  optional chaining `X?.()` per mètodes opcionals d'objectes
  d'interfície compartida.
- **z-index a layers overlay**: un layer absolute sobre la matriu
  ha de tenir z-index per sobre de les cel·les actives. La default
  `--z-interactive: 10` és el llindar mínim per cobrir-les.
- **Specificity wars amb nuzic-theme**: regles `body[data-visual="nuzic"]
  .X` (specificity (0,2,1)+) sempre cal igualar o superar quan
  s'override des d'una lib o un app. `!important` ajuda però si
  els dos competidors el tenen, la specificity decideix.

## Finalització

Quan totes les fases del pla de neteja (A-D) estiguin completes (o
l'usuari decideixi aturar): arxivar aquest fitxer a
`docs/session-history/YYYY-MM-DD-nuzic-cleanup.md` i deixar
SESSION_STATE.md buit fins a la pròxima tasca llarga.
