#!/usr/bin/env bash
set -euxo pipefail

# 0. Instal·lació d’eines de base (molt lleugera)
apt-get update -qq
apt-get install -yqq git curl jq make bash-completion

# 1. Config Git amb nom+mail genèrics
git config --global user.name  "PlayNuzic-Codex"
git config --global user.email "codex@playnuzic.local"

# 2. Deixa ‘origin’ apuntant a HTTPS amb PAT
REMOTE_URL="$(git config --get remote.origin.url || true)"
if [[ -z "$REMOTE_URL" ]]; then
  REPO_PATH=$(basename "$(pwd)")
  REMOTE_URL="https://github.com/PlayNuzic/${REPO_PATH}.git"
  REMOTE_URL="https://${GITHUB_TOKEN}@${REMOTE_URL#https://}"
  git remote add origin "$REMOTE_URL"
else
  REMOTE_URL=$(echo "$REMOTE_URL" | sed -E "s#https://#https://${GITHUB_TOKEN}@#")
  git remote set-url origin "$REMOTE_URL"
fi

# 3. Habilita yarn/pnpm sense baixar-los
corepack enable

# 4. (Opcional) instal·la les deps declarades al projecte --------------------
if [[ -f package.json ]]; then
  # --ignore-scripts: evita post-install que demanin xarxa o rodegins
  # --fund=false     : evita la sortida de missatges “npm fund”
  npm ci --ignore-scripts --fund=false
fi

echo "✅ Entorn preparat. Pots fer git add / commit / push (HTTPS amb PAT)."
