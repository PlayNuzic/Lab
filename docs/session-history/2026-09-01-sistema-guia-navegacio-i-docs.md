# 2026-09-01 — Sistema: guia de navegació + sincronització de docs

Continuació de [2026-08-31](2026-08-31-sistema-textos-nuzic-si-i-scroll-parallax.md).

## 1. Documentació: què estava desfasat (i ja no)

- `.claude/skills/aplicar-tweaks/SKILL.md` (gitignored, canvi només local): ordre canònic de
  tècniques amb `focus-mode` i `bg-dim` abans d'`app-reveal` (17 tècniques, verificat contra el
  registre real); baseline `90 suites / 1496 tests`; «regla d'or» explicita que dins de
  `parallax-lab.js` només s'edita `PRESETS`.
- `sistema/js/parallax-lab.js` (capçalera): descrivia «5 intros 1/7/11/17/22» i una «còpia
  deliberada de la lògica de gestos de `wireParallax`». Ara descriu el driver natiu de
  scroll-snap, els pasos reals (1/2/7/11/17/22/29 + labs 28.5/28.7) i `wireParallax` només
  com a fallback (`slides.js` render()).
- Al dia sense tocar: `libs/sound/CLAUDE.md` (A-10), README, CLAUDE.md, LAB_SYSTEM_RULES,
  `docs/MODULES.md`, `docs/agents-context.md` (cap resta de noms de capítol/numeració antics,
  `'cycle'` ni «sucesión»). Absents però no erronis: `docs/MODULES.md` i CLAUDE.md no indexen
  `sistema/`; el graph de graphify és una foto anterior a aquests canvis.

## 2. Guia de navegació («Cómo navegar»)

Nota discreta a baix a l'**esquerra** (racó oposat a «Privacidad», decisió de l'usuari) que
desplega un panell no modal amb les maneres de moure's pel Sistema. Text en castellà que
distingeix explícitament els dos tipus de paso (**lectura/parallax**: frase a frase, roda /
lliscar / ↑↓, clic a una frase, «sigue bajando» cap al paso següent; **amb app**: tot a la
vista, cap frase a avançar, play i → / ›), més canviar de paso (‹ › / ← →, segments de progrés
= pasos del capítol), índex de capítols (títol de la barra; ↑↓ Enter), enllaç directe
`?paso=N` i Esc.

- `sistema/index.html`: botó `#btn-guia` + panell estàtic `#nav-guide` (`role="dialog"`,
  `hidden`) + `<script type="module" src="js/nav-guide.js">`.
- `sistema/css/nav.css`: `.sistema-privacy-link, .sistema-guide-link` comparteixen la base
  (racons oposats, `line-height: 1.4` explícit als dos); la guia, a més, porta un «?» rodó verd
  menta (com els botons de la barra) i text `--fg-soft` perquè es vegi sense molestar — el text
  apagat de Privacidad no es veia (feedback de l'usuari); sense marc (una primera versió en
  píndola es va descartar) i amb el cercle de 1.4em = alçada de línia, de manera que els dos
  textos queden a la mateixa alçada (mesurat: caixes de text idèntiques, 711.9–725.9 px a
  1440×900); `.nav-guide*` amb tokens de tema (fosc inclòs), `box-sizing: border-box`,
  `kbd`, punt de color per tipus de paso, mini-botons ‹ ›, `.nav-guide__kb` amagat amb
  `(hover: none) and (pointer: coarse)`, entrada de 0.18 s respectant reduced-motion.
- `sistema/js/nav-guide.js` (nou, patró `consent.js`): `initNavGuide()` + auto-init si hi ha
  `#btn-guia`. Obre/tanca amb el botó, ×, Esc, `pointerdown` a fora (sense robar el focus) i
  `window` blur (clic dins d'un iframe d'app). No captura el teclat: les fletxes de `slides.js`
  segueixen navegant amb el panell obert.
- `sistema/js/__tests__/nav-guide.test.js` (6 tests): null sense marcatge, toggle +
  `aria-expanded`, focus × ↔ enllaç, Esc, clic fora/dins, blur.

Verificació: `npm test` → **91 suites / 1502 tests**; captures headless (Chrome, perfil aïllat,
servidor propi :8080 aturat en acabar) a 1440×900 clar (paso 4) i fosc (paso 1) i a 390×844 —
aquesta última semblava desbordar per la dreta, però era un artefacte: Chrome headless imposa
una finestra mínima de 500 px i retalla la captura (`innerWidth=500`, verificat amb `--dump-dom`);
el `box-sizing: border-box` igualment calia (362 px + padding hauria desbordat a 390 px reals).
Text del panell retocat per l'usuari a mà («barra de menú de navegación»).

