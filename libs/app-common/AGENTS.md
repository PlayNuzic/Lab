## Propòsit
- Agrupar utilitats compartides entre Apps (menús, audio bridges, càlculs bàsics).
- Evitar duplicació de lògica present en múltiples apps del Lab.

## API pública
- `audio.js`: bridge de scheduling i binding d'events `sharedui:*`.
- `random-menu.js`: inicialització de menús aleatoris.
- `range.js`: helpers `toNumber`, `toRange` per normalitzar configuracions.

## Flux principal
1. Les apps importen els helpers requerits (`createSchedulingBridge`, `toRange`, etc.).
2. Cada helper encapsula accés a storage o DOM segons l'àrea (audio, menús, rangs).
3. Els tests a `*.test.js` asseguren que la regressió comuna queda coberta amb Jest.

## Candidats a obsolet
- [ ] Consolidar les còpies locals de `toRange` (TODO[audit] a range.js) començant per `Apps/App2`.
