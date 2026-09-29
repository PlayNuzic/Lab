#!/bin/bash
# SessionStart: instal·la les dependències a les sessions de Claude Code al núvol,
# perquè `npm test` i el hook de tests relacionats funcionin des del primer moment.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"
# npm install (no ci): aprofita l'estat del contenidor que es desa després del hook.
# --no-save: no reescriu package-lock.json (si no, cada sessió deixaria el repo brut).
npm install --no-save --no-audit --no-fund --loglevel=error
