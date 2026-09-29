---
name: graphify-lab
description: "Consulta el graf de coneixement graphify (codi del Lab + corpus teòric Nuzic) per respondre preguntes d'arquitectura, de com s'implementa un concepte (Pulso/iT, Nota/iS, fraccions, polirítmia…) o de quins fitxers es relacionen, ABANS de fer grep per Apps/ i libs/. També per refrescar el graf o sincronitzar el vault d'Obsidian. Només funciona al Mac: el graf viu fora del repo (~/Documents/Nuzic/Corpus)."
---

# graphify-lab — graf de coneixement Lab + teoria Nuzic

**Només al Mac.** Si `CLAUDE_CODE_REMOTE=true` (sessió al núvol) o la ruta del graf no
existeix, aquesta skill no serveix: llegeix directament els fitxers del repo.

This repo's code is indexed (together with the Nuzic theory corpus) in a graphify
knowledge graph. **Before grepping across `Apps/` and `libs/`** to answer a question about
architecture, how a concept is implemented, or which files relate to what:

1. Query the graph first:
   `graphify query "<the question>" --graph "/Users/workingburcet/Documents/Nuzic/Corpus/graphify-out/graph.json"`
2. Trace how two things connect: `graphify path "A" "B" --graph <same path>`
   Explain a node: `graphify explain "NodeName" --graph <same path>`
3. Use the graph to locate the relevant modules/apps, then open those files.

The graph's value here is that it links **Nuzic theory** (Pulso/iT, Nota/iS, iA = intervalo
Armónico, fraccions, polirítmia, simbiosi) to the **Lab code** that implements it — so you can
ask e.g. "which app/lib implements polyrhythm?" and get theory + code together.

Note: Lab's local `graphify-out/` holds only the converted Nuzic corpus (`converted/`,
versioned) plus a gitignored `cache/` — there is **no local `graph.json`**, so a bare
`graphify query "..."` prints `error: graph file not found`. Always pass the explicit
`--graph <path>` to the **external Corpus graph** shown above; with it the query works and
returns results (the error line, if any, is harmless).

Caveats (be honest about them):

- The searchable graph lives in the **Corpus** project, not here: `~/Documents/Nuzic/Corpus/graphify-out/graph.json` (verified 2026-09-01: indexes 424 Lab **source** files — every `.js`/`.json` under `Lab/…`, each appearing exactly once under the canonical `Lab/<path>` form: 344 `Lab/libs/` + 64 `Lab/Apps/` + 14 `Lab/sistema/js/` + `package.json` + `docs/*.mjs`; 8483 nodes / 19872 edges in total with the theory corpus). **CSS and HTML are NOT indexed** (it's an AST graph of code) — for styling/markup questions, read the files directly.
- The graph is a **snapshot** (Lab slice fully re-extracted 2026-09-01 with graphify 0.9.4, AST-only; `built_at_commit` in graph.json says which Lab commit). For brand-new or just-edited code, fall back to reading the actual files — the graph won't have those changes until re-indexed.
- To refresh Lab's slice, run the dedicated script (cwd must be the Corpus dir):
  `cd ~/Documents/Nuzic/Corpus && "$(cat graphify-out/.graphify_python)" /Users/workingburcet/Lab/docs/graphify-update-lab.py [--all]`
  It re-extracts only changed code files (`--all`: every code file — use it after upgrading graphify or if edges look missing), keeps the `Lab/…` paths and `lab_…` ids, **inherits** the ~280 curated community names (never re-clusters) and backs up `graph.json` + `manifest.json` first. Do **not** use `graphify update`, `/graphify --update` or `cluster-only` on this graph directly: they would re-key the Lab ids (duplicating every node) and/or replace the community names with "Community NNN".
  `.graphifyignore` (repo root) keeps `docs/textos ideas sistema nuzic/` (docx/xlsx sources — otherwise `detect()` regenerates `graphify-out/converted/` sidecars inside Lab) and the two graph scripts out of the graph.
- The Obsidian vault `~/Documents/Nuzic/Corpus/graphify-out/Nuzic+Code` mirrors the graph but was hand-reorganised (code notes in `CODI/`, `comunitat/…` tags, per-node community names). After refreshing the graph, sync it with
  `cd ~/Documents/Nuzic/Corpus && python3 /Users/workingburcet/Lab/docs/graphify-vault-sync.py [--dry-run] [--colors]`
  (idempotent; state in the vault's `.nuzic_lab_vault_state.json`; retired notes go to `graphify-out/Nuzic+Code-obsoletes/<ts>/`; `--colors` regenerates the graph-view colour groups in `.obsidian/graph.json`: one per `comunitat/…` tag, same hue per family such as «Motor àudio (Tone.js) (N)»). Never run `graphify export obsidian` on that vault. The other two vaults (`Nuzic teoria`, `Nuzic Teoria Core`) come from their own theory graphs and are unrelated to Lab. Graph-view colour groups for any of the three vaults: `python3 /Users/workingburcet/Lab/docs/graphify-vault-colors.py "<vault dir>" [--dry-run]` (one group per `community:`/`comunitat/…` tag, hue per family; Obsidian re-reads `.obsidian/graph.json` only when the graph view is reopened).
- graphify Python interpreter: `~/.local/share/uv/tools/graphifyy/bin/python3`
