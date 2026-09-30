# App9: Línea Temporal

## Descripción

App9 presenta la **línea temporal**: una línea horizontal con los pulsos 0-7 y un
punto final `·`. Al pulsar Play suena la pulsación y, sobre ella, **dos notas
melódicas** en posiciones y alturas aleatorias. Una barra dibuja la duración de
cada nota y la fila inferior marca el **paso temporal** que está sonando. El
tempo se ajusta con la **pastilla de BPM**.

Es la app del **paso 3** del Sistema Interactivo (`sistema/`, capítulo
Posiciones).

## Interfaz

### Línea temporal

- Números de pulso **0-7** repartidos uniformemente; el pulso 8 se dibuja como
  `·` con dobles guiones (clase `cycle-end`) y **no suena**: marca el final.
- Los números se iluminan al sonar su pulso.
- **Barras de duración** (`.interval-block`): aparecen cuando empieza cada nota,
  crecen durante su duración y **se quedan dibujadas** hasta el siguiente Play,
  para poder ver la secuencia que acaba de sonar.

### Fila de pasos (`.interval-row`)

- 8 celdas (1-8) bajo la línea, alineadas con los pulsos: la celda *n* es el
  paso que va del pulso *n−1* al *n*.
- Durante la reproducción se resalta el paso que está sonando.

### Controles

Fila única: 🔊 volumen · ▶ Play · **pastilla de BPM** `BPM [–] 90 [+]`.

- **Play**: reproduce una vez (sin loop). Se deshabilita mientras suena y se
  reactiva cuando la última nota ha terminado.
- **BPM**: 50-150, 90 por defecto (`createBpmController`). Un cambio durante la
  reproducción se aplica al momento (`audio.setTempo`).
- Random, reset, tap tempo y loop del template están ocultos por CSS.

### Menú ☰ (header compartido)

Tema, instrumento (piano por defecto), sonidos *Pulso* (`click1`) y
*Seleccionado* (`click2`) y restablecer valores de fábrica.

## Reproducción

Cada Play genera una secuencia nueva (`generate2Notes()`):

- Dos notas MIDI aleatorias del **registro 4** (60-71), sin repetir la misma
  altura seguida.
- Duraciones: una nota dura **1 pulso** (iT=1) y la otra **2 pulsos** (iT=2),
  cualquiera de las dos puede ser la larga. Excepción: si la 2ª nota cae en el
  pulso 7 no cabe un iT=2 y **las dos duran 1**.
- Posiciones: la 2ª empieza en el pulso 4-7; la 1ª en el 0-3 (0-2 si es la
  larga, para que no invada el sitio de la 2ª).

El motor reproduce 8 pasos (pulsos 0-7) a `60 / BPM` segundos por pulso. Las
notas se programan en `onSchedule` (misma precisión que el metrónomo); `onPulse`
solo actualiza lo visual. Al terminar, la app espera a que acabe la última nota
(+400 ms para el release del sampler) antes de parar el motor.

## Módulos compartidos

- `audio-init.js` → `createMelodicAudioInitializer` (piano/flauta sobre TimelineAudio)
- `audio.js` → `bindSharedSoundEvents` (dropdowns *Pulso* / *Seleccionado*)
- `bpm-controller.js` → pastilla de BPM
- `template.js` → `renderApp` y `reorderControls` (orden nuzic de la fila de controles)
- `visual-sync.js` + `simple-highlight-controller.js` → highlight de pulsos
- `preferences.js` → preferencias y restablecer valores de fábrica
- `idle-caret-flash.js` → aviso visual sobre Play mientras la app está en reposo

## Implementación

- `index.html` genera la app con `renderApp()`, elimina `.middle` e inyecta la
  pastilla de BPM (`#bpmParam`) en `.inputs`.
- `main.js` la pasa a `.controls` con `reorderControls()` y elimina la `.inputs`
  que queda vacía. Sin este traslado, el tema nuzic oculta `.inputs` cuando solo
  contiene el BPM (`.inputs:has(.bpm-inline):not(:has(.param))`) y la pastilla
  no se ve. El volumen lo coloca `header.js` (`relocateSoundWrapperForNuzic`) y
  el orden visual (🔊 ▶ BPM) lo fija el tema con `order`.

## Archivos

```text
Apps/App9/
├── index.html   - Template, defaults de sonido y pastilla de BPM
├── main.js      - Línea temporal, generación de notas y reproducción
├── styles.css   - Layout a todo el ancho, fila de pasos y barras de duración
└── README.md    - Esta documentación
```

## Verificación manual

1. Abrir la app sola (`Apps/App9/index.html`) y dentro del Sistema
   (`sistema/index.html?paso=3`).
2. Comprobar que la fila de controles muestra 🔊 ▶ y la pastilla de BPM.
3. Pulsar Play varias veces:
   - Los pulsos 0-7 se iluminan y el `·` final no suena.
   - Suenan dos notas; sus barras duran 1 y 2 pulsos (o 1 y 1 si la 2ª cae en el 7).
   - La fila de pasos resalta el paso que suena.
   - Las barras siguen visibles al terminar y se borran con el siguiente Play.
4. Cambiar el BPM durante la reproducción: el tempo cambia al momento.
