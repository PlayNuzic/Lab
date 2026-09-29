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
  - `SessionStart` → `.claude/hooks/session-start.sh`: `npm install` només si
    `CLAUDE_CODE_REMOTE=true` (síncron, ~10 s).
- `.claude/hooks/nivell1.mjs`: llista única dels fitxers de Nivell 1.
- `.github/workflows/test.yml`: `npm ci` + `npm test` a cada push i PR (Node 22).
- `tests/claude-hooks.test.js`: 28 tests (coherència llista/settings, 13 ordres que
  han de preguntar, 11 que no, contracte JSON del hook).

## Validació

Suite sencera: 93 suites, 1566 tests. Hook de tests relacionats provat en verd
(133 tests de `subdivision.js`) i en vermell (canvi injectat → `block` amb el test).

## Pendent

- Copiar al repo les 6 skills de `~/.claude/skills/` (ui, audio, modules, creator,
  gamification, responsive) → `.claude/skills/`. Només es pot fer des del Mac.
  En copiar-les, alinear `/audio` i `docs/agents-context.md` amb els nivells de
  CLAUDE.md (ara hi diu "MAI" modificar els fitxers de Nivell 1).
- P2: test de fum amb Chromium de les 39 apps (prototip: 21 s, 0 errors), neteja de
  guies contradictòries (`.claude-code/integration-config.yaml`, xifres del README),
  graphify de CLAUDE.md a una skill.
