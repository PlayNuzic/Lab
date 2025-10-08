## Preparació de l'entorn

Executa aquests passos a l'arrel del repositori a l'inici de cada sessió:

```bash
./setup.sh
```

El `setup.sh` configura Git (usuari genèric i remote via SSH al port 443), habilita
Corepack i instal·la totes les dependències de Node amb `npm ci` (inclòs Jest).
Només cal llançar-lo un cop per sessió.

> **Nota**: si l'entorn no permet descarregar paquets amb `apt-get`, torna a
> executar-lo amb `SKIP_APT=1 ./setup.sh`.

## Estructura del projecte

### Visió general
- `index.html` – Landing que enllaça totes les apps.
- `Apps/` – Aplicacions independents (App1–App4) que comparteixen ~70% del codi.
- `libs/` – Nucli compartit. Destaquen `app-common/`, `sound/`, `shared-ui/`,
  `random/` i `utils/`. També hi ha paquets especialitzats (`notation/`,
  `cards/`, `ear-training/`, `guide/`).
- `setup.sh` – Inicialització de l'entorn (vegeu més amunt).

### Apps
Cada app reutilitza components de `libs/app-common/` i del motor d'àudio comú.

| App | Propòsit | Punts clau |
| --- | --- | --- |
| **App1 · Temporal Formula** | Edició de Lg/V/T amb càlcul automàtic del tercer paràmetre. | `bindAppRhythmElements`, `createRhythmAudioInitializer`, menú aleatori modular i resync de tap via `computeResyncDelay`. |
| **App2 · Pulse Sequence Editor** | Editor de seqüències de polsos amb memòria i loop. | `createPulseSeqController`, `createPulseMemoryLoopController`, mixer emergent, menú aleatori amb recompte de pulsos. |
| **App3 · Fraction Editor** | Editor de fraccions rítmiques amb timeline sincronitzada. | `fraction-editor`, `preferences` (factory reset), `audio-toggles`, renderitzat amb `createTimelineRenderer`. |
| **App4 · Multi-Fraction Selection** | Gestió de múltiples fraccions (selecció, memòria i randomització). | `fraction-selection` store, `pulse-seq`, `loop-control`, preferències compartides i menú aleatori enriquit. |

### Llibreries compartides

- `libs/app-common/` – 32+ mòduls: inicialització (`app-init`, `audio-init`),
  dom bindings (`dom`, `template`), gestió LED, loop controllers, editor de
  fraccions, seqüenciador de polsos, timeline renderer, preferències i utilitats
  (`number`, `range`, `utils`).
- `libs/sound/` – Motor `TimelineAudio`, mixer global, `user-interaction` helper i
  carregador de mostres (`sample-map`).
- `libs/shared-ui/` – Capçalera comuna (`header`), dropdowns de so, menús de
  rendiment i efectes `hover`.
- `libs/random/`, `libs/utils/` – Utilitats de randomització i helpers genèrics.

## Principis de desenvolupament

1. **Prioritza sempre components compartits**: abans d'escriure codi en una app,
   comprova si ja hi ha un mòdul reutilitzable a `libs/app-common/`.
2. **Extén el nucli compartit**: si no existeix, crea'l perquè el puguin aprofitar
   altres apps (documenta'l i afegeix tests).
3. **Últim recurs**: codi específic d'una app només quan el comportament sigui
   realment únic.

Reforça la modularitat exposant APIs clares i evitant duplicats. Quan migris
funcionalitat existent, actualitza els AGENTS corresponents.

## Execució de tests

Executa totes les proves amb Jest des de l'arrel:

```bash
npm test
```

- **Cobertura actual**: 24 test suites, 280 tests (vegeu `npx jest --listTests`).
- **Cobertura clau**: `libs/app-common/__tests__/` (subdivisions, audio bridges,
  loop resize, tap resync, fraction editor, **notation-utils**), `libs/app-common/*.{test.js}`
  (audio-init, loop-control, range, utils), `libs/sound/*.test.js` (motor i
  mixer) i `libs/random/index.test.js`.

Mantén els tests verds després de qualsevol canvi en mòduls compartits o apps.

## Millores recents (Oct 2025)

### `libs/app-common/notation-utils.js` - Construcció d'events de notació

S'han aplicat **5 fixes consecutius** per garantir el renderitzat correcte de partitures
rítmiques amb VexFlow, especialment en fraccions amb tuplets i pulsos remainder:

1. **Inclusió del pulso Lg i protecció del pulso 0** (d7d174b)
   - Pulso Lg (final) inclòs al bucle (`i <= safeLg`)
   - Pulso 0 forçat com a nota (`rest: false`) mai silenci

2. **Exclusió del pulso Lg** (488f114) - **Reversió del punt 1**
   - Pulso Lg exclòs explícitament (`if (i === safeLg) return false`)
   - És marca final de timeline, no seleccionable ni visible a partitura

3. **Inclusió de TOTS els múltiples del numerador** (3280dfe)
   - Múltiples seleccionats → notes
   - Múltiples NO seleccionats → silencios clickejables
   - Permet estructura correcta de tuplets en VexFlow

4. **Pulsos remainder sempre com a negres** (996b3cf)
   - Detecció: `i > lastCycleStart && i < safeLg`
   - Duració forçada a `'q'` (quarter note)
   - Dots forçats a 0 (sense puntillo)

5. **Protecció contra sobrescriptura per fractionalSelections** (2d83386)
   - `fractionalSelections` NO pot sobrescriure duració de pulsos remainder
   - Verificació `isRemainderPulse` abans d'actualitzar `duration` i `dots`
   - Garanteix que remainder mantingui sempre `'q'` amb 0 dots

**Test coverage**: 280 tests a `libs/app-common/__tests__/notation-utils.test.js` ✅
