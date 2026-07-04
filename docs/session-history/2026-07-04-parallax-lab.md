# 2026-07-04 · Parallax Lab — constructor de tècniques parallax al `sistema/`

**Resultat: 15 tècniques vives, 0 descartades.** Suite 78 suites / 1397 tests verds
(línia base abans: 77/1385). Cap commit — lliurat a l'arbre de treball per revisió.

## Què és

Un laboratori ocult dins el visor de slides (`sistema/`) per provar i combinar tècniques
de parallax (referents: web de GTA VI i delassus.com) amb un panell constructor al tweaks:
checkbox + sliders per tècnica, 🎲 aleatori, restaurar i copiar config. Persistència a
localStorage `sistema.parallaxFx` (patró densityByPaso).

**Com obrir-lo:** `npx http-server` →
`http://localhost:8080/sistema/index.html?tweaks=1&paso=28.5` (Lab A, símbols)
o `paso=28.7` (Lab B, imatge + App11 dins iframe). El paràmetre `?paso=` desbloqueja
sol el flag `lab`; alternativa: 5 clics al badge d'un pas d'Escalas.

## Regla d'or respectada

Les slides parallax existents (pasos 1, 7, 11, 17, 22) **no s'han tocat**: ni
`wireParallax()`, ni `parallax.css`, ni el comportament de `renderParallax()` (es
reutilitza com a funció pura). Tot el nou viu al layout `P-parallax-lab` amb fitxers
nous + edits additius.

## Arquitectura (decisions clau)

- **Compositor de variables CSS** a `parallax-lab.css`: cap tècnica escriu mai
  `style.transform`/`style.filter`; cada una escriu només els seus canals `--px-*`
  i una única regla els combina amb `calc()` (sumes per translate/rotate, productes
  per scale). Això fa les tècniques **apilables de debò**.
- **Contracte de tècnica** (`parallax-techniques.js`): `{ id, nom(ES), descripcio(ES),
  moviment, params[], apply(slideEl,cfg,ctx), cleanup(slideEl) }` amb
  `ctx = { progress(), onProgress(cb)→unsub, reduced }`; estat en WeakMap local;
  apply idempotent (cleanup-first). Frontera dura: mai tocar `.parallax-frases`
  (excepció pactada: text-reveal pot tocar `.slide__title`).
- **Motor** (`parallax-lab.js`): duplica deliberadament la lògica roda/swipe/clic de
  `wireParallax` (còpia marcada); a les fronteres usa `btn-prev/btn-next.click()` en
  lloc del `go()` privat de slides.js. Publica progrés via `--px-progress` +
  CustomEvent `sistema:parallax-progress` (detail `{t, active, total}`).
