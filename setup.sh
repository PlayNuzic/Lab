# 1. Config Git amb nom+mail genèrics
git config --global user.name  "PlayNuzic-Codex"
git config --global user.email "codex@playnuzic.local"

# 2. Configura remote origin amb SSH (no cal PAT)
REMOTE_URL="$(git config --get remote.origin.url || true)"
if [[ -z "$REMOTE_URL" ]]; then
  REPO_PATH=$(basename "$(pwd)")
  REMOTE_URL="git@github.com:PlayNuzic/${REPO_PATH}.git"
  git remote add origin "$REMOTE_URL"
else
  # Força a SSH encara que abans fos HTTPS
  REMOTE_URL=$(basename "$(pwd)")
  git remote set-url origin "git@github.com:PlayNuzic/${REMOTE_URL}.git"
fi

# 3. Habilita yarn/pnpm sense baixar-los
corepack enable

# 4. Instal·la les dependències de Node (inclòs Jest)
npm ci --ignore-scripts --no-audit --progress=false
npx --yes jest --version >/dev/null || true

echo "✅ Entorn preparat. Remote via SSH (port 443)."
