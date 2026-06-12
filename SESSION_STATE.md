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
- [ ] **F4 — Àudio polirítmic**: scheduling.voices amb una veu per fracció
      activa (API setVoices ja existent — App4 té el handler esquelet
      updateVoiceHandlers mai usat); canals de mixer dinàmics per fracció
      amb nom/color. SENSE tocar fitxers d'alt risc.
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
- Suite: 73 suites / 1391 tests — `npm test` després de cada batch; commits
  amb llista explícita de fitxers (sessions paral·leles comparteixen el repo).
- Verificació CDP: events de confiança, cache desactivada, perfil net, i
  viewport gran (Emulation.setDeviceMetricsOverride) — un clic sota el fold
  no falla, simplement no arriba.
