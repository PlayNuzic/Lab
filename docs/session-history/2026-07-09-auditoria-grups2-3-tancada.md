# 2026-07-09 — Auditoria 2026-07-06: TANCADA (58/59; T-04 aparcada per decisió)

Segona i última sessió d'aplicació de l'informe `docs/audit-report-2026-07-06.md` (la
primera: `2026-07-06-auditoria-grup1.md`, els 37 auto-fix segurs). Aquesta sessió: el
**Grup 2** (11 decisions, resoltes una a una amb l'usuari) i el **Grup 3** (11 d'alt risc,
protocol Nivell 1 complet a cadascuna). Suite final: **89 suites / 1472 tests** (línia
base de l'informe: 78/1397 — +11 suites i +75 tests de regressió/contracte nous).

## Grup 2 — decisions de l'usuari i aplicació (commits `361bfd56`..`3791f4b5` + `fef4270e`, `fc3ca2dd`)

- **A-06 opció completa + H-11 combinats** (`361bfd56`): fallback real a `wireParallax()` si
  el motor del Lab no carrega (forma if/else per esquivar el footgun del `??`) + esborrades
  les 2 branques mortes del layout `'P-parallax'`. **La "regla d'or" del parallax (no tocar
  wireParallax/slides reals) es RETIRA per decisió de l'usuari**: era de la fase de
  construcció del Lab; wireParallax ara és, a més, el fallback d'A-06 (si es toca la lògica
  de gestos, revisar-la als dos llocs).
- **P-06** (`3532a56a`): compositor de filter escopat a `.px-filter` amb comptador de
  referències (WeakMap) perquè color-shift (per herència) i depth-blur (per capa) no es
  trepitgin; mask-zoom doblat a `(0,4,0)`. +4 tests.
- **P-04** (`fc3ca2dd`): `setConfig(..., persist)` — l'input del slider aplica en viu sense
  desar; desa un cop al `change`.
- **H-08** (`5cdfb07c`): LED managers morts fora d'App2/App5; **App4B intacta per decisió**
  (congelada com a referència).
- **H-04 / D-10 / A-03** (`d548523f`): documentats — les 3 implementacions de Lg/V=T/60 són
  DELIBERADES (no unificar); llindars reals d'App5 (300ms + únic 50%); A-03 (ear-training
  llegeix `timingTolerance`, el consumidor escriu `tolerance`) queda com a PENDENT CONEGUT
  (subsistema dorment).
- **T-03** (`fef4270e`): EPSILON mort fora de `subdivision.js` (protocol N1 obert per
  decisió; diff aprovat).
- **T-04**: APARCADA per decisió — lligada a A-03; re-obrir juntes.
- **H-14** (`a9590fcc`): dedup del bloc spinner (62 línies × 4) cap a
  `fraction-editor-nuzic.css`, amb verificació visual before/after amb l'usuari (App32
  pilot). **Bonus** (`3791f4b5`): la verificació va destapar un defecte pre-existent de tota
  la família complexa (App29/31/33/35) — spinners superposats < ~900px; fix d'una línia a la
  lib: `height: min(2.8rem, 90%)` (confinats al seu camp per construcció; captures
  abans/després a 800/1400px).

## Grup 3 — alt risc, un per un (protocol: diff complet → aprovació → MUTACIÓ → suite)

Cada fix es va verificar amb **prova de mutació** (revertir el fix i confirmar que els tests
nous cauen) — cap test que no mossegui.

- **T-01** (`bff7453b`): contracte executable de l'epsilon 1e-9 del worklet (fitxer propi per
  la cache ESM; NO es testeja la igualtat exacta a 1e-9, frontera inestable per FP).
- **H-15** (`631a7e67`): branca morta `requestedSampleRate` fora (creava ctx sense gest,
  sample rate arbitrari, sense close()).
- **A-09** (`a5f964c7`): `_previewGain` es neteja al teardown (previews muts post-canvi de
  context).
