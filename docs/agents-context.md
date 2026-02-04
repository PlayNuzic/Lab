# 🎭 Sistema de Skills - PlayNuzic Lab

## ✨ Skills Reals de Claude Code

PlayNuzic Lab utilitza **Skills reals de Claude Code** ubicats a `~/.claude/skills/` per proporcionar assistència especialitzada per domini.

### Com Funciona

Els Skills són comandes que pots invocar directament:

```
/ui           → UI Skill (interfícies, components)
/audio        → Audio Skill (àudio, timing, sync)
/modules      → Modules Skill (arquitectura, refactoring)
/creator      → Creator Skill (crear apps noves)
/gamification → Gamification Skill (logros, badges)
/responsive   → Responsive Skill (mobile, responsive)
```

---

## 📋 Els 6 Skills Disponibles

### 🎨 `/ui` - UI Skill
**Especialitat:** Interfícies d'usuari, components visuals, experiència d'usuari

**Utilitza per:**
- Crear components UI nous
- Millorar components existents
- Anàlisi de disseny
- Millores d'UX i accessibilitat

**Capacitats especials:**
- Detecta components duplicats automàticament
- Coneix tots els components de `libs/shared-ui/`
- Garanteix estètica minimalista consistent
- Verifica responsive design

**Exemple:**
```
/ui Necessito un selector de escales per App34
```

**Documentació completa:** `~/.claude/skills/ui/SKILL.md`

---

### 🔊 `/audio` - Audio Skill
**Especialitat:** Sistema d'àudio, timing precís, sincronització

**Utilitza per:**
- Optimització d'àudio
- Debugging de timing
- Configuració de veus
- Performance d'àudio

**⚠️ CRÍTIC - Fitxers Protegits:**
- `libs/sound/clock.js`
- `libs/app-common/pulse-interval-calc.js`
- `libs/app-common/voice-sync.js`

**Capacitats especials:**
- Prevé automàticament modificacions als fitxers crítics
- Proposa wrappers en lloc de modificacions directes
- Coneix tot el sistema TimelineAudio
- Expert en seqüenciadors (pulse-seq, matrix-seq, interval-sequencer)

**Exemple:**
```
/audio Debug problema de sincronització a App22
```

**Documentació completa:** `~/.claude/skills/audio/SKILL.md`

---

### 📦 `/modules` - Modules Skill
**Especialitat:** Arquitectura, detecció de duplicació, refactoring

**Utilitza per:**
- Detectar codi duplicat
- Extreure funcionalitat a `libs/`
- Reorganitzar estructura de mòduls
- Refactoritzar mantenint compatibilitat

**Capacitats especials:**
- Analitza automàticament duplicació entre Apps
- Coneix els 43+ mòduls de `libs/app-common/`
- Proposa extraccions a `libs/` quan detecta >70% similitud
- Garanteix que tots els tests passen després de refactoritzar

**Exemples recents d'èxit:**
- Creació de `libs/matrix-seq/` (945 línies JS, 275 CSS, 18 tests)
- Creació de `libs/musical-grid/` (565 línies JS, 357 CSS, 26 tests)
- Creació de `libs/interval-sequencer/` (6 mòduls, ~1400 línies, 113 tests)

**Exemple:**
```
/modules Analitza si puc extreure el sistema de notes a libs/
```

**Documentació completa:** `~/.claude/skills/modules/SKILL.md`

---

### 🏗️ `/creator` - Creator Skill
**Especialitat:** Crear aplicacions noves completes des de zero

**Utilitza per:**
- Generar apps completes (AppXX)
- Crear features complexes noves
- Implementar conceptes musicals nous

**Capacitats especials:**
- Coneix tots els patrons d'Apps existents (App1-App35+)
- Utilitza templates optimitzats
- Integra automàticament mòduls compartits
- Garanteix estètica consistent

**Workflow:**
1. Analitza Apps similars
2. Identifica mòduls reutilitzables
3. Genera estructura completa (HTML + CSS + JS)
4. Integra àudio, LEDs i controls
5. Assegura responsive design

**Exemple:**
```
/creator Crea App36: Sequencer de ritmes africans
```

