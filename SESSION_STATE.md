# SESSION_STATE — Redisseny App4 "Pulsos Fraccionados" (pla aprovat 2026-06-12)

## Tasca activa: App4 → nuzic + 3 fraccions + cercles concèntrics

**Concepte aprovat per l'usuari** (esbós interactiu validat:
`docs/app4-rings-sketch.html` — obrir al navegador; conté la geometria,
les regles de radi i la validació exactes que ha de tenir el mòdul final):

- **3 fraccions activables** (F1 groc `--nuzic-yellow`, F2 rosa
  `--nuzic-pink`, F3 blau `--nuzic-blue`); F1 activa per defecte, F2/F3
  opcionals amb toggle que conserva valors en desactivar.
- **Rangs**: n ∈ [1,7], d ∈ [1,12].
- **Lg deixa de ser input lliure**: Lg = cicle gran × m, on cicle gran =
  mcm dels numeradors reduïts de les fraccions actives (els denominadors
  NO hi influeixen), i m = "Cicles" és l'únic control de longitud.
- **MAX_LG = 210 = mcm(5,6,7)** — el pitjor cas matemàtic amb n≤7. Cap
  combinació vàlida queda mai bloquejada; la validació "cicle > 210" queda
  al codi només com a xarxa de seguretat.
- **Sempre representació circular** (es retira el mode lineal i el toggle):
  anells concèntrics — cercle base (pols, fix com a referència R₀) + un
  anell per fracció activa. **Radi ∝ velocitat**: r = R₀·s^k amb s = d/n i
  k = 0.35; després regla de separació (GAP mínim, ràpids enfora, lents
  endins) i clamp [Rmin, Rmax].
- **Densitat adaptativa** (validat al sketch): mida de punt segons espai
  d'anell, etiquetatge de números mode "rellotge" quan no caben (sempre
  inicis de cicle en negreta), línies radials de cicle espaiades si n'hi
  ha > 24.
- **Editor numèric (pulseSeq) s'elimina**; la selecció de pulsos/fraccions
  es manté per clic als anells.
- **Info matemàtica**: botó "ⓘ" amb panell (substitueix el tooltip del
  títol): Lg, cicle gran (pulsos i s), V i V·d/n per fracció, pulsos
  fraccionats per cicle, mcm de denominadors (graella mínima), proporció
  polirítmica reduïda, T.

### ESTAT 2026-06-18 (tot committejat; suite 79 suites / 1502 tests)

El redisseny F1–F6.scroll està **fet i committejat** (ja no hi ha res "pendent
de commit"). Després s'hi ha afegit:

- **App4B**: còpia congelada de l'App4 lineal original (prefix `app4b:`, targeta
  al launcher). Commit fe16687.
- **Anells**: bandes gruixudes (RING_STROKE 32 / BASE_STROKE 64), selecció verd
  nuzic unificat, pols 0 contorn buit, números dins la banda base; després
  **cercle base en CREMA** (`--nuzic-yellow-light`) amb números/punts foscos;
  números **clampats** (més grans amb pocs, 11–22 viewBox) i **centrats**
  (`dominant-baseline: central`).
- **Random**: també sorteja n/d de les fraccions actives.
- **Controls**: notació mogut a `.controls`; export PNG; **top-bar amagat**
  (guanyar espai, el mute sobreviu a `.controls`); **botó ∑** (info) a l'esquerra
  del reset.
- **Model Pulsos/Ciclos**: el pill editable mostra **Pulsos** (= Lg) i el visor
  mostra **Ciclos** (= m = Lg/cicle gran = coincidències fracció+pols). Swap de
  rols preservant `inputLg.value === Lg`.
- **Targeta launcher**: "Pulsos Fraccionados" → "**Metrónomo Fracción**".
- **abbr de tots els inputs**: `clamp(0.75rem, 2vw, 1.6rem)` (com la nova App1).

- **F7 — panell ∑ complet** ✅: mòdul pur `polyrhythm-info.js` (amb tests) +
  panell centrat amb general · taula per fracció (velocitat V·d/n) · proporció
  reduïda (ex. 6:8:9), recàlcul en viu.
- **Layout responsive (pantalles petites/verticals)** ✅: fila de fraccions
  governada per CSS (no JS; fora `setupFractionRowWidthSync`), `.fraction-group
  { margin: 0 }` + `gap ≥ 1.85rem` → 3 fraccions sense scroll a ~375px; anells
  `46vh` en `@media (max-height: 680px)`; controls una mica més amunt. **Inputs
  Pulsos·Ciclos·BPM en UNA fila** en estret (commit 899ccc2): `column-gap:
  clamp(0.5rem,2.5vw,1.5rem)` + input pastilla `width: clamp(2.4rem,6vw,4.5rem)`
  amb `.app4`+!important (verificat 1 fila a 360/390/412px).

Pendent: només **F8** (neteja Step 15 + README usuari + MODULES.md + arxiu a
session-history). Vegeu sota.

### Fases (cada fase = commit propi + npm test verd)

- [x] **F1 — Tema nuzic base** ✅ (commit de checkpoint 2026-06-12):
      data-visual="nuzic" + nuzic-theme.css, reorderControls() (helper
      H-08) + re-append manual de loop i tap (el helper els descarta).
      Fila resultant: Play · Random · Tap · Reset · Loop. Decisions:
      - **Tap es conserva** amb l'estètica del random (cercle verd
        #7cd6b3, blanc), a la DRETA del random (order: 4 + ordre DOM);
        tap-help ancorat per JS al centre del botó (offsetLeft dins
        .controls relative).
      - **Loop visible** via override transitori a styles.css (marcat
        "fins F5") — encara governa mode circular + bucle d'àudio.
      - **Etiqueta V → "BPM"** (index.html) i tap tempo arrodonit a
        1 decimal (abans 2).
      - CSS de pulseSeq/fraction-inline/timeline NO netejat a posta:
        mor a F2/F3/F5.
