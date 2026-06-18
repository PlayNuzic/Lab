# App4 · Metrónomo Fracción

Eina de **polirítmia**: superposa fins a **3 fraccions** (n/d) sobre un pols base
i les representa com a **anells concèntrics**. Cada fracció és una veu pròpia, amb
el seu color i el seu radi segons la velocitat. Pensada per a ratolí i tàctil.

## Què fa

- **Pols base** (cercle exterior, en crema) marca la pulsació de referència.
- Cada **fracció n/d** afegeix un anell: com més ràpida (d/n gran), més enfora.
  - F1 groc · F2 rosa · F3 blau. n ∈ [1,7], d ∈ [1,12].
- Quan totes les fraccions i el pols **coincideixen** al principi es tanca un
  **cicle complet**; l'app et diu quants n'hi caben (vegeu Pulsos/Ciclos).

## Com s'usa

- **Afegir / treure fraccions**: el control **+ / −** a la dreta de les caixes
  (fins a 3; el "+" es desactiva amb 3 fraccions, el "−" amb 0).
- **Editar una fracció**: escriu n (a dalt) i d (a baix) a la caixa, o fes servir
  els seus spinners.
- **Pulsos / Ciclos** (pastilles de dalt):
  - **Pulsos** (editable) = nombre total de pulsos (Lg). El seu spinner salta de
    **cicle complet en cicle complet**.
  - **Ciclos** (només lectura) = quantes vegades coincideixen totes les fraccions
    amb el pols (= Pulsos ÷ cicle gran). Depèn de les fraccions actives.
- **BPM**: velocitat del pols base (per defecte 90).
- **Seleccionar pulsos**: fes **clic** sobre els punts d'un anell (els enters al
  cercle base; les subdivisions a cada anell de fracció) o sobre la **partitura**.
  Els pulsos seleccionats sonen amb el so del seu canal.
- **Play** reprodueix **sempre en bucle**.

## Botons de la fila de controls

- **Play · Random · Tap · Partitura · ∑ · Reset**.
- **Random** 🎲: sorteja Lg, V, n/d de les fraccions actives i una selecció de
  pulsos. El menú (clic dret / tecla Menú) ajusta els rangs.
- **Tap**: marca el tempo donant 3 tocs.
- **Partitura** 🎼: obre una vista de pentagrames apilats (un per fracció + el
  pols base), amb cops simultanis alineats i un cursor durant la reproducció.
  Inclou **exportació a PNG**.
- **∑**: obre el panell amb la **matemàtica** de la combinació:
  - cicle gran (mcm dels numeradors), Ciclos, durada T = Lg·60/V, mcm dels
    denominadors;
  - per fracció: velocitat **V·d/n**, pulsos fraccionats per cicle;
  - **proporció polirítmica reduïda** incloent el pols (p. ex. pols + 3/4 + 2/3 →
    **6 : 8 : 9**).
  Es recalcula en viu mentre edites; es tanca clicant fora.
- **Mixer** (long-press al mute o tecla Menú): un canal per a cada fracció i la
  seva selecció, cadascun amb el seu **selector d'instrument**.

## Per a desenvolupadors

Sense build: ES2022 directe al navegador. Lògica a `main.js`; estat de selecció a
`fraction-selection.js`. Mòduls compartits clau:

| Mòdul | Propòsit |
| --- | --- |
| `../../libs/app-common/circular-rings.js` (+ `.css`) | Anells concèntrics: cercle base + un anell per fracció, radi ∝ velocitat, clic per seleccionar. |
| `../../libs/app-common/polyrhythm-info.js` | `computePolyrhythmInfo`: cicle gran, velocitats, pulsos/cicle i proporció reduïda (panell ∑). |
| `../../libs/notation/notation-system.js` | Sistema de N pentagrames apilats en 1 SVG amb 1 formatter (cops alineats, scroll i playhead únics). |
| `../../libs/app-common/fraction-editor.js` | Editor de cada caixa n/d (mode `block`). |
| `../../libs/app-common/visual-sync.js` | Highlight de playback per posició sobre els anells. |
| `../../libs/sound/index.js` | `TimelineAudio`: cicle base + veus polirítmiques (`setVoices`), mixer i `setChannelSound`. |

L'App4 lineal original (pulseSeq + LEDs + timeline) es conserva CONGELADA a
**App4B**. L'arquitectura detallada és a `Apps/App4/CLAUDE.md` i el redisseny
complet a `SESSION_STATE.md`.

## Tests

```bash
npm test                                          # tota la suite (79 suites)
npm test -- --testPathPattern="polyrhythm-info"   # matemàtica polirítmica
npm test -- --testPathPattern="circular-rings"    # geometria dels anells
```

La partitura (`notation-system`) es verifica amb Chrome real (CDP); jsdom no fa
layout SVG.
