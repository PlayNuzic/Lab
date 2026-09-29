// Tests dels hooks de Claude Code (.claude/hooks/): guarda de Nivell 1 per a Bash
// i coherència entre la llista de Nivell 1 i permissions.ask de settings.json.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { NIVELL1 } from '../.claude/hooks/nivell1.mjs';
import { decide } from '../.claude/hooks/guard-nivell1.mjs';

const settings = JSON.parse(readFileSync(new URL('../.claude/settings.json', import.meta.url), 'utf8'));

describe('llista de Nivell 1', () => {
  test('coincideix amb permissions.ask de settings.json', () => {
    const ask = settings.permissions.ask.map((r) => r.match(/^Edit\(\/(.+)\)$/)?.[1]).sort();
    expect(ask).toEqual([...NIVELL1].sort());
  });

  test('els fitxers existeixen', () => {
    for (const p of NIVELL1) expect(() => readFileSync(new URL(`../${p}`, import.meta.url))).not.toThrow();
  });
});

describe('guard-nivell1: demana confirmació', () => {
  test.each([
    "sed -i 's/a/b/' libs/sound/timeline-processor.js",
    "sed -Ei 's/a/b/' ./libs/app-common/subdivision.js",
    "perl -pi -e 's/a/b/' libs/app-common/audio-schedule.js",
    'cat x > libs/sound/index.js',
    'echo x >> libs/sound/index.js',
    'cp /tmp/x.js libs/sound/timeline-processor.js',
    'mv libs/app-common/subdivision.js /tmp/',
    'rm libs/app-common/audio-schedule.js',
    'git checkout -- libs/sound/index.js',
    'cd libs/sound && sed -i s/a/b/ timeline-processor.js',
    "node -e \"require('fs').writeFileSync('libs/sound/index.js','')\"",
    "sed -i 's/a/b/' libs/sound/*.js",
    "find libs -name '*.js' | xargs sed -i 's/a/b/'",
  ])('%s', (cmd) => {
    expect(decide(cmd)).toEqual(expect.any(String));
  });
});

describe('guard-nivell1: deixa passar', () => {
  test.each([
    'cat libs/sound/timeline-processor.js',
    'grep -n epsilon libs/sound/timeline-processor.js 2>&1',
    'git diff libs/sound/index.js',
    'git log --oneline -- libs/app-common/subdivision.js',
    'npm test -- --testPathPattern=subdivision',
    "sed -n '1,40p' libs/app-common/audio-schedule.js",
    "sed -i 's/a/b/' Apps/App5/main.js",
    'echo ok > /tmp/out.txt',
    "sed -i 's/a/b/' libs/app-common/index.js",
    "find Apps -name '*.js' | xargs sed -i 's/a/b/'",
    '',
  ])('%s', (cmd) => {
    expect(decide(cmd)).toBeNull();
  });
});

describe('guard-nivell1 com a procés (contracte del hook)', () => {
  const run = (input) => spawnSync('node', ['.claude/hooks/guard-nivell1.mjs'],
    { input: JSON.stringify(input), encoding: 'utf8' });

  test('respon ask amb JSON vàlid', () => {
    const r = run({ tool_name: 'Bash', tool_input: { command: "sed -i 's/a/b/' libs/sound/index.js" } });
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout).hookSpecificOutput;
    expect(out.hookEventName).toBe('PreToolUse');
    expect(out.permissionDecision).toBe('ask');
  });

  test('sense sortida quan no hi ha risc', () => {
    const r = run({ tool_name: 'Bash', tool_input: { command: 'ls' } });
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('');
  });
});
