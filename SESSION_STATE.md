# SESSION_STATE

## Tasca activa: Sistema Interactivo — esquelet i mides d'iframe

Inici: 2026-04-27. Document de referència: `docs/APPS-ADAPTACIONS-IFRAME.md`,
`docs/SISTEMA-INTERACTIVO-PLAN.md`.

### Decisió de fons (acordada amb l'usuari)

- **Scroll global de pàgina** (com proposava el dissenyador): es treu la regla
  "1 slide = 1 viewport". El `.prose` deixa de tenir scroll propi; tota la
  pàgina scrolla. Es manté en pasos d'`A-intro` i en tots.
- **Tipografia única**: tot el text en Ubuntu (cau Krub).
- **Nav inferior responsive**: `clamp()` per botons, paddings, alçada.
- **Mides per app**: dues famílies estructurals identificades en l'auditoria
  (`Agent Explore`, 2026-04-27):
  - **Família A — "bloc cohesiu"** (15 apps): timeline-only, soundline-only,
    circular, registro, scale apps. Tots els elements escalen junts via
    `clamp()`. → `fit: 'lock'` (manté `aspect-ratio` rígid).
  - **Família B — "zones independents"** (10 apps): plano, plano+editor,
    plano-modular, fraction editors. Header de params + cos central + controls
    són zones amb mínims propis. → `fit: 'fluid'` (omple slot al 100%, ratio
    només és hint mínim).
  - Els `aspect` actuals a `slide-data.js` ja són correctes; cap distorsió.
  - Els `minW`/`minH` per app es mesuraran **post-flex-wrap** (la 1a tasca
    canvia els mínims naturals).

### Pla concret (en aquest ordre)

1. **`flex-wrap` a `.inputs` i `.controls` nuzic** ✅ FET (commit pendent)
   - Afegit `flex-wrap: wrap` + `row-gap` responsive a `.inputs` i
     `.controls:not([data-layout])` (no tocat `column-gap` per respectar
     App19/20 amb gap propi).
   - Beneficia Família B (App12, App19, App34) — el header de pills pot
     saltar a una segona fila enlloc d'aixafar-se.
   - Tests: 1445/1445 OK.
2. **Soundline numbers amb container queries** ✅ FET (commit pendent)
   - Trobat post-flex-wrap: els números soundline (App14, App20) sobresurten
     del marc rosa quan la finestra s'estreny. Causa: `clamp()` lligat a
     `vw`, no a l'amplada real del marc.
   - Solució: `container-type: inline-size` als marcs (`.grid-container
     .soundline-wrapper`, `.plano-soundline-container`, `.soundline-container
     .soundline`) + `font-size: clamp(min, Ncqw, max)` als descendents
     (`.soundline-number`, `.plano-soundline-note`).
   - Aplicat a `libs/shared-ui/nuzic-theme.css`.
3. **Layout vertical robust (Fase 14)** ❌ REVERTIT (commit no fet)
   - Intent: regla genèrica `#app-root > main > .timeline-wrapper:not(.circular)`
     amb flex-column + overflow:hidden per resoldre controls fora de viewport.
   - **Va trencar moltes apps**: App17 (cercle desplaçat per canvis al
     centratge del wrapper amb `<main>` flex-column), App18 (soundline
     comprimida), App19/App20 (superposició de timeline i soundline), apps
     fraccions (App26-30, timeline desapareix).
   - **Lliçó**: el problema dels controls fora de viewport és **per-app**
     i té causes diferents (App16: min-height 25rem, App18: layout propi,
     App17: posicionament absolute calculat per JS). NO és solucionable amb
     una regla genèrica. Es resoldrà al pas 7 (Sistema) via `minW`/`minH`
     per slot que disparen breakpoint vertical.
   - També revertit: `container-type: inline-size` al `.plano-soundline-container`
     — trencava el grid-layout intern d'App19/App20 (timeline supersposada
     a soundline). El comentari de prevenció queda al fitxer.
4. **Soundline numbers — totes les iteracions de min/max revertides** ❌
   - Es van provar múltiples estratègies (min-height global, max-height a
     app10, container-type size + cqh, override a App18) i totes van
     produir resultats visualment "ridículs" segons l'usuari.
   - **Estat final**: tornat als valors originals d'app10/App14/App18
     (`width: 60px / 3.75rem`, `height: 100%`, sense min/max-height).
   - **Mantingut**: clamp del font conservador a `.soundline-container
     .soundline-number` (`clamp(0.85rem, 1.4vw, 1.15rem)`) que evita
     desbordament de text + dashes en finestres estretes. NO es pot usar
     `container-type` als marcs (trenca containing block dels números
     absoluts) — comentari ⚠️ documenta-ho.
   - **Decisió diferida**: el problema de la diferència de mida del rosa
     entre app10/App14/App18 ha de resoldre's al pas 10 (Sistema), no via
     nuzic-theme. Els overrides individuals per-app amb mides fluides
     no van produir resultats coherents en pantalles diverses.
5. **App17 pulse-numbers — JS recalcula al resize** ✅ FET
   - **Diagnòstic real**: el CSS no tenia efecte perquè
     `Apps/App17/main.js:305` fa `el.style.setProperty('font-size',
     '${fontPx}px', 'important')` — l'inline style amb !important sempre
     guanya. El JS calcula `fontPx` només al primer render i no recalcula
     mai → font es queda al valor inicial encara que el cercle s'encongeixi.
   - **Solució aplicada**:
     a. Reduït floor de `fontPx` de 11 a 9 (`Math.max(9, ...)`) — permet
        que el font baixi més en cercles petits.
     b. Afegit `ResizeObserver` al `timeline` (`Apps/App17/main.js`) que
        crida `renderPulseNumbers()` quan la mida del cercle canvia. Cobreix
        també el bug de posicionament desfasat al resize.
   - Revertit el `container-type` al `.timeline-wrapper.circular` i el
     `cqw` al `.pulse-number` (eren inútils — el JS els sobreescrivia).
     Ara el CSS només estilitza padding/border-radius; tota la mètrica
     (posició, font, ticks) ve del JS.
