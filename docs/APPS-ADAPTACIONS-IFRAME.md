# Adaptacions grafiques de les Apps per iframe (embed mode)

Document complementari a `SISTEMA-INTERACTIVO-PLAN.md`.
Descriu les modificacions necessaries a cada app de `Apps/` perque encaixin dins els iframes del Sistema Interactivo.

> **Actualitzacio 2026-04-19** — Refactoring de nuzic-theme completat:
> - **25/25 apps embedides ja tenen `data-visual="nuzic"`** (Fase 2 feta).
> - **Sizes relatives + `clamp()`**: tots els controls, numeros de timeline/soundline i botons escalen amb `clamp(min, Nvw, max)`. Les apps ja son responsives dins un iframe sense overrides per-viewport.
> - **Boto volum relocalitzat**: ja no viu al `<header class="top-bar">`. Dos modes coexistents gestionats per `relocateSoundWrapperForNuzic()` a `libs/shared-ui/header.js`:
>   - `.nuzic-inline` — append a `.controls` (despres de random/reset). Apps estandard (App9, App20, App26, App32-35, ...).
>   - `.nuzic-floating` — `position: fixed` centrat entre els `.soundline-play`. Scale apps (App21-24) que sobreescriuen `.timeline-wrapper`.
> - Aixo simplifica dramaticament l'estrategia d'embed: **el `.top-bar` ja nomes conte `<details class="menu">` (☰) + `<h1>` + `<div class="sound-wrapper">` buit o invisible** en les apps nuzic. El fader del volum viu al cos de l'app.

---

## 1. Estat actual

### Patrons comuns (totes les apps)

- **Header**: Totes usen `renderApp()` de `libs/app-common/template.js` que genera `<header class="top-bar">` amb `<details class="menu">` (☰, esquerra), `<h1>` central i `<div class="sound-wrapper">` (dreta).
- **Volum en apps nuzic**: `initHeader()` crida `relocateSoundWrapperForNuzic()` i mou el mateix DOM node cap a `.controls` (inline) o al body (floating). El `.sound-wrapper` del `.top-bar` queda *buit* — nomes hi ha ☰ i el titol.
- **Template base**: `template.js` genera `.inputs`, `.timeline-wrapper`, `.controls`.
- **Sizes amb clamps**: `nuzic-theme.css` i molts `Apps/*/styles.css` usen `clamp(min, Nvw, max)` per font-size i dimensions de botons — responsive pur, sense media queries.
- **Cap app te deteccio d'iframe**: Nomes comentaris CSS en algunes (app11, App15, App19) pero cap logica real.
- **Nuzic theme**: 25/25 apps embedides ja el tenen activat.

### Estructura DOM tipica d'una app nuzic (post-refactoring)

```
<body data-visual="nuzic">
  <header class="top-bar">
    <details class="menu" id="optionsMenu"> ← ☰ hamburguesa (position: absolute, left)
      <summary>☰</summary>
      <div class="options-content">         ← tema, sons, factory reset
    </details>
    <h1>Titol</h1>                          ← titol central
    <div class="sound-wrapper">             ← BUIT en nuzic (el node s'ha mogut)
      ↳ sense fills en apps nuzic (reubicat a .controls o body)
    </div>
  </header>
  <main>
    <div class="inputs">                    ← parametres (BPM, etc.)
    <div class="timeline-wrapper">          ← area principal
    <div class="controls">                  ← play, random, reset + 🔊 volum (inline)
  </main>
  <!-- Fora de main si floating: -->
  <div class="sound-wrapper nuzic-inline nuzic-floating"> ← scale apps (21-24)
</body>
```

### Consequencia per a l'embed

- **El `.top-bar` en apps nuzic pesa poc**: ☰ a l'esquerra, `<h1>` centrat, `<div class="sound-wrapper">` buit a la dreta. Podem amagar-lo *gairebe* complet i deixar nomes el menu ☰ com a overlay per accedir a temes/sons/factory reset.
- **El volum ja es dins del contingut**: no cal overlays especifics per ell.
- **Els clamps ja fan l'escala**: no cal override de mides per iframe.

