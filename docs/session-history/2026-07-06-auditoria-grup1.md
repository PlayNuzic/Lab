# 2026-07-06 — Auditoria post-Parallax Lab: detecció + Grup 1 (37 segures) aplicat

Segona auditoria del repo (la primera va ser 2026-06-10/11, 144/144 tancades). Aquest cop
delta de 133 commits + zones noves des del juny (Parallax Lab, App32-35, redisseny d'anells
d'App4, graphify). Informe: `docs/audit-report-2026-07-06.md`.

## Workflow d'auditoria (fases 1-4)

18 auditors Sonnet (delta + zones noves) → verificació adversària en tandes (Fable, i per
exhauriment de la cua, Opus 4.8 effort màxim al tram final) → síntesi. **64 brutes → 60
confirmades + 4 refutades → 59 distintes** (37 segura · 11 alt risc · 11 decisió-documentar).

Sessió travessada per talls repetits (límit de sessió, connexió, canvi Fable→Opus). Cap
troballa perduda: tot es va reconstruir des dels journals dels workflows (persisteixen encara
que el scratchpad es netegi entre sessions). Scripts de recuperació documentats al codi de
`audit-2026-07/` (esborrats del scratchpad en tancar la tasca; el mètode queda aquí per si cal
repetir-lo: `JSON.parse` + lambda a `re.sub` per injectar dades amb backticks a un script de
Workflow — mai plantilla de string directa, esquartera el fitxer pels `\n` del JSON).

**Re-avaluació dels fitxers d'alt risc** (Nivell 1, decidida amb l'usuari abans de l'auditoria):
als 3 del CLAUDE.md (`timeline-processor.js`, `subdivision.js`, `audio-schedule.js`) s'hi afegeix
**`libs/sound/index.js`** (20 importadors, +391 línies des del juny, on van esclatar les
regressions del juny — no als 3 fitxers blindats). Nivell 2 (sensibles, revisió de diff +
suite completa): cadena init/gate (`audio-init.js`, `user-interaction.js`, `tone-loader.js`) +
timing viu + massius per fan-in (`template.js`, `preferences.js`, `mixer-menu.js`).

## Workflow 2 — Grup 1 (37 AUTO-FIX SEGURA) aplicat i commitejat

Planner Fable → 10 lots de fitxers disjunts → pipeline Sonnet repara / Fable revisa
adversàriament el diff (màx 2 rondes). **Els 10 lots van sortir bé a la 1a ronda.** Suite: 78/1397
→ **84/1431** (5 fitxers de test nous). 10 commits (un per lot, `39c02a74`..`8a4ee954`):

- `39c02a74` Parallax Lab: A-02 (mask-zoom deixava una app amagada per error), P-05 (mouse-tilt/
  spotlight actius en edició), U-03 (CSS mort de reduced-motion), H-12 (regla CSS duplicada),
  H-13 (shuffle esbiaixat→Fisher-Yates), D-09 + tests T-02/T-06 nous.
- `4ad753dd` circular-timeline: P-02 (números pintats dos cops en circular, flag `skipNumbers`)
  + T-05 (tests del memo).
- `0f049e04` higiene app-common: H-03 (botó fantasma), H-07 (controlsLayout mort), H-09
  (listener duplicat App4), H-10 (parseRowId duplicada), H-16 (localStorage sense try/catch).
- `c68c9c72` tone-loader: U-01 (listener no-passive), H-17 (filtre isTrusted), H-06 (comentari).
- `50271a61` App34: P-01 (cache d'highlight, patró portat d'App35), H-02 (spacer inert).
- `9dcb401d` App5/temporal-intervals: H-05 (dependència inversa lib→App trencada) + T-07.
- `3ed5eb93` motor: A-01 (doble Play), A-07 (tolerància 300ms d'App5 restaurada).
- `6212dc15` docs arrel: D-01 (Nivell 1 ampliat a CLAUDE.md), D-02/D-06 (comptadors), D-05,
  D-07, D-08 (JSDoc).
- `230fe226` docs apps: D-03/D-04/D-11/D-12/D-13/D-14 (rutes i noms de test obsolets).
- `8a4ee954` App18: U-02 (guard `isPlaying` a `handleRandom`).

Un matís no bloquejant (lot circular-timeline): l'agent va aprofitar per netejar també la
secció "Dependencies" d'`Apps/App1/CLAUDE.md` (correcte, però fora de l'abast estricte del fix).

## Pendent (properes sessions)

- **Grup 2 — decisió-documentar (11 troballes)**: A-03, A-06, P-04, P-06, H-04, H-08, H-11,
  H-14, T-03, T-04, D-10. Cadascuna necessita una tria explícita de l'usuari abans de tocar-la
  (vegeu secció 3 de `docs/audit-report-2026-07-06.md`).
- **Grup 3 — alt risc (11 troballes)**: A-04, A-05, A-08, A-09, A-10, A-11, A-12, P-03, H-01,
  H-15, T-01. Toquen Nivell 1 (`libs/sound/index.js`, `timeline-processor.js`) — protocol de
  diff complet + aprovació humana, un per un, mai en lot.
