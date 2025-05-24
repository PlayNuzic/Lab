#!/usr/bin/env bash
set -eux  # segueix fallant en errors, però només si existeix la variable

# 1) instal·la git si cal
command -v git >/dev/null 2>&1 || { apt-get update -y && apt-get install -y git; }

# 2) configura nom i email de l’usuari Codex
git config --global user.name  "PlayNuzic-Codex"
git config --global user.email "codex@playnuzic.local"

# 3) obté l’URL del repositori a partir del remote (si el clon ja existeix)
REMOTE_URL="$(git config --get remote.origin.url || true)"

# 4) genera l’URL HTTPS amb PAT
if [ -n "${GITHUB_TOKEN-}" ]; then
  # si no tenim remote o és SSH, refem l’URL
  if [[ -z "$REMOTE_URL" || "$REMOTE_URL" == git@github.com:* ]]; then
    REPO_PATH="$(basename "$(pwd)").git"                  # exemple: aleatorizador.git
    REPO_HTTPS="https://${GITHUB_TOKEN}@github.com/PlayNuzic/${REPO_PATH}"
    git remote remove origin 2>/dev/null || true
    git remote add    origin "$REPO_HTTPS"
  else
    # només canviem el remote perquè porti el token
    REPO_HTTPS="$(sed -E "s#https://.*@github#https://${GITHUB_TOKEN}@github#" <<<"$REMOTE_URL")"
    git remote set-url origin "$REPO_HTTPS"
  fi
else
  echo "ERROR: la variable secreta GITHUB_TOKEN no està definida" >&2
  exit 1
fi

echo "✅ Entorn preparat. Pots fer git add / commit / push via HTTPS amb el token."
