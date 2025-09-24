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

## Funciones destacadas

- **`createSchedulingBridge` (`libs/app-common/audio.js`)**: centraliza la recepción
de eventos `sharedui:scheduling`, aplica `lookAhead`/`updateInterval` en cuanto el
motor `TimelineAudio` existe y conserva la última configuración pendiente si la UI
se monta antes que el audio.
- **`bindSharedSoundEvents` (`libs/app-common/audio.js`)**: despacha eventos
`sharedui:sound` hacia los métodos mapeados (`setBase`, `setAccent`, `setStart`, …)
respetando valores nulos y liberando el listener al desmontar.
- **`ensureAudio` (`libs/sound/index.js`)**: intenta iniciar `Tone.js` y, si el
navegador bloquea el autoplay, crea/cierran contextos nativos para desbloquear la
interfaz sin lanzar errores.
- **Menú de rendimiento (`libs/shared-ui/performance-audio-menu.js`)**: script de
carga opcional que muestra _lookAhead_ y _updateInterval_ efectivos para validar la
configuración aplicada por el bridge de scheduling.

## Estructura

El repositori es divideix en diversos espais lògics:

- `Apps/`: Conté cada mini-app amb la seva UI específica.
  - `App1/`
  - `App2/`
  - `App3/`
  - `App4/` · Pulsos fraccionados amb editor `n/d`, menú aleatori i menú de rendiment.
- `libs/app-common/`: utilitats comunes com `computeHitSizePx`, `computeNumberFontRem`
  i `solidMenuBackground` tenen tests dedicats. Inclou també el bridge de audio,
  menús de mixer/aleatorietat i càlculs de subdivisions.
- `libs/sound/`: motor `TimelineAudio`, mixer global, `ensureAudio` i càrrega de mostres.
- `libs/shared-ui/`: capçalera, dropdowns de sons, _hover_ compartit i menú flotant de rendiment.
- `libs/random/`: generació de paràmetres aleatoris per a Lg, V, T o Pulsos.
- `config/`: Configuracions comunes (ESLint, Prettier, TypeScript, etc.) per a
  totes les apps i paquets.

Cada app disposa del seu propi `README.md` quan cal documentar fluxos específics
(p. ex. `Apps/App4/README.md` detalla la seva estructura de dades i integració
d'àudio).

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

La suite de Jest cobreix els mòduls compartits (`libs/app-common`, `libs/sound`,
`libs/shared-ui`, …) i valida que les rutes d'import, el desbloqueig d'àudio
(autoplay) i els menús compartits continuïn funcionant després de cada canvi.
Cada mini-app hauria de definir els seus propis tests complementaris quan
afegeixi lògica específica.