6. **App19/App20 — timeline supersposant graella en pantalles petites** ⚠️ DEFERIT
   - Fix antic vigent (commit `a76ba11`): `.plano-grid-area` amb grid
     intern `1fr auto`, `max-height: calc(visible-rows × cell-height -
     timeline-height - cell/2)`. Funciona en pantalles normals.
   - Amb el `flex-wrap` als `.inputs` (canvi 1), el header creix vertical-
     ment i comprimeix el plano per sota del max-height calculat → la
     timeline puja a la graella.
   - **Resolució prevista al pas 8** (Sistema): `minH` per app dispara el
     breakpoint vertical abans que arribi al cas de superposició. En
     standalone, opcional fer scroll global quan la finestra no compleix
     el mínim.
7. **Tipografia Ubuntu a tot el text del Sistema** ✅ FET
   - `sistema/css/tokens.css`: `--font-body` passa de Krub a Ubuntu (com
     `--font-display`). Tot el text del Sistema usa la mateixa font ara.
8. **Nav inferior responsive** ✅ FET
   - `sistema/css/nav.css`: convertits a `clamp()` els valors fixos:
     - `.sistema-nav__progress` padding superior: `clamp(8px, 1.2vh, 12px)`.
     - `.sistema-nav__progress-track` gap+height: `clamp(2px, 0.4vw, 4px)` /
       `clamp(3px, 0.5vh, 5px)`.
     - `.sistema-nav__bar` padding+gap: `clamp(8px, 1.2vh, 12px)` /
       `clamp(12px, 2vw, var(--sp-3))`.
     - `.sistema-nav__btn` width/height: `clamp(36px, 4vw, 44px)`.
     - `.sistema-nav__btn svg` size: `clamp(14px, 1.5vw, 18px)`.
     - `.sistema-nav__title` gap: `clamp(6px, 1vw, 10px)`.
9. **Mesura minW/minH per app (post-wrap)** ✅ FET (agent + validació usuari)
   - Timeline-only senzill (app9/13/26/28/30): 340 × 320.
   - Timeline curt vertical (app10/App18): 320 × 420.
   - Timeline complex (App14/App16): 380 × 400.
   - Plano simple (app11/A, App12, App15, App32, App34, App35): 420 × 380.
   - Plano amb molts pills (App19/App20): 450 × 380.
   - Scale apps (App21–25B): **480 × 512** (validat visualment per usuari).
   - Circular (App17): 380 × 380.
10. **Simplificació arquitectural — vertical fallback per CSS pur** ✅ FET (2026-04-27)
    - **Diagnòstic**: el bug del Pas 4 (espai lila enorme buit en pantalla
      ampla) venia d'un mismatch entre la predicció JS de l'alçada del slot
      i el CSS `clamp(180px, 32vh, 340px)` que capava la fila a 340px.
      L'arquitectura tenia 3 capes redundants (taula `groupMinSize`, taula
      `layoutAppWidthFraction`, listener de `resize` amb matemàtica de
      predicció) que intentaven endevinar el que el CSS faria.
    - **Decisió**: l'iframe ja "protegeix" cada app internament (cada app té
      el seu propi `clamp()`/responsive); el Sistema només necessita decidir
      horitzontal vs vertical segons l'amplada del viewport. Una sola media
      query basta.
    - **Canvis aplicats**:
      a. `slide-data.js`: layout `E-app-text-left` rows passa de
         `'auto 1fr clamp(180px, 32vh, 340px)'` a `'auto 2fr 1fr'` —
         manté la jerarquia text > app sense cap rígid.
      b. `slide-data.js`: eliminada taula `groupMinSize` (~20 línies) i
         comentaris associats. El camp `group:` queda als entries com a
         metadada descriptiva.
      c. `slides.js`: eliminades funció `applyVerticalBreakpoint`, taula
         `layoutAppWidthFraction`, listener de `window.resize` i la
         crida a `applyVerticalBreakpoint()` des de `render()`. ~70
         línies fora.
      d. `grid.css`: regla `.slide[data-vertical="true"]` substituïda per
         `@media (max-width: 900px)` que aplica el grid vertical
         (title → image → app → text → tips). El safety net @480px queda
         només per al `padding-bottom` extra.
      e. `slides.css`: eliminada regla `.slide[data-vertical="true"]
         .slot-text .prose { column-count: 1 }` — coberta per la media
         query.
    - Tests: 1445/1445 OK.

