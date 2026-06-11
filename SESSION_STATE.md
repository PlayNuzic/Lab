# SESSION_STATE — Auditoria 2026-06-10: TANCADA AL 100% (2026-06-11)

**Cap feina pendent de l'auditoria.** Les 144 troballes estan tancades
(aplicades, resoltes per decisió documentada, o refutades) — el detall, per
troballa, és a `docs/audit-report-2026-06-10.md`, i el resum de cada sessió a:

- `docs/session-history/2026-06-10-auditoria-completa-i-aplicacio.md`
- `docs/session-history/2026-06-11-auditoria-mitjanes-completades.md`
- `docs/session-history/2026-06-11-auditoria-144-completa.md` ← invariants nous AQUÍ

## Invariants ràpids per a la pròxima sessió (detall a l'arxiu de dalt)

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
- Suite: 73 suites / 1390 tests — `npm test` després de cada batch; commits
  amb llista explícita de fitxers (sessions paral·leles comparteixen el repo).
- Verificació CDP: events de confiança, cache desactivada, perfil net, i
  viewport gran (Emulation.setDeviceMetricsOverride) — un clic sota el fold
  no falla, simplement no arriba.
