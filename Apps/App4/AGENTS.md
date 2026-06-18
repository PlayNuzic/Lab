## Propòsit
- Eina de **polirítmia**: fins a **3 fraccions simultànies** (n/d) sobre un pols
  base, representades SEMPRE com a **anells concèntrics** (no hi ha timeline
  lineal ni editor numèric de pulsos). Tema nuzic.
- Cada fracció sona com una veu pròpia i es visualitza com un anell amb el radi
  segons la velocitat. La selecció es fa per CLIC (anells o partitura).

> Detall arquitectònic complet a `Apps/App4/CLAUDE.md`. L'App4 lineal original
> (pulseSeq + LEDs + timeline) es conserva CONGELADA a **App4B** — no es toca.

## Flux principal
1. `bindAppRhythmElements('app4')` retorna `elements`. `reorderControls()` posa la
   fila nuzic (Play · Random · Tap · Notació · Reset) i s'hi afegeix el botó ∑
   (info) a l'esquerra del reset. NO hi ha botó loop: el bucle és permanent.
2. `createSchedulingBridge` + `bindSharedSoundEvents` connecten els events
   `sharedui:*`; `TimelineAudio` es crea lazy amb `createRhythmAudioInitializer`.
   BPM 90 per defecte (`app4:bpm`).
3. `createPreferenceStorage({ prefix: 'app4', separator: ':' })` concentra
   localStorage (n/d dels 3 slots, flags f1/2/3on, cycles, bpm, random, sons per
   canal, tema, mute, color). `registerFactoryReset` / `setupThemeSync` /
   `setupMutePersistence`.
4. **3 slots de fracció** (`fractionSlots[]`, F1 groc / F2 rosa / F3 blau): cada
   un és un `createFractionEditor({ mode: 'block' })` dins `.fraction-row`. El
   control **+/−** global afegeix/treu fraccions (added ≡ active). `handleInput`
   recalcula tot a cada canvi.
5. **Model Pulsos/Ciclos** (`Lg = cicle gran × m`): el pill EDITABLE mostra
   **Pulsos** (= `inputLg`, `.value === Lg`); el visor READONLY mostra **Ciclos**
   (= m = Lg/cicle gran). Cicle gran = mcm dels numeradors reduïts de les
   fraccions actives (vegeu `computeBigCycle`). `MAX_LG = 210`.
6. **Anells**: `createCircularRings` (libs/app-common/circular-rings.js) renderitza
   el cercle base (pols, en crema) + un anell per fracció. Clic → selecció; les
   seleccions viuen a `fractionStore`/`fractionMemory` (`fraction-selection.js`).
7. **Partitura**: `notation-system.js` (un SVG, N pentagrames apilats, 1 formatter)
   via `createNotationRenderer` amb `getActiveFractions`. Toggle a `.controls`;
   panell "full"; exportació PNG amb Bravura incrustada.
8. **Àudio polirítmic** (libs/sound, additiu): la 1a fracció activa pel camí de
   cicle LEGACY; les altres com a **veus** (`setVoices`). Mixer amb parelles per
   fracció (Pulso · Seleccionat · Fracció N · Fracció N sel.), selector
   d'instrument per canal (`setChannelSound`).
9. **Panell ∑** (info): `computePolyrhythmInfo` (libs/app-common/polyrhythm-info.js)
   calcula cicle gran, velocitats V·d/n, pulsos fracc/cicle i proporció reduïda.
   Recàlcul en viu; es tanca clicant fora (tret del botó ∑, `.inputs` i `.middle`).

## Estat i emmagatzematge
- `localStorage` via `preferenceStorage` (`app4:*`): n/d (F1 claus LEGACY,
  F2/F3 → n2/d2, n3/d3), f1on/f2on/f3on, cycles, bpm, random, `sound:<id>`,
  tema, mute, color.
- Estructures locals: `fractionSlots`, `fractionStore`, `fractionMemory`,
  `pulseMemoryApi` (= `createPulseSeqController().memory`, el controller NO es
  munta), `rings` (instància de circular-rings).
- Flags: `isPlaying`, `isUpdating`, `currentAudioResolution`,
  `lastActiveFractionsSignature`, `lastRenderedLg`.

## Dependències compartides
- `libs/app-common/` (`audio.js`, `audio-init.js`, `dom.js`, `fraction-editor.js`,
  **`circular-rings.js`** + `.css`, **`polyrhythm-info.js`**, `mixer-menu.js`,
  `audio-toggles.js`, `preferences.js`, `subdivision.js`, `transport-live-update.js`,
  `visual-sync.js`, `template.js`, `info-tooltip.js`, `spinner-repeat.js`,
  `number-utils.js`) + `fraction-selection.js` (local).
- `libs/notation/` (`notation-system.js` via `panel.js` + `renderer.js`, lazy VexFlow),
  `libs/pulse-seq/` (només `.memory`), `libs/random/`, `libs/shared-ui/`, `libs/sound/`.

## Tests
La matemàtica polirítmica té tests propis (`polyrhythm-info.test.js`); els anells
(`circular-rings.test.js`). La resta via mòduls compartits. La partitura
(`notation-system`) es verifica amb Chrome real (CDP) — jsdom no fa layout SVG.
Executa `npm test` després de qualsevol canvi.