11. **Refinament breakpoint + estructura E-app-text-left** ✅ FET (2026-04-27)
    - **Breakpoint final**: `@media (max-width: 900px)`. Tornat a la
      proposta original després d'haver provat `max-width: 600px,
      max-height: 500px` (per mantenir iPad mini portrait en horitzontal).
      L'intent va causar problemes a viewports mitjans (600-1000px) on el
      grid horitzontal quedava massa apretat: soundline d'app10 desplaçat,
      controls d'app9 tallats, plano apps comprimits. **Decisió**: és més
      net que iPad mini portrait (744 wide) col·lapsi a vertical que no
      pas mantenir un horitzontal cramped.
    - **Layout E-app-text-left**: `areas` passa de
      `'... "app app tips"'` a `'... "app app app"'` i `rows` de
      `'auto 2fr 1fr'` a `'auto 1fr auto'`. El timeline (App9) ara ocupa
      tota l'amplada de la fila inferior — coherent amb el disseny PDF.
    - **Tips ancorat dalt**: regla específica per a aquest layout
      (`.slide[data-layout="E-app-text-left"] .slot-tips { align-self:
      start }`) — la caixa verda queda a dalt-dreta com al PDF, no a baix.
    - Tests: 1445/1445 OK.

12. **App9 controls tallats + App10 descentrada** ✅ FET (2026-04-27)
    - **App9 (Pas 4 vertical)**: a viewport &lt;416px l'iframe quedava a
      ~195px d'alt (aspect 2/1 × 391px) i els controls de baix (BPM +
      play) sortien tallats per `overflow:hidden` del mode embed. Fix:
      `.iframe-frame { min-height: 320px }` dins la media query vertical
      a `sistema/css/grid.css`. Aspect-ratio cedeix davant min-height →
      iframe creix verticalment fins a encabir tots els controls. Els
      apps amb aspect alt (app10 2/3, scale 3/2) ja superen 320px per la
      seva ràtio, no es veuen afectats.
    - **App10 (Pas 5)**: el `.note-highlight` tenia `left: 100%` →
      apareixia a la dreta del soundline durant la reproducció. La
      hipòtesi inicial (descentratge causat pel highlight) va resultar
      ser incorrecta — el highlight s'ha mantingut al disseny original
      a `Apps/app10/styles.css` (`left: 100%`). El descentratge real
      té una causa diferent (vegeu pas 13).
    - **Iframe stretching** als plano apps (pasos 3, 6, 7): `.iframe-frame
      { max-height: 700px }` a `sistema/css/slides.css` evita
      que apps de plànol s'estirin a pantalles grans. Plànol queda a
      ~933×700, scale ~1050×700, timeline ~1400×700, vertical ~467×700.
    - Tests: 1445/1445 OK.

13. **Slide content-driven + iframe sense flex grow** ✅ FET (2026-04-28)
    - **Bug 1 (Pas 4/5/altres)**: a viewports grans, el rectangle verd
      de tips quedava lluny del text amb gran espai buit al mig. Causa:
      `.slide-stage { min-height: calc(100vh - var(--nav-h)) }` + `.slide
      { flex: 1 }` forçaven el slide a omplir 100vh, i la fila `1fr`
      del text expandia l'espai buit quan el contingut era curt.
    - **Bug 2 (Pas 5)**: la soundline d'app10 quedava desplaçada a la
      dreta dins l'iframe a viewports intermedis (900-1100px). Causa:
      `.iframe-frame { flex: 1 }` competia amb `aspect-ratio: 2/3` +
      `max-height: 700px` produint un sizing no-determinista.
    - **Fixes a `sistema/css/grid.css`**:
      a. `.slide-stage`: eliminat `min-height: calc(100vh - var(--nav-h))`
         → l'stage és content-driven, la pàgina scrolla naturalment si
         cal.
      b. `.slide`: eliminat `flex: 1` → el slide ja no s'estira; les
         files `1fr` es comporten com `auto` quan no hi ha excés
         d'espai vertical a distribuir.
    - **Fixes a `sistema/css/slides.css`**:
      c. `.iframe-frame`: eliminats `flex: 1` i `min-height: 0`. El
         sizing ara és determinista: `width: 100% + aspect-ratio +
         max-height: 700px`.
      d. `margin: 0 auto` → `margin: auto` → centrat horitzontal **i**
         vertical al slot.
    - **Shift progressiu app10 a `libs/app-common/embed.css`** (a
      petició de l'usuari):
      `body.app10 main { padding-right: clamp(0px, calc(350px - 100vw),
      80px) }`. A iframes ≥ 350px wide: cap shift. A iframes &lt; 350px:
      shift creix linealment fins a 80px màx (= 40px d'efecte sobre el
      centre del soundline). Compensa la sensació de desplaçament dret
      causada pel `.note-highlight` extenent-se 80px a la dreta + el
      `.start-overlay` text wrapping left-aligned.
    - Tests: 1445/1445 OK.

14. **App19/App20 — timeline separada de la primera fila visible** ✅ FET (2026-04-28)
    - **Bug recurrent**: la timeline (banda groga amb números 0,1,2,3) es
      superposa visualment a les primeres files (les més baixes, 0r3, 1r3)
      del plano matrix a App19/App20, en qualsevol viewport.
    - **Investigacions amb agents** (3 agents en paral·lel):
      - Agent A: el `display: contents` provat anteriorment podria no
        aplicar-se per cascada/specificity vs el base `display: flex` de
        plano-modular.
      - Agent B: els pseudo-elements `.plano-cell::before` i `::after`
        amb `bottom: -50%` extenen visualment 13px sota cada cel·la. Per
        a la fila inferior, aquests pseudo-elements podrien sortir del
        matrix-container i superposar-se a la timeline.
      - Agent C: App12 (musical-grid, funciona) té timeline com a sibling
        directe de matrix dins un grid pare amb `1fr 50px auto`. App19
        (plano-modular, falla) tenia timeline atrapat dins `.plano-grid-area`
        que ocupava ambdues files.
    - **Canvis previs aplicats** (no van resoldre completament el bug):
      a. `libs/plano-modular/plano-grid.js`: canviada la DOM perquè la
         `timelineContainer` sigui fill directe de `.plano-container`
         (sibling de `.plano-grid-area`), no fill atrapat dins.
      b. `libs/plano-modular/plano-modular.css`:
         - `.plano-grid-area`: `grid-row: 1 / 3` → `grid-row: 1` (només
           ocupa fila 1, la timeline ja no és fill seu).
         - `.plano-timeline-container`: afegit `grid-column: 2; grid-row: 2`
           perquè es col·loqui directament al grid pare.
         - `.plano-soundline-container`: span `grid-row: 1 / 3` per cobrir
           el "floor cell" rosa sota l'última nota; eliminat `max-height`.
           **Això era la causa restant**: el càlcul JS de scroll usa
           `.plano-soundline-container.clientHeight`, de manera que comptava
           la banda de timeline com a alçada visible i permetia que `0r3`
           quedés dins la franja groga.
         - `.plano-matrix-container`: eliminat `max-height: calc(...)`
           legacy que no s'adaptava al flex-wrap del header.
      c. `Apps/App19/styles.css`, `Apps/App20/styles.css`: netejats els
         overrides redundants. Només queda `.plano-timeline-container
         { z-index: 2 }` (App19/App20). App20 queda amb
         `margin-bottom: 0rem`.
      d. `libs/plano-modular/__tests__/plano-grid.test.js`: actualitzat
         per esperar la nova jerarquia (timeline com a sibling de gridArea).
    - **Solució final aplicada**:
      a. `libs/plano-modular/plano-modular.css`: `.plano-soundline-container`
         torna a `grid-row: 1` perquè la seva alçada coincideixi amb la
         matriu, i el "floor cell" visual passa a `.plano-container::before`
         a `grid-column: 1; grid-row: 2`.
      b. `libs/plano-modular/plano-modular.css`: afegit
         `--plano-soundline-bg` perquè la soundline i el floor cell
         comparteixin color sense barrejar layout i scroll.
      c. `libs/shared-ui/nuzic-theme.css`: `--plano-soundline-bg:
         var(--nuzic-pink-light)` dins el tema Nuzic.
      d. Comentaris d'App19/App20 actualitzats per reflectir que la
         soundline, matrix i timeline són zones separades.
    - Tests: directes plano-modular 89/89 OK; suite completa 1445/1445 OK
      (Jest queda obert per handles async coneguts i s'ha aturat el procés
      després de veure el resultat complet).

15. **Neteja workarounds superflus al sistema** ✅ FET (2026-04-28)
    - **Revertit**:
      a. `libs/app-common/embed.css`: eliminat `align-self: center` extra
         que s'havia afegit a `.timeline-wrapper` per app10/app18 — era
         redundant amb el `margin: 0 auto` ja existent.
      b. `Apps/app10/styles.css`: eliminat `align-self: center` afegit
         a `.timeline-wrapper` — mateix motiu.
      c. `sistema/css/slides.css`: eliminada la regla específica
         `.slide[data-layout="D-app-narrow"] .iframe-frame { margin: auto }`.
         Tots els layouts comparteixen ara `margin: 0 auto` (centrat
         horizontal, top-aligned al slot). Esquelet més uniforme.
    - **Mantingut a petició explícita de l'usuari** ("ens ha costat molt
      que no es descentrés app10"):
      `libs/app-common/embed.css`: `body.app10 main { padding-right:
      clamp(0px, calc(350px - 100vw), 80px) }` per al centratge
      progressiu del soundline a viewports estrets.
    - Tests: 1445/1445 OK.

16. **E-app-text-left — alineació caixa tips amb h1** ✅ FET (2026-04-29)
    - **Bug**: a pasos 3, 8, 12 (layout `E-app-text-left`) la caixa verda
      `.slot-tips` quedava visualment al mateix top que el `.paso-badge`
      ("Paso 12 · Ampliando"), no amb el títol h1 "El compás: el módulo
      temporal". L'usuari vol que la caixa s'alineï amb el TÍTOL del text
      teòric, no amb el pretítol.
    - **Diagnòstic**: el `.slot-tips` ocupa rows 1-3 amb `align-self: start`
      → top de la caixa = top de la fila 1 = top del paso-badge. El
      `.slot-title` té `display: flex; justify-content: flex-end; gap: 6px`
      i conté `paso-badge` (font 11px, line-height ~1.3 = ~14px) + h1.
      L'h1 està a `top + paso-badge.height + gap`.
    - **Fix a `sistema/css/grid.css`**: afegit `margin-top: calc(11px *
      1.3 + 6px)` (~20px) a `.slide[data-layout="E-app-text-left"]
      .slot-tips`. Manté `align-self: start` però desplaça la caixa cap
      avall l'altura exacta del badge + gap.
    - Si en el futur canvia el font-size del `.paso-badge` o el `gap` del
      `.slot-title`, cal recalcular aquest valor (o substituir-lo per una
      variable CSS comuna).

17. **Tweaks — fletxes per editar text contenteditable** ✅ FET (2026-04-29)
    - **Bug**: a `sistema/js/slides.js`, el listener global de keydown
      capturava ArrowLeft/ArrowRight per navegar entre slides fins i tot
      quan l'usuari editava un camp `contenteditable` a Tweaks edit mode
      → no es podia moure el cursor.
    - **Fix**: extès el filtre d'ignore al listener perquè inclogui també
      `[contenteditable="true"], [contenteditable=""]`, no només
      `input,select,textarea`.

18. **Sanititzador Tweaks — superíndex `N^M`** ✅ FET (2026-04-29)
    - **Necessitat**: el text de paso 12 inclou notació `P(3^1)` per
      indicar superíndex. Sense pre-procés, es renderitza com a text literal.
    - **Canvis a `sistema/js/slides.js`**:
      a. Afegits `<sup>` i `<sub>` a `ALLOWED_RICH_TAGS`.
      b. Nou helper `expandSuperscriptNotation(html)` que converteix
         `(\d)\^(\d+)` a `$1<sup>$2</sup>`.
      c. Cridat des de `sanitizeHtml()` (cobreix overrides editats al
         Tweaks) i des de `renderText()` / `renderTips()` (cobreix
         contingut estàtic de `slide-data.js`).
    - **Limitació**: només funciona quan els dos costats són dígits. Si
      cal en el futur suportar variables (`x^n`, `Pulso^N`), cal estendre
      el regex.

19. **`.param--large` abbr label — nou tamany + label secundari Cycle** ✅ FET (2026-04-29)
    - **Mida del label**: la regla `body[data-visual="nuzic"]
      .param.param--large .abbr` baixa de hero (`clamp(1.1, 2.2vw, 1.75rem)`)
      a `clamp(0.9rem, 1.4vw, 1.2rem)` — coherent amb la resta de pills
      `.param`. Afecta App16, App17, App18, App19, App20.
    - **Label secundària "Nº de compases"**: nou
      `<span class="abbr abbr--secondary">Nº de compases</span>` afegit
      dins de `.pl-secondary` a App17/19/20. CSS al tema nuzic posiciona
      el label `position: absolute; top: calc(100% + clamp(0.9rem,
      2.5vw, 2.1rem))` sota el cercle groc gran, amb `transform:
      translateX(0%)` (la mini-pastilla ja queda centrada al cercle).
    - **App19 / App20 — text + ajust de layout**:
      a. Abbr canviat de `Compás:` → `Pulsos por Compás` (sense
         dos-punts). Coherent amb App17.
      b. Eliminat `margin-top: clamp(-2rem, -3vw, -1rem)` de `.inputs`.
         Era una compensació per la mida hero del label antic; amb la
         mida nova (~1.2rem) ja no calia i, en iframe, l'abbr quedava
         tapat pel header.
      c. Trets els dos punts del label "Pulsos por Compás:" als 4 apps
         (16/17/19/20).

20. **Pasos 11 i 12 — contingut nou** ✅ FET (2026-04-29)
    - Paso 11: nou `slideContent[11]` amb image `paso-11.jpg` i text
      sobre patrons, cicles i mòduls. Layout segueix `A-intro`.
    - Paso 12: layout canviat de `B-app-left` a `E-app-text-left` (com
      paso 8). Nou text amb exemple `P(3^1)` i tips per a l'app de Pulsos
      por Compás (App16).
    - Paso 10: petita actualització del text — clarifica que "El primer
      iS situa la primera nota en el plano".

21. **Auto-play en input + alineament Registro + pastilla Registro App18** ✅ FET (2026-04-29)
    - **App17 — auto-play en escriure Nº de compases**: després del
      auto-blur, si tenim `pulsosCompas` i `cycles` definits i no estem
      reproduint, es crida `handlePlay()` automàticament.
    - **App18 — auto-play en escriure Registro**: mateix patró aplicat al
      `inputRegistro`. ~250ms després del `insertText` d'un dígit, si el
      registry queda vàlid i no estem ja reproduint, dispara play.
    - **App18 — Registro alineat amb la soundline**: `#registroParam`
      desplaçat amb `left: 8%` perquè quedi centrat horitzontalment amb
      la soundline vertical (que viu lleugerament a la dreta pels
      números laterals).
    - **App18 — pastilla Registro al patró `.bpm-inline.visible.param.registro`**:
      eliminades les classes `.param--large*` i reescrit l'HTML al
      mateix patró que App19/App20. CSS app-específic copia el
      `.param.registro .circle` (capsule shape, border rosa).

