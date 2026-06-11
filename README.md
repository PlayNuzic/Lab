# Lab — PlayNuzic

Investigació i desenvolupament del mètode Nuzic per al ritme i el temps musical.

**Monorepo modular** d'aplicacions interactives + un sistema educatiu narratiu (Sistema Interactivo). ~70% del codi viu a `libs/` compartit. Sense build step — ES2022 modules s'executen directament al navegador.

## 🚀 Quick Start

```bash
./setup.sh         # Configura Git i instal·la dependències (Jest)
npm test           # Executa 72 test suites, 1380+ tests
npx http-server    # Serveix les apps i el Sistema localment
```

Obre [http://localhost:8080/sistema/](http://localhost:8080/sistema/) per al Sistema Interactivo, o [http://localhost:8080/Apps/](http://localhost:8080/Apps/) per al llistat d'apps.

## 📁 Estructura

```
Apps/             — 35+ apps rítmiques i temporals (App1–App35)
libs/             — 22 mòduls compartits (audio, UI, fracció, plano, scale, etc.)
sistema/          — Sistema Interactivo: 27 slides educatius que embolcallen 25 apps
docs/             — Documentació tècnica i specs
tests/            — Tests d'integració + harness embed (72 suites, 1380+ tests)
```

## 🎵 Apps

35+ apps al directori `Apps/`, organitzades per categoria didàctica al Sistema Interactivo. Cada app té el seu README amb detalls. Algunes destacades:

- **App1–App4** — Bases temporals (timeline, pulse-seq editor, fraction editor, multi-fraction)
- **App9 / App10 / App17** — Línies temporal/sonora i timeline circular
- **app11 / App11A / App12** — Plano musical (graella 2D temps × notes)
- **App19 / App20** — Plano modular amb registres i sucessions N-iT
- **App21–App25B** — Apps d'escales musicals
- **App26–App35** — Fraccions rítmiques i complexos

Totes les apps embedides al Sistema usen tema visual `data-visual="nuzic"` amb `clamp()` responsive — escalen automàticament dins de qualsevol iframe.

## 📚 Sistema Interactivo

Capa de presentació narrativa que guia l'usuari pel mètode Nuzic mitjançant 27 slides combinant text teòric amb apps interactives embedides via iframe.

- **Implementació**: [`sistema/`](sistema/) (HTML + ES2022 + CSS pur, sense build).
- **Layouts**: `A-intro`, `B-app-left`, `D-app-narrow`, `E-app-text-left` definits a [`sistema/js/slide-data.js`](sistema/js/slide-data.js).
- **Responsive**: una sola media query `@media (max-width: 900px)` col·lapsa a vertical (mòbil + tablet portrait).
- **Embed mode**: les apps reben `?embed=true` i el shared [`libs/app-common/embed.css`](libs/app-common/embed.css) oculta el top-bar i adapta visualment.
- **Edit mode**: `?tweaks=1` activa edició inline dels textos amb persistència a localStorage. Veure [docs/SISTEMA-EDIT-MODE.md](docs/SISTEMA-EDIT-MODE.md).
- **Documentació**:
  - Pla i mapatge slide↔app: [docs/SISTEMA-INTERACTIVO-PLAN.md](docs/SISTEMA-INTERACTIVO-PLAN.md)
  - Specs per app: [docs/SISTEMA-APP-SPECS.md](docs/SISTEMA-APP-SPECS.md)
  - Adaptacions a iframe: [docs/APPS-ADAPTACIONS-IFRAME.md](docs/APPS-ADAPTACIONS-IFRAME.md)

## 🧩 Llibreries (`libs/`)

```
app-common/          — Middleware: 50 mòduls (audio, DOM, loop, fraction-editor, ...)
sound/               — Motor d'àudio sobre Tone.js (TimelineAudio, mixer, samples)
shared-ui/           — Header, dropdowns, tema Nuzic, performance audio menu
plano-modular/       — Grid 2D N×P amb soundline + timeline (App19, App20)
musical-grid/        — Grid 2D simple (App11A, App12)
pulse-seq/           — Editor de seqüència de pulsos amb parser
matrix-seq/          — Editor 2D de parells N-P
notation/            — Renderització de partitures via VexFlow
random/              — Sistema de randomització amb menú UI
gamification/        — Sistema d'achievements i scoring
interval-sequencer/  — Seqüenciació basada en intervals
temporal-intervals/  — Blocs visuals d'iT a la timeline
scales/              — Definicions d'escales musicals
scale-selector/      — Selector d'escales
ear-training/        — Utilitats d'entrenament auditiu
soundlines/          — Línies sonores especialitzades
plano-fraccion/      — Plano amb fraccions
audio-capture/       — Captura d'àudio
cards/               — Targetes nota-component
guide/               — Guia interactiva
utils/               — Utilitats compartides
vendor/              — Tone.js 15.x, VexFlow 5.0.0, chromatone-theory
```

## 🧪 Testing

**72 test suites, 1380+ tests** amb Jest 29.x. ES Modules amb Babel.

```bash
npm test                                    # Tots els tests
npm test -- --testPathPattern="loop"        # Tests específics
```

Suites principals a `libs/app-common/__tests__/`, `libs/plano-modular/__tests__/`, `libs/sound/`, `libs/pulse-seq/__tests__/`, etc.

## 🛠 Patró d'inicialització modern

```javascript
import { bindRhythmElements } from '../../libs/app-common/dom.js';
import { createRhythmAudioInitializer } from '../../libs/app-common/audio-init.js';
import TimelineAudio from '../../libs/sound/index.js';

const { elements, leds, ledHelpers } = bindRhythmElements({ /* config */ });
const initAudio = createRhythmAudioInitializer({ /* config */ });
const audio = await initAudio();
```

**Llegacy (no usar)**: `initRhythmApp()`, `createStandardElementMap()`, `bindRhythmAppEvents()`.

## 📖 Documentació

| Document | Descripció |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | Guia per Claude Code amb arquitectura i regles del repositori |
| [docs/MODULES.md](docs/MODULES.md) | Index complet de mòduls amb patrons d'import |
| [docs/LAB_SYSTEM_RULES.md](docs/LAB_SYSTEM_RULES.md) | Regles tècniques per timing, audio, loop, mixer |
| [docs/agents-context.md](docs/agents-context.md) | Documentació de skills i agents |
| [docs/SISTEMA-INTERACTIVO-PLAN.md](docs/SISTEMA-INTERACTIVO-PLAN.md) | Pla del Sistema Interactivo |
| [SESSION_STATE.md](SESSION_STATE.md) | Estat de sessió actual (treball en curs) |
| `Apps/*/README.md` | README per app (algunes amb cobertura completa) |
| `libs/*/README.md` | README per llibreria |

## 🔧 Dependències principals

- **Tone.js 15.x** — Síntesi i timing precís d'àudio
- **VexFlow 5.0.0** — Renderització de notació musical
- **Jest 29.x** — Framework de testing
- **ES2022** — Sense build step, mòduls natius del navegador

## 🤝 Contribuir

1. Executar `./setup.sh` per configurar l'entorn.
2. Executar `npm test` abans de fer commits — tots els tests han de passar.
3. **Sempre buscar a `libs/` primer**, crear mòdul reutilitzable segon, codi específic d'app com a últim recurs.
4. Mostrar codi abans de crear nous fitxers; esperar aprovació explícita.
5. Mai trencar la funcionalitat existent — si un canvi en aquell sentit és necessari, comentar-ho i validar.

## 📝 Llicència

Veure [LICENSE](LICENSE).
