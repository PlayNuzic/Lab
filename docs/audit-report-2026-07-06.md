# Auditoria de codi — PlayNuzic Lab

**Data:** 2026-07-06 · **Delta auditat:** commits `040f019d..HEAD` (133 commits des del tancament de l'auditoria 2026-06-10/11).

**Mètode:** detecció amb 18 auditors Sonnet sobre el delta + zones noves → verificació adversària en tandes (Fable i, per exhauriment, Opus 4.8 a esforç màxim al tram final). **64 troballes brutes → 60 confirmades + 4 refutades.** Les 60 confirmades es consoliden en **59 troballes distintes** (la del *stale-hidden* de mask-zoom la van trobar dos auditors independents, ancorada a `parallax-techniques.js:630` i `:702` — fusionada a **A-02**).

**Comparativa amb juny:** juny = **146 brutes → 96 confirmades + 48 menors** (144 total). Juliol = **64 brutes → 59 confirmades**. La caiguda de volum és esperada: el juny va auditar tot el repo per primer cop; el juliol només cobreix el delta de 133 commits + les zones noves (Parallax Lab, App32-35, redisseny d'anells d'App4, mòduls `app-common` nous). Les regressions del juny van aparèixer FORA dels 3 fitxers blindats — d'aquí que aquesta acta afegeixi `libs/sound/index.js` al Nivell 1 i la cadena d'init al Nivell 2 (**D-01**, pre-registrada).

**Dimensions:** Motor d'àudio (**A**) · Rendiment (**P**) · UX (**U**) · Higiene de codi i comentaris (**H**) · Tests (**T**) · Docs (**D**). ID per dimensió, ordenat per severitat dins de cada dimensió. La numeració és global per dimensió (independent de la classe), de manera que un ID diu dimensió + rang de severitat, i la secció diu la classe.

## Com fer servir aquest document

- Cada troballa té checkbox: `[ ]` pendent · `[x]` feta · `~~ratllat~~` + nota si es descarta.
- El document s'organitza en **tres classes** (seccions 1-3): **AUTO-FIX SEGURA** · **ALT RISC** · **DECISIÓ-DOCUMENTAR**. Dins de cada classe, les troballes es subagrupen per dimensió i s'ordenen per severitat.
- **AUTO-FIX SEGURA:** fix quirúrgic, cap fitxer de Nivell 1, cap invariant en risc → aplicable amb `npm test`.
- **ALT RISC:** toca un fitxer de **Nivell 1** (`timeline-processor.js`, `subdivision.js`, `audio-schedule.js`, `libs/sound/index.js`) o pot trencar un invariant → **cap fix automàtic; protocol de diff complet + aprovació humana + suite sencera**.
- **DECISIÓ-DOCUMENTAR:** el fix amaga una tria de producte o té branques amb semàntica divergent → cal decisió explícita de l'usuari abans de tocar res.
- Suite de referència: **78 suites / 1397 tests** (`npm test`, tot verd) — cap troballa la trenca en l'estat actual.
- Tots els veredictes d'aquesta tanda són **CONFIRMADA** (cap PLAUSIBLE va sobreviure la verificació adversària).

## Resum per dimensió

| Dimensió | Confirmades | ALTA | MITJANA | BAIXA |
|---|---|---|---|---|
| Motor d'àudio (A) | 12 | 3 | 4 | 5 |
| Rendiment (P) | 6 | 1 | 2 | 3 |
| User eXperience (U) | 3 | 0 | 2 | 1 |
| Higiene (H) | 17 | 0 | 6 | 11 |
| Tests (T) | 7 | 1 | 3 | 3 |
| Docs (D) | 14 | 0 | 4 | 10 |
| **Total** | **59** | **5** | **21** | **33** |

## Resum per classe

| Classe | Total | A | P | U | H | T | D |
|---|---|---|---|---|---|---|---|
| AUTO-FIX SEGURA | 37 | 3 | 3 | 3 | 11 | 4 | 13 |
| ALT RISC (Nivell 1) | 11 | 7 | 1 | 0 | 2 | 1 | 0 |
| DECISIÓ-DOCUMENTAR | 11 | 2 | 2 | 0 | 4 | 2 | 1 |

---

# 1. AUTO-FIX SEGURA — 37 troballes

> Fix quirúrgic, fora dels Nivells 1/2 (o només-tests / només-docs), cap invariant en risc. Aplicables amb la disciplina normal (`npm test` verd).

## 1.A Motor (segura)

- [x] **A-01 · MOTOR · ALTA** — `withPlayButtonLoading` no bloqueja la re-entrada durant la finestra `delayMs` (120ms): un doble clic ràpid al Play dispara `audio.play()` dues vegades sobre la mateixa instància
  - **Fitxer:** `libs/app-common/play-loading.js` (línia 25)
  - **Evidència:** `play-loading.js:25-31` només desactiva el botó DINS d'un `setTimeout(...,delayMs)`: fins que el timer no dispara (120ms) `playBtn.disabled` és `false`. A `Apps/App26/main.js:390-397` el listener no té guarda pròpia i `isPlaying = true` s'assigna a `main.js:343`, DESPRÉS de l'`await withPlayButtonLoading(...)`. Un segon clic dins la finestra torna a entrar a `startPlayback()` i ambdues invocacions arriben a `audioInstance.play(...)` (App26:320); `libs/sound/index.js` `play()` (1642) no té guarda d'entrada (postMessage `'start'` a 1728 i `_startScheduler()` a 1738 incondicionals, `isPlaying=true` massa tard a 1739). Patró replicat a App29:1110-1117 i App2:1609-1617.
  - **Fix proposat:** **Variant A únicament** — a `withPlayButtonLoading`, marcar `playBtn.disabled = true` de manera **SÍNCRONA** i restaurar-lo INCONDICIONALMENT al `finally`; mantenir els visuals (aria-busy, opacity) dins el `setTimeout` per preservar l'anti-parpelleig U-27. **Descartar la variant B** (WeakSet/no-op): 4 de 6 callers usen el valor de retorn (`const audioInstance = await withPlayButtonLoading(...)`) i un no-op retornaria `undefined` → `TypeError`. **NO tocar `libs/sound/index.js`** (Nivell 1): la guarda al botó tanca completament el vector.
  - **Veredicte:** CONFIRMADA (reproduïda amb el mòdul real: clics a t=0 i t=50ms → `play()` 2 cops; t=200ms bloquejat). Fora dels Nivells 1/2; suite pròpia de 4 tests sobreviu. Símptoma real: doble `'start'` al worklet (reinici a step 0) + closures `onFinish` duplicats.

- [x] **A-02 · MOTOR · ALTA** — mask-zoom restaura un `hiddenAbans` obsolet al cleanup i pot amagar indefinidament l'app que app-reveal ja tenia revelada *(trobada per 2 auditors: `:630` apply / `:702` cleanup)*
  - **Fitxer:** `sistema/js/parallax-techniques.js` (línies 630 i 698-703)
  - **Evidència:** `hiddenAbans = slot.hidden` és una foto presa a l'apply (`:630`); el cleanup fa `el.hidden = st.hiddenAbans` (`:702`). app-reveal muta el mateix `slot.hidden` amb el seu flag independent `st.revelat` (`:1101-1123`) sense conèixer `estatMZ`. Seqüència (paso 22): (1) mask-zoom Fondo=1 amb ranura amagada → `hiddenAbans=true`; (2) app-reveal revela → `st.revelat=true`, `.px-ar-on`; (3) desactivar mask-zoom al panell → cleanup posa `slot.hidden=true`; a partir d'aquí `revela()` fa early-return (`if (st.revelat) return;`) i l'app queda invisible fins que l'usuari baixa per sota del llindar i hi torna. `setConfig` només re-aplica la tècnica tocada (`parallax-lab.js:155-158`); el 🎲 pot combinar mask-zoom+app-reveal.
  - **Fix proposat:** Al cleanup de mask-zoom, derivar la visibilitat de l'estat viu d'app-reveal en lloc de la foto: `el.hidden = el.classList.contains('px-ar-armed') ? !el.classList.contains('px-ar-on') : st.hiddenAbans;` (dins `if (st.esSlot)`). Una línia; `px-ar-on` és mirall exacte de `st.revelat`. **Descartades** les dues variants naïf: "no restaurar mai false→true" (regressió: caixa centrada visible al cas mask-zoom sol) i "saltar restauració si px-ar-armed" (iframe invisible sense `pointer-events:none` que intercepta la roda). Afegir test de regressió (aterra amb el fix).
  - **Veredicte:** CONFIRMADA (reproduïda: estàtica + sondeig jsdom amb el contracte d'event real). Zona additiva Parallax Lab, cap fitxer Nivell 1/2; invariants 13/14 respectats (només classes i `hidden`, mai transform/filter); P-26 (iframe únic) intacte. Nota: cablatja noms de classe d'app-reveal — acoblament ja acceptat (P-26); convé un comentari que l'expliciti.

- [x] **A-07 · MOTOR · MITJANA** — el paràmetre de tolerància passat a `compareRhythm()` és mort: la "tolerància de 300ms" documentada d'App5 mai s'aplica (sempre 200ms)
  - **Fitxer:** `Apps/App5/game/game-manager.js` (línia 918)
  - **Evidència:** `game-manager.js:918-921` fa `this.rhythmAnalyzer.compareRhythm(capturedBeats, allExpectedTimestamps, { tolerance: 300 })`, però `RhythmAnalyzer.compareRhythm(recordedTaps, expectedTaps)` (`rhythm-analysis.js:44`) només declara DOS paràmetres i llegeix `this.config.timingTolerance` (`:204`, `:251`). `createRhythmAnalyzer()` es crida sense opcions a `game-manager.js:32` → tolerància efectiva = default 200ms, no els 300ms del comentari ni d'`App5/CLAUDE.md:21`.
  - **Fix proposat:** **Variant App5-local únicament:** `this.rhythmAnalyzer = createRhythmAnalyzer({ timingTolerance: 300 });` a `game-manager.js:32` + esborrar `{ tolerance: 300 }` de la crida. La instància només té 2 referències al repo (32 i 918). **Descartar** la variant que estén la signatura de `compareRhythm` a `libs/audio-capture` (fora del charter C12; 2n consumidor a `ear-training/exercise-runner.js:225`).
  - **Veredicte:** CONFIRMADA. Literal mort sense efectes d'init (A-17 comprovat); cap fitxer Nivell 1/2; cap test referencia `rhythm-analysis`; restaura l'especificació del CLAUDE.md local (no és tria de producte nova). Coordinar amb **A-03**/**D-10** (mateixa família de bug). Nota: `exercise-runner.js:56` té el mateix bug de família (`tolerance: 150`).

## 1.P Rendiment (segura)

- [x] **P-01 · RENDIMENT · ALTA** — `highlightBarAtPosition()` d'App34 fa 2 `querySelectorAll` a `document` dins el hot path de cada tick de subdivisió (el patró que P-29 va corregir a App35, mai portat a App34)
  - **Fitxer:** `Apps/App34/main.js` (línies 1691-1721)
  - **Evidència:** `highlightBarAtPosition(position)` recalcula a CADA crida `matrix?.querySelectorAll('.note-bar')` (1694), `document.querySelectorAll('.nit-editor-cell.active')` (1715) i `document.querySelectorAll('.nit-editor-cell[data-entry-index=...]')` (1717-1719), sense cache ni early-return. Es crida des de `highlightCycle` (1685, via `cycle.onTick` = CADA subdivisió) i `highlightPulse` (1656). Magnitud: `MAX_BPM = 150` (main.js:36) + denominador clampat 2-8 → 150/60·8 = **~20 crides/s**. App35 té exactament aquest problema resolt a `main.js:1697-1752` (`hlBars`/`hlCellsByIdx`/`hlLastIdx` + `if (activeIdx === hlLastIdx) return;`). L'acta 2026-06-10 (P-29) va escanejar App28/30/31/33/35 — App34 mai hi va entrar.
  - **Fix proposat:** Portar el patró de cache d'App35 (early-return per índex actiu, revalidació per `length`/`isConnected`). Purament local a `App34/main.js`. Mantenir la matemàtica pròpia d'App34 (`startSubdiv/d` amb `FIXED_NUMERATOR=1`) i portar **només** el mecanisme de cache, no la fórmula `(startSubdiv*n)/d` d'App35 (depèn de `currentNumerator`, inexistent a App34).
  - **Veredicte:** CONFIRMADA (reproduïda per traça estàtica completa del flux). Cap fitxer Nivell 1/2; invariant 11 preservat (el fix redueix feina al callback). El bessó App35 usa infraestructura idèntica (`plano-note-renderer.js` elimina barres velles a cada re-render → la revalidació `length`/`isConnected` funciona igual).

- [x] **P-02 · RENDIMENT · MITJANA** — en mode circular d'App1, `circular-timeline.js` i `circular-timeline-ring.js` pinten CADA render dos jocs sencers de `.pulse-number`; el primer es llença sempre, coordinat només per l'ordre implícit de dos rAF imbricats
  - **Fitxer:** `libs/app-common/circular-timeline.js` (línia 211)
  - **Evidència:** `applyCircularLayout()` crida `updateNumbers()` (211) dins el seu propi `requestAnimationFrame`; `updateNumbers()` (346-374) neteja i reconstrueix un joc complet de `.pulse-number`. App1 crida `timelineController.render()` (main.js:496) i tot seguit `refreshTimelineNumbers()` (497), que en circular fa `requestAnimationFrame(() => renderCircularRingNumbers(...))` (524), i `renderCircularRingNumbers` (`circular-timeline-ring.js:35`) torna a fer `querySelectorAll('.pulse-number').forEach(n => n.remove())` i reconstrueix. El comentari d'App1 ho reconeix: "El rAF assegura que els nostres números s'escriuen DESPRÉS del rAF intern d'applyCircularLayout (que pintaria els seus propis números solapats)" (main.js:517-519).
  - **Fix proposat:** Flag opt-in `skipNumbers` (default `false`) a `circular-timeline.js` que ometi `updateNumbers()` (211), activat només per App1 en circular. Condicions obligatòries: (1) enfilar el flag també pel camí `setCircular→applyLayout` (main.js:507); (2) no tocar el camí lineal (doble crida load-bearing); (3) el memo P-03 co-varia amb `isCircular` (documentar/afegir a la clau); (4) conservar el clear de `ring.js:35`; (5) actualitzar comentaris main.js:517-519 i App1/CLAUDE.md.
  - **Veredicte:** CONFIRMADA. Cap fitxer Nivell 1/2; App17 NO afectat (només importa `circular-timeline-ring.js`); App16/App1B conserven comportament pel default. Matís de severitat: l'ordre dels dos rAF és determinista per spec — és treball DOM llençat, no una carrera; el fix val la pena però no és urgent.

- [x] **P-05 · RENDIMENT · BAIXA** — mouse-tilt i spotlight segueixen processant `pointermove` (getBoundingClientRect + rAF + escriptura de vars) en mode edició, quan el kill-switch CSS ja els fa invisibles
  - **Fitxer:** `sistema/js/parallax-techniques.js` (línies 209-217, 781-790)
  - **Evidència:** `st.onMove = (e) => { const r = slideEl.getBoundingClientRect(); ... ensureRaf(); }` no té cap gate d'edició, a diferència dels gestos del motor (`parallax-lab.js:231/256 if (estat()?.editable) return;`). En edició el CSS anul·la el resultat (`body[data-editable="true"] ... transform: none !important`; `.px-overlay{ display:none !important }`, `parallax-lab.css:125-133`), però cada moviment del ratolí continua fent lectura de layout + bucle rAF + `setProperty` sobre elements inerts.
  - **Fix proposat:** Early-return amb la mateixa clau que el kill-switch CSS: `if (document.body.dataset.editable === 'true') return;` a l'inici de `st.onMove`/`st.onLeave` de les dues tècniques (4 línies).
  - **Veredicte:** CONFIRMADA. Clau consistent amb el CSS i amb el gate del motor (`tweaks.js:157-159` fixa tots dos alhora). No cacheja el rect (early-return ABANS de `getBoundingClientRect` → LP-06 preservat); no escriu transform/filter (invariant 14 intacte). Únic efecte lateral: vars congelades fins al primer `pointermove` en sortir d'edició — cosmètic i auto-curatiu.

## 1.U UX (segura)

- [x] **U-01 · UX · MITJANA** — el listener de fallback de `touchstart` per carregar Tone.js no és `passive`, reintroduint la classe de bug LA-03 (ja tancada a `user-interaction.js`) en un altre fitxer
  - **Fitxer:** `libs/sound/tone-loader.js` (línies 57-58, 112-114)
  - **Evidència:** `const listenerOptions = { capture: true };` + `document.addEventListener(eventName, loadTone, listenerOptions);` amb `eventTypes = ['click','keydown','touchstart']`. A `user-interaction.js:36-41` el listener equivalent SÍ porta `{ passive: true }` amb comentari explícit LA-03. `loadTone` mai crida `preventDefault`, així que el mateix argument aplica. Camí exercitat des de `shared-ui/header.js:186` (`ensureToneLoaded().catch(() => {})`) i `instrument-dropdown.js:38-39`.
  - **Fix proposat:** `const listenerOptions = { capture: true, passive: true };` a `tone-loader.js:58`. Semànticament neutre (`passive` només anul·la `preventDefault`, que no es crida). El `removeEventListener` segueix funcionant (només compara el flag `capture`).
  - **Veredicte:** CONFIRMADA. Cap invariant Nivell 1; toca el camí de càrrega de Tone.js (Nivell 2 per fan-in) → re-executar `tone-loader.test.js`. Replica el patró ja validat de LA-03. `passive` sobre click/keydown és inert.

- [x] **U-02 · UX · MITJANA** — `handleRandom()` d'App18 no té guard `isPlaying` (patró trencat respecte App16/17/20/25/25B): permet canviar registre/BPM visibles amb la seqüència sonant
  - **Fitxer:** `Apps/App18/main.js` (línia 533)
  - **Evidència:** `function handleRandom() { generateRandomSequence(); }` crida `generateRandomSequence()` (499), que fa `registryController.setRegistry(...)` (515) i `inputRegistro.value = newRegistry` (517) sense comprovar `isPlaying`. `randomBtn` no es deshabilita mai a App18. App20/25/25B posen `if (isPlaying) return;` a l'inici de `handleRandom` (App20:1754, App25:380, App25B:668).
  - **Fix proposat:** Afegir `if (isPlaying) return;` a l'inici de `handleRandom()` (533). **NO** la variant `randomBtn.disabled` (`libs/random/menu.js:234` faria que el disable també bloquegés l'obertura del menú longpress durant el play).
  - **Veredicte:** CONFIRMADA. Fix d'una línia, fora dels Nivells 1/2; `handleRandom` té un únic caller (`onRandomize`, 592) i cap efecte d'init; el camí legítim dins `handlePlay` crida `generateRandomSequence()` directament abans de `isPlaying = true`, no queda bloquejat.

- [x] **U-03 · UX · BAIXA** — selector CSS mort: l'atenuació de les tècniques bloquejades per reduced-motion no s'aplica mai
  - **Fitxer:** `sistema/css/parallax-lab.css` (línia 165)
  - **Evidència:** `#tweaks .pxlab-tech__head input[type="checkbox"]:disabled + span{ opacity: 0.5; }` exigeix un span DESPRÉS del checkbox, però `parallax-builder.js:59` construeix `head.append(nom, chk);` (span primer). El combinador `+` no casa mai; amb reduced-motion el checkbox queda `disabled` (`builder.js:109`) però el nom no s'atenua.
  - **Fix proposat:** `#tweaks .pxlab-tech__head:has(input[type="checkbox"]:disabled) span{ opacity: 0.5; }`. `:has()` ja és universal als navegadors objectiu (grep: usat a slides.css, shared-ui, App1/4/13/16/30/31); pitjor cas = regla descartada = comportament actual (zero regressió). **NO** l'alternativa de reordre `head.append(chk, nom)` (trencaria el layout flex etiqueta-esquerra/control-dreta sense compensació).
  - **Veredicte:** CONFIRMADA. Cosmètic; `.pxlab-tech__head` conté un sol span → `:has() span` atenua exactament aquell nom. Especificitat idèntica; cap consumidor depèn de l'ordre del DOM.

## 1.H Higiene (segura)

- [x] **H-02 · HIGIENE · MITJANA** — App34 afegeix un `div.itfr-spacer` amb un comentari que reclama un efecte de centrat, però no hi ha CAP regla CSS per a `.itfr-spacer` al repo — l'element és inert
  - **Fitxer:** `Apps/App34/main.js` (línies 298-303)
  - **Evidència:** `// ...fraction renders visually centered... const spacer = document.createElement('div'); spacer.className = 'itfr-spacer'; ... middle.appendChild(spacer);`. `grep -rn "itfr-spacer"` només retorna aquesta línia; cap `.itfr-spacer{...}` a cap CSS. App32/33/35 (mateix `buildMiddleLayout()`) NO tenen aquest div. LU-04 (commit 0c34a659) ja va declarar canònic l'ancoratge a l'esquerra i va corregir la capçalera d'aquesta MATEIXA funció (main.js:256-259 "la fracció va ANCORADA A L'ESQUERRA... el CSS actual no centra res") però es va deixar el bloc spacer residual.
  - **Fix proposat:** Eliminar el bloc `spacer` sencer (298-303) **inclòs el comentari inline 298-299**. NO la branca "afegir CSS de centrat" (contradiria LU-04 + memòria "Fraction at left edge... COMPLETE"). Verificar visualment App34 amb hard reload.
  - **Veredicte:** CONFIRMADA. Div buit amb `aria-hidden` no arma cap efecte d'init (A-17); geomètricament nul (`.middle` és `display:block`, la regla grid `.itfr-spacer{grid-column:3}` es va eliminar al refactor 3d7c76a2). Cap consumidor; la navegació de germans opera sobre `gridContainer`/`timelineWrapper`, mai sobre fills de `.middle`.

- [x] **H-03 · HIGIENE · MITJANA** — `notationCloseBtn`: es reserva l'id i es consumeix a 4 apps, però `renderApp()` mai el renderitza — el botó de tancar de partitura no existeix al DOM
  - **Fitxer:** `libs/app-common/template.js` (línia 7)
  - **Evidència:** `const NOTATION_CLOSE_BTN_ID = 'notationCloseBtn';` (template.js:7, no :6) mai s'interpola al markup (`notationPanelMarkup`, 172-189, només emet `NOTATION_PANEL_ID`/`NOTATION_CONTENT_ID`). `dom.js:139/188` demanen l'id i App2/App4/App4B/App5 el passen com `closeButton` a `createNotationPanelController`. `index.css:1515` estila `.notation-panel__close` que cap HTML usa.
  - **Fix proposat:** **Opció A (neteja):** eliminar `NOTATION_CLOSE_BTN_ID`, l'entrada de `dom.js` (app2/app4) i el paràmetre `closeButton` a les **4** crides (App2+App4+App4B+App5 — App5 usa el mapa 'app2', App4B el 'app4'). Mantenir el paràmetre `closeButton` a la signatura de `panel.js` (API pública, cost zero). El tancament ja funciona per toggle+Escape+broadcast (`panel.js:149,153,172`). **Opció B (botó visible) NO és segura** (tria d'UX que canvia el visual de totes les apps amb `showNotationToggle`).
  - **Veredicte:** CONFIRMADA. `template.js` és Nivell 2 per fan-in però esborrar la constant no altera l'HTML de cap app (grep: única aparició); l'únic consumidor real (`panel.js:84 closeButton && isVisible(closeButton)`) ja rep `null`; `dom.js` fa binding amb `silent:true` (cap warning load-bearing, A-17 comprovat). Passar la suite completa per disciplina Nivell 2.

- [x] **H-05 · HIGIENE · MITJANA** — una lib de temporal-intervals importa d'un fitxer d'App concreta (dependència inversa lib→App)
  - **Fitxer:** `libs/temporal-intervals/it-renderer.js` (línia 5)
  - **Evidència:** `import { computeIntervalNumberFontRem } from '../../Apps/App5/utils.js';` — únic cas a tot `libs/` d'una importació cap a `Apps/` (`grep -rn "from '\.\./\.\./Apps" libs` → només aquesta línia). Si App5 es renombra (com App4→App4B), la lib trenca en sec.
  - **Fix proposat:** Moure `computeIntervalNumberFontRem` (definida a `App5/utils.js:11-26`, funció pura) a `it-renderer.js` mateix (o `libs/app-common/utils.js`, on viuen les germanes). Únic consumidor: `it-renderer.js:68`. La re-exportació de compatibilitat a `App5/utils.js` és opcional (ningú la consumeix des d'App5) → només 2 fitxers tocats. JSDoc mogut verbatim (LH-12 acceptable).
  - **Veredicte:** CONFIRMADA. Funció pura sense estat ni side-effects d'import; cap test importa `it-renderer.js` ni `App5/utils.js`. Cap fitxer Nivell 1/2; coherent amb "libs FIRST".

- [x] **H-06 · HIGIENE · MITJANA** — comentari i missatge de dev referencien `renderHeader()`, eliminada al juny com a export mort
  - **Fitxer:** `libs/shared-ui/header.js` (línia 747)
  - **Evidència:** `header.js:747 console.warn('[initHeader] No header found. Call renderApp() or renderHeader() first.');` i comentari `:736-737 // renderApp i renderHeader). NO esborrar el DOM: només visibilitat.` — `renderHeader` es va eliminar al commit 04934d6d; grep: no existeix com a funció, només aquestes 2 referències textuals. La funció viva és `renderApp` (`template.js:34`, emet el header a `:192`).
  - **Fix proposat:** Actualitzar el `console.warn` a `Call renderApp() first.` i retallar "TOTS DOS camins"/"i renderHeader" del comentari. **PRESERVAR intacta** la clàusula load-bearing "NO esborrar el DOM: només visibilitat" (codifica la decisió que el menú hamburguesa es manté al DOM i només s'oculta, `header.js:738-739`, llegida per 11+ apps).
  - **Veredicte:** CONFIRMADA. 100% textual; cap test asserta l'string (grep "No header found" → només la font); branca diagnòstica sense acoblament (`return undefined` si no hi ha `header.top-bar`); el comentari reescrit s'alinea amb el CLAUDE.md local. No és Nivell 1/2.

- [x] **H-07 · HIGIENE · BAIXA** — el paràmetre `controlsLayout` de `renderApp()` (i tot el seu branching de markup) és mort: cap de les ~30 apps el passa
  - **Fitxer:** `libs/app-common/template.js` (línia 64)
  - **Evidència:** `template.js:64 controlsLayout = null` bifurca tot el markup de `.controls` (290-317, 373). `grep -rn "controlsLayout" Apps/` només troba comentaris `// controlsLayout removed — nuzic single-column layout` a App11/11A/12/index.html; cap `main.js`/`index.html` el passa a `renderApp()`.
  - **Fix proposat:** Col·lapsar `template.js` a la branca `else` (l'única que s'executa); byte-idèntic. **CONDICIONS:** (1) abast estrictament JS — NO tocar el CSS `:not([data-layout])` viu (index.css:1025,1709-1729; nuzic-theme.css) ni els blocs `[data-layout]` morts al mateix fix (baixaria l'especificitat 0,2,0→0,1,0 i podria capgirar la cascada dels `order` nuzic); (2) Nivell 2 per fan-in → afegir comprovació before/after d'`innerHTML` (no hi ha snapshot).
  - **Veredicte:** CONFIRMADA. Amb `controlsLayout` sempre falsy (verificat als 39 index.html, sense spreads), col·lapsar produeix HTML byte-idèntic; cap efecte d'init (només interpola strings). Retirada ja documentada (`docs/nuzic-editor-migration.md:21`).

- [x] **H-09 · HIGIENE · BAIXA** — dos listeners `input` independents sobre `inputLg` a App4: la no-duplicació de `renderRings()` depèn implícitament de l'ordre de registre + del guard `lastRenderedLg`
  - **Fitxer:** `Apps/App4/main.js` (línia 1218)
  - **Evidència:** `main.js:1218` registra un listener `input` que via `setCycles→recomputeLg` (1144, dispatch=true) crida `handleInput()` i normalitza `inputLg.value`. `main.js:2210` registra UN SEGON listener `input` sobre el mateix element (`[inputLg, inputV].forEach(...)`). Avui no hi ha doble render perquè `handleInput` (2285-2286 `if (lg !== lastRenderedLg) renderRings();`) llegeix el valor ja normalitzat i el guard el descarta — però depèn que `initCyclesParam()` (registra el primer, cridada a 1705) s'executi ABANS de 2210.
  - **Fix proposat:** Treure `inputLg` de l'array de 2210 (deixar-hi només `inputV`); el listener de 1218 ja dispara `handleInput()` via `recomputeLg(dispatch:true)`. Deixa la crida explícita en un sol lloc.
  - **Veredicte:** CONFIRMADA. Fitxer d'app (cap Nivell 1/2). Cap consumidor depèn del segon listener; cap test carrega `App4/main.js`. Delta observable: amb camp buit/invàlid ja no es buiden transitòriament els anells ni s'agenda `liveTransportPush` amb lg invàlid — canvi incidental en la direcció bona (coherent amb A-13/invariant 5).

- [x] **H-10 · HIGIENE · BAIXA** — `parseRowId` duplicada literalment entre `interval-note-drag.js` i `grid-2d-sync-controller.js`
  - **Fitxer:** `libs/app-common/interval-note-drag.js` (línies 114-121)
  - **Evidència:** `function parseRowId(rowId) { const match = rowId?.match(/^(\d+)r(\d+)$/); ... }` idèntica caràcter per caràcter a `grid-2d-sync-controller.js:88-95`. Els dos mòduls ja estan acoblats (interval-note-drag rep un `syncController` que és instància de grid-2d-sync-controller).
  - **Fix proposat:** **Opció A:** exportar `parseRowId` (i `buildRowId`) des de `grid-2d-sync-controller.js` (import estàtic, sense cicle) i importar-la. **Condicions:** (1) mantenir `parseRowId`/`buildRowId` a l'API d'instància (`grid-2d-sync-controller.js:484-485`) perquè el test `grid-2d-sync-controller.test.js:100` crida `syncController.parseRowId(...)`; (2) NO via la instància `syncController` (és opcional, `interval-note-drag.js:45`); (3) NO unificar amb `registry-helpers.js:255` (contracte diferent `{noteInReg}` i `.match` sense `?.`). L'opció B del fix original és imprecisa (`plano-grid-rows.js` només exporta `buildSimple12Rows`).
  - **Veredicte:** CONFIRMADA. Únic consumidor: `Apps/App20/main.js`; cap Nivell 1/2. Comentaris nous en català (LH-12).

- [x] **H-12 · HIGIENE · BAIXA** — regla `#tweaks .pxlab-actions` duplicada: el segon bloc deixa morta la declaració de marge del primer
  - **Fitxer:** `sistema/css/parallax-lab.css` (línies 193 i 218)
  - **Evidència:** `:193 #tweaks .pxlab-actions{ display:flex; flex-wrap:wrap; gap:6px; margin: 6px 0; }` i `:218 #tweaks .pxlab-actions{ position: sticky; top:0; z-index:1; background: var(--bg); padding: 6px 0; margin: 0; }` — mateix selector, especificitat idèntica; el `margin: 6px 0` queda sempre sobreescrit per `margin: 0`.
  - **Fix proposat:** Fusionar els dos blocs en un (display/gap del primer + sticky/padding/margin del segon) al lloc del segon, conservant els dos comentaris. Reubicar el comentari 190-192 amb la regla fusionada.
  - **Veredicte:** CONFIRMADA. L'estil computat efectiu ja ÉS la fusió amb `margin:0`; canvi visual nul. `.pxlab-actions` només apareix aquí (grep); cap JS llegeix `cssRules`/`insertRule`; els usos són DOM (`builder.js:25/128`). Cap `@media`/`@layer` entremig → codi mort real. Invariants 13/14 intactes.

- [x] **H-13 · HIGIENE · BAIXA** — `aleatori()` barreja les tècniques amb `sort(() => Math.random() - 0.5)`, un shuffle esbiaixat
  - **Fitxer:** `sistema/js/parallax-lab.js` (línia 176)
  - **Evidència:** `const barreja = [...elegibles].sort(() => Math.random() - 0.5).slice(0, quantes);` — comparador aleatori no uniforme (biaix conegut segons l'algorisme de sort del motor).
  - **Fix proposat:** Fisher-Yates. **CURA D'IMPLEMENTACIÓ:** el snippet ha d'aplicar `.slice(0, quantes)` de manera capturada (`let barreja` + reassignació, o `barreja.slice(0,quantes).forEach(...)`, o Fisher-Yates parcial). Aplicar `const barreja = [...elegibles]` + `.slice()` solt deixaria `barreja.forEach` iterant TOTES les elegibles (fins a 15) en lloc de 2-4, activant tècniques pesades alhora.
  - **Veredicte:** CONFIRMADA. Blast radius = només el panell d'autoria; únic cridador `builder.js:132-133` (retorn no capturat). L'ORDRE dins `barreja` és irrellevant (`syncActiu()` itera l'ordre canònic `TECNIQUES`, no l'ordre d'inserció). Cap test hi depèn; invariants 13/14 respectats.

- [x] **H-16 · HIGIENE · BAIXA** — `createMelodicAudioInitializer` llegeix `localStorage` sense try/catch al camí crític d'init: si l'accés a storage llança (Safari amb storage blocat, embeds), el primer play de les apps melòdiques peta
  - **Fitxer:** `libs/app-common/audio-init.js` (línia 227)
  - **Evidència:** `:227 const storedInstrument = perAppKey ? localStorage.getItem(perAppKey) : null;` dins la promesa d'initAudio, entre `Tone.start()` i `setInstrument`. `getItem` pot llançar `SecurityError`; el catch de `:242` només re-nul·la `audioInitPromise` i re-llança → play mort. La resta del repo envolta l'accés (`createMixerPersistence`, 390-396: `try {...} catch { return null; }`).
  - **Fix proposat:** `let storedInstrument = null; try { storedInstrument = perAppKey ? localStorage.getItem(perAppKey) : null; } catch {}` — el fallback a `prefs`/`config.defaultInstrument` ja existeix (229). Afegir comentari per consistència.
  - **Veredicte:** CONFIRMADA. Nivell 2 (41 importadors) → revisió del diff + suite. No toca l'ordre Tone→gest→start (invariant 3); camí feliç idèntic (const→let); patró propi del fitxer. **Nota d'abast (no bloqueja):** 4 wrappers `initAudio` d'app re-introdueixen el mateix perill just DESPRÉS (`App12:62, App15:98, App25:103, App25B:107` fan `localStorage.getItem('appXX:p1Toggle')` sense guard) — troballa separada a endurir en paral·lel.

- [x] **H-17 · HIGIENE · BAIXA** — els listeners d'`ensureToneLoaded` no filtren esdeveniments sintètics (cap check d'`isTrusted`): un click programàtic pot injectar Tone i crear l'AudioContext pinnat abans de cap gest real
  - **Fitxer:** `libs/sound/tone-loader.js` (línies 112-114)
  - **Evidència:** `eventTypes.forEach((eventName) => { document.addEventListener(eventName, loadTone, listenerOptions); });` — `loadTone` s'executa amb `isTrusted===false`, i al seu `onload` crida `ensurePreferredSampleRateContext()` (89) → `new Ctor({...})` → AudioContext sense gest real ('suspended' + warning). Contrast amb `user-interaction.js:25-27 if (event?.isTrusted === false) { return; }`. `libs/sound/CLAUDE.md` exigeix el gest.
  - **Fix proposat:** `const onGesture = (event) => { if (event?.isTrusted === false) return; loadTone(); };` i registrar/desregistrar `onGesture` (línies 62 i 113). **DEIXAR `:107 loadTone()` cru** (el path directe no porta event; embolcallar-lo el trencaria).
  - **Veredicte:** CONFIRMADA. Nivell 2 → revisió del diff + suite completa. Reforça l'invariant del gest (no el pot trencar). Cap `.click()` del repo dispara so que depengui d'aquest listener (App5, l'app amb més clicks programàtics, és rítmica). El test existent agafa el path directe (`test:69` amb `userActivation.isActive=true`) → no es trenca.

## 1.T Tests (segura)

- [x] **T-02 · TESTS · MITJANA** — el test únic de Parallax Lab (126 línies) només exercita scroll-depth; les altres 14 tècniques —inclosos mask-zoom i app-reveal (el bug A-02)— només passen per la validació estructural genèrica
  - **Fitxer:** `sistema/js/__tests__/parallax-techniques.test.js` (línia 1)
  - **Evidència:** úniques suites: "contracte del registre" (ids únics, `validaTecnica`) i "scroll-depth — tècnica de referència" (5 tests). Cap test crida `maskZoom.apply`/`appReveal.apply` amb un harness amb `.parallax-app-slot`, així que la lògica de `hiddenAbans`/`esSlot`/`st.revelat` (**A-02**) no té xarxa de seguretat.
  - **Fix proposat:** Harness amb `.parallax-app-slot[data-app]` cobrint: (1) mask-zoom Fondo=1 crea/reutilitza un únic iframe compartit; (2) **test de regressió d'A-02** (activar+desactivar mask-zoom no deixa la ranura amagada quan app-reveal l'havia revelada); (3) cleanup en mode imatge no toca `hidden`. Assertar sobre `hidden`/classes/recompte d'iframes (no props `-webkit-mask-*`, cssstyle pot no retenir-les).
  - **Veredicte:** CONFIRMADA. Només-tests; zona additiva. Viable a jsdom. **Condició:** el test (2) FALLA contra el codi actual → ha d'aterrar junt amb o després del fix **A-02** (regla "all tests must pass"); (1) i (3) poden aterrar ja.

- [x] **T-05 · TESTS · BAIXA** — el memo `render(lg,isCircular)` (P-03) i el refactor `buildNumber/updateNumbers` (P-05) no tenen cap test nou — la protecció contra regressió depèn només de lectura manual
  - **Fitxer:** `libs/app-common/circular-timeline.js` (línia 62)
  - **Evidència:** `:59-65 if (lg === lastLg && isCircular === lastCircular && lastPulses.length && lastPulses[0].isConnected) { return lastPulses; }` i el canvi de `updateNumbers()` de `document.querySelectorAll` a `timeline.querySelectorAll` (352) són canvis nous d'aquest delta. `grep -n "memo\|isConnected\|lastLg\|lastCircular" circular-timeline.test.js` → cap resultat.
  - **Fix proposat:** Afegir casos: `render(5,{isCircular:false})` dues vegades retorna `===` el mateix array; buidar `timeline.innerHTML` invalida el memo via `isConnected`; `setCircular(true)` sincronitza `lastCircular`. **Matís d'implementació:** el suite actual (node) usa mocks el `createElement` dels quals no defineix `isConnected` → cal estendre'ls o fitxer nou amb `@jest-environment jsdom` (patró de `play-loading.test.js:1`).
  - **Veredicte:** CONFIRMADA. Estrictament additiu; protegeix (no contradiu) l'invariant 7. Cap regressió possible als tests existents (memo per-closure de cada controller).

- [x] **T-06 · TESTS · BAIXA** — el motor del Parallax Lab (`parallax-lab.js`) no té cap test: només està coberta la capa de tècniques (contracte + scroll-depth)
  - **Fitxer:** `sistema/js/parallax-lab.js` (línia 1)
  - **Evidència:** `sistema/js/__tests__/` només conté `parallax-techniques.test.js`. Sense test: prioritat localStorage > PRESETS > defecte (`getConfig`/`configMutable`), gate `tech.moviment && reduced`, `aleatori()` (rangs arrodonits al step), neteja per `'sistema:render'`. Ara que els pasos reals 1/7/11/17/22 corren sobre aquest motor (a548e091), una regressió aquí afecta producció.
  - **Fix proposat:** `parallax-lab.test.js` (jsdom, localStorage mockejat) verificant: (1) `getConfig(22)` retorna el preset i mai la referència viva; (2) `configMutable` materialitza sense perdre el preset; (3) `aplica()` no crida apply de `moviment:true` amb `reduced`; (4) `aleatori()` genera valors dins `[min,max]` alineats al step; (5) `resetConfig` esborra `fx[paso]`.
  - **Veredicte:** CONFIRMADA. Només-tests; el motor queda intacte. **Gotchas d'autoria (confirmats):** (a) `window.matchMedia` peta a la importació (`:25` top-level; jsdom no la implementa) → mock ABANS d'`import` dinàmic + `jest.resetModules()`; (b) `reduced` és const de load-time → dos imports amb `matchMedia` `{matches:true/false}`; (c) `configMutable`/`aplica` són privats → exercir via `setConfig`/`wire` amb spy; (d) `fx` és estat mutable de mòdul → aïllar per cas. Scope: no cobreix la màquina de gestos (roda/swipe), el tros de més valor però el més difícil en jsdom.

- [x] **T-07 · TESTS · BAIXA** — App5 (0% de cobertura) té funcions pures de puntuació sense cap test que en verifiqui els llindars
  - **Fitxer:** `Apps/App5/gamification-adapter.js` (línies 447-459)
  - **Evidència:** `calculateIntervalComplexity(intervals)` (`if (complexity < 10) return 'low'; ... return 'expert';`) i `analyzePatternComplexity(pattern)` (464) calculen dificultat a partir de variança/densitat — lògica pròpia, no coberta per `libs/gamification/`. `App5/utils.js` també exporta `computeIntervalNumberFontRem(lg)` sense suite. Cap fitxer d'App5 a `*.test.js`.
  - **Fix proposat:** `export` a les dues funcions privades + `App5/__tests__/gamification-adapter.test.js` + `utils.test.js` amb casos als llindars (9.9/10/29.9/30...). Test d'utils amb `@jest-environment jsdom` + mock de `matchMedia`.
  - **Veredicte:** CONFIRMADA. Additiu; afegir `export` és inert (únic consumidor: import dinàmic a `App5/main.js:1821`, només usa `initApp5Gamification`). Efecte lateral d'import (`prefetchDefaultSamples`) ja protegit per `typeof window === 'undefined'`. El recompte de suites augmentarà (esperat).

## 1.D Docs (segura)

- [x] **D-01 · DOCS · MITJANA** — actualitzar la secció High-Risk Files del CLAUDE.md arrel: afegir `libs/sound/index.js` (Nivell 1) i la cadena d'init sensible (Nivell 2) *(pre-registrada)*
  - **Fitxer:** `CLAUDE.md` (secció High-Risk Files)
  - **Evidència:** re-avaluació 2026-07-06: les regressions del juny van passar FORA dels 3 fitxers blindats (`index.js` +391 línies, 20 importadors; `audio-init.js` 41 importadors).
  - **Fix proposat:** Reescriure la secció amb els dos nivells acordats (vegeu context pack: Nivell 1 afegeix `libs/sound/index.js`; Nivell 2 = `audio-init.js`, `user-interaction.js`, `tone-loader.js`, timing viu, massius per fan-in).
  - **Veredicte:** CONFIRMADA (pre-registrada, acordada amb l'usuari). Canvi documental. Coordinar amb **D-03/D-04** (mateix fitxer, línies diferents — sense conflicte).

- [x] **D-02 · DOCS · MITJANA** — el comptador de suites/tests de l'arrel està desactualitzat: diu "76 test suites, 1370 tests" però la suite real dona 78/1397
  - **Fitxer:** `CLAUDE.md` (línia 5)
  - **Evidència:** `CLAUDE.md:5 "...76 test suites, 1370 tests."` — `npm test` dona "Test Suites: 78 passed / Tests: 1397 passed".
  - **Fix proposat:** Actualitzar a "78 test suites, 1397 tests" (o treure el número i dir "veure `npm test`").
  - **Veredicte:** CONFIRMADA. Xifres coincideixen amb el context pack (línia 58); cap codi les llegeix. Coordinar amb **D-01** (mateix fitxer, línies diferents).

- [x] **D-03 · DOCS · MITJANA** — App2/CLAUDE.md llista `pulse-seq.js` com a dependència de `libs/app-common/`, però aquest fitxer no existeix — el mòdul real és `libs/pulse-seq/index.js`
  - **Fitxer:** `Apps/App2/CLAUDE.md` (línia 22)
  - **Evidència:** `App2/CLAUDE.md:22 "libs/app-common/ (...pulse-seq.js, utils.js)"` — `ls libs/app-common/pulse-seq.js` → no existeix; `App2/main.js:13 import createPulseSeqController from '../../libs/pulse-seq/index.js';`. `libs/app-common/CLAUDE.md:52` documenta el trasllat.
  - **Fix proposat:** Treure `pulse-seq.js` de la llista de `libs/app-common/` i afegir `libs/pulse-seq/` com a dependència separada.
  - **Veredicte:** CONFIRMADA. Concorda amb el CLAUDE.md del mòdul; cap fitxer Nivell 1/2; efecte positiu (evita que Claude busqui un fitxer inexistent).

- [x] **D-04 · DOCS · MITJANA** — App5/CLAUDE.md afirma que `libs/app-common/pulse-seq-intervals.js` és un mòdul nou, però no existeix — el controller viu a `libs/pulse-seq/index.js`
  - **Fitxer:** `Apps/App5/CLAUDE.md` (línia 29)
  - **Evidència:** `App5/CLAUDE.md:28-29 "libs/app-common/pulse-seq-intervals.js — Adapted sequence controller"` — `find libs -iname "*pulse-seq-intervals*"` → res; `App5/main.js:11 import { createPulseSeqIntervalsController } from '../../libs/pulse-seq/index.js';`; `libs/pulse-seq/CLAUDE.md:8` ho documenta.
  - **Fix proposat:** Canviar a `libs/pulse-seq/index.js (createPulseSeqIntervalsController)`. **Matís:** la mateixa referència estala es repeteix a `App5/AGENTS.md:220-221` i `:255` — corregir ambdós al mateix commit.
  - **Veredicte:** CONFIRMADA. El CLAUDE.md del mòdul propietari coincideix amb el fix; cap consumidor de codi afectat.

- [x] **D-05 · DOCS · BAIXA** — l'arrel diu "app-common → 50 core modules" però el recompte real i els altres dos docs diuen 54
  - **Fitxer:** `CLAUDE.md` (línia 33)
  - **Evidència:** `CLAUDE.md:33 "app-common/ → 50 core modules"` — `find libs/app-common -maxdepth 1 -name "*.js" | wc -l` → 54; `libs/app-common/CLAUDE.md:4 "54 modules"`; `docs/MODULES.md:9 "54 mòduls core"`.
  - **Fix proposat:** Canviar "50 core modules" per "54".
  - **Veredicte:** CONFIRMADA. Cap codi llegeix la xifra; no col·lideix amb D-01 (línies diferents). Alinea l'arrel amb el CLAUDE.md local del mòdul.

- [x] **D-06 · DOCS · BAIXA** — el mateix comptador stale es repeteix a `docs/MODULES.md` ("76 suites, 1370 tests")
  - **Fitxer:** `docs/MODULES.md` (línia 77)
  - **Evidència:** `MODULES.md:77 "Cobertura actual: 76 suites, 1370 tests"` — real 78/1397.
  - **Fix proposat:** Actualitzar a "78 suites, 1397 tests" en sincronia amb **D-02** (i README.md, que porta la mateixa xifra) al mateix commit.
  - **Veredicte:** CONFIRMADA. Cap codi parseja el comptador (grep: només README/CLAUDE/MODULES). Re-verificar amb `npm test` en aplicar.

- [x] **D-07 · DOCS · BAIXA** — comentari de conveni angular obsolet: ja no és cert per a "totes les apps circulars" després del redisseny d'App4
  - **Fitxer:** `libs/app-common/timeline-layout.js` (línies 283-287)
  - **Evidència:** `// +PI/2: el pols 0 comença a BAIX... convenció visual de totes les apps circulars.` Però `circular-rings.js:130-132` (App4) fa `-Math.PI/2` ("pols 0 a dalt") i `circular-timeline-ring.js:95` (App1/App17) també `-Math.PI/2`. App4 ja no importa `timeline-layout.js` (només App2/App3/App4B/App5).
  - **Fix proposat:** Reescriure el comentari perquè no afirmi universalitat. **Matís de redacció:** `circular-timeline.js:183/194/309` (App1/App1B/App16) també usa `+π/2`; millor dir que `+π/2` és la convenció d'aquest mòdul i de `circular-timeline.js`, i que els mòduls d'anells nous usen `−π/2` (no enumerar apps, tornaria a quedar obsolet).
  - **Veredicte:** CONFIRMADA. Només comentari; compleix LH-12. No és Nivell 1/2.

- [x] **D-08 · DOCS · BAIXA** — `computeField` i `createFormulaSolver` (API pública) no tenen JSDoc amb `@param`/`@returns`, a diferència de la resta de mòduls nous del mateix charter
  - **Fitxer:** `libs/app-common/formula-solver.js` (línies 15, 22)
  - **Evidència:** `formula-solver.js` només té `@module`/`@rol` de capçalera; `computeField` (15) porta `// Totes deriven de Lg/V = T/60.` i `createFormulaSolver` (22) cap. `polyrhythm-info.js` té el mateix patró (`computePolyrhythmInfo`, 18, sense JSDoc).
  - **Fix proposat:** Afegir JSDoc mínim (`@param`, `@returns`) sobre `computeField`, `createFormulaSolver` i `computePolyrhythmInfo`, coherent amb `renderCircularRingNumbers`/`withPlayButtonLoading`. Escriure en català (LH-12); absorbir el comentari existent dins el bloc.
  - **Veredicte:** CONFIRMADA. Només documentació; sense build step ni doc-gen; els mòduls són purs; no Nivell 1/2.

- [x] **D-09 · DOCS · BAIXA** — comentari de l'export `parallaxFx` desactualitzat: ja no és només dels pasos 28.5/28.7
  - **Fitxer:** `sistema/js/tweaks.js` (línies 204-206)
  - **Evidència:** `// Config del Parallax Lab (pasos 28.5/28.7)...` + `parallaxFx: window.__parallaxLab?.getConfigAll?.() || {}`. `getConfigAll()` (`parallax-lab.js:343`, retorna `fx`) pot contenir qualsevol paso amb `layout P-parallax-lab`; des d'a548e091 inclou els pasos de producció 1/7/11/17/22 (`PRESETS[22]` ja n'és un exemple).
  - **Fix proposat:** Actualitzar el comentari (qualsevol paso amb `P-parallax-lab`: els 5 intros reals + els 2 labs ocults). Per coherència, corregir també la capçalera de `parallax-lab.js:1` ("pasos ocults 28.5/28.7").
  - **Veredicte:** CONFIRMADA. Només comentari (LH-12); no toca fitxers de l'invariant 13; no altera el payload d'export de la skill `aplicar-tweaks`.

- [x] **D-11 · DOCS · BAIXA** — la regla de validació "numerator < denominator" no s'aplica enlloc del codi d'App3 ni de `fraction-editor.js`
  - **Fitxer:** `Apps/App3/CLAUDE.md` (línia 17)
  - **Evidència:** `App3/CLAUDE.md:17 "denominator > 0, numerator > 0, numerator < denominator"`. Però `computeFractionInfo` (`fraction-editor.js:37`) només comprova `numerator <= 0 || denominator <= 0`; el test (`fraction-editor.test.js:62`, defaults `{numerator: 6, denominator: 5}`) demostra que `n > d` és vàlid. `App3/main.js:891-898` implementa `enableComplexFractions` (default true) — el random genera `n > d` rutinàriament.
  - **Fix proposat:** **Opció A únicament** — eliminar la clàusula "numerator < denominator" (deixar "denominator > 0, numerator > 0"; opcionalment anotar que `n ≥ d` és vàlid via fraccions complexes). L'opció B (implementar la restricció) queda **descartada** (trencaria la feature d'App3, el test compartit i App26-35).
  - **Veredicte:** CONFIRMADA. `n > d` és intencionat, no forat de validació. La clàusula només existeix a `App3/CLAUDE.md:17`; cap codi la llegeix.

- [x] **D-12 · DOCS · BAIXA** — App2/CLAUDE.md i App3/CLAUDE.md citen el test `notation-utils`, renombrat fa temps
  - **Fitxer:** `Apps/App2/CLAUDE.md` (línia 25)
  - **Evidència:** `App2/CLAUDE.md:25 "...subdivision, notation-utils."` / `App3/CLAUDE.md:25 "...subdivision, notation-utils, tap-resync."` — `find libs -iname "*notation-utils*"` → res. `libs/notation/CLAUDE.md:41` i `libs/app-common/AGENTS.md:47` documenten `notation-utils.test.js → libs/notation/fraction-notation.test.js`.
  - **Fix proposat:** Substituir `notation-utils` per `fraction-notation` a les dues línies. **Matís:** la mateixa referència persisteix a `App2/AGENTS.md:41` i `App3/AGENTS.md:46` (path antic) — incloure-les al mateix fix.
  - **Veredicte:** CONFIRMADA. Només docs; l'invariant 9 regula imports de codi, no docs.

- [x] **D-13 · DOCS · BAIXA** — App1B/CLAUDE.md llista `simple-visual-sync.js` com a dependència, però es va consolidar dins `visual-sync.js`
  - **Fitxer:** `Apps/App1B/CLAUDE.md` (línia 31)
  - **Evidència:** `App1B/CLAUDE.md:31 "...simple-visual-sync.js, simple-highlight-controller.js..."` — `ls libs/app-common/simple-visual-sync.js` → res; `App1B/main.js:12 import { createSimpleVisualSync } from '../../libs/app-common/visual-sync.js';`. `libs/app-common/CLAUDE.md:21 "visual-sync.js — Consolidated visual sync (simple + complete)"`.
  - **Fix proposat:** Canviar `simple-visual-sync.js` per `visual-sync.js`. Edició limitada a aquest nom (la congelació d'App1B prohibeix canvis de funcionalitat, no correccions documentals).
  - **Veredicte:** CONFIRMADA. Només docs; `visual-sync.js` només referenciat, no modificat.

- [x] **D-14 · DOCS · BAIXA** — les llistes de Dependencies d'App1 i App1B citen `random-menu.js` i `range.js` a app-common, que no existeixen com a tals
  - **Fitxer:** `Apps/App1/CLAUDE.md` (línies 80-81)
  - **Evidència:** `App1/CLAUDE.md:80-81 "...random-menu.js, range.js, subdivision.js..."` i `App1B/CLAUDE.md:31` igual. Cap dels dos existeix a `libs/app-common/`. Al codi: `initRandomMenu`/`mergeRandomConfig` venen de `libs/random/index.js` (`App1/main.js:4`), i `toRange` de `libs/app-common/number-utils.js` (`main.js:5`).
  - **Fix proposat:** Substituir `random-menu.js` per `libs/random/index.js (initRandomMenu, mergeRandomConfig)` (com a ítem FORA del parèntesi `libs/app-common/(...)`) i eliminar `range.js` (`number-utils.js` ja hi figura). Aplicar a totes dues CLAUDE.md.
  - **Veredicte:** CONFIRMADA. Només docs; cap codi executable implicat. (`App1B/CLAUDE.md:31` també arrossega **D-13**.)

---

# 2. ALT RISC — 11 troballes (protocol diff complet + aprovació humana)

> Toquen un fitxer de **Nivell 1** (`libs/sound/index.js`, `timeline-processor.js`, `subdivision.js`, `audio-schedule.js`) o poden trencar un invariant. **Cap fix automàtic.** Encara que el diff sembli trivial, la classificació la força el tier: llegir tests existents → mostrar diff complet → aprovació humana → suite sencera (78/1397).

## 2.A Motor (alt risc)

- [x] **A-04 · MOTOR · MITJANA** — si el graf es (re)construeix amb FX desactivats, re-activar FX deixa el motor en silenci total: la cadena interna només es cablega a la branca 'enabled' del build
  - **Fitxer:** `libs/sound/index.js` (línies 906-915)
  - **Evidència:** A `_ensureContext`: `if (this._effectsEnabled) { master.connect(eq); eq.connect(compressor); compressor.connect(limiter); reverbMix.connect(destination); } else { master.connect(destination); }`. `setEffectsEnabled(true)` (2537-2540) només fa `master.disconnect(); master.connect(eq);` — assumeix que `eq→compressor→limiter→reverbMix→destination` ja existeix. Escenari: FX off amb el toggle del mixer → canvi de context (`:718` adopció d'un ctx de Tone tardà) → rebuild pren la branca `else` → re-activar FX deixa `master→eq` sense sortida → cap so fins a recarregar.
  - **Fix proposat:** Cablejar SEMPRE la cadena interna (`eq→compressor→limiter` i `reverbMix→destination`) fora del condicional; condicionar només la sortida del master (`master→eq` o `master→destination`). Amb FX off, `reverbMix→destination` no rep senyal → comportament actual idèntic.
  - **Veredicte:** CONFIRMADA (reproduïda: harness sobre el mòdul real, rebuild pel camí fidel `:718`; després de re-activar, `master` no arriba a destination). Nivell 1. Fix tècnicament net (nodes recreats frescos a cada build; sense doble-connexió). **Caveat:** la branca d'efectes NO té cap cobertura (`FakeAudioContext` no defineix `createBiquadFilter` → tota la suite pren el fallback) → verificació al navegador o mock capaç d'efectes.

- [x] **A-05 · MOTOR · MITJANA** — `_futureSources` no es buida en un `stop()` graceful ni es reinicia a `play()`: un restart immediat després d'un final natural pot fer que un canvi de tempo talli fonts d'una sessió anterior encara sonant
  - **Fitxer:** `libs/sound/index.js` (línia 1790)
  - **Evidència:** l'únic `_futureSources.clear()` viu dins `_stopAllPlayers()` (1067), executat només via `_fadeOutAndStopPlayers()` (només si `!graceful`, 1790-1792). En `stop()` graceful (`_endedNaturally=true`) `_futureSources` queda intacte. `play()` (1684-1685) reinicia `_pulseCounter`/`_lastAbsoluteStep` sense tocar `_futureSources`; `_cancelSourcesAfterStep` (1141-1152) mira `step > afterStep` sobre TOT `_futureSources` sense tag de sessió.
  - **Fix proposat:** `this._futureSources?.clear();` a l'inici de `play()` (després de `_lastAbsoluteStep = null`, 1685). Desenganxa les fonts velles de `_cancelSourcesAfterStep` sense tallar-les (`onended` protegit per `if (sources)`, 1334).
  - **Veredicte:** CONFIRMADA (reproduïda: test jest amb mocks A-10, flux done→stop()→play()→setTempo(240)). Nivell 1. **Riscos residuals per a la revisió:** (1) si algun dels 20 consumidors crida `play()` sense `stop()` mentre sona, el clear desenganxa fonts vives → regressió A-10; (2) fix asimètric (la comptabilitat melòdica `_cancelScheduledNotes` té la mateixa obsolescència, sense tractar). El test A-10 existent només cobreix `stop()` no-graceful.

- [x] **A-08 · MOTOR · BAIXA** — quan el context passa a 'closed' (A-06), el listener fa `stop()` però no fa teardown: el motor queda lligat per sempre a un context mort i cap `play()` posterior torna a sonar
  - **Fitxer:** `libs/sound/index.js` (línies 694-698)
  - **Evidència:** `if (ctx.state === 'closed') { this.stop(); return; }` — no crida `_teardownAudioGraph()` ni neteja `this._ctx`. Al següent play, `_ensureContext` troba `this._node` viu i retorna (722-727); `tryResumeContext` sobre 'closed' retorna false (96). Fins i tot amb `_node` net, `buildContext` re-adoptaria el context tancat via `preferExisting = normalizeAudioContext(this._ctx)` (740). Escenari: SO/WebView Android tanca el context a mig playback → Play visible però mut.
  - **Fix proposat:** A la branca 'closed': `this.stop(); this._teardownAudioGraph(); this._ctx = null;` (ordre: stop ABANS de nul·lar `_ctx`, perquè `stop()` comença amb `if (!this._ctx) return;`).
  - **Veredicte:** CONFIRMADA (reproduïda per traça del flux `ready()→_ensureContext`; branca 'closed' distinta de 'suspended'/'interrupted'). Nivell 1. **Efecte lateral substancial:** els instruments melòdics NO es recuperen — `engine-ready.js:9` és un singleton que es resol un cop; després del rebuild `whenMelodicChannelReady` retorna el bus VELL i `piano.js:96-98` re-dispara "context has been closed" (invariant 4). Complet per a apps rítmiques, incomplet per a melòdiques → cal fix company a `engine-ready.js` o documentar la limitació.

- [x] **A-09 · MOTOR · BAIXA** — `_previewGain` no es neteja a `_teardownAudioGraph`: després d'un canvi de context, `preview()` connecta un buffer del context nou a un GainNode del context vell (InvalidAccessError) i el preview queda mut
  - **Fitxer:** `libs/sound/index.js` (línia 1464)
  - **Evidència:** `preview()` (1462-1469) memoitza `this._previewGain` per sempre; `_teardownAudioGraph` (633-679) desconnecta `_node`/`_bus`/`_voiceBuses`/`_fallbackGain` però mai `_previewGain`. Post teardown+rebuild (740), `source(context nou).connect(_previewGain(context vell))` llança `InvalidAccessError`, el catch (1491) l'empassa amb `console.warn` i tots els previews posteriors queden muts. Consumidor: `sound-dropdown.js:100 a.preview(pending)`.
  - **Fix proposat:** A `_teardownAudioGraph`: `if (this._previewGain) { try { this._previewGain.disconnect(); } catch {} this._previewGain = null; }` — `preview()` el recrea lazy sobre el context vigent (patró idèntic al `previewGain` de mòdul).
  - **Veredicte:** CONFIRMADA (reproduïda determinísticament a node: teardown deixa `_previewGain === l'objecte original`). Nivell 1. Lògica auto-sanant, sense efecte lateral advers detectat: placement correcte (un sol caller de producció, `:719`, sota canvi real de context); zero consumidors externs (grep). Cap invariant de timing (camí de preview, fora del transport). Severitat baixa: requereix substitució de context a mitja sessió entre dos previews.

- [x] **A-10 · MOTOR · BAIXA** — align 'cycle' té dues semàntiques divergents: el worklet aplica al wrap de MESURA però `_computePendingTempo` calcula el llindar al proper múltiple del NUMERADOR de cicle en passos absoluts — API avui sense callers
  - **Fitxer:** `libs/sound/index.js` (línies 2440-2447)
  - **Evidència:** main thread: `firstStep = Math.floor((lastStep+1)/numerator)*numerator; ... return { ..., effectiveStep: lastOldStep };` (`lastStep` = `_lastAbsoluteStep`, free-running). Worklet: `if (this.loop && this.currentStep === 0) { if (pendingTempoChange.align === 'cycle') this._applyPendingTempoChange(); }` (`timeline-processor.js:250-253`) i al wrap de `measurePhaseBeats` (330-332). Doble discrepància: frontera numerador-de-cicle vs mesura, i espai absolut vs embolcallat. `grep 'align:.*cycle'` a Apps/libs → **zero resultats**.
  - **Fix proposat:** **Cap fix de codi automàtic.** L'única variant de risc real zero és **documentar la divergència** al comentari i deixar la tria (corregir `_computePendingTempo` al wrap de mesura via `_resolveStepIndex()===0`, o degradar/eliminar l'opció 'cycle') com a **decisió de producte**. La variant "degradar a nextPulse al main thread" NO és risc zero (`:1838` envia l'`align` cru al worklet, amplia el desfasament).
  - **Veredicte:** CONFIRMADA (reproduïda com a defecte LATENT per traça dels dos fils + grep de callers + suite verda). Nivell 1 (índex.js + potencialment `timeline-processor.js`). `_computePendingTempo` és compartida amb la branca `nextPulse` viva de TOTES les apps → blast radius al camí viu. `libs/sound/CLAUDE.md` documenta 'cycle' com a opció vàlida.

- [x] **A-11 · MOTOR · BAIXA** — `setVoices` en viu (push A-13 d'App4 cada edició, debounce 250ms) reseteja `countdownBeats=0` de TOTES les veus: cada veu dispara immediatament i re-corre lliure des d'una fase arbitrària, fora de la graella de mesura
  - **Fitxer:** `libs/sound/timeline-processor.js` (línia 101)
  - **Evidència:** cas 'setVoices' (101-107): `this.voices.clear(); for (const v of msg.voices) this._addVoice(v);` i `_addVoice` fixa `countdownBeats: 0.0` (164) → al sample següent `if (voice.countdownBeats <= 1e-9)` (365) dispara totes les veus i les repeticions queden ancorades al moment d'arribada del missatge. App4 ho invoca en playback (`Apps/App4/main.js:2353-2354`, gated `isLive`). Avui no és audible (veus amb `channel`, àudio pel lookahead grid-aligned; missatges 'voice' sense consumidor a App4).
  - **Fix proposat:** Merge per id (preservar `countdownBeats`/`subIndex` de les veus amb mateixa raó n/d; només crear de zero les noves), o alinear les noves a `measurePhaseBeats`. Mínim quirúrgic: el merge per id.
  - **Veredicte:** CONFIRMADA (reproduïda per lectura directa del worklet + verificació anti-fals-positiu que App4B alimenta `setVoices` amb array buit). Nivell 1. **Efecte A-17 infravalorat:** el consumidor JA existeix i està cablejat a App4B (`setVoiceHandler`, main.js:1619-1620), adormit només perquè `voices=[]` — un merge canviaria fase d'àudio reactiu I highlight visual si es reactivés. Riscos d'implementació: invariant 2 (`_syncVoiceList()` obligatori) i capa de DECISIÓ (re-alinear al downbeat vs preservar fase és tria de producte).

- [x] **A-12 · MOTOR · BAIXA** — el comptador de veus polirítmiques usa `if` en lloc de `while`, trencant el patró de 'catch-up' que sí apliquen els polsos i els esdeveniments de cicle
  - **Fitxer:** `libs/sound/timeline-processor.js` (línia 365)
  - **Evidència:** `:339 while (this.pulseCountdownBeats <= 1e-9)` i `:352 while (this.nextCycleIndex < ...)` emeten multi-esdeveniment per sample (anti-deriva); `:365 if (voice.countdownBeats <= 1e-9)` només emet UNA vegada per sample encara que `beatsPerSample` superi `voice.periodBeats`, contradient el propi comentari (363-364).
  - **Fix proposat:** Canviar l'`if` (365) per `while`. **NO és equivalent tal qual:** el while de polsos acumula la constant 1 (sempre progressa), però el de veus acumularia `+= voice.periodBeats`, que pot degenerar a **0** via `_addVoice` (`denominator=Infinity → num/Infinity = 0`) → bucle infinit que penjaria el fil d'àudio. **Cal guarda addicional** (`periodBeats > 0` o sanejament `Number.isFinite` a `_addVoice`).
  - **Veredicte:** CONFIRMADA (reproduïda amb el worklet real: `den=100000, bpm=120` acumula dèficit de 45.249 esdeveniments). Nivell 1. **Severitat baixa correcta / irrealitzable amb producció:** frontera empírica a bpm=150 és `den/num > 17.640`, però App4/App4B clampen `den ≤ 12` (tres ordres de magnitud de marge); la hipòtesi de "rampa agressiva" com a detonant és incorrecta (`_beginTempoRamp` interpola sense overshoot). Es reporta per coherència d'invariant.

## 2.P Rendiment (alt risc)

- [x] **P-03 · RENDIMENT · MITJANA** — `ensureAudio()` crea i tanca un AudioContext d'un sol ús a CADA crida quan Tone no hi és (totes les apps rítmiques): a cada `ready()`, `setBase/setAccent/setStart/setCycle` i `preview()`
  - **Fitxer:** `libs/sound/index.js` (línies 183-196)
  - **Evidència:** `const ctx = new Ctor({ latencyHint: 'interactive', sampleRate: 44100 }); await ctx.close?.();` (187-188) — resultat descartat; `.finally(() => { audioReadyPromise = null; })` (191-193) re-nul·la la promesa → es repeteix a cada crida. `setBase/setAccent/setStart/setCycle` fan `await this.ready()`→`ensureAudio()`; `_ensureContext` surt aviat per `if (this._node)` → el context d'un sol ús és pur malbaratament (spin-up de sessió d'àudio + GC).
  - **Fix proposat:** **Variant run-once (mínim quirúrgic), NO esborrat.** Treure només el re-null del `.finally` perquè el bloc només passi una vegada. **NO esborrar el bloc** (fix primari): és el patró exacte A-17 de "declarar mort" codi d'unlock/priming — pot esbiaixar el backend d'àudio de Firefox (primer context fixa el sample rate de sessió) o consumir el gest d'autoplay-unlock; no falsable des del codi/tests.
  - **Veredicte:** CONFIRMADA (reproduïda: mecanisme sòlid). Nivell 1. **Matisos honestos:** provinença de 522e5cf59 (no b4d735cb, que només va tocar la línia 187 en un escombrat mecànic de pinning); un cop Tone carrega, `ensureAudio` surt abans i el throwaway s'atura (finestra = `ready()` d'init + primeres interaccions dev). Els tests donen falsa confiança (`FakeAudioContext` sense `close`, sampleRate ignorat). El run-once elimina la repetició conservant l'eventual efecte d'init d'una sola vegada.

## 2.H Higiene (alt risc)

- [x] **H-01 · HIGIENE · MITJANA** — `renderGridTimeline()` i ~10 funcions més estan copy-pastejades gairebé byte-a-byte 4 vegades (App32/33/34/35) en comptes de viure a `libs/` — reprodueix el problema que `fraction-timeline.js` (H-15 juny) es va crear per resoldre
  - **Fitxer:** `Apps/App32/main.js` (línies 425-496)
  - **Evidència:** MD5 idèntic als 4 apps per a `handleGridDragMove`, `handleGridDragEnd`, `createGridPreviewBar`, `injectNpDots`, `attachGridDragHandlers`, `updateInfoDisplays`, `calculateCellWidth`, `syncGridScrolls`, `playNotePreview`. `renderGridTimeline()` idèntica App32↔App34 (variant simple) i App33↔App35 (variant complexa). `fraction-timeline.js:1-3` documenta que existeix per això ("H-15: App26-31 duien aquest esquelet copiat ~100 línies per app").
  - **Fix proposat:** Extreure a `libs/plano-modular/` (p.ex. `plano-timeline.js`), parametritzant el que canvia (n fix=1 vs variable). **Protocol de diff complet + prova manual de les 4 apps** (no auto-fix): (1) les funcions tanquen sobre estat de mòdul DIFERENT per app (closure→factory); (2) invariant 3 (`playNotePreview` fa `await initAudio()` dins el drag-end); (3) A-17 literal (`attachGridDragHandlers` crida `injectNpDots()` ABANS del guard `if (gridDelegationAttached) return;`); (4) `renderGridTimeline` pobla `gridIntegerLabels`/`gridFractionLabels` consumits pel highlight de playback; (5) cap test cobreix drag/preview/scroll-sync.
  - **Veredicte:** CONFIRMADA (MD5 verificat). No toca Nivell 1 però "pot trencar un invariant" i no és quirúrgic → alt risc. Direcció correcta (H-15, Dev rule 1) però exigeix protocol de diff complet + revisió adversària + prova manual de les 4 apps.

- [x] **H-15 · HIGIENE · BAIXA** — `configurePerformance({requestedSampleRate})` és una API sense cap caller que trenca el pin de 44100, crea un AudioContext sense esperar el gest d'usuari i abandona el context anterior sense `close()`
  - **Fitxer:** `libs/sound/index.js` (línies 1955-1964)
  - **Evidència:** `if (requestedSampleRate && !this._node) { ... this._ctx = new Ctor({ latencyHint: 'interactive', sampleRate: +requestedSampleRate }); ... }` — cap `waitForUserInteraction()` (viola el gest), qualsevol sampleRate (viola el pin 44100), i `this._ctx` orfe sense `close()` (bug LA-02). Els 4 callers (`performance-audio-menu.js:214/236/251`, `index.test.js:848`) passen només `scheduleHorizonMs`/`sampleOffsetMs`. `performance-audio-menu.js:10-13` documenta que la fila Sample Rate es va eliminar EXPRESSAMENT.
  - **Fix proposat:** Eliminar el paràmetre `requestedSampleRate` i la seva branca (mantenint `scheduleHorizonMs`/`sampleOffsetMs` i el shape del retorn amb `requestedSampleRate: null`). Documentar la retirada a `libs/sound/CLAUDE.md`.
  - **Veredicte:** CONFIRMADA (reproduïda: branca inabastable — `!this._node` + cap caller passa el paràmetre; les 3 classes de bug verificades). Nivell 1 → protocol per REGLA DE TIER (risc procedimental, no conductual). El fix REFORÇA els invariants 4 i del gest; branca genuïnament morta (A-17: `_ensureContext` té 5 call-sites vius més); cap consumidor llegeix `info.requestedSampleRate`.

## 2.T Tests (alt risc)

- [x] **T-01 · TESTS · ALTA** — el mecanisme anti-doble-tret (epsilon 1e-9) del worklet no té cap test dedicat que en verifiqui el comportament de frontera
  - **Fitxer:** `libs/sound/timeline-processor.js` (línia 339)
  - **Evidència:** `:339 while (this.pulseCountdownBeats <= 1e-9)` i `:365 if (voice.countdownBeats <= 1e-9)` són el mecanisme que CLAUDE.md marca com Nivell 1. L'únic test que toca `timeline-processor.js` (`index.test.js:687-770`) assigna `measurePhaseBeats = 5e-10` per provocar un reset de cicle — no exercita `pulseCountdownBeats`/`countdownBeats` ni asseura que un valor just per sota de 1e-9 dispara exactament UN esdeveniment. `grep "timeline-processor|registerProcessor" *.test.js` → només `index.test.js`; `grep "pulseCountdownBeats|countdownBeats" *.test.js` → zero.
  - **Fix proposat:** Test a `index.test.js` (mateix mock `registerProcessor`) que situï els comptadors just per sota/sobre de `1e-9` en successius `process()` i asserti el nombre exacte de missatges 'pulse'/'voice' (0 vs 1, mai 2). **Condicions:** (1) el 2n `import` de `timeline-processor.js` no re-invoca `registerProcessor` (cache ESM) → capturar el ctor un cop o `jest.isolateModulesAsync`; (2) no assertar `time` (NaN a Node); (3) distingir doble-tret del catch-up legítim del `while`; (4) missatge start amb `loop:true`.
  - **Veredicte:** CONFIRMADA (reproduïda: buit de cobertura per tres vies de grep). Nivell 1 però el test és **només-assert** (no toca cap línia del worklet) i REFORÇA l'invariant 1 congelant-lo com a contracte executable. Futures modificacions del worklet motivades pel test sí que exigirien el protocol complet — risc del futur fix, no d'aquest.

---

# 3. DECISIÓ-DOCUMENTAR — 11 troballes

> El fix amaga una tria de producte, o té branques amb semàntica divergent i cap és clarament correcta. Cal **decisió explícita de l'usuari** abans de tocar res. Cap d'aquestes és aplicable automàticament per un agent.

## 3.A Motor (decisió)

- [x] **A-03 · MOTOR · ALTA** — el `RhythmAnalyzer` ignora sempre la tolerància per nivell: llegeix `timingTolerance` però el consumidor escriu `tolerance`
  - **Fitxer:** `libs/audio-capture/rhythm-analysis.js` (línia 204)
  - **Evidència:** `:18 timingTolerance: options.timingTolerance || 200` i `:204 if (... closestDiff <= this.config.timingTolerance)` / `:251 deviation / this.config.timingTolerance`. Però `exercise-runner.js:57 new RhythmAnalyzer({ tolerance: 150 })` i `:224 this.analyzer.config.tolerance = level.tolerance;` — claus diferents: `config.timingTolerance` queda a 200 sempre. Toleràncies per nivell (`exercise-definitions.js:38/47/56/65/148` = 150/150/120/100/100) mai s'apliquen.
  - **Fix proposat:** **NO aplicable tal qual (decisió).** El fix mecànic (`tolerance→timingTolerance`) canvia dificultat/puntuació PERSISTENT (100-150ms mai exercits → corba no validada sobre dades desades via `submitResult→recordAttempt`), deixa App5 igual de trencat (**A-07**), i introdueix fragilitat NaN latent. Solució elegant a la FONT (`RhythmAnalyzer` accepta `tolerance` com a àlies o `compareRhythm` accepta override per crida) cobrint els 2 consumidors + calibrar valors + afegir test abans de tocar puntuacions.
  - **Veredicte:** CONFIRMADA (reproduïda per traça estàtica; cap `*.test.js` referencia `RhythmAnalyzer`). No Nivell 1. **Impacte viu ~0 avui** (el subsistema `ExerciseRunner` és scaffolding dorment: `useLevelsFrom: 'sequence-entry'` no es resol i `runLevel()` llança abans d'arribar a `:224`) però amb falsa confiança — cal resoldre'l com a paquet amb **A-07**/**D-10**.

- [x] **A-06 · MOTOR · MITJANA** — les 5 slides de producció migrades a `P-parallax-lab` (pasos 1,7,11,17,22) perden tota interactivitat sense avís si `window.__parallaxLab` no existeix
  - **Fitxer:** `sistema/js/slides.js` (línia 854)
  - **Evidència:** `else if (slide.layout === 'P-parallax-lab') parallaxCtrl = window.__parallaxLab?.wire(slideEl, slide) ?? null;` — si `__parallaxLab` és undefined (import fallit), `parallaxCtrl` queda `null` en silenci (sense `console.warn`, sense fallback). El keydown global (1211-1212) i el motor lab en depenen. Abans del delta aquestes slides usaven `wireParallax(slideEl)` (853), autocontingut.
  - **Fix proposat:** **Tria de producte.** (a) **només `console.warn`** — quirúrgic, zero risc, aplicable; (b) **fallback a `wireParallax`** — afegeix un punt d'invocació sobre les 5 slides protegides per l'**Invariant 13** ("wireParallax() … NO es toquen") → aprovació humana + invariant actualitzat. La variant (b) té un footgun: `wireParallax` NO retorna el controlador (l'assigna internament a `:758`) → `?? wireParallax(slideEl)` sobreescriuria `parallaxCtrl` amb undefined; només correcte en forma if/else.
  - **Veredicte:** CONFIRMADA. L'escenari només ocorre si `parallax-lab.js`/`parallax-techniques.js` peten al load (`index.html:92-94` ja garanteix l'ordre). Recomanació: aplicar ara la variant warn-only; portar el fallback complet a aprovació humana.

## 3.P Rendiment (decisió)

- [x] **P-04 · RENDIMENT · BAIXA** — `saveFx()` escriu a localStorage (síncron) a cada tick d'esdeveniment 'input' de qualsevol slider del panell
  - **Fitxer:** `sistema/js/parallax-lab.js` (línia 154)
  - **Evidència:** `setConfig` (149-160) fa `saveFx();` incondicionalment, i `parallax-builder.js:78-82` el crida des de l'`input` del range (desenes de cops/segon durant un arrossegament). Cada tick = `JSON.stringify` + `localStorage.setItem` síncrons + re-apply complet (marquee reconstrueix un track de `unitat.repeat(copies)` i reinicia l'animació des de `translateX(0)`).
  - **Fix proposat:** **Variant `persist` amb default `true` (NO "moure la línia").** Afegir paràmetre `persist` a `setConfig` (default true), passar `false` només des de l'`input` del range i `true` des del checkbox on/off. **La primera variant proposada (moure `saveFx` a 'change') és una trampa:** el toggle on/off (`builder.js:90`) depèn del `saveFx()` intern → es perdria al recarregar. `resetConfig`/`aleatori` criden `saveFx()` directament (intactes).
  - **Veredicte:** CONFIRMADA. No Nivell 1; P-26 es conserva (apply en viu intacte). **Decisió + nota de producte:** el fix difereix només l'escriptura a localStorage; el rebuild del marquee i el reset visual a cada tick ROMANEN — si cal coalescir l'apply (rAF) és un canvi més gran que tocaria la semàntica de P-26.

- [x] **P-06 · RENDIMENT · BAIXA** — el compositor de `filter` aplica un filter identitat permanent a totes les capes dels 5 passos intro reals, encara que cap tècnica de filter estigui activa
  - **Fitxer:** `sistema/css/parallax-lab.css` (línia 66)
  - **Evidència:** `.slide--parallax-lab .parallax-layer{ filter: blur(var(--px-bl,0px)) hue-rotate(var(--px-cs-hue,0deg)) saturate(var(--px-cs-sat,1)) brightness(var(--px-cs-bri,1)); }` (i `.parallax-img`, 73-79). Amb defaults el filter és identitat però NO `none` → força stacking context i rasterització per capa. Abans d'a548e091 les capes dels pasos 1/7/11/17/22 no duien cap filter.
  - **Fix proposat:** **Requereix disseny deliberat + test nou + sign-off (no one-liner).** Escopar el compositor a `.px-filter`. **Complicacions:** (1) color-shift NO itera capes (arquitectura per HERÈNCIA des de `slideEl`, `parallax-techniques.js:337-366`) → exigir `.px-filter` la deixaria sense consumidor (no-op silenciós) tret d'enumerar+netejar cada capa; (2) invalida un invariant documentat de mask-zoom (`parallax-lab.css:276-280`, "especificitat 0,3,0 > compositor 0,2,0") → cal doblar també la classe de mask-zoom.
  - **Veredicte:** CONFIRMADA (premissa certa; els 5 passos usen `P-parallax-lab`). Guany real però infra-especificat: canvia el contracte de color-shift de root-only a per-capa amb neteja pròpia (sense cap test que ho guardi). LP-07/invariants 13/14 es mantenen; no és Nivell 1.

## 3.H Higiene (decisió)

- [x] **H-04 · HIGIENE · MITJANA** — la fórmula `Lg/V=T/60` es reimplementa per separat a `subdivision.js`, `formula-solver.js` i `formula-renderer.js` sense cap dels tres reutilitzar els altres com a font de veritat
  - **Fitxer:** `libs/app-common/formula-solver.js` (línia 16)
  - **Evidència:** `subdivision.js:21-22` calcula `interval = 60/tempo; duration = interval * pulses` (sense arrodonir). `formula-solver.js:16 round2(Lg * 60 / V)` (arrodonint). `formula-renderer.js:103-104` ho reimplementa (sense arrodonir, delegant al formatter). Cap dels tres importa cap dels altres.
  - **Fix proposat:** **NO és un fix quirúrgic (decisió d'arquitectura).** Són tres POLÍTIQUES per capa, cadascuna load-bearing: el solver arrodoneix expressament (s'escriu de tornada als inputs d'App1; tests ho asserten `{key:'T', value:4.29}`); el renderer NO arrodoneix a propòsit (formatters intercanviables) i necessita els components intermedis; `subdivision.fromLgAndTempo` cobreix 1 de ~5 direccions i valida diferent. **Recomanació: documentar la capa** (`libs/app-common/CLAUDE.md`) en lloc d'unificar. Si l'usuari tria unificar → alt risc (`subdivision.js` és Nivell 1) amb diff complet.
  - **Veredicte:** CONFIRMADA. `formula-solver.js:6` documenta `@dep cap (aritmètica pura)` — afegir-hi un import contradiu el contracte del propi mòdul. La "font única de veritat" no s'assoleix sense tocar Nivell 1 o crear una quarta implementació.

- [x] **H-08 · HIGIENE · BAIXA** — App2/App4B/App5 instancien `createRhythmLEDManagers(leds)` i mai l'utilitzen — `leds` sempre buit perquè les 3 apps amaguen els LEDs
  - **Fitxer:** `libs/app-common/led-manager.js` (línia 90)
  - **Evidència:** `App2/main.js:68`, `App4B/main.js:83`, `App5/main.js:60` fan `const ledManagers = createRhythmLEDManagers(leds);` però cap crida posterior a `ledManagers.*` ni `syncLEDsWithInputs` existeix (grep buit). Coincideix amb `renderApp({ hideLeds: true })` (App2/App5) i `document.querySelectorAll('.led').forEach(el => el.remove())` (App4B) → `leds` és sempre `{}`.
  - **Fix proposat:** **Tria de producte parcial.** Eliminar la línia + l'import a App2/App5 (quirúrgic, segur) actualitzant `App2/CLAUDE.md` (que llista `led-manager.js` i documenta el flux). **Deixar App4B intacta:** el seu CLAUDE.md la declara "congelada... es conserva intacta com a referència" respecte a16e224 — netejar-hi codi mort trenca el contracte documentat.
  - **Veredicte:** CONFIRMADA. Codi realment inert (constructor només assigna camps; A-17 comprovat). No Nivell 1. Recomanació: aplicar a App2/App5, deixar App4B (o documentar-hi una línia de divergència) segons decideixi l'usuari. App1B també importa `led-manager.js` però queda fora (l'usa).

- [x] **H-11 · HIGIENE · BAIXA** — `wireParallax()` i la branca de layout `'P-parallax'` han quedat inabastables (dead code) després de migrar les 5 slides que l'usaven
  - **Fitxer:** `sistema/js/slides.js` (línia 617)
  - **Evidència:** `function wireParallax(slideEl){` (617, ~143 línies) i les branques `if (slide.layout === 'P-parallax')` (818, 853) no es poden disparar: `grep "layout:'[^']+'" slide-data.js` confirma que cap entrada usa `layout:'P-parallax'` (van passar a `'P-parallax-lab'` al commit a548e091). El missatge del commit ho reconeix però el codi no ho marca.
  - **Fix proposat:** **Tria de l'usuari (cap opció auto-aplicable).** (a) deixar-ho tal qual (ja documentat fora del codi: `parallax-lab.js:7/23/208/243`, acta 2026-07-04); (b) afegir comentari "DEAD CODE intencional" acceptant una excepció puntual a la lletra de l'**Invariant 13** ("wireParallax() … NO es toquen"); (c) actualitzar primer l'invariant. Esborrar el codi violaria directament l'Invariant 13.
  - **Veredicte:** CONFIRMADA. **Abast (A-17):** NOMÉS la funció i les 2 branques són mortes — `renderParallax()` (587), `paralaxCtrl` (854, consumit pel keydown 1211-1212) i `parallax.css` (la branca viva afegeix `slide--parallax`, 831) segueixen vius; qualsevol esborrat "de neteja" tocaria coses vives.

- [x] **H-14 · HIGIENE · BAIXA** — el bloc CSS del spinner half-pill del fraction-editor és byte-idèntic (69 línies) entre App32/33/34/35 — el patró que H-17 va consolidar a `fraction-editor-nuzic.css`, però cap de les 4 apps l'enllaça
  - **Fitxer:** `Apps/App32/styles.css` (línies 224-292)
  - **Evidència:** mateix md5 (`162da52d...`) a App32:224-292, App33:245-313, App34:224-292, App35:245-313. Cap dels 4 `index.html` enllaça `libs/app-common/fraction-editor-nuzic.css`. Diferència amb el bloc consolidat: `font-size: 0.8rem` (lib) vs `clamp(0.65rem, 1.2vw, 0.8rem)` (App32-35).
  - **Fix proposat:** **NO és el dedup zero-risc declarat (decisió + verificació visual).** El pas d'actualitzar `fraction-editor-nuzic.css:56` a `clamp(...)` **PROPAGA a App26-31** (que hereten el font-size només de la lib, sense override local): `clamp(0.65rem,1.2vw,0.8rem)` només val 0.8rem quan viewport ≥ ~1067px; per sota (tauleta/mòbil) el glif "+"/"−" s'encongeix a 0.65rem — canvia la mida a 6 apps publicades en mòbil (repo mobile-first). Alternativa elegant: deixar la lib a `0.8rem` i posar l'override d'una línia al styles.css local d'App32-35.
  - **Veredicte:** CONFIRMADA (md5 verificat). Cap fitxer Nivell 1/2 però modifica la sortida visual de 6 apps via la lib + injecta 2 blocs extra (endcaps/franja) amb innocuïtat contingent a `.timeline-wrapper{display:none}`. Mereix verificació visual d'App26-31 en mòbil, no la etiqueta "zero-risc".

## 3.T Tests (decisió)

- [x] **T-03 · TESTS · MITJANA** — l'`EPSILON` declarat per a `subdivision.js` no s'usa enlloc de la lògica ni té cap test de fracció extrema que en justifiqui l'existència
  - **Fitxer:** `libs/app-common/subdivision.js` (línia 1)
  - **Evidència:** `const EPSILON = 1e-9;` (1) només s'exporta a `__testing__` (106) però mai s'usa dins `gridFromOrigin` (52-85), on `position = cycleStart + subdivisionIndex * step` (74) no es compara mai amb epsilon. El test només prova el cas exacte `{lg:12, 3/2}`. `git log -S "EPSILON"` → un sol commit (34fc23f6, extracció); va néixer sense ús copiant el patró d'`audio-schedule.js` (on `DEFAULT_EPSILON` sí s'usa).
  - **Fix proposat:** **Disjuntiva (decisió de disseny, no bug).** (a) eliminar l'`EPSILON` mort de `__testing__` — **toca Nivell 1** → protocol diff complet (tot i ser inert); o (b) afegir un comentari que digui que la tolerància real viu aigües avall (`FRACTION_POSITION_EPSILON=1e-6` a `pulse-selectability.js:10`; `WHOLE_PULSE_EPSILON` a `rhythm-staff.js`). La branca "test amb denominador gran" no justifica l'epsilon (gridFromOrigin no compara posicions amb cap llindar).
  - **Veredicte:** CONFIRMADA (reproduïda: zero consumidors externs de `__testing__` a tot el repo; `position` no acumula `+=`, error acotat). Nivell 1. No hi ha comportament en risc mentre no es decideixi; cal decidir explícitament i documentar-ho.