22. **Spinners rosa via theme var (App18/19/20)** ✅ FET (2026-04-29)
    - **Nova var de tema** a `libs/shared-ui/nuzic-theme.css`:
      `--nuzic-spin-bg` (default `var(--nuzic-yellow)`) i
      `--nuzic-spin-bg-hover` (default `#e6a82e`). Les 5 regles que
      pintaven els spinners en groc fix (`.bpm-inline .spin`,
      `.param:not(.param--large):has(.circle > input) .circle .spin.up/.down`,
      i les variants dark mode + hover) ara llegeixen la var.
    - **Override per app**: `body.app18 { --nuzic-spin-bg: var(--nuzic-pink); ... }`,
      mateix per App19 i App20. Bodies han rebut `class="app18/19/20"`
      perquè el selector pugui apuntar només a aquestes apps.
    - **Patró reutilitzable**: qualsevol app futura pot canviar el
      color dels spinners definint la var al seu `body`, sense haver
      d'escriure regles `!important` que competeixin amb el tema.
    - **Eliminada FASE 16 (`.param--large--pill`)**: variant intentada
      i descartada — no la fa servir cap app després de la reescriptura
      d'App18 al patró `.bpm-inline`.

23. **App19 — measure-header reusable + alineament resolt** ✅ RESOLT (2026-04-30)
    - Mòdul `Apps/App16/measure-header.js` mogut a
      `libs/shared-ui/measure-header.{js,css}`. App16 segueix funcionant
      idèntic; App19 l'utilitza ara per mostrar la barra de compassos
      sobre la graella plano-modular.
    - Eliminat el text "Compás" del label esquerre (afecta App16 i App19;
      el rectangle groc queda com a element decoratiu).
    - El track del header llegeix `--com-band-track-right` (default 0)
      per permetre que l'app contenidora retalli el track des de la
      dreta. App19 calcula `--com-band-w` i `--com-band-track-right`
      mesurant `.plano-matrix` vs. `.measure-header` via
      `getBoundingClientRect`.
    - **Resolució**: el drift progressiu venia del clamp
      `Math.max(0, rightOffset)`. A App19 la `.plano-matrix` fa
      `width: 100%` i també té `margin-left: 0.437rem`, de manera que
      el seu costat dret pot sobresortir uns píxels del header. Ara
      `--com-band-track-right` conserva el valor signat; si és negatiu,
      el track s'estén fins al mateix `right` real de la matriu. Verificat
      amb Chrome headless: track i matrix queden amb el mateix
      `left/right/width`, i els deltes dels marcadors passen de
      progressius a constants. Ajust final: App19 declara
      `--measure-marker-x-offset: 2px` perquè el centre visual dels
      cercles/línies del header coincideixi exactament amb els `np-dot`
      de la graella (`markerMinusDot: [0, 0, 0]`).
    - **Patró futur**: per alinear `measure-header` amb una graella
      plano-modular, mesura `headerRect` i `matrixRect`, posa
      `--com-band-w = matrix.left - header.left`, i conserva
      `--com-band-track-right = header.right - matrix.right` amb signe
      (pot ser negatiu si la matriu sobresurt). Si després queda un
      desplaçament constant per diferència entre vora de cel·la i centre
      visual del punt, ajusta només l'app amb
      `--measure-marker-x-offset` en lloc de tocar els percentatges.

