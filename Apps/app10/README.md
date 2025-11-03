# App10: Línea Sonora

## Descripción

App10 es una aplicación educativa de entrenamiento auditivo que presenta una línea vertical con 12 espacios numerados (0-11) correspondientes a notas MIDI (C4-B4). Al pulsar Play, se reproducen 3 notas aleatorias con piano a un tempo aleatorio (75-200 BPM) con highlighting visual sincronizado.

## Características

- **Línea sonora vertical**: 13 divisiones horizontales con 12 espacios numerados (0-11)
- **Mapping MIDI**: Espacio 0 → MIDI 60 (C4), Espacio 11 → MIDI 71 (B4)
- **Piano Sampler**: Tone.js Sampler con samples de Salamander desde CDN
- **Notas aleatorias**: 3 notas aleatorias por reproducción
- **BPM aleatorio**: Tempo aleatorio entre 75-200 BPM
- **Highlighting sincronizado**: Rectángulos que iluminan las notas al sonar
- **Sin loop**: Un solo ciclo por reproducción

## Interfaz

### Línea Sonora (Soundline)
- **Línea vertical** con 13 divisiones horizontales
- **Números 0-11** a la izquierda en los espacios
- **Rectángulos de highlight** a la derecha (aparecen al sonar)
- Nota 0 en la parte inferior, Nota 11 en la superior

### Controles
- **Botón Play**: Inicia la secuencia de notas
  - Se deshabilita durante la reproducción
  - Animación pulsante mientras reproduce
  - Al finalizar, se reactiva para nueva reproducción

### Menú de Sonidos
- **Instrumento**: Selector de instrumento melódico (por ahora solo Piano)

## Comportamiento de Audio

### Instrumento Utilizado
- **Piano (Salamander)**: Samples de piano desde CDN de Tone.js
- Carga asíncrona con `Tone.loaded()`
- Release natural del piano (0.9 × intervalSec)

### Lógica de Reproducción
1. Al pulsar Play:
   - Se genera un BPM aleatorio entre 75-200
   - Se escogen 3 notas aleatorias (0-11)
   - Se calcula el intervalo entre notas: `intervalSec = 60 / BPM`
2. Durante la reproducción:
   - Cada nota se reproduce con piano Sampler
   - La nota se convierte de índice (0-11) a MIDI (60-71)
   - Rectángulo de highlight aparece en la posición vertical correspondiente
3. Al finalizar:
   - El botón Play se reactiva
   - Una nueva pulsación genera nuevos valores aleatorios

## Arquitectura Técnica

### Módulos Compartidos Creados ⭐ NUEVOS

#### **soundline.js** (`libs/app-common/soundline.js`)
- `createSoundline(container)`: Crea línea vertical con divisiones y numeración
- `getNotePosition(noteIndex)`: Obtiene posición vertical (0-100%)
- `getMidiForNote(noteIndex)`: Convierte índice a MIDI (60-71)
- `getNoteForMidi(midi)`: Convierte MIDI a índice (0-11)

#### **piano.js** (`libs/sound/piano.js`)
- `loadPiano()`: Carga Tone.js Sampler con samples de Salamander
- `playNote(midi, duration, when)`: Reproduce una nota individual
- `playSequence(midis, interval, onNote, onComplete)`: Secuencia de notas

#### **note-highlight.js** (`libs/app-common/note-highlight.js`)
- `createNoteHighlightController(config)`: Controlador de highlights
- `highlightNote(noteIndex, duration)`: Ilumina una nota
- `clearHighlights()`: Limpia todos los highlights

#### **instrument-dropdown.js** (`libs/shared-ui/instrument-dropdown.js`)
- Dropdown para selección de instrumentos melódicos
- Integrado en header.js con evento `sharedui:instrument`
- Por ahora solo instrumento: Piano

### Patrón de Implementación
```javascript
// Setup de soundline
const soundline = createSoundline(container);

// Setup de piano
const piano = await loadPiano();

// Setup de highlights
const noteHighlightController = createNoteHighlightController({
  soundline,
  highlightDuration: 300
});

// Reproducción
const midiNotes = randomNotes.map(idx => soundline.getMidiForNote(idx));
playSequence(
  midiNotes,
  intervalSec,
  (idx, midi) => {
    noteHighlightController.highlightNote(randomNotes[idx], duration);
  },
  onComplete
);
```

## Estilos

### Variables CSS
- `--line-color`: Color de la línea vertical y divisiones
- `--soundline-width`: Grosor de la línea vertical (3px)
- `--note-highlight-color`: Color de los rectángulos highlight

### Animaciones
- **noteFlash**: Animación de aparición/highlight de rectángulos
- **playingPulse**: Animación del botón Play durante reproducción

## Estructura de Archivos

```
Apps/app10/
├── index.html      - HTML principal con template
├── main.js         - Lógica de la línea sonora
├── styles.css      - Estilos de soundline y highlights
└── README.md       - Esta documentación

libs/app-common/
├── soundline.js            ⭐ NUEVO - Módulo de línea sonora vertical
├── note-highlight.js       ⭐ NUEVO - Controlador de highlights de notas

libs/sound/
└── piano.js                ⭐ NUEVO - Instrumento de piano con Tone.Sampler

libs/shared-ui/
└── instrument-dropdown.js  ⭐ NUEVO - Dropdown de instrumentos
```

## Integración con el Sistema

- **Header compartido**: Theme selector, instrument picker, factory reset
- **Template personalizado**: `showInstrumentDropdown: true`
- **Performance audio menu**: Control de rendimiento de audio

## Notas de Diseño

- **Vertical layout**: A diferencia de otras apps, usa línea vertical
- **Educacional**: Ayuda a desarrollar reconocimiento de alturas y memoria melódica
- **Piano samples**: Usa CDN de Tone.js (Salamander) para calidad profesional
- **Accesibilidad**: Botones con aria-labels, contraste visual adecuado
- **Responsive**: Adaptado a móvil, tablet y desktop

## Futuras Mejoras Potenciales

- Opción para configurar número de notas (3, 4, 5, etc.)
- Selector para rango de notas (C4-B4, C3-C5, etc.)
- Modo de práctica: usuario identifica las notas escuchadas
- Más instrumentos: guitarra, flauta, violín, etc.
- Intervalo recognition mode
- Melodic dictation exercises

## Testing

### Verificación Manual
1. Abrir la app y pulsar Play
2. Verificar que:
   - La soundline se dibuja verticalmente con números 0-11
   - Se escuchan 3 notas de piano
   - Los rectángulos se iluminan en las posiciones correctas
   - El botón se deshabilita durante reproducción
   - Al finalizar, el botón se reactiva
3. Pulsar Play de nuevo:
   - Verificar que BPM y notas son diferentes

### Tests Automatizados
```bash
npm test
```

Todos los tests (280) pasan correctamente con los nuevos módulos integrados.
