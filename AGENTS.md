## Preparació de l'entorn

Executa aquests passos a l'arrel del repositori cada nova sessió:

```bash
./setup.sh
```

El `setup.sh` configura el nom i correu de Git, força el _remote_ a SSH (github.com:443),
habilita Corepack i instal·la les dependències de Node amb `npm ci` (Jest inclòs).
Només cal executar-lo un cop per sessió.

**Nota**: Després d'executar `setup.sh`, la sessió pot perdre accés a internet.
Si `apt-get` falla, usa `SKIP_APT=1 ./setup.sh` per saltar la instal·lació de paquets.

## Estructura del projecte

### Estructura d'alt nivell
- `index.html` - Landing page amb enllaços a les apps
- `Apps/` - Aplicacions individuals (App1-App4), cadascuna amb HTML, CSS i JS propis
- `libs/` - Llibreries modulars compartides (32 mòduls a `app-common/`)
- `tests/` - Tests d'integració legacy
- `config/` - Configuracions comunes (Jest, etc.)
- `setup.sh` - Script d'inicialització de l'entorn

### Apps (Apps/)
Cada app és autònoma però comparteix lògica via `libs/`:
- **App1**: Temporal Formula - Timeline bàsic amb càlcul de paràmetres
- **App2**: Pulse Sequence - Editor de patrons de polsos amb memòria
- **App3**: Fraction Editor - Editor de fraccions rítmiques (n/d)
- **App4**: Multi-Fraction Selection - Gestió avançada de fraccions (veure README.md propi)

### Llibreries compartides (libs/)

#### `libs/app-common/` (32 mòduls) - Nucli de lògica compartida
**Inicialització i gestió**:
- `audio-init.js` - Inicialització d'àudio sense warnings
- `dom.js` - Binding d'elements DOM amb suport per LEDs
- `led-manager.js` - Gestió d'estat de LEDs (auto/manual)
- `preferences.js` - Emmagatzematge de preferències amb factory reset
- `template.js` - Sistema de plantilles per apps

**Àudio i timing**:
- `audio.js` - Bridges de scheduling i events de so compartits
- `audio-schedule.js` - Càlculs de delay per resync de tap tempo
- `audio-toggles.js` - Gestió de toggles amb integració mixer
- `loop-control.js` - Controladors de loop (bàsic, rhythm, pulse-memory)
- `subdivision.js` - Càlculs de subdivisions temporals
- `timeline-layout.js` - Renderització de timeline (circular/lineal)

**Components UI i interacció**:
- `fraction-editor.js` - Component reutilitzable d'edició de fraccions
- `pulse-seq.js` - Controlador de seqüència de polsos amb drag selection
- `mixer-menu.js` - Menú de mixer amb suport longpress
- `mixer-longpress.js` - Interacció longpress per mixer
- `random-menu.js` - Controls d'aleatorització
- `random-config.js` - Gestió de configuració aleatòria

**Utilitats**:
- `events.js` - Binding d'events estandarditzat
- `number.js` - Parsing segur de nombres
- `range.js` - Validació i clamping de rangs
- `utils.js` - Utilitats matemàtiques (font size, hit size)

#### `libs/sound/` - Motor d'àudio
- `index.js` - Wrapper de Tone.js amb classe TimelineAudio
- `mixer.js` - Funcionalitat de mixer global
- `sample-map.js` - Gestió de mostres de so

#### `libs/shared-ui/` - Components UI compartits
- `header.js` - Capçalera comuna amb controls d'àudio
- `sound-dropdown.js` - Selectors de so
- `hover.js` - Utilitats d'efectes hover
- `index.css` - Estils base

#### Altres llibreries
- `libs/notation/` - Integració VexFlow per notació musical
- `libs/cards/` - Targetes interactives nota-component
- `libs/ear-training/` - Utilitats d'entrenament auditiu
- `libs/random/` - Utilitats d'aleatorització
- `libs/utils/` - Utilitats generals
- `libs/vendor/` - Llibreries de tercers (Tone.js, VexFlow, chromatone-theory)

## 🚨 **PRINCIPIS DE DESENVOLUPAMENT OBLIGATORIS**

### **PRIORITZAR SEMPRE COMPONENTS COMPARTITS**

Quan implementis noves funcionalitats o solucionis bugs, segueix SEMPRE aquesta jerarquia:

1. **🔍 PRIMER**: Comprova si ja existeix un component compartit a `libs/app-common/`
2. **🛠️ SEGON**: Si no existeix cap component compartit, crea'n un que es pugui reutilitzar
3. **❌ ÚLTIMA OPCIÓ**: Només implementa codi específic d'app quan sigui realment necessari

### **Components Compartits Produïts (2024)**

