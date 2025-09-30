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
- `Apps/App1`, `Apps/App2`, `Apps/App3`, `Apps/App4` comparteixen gran part de la lògica de
  timeline i àudio via `libs/` però mantenen HTML i estils propis.
- `libs/` agrupa els mòduls reutilitzables:
  - `app-common/`: càlculs de subdivisions, _helpers_ de rang, menús, mixer,
    programació d'àudio, controladors de loop i temes.
  - `sound/`: motor `TimelineAudio`, mixer global i càrrega de mostres.
  - `shared-ui/`: capçalera, desplegables de so, sistemes de _hover_ i menú de
    rendiment d'àudio.
  - `random/`, `utils/`, `cards/`, etc. suporten funcionalitats concretes.
- `config/` conté configuracions comunes (Jest, ESLint, etc.).

## 🚨 **PRINCIPIS DE DESENVOLUPAMENT OBLIGATORIS**

### **PRIORITZAR SEMPRE COMPONENTS COMPARTITS**

Quan implementis noves funcionalitats o solucionis bugs, segueix SEMPRE aquesta jerarquia:

1. **🔍 PRIMER**: Comprova si ja existeix un component compartit a `libs/app-common/`
2. **🛠️ SEGON**: Si no existeix cap component compartit, crea'n un que es pugui reutilitzar
3. **❌ ÚLTIMA OPCIÓ**: Només implementa codi específic d'app quan sigui realment necessari

### **Exemples de Components Modulars Recents**

#### **Controladors de Loop** (Nou - 2024)
- **Ubicació**: `libs/app-common/loop-control.js`
- **Tipus**: `createLoopController`, `createRhythmLoopController`, `createPulseMemoryLoopController`
- **Utilitzat a**: App2, App4
- **Benefici**: Sincronització d'àudio consistent, eliminació de duplicació de codi

#### **Gestió de DOM**
- **Ubicació**: `libs/app-common/dom.js`
- **Funcions**: `bindRhythmElements`, gestió automàtica de LEDs
- **Utilitzat a**: Totes les apps
- **Benefici**: Eliminació de múltiples `document.getElementById`

#### **Gestió de LEDs**
- **Ubicació**: `libs/app-common/led-manager.js`
- **Funcions**: `createRhythmLEDManagers`, estat auto/manual
- **Utilitzat a**: Totes les apps
- **Benefici**: Comportament consistent de LEDs

### **Protocol per a Bug Fixes**

1. **Analitzar si el bug afecta múltiples apps**
2. **Crear component compartit** que solucioni el problema correctament
3. **Migrar totes les apps afectades** per utilitzar el component compartit
4. **Verificar comportament consistent** a totes les apps
5. **Escriure tests** per al nou component compartit

## Execució de tests

Executa totes les proves amb Jest des de l'arrel:

```bash
npm test
```

Les suites cobreixen els mòduls compartits (`libs/app-common`, `libs/sound`,
`libs/random`, `libs/utils`, …). Alguns tests simulen el DOM i WebAudio; assegura't
que continuen passant després de modificar aquestes zones.
