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
- [ ] **F5 — Mòdul `libs/app-common/circular-rings.js`** + tests: N anells
      concèntrics, radi ∝ velocitat (fórmula de dalt), punts/etiquetes
      adaptatius, clic-per-seleccionar, highlight de playback per anell,
      responsiu. App4 el consumeix; es retira timeline lineal.
- [ ] **F6 — Partitura multi-fracció**: notation-utils/rhythm-staff amb
      una veu per fracció (Lg sempre múltiple de cada cicle ⇒ MAI tuplets
      incomplets ni remainder pulses — la zona dels 5 fixes històrics
      desapareix). Decidir aquí: pentagrames apilats vs límit de veus.
- [ ] **F7 — Panell info "ⓘ"**: estendre formula-renderer.js (compartit,
      amb tests) amb cicle gran, mcm denominadors, proporció reduïda, etc.
- [ ] **F8 — Neteja + docs**: auditoria Step 15 de la skill, README App4,
      MODULES.md (circular-rings), arxiu a docs/session-history/.

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
- Suite: 73 suites / 1399 tests — `npm test` després de cada batch; commits
  amb llista explícita de fitxers (sessions paral·leles comparteixen el repo).
- Verificació CDP: events de confiança, cache desactivada, perfil net, i
  viewport gran (Emulation.setDeviceMetricsOverride) — un clic sota el fold
  no falla, simplement no arriba.
