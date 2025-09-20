## Propòsit
- Visualitzar i sonoritzar subdivisions rítmiques (fraccions n/d) sobre un timeline
  lineal o circular compartit amb altres apps del Lab.
- Exercir de banc de proves per PulseMemory, mixer compartit i sincronització amb
  `computeNextZero` i `TimelineAudio`.

## API pública
- `main.js`: arrencada de la UI, integració amb `TimelineAudio`, gestió dels
  esdeveniments `sharedui:*` i mixers.
- `utils.js`: reexporta utilitats visuals (`computeHitSizePx`, `computeNumberFontRem`,
  `solidMenuBackground`).
- L'HTML associat (`Apps/App3/index.html`) carrega aquesta app amb bundler clàssic.

## Flux principal
1. `createSchedulingBridge` i `bindSharedSoundEvents` uneixen el mixer global amb
   la capçalera compartida (sons base/start/cycle, mute, perfils de scheduling).
2. El formulari de fraccions munta editors accesibles (`fraction-editor`) i calcula
   subdivisions via `gridFromOrigin`, `computeSubdivisionFontRem` i `toPlaybackPulseCount`.
3. `initMixerMenu` registra canals `pulse` i `subdivision` al mixer compartit i
   sincronitza controls locals (botons Pulse/Cycle) amb `TimelineAudio`.
4. El menú aleatori (`initRandomMenu`) permet variar Lg/V i fraccions n/d; es
   persisteix sota el prefix `app3::*` juntament amb preferències d'àudio i tema.

## Estat i emmagatzematge
- `localStorage` (`app3::*`) guarda Lg/V, fraccions, configuració aleatòria i
  preferències Pulse/Cycle (audio enable/disable, mixer, tema).
- Variables locals controlen `isPlaying`, `loopEnabled`, `circularTimeline` i
  caches per a marcatge de cicles, bars i labels.
- `PulseMemory` calcula Lg-1 i sincronitza _highlights_ amb `computeNextZero`.

## Candidats a obsolets
- [ ] Revisar `tapTempo` per eliminar lògica heretada de App1 quan arribi la migració
  de `Tone.js`.
- [ ] Consolidar `handleInput` amb flux reactiu compartit quan es porti App3 a un
  framework modern.

## Tests
No hi ha suite dedicada; confia en les proves dels mòduls compartits amb Jest. Executa
`npm test` des de l'arrel abans de fer commit.
