# App4: Pulsos Fraccionados — polirítmia amb anells concèntrics

## Purpose

Fins a **3 fraccions simultànies** (n/d) sobre un pols base, representades
SEMPRE com a **anells concèntrics** (no hi ha timeline lineal ni editor
numèric). Tema nuzic. Eina de polirítmia: cada fracció sona com una veu pròpia
i es visualitza com un anell amb el seu radi segons la velocitat.

## Model (clau)

- **3 slots de fracció** (`fractionSlots[]`): F1 groc, F2 rosa, F3 blau.
  F1 visible per defecte; el control **+/−** global afegeix/treu fraccions
  (added ≡ active: una fracció és visible o no hi és). Rangs n∈[1,7], d∈[1,12].
- **Lg NO és lliure**: `Lg = cicle gran × m`, on cicle gran = mcm dels
  numeradors REDUÏTS de les fraccions actives (els denominadors no hi
  influeixen), i `m` és la pastilla **"Cicles"**. Lg és un display CALCULAT
  (readonly). `MAX_LG = 210 = mcm(5,6,7)`; `validateFractionCombo` rebutja
  combinacions amb cicle > 210 (xarxa de seguretat, inassolible amb n≤7).
- **BPM per defecte 90** (`app4:bpm`); sense V el play no arrenca.
- **Bucle permanent** (no hi ha botó loop): la reproducció sempre cicla.

## Representació: anells concèntrics

- Mòdul compartit `libs/app-common/circular-rings.js` (+ `.css`). Cercle base
  (pols, referència R₀ fixa) + un anell per fracció activa. **Radi ∝
  velocitat**: `r = R₀·(d/n)^0.35`, després separació mínima (GAP) i clamp.
  Densitat adaptativa (mida de punt, etiquetatge "rellotge", línies de cicle).
- **Bandes gruixudes**: fraccions `RING_STROKE = 32`; l'anell base (pulsos) és el
  doble (`BASE_STROKE = 64`) i creix cap ENDINS (vora exterior fixa → no mou les
  fraccions) per encabir-hi els **números** (terç interior, clars sobre el fosc)
  i els **punts** (part exterior). Les fraccions lentes (cap endins) esquiven la
  banda base ampla amb clearança extra. `RMAX = 270` perquè 4 bandes de 32px
  càpiguen sense solapar. Punts r≤10.
- **Accent de selecció**: App4 unifica el **verd nuzic** (`var(--nuzic-green)`)
  per a seleccionats/actiu/origen a TOTS els anells (el mòdul, per defecte,
  derivaria `saturatedAccent()` = versió saturada del color de cada anell). El
  **pols 0** és un contorn BUIT de l'accent (origen, no selecció).
- **Cercle de pulsos en CREMA**: l'anell base es pinta amb `--nuzic-yellow-light`
  (fons de les timelines) en lloc del fosc; números/punts a fosc per contrast.
  Override scoped a `.app4 .crings-ring-group[data-ring-id="base"]` amb
  `!important` (circular-rings.js posa `--crings-color` inline al grup).
- **Selecció per CLIC** (no hi ha editor de text): als anells (enters al cercle
  base, ticks fraccionats a cada anell de fracció) o a la partitura — totes dues
  vies escriuen el MATEIX estat (vegeu §Partitura per al hit-test del clic).

## Estat / selecció

- `fraction-selection.js`: `fractionStore` (claus `frac:base:n:d`,
  multi-fracció), `fractionMemory`. `pulseMemoryApi` =
  `createPulseSeqController().memory` (el controller NO es munta; només la
  memòria de pulsos).
- Persistència `app4:*`: `n`/`d` (F1, claus LEGACY), `n2`/`d2`, `n3`/`d3`,
  `f1on`/`f2on`/`f3on`, `cycles`, `bpm`, `random`, `sound:<canal>`, theme,
  mute, color, toggles.

## Random

- `randomize()` + `randomizeFractional` (libs/random). Toggles al menú:
  Lg/V/n/d/Pulsos.
- **Selecció (Pulsos)**: encén punts a l'atzar sobre TOTS els anells — enters
  (`pulseMemory`) + ticks de subdivisió de cada fracció activa
  (`applyRandomRingFractionSelection`, que els construeix com un clic d'anell →
  clau idèntica, sincronitzen amb anells/partitura/àudio). L'antic camí basat en
  el `hitMap` de DOM de l'App4 lineal ja no existeix als anells.
