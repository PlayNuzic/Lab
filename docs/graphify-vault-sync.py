#!/usr/bin/env python3
"""Sincronitza les notes de CODI del Lab al vault d'Obsidian «Nuzic+Code» amb graph.json del Corpus.

Ús (cwd = Corpus):
    cd ~/Documents/Nuzic/Corpus && python3 /Users/workingburcet/Lab/docs/graphify-vault-sync.py [--dry-run] \
        [--seed-from graphify-out/graph.json.bak-…]     # només la primera vegada (lliga notes existents a ids)

Per què no `graphify export obsidian`: el vault es va reorganitzar a mà el 05/07 (notes de codi
a CODI/, etiquetes `comunitat/…`, noms de comunitat curats per node); l'exportador escriuria
8.000 notes noves a l'arrel, no esborra res i posaria «Community N» a la majoria de comunitats.

Què fa (només nodes amb source_file 'Lab/…'; la teoria i els altres repos no es toquen):
  - estat `.nuzic_lab_vault_state.json` al vault: id de node → nota (els noms de fitxer són
    estables encara que el label canviï, així els [[enllaços]] d'altres notes no es trenquen);
  - regenera cada nota en el format exacte del vault i només escriu si el contingut canvia;
  - nodes nous → nota nova a CODI/ (nom = label, sufix _N si ja existeix al vault);
  - nodes desapareguts → la nota es mou a graphify-out/Nuzic+Code-obsoletes/<ts>/ (fora del vault);
  - notes _COMMUNITY_ de les comunitats amb algun membre del Lab: es reescriuen si canvia la
    llista de membres (o no existeixen).
"""
import json, os, re, sys, time, shutil, collections, difflib
from pathlib import Path

CORPUS = Path('/Users/workingburcet/Documents/Nuzic/Corpus'); OUT = CORPUS / 'graphify-out'
GRAPH = Path(os.environ.get('VAULT_SYNC_GRAPH') or OUT / 'graph.json'); VAULT = OUT / 'Nuzic+Code'; CODI = VAULT / 'CODI'
STATE = VAULT / '.nuzic_lab_vault_state.json'; OBSOLETS = OUT / 'Nuzic+Code-obsoletes'
DRY = '--dry-run' in sys.argv
SEED = Path(sys.argv[sys.argv.index('--seed-from') + 1]) if '--seed-from' in sys.argv else None
assert Path.cwd() == CORPUS, f'executa-ho des de {CORPUS}'
assert VAULT.is_dir() and CODI.is_dir(), 'vault Nuzic+Code/CODI no trobat'

SAFE = re.compile(r'[\\/*?:"<>|#^\[\]]')
def safe_name(label):
    s = SAFE.sub('', str(label).replace('\r\n', ' ').replace('\r', ' ').replace('\n', ' ')).strip()
    s = re.sub(r'\.(md|mdx|qmd|markdown)$', '', s, flags=re.I)
    return s if re.search(r'\w', s) else 'unnamed'
def comm_slug(name):  # regla de les etiquetes comunitat/ de les notes existents (17/07)
    s = re.sub(r'[()\[\]{}·,.:;!?"\'’|↔→/]', '', str(name)); s = re.sub(r'[\s+&]', '-', s)
    return re.sub(r'-{2,}', '-', s).strip('-') or 'x'
def comm_stem(name): return '_COMMUNITY_' + safe_name(str(name).replace(':', '-'))
def yaml(s): return str(s).replace('\\', '\\\\').replace('"', '\\"')
def is_lab(n): return str(n.get('source_file', '')).startswith('Lab/')
def loc(n): return str(n.get('source_location') or '')
def nlabel(s): return re.sub(r'\(\)$', '', str(s))

# ── graph ──
g = json.loads(GRAPH.read_text(encoding='utf-8')); nodes = {n['id']: n for n in g['nodes']}
adj = collections.defaultdict(dict)
for l in g['links']:
    rc = (l.get('relation', ''), l.get('confidence', 'EXTRACTED')); adj[l['source']][l['target']] = rc; adj[l['target']][l['source']] = rc
node_comm = {i: n.get('community_name') for i, n in nodes.items()}
members = collections.defaultdict(list)
for i, n in nodes.items(): members[n.get('community_name')].append(i)
inter = collections.defaultdict(collections.Counter)
for l in g['links']:
    cu, cv = node_comm.get(l['source']), node_comm.get(l['target'])
    if cu is not None and cv is not None and cu != cv: inter[cu][cv] += 1; inter[cv][cu] += 1

