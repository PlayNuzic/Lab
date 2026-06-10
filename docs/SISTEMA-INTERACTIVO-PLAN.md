# Sistema Interactivo — Pla d'implementacio

> **Estat 2026-04-28** — l'esquelet del Sistema està implementat a [`sistema/`](../sistema/).
> Aquest document es manté com a referència del pla original i el mapatge slide↔app↔layout (seccions 2-3).
> La implementació real ha evolucionat respecte algunes seccions tècniques d'aquest pla.
>
> **Resum del que hi ha avui** (no cal llegir el pla sencer per saber com funciona):
>
> - **Layouts** definits a [`sistema/js/slide-data.js`](../sistema/js/slide-data.js): `A-intro`, `B-app-left`, `D-app-narrow`, `E-app-text-left`. No s'han fet servir els noms `2-col` / `3-col span-left` originals — s'han substituït per noms més descriptius.
> - **Slide content-driven**: `.slide-stage` no té `min-height`, `.slide` no té `flex: 1`. Si el contingut és curt, l'stage és curt; si és llarg, la pàgina scrolla. Veure [`sistema/css/grid.css`](../sistema/css/grid.css).
> - **Iframe sizing determinista**: `width: 100% + aspect-ratio (per slide) + max-height: 700px + margin: 0 auto`. Sense `flex: 1` per evitar conflictes amb aspect-ratio. Veure [`sistema/css/slides.css`](../sistema/css/slides.css).
> - **Responsive**: una sola media query `@media (max-width: 900px)` col·lapsa a layout vertical. Mòbils i tablets en portrait → vertical; tablets en landscape i amunt → horitzontal.
> - **Apps embed**: `?embed=true` activa [`libs/app-common/embed.css`](../libs/app-common/embed.css) que oculta el top-bar, fa el `<main>` flex column, i aplica overrides puntuals (app10/app18 vertical centering, app16 min-height, scale apps soundlines-area).
> - **Edit mode**: `?tweaks=1` activa overrides en localStorage. Veure [SISTEMA-EDIT-MODE.md](SISTEMA-EDIT-MODE.md).
> - **Navegació**: barra inferior amb segments de progrés clicables, prev/next, fletxes de teclat.
>
> **Procés històric** complet de canvis arquitecturals: vegeu `SESSION_STATE.md` (passos 10-15) durant el desenvolupament, o `docs/session-history/` un cop arxivat.

## 1. Visio general

El Sistema Interactivo es la capa de presentacio que embolcalla les apps del Lab repo en un format educatiu navegable. Cada "slide" combina una app interactiva (o imatge) amb text explicatiu i consells practics, guiant l'usuari pel metode Nuzic.

Referencia visual absoluta: `Sistema Interactivo.pdf` — l'objectiu es un WYSIWYG exacte del PDF a la web (sense la columna verda de l'esquerra, que la proporciona la plantilla de WordPress).

---

## 2. Abast: 27 slides, 6 seccions

| Seccio | Slides | Contingut |
|--------|--------|-----------|
| **Introduccion** | 1-6 | Introduccion, Contar y Medir, Contar y Medir la Musica, Linea Temporal, Linea Sonora, El Plano Musical |
| **Descubriendo** | 7-9 | Descubriendo la Musica, Midiendo el movimiento: Los Intervalos, Intervalo Sonoro |
| **Intervalos** | 10 | Intervalos en el Plano Musical |
| **Ampliando** | 11-16 | Patrones/Ciclos/Modulos, El compas, Linea temporal en circulo, Registro de octava, Plano Modular, Plano y Sucesion N-iT |
| **Fraccionando** | 17-21 | Fracciones, Pulsos Fraccionados, iT Fraccionados Simples, Sucesion en Plano Fracciones Simples, Fracciones Complejas |
| **Escalas** | 22-27 | Escogiendo Notas, Estructura Escalar, Transposicion, Diferentes Escalas, Melodias con Escalas, Intervalos con Escalas |

Font: https://www.nuzic.org/sistema-interactivo-paso-a-paso/

---

## 3. Mapatge complet: Slide → Template → App

### Seccio 1: Introduccion

