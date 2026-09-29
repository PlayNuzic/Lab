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

## Pendent

- P2: test de fum amb Chromium de les 39 apps (prototip: 21 s, 0 errors), neteja de
  guies contradictòries (`.claude-code/integration-config.yaml`, xifres del README),
  graphify de CLAUDE.md a una skill.