# ── vault ──
idx_loc, idx_key, stems, comm_files, slug_votes = {}, collections.defaultdict(list), set(), {}, collections.defaultdict(collections.Counter)
for p in list(VAULT.glob('*.md')) + list(CODI.glob('*.md')):
    stems.add(p.stem); txt = p.read_text(encoding='utf-8', errors='ignore')
    h = re.search(r'^# (.*)$', txt, re.M)
    if p.name.startswith('_COMMUNITY_'):
        if h: comm_files[h.group(1)] = p.name
        continue
    m = re.search(r'^source_file: "(.*)"$', txt, re.M); lc = re.search(r'^location: "(.*)"$', txt, re.M)
    if not (m and h): continue
    rel = str(p.relative_to(VAULT)); idx_loc.setdefault((m.group(1), nlabel(h.group(1)), lc.group(1) if lc else ''), rel); idx_key[(m.group(1), nlabel(h.group(1)))].append(rel)
    if m.group(1).startswith('Lab/'):
        c = re.search(r'^community: "(.*)"$', txt, re.M); t = re.search(r'comunitat/(\S+)', txt)
        if c and t: slug_votes[c.group(1).replace('\\"', '"')][t.group(1)] += 1
def slug_of(name): return slug_votes[name].most_common(1)[0][0] if slug_votes.get(name) else comm_slug(name)
def comm_filename(name):
    for cand in (comm_files.get(str(name).replace(':', '-')), comm_files.get(str(name))):
        if cand: return cand
    for stem in (comm_stem(name), '_COMMUNITY_' + safe_name(name)):
        if (VAULT / f'{stem}.md').exists(): return f'{stem}.md'
    return comm_stem(name) + '.md'

# ── mapping id → nota ──
state = json.loads(STATE.read_text(encoding='utf-8')) if STATE.exists() else None
mapping = dict(state['ids']) if state else {}
seed_nodes = dict(state.get('nodes', {})) if state else {}
used = set(mapping.values())
def pick(n):
    rel = idx_loc.get((n.get('source_file', ''), nlabel(n.get('label', '')), loc(n)))
    if rel and rel not in used: return rel
    for rel in idx_key.get((n.get('source_file', ''), nlabel(n.get('label', ''))), []):
        if rel not in used: return rel
    return None
if not state:
    assert SEED, 'primera execució: cal --seed-from <graph.json anterior> per lligar les notes existents als ids'
    old = json.loads(SEED.read_text(encoding='utf-8')); seed_nodes = {n['id']: {'source_file': n.get('source_file'), 'label': n.get('label')} for n in old['nodes'] if is_lab(n)}
    for n in sorted((n for n in old['nodes'] if is_lab(n)), key=lambda n: n['id']):
        rel = pick(n)
        if rel: mapping[n['id']] = rel; used.add(rel)
    print(f'seed: {len(mapping)} notes existents lligades a ids del graph anterior')
for i in sorted(i for i, n in nodes.items() if is_lab(n) and i not in mapping):
    rel = pick(nodes[i])
    if rel: mapping[i] = rel; used.add(rel)
lab_ids = sorted(i for i, n in nodes.items() if is_lab(n))
# id canviat (p.ex. node de fitxer 'main' → 'main_js') amb el mateix (source_file, label): hereta la nota
gone_key = {(nodes_old.get('source_file'), nlabel(nodes_old.get('label'))): i for i, nodes_old in ((i, seed_nodes.get(i, {})) for i in mapping if i not in nodes) if nodes_old}
renamed = 0
for i in [i for i in lab_ids if i not in mapping]:
    k = (nodes[i].get('source_file'), nlabel(nodes[i].get('label'))); j = gone_key.get(k)
    if j and j in mapping: mapping[i] = mapping.pop(j); renamed += 1
new_ids = [i for i in lab_ids if i not in mapping]
taken = set(stems)
for i in new_ids:
    base = safe_name(nodes[i].get('label', i)); cand = base; k = 1
    while cand in taken: cand = f'{base}_{k}'; k += 1
    taken.add(cand); mapping[i] = f'CODI/{cand}.md'
gone = sorted(i for i in mapping if i not in nodes)

# ── render ──
def stem_of(nid):
    if nid in mapping: return Path(mapping[nid]).stem
    n = nodes.get(nid)
    if not n: return nid
    rel = idx_loc.get((n.get('source_file', ''), nlabel(n.get('label', '')), loc(n))) or (idx_key.get((n.get('source_file', ''), nlabel(n.get('label', '')))) or [None])[0]
    return Path(rel).stem if rel else safe_name(n.get('label', nid))
