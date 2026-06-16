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
- **Selecció per CLIC als anells** (no hi ha editor de text): enters al cercle
  base, ticks fraccionats a cada anell de fracció.

## Estat / selecció

- `fraction-selection.js`: `fractionStore` (claus `frac:base:n:d`,
  multi-fracció), `fractionMemory`. `pulseMemoryApi` =
  `createPulseSeqController().memory` (el controller NO es munta; només la
  memòria de pulsos).
- Persistència `app4:*`: `n`/`d` (F1, claus LEGACY), `n2`/`d2`, `n3`/`d3`,
  `f1on`/`f2on`/`f3on`, `cycles`, `bpm`, `random`, `sound:<canal>`, theme,
  mute, color, toggles.

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
  VexFlow (que es corrompen amb tuplets densos exòtics 5/11, 7/10, 7/11). El
  panell s'obre com a **"full"** que tapa inputs/fraccions/anells; clic al
  backdrop o a la clau de sol el tanca; els controls queden visibles a sobre.
- `rhythm-staff.js` (via single fraction) queda per a App2/App5 — NO es toca.

## Dependencies

`libs/app-common/` (audio/dom/fraction-editor/loop/mixer/preferences/
circular-rings/visual-sync) + `libs/notation/` + `libs/shared-ui/` + `libs/sound/`.

## Notes per a Claude

- Redisseny complet documentat a `SESSION_STATE.md` (fases F1–F6 + F6.scroll
  fetes; F7 panell ⓘ i F8 neteja/docs pendents) i a l'esbós
  `docs/app4-rings-sketch.html`.
- Arnès de depuració de partitura amb Chrome real (CDP) a `/tmp/cdp-*.mjs`:
  `Log.enable` és imprescindible (els errors de `<rect>` SVG no surten per
  console). El jsdom NO fa layout SVG → no detecta aquests bugs.
