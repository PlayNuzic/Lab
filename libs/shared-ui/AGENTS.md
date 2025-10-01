## Propòsit
- Compartir la capçalera (`initHeader`) i components visuals comuns entre apps.
- Centralitzar tokens de tema i comportament de menús perquè el disseny sigui coherent.

## Mòduls
- `header.js`: inicialitza la top-bar, envia events `sharedui:*` (`theme`, `mute`,
  `selectioncolor`, `scheduling`), configura dropdowns de so i integra el
  `performance-audio-menu`.
- `sound-dropdown.js`: desplegables reutilitzables per seleccionar sons (utilitza
  `ensureAudio`).
- `hover.js`: helper de tooltips amb focus/teclat.
- `performance-audio-menu.js`: menú per ajustar `lookAhead` / `updateInterval` i
  monitoritzar l'estat real del motor d'àudio.
- `index.css`: tokens `:root`, estils del top-bar i layouts compartits.

## Bones pràctiques
- Mantén accessibilitat dels menús (`role`, focus, tancament controlat). Usa
  `solidMenuBackground` quan la UI incorpori nous panells flotants.
- Qualsevol event nou emès des de `header.js` s'ha de documentar i consumir via
  `createSchedulingBridge` o listeners dedicats a les apps.
- Evita duplicar estils: afegeix utilitats al `@layer shared` de `index.css`.

## Tests
No hi ha tests específics. Després de modificar aquests mòduls executa `npm test`
per assegurar-te que les integracions amb `libs/app-common` i `libs/sound` segueixen funcionant.