---

## 2. Mecanisme d'embed mode

### 2.1 Deteccio (centralitzada a libs/)

Crear un modul compartit:

**`libs/app-common/embed-mode.js`**

```javascript
export function initEmbedMode() {
  const isEmbed = new URLSearchParams(location.search).has('embed');
  if (isEmbed) {
    document.body.setAttribute('data-embed', 'true');
  }
  return isEmbed;
}
```

### 2.2 Activacio des del Sistema Interactivo

```html
<iframe src="Apps/app9/index.html?embed=true"></iframe>
```

Sense `?embed=true`, l'app funciona exactament igual que ara. Res no es trenca.

### 2.3 CSS embed: top-bar com a menu-overlay minim

Afegir a `libs/app-common/embed.css` (importat des de cada app que ho necessiti).

Filosofia: en embed, el `.top-bar` **no ha de ocupar espai vertical**. Deixem nomes `.menu` (☰) visible com a overlay flotant per accedir al submenu de preferencies. Tot el que viu dins `.top-bar` (h1, sound-wrapper buit) s'amaga.

```css
/* ── Embed mode: top-bar reduit a menu-overlay ── */

body[data-embed="true"] .top-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 0;
  z-index: 100;
  pointer-events: none;       /* clics passen al contingut de sota */
  background: transparent;
}

/* Nomes la hamburguesa rep clics. Tot lo altre del top-bar queda inert. */
body[data-embed="true"] .top-bar .menu {
  pointer-events: auto;
  opacity: 0.35;
  transition: opacity 0.2s ease;
}

body[data-embed="true"] .top-bar .menu:hover,
body[data-embed="true"] .top-bar .menu[open] {
  opacity: 1;
}

/* Amagar titol (el proporciona el Sistema). */
body[data-embed="true"] .top-bar h1 {
  display: none;
}

/* Amagar el wrapper del volum del top-bar: en apps nuzic esta buit (el node
   s'ha mogut a .controls o body); en apps no-nuzic el mantindriem visible,
   pero com totes les apps embedides son nuzic (25/25), sempre cal amagar. */
body[data-embed="true"] .top-bar .sound-wrapper {
  display: none;
}

/* Main ocupa tot l'espai vertical. */
body[data-embed="true"] main {
  padding-top: 0;
  min-height: 100vh;
}

/* En mode floating del volum (scale apps 21-24): el .sound-wrapper viu
   al <body> amb position:fixed. Com el JS usa viewport-relatives via
   getBoundingClientRect() dels .soundline-play, la posicio ja es correcta
   dins l'iframe. Cap override necessari. */
```

### Resultat visual

```
+---------------------------------------+
| ☰                                     |  ← 35% opacitat, hover = 100%
|          (no ocupa espai)             |     nomes esquerra; dreta amagada
|                                       |
|          CONTINGUT APP                |
|          (timeline / soundline / …)   |
|                                       |
|          [▶] [🎲] [↺] [🔊]            |  ← volum ja integrat a .controls
+---------------------------------------+
```

- **0px de footprint vertical** — l'app guanya els ~40px del `.top-bar`.
- **Hamburguesa (esquerra)**: semi-transparent, accedeix a tema/sons/reset.
- **Volum**: **ja es a `.controls` dins `<main>`** (`.nuzic-inline`) o flotant entre plays (`.nuzic-floating`). Cap treball extra.
- **Titol**: amagat (el proporciona el Sistema).
- **Contingut**: els clamps de nuzic-theme (`clamp(min, Nvw, max)`) ja escalen adequadament en l'iframe reduit.

### 2.4 Interaccio amb `relocateSoundWrapperForNuzic`

El MutationObserver de `header.js` ja reacciona a mutations del `<body>`. Quan el CSS aplica `display: none` al `.sound-wrapper` original del `.top-bar` en embed, no hi ha impacte: el node mogut (inline/floating) **ja viu fora del `.top-bar`** i no es veu afectat per la regla `body[data-embed="true"] .top-bar .sound-wrapper`. Zero conflicte.

