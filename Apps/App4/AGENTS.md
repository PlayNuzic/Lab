## Propòsit
- Experimentar amb seqüències de pulsos seleccionables sobre una timeline
  lineal/circular compartida amb la resta d'apps.
- Sincronitzar reproducció i seleccions amb el motor `TimelineAudio`, incloent
  indicadors de temps (T) i menús de mixer locals.

## Flux principal
1. `createSchedulingBridge` i `bindSharedSoundEvents` connecten la capçalera
   compartida amb el motor d'àudio (mute, canvis de so, perfils de _scheduling_).
2. El formulari de pulsos (`pulseSeq`) permet definir seleccions manualment; el
   codi suporta _drag_, _long press_ i memòria de selecció (`pulseMemory`).
3. El menú aleatori (`initRandomMenu`) combina rangs per Lg/V/T i un comptador
   opcional de pulsos; la configuració es desa sota el prefix `app2:`.
4. `initMixerMenu` habilita el panell emergent del mixer per canalitzar volum/mute
   (pulse/subdivision/master).
5. L'indicador `tIndicator` es posiciona segons el temps calculat amb `fromLgAndTempo`
   i `toPlaybackPulseCount` (libs/app-common/subdivision.js).

## Estat i emmagatzematge
- `localStorage` prefix `app2:` guarda tema, mute, color de selecció, mode circular
  i configuració del menú aleatori.
- `pulseMemory` manté l'estat de selecció i es re-sincronitza amb `TimelineAudio`
  quan es reprodueix en mode loop.
- El toggle circular i la posició de l'indicador T es recalculen en `resize`.

## Dependències compartides
- `libs/sound/index.js` (TimelineAudio, ensureAudio, mixer i assignació de sons).
- `libs/shared-ui/hover.js` i `sound-dropdown.js` per ajudar amb la UI.
- `libs/app-common` (`audio.js`, `mixer-menu.js`, `random-menu.js`, `range.js`,
  `subdivision.js`, `utils.js`).

## Tests
No hi ha suite específica per App2; confia en els tests compartits executant des de
l'arrel:

```bash
npm test
```
