# SESSION_STATE

## Tasca activa (iniciada 2026-06-30)

**Migrar la graella d'App32, App33, App34 i App35 perquè tinguin el mateix
aspecte que App15 i App25B** — línies i números d'interval, afordança de grab
als np-dot, i halters d'iT (amb variant discontínua per als silencis) — SENSE
canviar com funcionen (model de fracció / N-iT intacte). I actualitzar la
sincronia editor↔graella amb tot el que es va aprendre migrant App25B.

### Estat actual confirmat (auditoria amb 3 agents, 2026-06-30)

- Les **4 apps ja estan nuzificades** i usen `libs/plano-modular/plano-grid.js`.
  El contenidor `.plano-matrix` és `position: relative` → host vàlid per a
  l'overlay absolut (anàleg del matrix-container d'App15/musical-grid).
- **Model canònic idèntic a les 4**: `notes = [{ note: 0-11, startSubdiv,
  duration, isRest? }]`. Les **columnes són subdivisions** (fracció-aware),
  no pulsos. `getTotalSubdivisions() = (Lg * d) / n`.
- **Ja renderitzen** (via `renderNotes()`): barres de nota blaves (`#bdd9e6`,
  `renderNoteBars` de `libs/app-common/plano-note-renderer.js`) + **halters
  d'iT grocs** amb el MATEIX `createIntervalLabelBar` (`libs/shared-ui`) que
  App15/25B (label = `duration`).
- **Els FALTA**: barres d'interval verticals (fletxa + punt d'origen),
  interval-zero, caixes de número, afordança **np-dot**, i la variant
  **discontínua** dels halters per a silencis.
- **App32** (n=1, Lg=12) i **App33** (n=2-6, Lg variable, ghost-lines):
  fracció + **arrossegar a la graella** per crear notes (NO editor; sense
  `isRest` explícit — els forats són buits).
- **App34** (n=1) i **App35** (n complexa): + **editor N-iT zigzag** sota la
  graella amb sync bidireccional `handleZigzagChange()` ↔ `syncGridToZigzag()`
  (amb `suppressNotify` per evitar el bucle). Aquí SÍ hi ha `isRest` ('S').
