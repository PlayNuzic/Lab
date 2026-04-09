# Adaptacions grafiques de les Apps per iframe (embed mode)

Document complementari a `SISTEMA-INTERACTIVO-PLAN.md`.
Descriu les modificacions necessaries a cada app de `Apps/` perque encaixin dins els iframes del Sistema Interactivo.

---

## 1. Estat actual

### Patrons comuns (totes les apps)

- **Header**: Totes usen `renderApp()` de `libs/app-common/template.js` que genera `<header class="top-bar">` amb menu hamburguesa (☰, esquerra) i control de volum (🔊, dreta). Cap de les apps embedides te notacio ni gamificacio.
- **Template base**: `template.js` genera `.inputs`, `.timeline-wrapper`, `.controls`.
- **Cap app te deteccio d'iframe**: Nomes comentaris CSS en algunes (app11, App15, App19) pero cap logica real.
- **Nuzic theme**: 6 apps ja el tenen (app10, App11A, App12, App15, App20, App34). La resta esta preparada pero no activada.

### Estructura DOM tipica d'una app

```
<body>
  <header class="top-bar">
    <details class="menu">         ← ☰ hamburguesa (position: absolute, left)
      <summary>☰</summary>
      <div class="options-content"> ← tema, sons, opcions
    </details>
    <h1>Titol</h1>                 ← titol central
    <div class="sound-wrapper">    ← 🔊 volum (position: absolute, right)
      <input id="volumeSlider">   ← fader desplegable
    </div>
  </header>
  <main>
    <div class="inputs">           ← parametres (BPM, etc.)
    <div class="timeline-wrapper"> ← area principal
    <div class="controls">         ← play, random, reset
  </main>
</body>
```

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

### 2.3 CSS embed: overlay flotant (zero footprint)

Afegir a `libs/app-common/embed.css` (importat des de cada app que ho necessiti).

La barra `.top-bar` passa de `position: relative` (ocupa 40px) a `position: absolute` (overlay, 0px). Els botons de menu i volum ja son `position: absolute` dins la barra, aixi que segueixen visibles als cantons.

```css
/* ── Embed mode: top-bar com a overlay sense footprint ── */

body[data-embed="true"] .top-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 0;
  z-index: 100;
  pointer-events: none;       /* clics passen al contingut de sota */
}

/* Hamburguesa i volum: visibles pero discrets */
body[data-embed="true"] .top-bar .menu,
body[data-embed="true"] .top-bar .sound-wrapper {
  pointer-events: auto;       /* ells si son clicables */
  opacity: 0.3;
  transition: opacity 0.2s ease;
}

/* Totalment visibles al interactuar */
body[data-embed="true"] .top-bar .menu:hover,
body[data-embed="true"] .top-bar .menu[open],
body[data-embed="true"] .top-bar .sound-wrapper:hover,
body[data-embed="true"] .top-bar .sound-wrapper:focus-within {
  opacity: 1;
}

/* Amagar titol (ja el proporciona el Sistema) */
body[data-embed="true"] .top-bar h1 {
  display: none;
}

/* Main ocupa tot l'espai vertical */
body[data-embed="true"] main {
  padding-top: 0;
  height: 100vh;
}
```

### Resultat visual

```
+---------------------------------------+
| ☰                                🔊  |  ← overlay, 30% opacitat
|          (no ocupa espai)             |     botons als cantons
|                                       |
|          CONTINGUT APP                |
|          (100% de l'alcada)           |
|                                       |
+---------------------------------------+
```

- **0px de footprint vertical** — l'app guanya els ~40px que ocupava la barra
- **Hamburguesa (esquerra)**: semi-transparent, visible al hover, menu desplegable funcional
- **Volum (dreta)**: semi-transparent, visible al hover, fader desplegable funcional
- **Titol**: amagat (el proporciona el text lateral del Sistema)
- **pointer-events: none** al pare + **auto** als fills = els clics al centre passen a l'app

---

## 3. Adaptacions per app

### Accions comunes (TOTES les 21 apps embedides)

- [ ] Importar `embed-mode.js` i cridar `initEmbedMode()` a l'inici
- [ ] Importar `embed.css`
- [ ] Verificar que l'overlay no tapa elements funcionals als cantons superiors
- [ ] Verificar que els controls (play, BPM) queden visibles i funcionals

### Accions per app individual

