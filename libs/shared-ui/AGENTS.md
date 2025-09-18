## Propòsit
- Compartir components visuals i lògica comuna del capçal compartit entre apps.
- Centralitzar tokens de tema perquè el cicle de disseny sigui coherent.

## API pública
- `header.js`: `initHeader`, `renderHeader` per integrar el top-bar.
- `index.css`: tokens `:root` i blocs `@block` que altres apps poden reutilitzar.
- `sound-dropdown.js`, `hover.js` (veure arxius) per wiring d'interaccions.

## Flux principal
1. Carrega `index.css` per tenir els tokens i estils base.
2. Invoca `renderHeader` o `initHeader` segons si hi ha markup preexistent.
3. Els events `sharedui:*` es propaguen cap a les apps perquè sincronitzin estat.

## Candidats a obsolet
- [ ] Revisar `.menu ul` (index.css) segons TODO[audit-css] per si es pot eliminar.
- [ ] Validar suport de `Tone.js` per `lookAhead/updateInterval` (header.js) abans de dependències futures.