#### **Controladors de Loop** ⭐ Nou
- **Ubicació**: `libs/app-common/loop-control.js`
- **API**: `createLoopController`, `createRhythmLoopController`, `createPulseMemoryLoopController`
- **Utilitzat a**: App2 (pulse-memory variant), App3 (rhythm variant)
- **Tests**: `libs/app-common/loop-control.test.js`
- **Benefici**: Sincronització d'àudio consistent, eliminació de bugs de loop

#### **Editor de Fraccions** ⭐ Nou
- **Ubicació**: `libs/app-common/fraction-editor.js` (25K línies)
- **API**: `createFractionEditor(config)`
- **Features**: Validació, persistència, mode inline/block, spinners auto-repeat
- **Utilitzat a**: App3
- **Tests**: `libs/app-common/__tests__/fraction-editor.test.js`
- **Benefici**: Component complet CRUD per fraccions amb UX polida

#### **Controlador de Seqüència de Polsos** ⭐ Nou
- **Ubicació**: `libs/app-common/pulse-seq.js` (13K línies)
- **API**: `createPulseSeqController()`
- **Features**: Drag selection, memòria de polsos, sincronització amb timeline
- **Utilitzat a**: App2
- **Benefici**: Editor interactiu de patrons rítmics

#### **Gestió de DOM**
- **Ubicació**: `libs/app-common/dom.js`
- **API**: `bindAppRhythmElements(appId)`, retorna `{ elements, leds, ledHelpers }`
- **Utilitzat a**: App1, App2, App3
- **Benefici**: Eliminació de múltiples `document.getElementById`, binding consistent

#### **Gestió de LEDs**
- **Ubicació**: `libs/app-common/led-manager.js`
- **API**: `createRhythmLEDManagers(leds)`, `syncLEDsWithInputs(managers, elements)`
- **Utilitzat a**: App1, App2, App3
- **Benefici**: Comportament consistent d'estats auto/manual

#### **Inicialització d'Àudio**
- **Ubicació**: `libs/app-common/audio-init.js`
- **API**: `createRhythmAudioInitializer(config)`
- **Features**: Supressió de warnings AudioContext, selecció de sons, scheduling bridge
- **Utilitzat a**: App1, App2, App3
- **Tests**: `libs/app-common/audio-init.test.js`
- **Benefici**: Zero warnings a la consola, inicialització consistent

#### **Toggles d'Àudio**
- **Ubicació**: `libs/app-common/audio-toggles.js`
- **API**: `initAudioToggles(config)`
- **Features**: Integració amb mixer, persistència, sincronització bidireccional
- **Utilitzat a**: App3
- **Tests**: `libs/app-common/__tests__/audio-toggles.test.js`
- **Benefici**: Gestió declarativa de canals amb/sense so

#### **Emmagatzematge de Preferències**
- **Ubicació**: `libs/app-common/preferences.js`
- **API**: `createPreferenceStorage({ prefix, separator })`, `registerFactoryReset(config)`
- **Features**: Namespacing per app, factory reset, clear selectiu
- **Utilitzat a**: App3
- **Benefici**: Persistència consistent i reset segur

### **Protocol per a Bug Fixes**

1. **Analitzar si el bug afecta múltiples apps**
2. **Crear component compartit** que solucioni el problema correctament
3. **Migrar totes les apps afectades** per utilitzar el component compartit
4. **Verificar comportament consistent** a totes les apps
5. **Escriure tests** per al nou component compartit

## Execució de tests

Executa totes les proves amb Jest des de l'arrel:

```bash
npm test
```

**Cobertura actual**: 24 test suites, 109 tests passats

**Suites de tests**:
- `libs/app-common/__tests__/` - Tests de components compartits (subdivision, audio, fraction-editor, audio-toggles, loop-resize, tap-resync)
- `libs/app-common/*.test.js` - Tests unitaris (loop-control, range, utils, audio-init)
- `libs/sound/*.test.js` - Tests del motor d'àudio (mixer, index)
- `libs/random/*.test.js` - Tests d'aleatorització
- `libs/utils/*.test.js` - Tests d'utilitats generals
- `tests/` - Tests legacy i d'integració (notació, ear-training, scales, helpers, etc.)

**Patrons de test**:
- Tests unitaris per funcions pures (subdivision, range, number parsing)
- Tests d'integració per components complexos (fraction-editor, pulse-seq)
- Tests de comportament d'àudio (audio-toggles, loop-control, tap-resync)
- Validació de casos límit (loop-resize, audio-schedule)

**Important**: Els tests s'executen en entorn Node.js (`testEnvironment: 'node'`)
amb suport experimental per mòduls VM. Alguns tests simulen DOM i WebAudio;
assegura't que continuen passant després de modificar aquestes zones.
