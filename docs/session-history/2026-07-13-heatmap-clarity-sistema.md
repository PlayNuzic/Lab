# Analítica + mapa de calor — Microsoft Clarity a `sistema/`

**Data**: 2026-07-13
**Estat**: COMPLET (codi); verificació al navegador i pas manual del Funnel pendents de l'usuari.

## Objectiu
Substituir la instrumentació anterior (Umami, vegeu
`2026-07-08-heatmap-umami-sistema.md`) per **Microsoft Clarity** a `sistema/`:
heatmaps visuals (clic/scroll natius), navegació per pas via esdeveniments/tags,
embut d'abandonament (Funnels), ID de visitant anònim automàtic i gravacions de
sessió — tot amb un **gate de consentiment RGPD** (Clarity no carrega res fins
que l'usuari accepta).

Per què Clarity: els iframes de les apps es construeixen amb ruta RELATIVA
(`../Apps/${appName}/index.html?embed=true`, slides.js:516) → **mateix origen**,
així que Clarity sí que pot capturar clics/heatmap dins dels iframes (a
diferència del cas cross-origin d'Umami). Limitació coneguda: Clarity NO
captura contingut de `<canvas>` → la riquesa del heatmap visual variarà per app,
però esdeveniments de pas / embuts / ID funcionen igual per a totes (es disparen
des del `sistema/`, no depenen del canvas).

## Credencials
- Clarity Project ID: `xltk7vdfux` (públic, hardcodejat — correcte).
- Compte `infonuzic@gmail.com`, URL `https://playnuzic.github.io/Lab/sistema/`,
  indústria "Careers & Education".

## Fitxers nous/editats
- `sistema/js/consent.js` (nou) — gate de consentiment RGPD. Sense decisió
  prèvia mostra un banner (Aceptar/Rechazar). El snippet oficial de Clarity és
  un **port literal dins una funció** que NOMÉS s'executa en acceptar (o en
  tornar amb `sistema.consent === 'granted'`): garanteix zero peticions a
  `clarity.ms` abans del consentiment, sense dependre del "Consent Mode" del
  dashboard (toggle manual de Clarity, no controlable per codi). En acceptar,
  crida `window.clarity('consentv2', { ad_Storage:'granted',
  analytics_Storage:'granted' })` (Consent API v2; l'antiga `('consent', bool)`
  està deprecada). Decisió persistida a `localStorage['sistema.consent']`.
- `sistema/js/analytics.js` (reescrit, abans era Umami) — escolta
  `sistema:render` (slides.js, sense tocar `render()`), deriva pas+section de
  `slideMatrix`, i a cada canvi emet `clarity('set','paso',N)` +
  `clarity('set','section',...)` + `clarity('event','paso_N')`. Els pasos
  `*.5`/`*.7` es formaten com `paso_18_5` (nom d'esdeveniment vàlid). Defensiu:
  si `window.clarity` no existeix (consentiment no concedit), no envia ni
  llança res. NO genera ID propi (Clarity ja en posa un d'anònim).
- `sistema/index.html` — retirat el `<script>` estàtic d'Umami del `<head>` i
  el `<p class="sistema-privacy-note">`; afegits `consent.js` + `analytics.js`
  com a mòduls al final del `<body>`. Cap script d'analítica estàtic al head.
- `sistema/css/nav.css` — substituït `.sistema-privacy-note` per l'estil
  `.consent-banner` (barra sòbria sobre la nav, z-index 40, tokens Nuzic).
- `sistema/js/__tests__/consent.test.js` (nou, 5 tests) — banner es mostra
  sense decisió; Acceptar injecta l'script + crida `consentv2` + persisteix;
  Rebutjar no injecta res; decisions prèvies granted/denied. Mocka
  `window.clarity`; neteja scripts del jsdom compartit entre tests.
- `sistema/js/__tests__/analytics.test.js` (reescrit per a Clarity) — derivació
  de section, format de pasos fraccionaris, no-reemissió si el pas no canvia,
  defensiu sense `window.clarity`.
- `sistema/privacidad.html` (nou) — pàgina de política de privacitat/cookies
  autocontinguda (tema Nuzic via tokens.css): responsable, què mesura Clarity
  (inclou gravacions de sessió), cookies `_clck`/`_clsk` + `sistema.consent`,
  base legal (consentiment), transferència a Microsoft (EUA), conservació
  (~13 mesos) i **botó per retirar el consentiment**. Enllaçada des del banner
  ("Más información").
- `sistema/js/consent.js` (afegit) — `resetConsent()` (esborra la decisió +
  `clarity('consent', false)` + expira `_clck`/`_clsk`); text del banner amb
  "grabaciones de sesión" i enllaç a `privacidad.html`; auto-init condicionat a
  la presència de `#slide-stage` perquè la pàgina de privacitat pugui importar
  el mòdul sense mostrar el banner.

## Decisions preses
- **Càrrega dinàmica en comptes de snippet estàtic al `<head>`**: l'única manera
  100% de codi de garantir "cap petició abans del consentiment" sense dependre
  del toggle "Consent Mode" del dashboard.
- **`dwell_ms` omès com a tag**: Clarity limita a 128 tags/pàgina; acumular
  tags numèrics per pas en sessions llargues fregaria el límit sense
  necessitat. Era opcional a l'spec i Clarity ja dona durada de sessió.

## Umami retirat
- Cap referència a Umami queda al codi actiu (verificat amb grep sobre
  `sistema/` i `libs/`). L'acta `2026-07-08-heatmap-umami-sistema.md` es manté
  com a registre històric, amb un punter a aquesta acta.
- El website d'Umami Cloud i el seu website-id segueixen existint al compte de
  l'usuari (no es toca res al núvol); si es vol, es pot esborrar manualment des
  del dashboard d'Umami. Ja no rebrà dades.

## Verificació feta
- `npm test`: **90 suites / 1474 tests**, tots passen (consent.test.js nou +
  analytics.test.js reescrit).
- `http-server` + `curl`: `index.html` sense Clarity/Umami estàtic al head,
  mòduls servits 200, sintaxi vàlida.

## Pendent de l'usuari (no codi)
1. **Verificació al navegador**: obrir `sistema/index.html`, confirmar que el
   banner apareix i que NO hi ha cap crida a `clarity.ms` a Network abans
   d'acceptar; en acceptar, confirmar càrrega de `clarity.ms/tag/xltk7vdfux` i
   que cada canvi de pas dispara l'esdeveniment/tag; en rebutjar, res s'activa.
2. **Dashboard**: Clarity pot trigar fins a 2 h a mostrar dades i filtra pel
   domini `playnuzic.github.io` → verificació real només un cop desplegat a
   GitHub Pages, no en local.
3. **Funnel (manual a Clarity)**: un cop hi hagi dades, crear un Funnel amb la
   seqüència `paso_1 → paso_7 → paso_11 → paso_17 → paso_22 → paso_28` per veure
   l'abandonament per capítol.
4. **Opcional**: a Settings → Setup del projecte Clarity, desactivar "set
   cookies by default" per reforçar el consent mode a nivell de compte (el gate
   de codi ja ho garanteix, però és bona pràctica).