| Paso | Titol | Template | Layout | App | Contingut visual |
|------|-------|----------|--------|-----|------------------|
| 1 | Te gustaria saber que movimientos se producen en la musica? | 2-col | — | — | Imatge carrer + text |
| 2 | Contar y Medir | 2-col | — | — | Imatge cintes metriques + text |
| 3 | Contar y Medir la Musica | 3-col | span-left | app11 / App11A | Plano basic aleatori + text + tips |
| 4 | Linea Temporal | 3-col | span-left | app9 | Timeline + BPM + text + tips |
| 5 | Linea Sonora | 3-col | span-right | app10 | Soundline vertical + text + tips |
| 6 | El Plano Musical | 3-col | span-left | app11 / App11A | Plano amb click + aleatori + text + tips |

Nota: Pasos 1-2 NO tenen app, nomes imatge + text.
Nota: Paso 3 i 6 usen el Plano (app11/App11A) amb configuracions diferents.

### Seccio 2: Descubriendo

| Paso | Titol | Template | Layout | App | Contingut visual |
|------|-------|----------|--------|-----|------------------|
| 7 | Descubriendo la Musica | 3-col | span-left | App12 | Plano + editor N-P + text + tips |
| 8 | Midiendo el movimiento: Los Intervalos | 3-col | span-left | app13 | Intervals intro + text + tips |
| 9 | Intervalo Sonoro | 3-col | span-left | App14 | Interval sonor + text + tips |

### Seccio 3: Intervalos

| Paso | Titol | Template | Layout | App | Contingut visual |
|------|-------|----------|--------|-----|------------------|
| 10 | Intervalos en el Plano Musical | 3-col | span-left | App15 | Plano + iS + iT + text + tips |

### Seccio 4: Ampliando

| Paso | Titol | Template | Layout | App | Contingut visual |
|------|-------|----------|--------|-----|------------------|
| 11 | Ampliando el Mapa: Patrones, Ciclos y Modulos | 2-col | — | — | Imatge/diagrama + text introduccio |
| 12 | El compas: el modulo temporal | 3-col | span-left | App16 | Modul temporal lineal + text + tips |
| 13 | Linea temporal en circulo | 3-col | span-left | App17 | Modul temporal circular + text + tips |
| 14 | El registro de octava | 3-col | span-left | App18 | Registre sonor + text + tips |
| 15 | Plano Modular | 3-col | span-left | App19 | Plano modular 2D + text + tips |
| 16 | Plano y Sucesion N-iT | 3-col | span-left | App20 | Plano + sucesio N-iT + text + tips |

Nota: Paso 11 es introductori, sense app (com pasos 1-2).

### Seccio 5: Fraccionando

| Paso | Titol | Template | Layout | App | Contingut visual |
|------|-------|----------|--------|-----|------------------|
| 17 | Fraccionando la Linea Temporal: Fracciones | 3-col | span-left | App26 | Fraccions simples + text + tips |
| 18 | Sucesion de Pulsos Fraccionados | 3-col | span-left | App28 | Sucesio polsos fraccionats + text + tips |
| 19 | Sucesion de iT Fraccionados Simples | 3-col | span-left | App30 | Sucesio iT fraccionats + text + tips |
| 20 | Sucesion en Plano de Fracciones Simples | 3-col | span-left | App32 | Plano amb fraccio simple + text + tips |
| 21 | Fracciones Complejas | 3-col | span-left | App34 + App35 | App34 principal + App35 com a extra |

Nota: Apps 27, 29, 31, 33 (versions complexes) NO s'embedeixen al Sistema.
Nota: App35 es un extra relacionat amb App34, accessible des de paso 21.

### Seccio 6: Escalas

| Paso | Titol | Template | Layout | App | Contingut visual |
|------|-------|----------|--------|-----|------------------|
| 22 | Escalas: Escogiendo Notas | 3-col | span-left | App21 | Escala + seleccio + text + tips |
| 23 | Estructura Escalar | 3-col | span-left | App22 | Estructura escalar + text + tips |
| 24 | Transposicion | 3-col | span-left | App23 | Transposicio + text + tips |
| 25 | Probando diferentes Escalas | 3-col | span-left | App24 | Selector 10 escales + text + tips |
| 26 | Melodias con Escalas | 3-col | span-left | App25 + App25B | App25 principal + App25B (iS) com a variant |
| 27 | Intervalos con Escalas | 3-col | span-left | App25B | Melodies amb intervals sonors + text + tips |

### Resum de templates

| Template | Pasos | Total |
|----------|-------|-------|
| 2-col (50/50) | 1, 2, 11 | 3 |
| 3-col span-left | 3, 4, 6, 7, 8, 9, 10, 12-27 | 23 |
| 3-col span-right | 5 | 1 |

### Apps embedides (21 apps)

