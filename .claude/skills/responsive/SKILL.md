---
name: responsive
description: Apply mobile-first responsive design patterns to PlayNuzic Lab apps
---

# Responsive Design Skill

You are optimizing a PlayNuzic Lab app for responsive design **following the
conventions this codebase actually uses** (LU-08: the previous version of this
skill prescribed min-width breakpoints and an `.app-container` grid that no
shared or app CSS uses — following it created inconsistency).

## Conventions reals del repo (fes servir AQUESTES)

### 1. Fluid primer: `clamp()` en lloc de breakpoints
La mida base de gairebé tot és fluida. Les apps noves (App30+) tenen ZERO
media queries pròpies i es dimensionen només amb `clamp()`:
```css
font-size: clamp(24px, 2.4vw + 0.7rem, 48px);
width: clamp(42px, 7vw, 64px);
```

### 2. Breakpoints canònics: desktop-first amb `max-width`
Només DOS llindars a tot el repo — no n'inventis de nous:
```css
/* Ajustos d'app i de libs compartides */
@media (max-width: 600px) { }

/* Sistema, embed i layouts amplis (també l'únic de nuzic-theme.css) */
@media (max-width: 900px) { }
```
Mai `min-width` (cap full del repo en té; barrejar paradigmes complica les
cascades amb libs/shared-ui/index.css i nuzic-theme.css, que són desktop-first).

### 3. Tàctil: `@media (pointer: coarse)` per a àrees de toc
El patró establert (U-13/U-14) amplia àrees de hit amb pseudo-elements
transparents — el visual NO es mou:
```css
@media (pointer: coarse) {
  .param .circle .spinner .spin { position: relative; }
  .param .circle .spinner .spin::after {
    content: '';
    position: absolute;
    inset: -5px -12px; /* àrea ~44px sense canviar el layout */
  }
  /* iOS només fa zoom si l'input enfocat té <16px: bump NOMÉS en :focus */
  .param .circle input:focus { font-size: 1rem; }
}
```
Compte: comprova primer si el pseudo-element ja porta contingut (els half-pills
del fraction-editor usen `::after` per als glifs +/− → allà s'usa `::before`).

### 4. Variables CSS compartides (no hardcodejar)
`--layout-gap`, `--select-color`, `--text-color`, i al tema nuzic els tokens `--nuzic-*`
(nuzic-theme.css). `--col-left`/`--col-right` són del layout de dues/tres columnes
(`two-column-layout.css`), que la migració nuzic elimina (skill `nuzic-migrate`, Step 3):
no les facis servir en apps noves.

### 5. Gestos tàctils
- Pointer Events (no touch events): `pointerdown/move/up/cancel` amb guards de
  `pointerId`; listeners de document NOMÉS durant el drag.
- `touch-action: none` via estil inline al bind o regla específica — només on
  el gest competeix amb l'scroll (nanses de drag, parallax del sistema).
- `pointercancel` = no commit (descarta el gest, no l'apliquis a mitges).

### 6. Embed i alçades de viewport
- Apps embedides al sistema: vegeu `libs/app-common/embed.css` i les regles
  d'iframe de `sistema/css/slides.css` (floor de 320px en vertical).
- Alçades de pantalla completa: `100vh` com a fallback i `100dvh` a la línia
  següent (barra d'URL d'iOS).

## Checklist
1. Prova a 320px, 375px, 600px, 900px i desktop ample.
2. Cap scroll horitzontal a cap mida.
3. Objectius tàctils ≥ ~44px efectius (pseudo-element si cal; el visual no creix).
4. Cap zoom d'iOS en enfocar inputs (16px en `:focus` sota `pointer: coarse`).
5. La timeline es veu bé en mode lineal i circular.
6. El mixer s'obre i es pot arrossegar en mòbil.
7. `npm test` — cap regressió.