- **A-04** (`21d843f8`): cadena FX SEMPRE cablejada; condicional només a la sortida del
  màster. Cobertura nova de la branca d'efectes (mock capaç + BFS d'abastabilitat
  master→destination) — abans zero tests.
- **A-05** (`7f5dcb24`): `play()` desenganxa `_futureSources` de la sessió anterior (guard
  `isPlaying` neutralitza el risc residual 1; risc 2 — comptabilitat melòdica — pendent
  conegut). Lliçó de test: try/finally{stop()} o el scheduler penja jest en fallar.
- **A-08** (`c0cdd359`): context 'closed' → teardown + `_ctx=null` + **engine-ready
  re-armable** (el senyal retorna sempre el bus vigent). Limitació documentada: instruments
  JA carregats queden lligats al context mort fins a recarregar.
- **P-03** (`330a70bc`): priming d'`ensureAudio` run-once (bloc conservat per A-17).
- **A-12** (`32bf8fa7`): `if`→`while` al comptador de veus + DOBLE guarda anti-penjada
  (sanejament Number.isFinite a `_addVoice` + topall 128 emissions/sample — el bucle és
  finit per construcció).
- **A-11** (`a97ca2f8`, **decisió: opció graella**): `setVoices` en viu fa merge per id (la
  veu que sobreviu conserva fase/subIndex) i la nova s'ancora al proper múltiple del seu
  període des de l'inici de mesura.
- **A-10** (`08c92b57`): NOMÉS documentació — divergència de l'align `'cycle'` (fil principal:
  múltiple del numerador en passos absoluts; worklet: wrap de mesura). API latent; decisió
  de producte pendent, sentinella al codi.
- **H-01** (`17f61baa`): extracció del grid editor duplicat d'App32-35 →
  `libs/plano-modular/plano-grid-editor.js` (factory amb context; −1.248 línies; els 5 traps
  gestionats; workflow arquitecte Fable → Sonnet verbatim MD5 → revisió adversària → CDP per
  app + prova manual de l'usuari — l'scroll horitzontal no aplica a aquestes apps, graelles
  1fr).

## Invariants nous/actualitzats (consolidats als CLAUDE.md de libs/sound i app-common)

- `setVoices` en viu: MERGE per id + ancoratge a graella — mai reiniciar tothom a countdown 0.
- Veus: períodes sanejats (Infinity/NaN→1) + catch-up `while` amb topall 128/sample.
- `configurePerformance` ja NO accepta `requestedSampleRate` — NO re-introduir.
- align `'cycle'`: NO usar sense resoldre la divergència documentada (A-10).
- engine-ready: senyal re-armable; retorna sempre el bus vigent.
- La cadena FX interna sempre cablejada; només la sortida del màster commuta.
- Fórmula Lg/V=T/60: TRES implementacions deliberades, no unificar (H-04).
- La "regla d'or" del parallax vell queda retirada; wireParallax = fallback d'A-06.

## Pendents coneguts (documentats al codi, re-obrir quan toqui)

- **A-03 + T-04 + exercise-runner:56**: família tolerance/timingTolerance de l'ear-training
  (subsistema dorment) — resoldre com a paquet amb calibratge de valors.
- **A-10**: decisió de producte sobre l'align 'cycle' si mai s'activa.
- **A-05 risc 2**: comptabilitat melòdica (`_cancelScheduledNotes`) amb la mateixa
  obsolescència de sessió.
- **A-08**: recuperació d'instruments ja carregats post context-closed (re-init de samplers).

## Estat final

- Informe: **58/59 tancades** (T-04 aparcada amb nota). Checkboxes marcades a l'informe.
- Suite: 89 suites / 1472 tests, tot verd. Working tree net.
- Metodologia consolidada: prova de MUTACIÓ obligatòria per a tests nous de Nivell 1;
  scripts petits a disc per a tota reconstrucció (mai JSON gros inline — talls de connexió);
  journals dels workflows com a font de veritat recuperable.