- [ ] **T-04 · TESTS · MITJANA** *(APARCADA per decisió 2026-07-09: lligada a A-03, que es deixa documentat com a pendent — re-obrir juntes)* — `libs/audio-capture` i `libs/ear-training` no tenen cap fitxer de test malgrat implementar la matemàtica de scoring real consumida per App5
  - **Fitxer:** `libs/audio-capture/rhythm-analysis.js` (línia 1)
  - **Evidència:** `find libs/audio-capture -iname '*test*'` i `find libs/ear-training -iname '*test*'` → res. `keyboard.js`, `microphone.js`, `rhythm-analysis.js`, `exercise-runner.js`... contenen tota la lògica de captura/timing/scoring i s'importen des de `App5/game/game-manager.js`. El bug **A-03** és el tipus d'error que un test unitari bàsic hauria atrapat.
  - **Fix proposat:** **Separar dues meitats de perfil oposat (decisió).** La meitat SEGURA (unitari pur de `RhythmAnalyzer`, importat del leaf) passa contra el codi actual **però NO atrapa A-03** (el bug viu al consumidor). La meitat que SÍ el cobreix (test de l'override per nivell) **no pot ser verda avui** (falla contra `exercise-runner.js:224`) → deixaria `npm test` en vermell (viola regla #4) i acobla el test a una edició de PRODUCCIÓ Nivell 2. Camí net: aplicar el test de consumidor JUNT amb el fix **A-03** (`tolerance→timingTolerance`), importar a nivell de leaf (evitar el barrel `index.js` que arrossega `microphone.js`→`tone-loader.js`).
  - **Veredicte:** CONFIRMADA (cobertura zero verificada per grep). No Nivell 1 en si, però un test fidel toca Nivell 1 en runtime (`runRhythmSync` fa `import('../sound/index.js')` + `init()`). Trampa A-17: assertar el comportament ACTUAL cementaria el bug com a intencionat.

## 3.D Docs (decisió)

- [x] **D-10 · DOCS · BAIXA** — els llindars de joc documentats d'App5 (tolerància 300ms, pass 40%/success 60%) no coincideixen amb el codi actual
  - **Fitxer:** `Apps/App5/CLAUDE.md` (línia 21)
  - **Evidència:** `CLAUDE.md:21 "Tolerance: 300ms, pass threshold: 40%, success: 60%."` Però la tolerància efectiva és 200ms (vegeu **A-07**), i l'únic gate és `game-manager.js:1012 const success = accuracy >= 50;` (replicat a `game-state.js:139/157/181`); cap 40%/60% enlloc (grep buit).
  - **Fix proposat:** **Resoldre com a paquet únic amb A-07 (decisió).** El fix és disjuntiu (documentar 200ms/50% ARA vs corregir primer el codi) i depèn de la resolució d'**A-07**: el comentari `game-manager.js:921 "// 300ms tolerance (opción permisiva)"` mostra que l'intent era 300ms; documentar 200ms avui recrearia el desajust si A-07 es fixa restaurant el 300ms. Cal decidir 200 o 300ms; 50% o 40/60%; i actualitzar `CLAUDE.md:21` al mateix commit que el codi.
  - **Veredicte:** CONFIRMADA. No toca fitxers Nivell 1/2. Un CLAUDE.md local és font d'instruccions per a agents futurs — escriure-hi un valor que pot canviar en dies propaga informació falsa.

---

# Apèndix A — Troballes refutades (4)

Troballes detectades pels auditors que NO van sobreviure la verificació adversària. Es documenten perquè no es tornin a reportar.

- **~~RF-1 · `sistema/css/parallax-lab.css`~~** — "Amb Fondo=app + spotlight simultanis, l'app a pantalla completa tapa el vel de 'Foco', trencant la garantia 'sempre pinta a sobre'."
  - **Motiu:** Malinterpretació de la documentació. La garantia real és ESCOPADA — `docs/parallax-lab-manual.md:326` diu "Foco sempre pinta a sobre de **Marquesina i Gradiente viajero**", i aquests dos overlays són fills de `.parallax-bg` on el vel `.px-sp` (z-index:1) segueix guanyant. L'apilament app-sobre-fons és disseny deliberat documentat a la mateixa regla (`parallax-lab.css:410-412`, commit 487987fc); "la protagonista sempre nítida" és precedent (manual L.319-320). El fix proposat (`z-index:-1`) enfonsaria l'app sota el fons del slide. Com a molt, una línia addicional al manual §6.

- **~~RF-2 · `libs/app-common/audio-schedule.js`~~** — "`computeResyncDelay` no té cap test que cobreixi el cas frontera `stepIndex === totalPulses`."
  - **Motiu:** Artefacte de lectura parcial: l'auditor va llegir `tap-resync.test.js` i va ometre la suite germana `libs/app-common/__tests__/audio-schedule.test.js`, que cobreix exactament el punt de decisió. El límit `delta <= epsilon` (`audio-schedule.js:25`) està testat a `audio-schedule.test.js:25-30` ('handles exact multiples'); el wrap modular amb `eventTime===total` a `tap-resync.test.js:5-8`. A més el cas és inabastable des dels 2 callers de producció (`stepIndex` ve de `getVisualState().step`, wrap `currentStep %= totalBeats` → 0..Lg-1). La frase literal és certa però el risc que la justifica és fals.

- **~~RF-3 · `Apps/App20/main.js`~~** — "ENTER/Tab a l'editor zigzag N/iT descarta silenciosament valors invàlids (sense tooltip), regressió respecte al codi anterior."
  - **Motiu:** Malinterpretació del flux. L'event `input` (que dispara per cada pulsació, ABANS de l'ENTER) ja neteja la cel·la en els casos que mostren tooltip, així que aquests valors mai arriben vius al handler keydown (NrR invàlid → `e.target.value = ''` a 996-1000; iT fora de límits → tooltip + clear a 1022-1031). L'únic valor que sobreviu no-buit (número de nota fora 0-11) és SILENCIÓS en ambdós camins (`parseNoteInput` retorna null → return silenciós a 976-977) i també ho era amb el `dispatchEvent('input')` antic. El commit f895404c va INTRODUIR aquest handler per ARREGLAR una regressió real. No existeix cap entrada on l'ENTER suprimeixi un tooltip que 'input' sí mostraria.