app9, app10, app11/App11A, App12, app13, App14, App15, App16, App17, App18, App19, App20, App21, App22, App23, App24, App25, App25B, App26, App28, App30, App32, App34, App35

---

## 4. Templates CSS

Dos templates independents basats en CSS Grid. La graella de columnes es l'esquelet rigid — els containers s'enganxen a les columnes i mai sobrepassin les mides horitzontals.

### Template A: 2 columnes (50/50)

```css
.template-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
}
```

```
+-------------------------+-------------------------+
|        col 1            |        col 2            |
|        50%              |        50%              |
+-------------------------+-------------------------+
```

### Template B: 3 columnes (33/33/33)

```css
.template-3col {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
}
```

```
+-----------------+-----------------+-----------------+
|     col 1       |     col 2       |     col 3       |
|     33%         |     33%         |     33%         |
+-----------------+-----------------+-----------------+
```

**Layout "span-left"**: columnes 1+2 unides | columna 3
```
+-----------------------------------+-----------------+
|     col 1+2  (span 2)            |     col 3       |
+-----------------------------------+-----------------+
```

**Layout "span-right"**: columna 1 | columnes 2+3 unides
```
+-----------------+-----------------------------------+
|     col 1       |     col 2+3  (span 2)            |
+-----------------+-----------------------------------+
```

### Control total via CSS custom properties

Cada slide declara variables CSS que els templates consumeixen. El template es generic, la personalitzacio es per dades.

```css
.slide {
  --slide-bg: var(--nuzic-white);
  --slide-text: var(--nuzic-dark);
  --slide-text-secondary: var(--nuzic-grey);
  --tips-bg: rgba(124, 214, 179, 0.15);    /* fix, no canvia amb tema */
  --tips-border: #7cd6b3;                   /* fix */
  --tips-text: #43433b;                     /* fix */
  --iframe-aspect: 4 / 3;
  --content-padding: 2rem;
  --content-gap: 1.5rem;
}
```

### Mode fosc

El text teoric hereta del tema Nuzic (canvia automatic). La caixa de tips mante colors fixos.

```css
/* Hereten del tema — canvien amb dark mode */
--slide-bg: var(--nuzic-white);       /* blanc → #1e1e1e */
--slide-text: var(--nuzic-dark);       /* fosc → #eee8d8 */

/* Fixos — NO canvien amb dark mode */
--tips-bg: rgba(124, 214, 179, 0.15);
--tips-border: #7cd6b3;
--tips-text: #43433b;
```

Mecanisme: `data-theme="dark"` al `<body>`, coherent amb el sistema existent a `libs/shared-ui/nuzic-theme.css`.

---

## 5. Navegacio inferior (2 nivells)

Referencia exacta del PDF:

```
+------------------------------------------------------+
| ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ |  <- barra superior: progres dins la seccio
+------------------------------------------------------+
| [<]          titol del slide / seccio            [>]  |  <- barra inferior: titol + botons
+------------------------------------------------------+
```

### Comportament

- **Barra superior**: progres dins la seccio actual. Cada segment = un slide de la seccio.
- **Barra inferior**: titol central (seccio o slide). Es mante entre slides del mateix grup.
- **Botons [<] [>]**: naveguen sequencialment pels 27 slides.
- Quan es canvia de seccio, el titol s'actualitza i la barra es reinicia.

---

## 6. Responsive vertical (mobil)

En pantalles estretes (< 768px), una sola columna. Ordre:

```
+---------------------------+
|   1. Text teoric          |
+---------------------------+
|   2. Caixa tips/practica  |
+---------------------------+
|   3. App (iframe)         |
+---------------------------+
|   [navegacio inferior]    |
+---------------------------+
```

```css
@media (max-width: 768px) {
  .template-2col,
  .template-3col {
    grid-template-columns: 1fr;
  }
  .slot-text  { order: 1; }
  .slot-tips  { order: 2; }
  .slot-app   { order: 3; }
}
```

---

## 7. Apps i iframes

### Mode embed

Les apps detecten `?embed=true` per activar mode iframe:

```javascript
const isEmbed = new URLSearchParams(location.search).has('embed');
if (isEmbed) document.body.classList.add('embed-mode');
```

```css
.embed-mode .app-header,
.embed-mode .app-footer { display: none; }
.embed-mode .app-main { height: 100vh; }
```

### Adaptacions grafiques

Document separat: `docs/APPS-ADAPTACIONS-IFRAME.md`

---

## 8. Arquitectura tecnica

