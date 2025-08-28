# Lab
Investigación y desarrollo del método Nuzic
## Entorn OpenAI Codex

Es pot fer push directament des de l’entorn de Codex:

1. A **Settings → Environments** (del teu repo de GitHub) crea un entorn i
   afegeix el secret `GITHUB_TOKEN` amb permisos **repo**.
2. Usa el `setup.sh` del repo per preparar Git, Node i enganxar el token.
3. Cada sessió de Codex quedarà llesta per a `git add`, `git commit` i
   `git push` (via HTTPS amb PAT).

Abans d'executar `setup.sh`, pots desactivar els proxies i forçar SSH sobre el
port 443 per evitar bloquejos de xarxa. Un fragment habitual és:

```bash
# Prepara entorn sense proxy i SSH sobre 443
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY
git config --global --unset http.proxy  || true
git config --global --unset https.proxy || true

mkdir -p ~/.ssh
cat > ~/.ssh/config <<'EOF'
Host github.com
  HostName ssh.github.com
  Port 443
  User git
  IdentityFile ~/.ssh/id_ed25519
  StrictHostKeyChecking no
EOF
chmod 600 ~/.ssh/config

# Comprova la connexió:
   ssh -T git@github.com

# Després, prepara l'entorn amb:
   ./setup.sh

## Tests

Before running tests, execute `./setup.sh` once per session to install all
dependencies and configure Git. After that you can run the test suite with:

```bash
npm test
```
