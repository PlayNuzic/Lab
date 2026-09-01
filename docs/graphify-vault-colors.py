#!/usr/bin/env python3
"""Grups de color per comunitat a la vista de graph d'un vault d'Obsidian generat per graphify.

Ús:  python3 /Users/workingburcet/Lab/docs/graphify-vault-colors.py "<carpeta del vault>" [--dry-run]

Llegeix les notes del vault (frontmatter `community:` + etiquetes `comunitat/…` o `community/…`
tal com són a les notes) i reescriu NOMÉS `colorGroups` de `.obsidian/graph.json`: un grup per
comunitat (query `tag:#…`, amb OR si una comunitat té variants d'etiqueta), mateix to per família
(«Sistema Nuzic», «Sistema Nuzic (2)»… comparteixen to; les germanes canvien de claredat) i tons
repartits per angle d'or segons la mida de la família. La resta de paràmetres de la vista es
conserven; l'anterior queda a `<vault>/../<nom>-obsoletes/<ts>/.obsidian/graph.json`.
Obsidian només rellegeix graph.json en obrir la vista de graph: si el vault és obert, tanca i
torna a obrir la vista (o el vault) després d'executar-ho.
"""
import json, re, sys, time, shutil, collections, colorsys
from pathlib import Path

def color_groups(vault: Path):
    tags_by, size = collections.defaultdict(set), collections.Counter()
    for p in vault.rglob('*.md'):
        if '/.obsidian' in str(p) or p.name.startswith('_COMMUNITY_'): continue
        t = p.read_text(encoding='utf-8', errors='ignore'); c = re.search(r'^community: "(.*)"$', t, re.M)
        if not c: continue
        name = c.group(1).replace('\\"', '"'); size[name] += 1
        tags_by[name].update(re.findall(r'(?:^  - |#)((?:comunitat|community)/\S+)', t, re.M))
    fam = lambda n: re.sub(r'\s*\(\d+\)$', '', n)
    families = collections.defaultdict(list)
    for n in size: families[fam(n)].append(n)
    ranked = sorted(families, key=lambda f: (-sum(size[n] for n in families[f]), f))
    groups = []
    for rank, f in enumerate(ranked):
        hue = (rank * 0.618033988749895) % 1.0
        sibs = sorted(families[f], key=lambda n: (-size[n], n))
        for k, n in enumerate(sibs):
            light = 0.55 if len(sibs) == 1 else 0.42 + 0.24 * (k % 5) / 4
            r, g, b = colorsys.hls_to_rgb(hue, light, 0.62)
            q = ' OR '.join(f'tag:#{t}' for t in sorted(tags_by[n]))
            if q: groups.append({'query': q, 'color': {'a': 1, 'rgb': (int(r * 255) << 16) | (int(g * 255) << 8) | int(b * 255)}})
    return groups, len(families), dict(size)

def apply(vault: Path, dry: bool = False) -> tuple[int, int]:
    vault = vault.resolve(); assert vault.is_dir(), f'no és un directori: {vault}'
    gj = vault / '.obsidian' / 'graph.json'
    cfg = json.loads(gj.read_text(encoding='utf-8')) if gj.exists() else {}
    groups, nfam, size = color_groups(vault)
    print(f"{vault.name}: {len(size)} comunitats en {nfam} famílies → {len(groups)} grups de color (abans: {len(cfg.get('colorGroups', []))})")
    if dry or not groups: return len(groups), nfam
    ts = time.strftime('%Y%m%d-%H%M%S')
    if gj.exists():
        dst = vault.parent / f'{vault.name}-obsoletes' / ts / '.obsidian' / 'graph.json'; dst.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(gj, dst)
    cfg['colorGroups'] = groups; gj.parent.mkdir(exist_ok=True)
    gj.write_text(json.dumps(cfg, indent=2, ensure_ascii=False), encoding='utf-8')
    print(f'  ESCRIT {gj} (anterior a {vault.parent / (vault.name + "-obsoletes") / ts}/.obsidian/)')
    return len(groups), nfam

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args: print(__doc__); sys.exit(2)
    apply(Path(args[0]), dry='--dry-run' in sys.argv)
