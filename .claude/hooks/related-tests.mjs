// PostToolUse (Edit|Write): passa els tests de Jest relacionats amb el fitxer editat
// (2-8 s) i torna el resultat a Claude. Si fallen, ho marca perquè ho arregli.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { NIVELL1 } from './nivell1.mjs';

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let file;
  try { file = JSON.parse(raw)?.tool_input?.file_path; } catch { return; }
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (!file || !/\.(m?js)$/.test(file)) return;
  const rel = path.relative(root, path.resolve(root, file));
  if (rel.startsWith('..') || rel.startsWith('node_modules')) return;
  if (!existsSync(path.join(root, 'node_modules', '.bin', 'jest'))) return;

  const r = spawnSync(path.join(root, 'node_modules', '.bin', 'jest'),
    ['--findRelatedTests', rel, '--passWithNoTests', '--silent'],
    { cwd: root, encoding: 'utf8', timeout: 110_000,
      env: { ...process.env, NODE_OPTIONS: '--experimental-vm-modules', CI: 'true', FORCE_COLOR: '0' } });
  // Fora els avisos de Node (punycode, VM Modules…), que taparien el test que falla.
  const out = `${r.stdout}\n${r.stderr}`.split('\n')
    .filter((l) => !/Warning:|--trace-(deprecation|warnings)/.test(l)).join('\n');
  const summary = out.match(/^Tests:.*$/m)?.[0].replace(/\s+/g, ' ') ?? 'cap test relacionat';
  const nivell1 = NIVELL1.includes(rel)
    ? ' Fitxer de Nivell 1: passa `npm test` sencer i ensenya el diff complet abans de donar-ho per bo.'
    : '';

  if (r.status !== 0) {
    const tail = out.trim().split('\n').slice(-60).join('\n');
    process.stdout.write(JSON.stringify({
      decision: 'block',
      reason: `Tests relacionats amb ${rel} FALLEN (${summary}). Arregla-ho abans de continuar.${nivell1}\n\n${tail}`,
    }));
    return;
  }
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: `Tests relacionats amb ${rel}: ${summary}.${nivell1}`,
    },
  }));
}

main();