- Mode edició → kill-switch CSS; `prefers-reduced-motion` → gate JS (les `moviment:true`
  no s'apliquen) + cinturons CSS per tècnica.
- Lliçons del repo honorades: **LP-07** (mai animar `filter` — les tècniques de filter
  escriuen vars, el compositor no el transiciona), **P-26** (app-reveal crea l'iframe
  UNA vegada i després només mostra/amaga; el builder re-aplica només la tècnica
  tocada, mai re-render), **U-17** (touch-action / mode edició).

## Les 15 tècniques (model → estat)

| # | id | model | estat |
|---|----|-------|-------|
| 1 | scroll-depth | (mà, referència) | port exacte del math de wireParallax |
| 2 | multi-speed | sonnet | neta |
| 3 | mouse-tilt | opus | neta |
| 4 | float-drift | sonnet | neta |
| 5 | depth-blur | sonnet | neta |
| 6 | color-shift | sonnet | neta |
| 7 | rotate-progress | sonnet | neta |
| 8 | zoom-drift | sonnet | neta |
| 9 | inertia | sonnet | neta (CSS-only, `--px-tr-*`) |
| 10 | gradient-drift | sonnet | neta |
| 11 | mask-zoom | opus | neta |
| 12 | text-reveal | sonnet | **reparada**: col·lisió real de canals `--px-tr-*` (reservats a inertia) caçada pel verificador adversari → reanomenada a `--px-txr-*` |
| 13 | marquee | sonnet | **reparada**: biaix invertit d'`amplUnitat` (0.6 → 0.33), verificat numèricament |
| 14 | spotlight | opus | neta |
| 15 | app-reveal | opus | neta — el "moment vídeo" de GTA portat a Nuzic: l'app apareix a la frase N |

Opus es va reservar per a les 4 complexes (mouse-tilt: rAF+lerp+3D; mask-zoom:
mask-image compostable; spotlight: overlay+pointer; app-reveal: cicle de vida
d'iframe + P-26). Fable va fer verificació adversària i la revisió de composició.

## Revisió de composició (fase final del workflow)

- **Neta de col·lisions de canals**: cada tècnica escriu només el seu prefix; el
  compositor els combina bé. La reparació `--px-txr-*` era imprescindible: sense ella,
  el 🎲 hauria barrejat text-reveal + inertia amb xoc real.
- **Conflicte arreglat**: mask-zoom + depth-blur — `.parallax-img` neix amb
  `data-depth="0.12"` (la més baixa) i depth-blur li assignava el blur MÉS fort just
  quan mask-zoom la fa protagonista. Fix a `parallax-lab.css`: regla `.px-mz-on` que
  recompon el filter sense el canal de blur (mantenint els de color-shift),
  especificitat (0,3,0) sense `!important`.
- Interaccions revisades i acceptades: ordre de pintat dels overlays = ordre DOM =
  ordre fix de TECNIQUES (determinista); spotlight sempre a sobre (coherent amb la
  metàfora); inertia esmorteeix tilt/drift per disseny (és el seu propòsit).

## Fitxers

- **NOUS**: `sistema/js/parallax-techniques.js` (registre + 15 tècniques),
  `sistema/js/parallax-lab.js` (motor + cicle de vida), `sistema/js/parallax-builder.js`
  (secció del panell tweaks, amb scroll propi), `sistema/css/parallax-lab.css`
  (compositor + CSS per tècnica), `sistema/js/__tests__/parallax-techniques.test.js`
  (suite de contracte, 9 tests).
- **EDITS ADDITIUS**: `slide-data.js` (slides 28.5/28.7 ocultes, flag `lab`),
  `slides.js` (HIDDEN_FLAGS.lab, formatPaso `·C`, branca layout, cablatge wire),
  `index.html` (link CSS + `parallax-lab.js` ABANS de `slides.js` pel deep-link;
  `parallax-builder.js` després de `tweaks.js`), `tweaks.js` (export parallaxFx).

## Procés (per a futures sessions amb Workflow)

3 passades del mateix workflow (run `wf_aa0432a3-f35`, 14 specs, pipeline
impl → verificació adversària → 1 ronda de reparació → composició), tallades dues
vegades pel límit de sessió i represes amb `resumeFromRunId` (els agents acabats es
serveixen de la cache, cost zero). Total 3a passada: 33 agents, ~816k tokens, 38 min.

Lliçons reutilitzables:
- Els template literals del script de workflow NO poden contenir fences de backticks
  sense escapar (`\`\`\``) — trenquen el parse del literal.
- El cosit al repo es va fer amb un script idempotent
  (scratchpad/splice-tecniques.mjs): salta ids ja presents, valida col·lisions de
  `const` només a nivell de mòdul (columna 0), reconstrueix TECNIQUES en ordre canònic.
- Un agent mort per límit de sessió pot deixar una tècnica falsament "descartada":
  tractar-la com a pendent i deixar que la reparació re-corri al resume.
- La verificació adversària va pagar-se sola: 2 bugs reals caçats (col·lisió de canals,
  biaix numèric) que haurien sortit només en combinar tècniques.
