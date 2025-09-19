## Propòsit
- Visualitzar i sonoritzar subdivisions rítmiques amb timeline lineal/circular compartit amb altres apps del Lab.
- Servir com a banc de proves de PulseMemory (1..Lg-1; 0/Lg derivats) sincronitzat amb `computeNextZero`.

## API pública
- `main.js`: arrencada de la UI, integració amb `TimelineAudio`, exposició d'esdeveniments `sharedui:*`.
- HTML associat (`index.html` a l'arrel del Lab) carrega aquesta app via bundler clàssic.

## Flux principal
1. `renderHeader` (shared-ui) monta la capçalera i crea els desplegables de so.
2. `initDefaults` carrega estat desat i invoca `handleInput` per calcular subdivisions.
3. Els events d'usuari (play, loop, random, tap) actualitzen `TimelineAudio` i la timeline via `layoutTimeline` i `highlight*`.
4. El mixer compartit sincronitza mute/solo amb `setPulseAudio` i `setCycleAudio`.

## Estat
- Dependència directa de DOM i WebAudio; no hi ha router ni estat global extern.
- Persistència via `localStorage` sota prefix `app3::*`.
- PulseMemory 1..Lg-1; re-sync de 0/Lg a cada `computeNextZero`.

## Candidats a obsolets
- [ ] Revisar `tapTempo` per eliminar lògica heretada de App1 quan arribi la migració de `Tone.js`.
- [ ] Consolidar `handleInput` amb flux reactiu compartit quan es porti App3 a framework modern.

## Tests

Executa les proves amb `npm test` des de l'arrel del repositori.
