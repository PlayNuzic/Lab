## Propòsit
- Compartir components visuals i lògica comuna del capçal i menús entre les apps.
- Centralitzar tokens de tema perquè el disseny i els efectes de hover siguin coherents.

## Mòduls destacats
- `header.js`: inicialitza el top-bar compartit, aplica temes, gestiona volum/mute,
  envia esdeveniments `sharedui:*` i sincronitza `TimelineAudio` (sons base/accent/start/cycle).
- `sound-dropdown.js`: construeix els desplegables de selecció de so reutilitzats
  per App1-3.
- `hover.js`: helper per mostrar textos contextuals (tooltip-like) a controls.
- `performance-audio-menu.js`: instal·la un menú de rendiment dins la capçalera per
  ajustar `scheduleHorizon` i _sample rate_ del motor (via `window.NuzicAudioEngine`).
- `index.css`: defineix tokens `:root`, estils del top-bar, menús, efectes i helpers
  (`@layer`/`@block`).

## Notes d'ús
- Moltes funcions envien esdeveniments personalitzats (`sharedui:scheduling`,
  `sharedui:theme`, `sharedui:selectioncolor`, etc.). Les apps han d'escoltar-los via
  `window.addEventListener` o `createSchedulingBridge`.
- El menú principal usa `<details>` amb `solidMenuBackground` (de `libs/app-common`).
  Si afegeixes contingut, mantén l'accessibilitat (`role="menu"`, focus, teclat).

## Tests
Aquest paquet no té tests propis. Qualsevol canvi que afecti el comportament compartit
s'ha de validar executant la suite global:

```bash
npm test
```
