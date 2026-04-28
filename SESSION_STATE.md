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

14. **App19/App20 — restructura DOM plano-modular** ⚠️ NO RESOLT (2026-04-28)
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
    - **Canvis aplicats** (cap va resoldre el bug segons l'usuari):
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
         - `.plano-matrix-container`: eliminat `max-height: calc(...)`
           legacy que no s'adaptava al flex-wrap del header.
      c. `Apps/App19/styles.css`, `Apps/App20/styles.css`: netejats els
         overrides redundants. Només queda `.plano-timeline-container
         { z-index: 2 }` (App19) i `+ margin-bottom: 0.59rem` (App20
         per al N-iT editor).
      d. `libs/plano-modular/__tests__/plano-grid.test.js`: actualitzat
         per esperar la nova jerarquia (timeline com a sibling de gridArea).
    - **Estat**: tests 1445/1445 passen, però l'usuari reporta que el
      bug visual persisteix tant al sistema (iframe) com a les apps
      standalone. **Diferida la resolució** — possible que el problema
      sigui browser cache, especificity CSS no resolta, o un factor
      no diagnosticat. A reprendre amb fresh eyes / DevTools en una
      sessió futura.

### Tasques pendents (feina futura, fora del pla actual)

- **App19/App20**: la timeline (groc) es superposa a les primeres files de
  la graella en pantalles petites tot i el fix de commit `a76ba11`. Cal
  revisar el `max-height` calc del `.plano-soundline-container` /
  `.plano-matrix-container` perquè respecti el cas amb `flex-wrap`
  disparat al header.
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
