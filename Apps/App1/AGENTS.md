## Propòsit
- Visualitzar la fórmula temporal clàssica (Lg, V, T) amb timeline lineal/circular.
- Permetre escoltar el patró via `TimelineAudio` i sincronitzar-se amb el mixer global.
- Oferir menús ràpids per aleatoritzar paràmetres i ajustar sons/temes com a app d'experimentació.

## Flux principal
1. Inicialitza el pont de programació d'àudio (`createSchedulingBridge`) i escolta
   els esdeveniments `sharedui:*` de la capçalera compartida per aplicar mute,
   canvis de so i perfils de _scheduling_.
2. `initRandomMenu` governa el menú contextual d'aleatorització i persisteix
   preferències a `localStorage` sota la clau `random` (Lg/V/T).
3. `TimelineAudio` reprodueix pulsos i números seleccionats; `layoutTimeline`
   actualitza el DOM segons `Lg`, mode loop i toggle circular.
4. Les mides de números i _hit targets_ s'obtenen de `libs/app-common/utils.js`.

## Estat i emmagatzematge
- `localStorage` prefix `random` guarda les preferències del menú aleatori.
- Es preserva l'últim estat de números seleccionats per sincronitzar àudio/visual.
- Variables locals gestionen `isPlaying`, `loopEnabled`, `circularTimeline` i
  l'historial de selecció manual.

## Dependències compartides
- `libs/sound/index.js` per `TimelineAudio`, `ensureAudio` i mixer global.
- `libs/shared-ui/sound-dropdown.js` i `hover.js` per controls de UI.
- `libs/app-common/` (`audio.js`, `range.js`, `random-menu.js`, `subdivision.js`).

## Tests
No hi ha tests específics de l'app; les funcionalitats compartides tenen cobertura
amb Jest. Des de l'arrel del repo executa:

```bash
npm test
```
