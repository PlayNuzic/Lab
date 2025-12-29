# Scale Selector Module

Selector d'escales amb suport per:
- **Totes les escales mare** amb **TOTES les seves rotacions/modes**
- **Selector de nota de sortida** (transposició 0-11)
- **Filtres per App**: escollir quines escales/rotacions mostrar
- **Integració amb preferències** i factory reset

## Instal·lació

```javascript
import {
  createScaleSelector,
  createTransposeSelector,
  ALL_SCALES,
  SCALE_PRESETS,
  filterScales,
  getRotatedScaleNotes
} from '../../libs/scale-selector/index.js';
```

CSS (afegir al HTML de l'app):
```html
<link rel="stylesheet" href="../../libs/scale-selector/scale-selector.css" />
```

## Escales Disponibles

El mòdul inclou **34 escales** (8 escales mare amb totes les seves rotacions):

| Escala | Rotacions | Notes |
|--------|-----------|-------|
| CROM (Cromàtica) | 1 | 12 |
| DIAT (Diatònica) | 7 modes (Mayor, Dórica, Frigia, Lidia, Mixolidia, Eolia, Locria) | 7 |
| ACUS (Acústica) | 7 modes | 7 |
| ARMme (Harmònica Menor) | 7 modes | 7 |
| ARMma (Harmònica Major) | 7 modes | 7 |
| OCT (Octatònica) | 2 modes | 8 |
| HEX (Hexatònica) | 2 modes | 6 |
| TON (Tons) | 1 mode | 6 |

## Ús Bàsic

### Crear un selector amb preset

```javascript
const selector = createScaleSelector({
  container: document.getElementById('scaleContainer'),
  appId: 'app21',
  preset: 'app21',  // DIAT tots modes + altres escales mode 0
  initialScale: 'CROM-0',
  enableTranspose: true,
  transposeHiddenByDefault: true,
  title: 'Escoge una escala',
  onScaleChange: ({ scaleNotes, displayName, scaleId, rotation }) => {
    console.log('Escala:', displayName);
    console.log('Semitons:', scaleNotes);
  },
  onTransposeChange: (transpose) => {
    console.log('Transposició:', transpose);
  }
});

selector.render();
selector.addTransposeOptionToMenu(); // Afegeix checkbox al menú d'opcions
```

### Crear selector amb TOTES les escales

```javascript
const selector = createScaleSelector({
  container: document.getElementById('scaleContainer'),
  appId: 'myApp',
  preset: 'all'  // Totes les 34 escales
});
selector.render();
```

### Crear selector amb filtre personalitzat

```javascript
const selector = createScaleSelector({
  container: document.getElementById('scaleContainer'),
  appId: 'myApp',
  filter: {
    scaleIds: ['DIAT', 'ACUS', 'ARMme'],
    rotations: {
      DIAT: 'all',        // Tots els 7 modes de la diatònica
      ACUS: [0, 1, 4],    // Només modes 0, 1 i 4 de l'acústica
      ARMme: 'all'        // Tots els modes de l'armònica menor
    }
  }
});
selector.render();
```

## Presets Disponibles

| Preset | Descripció |
|--------|------------|
| `all` | Totes les escales amb totes les rotacions (34) |
| `app21` | DIAT tots modes + altres escales només mode 0 (14) |
| `diatonic` | Només DIAT amb tots els modes (7) |
| `heptatonic` | Escales de 7 notes (28) |
| `symmetric` | Escales simètriques: CROM, TON, OCT, HEX (6) |
| `motherScalesOnly` | Només primera rotació de cada escala (8) |

## API del Selector

### Mètodes

```javascript
// Obtenir escala actual
selector.getScale();  // "DIAT-0"

// Establir escala
selector.setScale('DIAT-5');

// Obtenir semitons de l'escala actual
selector.getScaleNotes();  // [0, 2, 3, 5, 7, 8, 10]

// Obtenir nom de l'escala
selector.getScaleDisplayName();  // "Eolia"

// Transposició
selector.getTranspose();  // 0-11
selector.setTranspose(5);

// Aplicar transposició a nota MIDI
selector.applyTranspose(60);  // 65 (si transpose=5)

// Control de visibilitat
selector.setTransposeEnabled(true);
selector.isTransposeEnabled();

// Actualitzar escales disponibles
selector.setAvailableScales('diatonic');  // preset
selector.setAvailableScales({ scaleIds: ['DIAT'] });  // filtre
selector.setAvailableScales([...customScales]);  // array

// Neteja
selector.destroy();
```

## Selector de Transposició Independent

```javascript
const transpose = createTransposeSelector({
  container: document.getElementById('transposeContainer'),
  initialValue: 0,
  label: 'Nota de Salida',
  onChange: (value) => {
    const transposedMidi = midiNote + value;
  }
});

transpose.render();
transpose.getValue();  // 0-11
transpose.setValue(7);
transpose.applyTranspose(60);  // 67
```

## Utilitats

```javascript
import {
  ALL_SCALES,
  SCALE_IDS,
  getRotatedScaleNotes,
  getScaleDisplayName,
  getScaleShortName,
  parseScaleValue,
  getScaleInfo,
  filterScales
} from '../../libs/scale-selector/index.js';

// Llista totes les escales
console.log(ALL_SCALES);
// [{ id: 'CROM', rotation: 0, value: 'CROM-0', name: 'Cromática', ... }, ...]

// IDs d'escales mare
console.log(SCALE_IDS);  // ['CROM', 'DIAT', 'ACUS', 'ARMme', 'ARMma', 'OCT', 'HEX', 'TON']

// Semitons d'una escala rotada
getRotatedScaleNotes('DIAT', 5);  // [0, 2, 3, 5, 7, 8, 10] - Eolia

// Noms
getScaleDisplayName('DIAT', 0);  // "Mayor"
getScaleShortName('ACUS', 4);    // "Menor Mel."

// Parsejar valor
parseScaleValue('DIAT-2');  // { scaleId: 'DIAT', rotation: 2 }

// Obtenir info
getScaleInfo('DIAT-2');  // { id: 'DIAT', rotation: 2, name: 'Frigia', ... }

// Filtrar escales
filterScales({
  scaleIds: ['DIAT', 'ACUS'],
  rotations: { DIAT: [0, 5], ACUS: 'all' },
  minNotes: 7
});
```

## Tests

El mòdul inclou **85 tests** que cobreixen:
- Dades d'escales (constants, rotacions, semitons)
- Utilitats (parsing, noms, filtratge)
- Presets
- Components DOM (selector, transposició)

```bash
npm test -- --testPathPattern="scale-selector"
```

## Estructura de Fitxers

```
libs/scale-selector/
├── index.js              # Exports unificats
├── scale-selector.js     # Lògica principal
├── scale-selector.css    # Estils responsives
├── README.md             # Documentació
└── __tests__/
    └── scale-selector.test.js
```
