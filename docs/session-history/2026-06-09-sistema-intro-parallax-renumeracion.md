# Sistema — Passos intro parallax + renumeració (v4)

**Data:** 2026-06-09
**Fitxers:** `sistema/js/slide-data.js`, `sistema/js/slides.js`, `sistema/css/parallax.css` (nou), `sistema/index.html`

## Què s'ha fet

1. **Paso 1 dins "Descubriendo la Música"** — la secció "Introducción" desapareix;
   el paso 1 (vídeo, layout A-intro) queda intacte com a primer pas del capítol.
2. **Passos intro de capítol nous** amb format parallax:
   - Paso 7 — *Los Intervalos* (intro d'"intervalos")
   - Paso 11 — *Ampliando el Mapa* (conversió de l'antic paso 10; text re-redactat
     en 5 frases, conserva `paso-11.jpg` com a capa de fons)
   - Paso 17 — *Fraccionando el tiempo*
   - Paso 22 — *Las Escalas*
3. **Renumeració**: 1-6 igual, antics 7-15 → +1, 16-19.5 → +2, 20-25 → +3.
   Total: 28 passos visibles + ocults 18.5/19.5/20.5/21.5 (Fracciones Complejas).
4. **Migració v4** (`OVERRIDES_VERSION = 4`) per a overrides i densityByPaso de
   localStorage. Els overrides de l'antic paso 10 es descarten (pas redissenyat).
5. **Format parallax** (`layout: 'P-parallax'`) — v2 seqüencial per scroll
   (la v1 per hover es va descartar el mateix dia a petició de l'usuari):
   - `render()` fa branch: slide full-bleed sense grid, `data-section` tria la
     paleta d'accent (blau/groc/vermell/verd per capítol).
   - Frases: una per `<p>` al camp `text` estàndard → mode edició, sanitizer i
     overrides funcionen sense codi nou. **Una frase activa en gran al primer
     pla** (tota l'amplada); la resta apilades darrere, atenuades i amb blur.
   - **Scroll-driven**: roda (1 pas per gest, cooldown 450ms + acumulador),
     swipe vertical, fletxes ↑/↓ (via `parallaxCtrl` module-level) i punts de
     progrés clicables. Hint animat "Haz scroll" que s'amaga al primer gest.
   - Capes de fons: símbols del capítol (`slideMatrix[].parallax.symbols`) +
     imatge opcional, amb moviment EXAGERAT lligat al progrés de frases
     (translate ±vw/vh + rotate + scale segons `data-depth`).
   - Mode edició: carrusel desactivat (guard `state.editable` + CSS
     `!important`), frases en flux estàtic. Respecta `prefers-reduced-motion`.
   - Textos re-redactats en to emocional/invitador (2a persona, preguntes).
6. **Fix de pas**: `NO_EXPAND_PASOS` (números de pas, desfasat des de la
   renumeració v3) → `NO_EXPAND_APPS` (noms d'app, immune a renumeracions).
   Efecte col·lateral intencionat: App14/App18/App34/App35/App25 tornen a NO
   expandir-se en mode vertical (intenció documentada), i App26/App23 tornen a
   expandir-se (l'exclusió era accidental per el desfasament).

7. **Fix de regles CSS d'iframe desfasades** (descobert en revisar la
   renumeració): `slides.css` tenia regles `data-paso` amb numeració PRE-v3
   (max-height per a App15/App21-23/App34-35, aspect 3/2 d'App23, i la cadena
   `:not()` del mode vertical). Després de la v4, App21 rebia l'aspect 3/2
   d'App23 (soundlines aixafades) i App35 queia al cap genèric de 700px
   (contingut retallat). Solució estructural: el renderer posa `data-app`
   (nom d'app) i la classe `slide--no-expand` (derivada de `NO_EXPAND_APPS`)
   al `.slide`, i totes les regles CSS es seleccionen per `data-app` /
   `.slide--no-expand`. **Mai més regles per número de pas.**
8. **Deep-link `?paso=N`** — `sistema/index.html?paso=23` salta directament a
   un pas; si apunta a un pas ocult (x.5) desbloqueja el capítol per a la
   sessió. Útil per a revisió i per compartir passos.
9. **Clic sobre frase atenuada** als intros parallax: l'activa directament
   (a més de l'scroll/swipe/fletxes/punts).

## Notes

- El `paso` desat a localStorage (`sistema.paso`) NO es migra (mateix criteri
  que v2/v3): un usuari que era al pas N veurà el contingut del nou pas N.
- Tests: 73 suites / 1456 ok (el sistema/ no té suite pròpia; cap regressió).
