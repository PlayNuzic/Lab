# Codex / Codespaces setup

| Secret obligatori | Contingut                                              | Scope GitHub |
|-------------------|--------------------------------------------------------|--------------|
| `GITHUB_TOKEN`    | Personal Access Token (PAT) amb accés **repo** complet | `repo`       |

## Preparació de l'entorn

Abans de començar pots desactivar els proxies i forçar l'ús d'SSH sobre el
port 443. A continuació fes executable i executa el `setup.sh` per preparar
les dependències i el Git remots:

```bash
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

chmod +x setup.sh
./setup.sh
```

## Execució de tests

Des del directori arrel del repositori, executa:

```bash
npm test
```

## Documentació de cartes

Consulta `docs/cards-transformations.md` per a les darreres funcions de permutació de targetes.