24. **Paso 13 (App17 circular) — `.controls` retallats en embed** ✅ FET (2026-05-04)
    - **Bug**: a viewports del Sistema petits (≲600px wide) i molt grans
      (≳1700px wide), els botons `.controls` (play, loop, tap, random) no
      es veien al iframe del Paso 13. Reproduït amb headless puppeteer:
      a 500×700 → iframe 452×452, controls a y=547 (clip de 129px); a
      1920×1080 → iframe 1172×700, controls a y=712 (clip de 12px).
    - **Causa**: `.timeline-wrapper.circular` a `Apps/App17/styles.css`
      tenia `width/height: clamp(16rem, 34vw, 22rem) !important` +
      `margin: 3.5rem auto !important`. El cercle no s'encongia per
      alçada (el clamp només mira `vw`); en iframes baixos, header
      `.inputs` (~120-180px) + cercle 256-352px + marges 56+56 + controls
      excedien l'alçada disponible i `embed.css` `main { overflow:hidden }`
      retallava els controls.
    - **Fix a `Apps/App17/styles.css`**: nou bloc gated per
      `html[data-embed="true"]` que sobreescriu el wrapper:
      - `width/height: min(clamp(12rem, 34vw, 22rem), 60vh)` — afegeix la
        cota per `vh` perquè el cercle s'encongeixi quan l'alçada mana.
        `aspect-ratio: 1` ja existent garanteix el quadrat.
      - `margin: auto` — elimina els 3.5rem fixos; el `display:flex
        flex-direction:column` del `main` (a `embed.css`) centra el
        wrapper verticalment sense empènyer els controls fora.
    - Verificat: 8 viewports de 500×700 a 1920×1080 → tots `clipped=false`.
    - Tests: 1445/1445 OK.