- **Fraccions (n/d)**: sorteja el n/d dels slots ACTIUS (enabled per defecte;
  filtre `slot.added && slot.active`; els inactius no es toquen). Després el Lg
  es recalcula i la selecció es regenera sobre la graella nova.

## Àudio polirítmic (libs/sound, additiu — worklet intacte)

- La PRIMERA fracció activa sona pel camí de cicle LEGACY (fase alineada); les
  altres com a **veus** (`setVoices`) pre-agendades al lookahead.
- Mixer: parelles per fracció — **Pulso · Seleccionado · Fracció N · Fracció N
  sel.** Cada canal té **selector d'instrument propi** (`setChannelSound`).
  Només es mostren els canals de les fraccions ACTIVES
  (`syncMixerChannelVisibility` → `data-fN-on` al body). `setCycleChannel`
  reapunta el bus de cicle al canal del slot principal.

## Partitura: sistema multi-pentagrama

- `libs/notation/notation-system.js` (via `createNotationRenderer` amb
  `getActiveFractions`): tots els pentagrames (base "Pulso" + un per fracció
  activa) en **UN SOL SVG amb UN Formatter compartit** → cops simultanis
  alineats, scroll horitzontal únic, un playhead que travessa el sistema.
  Les notes es posicionen per **temps** (`setXShift`), no pels ticks de
  VexFlow (que es corrompen amb tuplets densos exòtics 5/11, 7/10, 7/11).
- **Clic = selecció per posició REAL del glyph**: `handleClick` NO depèn de quin
  element rep el clic del navegador (l'SVG té `pointer-events:none` i, amb el
  `setXShift`, l'únic `<rect>` clicable intern de VexFlow queda desalineat ~67px
  del cap → el clic queia 1-2 posicions enllà). Calcula la nota més propera per
  la posició REAL del `.vf-notehead` al DOM (pentagrama per Y, glyph per X) i
  despatxa amb els `data-*` del propi element.
- El **toggle de partitura** viu a la fila `.controls` (classe `notation-ctrl`,
  cercle teal entre tap i reset), NO al top-bar. El panell s'obre com a **"full"**
  que tapa inputs/fraccions/anells; clic al backdrop o al toggle el tanca; els
  controls queden visibles a sobre.
- **Sense top-bar**: `header.top-bar` amagat (`display:none` scoped `.app4`) per
  guanyar espai vertical. El mute (`.sound-wrapper`) sobreviu perquè nuzic ja el
  mou a `.controls` (`relocateSoundWrapperForNuzic`).
- **Botó info (∑)** a `.controls`, a l'esquerra del reset i amb la seva estètica
  (cercle fosc; `.info-ctrl`, order:5, insertBefore reset). Obre `#infoPanel`
  (pastilla flotant nuzic) amb la matemàtica: Lg, cicles, cicle gran =
  mcm(numeradors), mcm(denominadors), fraccions actives (n/d + reduït).
- **Exportació PNG** (`notation-export-btn`, cantonada dreta superior del full):
  rasteritza l'SVG a `<canvas>` 2x i descarrega. CAL incrustar la font **Bravura**
  (data-URI woff2 de VexFlow, import lazy) com a `@font-face` dins l'SVG abans de
  rasteritzar; sense això els caps surten com a **rectangles** ("tofu") perquè
  l'SVG-com-a-imatge no veu les fonts de la pàgina.
- `rhythm-staff.js` (via single fraction) queda per a App2/App5 — NO es toca.

## Dependencies

`libs/app-common/` (audio/dom/fraction-editor/loop/mixer/preferences/
circular-rings/visual-sync) + `libs/notation/` + `libs/shared-ui/` + `libs/sound/`.

## Notes per a Claude

- Redisseny complet documentat a `SESSION_STATE.md` (fases F1–F6 + F6.scroll
  fetes; després: fixos de random/clic, botó de partitura a controls, export
  PNG; F7 panell ⓘ pendent) i a l'esbós `docs/app4-rings-sketch.html`.
- Arnès de depuració de partitura amb Chrome real (CDP, sense puppeteer): script
  `/tmp/cdp.mjs` (WebSocket cru) + scripts ad-hoc. `Log.enable` és imprescindible
  (els errors de `<rect>` SVG no surten per console); per al clic/posicions cal
  mesurar geometria REAL al DOM (jsdom NO fa layout SVG → no detecta aquests bugs).
