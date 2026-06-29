# Índex de Mòduls - Lab

Índex de tots els mòduls compartits del monorepo.

## Mòduls Principals (amb documentació completa)

| Mòdul | Descripció | README |
|-------|------------|--------|
| **app-common** | 54 mòduls core compartits entre apps | [README](../libs/app-common/README.md) |
| **matrix-seq** | Utilitats de parsing d'intervals (sound/temporal) | [README](../libs/matrix-seq/README.md) |
| **musical-grid** | Visualització 2D amb scroll | [README](../libs/musical-grid/README.md) |
| **interval-sequencer** | Motor iTfr + conversió d'intervals/forats | [README](../libs/interval-sequencer/README.md) |
| **notation** | VexFlow rendering + rhythm-staff | [README](../libs/notation/README.md) |
| **plano-modular** | Grid 2D modular | [README](../libs/plano-modular/README.md) |
| **scale-selector** | Selector d'escales | [README](../libs/scale-selector/README.md) |

## Mòduls Secundaris

| Mòdul | Descripció | Fitxers principals |
|-------|------------|-------------------|
| **sound** | Motor d'àudio Tone.js | `index.js`, `mixer.js`, `sample-map.js` |
| **pulse-seq** | Seqüències de pulsos | `pulse-seq.js`, `parser.js`, `state.js`, `editor.js`, `cell-editor.js` |
| **random** | Sistema de randomització | `core.js`, `config.js`, `menu.js`, `fractional.js` |
| **shared-ui** | Components UI compartits | `header.js`, `sound-dropdown.js`, `hover.js` |
| **gamification** | Sistema de logros | `event-system.js`, `scoring-system.js`, `achievements.js` |
| **audio-capture** | Captura de ritme | `microphone.js`, `keyboard.js`, `rhythm-analysis.js` |
| **ear-training** | Entrenament auditiu | `exercise-runner.js`, `fraction-recognition.js` |
| **utils** | Utilitats matemàtiques | `index.js` |

## Mòduls Especialitzats

| Mòdul | Descripció |
|-------|------------|
| **scales** | Definicions d'escales musicals |
| **soundlines** | Visualització de línies de so |
| **temporal-intervals** | Càlculs d'intervals temporals |
| **vendor** | Dependències externes (Tone.js, VexFlow, chromatone-theory) |

## Imports Comuns

```javascript
// Audio
import TimelineAudio from '../../libs/sound/index.js';
import { createSchedulingBridge } from '../../libs/app-common/audio.js';

// UI
import { bindAppRhythmElements } from '../../libs/app-common/dom.js';
import { intervalsToPairs } from '../../libs/matrix-seq/index.js';
import { createMusicalGrid } from '../../libs/musical-grid/index.js';
import { createCircularRings } from '../../libs/app-common/circular-rings.js'; // anells concèntrics polirítmics (App4) + circular-rings.css
import { renderCircularRingNumbers } from '../../libs/app-common/circular-timeline-ring.js'; // números del donut circular (App1/App17)

// Polirítmia i fórmula temporal
import { createFormulaSolver } from '../../libs/app-common/formula-solver.js'; // Lg/V=T/60, "els dos últims editats manen" (App1)
import { computePolyrhythmInfo } from '../../libs/app-common/polyrhythm-info.js'; // cicle gran, velocitats V·d/n, proporció reduïda (panell ∑ d'App4)

// Notació
import { createRhythmStaff } from '../../libs/notation/index.js';   // 1 pentagrama (App2/App5)
import { createNotationSystem } from '../../libs/notation/notation-system.js'; // N pentagrames apilats, 1 SVG/formatter (App4)

// Seqüències
import { createPulseSeqController } from '../../libs/pulse-seq/index.js';
import { createItfrEngine } from '../../libs/interval-sequencer/index.js';

// Random
import { randomize, initRandomMenu } from '../../libs/random/index.js';
```

## Tests

```bash
npm test                                    # Tots els tests
npm test -- --testPathPattern="pulse-seq"   # Tests d'un mòdul
```

**Cobertura actual:** 76 suites, 1370 tests