- **~~RF-4 · `Apps/App29/main.js`~~** — "`isIntegerPulseSelectable()` es crida amb `numerator===lg` a App29/App31: cap pols enter interior és mai seleccionable/arrossegable."
  - **Motiu:** La matemàtica és certa però el marc de "bug de motor" és fals: és el disseny DOCUMENTAT de les apps de "fraccions complexes", documentat en 5 llocs independents (App29/main.js:3, 618-619, 348-353; App31/main.js:578-579; `docs/session-history/2026-01-13-app28-app29-pulse-seq.md:56`). App28 (SIMPLES, `FIXED_NUMERATOR=1`) és el model `lg*d` amb tots els enters seleccionables; App29 (COMPLEJOS, `Lg=numerador`, "1 cicle") és a propòsit l'altre model: en una fracció complexa `n/d` la graella fraccionada no coincideix amb els enters (excepte extrems, `gcd(n,d)=1`). La comparació amb App27 és una premissa falsa (App27 NO té selecció de polsos). Model internament consistent d'extrem a extrem; no s'ha de tocar res.

---

# Apèndix B — Nota metodològica

**Detecció.** 18 auditors Sonnet en paral·lel, cadascun amb un charter de fitxers/zona assignat, escanejant NOMÉS el delta `040f019d..HEAD` (133 commits) i les zones noves des del juny (Parallax Lab: `parallax-techniques.js`/`parallax-lab.js`/`parallax-builder.js`/`parallax-lab.css`; Màscara zoom Fondo=app; App32-35; redisseny d'anells d'App4 amb `circular-rings.js`; mòduls `app-common` nous: `formula-solver.js`, `polyrhythm-info.js`, `circular-timeline-ring.js`, `transport-live-update.js`, `play-loading.js`; docs graphify). Cada auditor obligat a aportar `file:line` + cita literal per afirmació.