#### app9 — Linea Temporal (Paso 4)

- Overlay embed → automatic via CSS
- L'area `.timeline-wrapper` ha d'ocupar tot l'ample
- Controls BPM inline ja estan dins el contingut → OK
- **Afegir nuzic-theme**: Actualment NO te `data-visual="nuzic"`

#### app10 — Linea Sonora (Paso 5)

- Ja te nuzic-theme ✓
- El soundline es vertical → layout span-right al Sistema (unic cas)
- Verificar que el soundline escala be en un container mes estret (1 columna de 3)

#### app11 / App11A — El Plano (Pasos 3, 6)

- app11 NO te nuzic-theme. **App11A si** → usar App11A per coherencia
- El grid musical ha d'escalar amb el container (responsive dins iframe)
- Paso 3: plano en mode aleatori (nomes play)
- Paso 6: plano amb click a celles + aleatori

#### App12 — Plano y Sucesion N-P (Paso 7)

- Ja te nuzic-theme ✓
- Te editor N-P (taula Nm/Psg) → ha de ser visible i funcional dins l'iframe
- Controls: play + random + delete → mantenir
- L'editor es la part inferior → verificar que no queda tallat

#### app13 — Intervals intro (Paso 8)

- Verificar estructura i funcionalitat en embed
- Afegir nuzic-theme

#### App14 — Intervalo Sonoro (Paso 9)

- Layout de dos columnes propi → verificar adaptacio al container
- Afegir nuzic-theme

#### App15 — Plano y Sucesion Intervalos (Paso 10)

- Ja te nuzic-theme ✓
- Te `.app-content` container propi → verificar compatibilitat
- Grid + editor d'intervals → verificar visibilitat completa

#### App16 — Modul Temporal Lineal (Paso 12)

- Verificar estructura
- Afegir nuzic-theme

#### App17 — Modul Temporal Circular (Paso 13)

- Layout circular → verificar aspect ratio dins iframe
- Afegir nuzic-theme

#### App18 — Registre Sonor (Paso 14)

- Selector de registre/octava → verificar funcionalitat en embed
- Afegir nuzic-theme

#### App19 — Plano Modular (Paso 15)

- Layout 2 columnes propi (left-column + right-column) → el mes complex
- Ja te comentari "Permite compresion en iframes" → parcialment preparat
- Verificar que el registre selector funciona be
- Afegir nuzic-theme

#### App20 — Plano y Sucesion N-iT (Paso 16)

- Ja te nuzic-theme ✓
- Similar a App15 pero amb intervals temporals

#### App21-24 — Escalas (Pasos 22-25)

