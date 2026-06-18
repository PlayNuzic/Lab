# App1 · Fórmula Temporal

Visualitza la **fórmula temporal** del mètode Nuzic:

```
Lg / V = T / 60
```

amb tres camps editables — **Lg** (nombre de pulsos), **V** (velocitat, BPM) i
**T** (durada en segons) — i en deriva el tercer automàticament. La timeline
(lineal, o circular quan actives el bucle) se sincronitza amb l'àudio.

## Com s'usa

- **Els tres camps sempre són editables.** No hi ha mode manual/auto ni cap
  bloqueig:
  - Si en deixes **un de buit**, s'omple sol a partir dels altres dos.
  - Si els **tres** tenen valor, l'app recalcula el **derivat** segons quins dos
    has tocat més recentment ("els dos últims editats manen"). Si edites el camp
    derivat, l'auto passa al més antic dels altres dos.
- **Play** reprodueix la seqüència de pulsos (sonen 0…Lg−1; l'últim pols Lg marca
  el tancament i no sona).
- **Loop** 🔁 (a la dreta de Random): "doblega" la línia en **cercle** (donut). El
  pols 0 queda al cim.
- **Random** 🎲: sorteja els camps marcats al menú i deriva el tercer respectant
  els rangs (Lg [2,16], V [40,200], T [0.1,20]).
- **Tap**: marca el tempo amb tocs successius; l'app realinea el tempo amb la
  reproducció en curs.

## Per a desenvolupadors

Sense build: ES2022 directe al navegador. Lògica a `main.js`. Peça central:

| Mòdul | Propòsit |
| --- | --- |
| `../../libs/app-common/formula-solver.js` | `createFormulaSolver`: resol Lg/V=T/60 amb el model de recència ("dos últims editats manen"). Amb tests. |
| `../../libs/app-common/circular-timeline.js` | Render de la timeline (lineal i circular), compartit amb App16. |
| `../../libs/app-common/circular-timeline-ring.js` | `renderCircularRingNumbers`: números del donut per trigonometria (compartit amb App17). |
| `../../libs/app-common/visual-sync.js` | Highlight de playback (`onStep → highlightStep`) sobre els `.pulse-number`. |
| `../../libs/app-common/audio-schedule.js` | `computeResyncDelay` + resync del tap tempo. |
| `../../libs/sound/index.js` | `TimelineAudio` (lazy) i mixer global. |

`handleInput` només fa `solver.touch(id)` + `solver.resolve(valors)` i escriu el
resultat; la resta (àudio, timeline, push en viu al transport) queda intacta.

L'App1 original (sistema manual/auto amb LEDs clicables) es conserva CONGELADA a
**App1B**. L'arquitectura detallada és a `Apps/App1/CLAUDE.md`.

## Tests

```bash
npm test                                        # tota la suite
npm test -- --testPathPattern="formula-solver"  # lògica de la fórmula + recència
```