**Documentació completa:** `~/.claude/skills/creator/SKILL.md`

---

### 🎮 `/gamification` - Gamification Skill
**Especialitat:** Logros (achievements), badges, motivació d'usuari

**Utilitza per:**
- Implementar sistema de logros
- Crear badges i recompenses
- Tracking de progrés
- Motivació i engagement

**Capacitats especials:**
- Coneix tot el sistema de `libs/gamification/`
- Proposa logros apropiats per cada tipus d'app
- Implementa notificacions elegants i no invasives
- Tot funciona offline (localStorage)

**Filosofia:**
- Opcional (mai obligatori)
- Discret (no molesta l'experiència musical)
- Local (sense servers)
- Elegant (consistent amb estètica minimalista)

**Exemple:**
```
/gamification Afegeix logros per App34 (ritmes zigzag)
```

**Documentació completa:** `~/.claude/skills/gamification/SKILL.md`

---

### 📱 `/responsive` - Responsive Skill
**Especialitat:** Mobile-first, adaptabilitat cross-device

**Utilitza per:**
- Fer apps responsive
- Optimitzar per mobile
- Touch interactions
- Media queries i breakpoints

**Capacitats especials:**
- Filosofia mobile-first automàtica
- Coneix tots els breakpoints estàndard
- Garanteix controls tactils adequats (min 44x44px)
- Verifica en múltiples dispositius

**Breakpoints:**
- Mobile: 320px - 767px (base)
- Tablet: 768px - 1023px
- Desktop: 1024px+
- Large: 1440px+

**Exemple:**
```
/responsive Optimitza App28 per mobile
```

**Documentació completa:** `~/.claude/skills/responsive/SKILL.md`

---

## 🚀 Com Utilitzar els Skills

### Sintaxi Bàsica
```
/skill [descripció de la tasca]
```

### Exemples Reals

```bash
# Crear Component UI
/ui Crea un selector de tonalitats amb visualització de notes

# Debug Àudio
/audio Les veus de App15 es desincronitzen després de 30 segons

# Detectar Duplicació
/modules Revisa si el sistema de notes de App12, App15 i App22 es pot unificar

# Nova App
/creator App36: Visualitzador de polirítmies amb 4 veus independents

# Afegir Gamificació
/gamification Implementa logros per App34 (primera sessió, 10 ritmes, etc.)

# Fer Responsive
/responsive App29 no funciona bé en iPhone, corregeix-ho
```

---

## ⚠️ Regles Crítiques (TOTES LES SESSIONS)

### 🚫 FITXERS INTOCABLES:
Aquests fitxers són el core del sistema i **MAI** es poden modificar:

- `libs/sound/clock.js` - Sistema de timing crític
- `libs/app-common/pulse-interval-calc.js` - Càlculs d'intervals
- `libs/app-common/voice-sync.js` - Sincronització de veus

**Si cal canviar alguna cosa relacionada amb aquests fitxers:**
✅ Crear wrappers o extensions
✅ Utilitzar hooks i callbacks existents
❌ NO modificar els fitxers directament

### ✅ SEMPRE:
1. **Mostrar codi ABANS de crear fitxers**
2. **Esperar aprovació explícita (✅) de l'usuari**
3. **Crear nous fitxers en comptes de modificar existents**
4. **Escriure tests per nous components**
5. **Executar `npm test` després de canvis**
6. **Usar overlays/wrappers en comptes de modificacions directes**

---

## 📁 Estructura del Projecte

```
Lab/
├── Apps/                    # 29+ apps (App1-App35+)
├── libs/
│   ├── app-common/         # 43 mòduls compartits
│   ├── pulse-seq/          # Seqüències de pulsos (8 modes)
│   ├── matrix-seq/         # Grid editor N-P
│   ├── musical-grid/       # Grid 2D amb scroll
│   ├── interval-sequencer/ # Sequencer iS-iT
│   ├── notation/           # VexFlow rendering
│   ├── random/             # Randomització
│   ├── sound/              # Audio engine TimelineAudio
│   ├── shared-ui/          # Components UI
│   ├── gamification/       # Sistema de logros
│   ├── plano-modular/      # Grid 2D modular
│   └── audio-capture/      # Captura d'àudio/ritmes
└── tests/                  # 60+ suites, 1100+ tests

~/.claude/skills/            # Skills reals de Claude Code ⭐
├── ui/SKILL.md             # UI Skill (147 línies)
├── audio/SKILL.md          # Audio Skill (206 línies)
├── modules/SKILL.md        # Modules Skill (301 línies)
├── creator/SKILL.md        # Creator Skill (449 línies)
├── gamification/SKILL.md   # Gamification Skill (401 línies)
├── responsive/SKILL.md     # Responsive Skill (658 línies)
└── README.md               # Guia d'ús (253 línies)
```

---

## 🎯 Avantatges dels Skills Reals

### Context Especialitzat Automàtic
Cada skill coneix completament el seu domini sense necessitat d'explicacions.

### Restriccions de Seguretat Automàtiques
- **Audio Skill** bloqueja modificacions a fitxers crítics
- **Modules Skill** garanteix tests després de refactoritzar
- **UI Skill** força buscar a `libs/shared-ui/` primer

### Detecció Intel·ligent
- **Modules Skill** detecta duplicació >70% automàticament
- **UI Skill** identifica components reutilitzables
- **Creator Skill** analitza Apps similars abans de crear

### Templates Optimitzats
- **Creator Skill** proporciona templates complets
- **Gamification Skill** té patrons predefinits de logros
- **Responsive Skill** té breakpoints estàndard

---

## 💡 Templates Ràpids

### Crear Component
```
/ui Crea component [nom] amb [requisits]
```

### Debug Àudio
```
/audio Debug problema a [App/fitxer]

Símptomes: [descripció]
```

### Nova App
```
/creator App[N] - [nom descriptiu]

Concepte musical: [descripció]
```

### Extreure Mòdul
```
/modules Extreu [funcionalitat] de App[X] a libs/

Duplicació detectada amb App[Y] i App[Z]
```

### Afegir Gamificació
```
/gamification Implementa logros per App[N]

Tipus: [creació, exploració, mestria, etc.]
```

### Optimitzar Responsive
```
/responsive App[N] necessita suport mobile

Problemes: [descripció]
```

---

## 🎨 Filosofia de PlayNuzic Lab

- **Minimalisme**: UI neta, codi simple
- **Reutilització**: ~70% codi compartit
- **No invasió**: Mai trencar l'existent
- **Testing**: 1100+ tests han de passar sempre
- **Modularització**: Extreure a `libs/` quan hi ha duplicació
- **Mobile-first**: Responsive per defecte
- **Offline-first**: Tot funciona sense connexió

---

## 📚 Documentació

### Guies d'Ús
- **Guia ràpida dels Skills:** `~/.claude/skills/README.md`
- **Guia principal del projecte:** `CLAUDE.md`
- **Context general:** Aquest document (`docs/agents-context.md`)

### Documentació de Skills
- `~/.claude/skills/ui/SKILL.md` - UI Skill complet
- `~/.claude/skills/audio/SKILL.md` - Audio Skill complet
- `~/.claude/skills/modules/SKILL.md` - Modules Skill complet
- `~/.claude/skills/creator/SKILL.md` - Creator Skill complet
- `~/.claude/skills/gamification/SKILL.md` - Gamification Skill complet
- `~/.claude/skills/responsive/SKILL.md` - Responsive Skill complet

### Referència Tècnica
- `docs/modules-reference.md` - Documentació completa de mòduls
- `libs/*/README.md` - Documentació de cada llibreria

---

## 🎯 Començar a Utilitzar

1. **Els skills estan actius automàticament** (ubicats a `~/.claude/skills/`)
2. **Invoca'ls directament:** `/ui [tasca]`, `/audio [tasca]`, etc.
3. **Consulta la guia ràpida:** `~/.claude/skills/README.md`
4. **Confia en el context especialitzat** de cada skill

---

**Sistema de Skills reals completament funcional per PlayNuzic Lab!** 🎉

**Ubicació:** `~/.claude/skills/`
**Total documentació:** 2,415 línies
**Data implementació:** 2026-02-04
