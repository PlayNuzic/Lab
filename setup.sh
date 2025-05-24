#!/usr/bin/env bash
# ---------------------------------------------------------------------------
#  Generic Codex/Codespaces bootstrap script
#  → Installs a light dev tool-chain
#  → Ensures origin = HTTPS with PAT
#  → Installs project deps if present
# ---------------------------------------------------------------------------
set -euxo pipefail

#--------- 0) Detect repo name ------------------------------------------------
REPO_PATH="$(basename "$(pwd)")"                # e.g.  aleatorizador
REMOTE_HTTPS="https://${GITHUB_TOKEN}@github.com/PlayNuzic/${REPO_PATH}.git"

#--------- 1) Base CLI / system packages -------------------------------------
echo "⇒ apt-get update…"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y \
      git curl jq make bash-completion python3-pip python3-venv

#--------- 2) Node.js tool-chain ---------------------------------------------
if ! command -v npm >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

npm install -g --silent npm@latest yarn pnpm serve \
                     eslint prettier typescript

#--------- 3) Python extras ---------------------------------------------------
pip install --no-cache-dir -U pip pipx virtualenv pytest

#--------- 4) Fix remote origin ----------------------------------------------
if git config --get remote.origin.url >/dev/null 2>&1; then
  git remote set-url origin "${REMOTE_HTTPS}"
else
  git remote add origin "${REMOTE_HTTPS}"
fi

#--------- 5) Project-specific deps ------------------------------------------
if [[ -f package.json ]]; then
  echo "⇒ npm ci / install…"
  # sense auditories ni output verbós
  npm install --no-audit --progress=false
fi

if [[ -f requirements.txt ]]; then
  echo "⇒ pip install -r requirements.txt…"
  pip install --no-cache-dir -r requirements.txt
fi

echo "✅ Entorn preparat. Pots fer git add / commit / push via HTTPS amb el token."
