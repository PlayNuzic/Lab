# App32-35 — visualització d'intervals estil App15/App25B (2026-06-30)

## Objectiu

Migrar la graella d'**App32-35** (plano-modular + fracció / N-iT) perquè tingui
el mateix aspecte que **App15/App25B**: línies i números d'interval, np-dots de
grab, halters d'iT i línies de silenci. Sense canviar com funcionen (model de
fracció / N-iT intacte) i aplicant les lliçons de sincronia apreses migrant App25B.

## Mòdul compartit nou

**`libs/interval-overlay/`** (`index.js` + `interval-overlay.css` + README + 8 tests):
overlay de línies/números d'interval (idèntic a App15) per a QUALSEVOL graella
posicionada. Per a cada parella de notes consecutives: barra vertical amb fletxa
(asc/desc) + punt d'origen, cas interval-zero (barra curta + "0"), i caixa del
número (delta), tot en **% EXACTE**. Classes dedicades `iv-*` (sense guerres de
especificitat). Opció `showNumbers`, ancoratge de vora dels números. App15/App25B
NO es toquen (poden adoptar-lo després).

## Exactitud (causa arrel resolta)

Tot el posicionament horitzontal d'App32-35 era `índex × cellWidth` amb
`cellWidth = offsetWidth` (enter **arrodonit**) → amb columnes 1fr, deriva
acumulada (~7px mesurat a App32). **Fix**: posicionar en **% exacte**
(`col/totalColumns`); vertical en px (cellHeight enter, exacte). `renderNoteBars`
(shared) accepta `totalColumns` (mode % opt-in, retrocompatible amb el px legacy).
Resultat: gap barra↔cel·la **0px**.

## Per app (mateix patró)

- **np-dots a cada cel·la = handles de grab** (substitueixen el drag des del cos
  de la cel·la); jerarquia: dots de **pols sencer** (`.pulse-boundary`) opacity 1,
  de **subdivisió** opacity 0.3 (plens en hover). Pulsos fantasma (App33/35)
  marcats per ghost-pulse-lines.
- **Halters d'iT** sòlids; **discontinus** per als silencis (App34/35).
- **Línies de silenci** (`renderSilenceLines`, shared): línia discontínua a cada
  FORAT no cobert entre notes, continuant la fila de l'última nota. Forat inicial
  no es pinta. A App34/35 els silencis explícits de l'editor segueixen via
  `.note-bar--silence` (sense duplicar).
- **Fix primera fila** (estil App25B): `.plano-matrix-container { overflow: visible }`
  (en fr-mode no fa scroll) + ancoratge de vora → el "0" de dalt i les caixes de
  la columna 0 no es tallen.
- **Denominador ≥ 5**: s'amaguen els números d'iS i els d'iT del halter (només iT≤2).

## App-específic

- **App33/App35** (fracció complexa): l'overlay és agnòstic a la fracció (treballa
  amb columnes); ghost-pulse-lines intactes.
- **App34/App35** (editor N-iT): sincronia editor↔graella intacta; l'overlay i les
  línies de silenci es renderitzen a `renderNotes` (cap canvi a `handleZigzagChange`
  / `syncGridToZigzag`).

## Verificació

CDP/Chrome real a les 4 apps (gap 0px, overlay, np-dots, halters, silencis,
primera fila, d≥5). **Suite: 77 suites / 1385 tests.**

## Commits

- `df8b7485` — feat(app32-35): graella amb visualització d'intervals estil App15/App25B
- `c437f9b8` — feat(app32-35): línies de silenci als forats entre notes

## Fitxers

NOU `libs/interval-overlay/` (index.js, .css, README, test); `libs/app-common/
plano-note-renderer.js` (+test); `Apps/App32-35/{main.js,styles.css,index.html}`.
Docs: `docs/MODULES.md`, `libs/app-common/CLAUDE.md`, skill `nuzic-migrate`.