---

## 3. Adaptacions per app

### Accions comunes (TOTES les 25 apps embedides)

- [x] `data-visual="nuzic"` + import `nuzic-theme.css` → **fet**
- [ ] Importar `embed-mode.js` i cridar `initEmbedMode()` a l'inici
- [ ] Importar `embed.css`
- [ ] Verificar que els clamps de `nuzic-theme.css` escalen be a l'ample del container de l'iframe
- [ ] Verificar que l'overlay ☰ no tapa elements funcionals al canto superior esquerra
- [ ] Verificar que el volum (inline o floating) queda visible i funcional

### Accions per app individual

#### app9 — Linea Temporal (Paso 4)

- Overlay embed → automatic via CSS.
- `.timeline-wrapper` ja ocupa tot l'ample del `<main>`.
- BPM inline dins `.controls` → OK (el volum s'hi afegeix al final).

#### app10 — Linea Sonora (Paso 5)

- Soundline vertical → layout `span-right` al Sistema (unic cas).
- Verificar que el soundline escala be en un container mes estret (1 columna de 3).
- Els numeros del soundline usen `clamp(0.9rem, 1.8vw, 1.6rem)` → escalaran.

#### app11 / App11A — El Plano (Pasos 3, 6)

- Ambdos tenen nuzic-theme.
- **Paso 3**: usar `app11` amb config aleatoria (nomes play).
- **Paso 6**: usar `app11` o `App11A` amb click a celles + aleatori.
- El grid musical escala amb `clamp()` → responsive dins iframe.

#### App12 — Plano y Sucesion N-P (Paso 7)

- Te editor N-P (taula Nm/Psg) → visible i funcional dins l'iframe.
- Controls: play + random + delete + **volum inline** (apendre despres de reset).

#### app13 — Intervals intro (Paso 8)

- Verificar estructura i funcionalitat en embed.

#### App14 — Intervalo Sonoro (Paso 9)

- Layout de dos columnes propi → verificar adaptacio al container.

#### App15 — Plano y Sucesion Intervalos (Paso 10)

- Te `.app-content` container propi → verificar compatibilitat.
- Grid + editor d'intervals → verificar visibilitat completa.

#### App16 — Modul Temporal Lineal (Paso 12)

- Verificar estructura.

#### App17 — Modul Temporal Circular (Paso 13)

- Layout circular → verificar aspect ratio dins iframe.

#### App18 — Registre Sonor (Paso 14)

- Selector de registre/octava → verificar funcionalitat en embed.

#### App19 — Plano Modular (Paso 15)

- Layout 2 columnes propi (left-column + right-column) → el mes complex.
- Comentari CSS "Permite compresion en iframes" existent → parcialment preparat.
- Verificar que el registre selector funciona be.

#### App20 — Plano y Sucesion N-iT (Paso 16)

- Similar a App15 pero amb intervals temporals.

#### App21-24 — Escalas (Pasos 22-25) ⚠️ especials

- **Aquestes apps substitueixen `.timeline-wrapper`** amb el seu propi layout → no tenen `.controls` estandard.
- El volum usa **`.nuzic-floating`**: `position: fixed`, JS el centra entre els `.soundline-play` via `getBoundingClientRect()`. Com `getBoundingClientRect()` es relatiu al viewport de l'iframe, funciona sense tocar res.
- Verificar que el resize listener de `relocateSoundWrapperForNuzic` reacciona quan el Sistema redimensiona l'iframe (probablement si, rep l'event de `window.resize` de dins l'iframe).
- App24 es minimal (selector d'escales).

#### App25 / App25B — Melodies amb Escalas (Pasos 26-27)

- App25: melodies amb escales.
- App25B: melodies amb intervals sonors (iS).
- Verificar que els grids escalen dins iframe.

#### App26 — Fraccions Simples (Paso 17)

- Editor de fraccions dins `.timeline-wrapper`.
- BPM inline mogut dins el wrapper → verificar posicio en embed.

#### App28 — Sucesio Polsos Fraccionats (Paso 18)

- Sequencia de polsos amb fraccions.
- Verificar visibilitat de l'editor.

#### App30 — Sucesio iT Fraccionats (Paso 19)

- Intervals temporals fraccionats.

#### App32 — Plano amb Fraccio Simple (Paso 20)

- Grid + fraccions → mes complex visualment.
- Verificar escala del grid dins iframe.

#### App34 — Sucesio en Plano Fraccions Simples (Paso 21)

- La mes completa de fraccions.
- Usa `injectBpmAndSoundGroup()` → verificar compatibilitat embed.
- **El `.controls` es reconstruit dins `init()`** (`while (firstChild) removeChild(...)`); el MutationObserver de `relocateSoundWrapperForNuzic` ja re-apenda el volum al final. Zero treball extra per embed.

#### App35 — Sucesio en Plano Fraccions Complexes (Paso 21 extra)

- Extra accessible des de paso 21.
- Similar a App34 pero amb fraccions complexes.

---

## 4. Coherencia visual (referencia PDF)

### Colors del PDF (ja aplicats via nuzic-theme)

| Element | Color PDF | Variable CSS |
|---------|-----------|-------------|
| Fons area soundline | Rosa clar (#fdf0f0) | `--nuzic-pink-light` |
| Fons area timeline | Beix clar (#fff8e8) | `--nuzic-yellow-light` |
| Bloc de nota activa | Blau clar (#bdd9e6) | `--nuzic-blue-light` |
| Boto play | Verd Nuzic (#7cd6b3) | `--nuzic-green` |
| Controls BPM fons | Groc Nuzic (#ffbb33) | `--nuzic-yellow` |
| Text grid (numeros) | Gris fosc (#43433b) | `--nuzic-dark` |
| Punts grid | Gris (#AAA699) | `--nuzic-grey` |
| Barra progres nota | Rosa (#f28aad) | `--nuzic-pink` |

### Controls consistents (referencia PDF)

Tots els controls ja segueixen el patro visual del PDF via nuzic-theme:

- **Boto Play**: cercle verd `--nuzic-green`, icona blanca. Size `clamp(2rem, 5vw, 3rem)`.
- **Botons random/reset/volum**: cercles pale-mint `#cbefe1` (hardcoded — no flipen en dark mode). Size `clamp(1.5rem, 3.5vw, 2.25rem)`.
- **Botons BPM (+/-)**: grocs `--nuzic-yellow`, text fosc.
- **Display BPM**: fons clar, text gran centrat amb clamp.
- **Fader volum**: popup vertical que creix amunt sobre el boto, thumb hardcoded `#cbefe1`.

---

## 5. Prioritat d'implementacio

### ~~Fase 1~~ ✅ ~~Fase 2~~ ✅ (nuzic-theme + volum relocalitzat + clamps)

Tot fet abans del Sistema Interactivo:
- Nuzic theme a 25/25 apps embedides.
- `relocateSoundWrapperForNuzic()` amb modes inline/floating (commits `4f5a03a`, `901930a`).
- Sizes relatives via `clamp()` a controls, numeros de timeline i fonts.

### Fase 1 (nova): Infraestructura embed (1 cop)

1. Crear `libs/app-common/embed-mode.js`.
2. Crear `libs/app-common/embed.css` (top-bar → menu-overlay, sound-wrapper del top-bar amagat, h1 amagat, `main` a 100vh).
3. Testejar amb una app standard (app9 o app11) i una scale app (App21-24) per validar els dos modes del volum.

### Fase 2 (nova): embed mode a cada app (individual)

4. Importar `initEmbedMode()` i `embed.css` a cadascuna de les 25 apps.
5. Testejar cada app amb `?embed=true` dins el Sistema.
6. Verificar que l'overlay ☰ no tapa elements funcionals al canto superior esquerra.
7. Ajustar layouts individuals si cal (especialment App19, App17, App21-24).

### Fase 3 (nova): Ajustaments fins (per-app)

8. Verificar que els clamps escalen be dins iframes estrets (1/3 de pantalla).
9. Verificar que editors (N-P, fraccions, iS, iSº) son funcionals.
10. Verificar que `relocateSoundWrapperForNuzic` reposiciona correctament en floating mode al redimensionar el Sistema.
11. Test responsive dins iframe + responsive vertical del Sistema (mobil).

---

## 6. Checklist per app

Columna "volum" indica el mode aplicat per `relocateSoundWrapperForNuzic`:
- **inline** — apps amb `.controls` estandard (la gran majoria).
- **floating** — apps que sobreescriuen `.timeline-wrapper` i no tenen `.controls` (scale apps).

| App | Paso | nuzic-theme | volum | embed-mode.js | embed.css | Testat iframe | Notes |
|-----|------|-------------|-------|---------------|-----------|---------------|-------|
| app9 | 4 | [x] | inline | [ ] | [ ] | [ ] | |
| app10 | 5 | [x] | inline | [ ] | [ ] | [ ] | span-right unic cas |
| app11 | 3,6 | [x] | inline | [ ] | [ ] | [ ] | |
| App11A | 3,6 | [x] | inline | [ ] | [ ] | [ ] | alternativa a app11 |
| App12 | 7 | [x] | inline | [ ] | [ ] | [ ] | editor N-P |
| app13 | 8 | [x] | inline | [ ] | [ ] | [ ] | |
| App14 | 9 | [x] | inline | [ ] | [ ] | [ ] | 2-col propi |
| App15 | 10 | [x] | inline | [ ] | [ ] | [ ] | |
| App16 | 12 | [x] | inline | [ ] | [ ] | [ ] | |
| App17 | 13 | [x] | inline | [ ] | [ ] | [ ] | circular layout |
| App18 | 14 | [x] | inline | [ ] | [ ] | [ ] | |
| App19 | 15 | [x] | inline | [ ] | [ ] | [ ] | layout complex |
| App20 | 16 | [x] | inline | [ ] | [ ] | [ ] | |
| App21 | 22 | [x] | floating | [ ] | [ ] | [ ] | scale app |
| App22 | 23 | [x] | floating | [ ] | [ ] | [ ] | scale app |
| App23 | 24 | [x] | floating | [ ] | [ ] | [ ] | scale app |
| App24 | 25 | [x] | floating | [ ] | [ ] | [ ] | minimal, scale app |
| App25 | 26 | [x] | inline | [ ] | [ ] | [ ] | |
| App25B | 26,27 | [x] | inline | [ ] | [ ] | [ ] | |
| App26 | 17 | [x] | inline | [ ] | [ ] | [ ] | |
| App28 | 18 | [x] | inline | [ ] | [ ] | [ ] | |
| App30 | 19 | [x] | inline | [ ] | [ ] | [ ] | |
| App32 | 20 | [x] | inline | [ ] | [ ] | [ ] | |
| App34 | 21 | [x] | inline | [ ] | [ ] | [ ] | `.controls` rewrite + observer |
| App35 | 21+ | [x] | inline | [ ] | [ ] | [ ] | extra |

---

## 7. Referencies internes

- Volum relocalitzat (inline): commit `4f5a03a` — `feat(nuzic-theme): relocate volume button into .controls row`.
- Volum flotant (scale apps): commit `901930a` — `feat(nuzic-theme): add floating volume placement for scale apps (21-24)`.
- Fix dark mode botons pale-mint: commit `ee9789b`.
- Logica de relocalitzacio: `libs/shared-ui/header.js` → `relocateSoundWrapperForNuzic()`.
- Estils dels dos modes del volum: `libs/shared-ui/nuzic-theme.css` → blocs `.sound-wrapper.nuzic-inline` i `.sound-wrapper.nuzic-floating`.
- Sizes responsives: `clamp(min, Nvw, max)` a `nuzic-theme.css` (21 usos) i `Apps/*/styles.css` (multiples per app).
