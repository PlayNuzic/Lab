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

## Pendent

- Paso 13 (text): revisió amb altres persones (usuari).