FTAG = {'code': 'graphify/code', 'document': 'graphify/document', 'paper': 'graphify/paper', 'image': 'graphify/image'}
def render_node(nid):
    n = nodes[nid]; nbs = adj.get(nid, {})
    confs = collections.Counter(rc[1] for rc in nbs.values()); dom = confs.most_common(1)[0][0] if confs else 'EXTRACTED'
    ftype = n.get('file_type', ''); tags = [FTAG.get(ftype, f'graphify/{ftype}' if ftype else 'graphify/document'), f'graphify/{dom}', f"comunitat/{slug_of(n.get('community_name', ''))}"]
    lines = ['---', f'source_file: "{yaml(n.get("source_file", ""))}"', f'type: "{yaml(ftype)}"', f'community: "{yaml(n.get("community_name", ""))}"']
    if n.get('source_location'): lines.append(f'location: "{yaml(n["source_location"])}"')
    lines += ['tags:'] + [f'  - {t}' for t in tags] + ['---', '', f"# {n.get('label', nid)}", '']
    if nbs:
        lines.append('## Connections')
        lines += [f'- [[{stem_of(nb)}]] - `{nbs[nb][0]}` [{nbs[nb][1]}]' for nb in sorted(nbs, key=lambda x: nodes.get(x, {}).get('label', x))]
        lines.append('')
    lines.append(' '.join('#' + t for t in tags))
    return '\n'.join(lines)
def render_comm(name):
    mem = members[name]; fn = comm_filename(name); display = Path(fn).stem[len('_COMMUNITY_'):]
    lines = ['---', 'type: community', f'members: {len(mem)}', '---', '', f'# {display}', '', f'**Members:** {len(mem)} nodes', '', '## Members']
    for nid in sorted(mem, key=lambda i: nodes[i].get('label', i)):
        d = nodes[nid]; e = f'- [[{stem_of(nid)}]]'
        if d.get('file_type'): e += f" - {d['file_type']}"
        if d.get('source_file'): e += f" - {d['source_file']}"
        lines.append(e)
    lines += ['', '## Live Query (requires Dataview plugin)', '', '```dataview', f'TABLE source_file, type FROM #comunitat/{slug_of(name)}', 'SORT file.name ASC', '```', '']
    cross = inter.get(name, {})
    if cross:
        lines.append('## Connections to other communities')
        lines += [f"- {c} edge{'s' if c != 1 else ''} to [[{Path(comm_filename(o)).stem}]]" for o, c in sorted(cross.items(), key=lambda x: -x[1])]
        lines.append('')
    def reach(nid): return len({node_comm[nb] for nb in adj.get(nid, {}) if node_comm.get(nb) not in (None, name)})
    bridges = sorted(((nid, len(adj.get(nid, {})), reach(nid)) for nid in mem if reach(nid) > 0), key=lambda x: (-x[2], -x[1]))[:5]
    if bridges:
        lines.append('## Top bridge nodes')
        lines += [f"- [[{stem_of(nid)}]] - degree {deg}, connects to {rc} {'community' if rc == 1 else 'communities'}" for nid, deg, rc in bridges]
    return fn, '\n'.join(lines)

# ── pla ──
plan_nodes = {'crear': [], 'actualitzar': [], 'igual': 0}; diffs = []; kind_counts = collections.Counter()
for i in lab_ids:
    p = VAULT / mapping[i]; content = render_node(i)
    if not p.exists(): plan_nodes['crear'].append(i)
    else:
        cur = p.read_text(encoding='utf-8', errors='ignore')
        if cur == content: plan_nodes['igual'] += 1
        else:
            plan_nodes['actualitzar'].append(i)
            a, b = cur.split('\n---\n', 1)[0], content.split('\n---\n', 1)[0]
            kinds = set()
            if re.search(r'^community:', a, re.M) and re.search(r'^community: (.*)$', a, re.M).group(1) != re.search(r'^community: (.*)$', b, re.M).group(1): kinds.add('comunitat')
            if re.search(r'^location: (.*)$', a, re.M) and re.search(r'^location: (.*)$', a, re.M).group(1) != (re.search(r'^location: (.*)$', b, re.M) or [None, None])[1]: kinds.add('location')
            if cur.split('\n---\n', 1)[-1].split('## Connections')[0] != content.split('\n---\n', 1)[-1].split('## Connections')[0]: kinds.add('label/tags')
            if ('## Connections' in cur) != ('## Connections' in content) or cur.split('## Connections')[-1] != content.split('## Connections')[-1]: kinds.add('connexions')
            kind_counts.update(kinds or {'altres'})
            if (kinds == {'connexions'} and sum(1 for d in diffs if d[0] == 'C') < 3 and len(plan_nodes['actualitzar']) % 97 == 0) or (kinds == {'comunitat'} and sum(1 for d in diffs if d[0] == 'K') < 1):
                diffs.append(('C' if kinds == {'connexions'} else 'K', mapping[i], ''.join(difflib.unified_diff(cur.splitlines(True), content.splitlines(True), 'vault', 'nou', n=0))))
