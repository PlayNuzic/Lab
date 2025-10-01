## Propòsit
- Oferir el motor `TimelineAudio` (WebAudio + AudioWorklet) reutilitzat per totes
  les apps del Lab.
- Gestionar mixer global (`mixer.js`), assignació de mostres (`sample-map.js`) i
  helpers d'interacció (`user-interaction.js`).

## Components clau
- `index.js`: encapsula `TimelineAudio`, `ensureAudio`, control de loops,
  assignació de sons i sincronització amb `subscribeMixer`.
- `mixer.js`: manté estat reactiu per canals (`registerChannel`, `setVolume`,
  `setMute`, `solo`).
- `user-interaction.js`: detecta interacció d'usuari abans d'inicialitzar
  l'`AudioContext` (evita warnings en navegadors moderns).
- `sample-map.js`: càrrega i cache de mostres (usa `fetchSampleArrayBuffer`).

## Tests
- Suites: `index.test.js` i `mixer.test.js`. Es mockegen `fetch`, `AudioContext`
  i `AudioWorkletNode`.
- Executa `npm test` des de l'arrel. La suite genera `console.warn` controlats
  quan simula errors de `fetch`: no els eliminis sense ajustar els asserts.

## Bones pràctiques
- Evita accedir a `Tone.context` abans que l'usuari interactuï (usa
  `waitForUserInteraction`).
- Exposa mètodes asíncrons (`ready`, `setSound`) com a promeses per facilitar
  proves i reutilització.
- Si introdueixes nous canals o events, sincronitza'ls amb la capçalera compartida
  (`sharedui:*`) i documenta-ho als AGENTS d'apps.
