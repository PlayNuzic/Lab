// Deriva documental: cada ruta del repo citada a les guies que llegeix Claude ha d'existir.
// Cobreix les rutes entre accents greus (`libs/sound/index.js`) i els enllaços relatius
// de markdown ([x](../../../docs/y.md)). Si una ruta desapareix, aquest test ho diu abans
// que un agent segueixi una instrucció que apunta al buit.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const GUIDES = [
  'CLAUDE.md',
  'README.md',
  'docs/agents-context.md',
  'docs/MODULES.md',
  'docs/LAB_SYSTEM_RULES.md',
  ...readdirSync(path.join(ROOT, '.claude/skills')).map((s) => `.claude/skills/${s}/SKILL.md`),
];

// Rutes que falten a propòsit, amb el motiu.
const ALLOW_MISSING = {
  'libs/matrix-seq/grid-editor.css':
    'nuzic-migrate explica que cal treure aquest <link>; el fitxer ja no existeix',
};

const CODE_PATH = /`((?:\.\/)?(?:Apps|libs|docs|sistema|tests|\.claude|\.github)\/[^`\s]*)`/g;
const MD_LINK = /\]\((\.\.?\/[^)#\s]+)/g;
// Plantilles i marcadors, no rutes reals: AppN, appNN, <nom>, globs, YYYY-MM-DD…
const PLACEHOLDER = /[*<>{}]|AppN\b|AppNN|appNN|AppXX|App\[N\]|\.\.\.|…|YYYY/;

function isIgnored(rel) {
  return spawnSync('git', ['check-ignore', '-q', rel], { cwd: ROOT }).status === 0;
}

function references() {
  const refs = [];
  for (const guide of GUIDES) {
    const lines = readFileSync(path.join(ROOT, guide), 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const [, raw] of line.matchAll(CODE_PATH)) {
        const rel = raw.replace(/^\.\//, '').replace(/[:#].*$/, '').replace(/[.,;)]+$/, '');
        if (!PLACEHOLDER.test(rel)) refs.push({ guide, line: i + 1, rel });
      }
      for (const [, raw] of line.matchAll(MD_LINK)) {
        const abs = path.resolve(ROOT, path.dirname(guide), raw);
        const rel = path.relative(ROOT, abs);
        if (!PLACEHOLDER.test(rel)) refs.push({ guide, line: i + 1, rel });
      }
    });
  }
  return refs;
}

describe('rutes citades a les guies', () => {
  const refs = references();

  test('n\'hi ha prou per ser significatiu', () => {
    expect(refs.length).toBeGreaterThan(50);
  });

  test('totes existeixen (o falten a propòsit)', () => {
    const missing = refs
      .filter(({ rel }) => !existsSync(path.join(ROOT, rel)))
      .filter(({ rel }) => !(rel in ALLOW_MISSING) && !isIgnored(rel))
      .map(({ guide, line, rel }) => `${guide}:${line} → ${rel}`);
    expect(missing).toEqual([]);
  });

  test('les excepcions encara calen', () => {
    const stale = Object.keys(ALLOW_MISSING).filter((rel) => existsSync(path.join(ROOT, rel)));
    expect(stale).toEqual([]);
  });
});
