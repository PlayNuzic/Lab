# 2026-09-02 — Analítica per al test d'usuari (Clarity) + kit de documents

Continuació de [2026-09-01](2026-09-01-sistema-guia-navegacio-i-docs.md).

## 1. Codi

Nota: el bloc `app:*` d'`embed-mode.js` va entrar al commit `e14f18f3` (sessió paral·lela, que
tocava el mateix fitxer per l'alçada de l'iframe); la resta va al commit d'aquesta acta.

- `sistema/js/analytics.js` (reescrit, mateix contracte): a més de `paso_N` +
  etiquetes `paso`/`section`, emet `capitulo_completado_<section>` (només en
  avançar a un capítol posterior), `coda_alcanzada`, `paso_N_largo` (90 s al
  mateix pas; temporitzador cancel·lat en canviar), `primer_scroll` + etiqueta
  `t_primer_scroll` per trams (scroll capturat sobre `.parallax-driver`),
  `guia_abierta` / `indice_abierto` (clic amb `aria-expanded="true"` a
  `#btn-guia` / `#nav-title`), `aviso_girar` (hi ha `.rotate-prompt` al render)
  i `giro_hecho` (matchMedia 900px passa a fals), `app_play|random|reset|edit_AppNN`
  (postMessage de les apps; `edit` un cop per app; origen comprovat), etiqueta
  `entrada` (`directa` | `enlace_paso` | `referrer:<host>`, URL inicial via
  PerformanceNavigationTiming perquè slides.js ja ha reescrit `?paso=`), i
  identificació de participants: `?tester=ID` (`[A-Za-z0-9_-]{1,32}`) es desa a
  `localStorage['sistema.tester']`, es torna a reflectir a l'URL a cada visita
  (replaceState; slides.js conserva els altres paràmetres) i crida
  `clarity('identify', id)` + `upgrade` + etiquetes `modo=test`/`tester`;
  sense ID, `modo=real`. Tot defensiu (sense Clarity no s'envia res).
- `libs/app-common/embed-mode.js`: en mode embed, escolta en captura els clics a
  `#playBtn`/`#randomBtn`/`#resetBtn` (template compartit) i el primer `input`
  (excepte ids amb «bpm») i envia `{type:'app:play'|'app:random'|'app:reset'|'app:edit', app}`
  al parent pel mateix canal que `app:resize`. Les apps no saben res de Clarity.
- Tests: `sistema/js/__tests__/analytics.test.js` (reescrit, 26 casos) i
  `libs/app-common/__tests__/embed-mode.test.js` (nou, 3 casos; avalua l'script
  clàssic dins jsdom amb URL `Apps/App12/index.html?embed=true`).
  Suite: **92 suites / 1534 tests**.

## 2. Panell de Clarity (projecte `xltk7vdfux`)

- Segments: **Test de usuario** (Dirección URL contiene `tester=`) i
  **Visitantes reales** (Dirección URL excluye `tester=`); sense filtre de dates.
- Embuts: **Capitulos** (paso_1 → 2 → 7 → 11 → 17 → 22 → 29) i
  **Posiciones e Intervalos** (paso_2 → … → paso_9; Clarity admet 8 passos
  per embut, el 10 queda cobert pel paso_11 de l'altre).
- Els esdeveniments `app_*`, `primer_scroll`, etc. i les etiquetes noves només
  apareixeran al panell quan la versió es publiqui a GitHub Pages i alguna
  sessió amb consentiment els enviï. El segment per URL funciona des del primer dia.

## 3. Kit de documents (fora del repo)

`~/Downloads/Test de usuario Nuzic/`: 01 pla v2 · 02 tarjetes i test en paper ·
03 guió del moderador · 04 guió i full de l'observador · 05 registre (xlsx) ·
06 qüestionaris · 07 consentiment. Generats amb docx-js/exceljs des de l'scratchpad
de la sessió (no versionats).

## Pendent

- Push perquè l'analítica nova arribi a `playnuzic.github.io` abans del pilot.
- Paso 13 (text). `requiresLandscape` a 15-16: retirat el 2026-09-01 (`f7f9a3d2`, aspecte 2/3 en
  mòbil); `aviso_girar`/`giro_hecho` queden com a instrumentació dorment.
