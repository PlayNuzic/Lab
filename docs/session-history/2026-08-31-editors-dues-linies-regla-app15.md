# 2026-08-31 — Editors de dues línies: regla de mida unificada (App15)

## Problema
L'editor N-P d'App12 es veia més petit que l'iS-iT d'App15. Diagnòstic
mesurat al navegador: mateixa font a la cel·la (`clamp(1rem, 1.6vw, 1.5rem)`)
però caixa dimensionada diferent:
- **família `em`** (cel·la = 1.8 × font, clampada a 29-43px): App12, i els
  nit-editors d'App34/App35 (1.8em) i App20 (2.7em × 1.8em per "NrR").
- **família `%` del contenidor**: App15 (4%) i App14 (6.25%).

A 1200px: App12 34.5px vs App15 44.8px (+30%); a l'iframe del sistema
(950px) 28.8 vs 34.8 (+21%). App34/35 conservaven fins i tot un comentari
antic del `width: 5%` — havien tingut la regla en % i es van "unificar" a
`em` creient que App15 també ho era.

## Canvi (només CSS, una regla per app)
Regla d'App15 a totes les apps-plànol amb editor de dues línies:
`width: calc(4%); min-width: 1.25rem; aspect-ratio: 1;` sense alçada fixa
ni `flex: 0 0 auto` (quadrada per aspect-ratio + stretch de la fila; amb
moltes cel·les s'encongeixen fins al min-width en lloc de desbordar).
- `Apps/App12/styles.css` `.editor-cell`
- `Apps/App34/styles.css`, `Apps/App35/styles.css` `.nit-editor-cell`
- `Apps/App20/styles.css` `.nit-editor-cell`: mateixa ALÇADA (4%) però
  rectangular 3:2 — `width: 6%; min-width: 1.875rem; aspect-ratio: 3/2` —
  perquè la notació de registre "11r6" (4 caràcters) hi càpiga.

Segur per als nit-editors: cap s'alinea amb les columnes del plano (cap
amplada des del JS, cap sync d'scroll); són files flex independents.

## Verificació (Puppeteer, 1200×800 i 950×713 embed)
| App | 1200 | embed 950 |
|---|---|---|
| App12 | 44.8² | 34.8² |
| App15 | 44.8² | 34.8² |
| App20 | 69×46 ("11r6" cap) | 54×36 |
| App34/35 | 45.4² (label 50px, no 60) | 35.4² |
Zero errors de pàgina. Suite 90/1497.

## No tocat
App14 (6.25%, ja família %), App25/25B (no són apps-plànol; el comentari
antic d'App34 els citava com a família `em`). SESSION_STATE.md no s'ha
tocat: hi ha una tasca activa d'una altra sessió (textos del Sistema).
