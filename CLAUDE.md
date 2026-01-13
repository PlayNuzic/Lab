# CLAUDE.md

Guia per Claude Code al repositori Lab.

## 🚨 PROCEDIMENTS CRÍTICS

### 1. Ubicació del Repositori
**SEMPRE treballem a**: `/Users/workingburcet/Lab/`

### 2. Gestió de Sessions
**OBLIGATORI per tasques incompletes:**
- **Crear/Actualitzar** `SESSION_STATE.md` a l'arrel
- **Eliminar** quan la tasca estigui completa

### 3. Ordre al Finalitzar
1. Actualitzar `SESSION_STATE.md`
2. Resumir a l'usuari

### 4. ABANS de Modificar Fitxers
**OBLIGATORI**: Si existeix `SESSION_STATE.md` a l'arrel, LLEGIR-LO PRIMER abans de fer qualsevol edició.
- Conté funcionalitats que JA FUNCIONEN i NO s'han de trencar
- Conté restriccions específiques sobre què NO modificar
- Ignorar això pot causar regressions greus

---

## Comandes de Desenvolupament

```bash
./setup.sh          # Setup inicial (1 cop per sessió)
npm test            # Executar tests (60+ suites, 1100+ tests)
npm test -- --testPathPattern="nom-modul"  # Test específic
```

---

## Arquitectura del Projecte

Monorepo amb workspaces per aplicacions musicals de ritme.

### Estructura
```
Lab/
├── Apps/           # App1-App29 (aplicacions individuals)
├── libs/           # Mòduls compartits
│   ├── app-common/     # 43 mòduls core
│   ├── pulse-seq/      # Seqüències de pulsos
│   ├── matrix-seq/     # Editor N-P grid
│   ├── musical-grid/   # Visualització 2D
│   ├── interval-sequencer/  # Seqüenciador d'intervals
│   ├── notation/       # VexFlow rendering
│   ├── random/         # Randomització
│   ├── sound/          # Motor d'àudio
│   ├── shared-ui/      # Components UI
│   ├── gamification/   # Sistema de logros
│   └── plano-modular/  # Grid 2D modular
└── packages/       # Paquets addicionals
```

### Documentació Detallada

Per documentació completa dels mòduls, consulta `docs/modules-reference.md`.

---

## 🚨 PRINCIPIS CRÍTICS DE DESENVOLUPAMENT

### Prioritzar Components Compartits

1. **🔍 PRIMER**: Buscar si existeix a `libs/`
2. **🛠️ SEGON**: Crear component reutilitzable
3. **❌ ÚLTIM RECURS**: Codi específic d'app

### Fitxers PROHIBITS de Modificar

- `libs/sound/clock.js` - Timing crític
- `libs/app-common/pulse-interval-calc.js` - Càlculs d'intervals
- `libs/app-common/voice-sync.js` - Sincronització de veus

### Regles de Desenvolupament

1. Mostrar codi ABANS de crear fitxers
2. Esperar aprovació explícita (✅)
3. Escriure tests per nous components
4. Executar `npm test` després de canvis
5. Mai trencar funcionalitat existent

---

## Patrons Comuns

### Inicialització d'App
```javascript
import { bindRhythmElements } from '../../libs/app-common/dom.js';
import { createRhythmAudioInitializer } from '../../libs/app-common/audio-init.js';
import TimelineAudio from '../../libs/sound/index.js';

const { elements, leds, ledHelpers } = bindRhythmElements({...});
const audio = new TimelineAudio();
await audio.ready();
```

### Loop Controller
```javascript
import { createPulseMemoryLoopController } from '../../libs/app-common/loop-control.js';

const loopController = createPulseMemoryLoopController({...});
loopController.attach();
```

### Tap Tempo
```javascript
import { createTapTempoHandler } from '../../libs/app-common/tap-tempo-handler.js';

const tapHandler = createTapTempoHandler({...});
tapHandler.attach();
```

---

## Sistema d'Agentes

Claude Code té agents especialitzats. Consulta `docs/agents-context.md` per detalls.

### Agents Disponibles
1. **🎨 UI Agent** - Interfícies, components UI
2. **🔊 Audio Agent** - Audio, timing, sincronització
3. **📱 Responsive Agent** - Mobile, responsive
4. **📦 Modules Agent** - Arquitectura, refactoring
5. **🏗️ Creator Agent** - Crear apps noves
6. **🎮 Gamification Agent** - Logros, badges

---

## Tests

- **60+ test suites**, 1100+ tests
- Tests a: `libs/*/tests/`, `libs/app-common/__tests__/`
- Patrons: Unit tests, integration tests, DOM tests amb jsdom

---

## Filosofia PlayNuzic Lab

- **Minimalisme**: UI neta, codi simple
- **Reutilització**: ~70% codi compartit
- **No invasió**: Mai trencar l'existent
- **Testing**: Tots els tests han de passar
- **Modularització**: Extreure a libs/ quan hi ha duplicació
