# Arnès de Claude Code — PlayNuzic Lab

Què rep Claude quan treballa al Lab, i on viu cada peça. Tot és al repo (`.claude/`),
de manera que el tenen igual les sessions locals (Mac) i les del núvol (claude.ai/code).
Les regles de fons són a `CLAUDE.md`; aquest document només descriu l'arnès.

## Skills (`.claude/skills/`)

Es carreguen quan la tasca hi encaixa, o amb `/nom`.

| Skill | Per a què |
|---|---|
| `/creator` | Crear una app nova (`Apps/AppN/`) amb el patró d'inicialització estàndard i els mòduls de `libs/`. |
| `/responsive` | Adaptar una app a mòbil i tàctil amb les convencions reals del repo (`clamp()`, `max-width: 600px/900px`, `pointer: coarse`). |
| `/nuzic-migrate` | Migrar una app al tema visual nuzic (controls, timeline, soundline, editors). És llarga (~4260 línies): llegeix-ne primer la secció "How to navigate this skill". |
| `/aplicar-tweaks` | Passar al codi l'export JSON del panell tweaks del `sistema/` (textos, densitat, presets del parallax). No fa commit. |

Les skills generals que no són del Lab (p. ex. `graphify`) viuen a `~/.claude/skills/`
del Mac i no es versionen aquí.

## Permisos i hooks (`.claude/settings.json`, `.claude/hooks/`)

| Peça | Què fa |
|---|---|
| `permissions.ask` | Editar un fitxer de Nivell 1 (llista a `.claude/hooks/nivell1.mjs`) demana confirmació. |
| `PreToolUse` Bash → `guard-nivell1.mjs` | Demana confirmació si una ordre de shell pot escriure un fitxer de Nivell 1 (`sed -i`, redireccions, `mv`, `cp`, `rm`, `git checkout`…) o fa una edició massiva dins `libs/`. Heurístic: pregunta, mai no bloqueja. |
| `PostToolUse` Edit/Write → `related-tests.mjs` | Passa `jest --findRelatedTests` sobre el fitxer editat (2-8 s). Si fallen, Claude rep l'error i l'ha d'arreglar abans de continuar. |
| `SessionStart` → `session-start.sh` | Només al núvol: `npm install --no-save`, perquè els tests funcionin des del primer moment. |

`tests/claude-hooks.test.js` prova els hooks i comprova que la llista de Nivell 1 coincideix
amb `permissions.ask`. La CI (`.github/workflows/test.yml`) passa `npm test` a cada push i PR.

## Fitxers de Nivell 1

Els defineix `CLAUDE.md` ("High-Risk Files"). **Es poden modificar**, però abans cal llegir-ne
els tests, passar tota la suite i ensenyar el diff complet per aprovar-lo. L'arnès ho fa
complir: demana confirmació abans de l'edició i, després, recorda el pas de la suite i el diff.

## Què és personal i no es versiona

`.gitignore` exclou `.claude/settings.local.json`, `.claude/worktrees/` i `.claude/launch.json`
(servidors de previsualització amb rutes del Mac).