25. **App21-24 — capçaleres soundlines unificades** ✅ FET (2026-05-04)
    - **Bug**: capçaleres incoherents entre les 4 scale-apps. App21 i App24
      usaven `<h3>N/Nm/Nº</h3>` + `<span>Escala …</span>` (símbol gran +
      nom petit, tot a fora del soundline). App22 només `<h3>Escala
      Mayor</h3>` sense pastilla. App23 invertit (`<h3>Escala …</h3>` +
      `<span>Nm/Nº</span>`). I la imatge objectiu de l'usuari demanava un
      patró nou: títol "Escala …" gran negre weight 700 a sobre, i
      pastilla rosa quadrada amb `N` o `Nº` enganxada al top de la
      columna soundline com a capçal continu.
    - **Patró final** (per cada soundline column):

      ```html
      <div class="soundline-column">
        <div class="soundline-header">
          <h3 class="soundline-title">Escala Cromática</h3>
        </div>
        <div class="soundline-block">
          <div class="soundline-abbr-pill">N</div>
          <div class="soundline-container">…números…</div>
        </div>
        <button class="soundline-play">…</button>
      </div>
      ```

    - **Canvis a `libs/soundlines/soundlines.css`**:
      a. `.soundline-title`: font passa de `clamp(0.9rem, 1.5vw, 1.25rem)`
         weight 600 a `clamp(1.1rem, 2vw, 1.6rem)` weight 700, sense
         `white-space: nowrap` (permet wrap a 2 línies si l'amplada és
         estreta).
      b. Eliminades les regles de `.soundline-subtitle` (selector ja no
         s'usa al markup).
      c. Nou `.soundline-block`: flex-column amb `width:
         var(--soundline-container-width)` que agrupa pastilla i
         container; en tema nuzic s'ajusta a `4.5rem` per coincidir amb
         l'amplada visible de la columna rosa (override
         `body[data-visual="nuzic"] .soundline-block { width: 4.5rem }`).
      d. Nou `.soundline-abbr-pill`: `width: 100%; height:
         clamp(2.4rem, 4vw, 3rem); background: var(--nuzic-pink);
         color: var(--nuzic-dark); font-weight: 700;` — pastilla rosa
         saturada amb la lletra negre weight 700, mateixa amplada que el
         container rosa light que conté els números.
      e. `.soundline-header { gap: 0; min-width: var(--soundline-
         container-width); }` (eliminat `transform: translateX(...)` que
         desplaçava el header).
    - **Mateixes regles duplicades a `Apps/App22/styles.css`** (App22 no
      importa el CSS compartit, té la seva pròpia còpia).
    - **App22 — `--soundlines-height`** reduït de `clamp(25rem, 80vh,
      75rem)` a `clamp(20rem, 65vh, 60rem)` perquè la nova pastilla
      ocupa ~50px addicionals al header i el botó play queia fora del
      viewport en finestres de 900px d'alt.
    - **Markup actualitzat** a `Apps/App21/main.js`, `Apps/App22/main.js`,
      `Apps/App23/main.js`, `Apps/App24/main.js`. Lletra unificada a
      `N` (cromàtica) / `Nº` (qualsevol altra escala).
    - **App24 — pastilla dinàmica**: `updateScaleTitle()` ara escriu
      "Escala {name}" al `<h3 id="scaleSoundlineTitle">` i actualitza
      el text de `<div id="scaleSoundlineAbbr">` a `N` quan
      `currentScaleConfig.id === 'CROM'` o a `Nº` per la resta.
    - Tests: 1445/1445 OK.

