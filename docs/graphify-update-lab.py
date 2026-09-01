#!/usr/bin/env python3
"""Update incremental (només AST, sense LLM) de la porció Lab/ del graph del Corpus.

Execució (cwd = Corpus, intèrpret de graphify):
    cd ~/Documents/Nuzic/Corpus && "$(cat graphify-out/.graphify_python)" /Users/workingburcet/Lab/docs/graphify-update-lab.py

Per què no serveix `graphify update` ni el runbook `/graphify --update` tal qual:
  - el graph del Corpus guarda els nodes del Lab amb source_file 'Lab/<rel>' i ids
    'lab_<rel-slug>' (arrel /Users/workingburcet); l'extractor, arrelat a Lab o al
    Corpus, generaria ids diferents i duplicaria tots els nodes;
  - re-clusteritzar (Leiden) esborraria els ~280 noms de comunitat curats que viuen
    als nodes (`community_name`); aquí les comunitats s'HERETEN, mai es recalculen.

Què fa: detecta canvis amb el manifest (relatiu a Lab), extreu AST dels fitxers de
codi canviats (cache a Corpus/graphify-out/cache), normalitza rutes/ids a la
convenció Lab/, fa build_merge (substitució per fitxer) sense root ni dedup difús,
conserva els hyperedges tal com eren, assigna comunitat als nodes nous per majoria
de veïns → fitxer → directori (fitxers de test nous: 'Codi: <stem>' al cub -1),
comprova invariants, fa backup de graph.json + manifest.json i escriu.
"""
import json, shutil, time, collections, sys
from pathlib import Path
from graphify.detect import detect_incremental, save_manifest
from graphify.extract import extract
from graphify.build import build_merge
from graphify.export import to_json

CORPUS = Path('/Users/workingburcet/Documents/Nuzic/Corpus'); OUT = CORPUS / 'graphify-out'
LAB = Path('/Users/workingburcet/Lab'); GRAPH = OUT / 'graph.json'
HOME = '/Users/workingburcet/'; PFX = 'users_workingburcet_'
assert Path.cwd() == CORPUS, f'executa-ho des de {CORPUS} (cwd = {Path.cwd()})'

old_text = GRAPH.read_text(encoding='utf-8'); old = json.loads(old_text)
old_nodes = {n['id']: n for n in old['nodes']}; old_ids = set(old_nodes); old_hyper = old.get('hyperedges', [])
print(f"graph vell: {len(old_nodes)} nodes, {len(old['links'])} edges, {len(old_hyper)} hyperedges")

# 1) detecció (manifest relatiu a Lab)
r = detect_incremental(LAB, kind='ast')
changed = [Path(f) for f in r['new_files'].get('code', [])]
deleted = [str(d) for d in r.get('deleted_files', [])]
del_rel = {'Lab/' + Path(d).resolve().relative_to(LAB).as_posix() for d in deleted}
n_del = sum(1 for n in old['nodes'] if n.get('source_file') in del_rel)
print(f"canviats (code): {len(changed)} | esborrats: {sorted(del_rel)} (nodes al graph: {n_del})")
if not changed and not n_del:
    print('Res a actualitzar (cap fitxer de codi canviat ni esborrat amb nodes al graph).'); sys.exit(0)

# 2) extracció AST (seqüencial: el pool de processos re-executa aquest script) + normalització
res = extract(changed, cache_root=CORPUS, parallel=False) if changed else {'nodes': [], 'edges': [], 'hyperedges': []}
def fix_id(i): return i[len(PFX):] if isinstance(i, str) and i.startswith(PFX) else i
def fix_path(p): return p[len(HOME):] if isinstance(p, str) and p.startswith(HOME) else p
for n in res['nodes']:
    n['id'] = fix_id(n['id'])
    for k in ('source_file', 'origin_file'):
        if k in n: n[k] = fix_path(n[k])
for e in res['edges']:
    e['source'] = fix_id(e['source']); e['target'] = fix_id(e['target'])
    for k in ('source_file', 'origin_file'):
        if k in e: e[k] = fix_path(e[k])
for h in res.get('hyperedges', []):
    h['nodes'] = [fix_id(x) for x in h.get('nodes', [])]
    if 'source_file' in h: h['source_file'] = fix_path(h['source_file'])
dump = json.dumps(res, ensure_ascii=False)
assert 'users_workingburcet' not in dump and HOME not in dump, "queden rutes absolutes a l'extracció"
res_ids = {n['id'] for n in res['nodes']}; new_sf = {n['source_file'] for n in res['nodes']}
old_by_sf = collections.Counter(n.get('source_file') for n in old['nodes'])
print(f"extracció nova: {len(res['nodes'])} nodes, {len(res['edges'])} edges, {len(new_sf)} fitxers")
for sf in sorted(new_sf):
    print(f"  {sf}: nodes {old_by_sf.get(sf, 0)} → {sum(1 for n in res['nodes'] if n['source_file'] == sf)}")
old_replaced = {i for i, n in old_nodes.items() if n.get('source_file') in new_sf or n.get('source_file') in del_rel}
if res_ids and old_replaced:
    overlap = len(res_ids & old_ids); print(f"ids que ja existien (mateix esquema): {overlap}/{len(res_ids)}")
    assert overlap / len(res_ids) > 0.5, "l'esquema d'ids NO coincideix amb el graph"
