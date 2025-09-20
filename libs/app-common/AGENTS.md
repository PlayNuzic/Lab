## Propòsit
- Agrupar utilitats compartides entre Apps (menús, bridges d'àudio, mixer i càlculs
  de subdivisions) per evitar duplicació de lògica.
- Servir com a capa d'abstracció entre la UI i el motor `TimelineAudio`.

## Mòduls destacats
- `audio.js`: detecta perfils _desktop/mobile_, crea el pont de scheduling i propaga
  esdeveniments `sharedui:sound` cap al motor.
- `audio-schedule.js`: càlcul de proper zero i normalització de temps (`computeNextZero`).
- `mixer-menu.js` i `mixer-longpress.js`: UI accessòria per controlar canals del mixer.
- `random-menu.js`: desplegable comú per aleatoritzar paràmetres amb `localStorage`.
- `range.js` / `utils.js`: helpers numèrics (`toRange`, `toNumber`, `computeHitSizePx`, ...).
- `subdivision.js`: càlculs de subdivisions, fonts i grid per timelines.
- `template.js` i `styles.css`: fragments d'HTML/CSS reutilitzables.

## Tests
- Existeix cobertura amb Jest a `range.test.js`, `utils.test.js` i la carpeta
  `__tests__/` (subdivisions, audio-schedule, loop-resize, tap-resync).
- Els tests assumeixen entorn Node amb DOM simulat (`document.createElement`, etc.).
  Mockeja APIs del navegador quan calgui.
- Executa les proves des de l'arrel del repositori:

```bash
npm test
```

## Notes de migració
- 2024-05: `Apps/App2` reutilitza `fromLgAndTempo` i `computeResyncDelay` per substituir
  càlculs locals i re-sincronitzacions.
- Mantén els TODO[audit] per identificar codis duplicats (ex. consolidar `toRange`).
