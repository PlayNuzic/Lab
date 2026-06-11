# 2026-06-11 — Auditoria 2026-06-10: TANCADA AL 100% (144/144)

Tercera i última sessió de l'aplicació de l'informe (vegeu
`2026-06-10-auditoria-completa-i-aplicacio.md` i
`2026-06-11-auditoria-mitjanes-completades.md` per a les dues primeres).
Aquesta sessió: **les 69 baixes** (verificades adversàriament primer amb 13
agents) i **les 16 mitjanes restants** (re-verificades amb 7 agents més), amb
A-05 tancada sota el protocol d'alt risc (diff complet + aprovació).

## Metodologia de la sessió
- Verificació adversària SEMPRE abans d'aplicar: 20 agents read-only en
  paral·lel contra el codi actual. Resultat: ~12 troballes mortes o ja
  resoltes detectades abans de tocar res (P-11 l'asset ja estava re-exportat;
  H-10 resolt pels docs-sync; H-20 residu = deltes de model; P-22/P-23/LP-05
  codi mort; LH-05 "consumidor" era un test de codi mort...).
- Verificació CDP amb viewport correcte: un "penjament" d'una hora era un
  clic SOTA el viewport headless (756×469) — `elementFromPoint` buit ho va
  destapar. Emulation.setDeviceMetricsOverride als probes des d'ara.
- Cap fix aplicat en codi mort: documentat i tancat per decisió.

## Lots de la sessió (commits)
- `9327b85` motor (LA-01..10, A-14/16/17, LH-13): preset balanced per
  defecte, stop amb fade, preview sense segon context, mixer = state store
  pur + JSDoc, senyal engine-ready (fora polling), decode single-copy...
- `f68d348` rendiment (LP-01..07, P-18..20, P-25..29): highlights per
  referència a tots els hot paths, lookups O(1), tweaks/parallax/density
  in-place, grid-layout.js mort fora.
- `0c34a65` UX (U-23..27, LU-01..06, LU-09): loading states (helper nou
  play-loading.js), reduced-motion, resets in-place (App26-29), random menu
  persistent (10 apps), aria-pressed, contrast del loop, mixer-longpress
  retirat (33 html).
- `040f019` higiene (LH-01..18, LU-08): backups fora, layout de tests
  unificat (11 moviments), exports morts fora, SKILL responsive reescrit.
- `a16e224` les 12 mitjanes (A-06/08/13, P-03..09, P-13, P-15, H-03):
  statechange watcher, **apps rítmiques sense Tone.js al camí crític**
  (natiu 44.1kHz verificat), transport-live-update.js (transitòries de
  tecleig col·lapsades — verificat 1.0→0.25 net), render memoitzat,
  vexflow-nuzic (−400KB), Ubuntu local (0 googleapis), loop-control amb
  getter.
- A-05 (worklet, ALT RISC): _voiceList + fill redundant fora + branca morta
  fora — diff complet aprovat per l'usuari; cap epsilon tocat.

## Invariants nous (consolidats a SESSION_STATE fins ara, ara aquí)
- Epsilons 1e-9 del worklet i acumulació += : INTOCABLES (re-confirmat a A-05)
- El worklet itera _voiceList (array sincronitzat als missatges) — no re-
  introduir `for (const v of this.voices.values())` al per-sample
- Apps rítmiques: CAP Tone.js al camí d'init (natiu 44100); melòdiques:
  Tone→gest→start a createMelodicAudioInitializer
- Push en viu al transport: via createLiveTransportPush (250ms trailing,
  isLive al dispar) — mai updateTransport directe des de handleInput
- loop-control: audio com a GETTER (() => audio); mai instància a la creació
- circular-timeline.render memoitza per (lg, isCircular): si cal forçar,
  invalidar wipe-jant el timeline (isConnected ho detecta)
- musical-grid: getContainerRect (cache per frame) per a TOTS els reads de
  rect en bucles; computeCellBounds ja la usa
- libs/notation importa entry/vexflow-nuzic.js (mai entry/vexflow.js)
- Ubuntu és local (libs/shared-ui/fonts/); cap @import de Google Fonts
- Suite: 73 suites / 1390 tests

## Estat final del repo
- Informe: **144/144 tancades** (algunes per decisió documentada: A-15,
  P-21/22/23, LP-05/09/10, LU-07 — el perquè és a cada troballa)
- Mòduls app-common: 49 · Suite: 73/1390 · Working tree net

## Postdata (mateixa nit): regressions del lot d'àudio, caçades i resoltes

L'usuari va reportar primer-play mort a ~25 apps + App20 trencada. Diagnòstic
amb cronologia CDP en Chrome REAL (headless no ho reproduïa: el seu autoplay
lliure i el seu device fake amagaven el problema):

1. **Causa arrel**: A-17 va eliminar la subscripció waitForUserInteraction del
   constructor de l'AudioMixer — era l'ARMAT IMPLÍCIT del gate d'interacció a
   la càrrega de cada pàgina. Sense ell, el gate s'armava post-await (després
   de carregar Tone) = després del clic → ready() penjat fins a un segon gest.
   Lliçó: abans d'esborrar "codi mort", buscar-ne els EFECTES LATERALS
   (aquella crida "morta" era load-bearing per a tot el repo).
2. El pinning de sampleRate s'ha mogut a l'onload de Tone (abans que cap node
   existeixi) — el preload del piano construïa samplers sobre el context
   auto-creat que després es swapejava/tancava (App24: "Connecting nodes
   after the context has been closed").
3. H-08 havia deixat 3 apps usant `controls` sense declarar (App20 no
   arrencava; App30/31 ReferenceError) — es captura el retorn de
   reorderControls().
4. Satèl·lits: close() del context com a promesa (rebuig absorbit — Tone v15
   ja tanca el vell dins setContext), preload→prefetch del hint de Tone,
   _restoreBusGains cancel·la l'automatització abans de restaurar.

Commit: b43e138. Lliçó de probes: headless ≠ Chrome real per a àudio
(autoplay policy, device rate); i navegar la pestanya ABANS d'activar
Network.setCacheDisabled serveix mòduls vells del perfil.