## 3. Graph graphify (Corpus) — porció Lab/ refrescada

`~/Documents/Nuzic/Corpus/graphify-out/graph.json` estava al 17/07. Ni `graphify update` ni el
runbook `/graphify --update` servien tal qual: l'extractor 0.9.4 re-deriva els ids a partir de
l'arrel (`users_workingburcet_lab_…` o `sistema_js_…`) i el graph guarda `lab_…`/`Lab/…`; i
re-clusteritzar hauria esborrat els ~280 `community_name` curats (només 37 són a
`.graphify_labels.json`). Script propi: [docs/graphify-update-lab.py](../graphify-update-lab.py)
(detect_incremental kind=ast → extract seqüencial amb cache al Corpus → normalització Lab/ →
build_merge sense root ni dedup → hyperedges conservats → comunitats heretades per veïns/fitxer/
directori → asserts → backup → swap → save_manifest root=Lab kind=ast). Resultat: 21 fitxers
re-extrets, nodes 8475 → 8483 (20 perduts, tots de fitxers re-extrets: refactor App16/App17 i
ids de fitxer antics sense `_js`; 28 nous, nav-guide inclòs), edges 18423 → 18373 (col·lapse
d'edges paral·lels en Graph simple), 39 hyperedges, 424 fitxers Lab/, cap nom de comunitat
perdut (els 6 del cub -1 restaurats per node), `built_at_commit de2694b4`. Backups
`*-preupdate-20260901-193729`. CLAUDE.md al dia.
Dos efectes laterals detectats en provar l'script i tancats amb `.graphifyignore` (arrel del
Lab): `detect()` regenerava els sidecars `graphify-out/converted/` a partir dels docx de
`docs/textos ideas sistema nuzic/`, i indexava el propi script (6 nodes, podats). La poda de
fitxers esborrats es passa en forma `Lab/…` (build_merge no relativitza l'absoluta) i les
entrades excloses surten del manifest. Backups intermedis `*-194149` i `*-194528` al Corpus
són prescindibles (el pre-sessió és `*-193729`).

## 4. Graph: re-extracció completa + vault d'Obsidian «Nuzic+Code»

En preparar el vault es va veure que el rebuild del 17/07 havia perdut un terç de les arestes
d'import del Lab (3.625 al 03/07 → 2.435; 16 fitxers sense cap import, 111 amb menys). Amb
`graphify-update-lab.py --all` (re-extracció AST dels 429 fitxers de codi, ids estables,
comunitats heretades també per (source_file, label) quan canvia l'esquema d'id) queden 8.483
nodes / 19.872 edges i 3.438 arestes d'import. Backups `*-preupdate-20260901-200525`.

El vault `Nuzic+Code` (8.823 fitxers) no és un export pla de graphify: reorganitzat a mà el 05/07
(notes de codi a `CODI/`, etiquetes `comunitat/…`, noms de comunitat curats per node) i encara
al 05/07 en contingut (el 17/07 només s'hi van afegir 132 notes). `graphify export obsidian`
hauria duplicat les notes de codi a l'arrel i posat «Community N». Script propi
[docs/graphify-vault-sync.py](../graphify-vault-sync.py): només nodes `Lab/`, estat id→nota al
vault (`.nuzic_lab_vault_state.json`, noms de fitxer estables encara que canviï el label),
format byte-a-byte del vault (2.677 notes van sortir idèntiques), nodes nous a `CODI/`, notes de
nodes desapareguts i `_COMMUNITY_` òrfenes (noms del 05/07 que ja no existeixen) retirades a
`graphify-out/Nuzic+Code-obsoletes/<ts>/`, notes de comunitat reescrites si canvien els membres.
Resultat: 31 creades, 3.708 actualitzades (connexions 3.638, comunitat 3.173, location 917),
14 + 41 retirades, 73 notes de comunitat, 0 enllaços trencats, segona passada sense canvis.
Els vaults `Nuzic teoria` i `Nuzic Teoria Core` (graphs propis, sincronitzats el 27/08) no es toquen.

## Pendent

- Paso 13 (text): revisió amb altres persones (usuari).
