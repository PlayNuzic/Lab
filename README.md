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
cat > ~/.ssh/config <<'CFG'
Host github.com
  HostName ssh.github.com
  Port 443
  User git
  IdentityFile ~/.ssh/id_ed25519
  StrictHostKeyChecking no
CFG
chmod 600 ~/.ssh/config

# Comprova la connexió:
ssh -T git@github.com

# Després, prepara l'entorn amb:
./setup.sh
```

## Estructura

El repositori es divideix en diversos espais lògics:

- `Apps/`: Conté cada mini-app amb la seva UI específica.
  - `App1/`
  - `App2/`
- `libs/app-common/`: utilitats comunes com `computeHitSizePx`, `computeNumberFontRem` i `solidMenuBackground` tenen tests dedicats.
- `packages/`: Contindrà el codi compartit. Aquí s'espera afegir el repositori
  `PlayNuzic/IndexLab` com a submòdul de Git sota la ruta
  `packages/indexlab`.
- `config/`: Configuracions comunes (ESLint, Prettier, TypeScript, etc.) per a
  totes les apps i paquets.

## Submòdul IndexLab

Per incorporar el codi modular ja existent a `PlayNuzic/IndexLab` utilitza un
submòdul:

```bash
git submodule add git@github.com:PlayNuzic/IndexLab.git packages/indexlab
```

Si el submòdul ja existeix, pots sincronitzar-lo amb la versió remota mitjançant:

```bash
git submodule update --remote packages/indexlab
```

## Tests

Executa `./setup.sh` una vegada per sessió per instal·lar dependències i
configurar Git. Després, llança la bateria de tests amb:

```bash
npm test
```

Cada mini-app i paquet hauria de definir els seus propis tests. Es recomana
configurar fluxos de CI/CD que instal·lin dependències, executin els tests i
despleguin només les apps afectades pels canvis.
