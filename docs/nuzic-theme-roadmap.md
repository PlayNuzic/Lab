# Nuzic Theme Roadmap

Adaptació visual de les Apps 9+ a l'estètica de nuzic_app.

## Estat actual

- [x] **Fase 1**: Tokens de color base (light + dark) → `libs/shared-ui/nuzic-theme.css`
- [x] **Fase 4**: Graella — dots negres visibles + rectangles blau sòlid (light + dark)
- [ ] Fase 2: Soundline
- [ ] Fase 3: Timeline
- [ ] Fase 5: Botons
- [ ] Fase 6: BPM inline
- [ ] Fase 7: Triangle decoratiu
- [ ] Fase 8: Opt-in per app (27 apps)
- [ ] Fase 9: Plano-modular
- [ ] Fase 10: Dark mode complet

## Com activar el tema

Per cada app (9+), afegir al `index.html`:

```html
<!-- Al <head>, després dels altres CSS -->
<link rel="stylesheet" href="../../libs/shared-ui/nuzic-theme.css" />

<!-- Al <body> -->
<body data-theme="system" data-visual="nuzic">
```

## Referència visual

Captura de referència: l'adjunt original de la conversa (screenshot de nuzic_app PMC).
Codi font de referència: `/Users/workingburcet/nuzic_app/App/NuzicCSS.css`

## Fases detallades

### Fase 2: Soundline (CSS + JS)

**Fitxers**: `nuzic-theme.css` + `libs/app-common/soundline.js`

CSS (musical-grid):
```css
body[data-visual="nuzic"] .soundline-wrapper { background: var(--nuzic-pink-light); }
body[data-visual="nuzic"] .soundline::before { display: none; }  /* línia vertical */
body[data-visual="nuzic"] .soundline-division { display: none; }  /* ticks horitzontals */
body[data-visual="nuzic"] .soundline-number {
  left: 0; width: 100%; text-align: center;
  font-weight: 700; font-size: 14px;
}
```

JS: Afegir opció `decorateLabels` a `createSoundline()` (línia 85 de soundline.js):
```javascript
label.innerHTML = options.decorateLabels
  ? `- ${formatLabel(labelFormatter, i, midi)} -`
  : formatLabel(labelFormatter, i, midi);
```

### Fase 3: Timeline (CSS + JS)

**Fitxers**: `nuzic-theme.css` + `libs/musical-grid/musical-grid.js`

CSS:
```css
body[data-visual="nuzic"] .timeline-wrapper { background: var(--nuzic-yellow-light); }
body[data-visual="nuzic"] .timeline-line { display: none; }
body[data-visual="nuzic"] .pulse-marker {
  font-weight: 700; font-size: 14px;
}
```

JS: Afegir pipes `|` i doble barra `||` (condicional a `document.body.dataset?.visual === 'nuzic'`).

### Fase 4: Graella — dots i rectangles (CSS only)

**Fitxer**: `nuzic-theme.css`

```css
/* Dots negres visibles */
body[data-visual="nuzic"] .np-dot::after {
  width: 4px; height: 4px;
  background: var(--nuzic-dark);
  border: none; opacity: 1;
}

/* Rectangles sòlids sense glow */
body[data-visual="nuzic"] .musical-cell.active::before {
  background: var(--nuzic-blue-light);
  box-shadow: none; opacity: 1;
}

/* Cel·les transparents */
body[data-visual="nuzic"] .musical-cell {
  background: transparent; border-color: transparent;
}
```

### Fase 5: Botons (CSS only)

**Fitxer**: `nuzic-theme.css`

```css
/* Play: cercle verd petit */
body[data-visual="nuzic"] .play {
  width: 36px; height: 36px;
  background: var(--nuzic-green); border: none; color: white;
}

/* +/- pastilla daurada */
body[data-visual="nuzic"] .spin {
  border-radius: 12px; background: var(--nuzic-yellow); color: white;
}

/* Reset: quadrat verd */
body[data-visual="nuzic"] .reset {
  border-radius: 4px; background: var(--nuzic-green-light);
}
```

### Fase 6: BPM inline horitzontal (CSS + possible JS)

**Fitxers**: `nuzic-theme.css` + possible `libs/app-common/bpm-inline-injector.js`

```css
body[data-visual="nuzic"] .bpm-inline { flex-direction: row; align-items: center; gap: 8px; }
body[data-visual="nuzic"] .bpm-inline .circle {
  width: auto; height: 32px; border-radius: 16px;
  border: 1px solid #ddd; background: white; padding: 0 16px;
}
body[data-visual="nuzic"] .bpm-inline .spinner {
  position: static; flex-direction: row;
}
```

Si CSS no pot reordenar el DOM, caldrà tocar `bpm-inline-injector.js`.

### Fase 7: Triangle decoratiu (CSS only)

```css
body[data-visual="nuzic"] .grid-container::after {
  content: ''; position: absolute; bottom: 0; left: 0;
  border-style: solid;
  border-width: 40px 0 0 40px;
  border-color: transparent transparent transparent var(--nuzic-pink-light);
}
```

### Fase 8: Opt-in per app

Apps afectades (27): App11A, App12, App14-App35, App25B.

Per cada una:
1. `index.html`: afegir `<link>` + `data-visual="nuzic"`
2. `main.js`: si crida `createSoundline()`, afegir `decorateLabels: true`

### Fase 9: Plano-modular

Selectors equivalents per al DOM de plano-modular:

| Musical-Grid | Plano-Modular |
|---|---|
| `.soundline-wrapper` | `.plano-soundline-container` |
| `.soundline-number` | `.plano-soundline-note` |
| `.soundline::before` | (no existeix, no cal ocultar) |
| `.timeline-wrapper` | `.plano-timeline-container` |
| `.pulse-marker` | `.plano-timeline-number` |
| `.musical-cell` | `.plano-cell` |
| `.musical-cell.active::before` | `.plano-cell.plano-selected::before` |
| `.np-dot::after` | (no existeixen dots a plano) |

### Fase 10: Dark mode complet

Repetir cada fase anterior amb selector `body[data-visual="nuzic"][data-theme="dark"]`.
Tokens dark ja definits a la Fase 1.
Cal afegir overrides específics per components (soundline, timeline, cells, buttons).

## Selectors de referència ràpida

```
/* Musical-Grid */
.soundline-wrapper, .soundline, .soundline::before
.soundline-division, .soundline-number
.matrix-container, .musical-cell, .musical-cell.active
.np-dot, .np-dot::after
.timeline-wrapper, .timeline-line, .pulse-marker

/* Plano-Modular */
.plano-soundline-container, .plano-soundline-note
.plano-matrix-container, .plano-matrix, .plano-cell
.plano-cell.plano-selected, .plano-cell.plano-highlight
.plano-timeline-container, .plano-timeline-number

/* Botons */
.play, .spin, .reset, .random
.bpm-inline, .bpm-inline .circle, .bpm-inline .spinner

/* Tema */
body[data-visual="nuzic"]                           → light
body[data-visual="nuzic"][data-theme="dark"]         → dark
```