plan_comm = []
for name in sorted((c for c in members if any(is_lab(nodes[i]) for i in members[c])), key=str):
    fn, content = render_comm(name); p = VAULT / fn
    if not p.exists(): plan_comm.append((name, fn, 'crear')); continue
    cur = p.read_text(encoding='utf-8', errors='ignore')
    cur_members = set(re.findall(r'^- \[\[(.+?)\]\]', cur.split('## Live Query')[0], re.M)); new_members = {stem_of(i) for i in members[name]}
    if cur_members != new_members: plan_comm.append((name, fn, f'reescriure ({len(cur_members)}→{len(new_members)} membres)'))
live_comm_files = {comm_filename(c) for c in members}
stale_comm = []
for p in sorted(VAULT.glob('_COMMUNITY_*.md')):
    if p.name in live_comm_files: continue
    txt = p.read_text(encoding='utf-8', errors='ignore'); srcs = re.findall(r'^- \[\[.+?\]\](?: - \w+)? - (\S.*)$', txt.split('## Live Query')[0], re.M)
    if srcs and all(x.startswith('Lab/') for x in srcs): stale_comm.append(p.name)
unres = collections.Counter()
all_stems = stems | {Path(v).stem for v in mapping.values()}
for i in lab_ids:
    for nb in adj.get(i, {}):
        if stem_of(nb) not in all_stems: unres[nb] += 1
print(f"Lab: {len(lab_ids)} nodes | notes: crear {len(plan_nodes['crear'])}, actualitzar {len(plan_nodes['actualitzar'])}, iguals {plan_nodes['igual']} | retirar {len(gone)} | comunitats a escriure {len(plan_comm)} | enllaços sense nota destí: {sum(unres.values())} ({len(unres)} nodes)")
print(f'  reanomenaments heretats: {renamed} | retirar:', [Path(mapping[i]).stem for i in gone])
print(f'  notes _COMMUNITY_ òrfenes (només Lab/, comunitat desapareguda): {len(stale_comm)}', stale_comm[:12])
print('  tipus de canvi a les actualitzacions:', dict(kind_counts))
print('  crear (mostra):', [Path(mapping[i]).stem for i in plan_nodes['crear'][:25]])
print('  comunitats:', [(str(n), a) for n, _, a in plan_comm])
print('  sense nota destí (mostra):', [(nodes.get(k, {}).get('label', k), nodes.get(k, {}).get('source_file')) for k in list(unres)[:6]])
for kind, rel, d in diffs: print(f'--- diff [{kind}] {rel} ---'); print(d[:1200])
if DRY: print('DRY-RUN: res escrit.'); sys.exit(0)

# ── escriptura ──
ts = time.strftime('%Y%m%d-%H%M%S')
for i in gone:
    src = VAULT / mapping[i]
    if src.exists(): dst = OBSOLETS / ts / mapping[i]; dst.parent.mkdir(parents=True, exist_ok=True); shutil.move(str(src), str(dst))
    del mapping[i]
for i in plan_nodes['crear'] + plan_nodes['actualitzar']:
    p = VAULT / mapping[i]; p.parent.mkdir(parents=True, exist_ok=True); p.write_text(render_node(i), encoding='utf-8')
for name, fn, _ in plan_comm: (VAULT / fn).write_text(render_comm(name)[1], encoding='utf-8')
for fn in stale_comm:
    dst = OBSOLETS / ts / fn; dst.parent.mkdir(parents=True, exist_ok=True); shutil.move(str(VAULT / fn), str(dst))
STATE.write_text(json.dumps({'ids': mapping, 'nodes': {i: {'source_file': nodes[i].get('source_file'), 'label': nodes[i].get('label')} for i in mapping}, 'generated': ts, 'graph_built_at_commit': g.get('built_at_commit')}, indent=1, ensure_ascii=False), encoding='utf-8')
print(f"ESCRIT: {len(plan_nodes['crear'])} creades, {len(plan_nodes['actualitzar'])} actualitzades, {len(gone)} retirades a {OBSOLETS / ts if gone else '—'}, {len(plan_comm)} notes de comunitat escrites, {len(stale_comm)} òrfenes retirades; estat desat.")