prev_nodes = len(old_ids) - len(old_replaced) + len(res_ids - (old_ids - old_replaced))

# 3) merge sense root (els nodes vells d'altres repos amb ruta absoluta no s'han de re-clavar) ni dedup difús
G = build_merge([res], graph_path=GRAPH, prune_sources=deleted or None, directed=bool(old.get('directed', False)), dedup=False)
g_ids = set(G.nodes); dropped = old_ids - g_ids; added = g_ids - old_ids
print(f"merge: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges | perduts {len(dropped)} | afegits {len(added)}")
for i in sorted(dropped): print('   -', i, '|', old_nodes[i].get('label'), '|', old_nodes[i].get('source_file'))
assert dropped <= old_replaced, f'nodes perduts fora dels fitxers re-extrets/esborrats: {sorted(dropped - old_replaced)[:10]}'
assert added == res_ids - old_ids, f'nodes afegits inesperats: {sorted(added - res_ids)[:10]}'
assert not [i for i, d in G.nodes(data=True) if not d.get('label')], 'nodes sense label (edges penjats)'
assert all(G.nodes[i].get('source_file') == old_nodes[i].get('source_file') for i in old_ids - old_replaced), 'source_file alterat en nodes no tocats'
assert G.number_of_nodes() == prev_nodes, f'nodes {G.number_of_nodes()} != previsió {prev_nodes}'
def norm(sf): return fix_path(sf) if isinstance(sf, str) else sf
G.graph['hyperedges'] = [h for h in old_hyper if norm(h.get('source_file')) not in new_sf and norm(h.get('source_file')) not in del_rel] + list(res.get('hyperedges', []))

# 4) comunitats: els nodes vells conserven exactament (community, community_name); els nous hereten el parell majoritari
def cid(v):
    try: return int(v)
    except (TypeError, ValueError): return -1
pair = {i: (cid(old_nodes[i].get('community')), old_nodes[i].get('community_name') or 'Community ?') for i in g_ids & old_ids}
def dir_of(sf): return sf.rsplit('/', 1)[0] if sf else ''
by_file, by_dir = collections.defaultdict(collections.Counter), collections.defaultdict(collections.Counter)
for i, p in pair.items():
    sf = G.nodes[i].get('source_file') or ''; by_file[sf][p] += 1; by_dir[dir_of(sf)][p] += 1
nous = sorted(g_ids - old_ids); pend = list(nous)
for i in list(pend):  # fitxer de test nou → nom propi, com la resta de tests
    sf = G.nodes[i].get('source_file') or ''
    if sf.endswith('.test.js') and not by_file.get(sf):
        pair[i] = (-1, 'Codi: ' + sf.rsplit('/', 1)[1][:-len('.js')]); pend.remove(i)
moved = True
while pend and moved:
    moved = False
    for i in list(pend):
        v = collections.Counter(pair[j] for j in G.neighbors(i) if j in pair)
        if v: pair[i] = v.most_common(1)[0][0]; pend.remove(i); moved = True
for i in list(pend):
    sf = G.nodes[i].get('source_file') or ''; v = by_file.get(sf) or by_dir.get(dir_of(sf))
    if v: pair[i] = v.most_common(1)[0][0]; pend.remove(i)
assert not pend, f'nodes nous sense cap context per heretar comunitat: {pend[:8]}'
print(f'nodes nous ({len(nous)}) → comunitat:')
for i in nous: print(f"   {i}  →  {pair[i][1]}")
communities = collections.defaultdict(list)
for i, (c, _) in pair.items(): communities[c].append(i)

# 5) escriptura a un temporal, noms per node, comprovacions, backup i swap
tmp = OUT / 'graph.json.new'
assert to_json(G, dict(communities), str(tmp), force=True, built_at_commit=None)
new = json.loads(tmp.read_text(encoding='utf-8'))
for n in new['nodes']: n['community'], n['community_name'] = pair[n['id']]
tmp.write_text(json.dumps(new, indent=2, ensure_ascii=False), encoding='utf-8'); new_text = tmp.read_text(encoding='utf-8')
ids = [n['id'] for n in new['nodes']]; assert len(ids) == len(set(ids)), 'ids duplicats'
assert new_text.count(HOME) <= old_text.count(HOME) and new_text.count(PFX) <= old_text.count(PFX), 'rutes/ids absoluts nous'
oldc = {n.get('community_name') for n in old['nodes']}; newc = {n.get('community_name') for n in new['nodes']}
assert not (oldc - newc), f'noms de comunitat perduts: {sorted(oldc - newc)}'
print(f"RESUM nodes {len(old_nodes)} → {len(new['nodes'])} | edges {len(old['links'])} → {len(new['links'])} | hyperedges {len(old_hyper)} → {len(new.get('hyperedges', []))} | fitxers Lab/: {len({n['source_file'] for n in new['nodes'] if str(n.get('source_file', '')).startswith('Lab/')})}")
ts = time.strftime('%Y%m%d-%H%M%S')
shutil.copy2(GRAPH, OUT / f'graph.json.bak-preupdate-{ts}'); shutil.copy2(OUT / 'manifest.json', OUT / f'manifest.json.bak-preupdate-{ts}')
tmp.replace(GRAPH)
save_manifest(r['files'], root=LAB, kind='ast')
print(f'ESCRIT: graph.json i manifest.json (backups *-preupdate-{ts}). Recorda: GRAPH_REPORT.md/graph.html no es regeneren.')
