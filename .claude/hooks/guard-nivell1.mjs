// PreToolUse (Bash): demana confirmació si una ordre pot escriure un fitxer de Nivell 1.
// Les regles Edit(...) de settings.json no veuen `sed -i`, redireccions, `mv`, etc.
// És heurístic i conservador: davant del dubte pregunta, mai no bloqueja.
import { NIVELL1 } from './nivell1.mjs';

// Com es pot anomenar cada fitxer dins d'una ordre: ruta sencera o sufix prou únic.
const ALIASES = NIVELL1.map((p) => {
  const parts = p.split('/');
  return parts.at(-1) === 'index.js' ? parts.slice(-2).join('/') : parts.at(-1);
});

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const mentionRe = new RegExp(`(?:^|[^\\w.-])(?:\\S*/)?(?:${ALIASES.map(esc).join('|')})(?![\\w.-])`);

// Ordres o construccions que poden escriure fitxers.
const WRITE_RES = [
  /\bsed\b[^|;&]*\s-[a-zA-Z]*i/,           // sed -i, sed -Ei
  /\bperl\b[^|;&]*\s-[a-zA-Z]*i/,          // perl -pi -e
  /(^|[^0-9&])>>?(?!&)/,                   // redirecció a fitxer (no 2>&1)
  /\b(tee|mv|cp|rm|truncate|dd|patch|ln|install|ed|ex|awk\s+-i)\b/,
  /\bgit\s+(checkout|restore|apply|reset|stash|mv|rm|am|cherry-pick|revert|merge|rebase|pull)\b/,
  /\b(writeFile|writeFileSync|appendFile|write_text|write_bytes)\b/,
  /\bopen\([^)]*['"][wa]b?\+?['"]/,
  /--write\b|--fix\b/,
];
// Edició massiva sense anomenar fitxers concrets (find/xargs/globs/substitució d'ordres).
const INPLACE_RE = /\b(sed|perl)\b[^|;&]*\s-[a-zA-Z]*i|\b(rm|mv)\b/;
const BULK_RE = /\bfind\b|\bxargs\b|\*|\$\(|`/;
const OUTSIDE_LIBS_RE = /(^|[\s'"])(\.\/)?(Apps|sistema|docs|tests)\//;

export function decide(command) {
  if (typeof command !== 'string' || !command) return null;
  if (mentionRe.test(command) && WRITE_RES.some((re) => re.test(command))) {
    return 'Aquesta ordre pot modificar un fitxer de Nivell 1 (' + NIVELL1.join(', ') + '). '
      + 'CLAUDE.md: llegeix-ne els tests, passa tota la suite i ensenya el diff complet abans d\'aprovar-ho.';
  }
  if (INPLACE_RE.test(command) && BULK_RE.test(command)
      && /\blibs\b/.test(command) && !OUTSIDE_LIBS_RE.test(command)) {
    return 'Edició massiva dins libs/ que pot arribar a fitxers de Nivell 1. Confirma-ho o limita-la a fitxers concrets.';
  }
  return null;
}

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  let command;
  try { command = JSON.parse(raw)?.tool_input?.command; } catch { return; }
  const reason = decide(command);
  if (!reason) return;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'ask',
      permissionDecisionReason: reason,
    },
  }));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