### Branques

| Branca | Proposit |
|--------|----------|
| `main` | Sistema Interactivo + apps (GitHub Pages) |
| `PreSistemaInteractivo` | Snapshot pre-reestructuracio (backup) |
| `Tests` | Testing |

### Estructura de directoris

```
Lab/
├── index.html                    <- entrada Sistema Interactivo
├── sistema/
│   ├── css/
│   │   ├── grid.css              <- templates 2-col i 3-col + responsive
│   │   ├── nav.css               <- navegacio inferior (2 nivells)
│   │   └── slides.css            <- estils contingut + custom properties + dark mode
│   ├── js/
│   │   ├── slides.js             <- renderitza slides, gestiona navegacio
│   │   └── slide-data.js         <- definicio dels 27 slides amb seccions
│   └── assets/
│       └── images/               <- imatges per slides sense app (1, 2, 11)
│
├── Apps/                         <- apps (modificables per mode embed)
│   ├── index.html                <- hub de desenvolupament (antic index.html)
│   ├── app9/ ... App35/
│   └── ...
├── libs/                         <- llibreries compartides
├── tests/                        <- tests
└── docs/                         <- documentacio
```

### Filosofia

- **Zero build step**: ES2022 modules al navegador.
- **WYSIWYG del PDF**: web visualment identica al PDF.
- **Apps via iframe**: aillament total, mode embed per app.
- **CSS custom properties**: control total sense hacks per-slide.
- **Dark mode**: text teoric canvia, caixa tips fixa.
- **Mobile-first responsive**: una columna, ordre text > tips > app.
- **Rutes relatives**: compatible amb GitHub Pages.

---

## 9. Hosting i deploy

```
Lab repo (main) --> GitHub Pages --> playnuzic.github.io/Lab/
                                          |
WordPress (nuzic.org/sistema-interactivo) |
         <iframe src="playnuzic.github.io/Lab/">
```

---

## 10. Definicio de slides (slide-data.js)

```javascript
export const sections = [
  { id: 'introduccion', title: 'Introduccion', slides: [1, 2, 3, 4, 5, 6] },
  { id: 'descubriendo', title: 'Descubriendo', slides: [7, 8, 9] },
  { id: 'intervalos', title: 'Intervalos', slides: [10] },
  { id: 'ampliando', title: 'Ampliando', slides: [11, 12, 13, 14, 15, 16] },
  { id: 'fraccionando', title: 'Fraccionando', slides: [17, 18, 19, 20, 21] },
  { id: 'escalas', title: 'Escalas', slides: [22, 23, 24, 25, 26, 27] },
];

export const slides = [
  {
    paso: 1,
    id: 'intro',
    section: 'introduccion',
    title: 'Te gustaria saber que movimientos se producen en la musica?',
    template: '2-col',
    content: {
      col1: { type: 'image', src: 'sistema/assets/images/street.jpg' },
      col2: { type: 'text', html: '...' }
    }
  },
  {
    paso: 4,
    id: 'linea-temporal',
    section: 'introduccion',
    title: 'Linea Temporal',
    template: '3-col',
    layout: 'span-left',
    vars: {},
    content: {
      main: { type: 'iframe', src: 'Apps/App9/index.html?embed=true' },
      side: { type: 'text', html: '...' },
      tips: { type: 'tips', html: '...' }
    }
  },
  // ... 27 slides total
];
```

---

## 11. Neteja i preparacio completada (2026-04-08)

- Eliminats 12 HTMLs prototips, 3 scripts obsolets, dirs buits
- Moguts docs a `docs/`
- Mogut `index.html` hub a `Apps/index.html`
- Commits: `966d8d9`, pendent commit del mv index.html

---

## 12. Seguents passos

1. Crear `sistema/css/grid.css` — templates 2-col i 3-col + responsive
2. Crear `sistema/css/nav.css` — navegacio inferior 2 nivells
3. Crear `sistema/css/slides.css` — estils + custom properties + dark mode
4. Crear `sistema/js/slide-data.js` — 27 slides amb seccions i apps
5. Crear `sistema/js/slides.js` — renderitzat + navegacio
6. Crear `index.html` — punt d'entrada
7. Implementar `?embed=true` a les 21 apps embedides
8. Adaptacions grafiques apps (veure APPS-ADAPTACIONS-IFRAME.md)
9. Testejar localment
10. Testejar responsive mobil
11. Activar GitHub Pages
12. Embedir a WordPress via iframe
