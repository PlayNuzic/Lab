## Preparació de l'entorn

Executa aquests passos a l'arrel del repositori cada nova sessió:

```bash
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

chmod +x setup.sh
./setup.sh
```

El `setup.sh` configura el nom i correu de Git, força el _remote_ a SSH
(github.com:443), habilita Corepack i instal·la les dependències de Node amb
`npm ci` (Jest inclòs). Només cal executar-lo un cop per sessió.

## Estructura del projecte

- `index.html` exposa una _landing_ minimalista amb enllaços a les apps.
- `Apps/App1`, `Apps/App2`, `Apps/App3` comparteixen gran part de la lògica de
  timeline i àudio via `libs/` però mantenen HTML i estils propis.
- `libs/` agrupa els mòduls reutilitzables:
  - `app-common/`: càlculs de subdivisions, _helpers_ de rang, menús, mixer,
    programació d'àudio i temes.
  - `sound/`: motor `TimelineAudio`, mixer global i càrrega de mostres.
  - `shared-ui/`: capçalera, desplegables de so, sistemes de _hover_ i menú de
    rendiment d'àudio.
  - `random/`, `utils/`, `cards/`, etc. suporten funcionalitats concretes.
- `config/` conté configuracions comunes (Jest, ESLint, etc.).

## Execució de tests

Executa totes les proves amb Jest des de l'arrel:

```bash
npm test
```

Les suites cobreixen els mòduls compartits (`libs/app-common`, `libs/sound`,
`libs/random`, `libs/utils`, …). Alguns tests simulen el DOM i WebAudio; assegura't
que continuen passant després de modificar aquestes zones.