- Totes necessiten verificacio d'embed mode
- App24 es minimal (selector d'escales)
- Afegir nuzic-theme a totes

#### App25 / App25B — Melodies amb Escalas (Pasos 26-27)

- App25: melodies amb escales
- App25B: melodies amb intervals sonors (iS)
- Verificar que els grids escalen dins iframe
- Afegir nuzic-theme

#### App26 — Fraccions Simples (Paso 17)

- Editor de fraccions dins `.timeline-wrapper`
- BPM inline mogut dins el wrapper → verificar posicio en embed
- Afegir nuzic-theme

#### App28 — Sucesio Polsos Fraccionats (Paso 18)

- Sequencia de polsos amb fraccions
- Verificar visibilitat de l'editor
- Afegir nuzic-theme

#### App30 — Sucesio iT Fraccionats (Paso 19)

- Intervals temporals fraccionats
- Verificar funcionalitat en embed
- Afegir nuzic-theme

#### App32 — Plano amb Fraccio Simple (Paso 20)

- Grid + fraccions → mes complex visualment
- Verificar escala del grid dins iframe
- Afegir nuzic-theme

#### App34 — Sucesio en Plano Fraccions Simples (Paso 21)

- Ja te nuzic-theme ✓
- La mes completa de fraccions
- Usa `injectBpmAndSoundGroup()` → verificar compatibilitat embed

#### App35 — Sucesio en Plano Fraccions Complexes (Paso 21 extra)

- Extra accessible des de paso 21
- Similar a App34 pero amb fraccions complexes
- Verificar funcionalitat en embed
- Afegir nuzic-theme

---

## 4. Coherencia visual (referencia PDF)

### Colors del PDF que totes les apps han de respectar

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

### Accio global: nuzic-theme a TOTES les apps embedides

Actualment 6 apps tenen nuzic-theme (app10, App11A, App12, App15, App20, App34). Per coherencia visual amb el PDF, **TOTES les 21 apps embedides han de tenir**:

```html
<body data-theme="system" data-visual="nuzic">
```

```html
<link rel="stylesheet" href="../../libs/shared-ui/nuzic-theme.css">
```

La resta d'apps (15) ja estan preparades per activar-lo — nomes cal afegir l'atribut i l'import CSS.

### Controls consistents (referencia PDF)

Tots els controls han de seguir el patro visual del PDF:

- **Boto Play**: cercle verd `--nuzic-green`, icona blanca
- **Botons BPM (+/-)**: rectangles grocs `--nuzic-yellow`, text fosc
- **Display BPM**: fons clar, text gran centrat
- **Botons random/delete**: cercles grisos, icones blanques

---

## 5. Prioritat d'implementacio

### Fase 1: Infraestructura embed (1 cop)

1. Crear `libs/app-common/embed-mode.js`
2. Crear `libs/app-common/embed.css` (overlay flotant)
3. Testejar amb una app (app9 o App11A)

### Fase 2: nuzic-theme a totes les apps (batch)

4. Afegir `data-visual="nuzic"` i import nuzic-theme.css a les 15 apps que no el tenen
5. Verificar que els colors es veuen correctament
6. Ajustar si algun element queda malament amb el tema

### Fase 3: embed mode a cada app (individual)

7. Importar `initEmbedMode()` i `embed.css` a cadascuna de les 21 apps
8. Testejar cada app amb `?embed=true`
9. Verificar que l'overlay no tapa elements funcionals als cantons
10. Ajustar layouts individuals si cal (especialment App19, App17)

### Fase 4: Ajustaments fins (per-app)

11. Verificar aspect ratios dins iframes
12. Verificar que editors (N-P, fraccions) son funcionals
13. Verificar responsive dins iframe

---

## 6. Checklist per app

| App | Paso | nuzic-theme | embed-mode.js | embed.css | Testat iframe | Notes |
|-----|------|-------------|---------------|-----------|---------------|-------|
| app9 | 4 | [ ] afegir | [ ] | [ ] | [ ] | |
| app10 | 5 | [x] ja te | [ ] | [ ] | [ ] | span-right unic cas |
| App11A | 3,6 | [x] ja te | [ ] | [ ] | [ ] | usar App11A (no app11) |
| App12 | 7 | [x] ja te | [ ] | [ ] | [ ] | editor N-P |
| app13 | 8 | [ ] afegir | [ ] | [ ] | [ ] | |
| App14 | 9 | [ ] afegir | [ ] | [ ] | [ ] | 2-col propi |
| App15 | 10 | [x] ja te | [ ] | [ ] | [ ] | |
| App16 | 12 | [ ] afegir | [ ] | [ ] | [ ] | |
| App17 | 13 | [ ] afegir | [ ] | [ ] | [ ] | circular layout |
| App18 | 14 | [ ] afegir | [ ] | [ ] | [ ] | |
| App19 | 15 | [ ] afegir | [ ] | [ ] | [ ] | layout complex |
| App20 | 16 | [x] ja te | [ ] | [ ] | [ ] | |
| App21 | 22 | [ ] afegir | [ ] | [ ] | [ ] | |
| App22 | 23 | [ ] afegir | [ ] | [ ] | [ ] | |
| App23 | 24 | [ ] afegir | [ ] | [ ] | [ ] | |
| App24 | 25 | [ ] afegir | [ ] | [ ] | [ ] | minimal |
| App25 | 26 | [ ] afegir | [ ] | [ ] | [ ] | |
| App25B | 26,27 | [ ] afegir | [ ] | [ ] | [ ] | |
| App26 | 17 | [ ] afegir | [ ] | [ ] | [ ] | |
| App28 | 18 | [ ] afegir | [ ] | [ ] | [ ] | |
| App30 | 19 | [ ] afegir | [ ] | [ ] | [ ] | |
| App32 | 20 | [ ] afegir | [ ] | [ ] | [ ] | |
| App34 | 21 | [x] ja te | [ ] | [ ] | [ ] | |
| App35 | 21+ | [ ] afegir | [ ] | [ ] | [ ] | extra |
