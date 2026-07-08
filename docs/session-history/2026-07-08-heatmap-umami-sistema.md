# Heatmap de navegació — Umami Cloud a `sistema/`

**Data**: 2026-07-08
**Estat**: COMPLET

## Objectiu
Instrumentar `sistema/` (presentació estàtica del mètode Nuzic) amb tracking de
navegació anònim cap a Umami Cloud (capa gratuïta), per obtenir mapa de calor
per pas: visites, dwell time, embut d'abandonament, visitants únics, geo.

## Fitxers nous/editats
- `sistema/js/analytics.js` (nou) — mòdul agnòstic del destí. ID de visitant
  anònim (cookie `SameSite=Lax` + fallback `localStorage`), escolta
  `sistema:render` (slides.js:884, sense tocar `render()`), calcula
  `dwell_ms` del pas abandonat, deriva `section`/`title`/`is_lab` de
  `slideMatrix`, i emet `paso_visto` via `window.umami.track`. Acoblament
  amb el servei aïllat a la funció `send()`. Sortida de pàgina coberta amb
  `visibilitychange`(hidden) + `pagehide` (idempotent via flag `pending`).
- `sistema/js/__tests__/analytics.test.js` (nou) — 13 tests: ID de
  visitant, derivació de slide info, lectura de pas, tracker (dwell_ms,
  no-emissió al primer render, no-duplicació, defensiu sense `window.umami`).
- `sistema/index.html` — snippet d'Umami Cloud al `<head>`
  (`data-website-id="865a6b34-f51a-45dd-adf2-e96688ef0d47"`, domini de
  producció `playnuzic.github.io`), `<script type="module" src="js/analytics.js">`
  al final del `<body>`, avís de privacitat discret.
- `sistema/css/nav.css` — regla `.sistema-privacy-note` (fixed, top-left,
  `pointer-events:none`, no interfereix amb la nav que és `bottom:0`).

## Decisions preses
- Sense `navigator.sendBeacon` manual: el script d'Umami ja usa `fetch(...,
  {keepalive:true})` internament com a equivalent fiable en descàrrega;
  apuntar a mà al seu endpoint intern no documentat (`/api/send`) era més
  fràgil. Validat amb l'usuari abans d'implementar.
- `crypto.randomUUID` no existeix a l'entorn jsdom d'aquest repo (verificat
  amb test temporal abans d'escriure el codi) → fallback UUID v4 manual per
  mantenir el mòdul testejable sense mocks especials.

## Verificació feta
- `npm test`: 79 suites / 1410 tests, tots passen (13 nous d'analytics).
- `npx http-server` + `curl`: confirmat que `index.html` serveix el script
  d'Umami, el mòdul `analytics.js` i l'avís; `analytics.js` es serveix 200
  i té sintaxi vàlida.
- **Pendent de verificació manual per l'usuari** (no hi ha eina de navegador
  en aquesta sessió): confirmar a Network/Console del navegador que
  `paso_visto` es dispara en navegar entre pasos amb `dwell_ms` plausible,
  i confirmar recepció a Umami Cloud Realtime — això últim només compta un
  cop desplegat a `playnuzic.github.io` (no a `localhost`).

## Per fer (si cal en el futur)
- Res pendent de codi. Si es vol una segona capa d'esdeveniments (p.ex.
  ús del constructor de parallax) és una extensió separada, no inclosa aquí.
