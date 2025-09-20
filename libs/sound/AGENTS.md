## Propòsit
- Proporcionar el motor `TimelineAudio` (AudioWorklet + WebAudio) compartit per les
  apps del Lab.
- Gestionar el mixer global (`AudioMixer`), assignació de mostres (`sample-map.js`)
  i funcions auxiliars (`ensureAudio`, `setVolume`, `setMute`, ...).

## Notes d'implementació
- `TimelineAudio` carrega el worklet `timeline-processor.js`, crea canals per pulso,
  selecció, cicle i start, i sincronitza missatges via `postMessage`.
- `AudioMixer` manté estat reactiu de canals i permet subscripcions (`subscribeMixer`).
- `ensureAudio` intenta inicialitzar `Tone.js`; si no existeix, prepara un
  `AudioContext` nadiu per garantir que la UI pugui continuar.
- Les mostres (`samples/*.wav`) es carreguen mitjançant `loadSampleMap`; es
  reutilitzen buffers per context via `WeakMap`.

## Tests
- Les proves (`index.test.js`) mockegen `window`, `AudioContext` i `AudioWorkletNode`.
  Si afegeixes funcionalitat, amplia aquests _mocks_ en conseqüència.
- `Tone` no està disponible durant els tests; usa `delete global.Tone` per simular
  l'entorn real i verifica que les funcions continuen treballant sense ell.
- Executa sempre els tests des de l'arrel del repositori:

```bash
npm test
```