- **No existeix cap overlay d'intervals a `libs/`**: App15 i App25B el tenen
  INLINE (`createIntervalLine`). → Cal crear-ne un de reutilitzable (regla #1).

### ⚠️ Causa d'imprecisió detectada (requisit: graella IGUAL d'acurada que App15)

Tot el posicionament horitzontal d'App32-35 és `índex × cellWidth` amb
`cellWidth = firstCell.offsetWidth` (**enter arrodonit**). Amb `columnSizing:'fr'`
les columnes reals són fraccions exactes de l'ample del matrix → `índex ×
offsetWidth` **deriva** progressivament. Mesurat a App32 (d=2, 24 cols):
offsetWidth=41px vs real=40,67px → **deriva 7,6px** a l'última columna; nota al
col 21 amb **gap 6,95px** respecte a la cel·la (`/tmp/app32-before.png`). Afecta
`renderNoteBars` (shared, només App32-35), `renderNoteHalters`, el preview de
drag i el playhead.

**Fix (com App15)**: posicionar per **% exacte** (`col/totalColumns`,
`(noteCount−note)/noteCount`), MAI per `offsetWidth` arrodonit. Una sola font de
geometria per a barres, halters, línies, np-dots, drag i playhead → tot encaixa
sobre els punts de la graella. Bonus: elimina el recompute de cellWidth.

### Progrés

- ✅ **Mòdul compartit `libs/interval-overlay/`** (index.js + .css + test): barres
  asc/desc amb fletxa + punt, interval-zero, caixes de número, en **% exacte**.
  Opció `showNumbers`. Ancoratge de vora (col 0 → dreta, última → esquerra) perquè
  les caixes no surtin del grid. 8 tests verds.
- ✅ **`renderNoteBars`** (shared): mode **% exacte** opt-in via `totalColumns`
  (retrocompatible amb px; App33/34/35 segueixen en px fins migrar-les). +2 tests.
- ✅ **App32 (referència) COMPLETA i verificada amb CDP**:
  - Exactitud: gap barra↔cel·la **0px** (era 6,95px). Barres/halters/drag/preview en %.
  - Overlay d'intervals (línies+números+zero), número = delta de semitons, base 0.
  - **np-dots a cada cel·la = handles de grab** (substitueix el drag des del cos de
    la cel·la); agafar+arrossegar fixa la durada. Notes es treuen clicant el note-bar.
  - **Fix primera fila** (estil App25B): `.plano-matrix-container { overflow: visible }`
    (en fr-mode no fa scroll) → el "0" de dalt i les caixes no es tallen; + ancoratge
    de vora a l'overlay per a la columna 0.
  - **d≥5**: s'amaguen els números d'iS (es conserven barres/fletxes) i els números
    d'iT del halter només si iT≤2 (bracket es conserva; iT≥3 manté número).
  - **Jerarquia np-dots**: els dots de pulsos FRACCIONATS (subdivisions, no
    `.pulse-boundary`) es veuen més fluixos (opacity 0.3) que els de pulsos SENCERS
    (opacity 1); en hover recuperen força plena. Els pulsos "fantasma" (App33/35)
    segueixen marcats per les ghost-pulse-lines. Verificat a App33 (cols sencers
    0,3,6,9,12,15 forts; subdivisions fluixos).
  - Suite completa verda: **77 suites / 1380 tests**.
- ✅ **App33** (fracció complexa): mateixos canvis; verificat amb CDP (2/3, 18 cols,
  gap 0px, overlay +3/+5/−3, ghost-pulse-lines intactes, 216 np-dots).
- ✅ **App34** (N-iT editor + simple): mateixos canvis + **halters DISCONTINUS per
  `isRest`** (alineats amb la fila de l'última nota). Verificat: grid-grab (overlay
  +5/+3, gap 0, sync editor) + editor nota-silenci-nota (1 dashed halter, 2 solid,
  overlay salta el silenci, +5/+3).
- ✅ **App35** (N-iT editor + complexa): mateixos canvis. Verificat: 2/3, dashed
  halter per silenci, overlay +4, ghost-lines (6) intactes, 216 np-dots.
- ✅ **Suite completa: 77 suites / 1380 tests** després de les 4 apps.
- ⏳ **Pendent**: actualitzar documentació (skill nuzic-migrate matrix App32-35 +
  nota del mòdul `interval-overlay`) i arxivar SESSION_STATE. Commit quan l'usuari
  ho demani (només els fitxers d'aquesta conversa).

### Fitxers tocats (per al commit quan es demani)

- NOU: `libs/interval-overlay/index.js`, `interval-overlay.css`, `__tests__/interval-overlay.test.js`
- `libs/app-common/plano-note-renderer.js` (+ `__tests__/plano-note-renderer.test.js`)
- `Apps/App32/{main.js,styles.css,index.html}`
- `Apps/App33/{main.js,styles.css,index.html}`
- `Apps/App34/{main.js,styles.css,index.html}`
- `Apps/App35/{main.js,styles.css,index.html}`
- `SESSION_STATE.md`

### Pla (staged, per no trencar res)

0. **Fonament d'exactitud**: passar tot el posicionament de plano (renderNoteBars
   shared + halters/drag/playhead de cada app) de `índex × offsetWidth` a **%
   exacte**. Verificar que les barres encaixen (gap→0).
1. **Crear `libs/interval-overlay/`** (mòdul compartit): donat un matrix
   posicionat + events `[{note, column, durationCols, isRest}]` + geometria
   (files, totalColumns) + formatador de valor → dibuixa barres asc/desc amb
   fletxa + punt d'origen, interval-zero, i caixes de número, tot en **% exacte**
   (mateixa geometria que `createIntervalLine` d'App15, parametritzada). Amb
   `clear()`. (App15/25B podran adoptar-lo després; NO es toquen ara.)
2. **App32** primer (cas simple) → overlay des de `renderNotes()`, número =
   **delta de semitons** (`note₂−note₁`, cromàtic). np-dots a la línia de divisió
   (% exacte) + grab→drag-iT (App15, substitueix cell-drag). CDP before/after.
3. **App33**: igual sobre grid de fracció complexa (overlay agnòstic a la fracció).
4. **App34**: igual + sincronia editor↔graella amb lliçons d'App25B + halters
   discontinus per als `isRest`.
5. **App35**: App34 + fracció complexa.
6. `npm test` verd + tests de geometria del mòdul. Docs + arxivar.

### Lliçons d'App25B a aplicar a la sincronia

- Renderitzar graella i editor des de les MATEIXES dades canòniques amb forats
  omplerts (evita el bug "el silenci surt una acció tard").
- Omplir des de la posició 0 en reconstruir (anàleg `firstPulse→0`).
- Halters: z-index per sota de barres/números; re-render a resize+scroll;
  discontinu per silencis; **reset neteja l'overlay**.

### Decisió presa

- **Grab np-dot = com App15 (substitueix)**: els punts np-dot apareixen a la
  línia de divisió de cada cel·la; agafar un punt i arrossegar cap a la dreta
  crea la nota i fixa la durada (iT), SUBSTITUINT l'arrossegament actual des del
  cos de la cel·la. Paritat visual i funcional total amb App15 (que també
  arrossega el dot per editar iT). → s'ha de portar el patró de drag-iT d'App15
  (handlers horitzontals) i injectar np-dots a plano-modular (no en té de natius).

### Fora d'abast deliberat

- NO refactoritzar App15/App25B per usar el mòdul nou (queden intactes).

## Suite

`npm test` — córrer abans i després. Commits amb **llista explícita de fitxers**
(sessions paral·leles comparteixen el repo, mai `git add -A`).
