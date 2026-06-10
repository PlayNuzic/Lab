# 2026-06-10/11 — Auditoria: totes les ALTES i MITJANES completades

Continuació de `2026-06-10-auditoria-completa-i-aplicacio.md` (auditoria + QWs + ALTES
+ H-02 + tàctil). Aquesta segona meitat tanca **totes les troballes mitjanes restants**:
estat final de l'informe **67 tancades + 3 refutades de 144** — només queden les ~90
baixes (LA/LP/LU/LH), no verificades adversàriament.

## Motor d'àudio
- **A-10**: el rebobinat de `setTempo` en viu cancel·la les fonts ja agendades al
  lookahead (`_futureSources` per pas absolut + `cancelScheduledVoices()` al SamplerPool)
  — sense flams/dobles clics al canviar tempo o fer tap. Bonus: fuga preexistent
  d'index.test.js arreglada (play() sense stop() → Jest no sortia en runs in-band).
- **A-04**: el missatge 'pulse' del worklet invoca `tick()` directament (`_tickFn`,
  MessagePort no throttlejable) — primer pols immediat, agenda viva en background tabs.
- **P-12**: preload de Tone.js (`<link rel="preload">`) + `prefetchDefaultSamples()` en
  idle — només bytes, l'ordre d'init (Tone → gest → start) intacte.
- **A-12**: 38 mp3 de piano/flauta vendoritzats a `libs/sound/samples/instruments/`
  (offline OK); CDN com a fallback. Verificat amb CDP: 28/28 + 10/10 locals.
- **Bug d'usuari (tempo en calent)**: App27-31 enviaven `setTempo(bpm)` sense escalar
  amb transport escalat per d → d vegades més lent. App28-31 via `applyTransportConfig()`
  (patró App32-35); App27 escala manualment. Verificat: intervalRef 0.5→0.3 exactes.

## Refactors estructurals (libs noves)
- **H-21** `libs/interval-sequencer/itfr-engine.js`: motor compartit App30/31 (barres,
  drag per subdivisions amb Pointer Events, highlights); −810 línies; drag tàctil
  funcional; listeners de document només durant el drag.
- **H-14** `libs/app-common/fraction-app-shell.js`: el shell byte-idèntic d'App26-31
  (preferències+reset, bridge, sound events, toggles↔mixer, mixer menu, theme/mute,
  initAudio rhythm/melodic) en una crida declarativa; −1.115 línies.
- **H-15/H-16** `fraction-timeline.js` + `fraction-highlight.js`: esquelet de timeline
  (decoradors per app) i trio de highlights (reflow load-bearing documentat); −615 línies.
- **H-17** `fraction-editor-nuzic.css`: spinner half-pill + endcaps + franja (els TRES
  blocs provats byte-idèntics; la caixa de l'editor i la fila de subdivisions divergeixen
  de debò i queden per app); −795 línies; vars `--fe-*`.
- **H-07** `addRepeatPress` únic a spinner-repeat.js (+ `options.guard`, guard de botó);
  11 còpies locals fora (−384 línies).
- **H-08** `reorderControls()` exportat de template.js (l'acoblament a les classes del
  template ara viu al mateix fitxer); 13 còpies fora.
- **H-11** `applyTo()` als audio-toggles (patró pending+applyTo del scheduling-bridge);
  App3/App4/shell deixen la reconciliació manual.

## Higiene
- **H-12**: 9 mòduls orfes esborrats (bpm-inline-injector, trio musical-plane,
  registry-playback-autoscroll, rhythm.js, timeline-intervals.js, libs/cards, libs/guide)
  + 6 suites mortes (121 tests de codi que cap app executa). libs/utils i
  timeline-intervals.css VIUS (matisos de la verificació respectats).
- **H-13**: `libs/app-common/logger.js` (`log` gated per `?dev`/`nuzic-debug`); 167
  console.log substituïts als camins calents (libs/sound, App18 per-clic, app10 per-nota,
  App5 game-manager). Verificat: 1 sol log en producció (banner vendor de Tone.js).
- **H-05/H-06**: eines de dev de gamification + debug-game.js d'App5 opt-in amb `?dev`.
- **H-19**: app9/app10/app11/app13 → App9/App10/App11/App13 (git mv en dos passos);
  tots els camins actualitzats; identificadors interns (body class, storage prefix)
  intactes per no esborrar preferències d'usuaris.
- **H-09/H-18/H-23**: re-comentat quirúrgic — WHY-comments a timeline-processor.js
  (diff només-comentaris aprovat per protocol d'alt risc), timeline-layout.js
  (capçalera + JSDoc + condicional mort col·lapsat), JSDoc del scheduling-bridge.

## UX (sistema + apps + shared-ui) — les 15 U-xx mitjanes
- **U-22**: menú de capítols del sistema navegable amb teclat (botons dins de li,
  fletxes, focus management).
- **U-02**: selector de Tema retirat (mort: applyTheme força 'light').
- **U-03/U-04**: mixer — drag sense teleport al re-agafar; obertura per
  contextmenu/teclat (només-obre: idempotent amb mixer-longpress.js, descobert en
  verificar); aria-labels; focus visible als knobs.
- **U-05/U-06**: tooltips amb focus de teclat + auto-amagat tàctil; fora el scrollY
  dels tooltips fixed.
- **U-07**: semàntica unificada als dropdowns — Salir/fora commitegen, Escape reverteix
  el preview al motor.
- **U-09**: en tàctil el primer toc a l'altaveu revela el fader (no muteja).
- **U-10/U-11**: factory reset d'App11/11A (signatura objecte); App2 amb límits BPM
  30-240 (paritat bpm-controller).
- **U-13/U-14**: àrees de hit dels spinners ampliades amb pseudo-elements transparents
  (pointer: coarse); font 16px només en :focus per evitar el zoom d'iOS.
- **U-17..U-20 (sistema)**: touch-action:none als parallax (+100dvh); floor de 320px
  per als iframes en vertical; girar el mòbil ja NO destrueix l'iframe (només els pasos
  amb requiresLandscape re-rendereixen); ?paso sincronitzat a l'URL amb replaceState.

## Metodologia (reforços de la sessió)
- Verificació CDP sempre amb cache desactivada i perfil de Chrome NET — un perfil
  reutilitzat amb cache va donar un fals negatiu (H-13) i un fals positiu (U-04 el va
  destapar de debò: el toggle de contextmenu xocava amb mixer-longpress.js).
- node --check després de cada splice; greps d'orfes després de cada extracció.
- Els identificadors interns (body classes, prefixos d'storage) NO es renombren amb
  els directoris: esborrarien preferències guardades.

## Estat final
- Suite: **71 suites / 1389 tests** verds (les 6 suites mortes d'H-12 n'inflaven 121)
- Mòduls app-common: **50**
- Informe: **67 tancades + 3 refutades / 144**; resten ~90 baixes no verificades
  adversàriament (re-verificar abans d'aplicar)
- Commits del bloc: 81e5bc4, bb415b0, a1cf3db, 7545494, 22322ae, 1321755, b285e80,
  7cc3f99, 03d60fd, 608b800, 0127b17, f95ce9e, 3439bb7, 7372c84, 1eba7cd, dcf9a74,
  398bf98, aa71f72, 843cece, 1a6f580, 43dd61d, 27ec2ed (+ docs)
