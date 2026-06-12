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
- [ ] **F2 — Eliminar editor numèric**: fora buildPulseSeqMarkup,
      sanitizePulseSeq, spacing, token-map (~1.200 línies de main.js). La
      selecció per clic a timeline ja n'és independent.
- [ ] **F3 — 3 fraccions + model Lg**: array de fraccions amb actiu/valors
      persistits (`app4:f1..f3`), pill "Cicles (m)", display Lg calculat,
      validateFractionCombo (cicle ≤ 210, tooltip amb el mcm explicat),
      random menu adaptat (aleatoritza fraccions actives + m; Lg derivat).
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
