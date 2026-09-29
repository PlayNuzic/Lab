# 2026-09-29 — Arnès de Claude Code, P1: permisos, hooks i CI

Primera fase de l'arnès ("harness engineering": convertir regles escrites en
mecanismes). Anàlisi prèvia a la sessió: Lab + els dos repos d'Alberton-projects.

## Què s'ha fet

- `.gitignore`: ja no s'ignora tot `.claude/`, només `settings.local.json` i
  `worktrees/`. L'arnès viatja amb el repo i el tenen també les sessions al núvol.
- `.claude/settings.json`:
  - `permissions.ask` per a `Edit` dels 4 fitxers de Nivell 1.
  - `PreToolUse` sobre Bash → `.claude/hooks/guard-nivell1.mjs`: demana confirmació
    si una ordre pot escriure un fitxer de Nivell 1 (`sed -i`, `perl -i`, `>`, `tee`,
    `mv`, `cp`, `rm`, `git checkout/restore…`, `writeFile`) o si és una edició
    massiva dins `libs/` (find/xargs/globs/`$(...)`). Mai bloqueja; només pregunta.
    Límit conegut: `cd libs/sound && sed -i … index.js` no es detecta.
  - `PostToolUse` sobre Edit/Write → `.claude/hooks/related-tests.mjs`:
    `jest --findRelatedTests` (2-8 s). Si fallen, `decision: "block"` amb el detall;
    si el fitxer és de Nivell 1, recorda passar `npm test` sencer i ensenyar el diff.
  - `SessionStart` → `.claude/hooks/session-start.sh`: `npm install --no-save` només si
    `CLAUDE_CODE_REMOTE=true` (síncron, ~10 s).
- `.claude/hooks/nivell1.mjs`: llista única dels fitxers de Nivell 1.
- `.github/workflows/test.yml`: `npm ci` + `npm test` a cada push i PR (Node 22).
- `tests/claude-hooks.test.js`: 28 tests (coherència llista/settings, 13 ordres que
  han de preguntar, 11 que no, contracte JSON del hook).

## Validació

Suite sencera: 93 suites, 1566 tests. Hook de tests relacionats provat en verd
(133 tests de `subdivision.js`) i en vermell (canvi injectat → `block` amb el test).

## Skills al repo (mateix dia)

Les skills del Lab ja eren a `~/Lab/.claude/skills/` (no a `~/.claude/skills/`, com deia
`docs/agents-context.md`) i quedaven amagades pel `.gitignore`. Són 4: `aplicar-tweaks`,
`creator`, `nuzic-migrate`, `responsive` (`ui`, `audio`, `modules` i `gamification` ja no
existien). Pujades des del Mac (23c9b33) i corregides:

- `creator`: importava `bindRhythmElements`, que no existeix → `bindAppRhythmElements(appId)`;
  no totes les apps tenen `CLAUDE.md` (8 de 39).
- `aplicar-tweaks`: enllaços relatius a `.claude/sistema/` → `../../../sistema/`; xifra de
  tests fixa treta.
- `nuzic-migrate`: "SESSION_STATE.md punt N" → acta de 2026-05-14 (on ara viu el
  "Coneixement consolidat"); ruta del Mac a `nuzic_app` treta; enllaç relatiu; mida real.
- `responsive`: `--col-left`/`--col-right` són del layout de columnes que la migració nuzic
  elimina, no variables per a apps noves.
- `docs/agents-context.md` reescrit: les 4 skills reals, els hooks i els Nivell 1 com a
  "modificables amb aprovació" (abans hi deia "MAI").
- `.claude/launch.json` ignorat (rutes del Mac, Mapa Nuzic).

## P2 (mateix dia)

- `npm run smoke` (`tests/smoke.mjs`): arrel, catàleg, sistema i les 39 apps en Chromium
  headless, xarxa externa bloquejada; falla amb errors de JS, de consola o recursos locals.
  42/42 netes en ~23 s. Un import trencat a `Apps/App15/main.js`: Jest no el veu, el smoke sí.
  `playwright` fixat a 1.56.1 (el Chromium del núvol). Job `smoke` a la CI.
- Guies: fora `.claude-code/integration-config.yaml`; README sense `./setup.sh` (no existeix),
  sense Babel (no s'usa) i sense recomptes; CLAUDE.md i MODULES.md sense recomptes;
  ruta correcta de `docs/LAB_SYSTEM_RULES.md`.
- graphify: de CLAUDE.md (8,8 → 5,0 KB) a `.claude/skills/graphify-lab/`.
- Alberton (els dos repos), branca `claude/harness-p2`, **sense pujar** (l'app de GitHub de
  Claude no hi és instal·lada): `tools/check_rules.py` + tests (vocabulari privat guardat com a
  hashes, anglès al codi, noms de set a `devices/`, les 11 ops i el bind 127.0.0.1 del Remote
  Script), CI `checks.yml` i hook `SessionStart` que diu que Live no és accessible al núvol.

## P3

- `tests/docs-paths.test.js`: les 99 rutes citades a guies i skills han d'existir (sensor
  computacional de deriva).
- Rutina "Deriva documental del Lab" (`trig_01QwdLyqDwYwwXwRmYFuogaz`): dilluns 8:52 (Madrid),
  sessió nova que revisa guies i skills contra el codi i obre PR només de documentació. Creada
  sense connectors: si no pot obrir la PR, puja la branca i deixa l'enllaç a l'informe.
- mcp-for-live: `SESSION-LOG.md` de 661 a 310 línies; les entrades del 2 al 5 d'agost, intactes,
  a `docs/history/` (branca `claude/harness-p2`, sense pujar).
- CI del Lab: push només a main (abans cada push amb PR s'executava dues vegades).

## Pendent

- Instal·lar l'app de GitHub de Claude a l'organització Alberton-projects i pujar les dues
  branques `claude/harness-p2` (o aplicar els patches des del Mac).