- [x] **F2 — Eliminar editor numèric** ✅ (codi fet, pendent de commit):
      main.js 3.028 → 2.238 línies; styles.css 698 → 479. Decisions:
      - `createPulseSeqController()` es conserva SENSE mount: només
        `.memory` (pulseMemoryApi, que usa createPulseMemoryLoopController)
        i `.drag` (drag-select sobre la timeline, independent del mount).
      - Fraction editor re-allotjat: `mode: 'block'` amb host `.middle`
        (patró App28); index.html passa a `noMiddleSlot: true` (el flag
        `inlineFractionSlot` del template mai va estar implementat —
        `#fractionInlineSlot` no existia al DOM).
      - El canvi de fracció ja no passa per sanitizePulseSeq: l'onChange
        crida `prunePulseMemoryForFraction()` (poda ints no seleccionables
        dins de Lg, mateixa semàntica) + `renderTimeline()` directe.
      - `updatePulseSeqField` esborrat sense substitut: pulseSeqEntryOrder/
        Lookup/TokenMap no tenien cap altre consumidor viu (el TokenMap
        queda com a Map buit al store; highlight-controller i
        applyFractionSelectionClasses hi estan guardats).
      - Cap lib compartida tocada (paràmetres pulseSeq* de
        highlight-controller són opcionals). gamification-adapter intacte
        (lookups de #pulseSeq/#fractionInlineSlot amb null-guard).
- [x] **F3 — 3 fraccions + model Lg** ✅ (codi fet, pendent de commit;
      verificat amb CDP headless: load net, +F2, toggles, 3/2+7/4→Lg=168,
      mMax=10, persistència entre reloads, consola neta). Decisions:
      - `fractionSlots[]` de 3 entrades amb editor block per slot (host
        propi dins `.fraction-row`); F1 conserva les claus LEGACY `app4:n/d`,
        F2/F3 usen `n2/d2`, `n3/d3`; flags `f1on/f2on/f3on` (defaults 1/0/0).
        "added" de F2/F3 = flag present O valors n/d guardats (llegit ABANS
        de crear l'editor: amb startEmpty l'editor neteja les claus a init).
      - **getFraction() = primera fracció activa AMB valors vàlids**
        (F1>F2>F3; un slot actiu però buit no compta) — shim fins F4/F5;
        `getActiveFractions()` exposa numeradors reduïts per al cicle gran.
        El pipeline prune+renderTimeline+handleInput es dispara quan canvia
        la SIGNATURA n/d de la primera activa (toggles que no la canvien
        no re-rendericen).
      - **Pill "Cicles"** clonada de la d'Lg (mateix crom nuzic), inserida
        abans; `app4:cycles` default 8. **El spinner d'Lg s'ELIMINA del DOM**
        (display:none no basta: el tema força els .spin amb !important;
        sense spinner la pill cau a la variant buida del tema) + readonly
        amb fons --nuzic-light.
      - validateFractionCombo com a xarxa de seguretat (inassolible amb
        n≤7): revert al darrer valor vàlid + tooltip
        `Cicle gran = mcm(…) = X pulsos > màxim 210` (createInfoTooltip,
        auto-hide 4s). Per provar-la: abaixar MAX_LG temporalment a main.js.
      - Random: fila Lg → **Cicles** (ids randLg* conservats); n/d
        aleatoritzen TOTES les fraccions actives independentment (re-roll
        ≤20 si combo >210, fallback n=1); V/Pulsos segueixen per
        randomizeFractional amb shim `{ getFraction }`. randomDefaults:
        m [1,8], n [1,7], d [1,12].
      - Editors amb `maxNumerator: 7, maxDenominator: 12` (opcions natives
        de fraction-editor.js — cap lib tocada).
      - Bugfix de passada: `RANDOM_STORE_KEY` es referenciava sense definir
        (el try/catch de load/saveRandomConfig s'empassava el ReferenceError
        i la config random no es persistia MAI); ara `app4:random` funciona.
      - Reset: neteja n/d + flags dels 3 slots + cycles → F1-only buida, m=8.
- [x] **F4 — Àudio polirítmic** ✅ (codi fet, pendent de commit; verificat
      amb CDP headless: clic CONFIAT de Play, F1=1/2 + F2=1/3 a loop,
      toggles en viu de F2 i de F1 (canvi de principal), stop net, consola
      neta; suite 73/1395 verda). Decisions:
      - **Híbrid per qualitat** (àudio > simetria): la PRIMERA fracció
        activa segueix el camí de cicle LEGACY (pre-agenda al lookahead +
        missatges 'cycle' del worklet alineats a la mesura → highlights i
        getVisualState().cycle intactes); la resta d'actives són VEUS
        (setVoices, ids `frac-f2`/`frac-f3` estables per slot) amb àudio
        pre-agendat al MATEIX lookahead — nou `_scheduleVoiceAudio` a
        libs/sound/index.js, mateixa matemàtica de segment (segDur via
        `_stepTime`) i epsilon 1e-9 que el cicle, sample 'cycle' per a totes.
        "Tot veus" es va descartar: el worklet re-ancora la fase de les veus
        a cada setVoices (countdown 0 → tick immediat) i el push en viu
        n'envia un a cada edició — els highlights de la principal haurien
        quedat desfasats; el cicle es realinea amb measurePhaseBeats.
      - **Canals de mixer per SLOT**: frac1/frac2/frac3 ("Fracció 1/2/3"),
        registrats al singleton a l'init del mòdul (els toggles poden mutar
        abans del motor); el bus de cicle es re-apunta al canal del slot
        principal amb el NOU `setCycleChannel` (additiu; default
        'subdivision' intacte per a la resta d'apps). 'subdivision' queda
        sense ús a App4: fora del menú del mixer, cap slider mort.
      - **libs/sound/index.js** (no és fitxer d'alt risc; el worklet NO s'ha
        tocat): `_voiceDefs` amb `channel`, busos de veu lazy
        (`_ensureVoiceBus`, stereo explícit, governats per `_applyMixerState`
        via `_mixerChannelMuted`), setVoices/addVoice despullen els camps
        extres abans del postMessage, el fallback reactiu 'seleccionados'
        SE SALTA les veus amb canal (anti-doble so), fade-out i teardown
        inclouen els busos nous. +4 tests a la suite del motor.
      - **Toggle "Subdivisión" del header = grup**: silencia
        frac1+frac2+frac3 (onChange ignora source 'mixer' per no col·lapsar
        mutes individuals del menú); sync mixer→toggle com a grup (algun
        canal no mutat = ON; solo aliè que els força tots = OFF transitori).
      - **Push en viu**: la mateixa liveTransportPush (250ms) ara empeny
        setCycleChannel + setVoices + cycle SEMPRE (zeros quan no hi ha
        principal — sense això, desactivar-la en viu deixava sonant el n/d
        antic al worklet).
      - **Veus amb n/d RAW** (no reduïts): el període n/d és idèntic, però
        l'índex de tick només mapeja 1:1 amb la graella cicle×denominador
        (la dels anells F5) si d és l'original; mateixa guarda que hasCycle
        (floor(lg/n) > 0) per fracció.
      - **updateVoiceHandlers**: cap handler visual per ara (la principal
        s'il·lumina pel camí legacy); `createCycleVoiceHandler` es conserva
        com a adaptador tick→highlight per als anells (TODO(F5) al codi).
      - El canal seleccionat (accent) continua sobre la graella de la
        primera activa (F5 ho generalitzarà). Stop/loop verificats: veus
        re-enviades a cada startPlayback, `_resetVoicesCountdown` al start
        del worklet (cap countdown ranci), stop buida `_futureSources`.
      - **F4b — Canals de seleccionats per fracció** ✅ (codi fet, pendent de
        commit; suite 73/1399 verda; smoke CDP: pols 2 + fraccions 0.5/1.5
        amb F1=1/2 → selectedRef {1,3,4} amb {1,3}→fracSel1 i 4 legacy,
        cycleChannel frac1, bus fracSel1 creat, consola neta — script a
        /tmp/app4-f4b-smoke.mjs). Decisions:
        - **6 canals de fracció**: frac1/2/3 (metrònom, F4) + fracSel1/2/3
          ("Fracció N sel.") per als pulsos fraccionats SELECCIONATS del
          slot. Els sencers seleccionats segueixen al canal global 'accent'
          ("Seleccionado"). Mateix sample d'accent per a tots: només canvia
          el fader/mute. Ordre del menú: Pulso · Fracció 1 · Fracció 1 sel.
          · Fracció 2 · Fracció 2 sel. · Fracció 3 · Fracció 3 sel. ·
          Seleccionado · Master (parella metrònom+selecció adjacent per
          fracció: aïllar-ne una = dos faders veïns).
        - **Motor (libs/sound/index.js, additiu)**: setSelected/play
          accepten entrades número (legacy → bus 'seleccionados', INTACTE)
          o objecte `{ value, channel }` → `normalizeSelection` separa Set
          de valors + Map valor→canal (`_selectedChannels`); al tick del
          scheduler la selecció amb canal s'agenda al bus lazy del canal
          (`_ensureVoiceBus`, governat per `_applyMixerState`), canal mutat
          → no s'agenda font però `triggered=true` (cap beep supletori);
          valor duplicat → primera etiqueta guanya (un valor = exactament
          un bus). `toSet` mort, eliminat. +4 tests (normalització,
          routing, mute-skip, teardown).
        - **Regla de mapatge selecció→slot** (selectionChannelForFraction):
          una selecció guarda el n/d LITERAL de la graella on es va fer
          (pulsesPerCycle = n del slot, denominator = d, sense reduir);
          es compara literalment amb els slots actius en ordre F1>F2>F3
          (2/4 NO casa amb 1/2); pulsesPerCycle absent (memòria antiga) →
          primer slot actiu amb el mateix d; cap match → sense etiqueta →
          'accent' legacy. L'etiquetatge viu a selectedForAudioFromState
          (computeAudioSchedulingState ara exposa activeFractions) i flueix
          també pel push en viu (applySelectionToAudio → setSelected).
        - **Toggle "Seleccionado" del header = grup**: silencia
          accent+fracSel1/2/3 (mirall del toggle "fracciones" de F4, source
          'mixer' ignorat); sync mixer→toggle factoritzat a syncGroupToggle
          (mateixa semàntica de solo transitori per als dos grups).
      - **F4c — Veu pròpia per canal al mixer** ✅ (codi fet, pendent de
        commit; suite 73/1403 verda; smoke CDP a /tmp/app4-f4c-smoke.mjs:
        ordre de canals, 8 selectors, canvi de "Fracció 1"→Sticks amb
        persistència + override al motor, restauració després del reload,
        consola neta). Decisions:
        - **Ordre del menú**: Pulso · Seleccionado · F1 · F1 sel. · F2 ·
          F2 sel. · F3 · F3 sel. · Master — 'Seleccionado' puja al costat
          de 'Pulso' (parella del pols base: metrònom + sencers
          seleccionats, mateixa lògica de veïnatge que les parelles de
          fracció de F4b).
        - **Selector d'instrument per canal** (tots menys Master) DINS del
          mixer (superfície d'alumne; el header és dev-only):
          mixer-menu.js accepta `soundSelector` opcional al config del
          canal `{ storageKey, eventType?, defaultValue?, apply? }` —
          reutilitza initSoundDropdown (preview + commit/cancel idèntics
          al header); apply default = `audio.setChannelSound(id, v)`.
          Apps sense `soundSelector` → zero canvi (CHANNEL_SOUND segueix).
        - **Motor (libs/sound/index.js, additiu)**:
          `setChannelSound(channelId, sampleKey)` / `getChannelSound` —
          mapa `_channelSounds` (sobreviu el teardown; buffers
          `channel:<id>` re-carregats a `_initPlayers`, càrrega lazy si
          encara no hi ha context). Resolució en TEMPS D'AGENDA via
          `_resolveChannelBufferKey(channelId, roleKey)` als 4 camins:
          pols base ('pulse'), seleccionats legacy ('accent'),
          seleccionats etiquetats (fracSelN), cicle (_cycleChannelId) i
          veus (_scheduleVoiceAudio) — destination explícit quan hi ha
          override (les claus 'channel:*' no passen per
          _resolveBusForSampleKey). Override sense buffer carregat → rol
          (mai forats d'àudio). +4 tests.
        - **PRECEDÈNCIA**: override per canal del mixer > sample de ROL
          (setBase/setAccent/setCycle — els selects dev del header queden
          com a fixadors de DEFAULTS, intactes a index.html).
        - **Persistència App4**: `app4:sound:<canal>` (initSoundDropdown
          escriu `storeKey('sound:<id>')`); restauració a initAudio (lazy,
          cap init d'àudio al load). Defaults del selector = valor RAW
          actual del rol (baseSound/accentSound/cycleSound).
- [x] **F3/F4 addendum — Estètica nuzic de les caixes de fracció +
      auditoria d'unitats relatives** ✅ (codi fet, pendent de commit;
      suite 73/1403 verda; smoke CDP a /tmp/app4-fracbox-smoke.mjs +
      screenshots /tmp/app4-fraction-row*.png vs /tmp/app27-fraction-ref.png,
      consola neta). Les 3 caixes segueixen el patró App27 (Step 7s + 7s.9):
      vora 3px del color d'identitat del slot (via --slot-color), fons blanc,
      números negres Ubuntu 900 clamp(1.75rem,3.8vw,2.7rem) amb !important
      (guanya el blau de .bottom input i l'opacity 0.5 inline de
      setSimpleMode), barra com a ::after de .top (insets 17.5%, 4px negre;
      .top/.fraction-field a width 100% perquè els DOS spinners projectin
      al mateix x), spinners half-pill FORA de la caixa amb el color del
      slot (crom H-17 recolorat; hover/active via color-mix), placeholders
      n/d gris suau, wrapper gap:0 (7s.9a, xarxa de seguretat amb
      enableGhost:false), gap de la fila clamp(1.5rem,4vw,2.5rem). Prefix
      body.app4 .fraction-slot per guanyar libs/app-common/styles.css per
      especificitat (nuzic-theme no té regles de fraction-editor). Auditoria
      Step 4: tots els font-size a clamp(), px→rem a posicions/mides
      (cycle-marker/labels/#tIndicator/notation/media 600px — només
      traducció d'unitats, cap redisseny: mor a F5); px només a vores,
      ombres, radius i la barra/gap de 4px del crom compartit.
- [x] **F5 — Anells concèntrics** ✅ (F5a mòdul + F5b integració; codi fet,
      pendent de commit): cercle base (pols) + un anell per fracció activa,
      radi ∝ velocitat, punts/etiquetes adaptatius, clic-per-seleccionar,
      highlight de playback per anell. App4 el consumeix; la timeline
      lineal s'ha retirat. **Requisit afegit (2026-06-12): el botó loop
      s'ELIMINA i l'app sempre reprodueix en bucle** — fet a F5b (fora
      també l'override CSS transitori i el toggle circular del menú).
      Decisions F5a:
      - NOU `libs/app-common/circular-rings.js` (+ `circular-rings.css` +
        test, 48 tests; suite 74/1451 verda). Geometria EXACTA de l'esbós
        (viewBox 580, C=290, R0=155, RMIN=42, RMAX=256, GAP=30, k=0.35
        configurable); helpers purs exportats per a tests: `idealRadius`,
        `resolveRadii`, `computeLabelStep`, `computeLabelList`,
        `computeCycleLineStep`, `dotMetrics`, `RING_GEOMETRY`.
      - API state-in/events-out: `createCircularRings({ container, k,
        onDotClick })` → `render({ lg, bigCycle, base, fractions })` /
        `highlightPosition(pos)` (cache d'elements per anell, només toggle
        de classes + agulla) / `clearHighlights()` / `getElement()` /
        `destroy()`. Payload de clic: `{type:'int', index}` o
        `{type:'fraction', ringId, tickIndex, position, numerator,
        denominator}`; `selectable:false` → ni clic ni pointer.
      - Tematització: classes `crings-*` + variables `--crings-color`/
        `--crings-light` per grup d'anell (estats selected/active al CSS
        via transform scale, transform-box: fill-box); atributs SVG de
        presentació com a fallback sense CSS. App4 ha d'enllaçar
        `libs/app-common/circular-rings.css`.
      - Punts amb `data-index` (base) / `data-tick-index` (fracció);
        delegació d'un sol listener de clic a l'SVG (WeakMap de payloads).
      **Decisions F5b (2026-06-12; main.js 2.865→2.331 línies, styles.css
      837→584; suite 74/1451 verda; smoke CDP a /tmp/app4-f5b-smoke.mjs +
      screenshot /tmp/app4-f5b-layout.png, consola neta):**
      - **#timeline → `.rings-host`**: l'element del template es reconverteix
        en amfitrió pelat (es treu la CLASSE .timeline perquè cap estil
        compartit — línia, fons crema nuzic — no s'hi apliqui; cap CSS
        compartit tocat). createCircularRings hi viu; SVG centrat amb
        `width: min(100%, 60vh)`. timeline-layout/timeline-renderer ja no
        s'importen — **timeline-renderer.js queda sense consumidors a tot el
        repo (App4-only): candidat a esborrar a F8**.
      - **Endpoint**: el punt 0 de l'anell base és l'ORIGEN del cicle
        (endpoint, ple del color de l'anell via `.crings-dot--endpoint` a
        styles.css, no seleccionable). NO existeix punt Lg: amb bucle
        permanent Lg ≡ 0. L'antiga parella efímera 0/Lg-controla-loop mor.
      - **Tots els enters 1..Lg-1 són seleccionables**: la regla
        isIntegerPulseSelectable era un artefacte de la línia (només
        mostrava la graella d'UNA fracció); fora d'App4 (random passa un
        predicat `() => true`; prunePulseMemoryForFraction eliminat — els
        canvis de fracció ja no poden invalidar enters). Sonen per 'accent'.
      - **Ticks de fracció coincidents amb un pols enter (k·n/d enter, el 0
        inclòs) NO seleccionables** (atenuats): makeFractionKey exigeix
        0 < num < d per construcció (el store no pot representar-los) i
        aquell instant ja se selecciona a l'anell base — s'evita la doble
        representació del mateix instant. La resta de ticks → clic →
        createFractionSelectionFromValue(value, { denominator: d,
        pulsesPerCycle: n }) amb el n/d LITERAL del slot → mateix store →
        canal fracSelN via selectionChannelForFraction (verificat al motor:
        0.5→fracSel1, 1/3→fracSel2, enters legacy).
      - **reconcileFractionSelections** substitueix la detecció d'invàlids
        del timeline-renderer: seleccions fora de Lg o sense anell actiu
        (match literal n/d + posició sobre la graella k·n/d) se SUSPENEN a
        fractionMemory; les suspeses que tornen a tenir anell es restauren.
      - **Bucle permanent**: loopEnabled eliminat (true inlined a
        toPlaybackPulseCount/play/setLoop/escalats); botó loop fora del DOM
        (reorderControls ja no el re-afegeix) + fora l'override CSS
        "TRANSITORI (fins F5)"; appState + createPulseMemoryLoopController
        fora; toggle circular i clau `app4:circular` morts
        (showCircularTimelineToggle: false al renderApp).
      - **Highlights per posició**: visual-sync (mode complet, creat UN cop)
        amb un highlightController adaptador — highlightPulse({step,
        resolution}) → posició = (step/resolution) % Lg →
        rings.highlightPosition (un punt actiu per anell + agulla);
        highlightCycle = no-op i cycleConfig ja NO duu onTick (els
        missatges 'cycle' del worklet només alimenten getVisualState).
        createCycleVoiceHandler/updateVoiceHandlers/handleVoiceEvent i
        audio.setVoiceHandler eliminats (el TODO(F5) es resol per posició,
        no per ticks de veu). **Limitació coneguda**: la quantització
        visual dels anells NO principals és la resolució d'àudio (lcm del
        d principal + d de les seleccions) — un anell ràpid sense
        seleccions (ex. F2=1/12 amb F1=1/2) avança el highlight a salts;
        l'àudio (veus) és exacte igualment.
      - **tIndicator eliminat** (era DOM dins #timeline): la info de T
        passa al panell ⓘ a F7; mentrestant ja viu a la fórmula Lg/V=T/60
        i al tooltip del títol. #tIndicator i tot el CSS de
        pulse*/cycle-marker/cycle-label/timeline/remainder fora de
        styles.css; utils.js només re-exporta solidMenuBackground.
      - **Random**: els pulsos enters segueixen per memòria (ara tots
        candidats); l'aleatorització de seleccions FRACCIONADES queda
        inactiva (applyRandomFractionSelection llegeix store.hitMap, que
        ja no es pobla — només neteja) — re-implementar sobre la graella
        d'anells si es vol, anotat per a F8.
      - gamification-adapter intacte (els seus lookups #pulseSeq/
        #fractionInlineSlot ja eren null-guarded des de F2); notation panel
        intacte (llegeix store/memòria, no DOM de timeline).
      - index.html: enllaça libs/app-common/circular-rings.css ABANS
        d'styles.css (l'app hi pot sobreescriure, ex. endpoint i font
        Ubuntu dels textos SVG).
- [x] **F6 — Partitura multi-fracció** ✅ (codi fet, pendent de commit i de
      VERIFICACIÓ VISUAL al navegador; suite 75/1463 verda). Decisió de
      l'usuari: **pentagrames APILATS, un per fracció, acolorits** (NO veus
      superposades en un sol pentagrama). Arquitectura de mínim risc:
      - `libs/notation/renderer.js` orquestra N renders INDEPENDENTS de
        `createRhythmStaff` (un per pentagrama) en sub-divs apilats dins
        del canvas: pentagrama base "Pulso" (enters, fosc) + un per fracció
        activa amb el color del seu slot. La lògica fràgil de remainder/
        tuplet d'una sola fracció a rhythm-staff queda INTACTA (s'invoca N
        cops). Cicle de vida amb diffing (crea/destrueix/reordena segons
        fraccions actives).
      - Nou param opcional `getActiveFractions` al renderer; sense ell →
        fallback a `getFraction()` (retrocompat App2/App5/altres).
        `getActiveFractionsForNotation()` a App4 afegeix el color (ringColor)
        del slot.
      - `rhythm-staff.js`: param opcional `color` (default null = negre de
        sempre, App2/App5 INTACTES). Acoloreix notes/silencis/plicas +
        tuplets/beams via setStyle/drawWithStyle amb feature-detection;
        respecta notes transparents (showBaseLayer).
      - Enters seleccionats: apareixen al base I a cada pentagrama de
        fracció (decisió documentada al test). Clics ruten a la (n,d) de
        cada pentagrama → canal fracSelN correcte (F4b). Cursor de playback:
        fan-out a tots els pentagrames.
      - +1 suite `libs/notation/__tests__/renderer.test.js` (14 tests:
        estats multi-fracció, retrocompat single, diffing de cicle de vida,
        fan-out cursor, pas de color).
      - CSS: `.notation-panel__canvas` flex-column amb scroll vertical;
        `.notation-staff` amb franja esquerra del color + etiqueta pastilla.
      - PENDENT: captura headless (l'agent va caure per error de socket
        abans de la verificació visual; puppeteer no instal·lat localment)
        → l'usuari ho revisa al navegador.
      - **Retocs post-revisió (2026-06-16)**:
        - Silencis al pentagrama base: `buildBaseStaffState` passa
          `numerator: 1` a buildPulseEvents (cada enter = posició de
          graella → silenci si no seleccionat; abans només emetia els
          enters seleccionats).
        - **BPM 90 per defecte** (DEFAULT_BPM, clau `app4:bpm`): sense V
          inicial computeAudioSchedulingState retornava interval=null i el
          play NO arrencava fins fer random/tap. S'inicialitza abans del
          handleInput inicial, es desa a cada canvi i el reset el neteja.
        - Etiqueta "Pulso" del cercle BASE treta (rings: `label: ''`);
          circular-rings.js omet `.crings-label` quan és buida.
        - **Model treure/afegir** (canvi a F3): desactivar una fracció amb
          "A" la TREU del tot (added≡active; `--hidden`, no atenuada); el
          "+" la torna a afegir amb els valors (el controller els conserva).
          Fora `.fraction-slot--off` i l'estat aria-pressed=false del botó.
          Càrrega: storedActive '0' = treta encara que tingui valors.
      - **Retocs post-revisió 2 (2026-06-16, captures):**
        - El bug de notació era 100% **font-no-carregada al 1r render**
          (confirmat per captures: pliques separades al principi, perfecte
          després d'interactuar). Fix: `ensureNotationRenderer` espera
          `mod.fontsReady` abans del primer render. App23/App24 ja ho feien
          (gate `fontsReady.then`) — verificat, sense bug.
        - Layout fraccions reescrit: fora botons "A"; **control +/− global**
          fixat a la dreta (`.fraction-addremove`: "+" dalt afegeix, "−"
          baix treu l'última; "+" disabled amb 3, "−" amb 0). Fraccions
          centrades com a grup (`justify-content: center`). `min-height` a
          `.fraction-row` perquè el +/− no pugi amb 0 fraccions. Gap
          `clamp(1rem,5vw,3rem)` (reserva espai d'spinners, s'estreny en
          pantalla petita sincronitzat amb `--fr-spin-spread`).
        - Etiquetes d'anell de fracció també tretes (`label: ''`;
          circular-rings respecta `f.label != null`).
        - Bombolles nuzificades (acotat `body.app4`): `.fraction-info-bubble`
          (cream/dark, Ubuntu, clamp, vora; combo-error vora vermella),
          `.hover-tip` (pastilla fosca), `.validation-warning` (groc nuzic).
      - **Retocs post-revisió 3 (2026-06-16) — vista "full" (commit b4f0797):**
        - Partitura = overlay absolut sobre `<main>` (tapa inputs/fraccions/
          anells); header amb la clau de sol accessible per tancar.
        - Controls visibles damunt del full (z-index via
          `main:has(.notation-panel--open) .controls`).
        - Clic fora de la pàgina blanca tanca (a més de la clau de sol).
        - Pentagrames més junts (gap canvas reduït).
        - 1a/última nota alineades entre pentagrames via `staveWidth`
          compartit (nou param additiu a rhythm-staff; renderer = màx events).
- [x] **F6.scroll — Scroll horitzontal únic + cops simultanis alineats**
      ✅ (codi fet, pendent de verificació visual de l'usuari; suite 76/1473):
      **Mòdul `libs/notation/notation-system.js`** (un SVG, N pentagrames, UN
      Formatter compartit → cops simultanis alineats per tick; scroll
      horitzontal únic; un playhead que travessa el sistema). rhythm-staff
      INTACTE (App2/App5 segurs). renderer.js usa el sistema a la via
      multi-fracció.
      **BUG trobat i mitigat (depurat amb Chrome real via CDP — el jsdom de
      l'agent NO el detectava perquè no fa layout SVG):** el formatter
      compartit indexa TickContext per ticks ENTERS sobre RESOLUTION=2¹⁴ (no
      divisible per 11/10) → els tuplets densos de ratio no-2ⁿ (**5/11, 7/10,
      7/11**) queden amb notes DESORDENADES en x → `Tuplet.draw` emet `<rect>`
      d'amplada negativa (errors de consola + render brut). Els errors arriben
      pel domini **Log** de CDP, no per console (per això l'agent els va
      perdre). **Decisió de l'usuari: guarda + acceptar aprox. a les
      exòtiques.** Fix: `isMonotonic(notes)` a notation-system.js salta el
      tuplet/beam si les notes no van esquerra→dreta. Escombrat CDP (totes les
      n 1-7 × d 1-12, m=4 i m=8): 0 casos dolents; les comunes mantenen els
      tuplets. Les 3 exòtiques renderitzen aproximades (sense claudàtor) però
      sense petar. Arnès CDP a /tmp/cdp-*.mjs (Log.enable és la clau).
      **VERIFICAT i FUNCIONANT (2026-06-16):**
      - La guarda no n'hi havia prou: amb 5/11 actiu el formatter COMPARTIT
        corrompia TOTES les veus (sistema sencer col·lapsat, no només
        l'exòtica). Solució definitiva: **posicionament de notes per TEMPS**
        (commit b997b8a) — `note.setXShift` a startX+(t/Lg)·amplada útil
        després del format; alineació i monotonia garantides per a TOTES les
        fraccions, sense dependre dels ticks de VexFlow.
      - **Playhead**: el cursor usa la MATEIXA fórmula que les notes
        (contentStartX + (pos/Lg)·contentWidth, span 0..Lg) → cau sobre la
        nota de cada instant; autoscroll del .notation-panel__canvas el
        segueix. Verificat amb Chrome (proporcional pos 0→74 fins vora dreta).
      - **Etiquetes** (Pulso/n-d) pujades a topLine−20 + TOP_MARGIN 40 (fora
        de la clau de sol). Commit 0d8a024.
      - Usuari confirma: render i playhead funcionen molt bé.
      **Bugs i millores de partitura RESOLTS (post-F6.scroll, 2026-06-17):**
      - Clic a nota TANCAVA el full: el handler "clic-fora" rebia un e.target
        desvinculat (re-render) → closest()=null → tancava. Fix: només tanca si
        `e.target === notationPanel` (backdrop directe). Commit 8038daa.
      - Clic seleccionava una nota 1-2 posicions enllà: l'SVG té
        `pointer-events:none` i, amb `setXShift`, l'únic `<rect>` clicable de
        VexFlow queda desalineat ~67px del cap visible. Fix: `handleClick` calcula
        la nota més propera per la posició REAL del `.vf-notehead` al DOM
        (pentagrama per Y, glyph per X) i despatxa amb els data-*. Commit a83f91e.
      - Random no sincronitzava: només seleccionava enters (el camí fraccionat
        depenia del `hitMap` de DOM de l'App4 lineal, inexistent als anells). Fix:
        `applyRandomRingFractionSelection` (enters + ticks de subdivisió de les
        fraccions actives, construïts com un clic d'anell) + sorteig de n/d dels
        slots actius (enabled per defecte). Commit 02de8a1.
      - Botó de partitura mogut del top-bar a la fila `.controls` (entre tap i
        reset, estètica nuzic teal). Commit 72138e0.
      - Exportació PNG (botó cantonada dreta superior del full): rasteritza l'SVG
        a `<canvas>` 2x amb la font **Bravura** incrustada (`@font-face` data-URI
        woff2 de VexFlow) — sense incrustar-la els caps surten com a rectangles
        ("tofu") perquè l'SVG-com-a-imatge no veu les fonts de la pàgina. Una lib
        de PDF no ho hauria evitat. Commit f1871d4.
      **Millores visuals dels anells (circular-rings, 2026-06-18):**
      - Bandes gruixudes: fraccions `RING_STROKE = 32`; punts r≤10 (a `dotMetrics`).
      - Accent de selecció: per defecte el mòdul deriva `saturatedAccent()` (versió
        saturada del color de l'anell); App4 unifica el **verd nuzic** a tots els
        anells. Seleccionat/actiu = accent ple + glow; **pols 0 = contorn buit**.
      - `GAP 30→40` i `RMAX 256→270` perquè 4 bandes de 32px no se solapin quan
        totes les fraccions van cap enfora.
      - Anell base **el doble d'ample** (`BASE_STROKE = 64`), creix cap ENDINS
        (vora exterior fixa → no mou les fraccions): hi caben els **números**
        (terç interior, clars sobre el fosc) i els **punts** (part exterior). Les
        fraccions lentes (cap endins) reben clearança extra a `resolveRadii` per
        esquivar la banda base ampla. (Abans els números, fora o al centre,
        solapaven amb les fraccions/punts a Lg alt.)
      - Tests de `circular-rings.test.js` actualitzats + `saturatedAccent`.
      ---- història de la verificació de viabilitat ----
      **Viabilitat de ticks VERIFICADA** (script docs/app4-tick-feasibility.mjs):
      - El pentagrama BASE "Pulso" és l'ÀNCORA: cada fracció cau sobre un pols
        enter cada `n` polsos (n≤7) i la base té nota a CADA enter → amb un
        formatter compartit aquestes marques comparteixen tick i queden
        bloquejades. No cal que les fraccions coincideixin entre elles
        (p. ex. 2-contra-3 només comparteix el pols 0).
      - Factor de tick comú D = mcm(denominadors) ≤ 30 fins i tot al pitjor
        cas (5/2+6/5+7/3, cicle 210). VexFlow ho representa exacte (Fraction).
      - Sempre hi ha àncores universals: pols 0 + fronteres de cicle gran + Lg.
      **Enfocament REVISAT** (menys risc que extreure de rhythm-staff):
      com que App4 té model net (Lg múltiple del cicle de cada fracció → MAI
      remainder pulses ni tuplets incomplets), es fa un **mòdul NOU**
      (`libs/notation/notation-system.js`) que reutilitza els helpers
      compartits (`buildPulseEvents`, `resolveFractionNotation`) i renderitza
      el sistema (un SVG, N pentagrames, UN formatter). **rhythm-staff NO es
      toca** → App2/App5 garantidament intactes. renderer.js (App4) usa el
      sistema per la via multi-fracció; la via single (getFraction) segueix
      amb rhythm-staff.
      Pendent (sub-passos, abans com 3a-3f):
      Problema: ara cada pentagrama és un SVG amb formatter PROPI → VexFlow
      espaia per criteri musical, no per temps absolut, i un cop a temps t no
      cau a la mateixa x entre pentagrames. El `staveWidth` compartit només
      alinea 1a/última nota, no els cops intermedis.
      Solució: patró natiu VexFlow de SISTEMA — **UN sol SVG amb N
      pentagrames (Y creixent) i UN formatter compartit** que els alinea per
      tick (temps). Llavors el scroll horitzontal és únic per a tot el sistema
      i un sol playhead vertical el travessa.
      Fases:
      - 3a: extreure de rhythm-staff un helper reutilitzable
        `buildStaveContent(state)` (events→StaveNotes + tuplets + beams +
        color + posició de silencis); el render d'una sola pista el segueix
        usant → App2/App5 INTACTES (verificar tests + visual).
      - 3b: nou render de sistema (un Renderer/SVG, N Stave a Y creixent, un
        Voice per pista, `Formatter.joinVoices` per veu + `format(totes, W)`
        → alineació cross-stave per tick). Color per pista.
      - 3c: scroll horitzontal únic al contenidor (treure overflow per-pista).
      - 3d: UN playhead vertical que travessa tot el sistema (posició per
        temps, ara consistent entre pistes).
      - 3e: clics per delegació a l'SVG únic (data-staff-id + data-pulse →
        canal fracSelN correcte / pols base).
      - 3f: renderer.js usa el sistema en lloc d'N rhythm-staff; cursor des de
        visual-sync. Verificar: npm test, captura headless (cops simultanis
        alineats: F1=1/2+base, F1=3/2+F2=2/3 → punts de cicle compartit
        alineats), scroll únic, un playhead, clics als canals correctes,
        App2/App5 sense canvis.
      Riscos: les veus han de tenir el MATEIX total de ticks i resolució
      consistent perquè els punts compartits comparteixin tick; tuplets ben
      expressats; re-cablejat de color/clic/cursor; fontsReady es manté.
      Esforç alt (millor agent focalitzat o pas a pas amb verificació).
- [x] **F7 — Panell info (∑)** ✅: botó ∑ a `.controls` (esquerra del reset,
      estètica del reset) + `#infoPanel` (overlay flotant nuzic CENTRAT, no tapa
      els controls). Matemàtica via mòdul pur **`libs/app-common/polyrhythm-info.js`**
      (`computePolyrhythmInfo`, amb tests):
      - General: Pulsos (Lg), Ciclos (m), cicle gran = mcm(numeradors), durada
        T = Lg·60/V, mcm(denominadors).
      - Per fracció: velocitat **V·d/n** (coherent amb el radi dels anells),
        pulsos fraccionats/cicle = cicle gran·d/n, reduïda si gcd>1.
      - Proporció polirítmica reduïda INCLOENT el pols (1 : d/n : …) → enters
        (ex.: pols+3/4+2/3 → 6:8:9).
      - Recàlcul EN VIU mentre està obert (via handleInput). Icona ∑ (no hi ha
        símbol Unicode oficial de "matemàtiques"; triat per l'usuari).
- [ ] **F8 — Neteja + docs**: auditoria Step 15 de la skill, README App4
      (usuari), MODULES.md (circular-rings, circular-timeline-ring,
      formula-solver, polyrhythm-info), candidat a esborrar timeline-renderer.js
      (sense consumidors des de F5b), arxiu a docs/session-history/.

### Notes de risc

- F5 és la peça nova gran (geometria + interacció). F6 toca notation-utils
  (historial delicat) — tests per davant. F4 és baix risc (API existent).
- App4 NO té tema nuzic actualment; main.js són 3.009 línies (l'editor
  numèric n'és ~1.200).
- Les claus de selecció `frac:base:n:d` ja són multi-fracció — el store
  de fraction-selection.js no necessita refactor estructural.

## Invariants ràpids (de l'auditoria 2026-06-10, TANCADA — detall a docs/session-history/2026-06-11-auditoria-144-completa.md)

- Worklet: epsilons 1e-9 i acumulació += intocables; el per-sample itera
  `_voiceList` (mai el Map). Fitxers d'alt risc → diff + suite + aprovació.
- **user-interaction.js s'AUTO-ARMA al load del mòdul** (attachListeners a
  module scope) i honora navigator.userActivation — NO és opcional: sense
  l'armat, el primer Play de TOTES les apps queda penjat esperant un gest
  que ja ha passat (regressió A-17 del 2026-06-11, vegeu l'arxiu).
- El context de Tone es PINNA a l'onload de tone-loader (44100, abans que
  cap node existeixi — regla del wiki de Tone); mai swapejar contexts amb
  nodes vius. El hint és rel=prefetch (no preload: les rítmiques no
  executen Tone i Chrome avisa).
- Apps rítmiques SENSE Tone.js al camí d'init (natiu 44100); melòdiques via
  createMelodicAudioInitializer (Tone→gest→start).
- Push en viu al transport NOMÉS via createLiveTransportPush (250ms);
  loop-control amb getter d'audio; circular-timeline.render memoitzat.
- libs/notation → entry/vexflow-nuzic.js; Ubuntu local a shared-ui/fonts.
- UI d'alumne minimalista: el menú hamburguesa SENCER i el menú de
  rendiment són només-dev (?dev / nuzic-debug); el ☰ es renderitza sempre
  (les apps llegeixen els seus elements) però ocult — mai esborrar-ne el DOM.
- App30/31: els forats del model iTfr es materialitzen com a silencis
  (engine.normalizeSilences — mai silencis al final ni adjacents); l'editor
  els mostra com a caselles buides editables; tota mutació del model passa
  per applySequenceMutation.
- Suite: 79 suites / 1502 tests — `npm test` després de cada batch; commits
  amb llista explícita de fitxers (sessions paral·leles comparteixen el repo).
- Verificació CDP: events de confiança, cache desactivada, perfil net, i
  viewport gran (Emulation.setDeviceMetricsOverride) — un clic sota el fold
  no falla, simplement no arriba.