26. **App21-24 — accessibilitat dels controls (standalone i embed)** ✅ FET (2026-05-04)
    - **Bugs trobats** auditant App21-24 contra el patró baseline
      d'App10/16-20 (apps amb `class="appNN"` al `<body>` + embed
      overrides per app):
      a. Cap dels 4 tenia `class="appNN"` al `<body>` → no era possible
         escriure overrides per-app a `embed.css` o nuzic-theme.
      b. **Embed**: els play buttons d'App21/23/24 queien fora del
         iframe (clipped per `overflow:hidden` al `main`) perquè el
         `--soundlines-height` default `clamp(25rem, 85vh, 75rem)`
         consumeix gairebé tot el viewport.
      c. **Standalone**: `libs/soundlines/soundlines.css` aplicava
         `html, body { height: 100%; overflow: hidden }` globalment.
         En finestres &lt;~830px d'alt, els play queien sota el viewport
         i no hi havia scroll. A més, `.sound-wrapper.nuzic-floating`
         (botó volum) tenia `position: fixed`, així que tampoc
         scrollejava amb la pàgina i quedava inaccessible.
    - **Canvis aplicats**:
      a. `Apps/App21..App24/index.html`: afegit `class="appNN"` al `<body>`.
      b. `libs/app-common/embed.css`: nou bloc
         `html[data-embed="true"] body.app21, body.app23, body.app24
         { --soundlines-height: clamp(15rem, 70vh, 55rem) }` — només
         en embed, redueix l'alçada perquè header + soundline + play
         càpiguen al iframe. App22 té layout amb intervals i s'exclou.
      c. `libs/soundlines/soundlines.css`: el `html, body { height:
         100%; overflow: hidden }` passa a un bloc gated per
         `html[data-embed="true"]`. En standalone `html, body { min-
         height: 100% }` deixa que el document creixi i el browser
         ofereixi scroll natural.
      d. `libs/shared-ui/nuzic-theme.css`:
         `.sound-wrapper.nuzic-floating` passa de `position: fixed` a
         `position: absolute`, amb override `fixed` només sota
         `html[data-embed="true"]`. Standalone → el botó volum scrolla
         amb la pàgina i és accessible. Embed → segueix ancorat al
         viewport (l'iframe no fa scroll).
    - Verificat amb headless puppeteer a 1024×768, 1280×800, 1440×900
      (standalone) i 480×512, 700×700, 1050×700 (embed):
      `.soundline-play` i `.sound-wrapper` ja no queden inaccessibles
      en cap dels casos.
    - Tests: 1445/1445 OK.

27. **App21 — soundlines fins al 0 agut (octava superior)** ✅ FET (2026-05-04)
    - **Bug**: App21 mostrava la cromàtica 0..11 i la Mayor 0..6, parant
      al SI (semitò 11) sense incloure el DO agut. App22/23/24 ja
      arriben al 0 agut (semitò 12 = grau 0 superior).
    - **Canvis a `Apps/App21/main.js`**:
      a. Nova constant `MAJOR_SCALE_NOTES_WITH_OCTAVE = [...MAJOR_SCALE_
         NOTES, 12]` (paral·lela a App23).
      b. `TOTAL_CHROMATIC: 12 → 13` (notes 0..12).
      c. `createChromaticLabelFormatter`: `noteIndex === 12 → 0`
         (mostra "0" agut al top del soundline cromàtic).
      d. `createScaleLabelFormatter`: `noteIndex === 12 → 0`
         (grau 0 a la cima de l'escala).
      e. `applyHighlightColors` rep `MAJOR_SCALE_NOTES_WITH_OCTAVE` →
         el 0 agut a la cromàtica també queda en selectcolor.
      f. `initScaleSoundline.visibleNotes`: `MAJOR_SCALE_NOTES →
         MAJOR_SCALE_NOTES_WITH_OCTAVE` (8 punts visibles).
      g. `redrawConnectionLines.scaleNotes`: idem.
      h. `playChromatic`: bucle ara recorre 13 notes (0..12) i
         comprova `MAJOR_SCALE_NOTES_WITH_OCTAVE.includes(i)` per
         disparar el highlight a la columna Mayor.
      i. `playScale`: bucle recorre `MAJOR_SCALE_NOTES_WITH_OCTAVE`
         (8 notes, DO RE MI FA SOL LA SI DO).
    - Tests: 1445/1445 OK.

28. **App18 — pastilla `N` al capçal de la soundline** ✅ FET (2026-05-04)
    - Mateix patró que App21-24 (punt 25): el `.soundline` queda
      embolcallat per un nou `.soundline-block` (creat al `drawSoundline`
      després de `createSoundline`) que conté la pastilla
      `<div class="soundline-abbr-pill">N</div>` damunt el rectangle
      pink-light.
    - **CSS local a `Apps/App18/styles.css`**: `.soundline-block`
      (`width: 3.75rem; margin: 0 auto`; flex-column) reemplaça el
      `.soundline` com a element centrat dins del `.soundline-container`
      ample. `.soundline-block .soundline { flex: 1 1 auto; height:
      auto }` perquè ompli la resta. `.soundline-abbr-pill` mateix estil
      que a App21-24 (rosa saturada, lletra negre weight 700).
    - **Nota**: App14 va començar amb el mateix canvi però es va
      revertir (l'usuari va decidir mantenir App14 sense pastilla per
      no complicar el layout amb la columna virtual d'intervals).
    - Tests: 1445/1445 OK.

29. **App18 — slide d'octava al canviar registre** ⚠️ NO RESOLT (2026-05-04)
    - **Objectiu**: que els números de la soundline facin "scroll" sobre
      el fons rosa fix cada cop que es canvia el registre, com si tota
      la columna pugés/baixés una octava sencera.
    - **Implementació actual**:
      a. `Apps/App18/main.js`: `onRegistryChange` calcula la direcció
         (`up`/`down`) comparant amb `lastRegistry` i crida
         `animateRegistrySlide(direction)`. Aquesta funció clona el
         `.soundline` actual com a overlay absolut, crida
         `drawSoundline()` (que reemplaça el `.soundline` amb els nous
         números), pre-posiciona el nou amb `translateY(±100%)` i, al
         següent `requestAnimationFrame`, transiciona a `translateY(0)`
         mentre l'overlay surt amb `translateY(∓100%)` + opacity 0.
         Cleanup després de `REGISTRY_SLIDE_MS + 50` (270ms).
         `REGISTRY_SLIDE_MS = 220` (sota `AUTO_PLAY_DELAY = 250` per
         evitar que els nous `.note-highlight` apareguin abans del
         cleanup).
      b. `Apps/App18/styles.css`: el fons `nuzic-pink-light` passa del
         `.soundline` al `.soundline-block` (perquè el `.soundline` es
         pugui transformar lliurement). `.soundline-block` rep
         `position: relative; overflow: hidden` per ancorar l'overlay
         absolut i retallar el moviment dins el rectangle rosa. Nova
         classe `.soundline-slide-overlay` per a l'overlay.
    - **Estat**: l'usuari reporta que el comportament continua
      "exactament igual" malgrat múltiples iteracions:
      - Versió 1 (slide del `.soundline` sencer amb `transform`): el
        fons rosa també es desplaçava — incorrecte.
      - Versió 2 (dos `.soundline-scroll-track` separats per old/new
        numbers): apareixia una "columna vertical" que tapava notes
        — confirmat per l'usuari amb captura encerclada.
      - Versió 3 (overlay clone + fons al `.soundline-block`): el
        headless puppeteer no reprodueix el bug que l'usuari segueix
        veient.
    - **Pista potser útil per futures iteracions**: al headless les
      captures es veuen netes; el bug només es manifesta amb àudio
      real (samples de piano que carreguen, primer beat real cap a
      1-2s després del play). No el podem reproduir sense àudio
      activat. Cal provar amb una eina que sí reprodueixi àudio o
      depurar amb DevTools al navegador real.
    - Tests: 1445/1445 OK.

30. **App18 — fix clipping de l'animació de notes amb slide de registre** ✅ FET (2026-05-04)
    - **Diagnòstic real**: la versió 3 retallava el `.soundline-block`
      amb `overflow: hidden` per amagar la sortida/entrada vertical dels
      números. Però el `.note-highlight` d'App18 és fill del `.soundline`
      i surt cap a la dreta amb `left: 100%`; per tant quedava dins d'un
      ancestre retallat i l'animació blava de nota deixava de ser visible.
      El problema no era l'àudio ni el timing de samples, sinó el clipping
      aplicat massa amunt en l'arbre DOM.
    - **Solució aplicada**:
      a. `Apps/App18/main.js`: després de `createSoundline()`, els
         `.soundline-number` es mouen a una capa interna
         `.soundline-number-window > .soundline-numbers-track`.
      b. `animateRegistrySlide()` ja no transforma el `.soundline` sencer:
         clona només la pista de números antiga, redibuixa, i anima old/new
         tracks dins la finestra de números.
      c. `Apps/App18/styles.css`: `.soundline-block` torna a
         `overflow: visible`; el clipping queda restringit a
         `.soundline-number-window { overflow: hidden }`. Això manté el
         fons rosa fix i el scroll vertical dels números, però deixa que
         `.note-highlight` s'estengui fora de la barra.
      d. Ajust de sensació visual: transició de números alentida de
         220ms a 620ms i `AUTO_PLAY_DELAY` pujat a 700ms perquè el so
         entri després que el scroll s'hagi assentat.
    - **Criteri professional**: correcte separar capes per responsabilitat:
      fons fix + superfície interactiva estable + finestra retallada només
      pels números. És més robust que transformar el contenidor complet
      perquè no barreja animació decorativa amb elements de playback/click.
    - Tests: `npm test -- --runInBand` → 73 suites / 1445 tests OK.
      Jest continua mostrant l'open-handle conegut després del resum i s'ha
      aturat manualment el procés.
    - Retest després de pujar a 620ms:
      `npm test -- --runInBand libs/sound/__tests__/registry-controller.test.js libs/sound/__tests__/melodic-sequence.test.js`
      → 2 suites / 60 tests OK.

### Tasques pendents (feina futura, fora del pla actual)

- **App22**: redisseny de l'estructura Escalar (no tractat aquí).
- **App24**: redisseny de les línies de connexió (no tractat aquí).
- **App17**: 3 millores opcionals identificades pel revisor (cache de
  last-size al ResizeObserver, comentaris consistents, `ro` al module
  scope per facilitar futur teardown).

### Notes sobre files que NO es toquen

- **Apps individuals**: cap canvi obligatori. Família B ja té zones flex amb
  mínims propis; Família A ja té `clamp()` a tot.
- **`libs/app-common/embed-mode.js`** + **`embed.css`**: ja existeixen i les
  25 apps ja estan cablejades. Cap canvi.
- **`relocateSoundWrapperForNuzic()`** a `header.js`: cap canvi.

### Última sessió arxivada

[`docs/session-history/2026-04-23-app17-cycle-end-audio-consistency.md`](docs/session-history/2026-04-23-app17-cycle-end-audio-consistency.md)

---

**Recordatori**: actualitzar aquest fitxer a cada commit (què s'ha completat,
què queda pendent, què s'ha aprés). Quan tot estigui fet, arxivar a
`docs/session-history/2026-04-XX-sistema-iframe-skeleton.md`.
