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
Colors de la vista de graph (`.obsidian/graph.json`, opció `--colors` del mateix script): 293 grups,
un per comunitat (`tag:#comunitat/…`, 107 famílies), to per família (angle d'or sobre el rànquing
de mida) i claredat diferent entre germanes; la resta de paràmetres de la vista es conserven i
l'anterior (37 grups amb etiquetes `community/…` obsoletes) queda a obsoletes.
La lògica viu a [docs/graphify-vault-colors.py](../graphify-vault-colors.py) (genèric: qualsevol
vault graphify) i el sync de Nuzic+Code hi delega; aplicat també a `Nuzic Teoria Core` (13
comunitats) i `Nuzic teoria` (27 comunitats, 22 famílies; «Estructura i Forma» amb dues etiquetes
unides per OR), que no tenien cap grup de color.

## 5. Guia ampliada, tooltips a la plantilla i franja de peu per a mòbil

- Guia: dues seccions plegades per defecte (`<details>`), «Botones de las apps» (icones SVG reals
  copiades de `libs/app-common/template.js` en xip rodó, Lg·V·T amb la fórmula Lg/V = T/60, Loop,
  Tap Tempo, Random, Reset, Sonido) i «Colores y cajas» (caixa verda «Prueba…» = què provar, caixa
  blava = idea clau, rosa = dimensió sonora / groc = dimensió temporal — convenció 100% consistent
  als textos). Panell a 30rem i espaiat més compacte perquè els dos títols plegats es vegin a la
  primera pantalla a 900px d'alçada.
- `template.js` (17 apps): `title` a Play/Stop, Loop, Tap Tempo, Random, Reset, Sonido, ▲▼ de
  Lg/V/T i als tres commutadors de so.
- Mòbil: «Cómo navegar» i «Privacidad» ja no floten sobre el text (captura de l'usuari, paso 10):
  van dins d'una franja fixa `.sistema-footlinks` sobre la nav, transparent i sense capturar clics en
  escriptori, opaca a ≤900px, amb el `body` reservant nav + franja (grid.css; abans només ≤480px).
  Mesurat a 500px: últim contingut a 679px, franja a 705px.
- Bug trobat amb les captures: el tancament de la guia per `blur` s'activava amb l'auto-focus de
  l'app en carregar (App15 al paso 10). Ara només tanca si el punter és sobre un iframe (clic real
  dins d'una app); 2 tests nous (8 al fitxer).

## 6. Mòbil: alçades dels iframes (pasos 3, 14, 15/16, 27/28)

Dues causes de fons, verificades amb captures a 500px (mínim de Chrome headless) i un *harness*
que reprodueix el mode vertical del Sistema (`scratchpad/cap/harness.html?app=AppX`):
- **Paso 3 (App9) amb franja buida**: `embed-mode.js` mesurava `documentElement.scrollHeight`,
  que mai baixa de l'alçada de l'iframe; amb el mínim de 320px del Sistema l'app "informava" 320
  encara que el contingut fes 187. Ara mesura la caixa del `body` (+ marges) i, quan arriba
  `app:resize`, `slides.js` marca el frame (`data-resized`) i el mínim de 320px deixa d'aplicar-se
  (grid.css/slides.css). Afecta totes les apps que s'expandeixen.
- **Apps de mida fixa (NO_EXPAND) amb aspecte d'escriptori**: a ≤900px conservaven 4/3 o 6/5 →
  375-420px d'alçada. App18 (paso 14) → 5/9 com App10 (línia sonora sencera); App19/App20
  (pasos 15/16) → 2/3 i fora `requiresLandscape` (el plànol amb registres cap sense girar el mòbil,
  com als pasos 5/6/10); App25/App25B (pasos 27/28) → 2/3 (files del plànol d'escala llegibles).
  Només CSS del Sistema (`slides.css`, regles per `data-app` dins del media ≤900px).
- **Numerals fraccionats compactes (opció 1, triada per l'usuari)**: quan un subpols fa <22px
  (`COMPACT_LABELS_BELOW_PX`), la línia passa a `labels-compact`: només marques; el numeral ".N"
  apareix quan sona (.active) o en tocar la línia a prop seu (.peek, 1,5 s). Implementat a les dues
  fàbriques compartides: `fraction-timeline.js` (App26-31, CSS a `fraction-editor-nuzic.css`) i
  `plano-grid-editor.js` (App32-35, CSS a `plano-modular.css`; el llindar s'importa de la primera);
  re-avaluació en render, `layout()`/`refreshCellWidth()` i ResizeObserver. Tests: +4 i +4.
  Verificat amb el harness a 390px: App26 1/3 i App34 1/2 compactes, App26 1/2 a 500px normal.
- **Cursa d'`app:resize` destapada pel canvi de mesura**: el Sistema envia `sistema:system-mode`
  al `load` de l'iframe, sovint abans que main.js acabi de muntar línia i controls; l'única
  alçada informada podia ser la del DOM a mig fer (App26: 170 en lloc de 265) i, com que ara
  el mínim de 320 ja no la tapava, l'iframe tallava els controls. `embed-mode.js`: mesura amb
  `body.scrollHeight` (+ marges; inclou el que desborda la caixa), re-mesures d'assentament a
  120/400/1000/2500 ms, coalescència amb setTimeout (no rAF: no corre en segon pla) i re-mesura
  en `resize`/`load`/`fonts.ready`. Seqüències verificades per a App9/16/26/28/30.

## Pendent

- Paso 13 (text): revisió amb altres persones (usuari).