**Verificació adversària.** Cada troballa bruta va passar per un verificador independent amb mandat adversari (intentar REFUTAR-la, no confirmar-la), amb reproducció executable quan era factible (harnesses jsdom/node sobre el mòdul REAL, no mocks sintètics — evitant l'amplificació LH-20). Es va fer en tandes: la major part amb **Fable**, i, **per exhauriment de la cua, amb Opus 4.8 a esforç màxim al tram final** (les troballes de Nivell 1 de `libs/sound/index.js` i del worklet, que exigien traça dels dos fils i harnesses de reproducció). El nivell de risc es va decidir amb l'usuari i és VINCULANT (no re-decidit pels agents).

**Resultat.** 64 brutes → 60 confirmades + 4 refutades → 59 distintes (una duplicada). Cap troballa amb veredicte PLAUSIBLE va sobreviure; totes les 59 són CONFIRMADA. Es va respectar el READ-ONLY estricte: cap Edit/Write a fitxers del repo (aquest informe és l'única sortida). La suite de referència (78/1397) es va executar per verificar (no muta el repo); cap troballa la trenca en l'estat actual — els tests de regressió proposats (**T-02** per a **A-02**, i el test de consumidor de **T-04** per a **A-03**) FALLARIEN a propòsit contra el codi actual i han d'aterrar junt amb els seus fixos respectius.

**Nivells de risc (recordatori vinculant).** Nivell 1 (cap fix automàtic): `timeline-processor.js`, `subdivision.js`, `audio-schedule.js`, `libs/sound/index.js`. Nivell 2 (revisió del diff + suite): cadena init/gate (`audio-init.js`, `user-interaction.js`, `tone-loader.js`), timing viu (`loop-control.js`, `transport-live-update.js`, `visual-sync.js`), massius per fan-in (`template.js`, `preferences.js`, `mixer-menu.js`). Invariants 1-15 de l'acta 2026-06-11: violar-los = regressió.
