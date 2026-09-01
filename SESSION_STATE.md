# SESSION_STATE

## Tasca activa: reescriptura dels textos del Sistema (2026-08-31)

Tots els textos de `sistema/js/slide-data.js` substituïts pels del document
**"NUZIC Textos SI"** (DIAPO 1-28 + CODA). Suite: 90/1476. **Pendent de
verificació al navegador i de tres decisions de l'usuari** (vegeu sota).

### Fet
- **Paso 0** nou: intro GLOBAL amb parallax (`P-parallax-lab`, App11A, 4/3),
  secció pròpia `intro` ("Introducción"). Text propi de l'usuari
  ("Música en movimiento"), no la DIAPO 1 del document.
- **Paso 29** nou: CODA de tancament, parallax, secció pròpia `coda`.
- **Capítols renombrats**: Posiciones / Intervalos / Módulos / Fracciones /
  Escalas (abans: Descubriendo la Música / Midiendo el movimiento… /
  Ampliando / Fraccionando / Escalas).
- Correspondència **DIAPO n ↔ paso n per a n = 2..28** (verificada amb
  coincidències literals de tips a les DIAPO 2, 3, 8, 12, 20).
- Paso 1 passa a ser l'**intro de capítol de Posiciones** amb la primera part
  de la DIAPO 2; el paso 2 rep la segona part (els dos eixos) + els tips.
- Format ric reconstruït sobre el text nou: `hl-yellow` (línia temporal),
  `hl-pink` (línia sonora), `hl-box` (definicions), `<code>`, `<sup>`, `<h3>`.
- `OVERRIDES_VERSION` 5 → 6 a `slides.js`: descarta els overrides d'edit-mode
  desats a localStorage (taparien els textos nous). Les densitats es mantenen.
- Pasos ocults intactes: 1.5, 18.5, 19.5, 20.5, 21.5, 28.5, 28.7.

### Adaptacions perquè el document contradiu les apps (NO són el text literal)
1. **Paso 13** — el document descriu una línia temporal **circular/helicoidal**;
   App17 ja no és un donut (commit `b141fe5a`). Text adaptat: es manté la idea
   d'espiral com a concepte, els tips ja no diuen "representación circular" ni
   "compara con la lineal del paso 12". Títol: "La línea temporal con compás".
2. **Paso 12** — el document diu "muestra 2 compases completos"; App16 mostra
   **un sol compás** (commit `f1603759`). Tips adaptats.
3. **Paso 15** — el document diu "registro de salida inicial es el 3";
   `App19/main.js:29` → `DEFAULT_REGISTRO: 4`. Tips adaptats a 4.
4. **Paso 6** — el document diu "editor P-N"; l'app és `Sucesión N-P`. Adaptat.
5. **Paso 20** — el document escriu `P⅓(1 3 2 5 7)` per a una seqüència d'iTfr;
   corregit a `iT⅓(...)`.
6. Terminologia: normalitzat a **"sucesión"** on el text mira l'app (el
   document barreja "secuencia" i "sucesión").

### Segona tanda (2026-08-31, mateixa sessió)
- **Renumeració**: intro global 0 → **1**; "Las posiciones" 1 → **2**;
  l'antic paso 2 ("Construimos el plano") **eliminat** — el seu text ja
  vivia sencer dins del nou paso 2. Resultat: pasos 1-29 sense forats.
  El paso 2 passa a ser parallax (`P-parallax-lab`), no un slide d'app.
- El paso 1.5 (1·B, vídeo) es mou a la secció `intro` i
  `HIDDEN_FLAGS.intro1b.section` passa de `descubriendo` a `intro`.
- `OVERRIDES_VERSION` 6 → **7** amb `migrateOverridesV7` (0→1, 1→2, 2 es
  descarta) per a densitats i overrides desats.
- **Export del panell tweaks cuinat** (`/aplicar-tweaks`): el text fusionat
  de `overrides["1"]` és ara `slideContent[2]` (8 frases; l'última, buida a
  propòsit, és on entra l'app). `parallaxFx` → `PRESETS` de parallax-lab.js
  per als pasos **2, 11, 28.5 i 28.7** (el "1" de l'export = paso 2 d'ara).
- **Terminologia**: "sucesión/sucesiones" → **"secuencia/secuencias"** a tot
  `sistema/` (32 substitucions a slide-data.js + 1 comentari a slides.css).
  "sucesivamente" no s'ha tocat (paraula diferent).
- **Dues tècniques noves de parallax** (registre: 15 → 17):
  - `focus-mode` ("Modo foco") — tanca la corba d'opacitat de les frases:
    `op = rastre + (1−rastre)·(1−min(1,|d|))^duresa`. Params `duresa`
    [0.5..4] def 2, `rastre` [0..0.3] def 0.04. És l'única tècnica que
    escriu `style.opacity` de les frases (el motor la reescriu a cada
    frame i cap var CSS la guanyaria); mai transform ni filter.
  - `bg-dim` ("Fondo atenuado") — abaixa símbols i imatge del fons via
    `--px-bgd-sym`/`--px-bgd-img` + classe `.px-bgd`, amb regla a
    parallax-lab.css que guanya per especificitat (cap `!important`).
    Params `simbols` [0..0.12] def 0.04, `imatge` [0..0.2] def 0.04.
  - Totes dues `moviment:false` i cuinades als `PRESETS` dels pasos **1**
    (intro) i **29** (coda). Valors afinats per l'usuari al constructor i
    cuinats des del "Copiar config" del paso 1: `focus-mode` duresa **2**,
    rastre **0.05**; `bg-dim` amb defaults (simbols 0.04, imatge 0.04);
    `app-reveal` **off** (params 8 / 1 / 0.5 conservats). El paso 29 porta
    la mateixa recepta; allà app-reveal és inert (la coda no declara app).
    Surten soles al panell tweaks (s'itera `TECNIQUES`).
- **Frontera de frases verificada** amb 4 tests nous: recórrer les frases
  fins a l'última **no** canvia de paso (ni tan sols el gest que hi
  arriba); només escapa un gest NOU començat ja al límit que hi empenyi
  més de `EDGE_ESCAPE_PX` (340px); enrere no s'escapa mai. És el mateix
  mecanisme per a tots els P-parallax-lab: la intro i la coda no tenen
  cap comportament propi. Suite: 90/1489 (+13).

### Tercera tanda (2026-08-31, mateixa sessió) — panell tweaks i scroll
- **Colors intro/coda**: `--px-accent` vermell (`--nuzic-red`, l'únic to
  que cap capítol usa) a `[data-section="intro"]` i `"coda"` (parallax.css).
- **Negreta dins la frase**: la frase activa passa de 700 a **400** i
  `<b>/<strong>` a 700 + accent. Ubuntu només ve en 400/700: amb l'activa
  en 700 tota la frase semblava negreta. Afecta TOTS els parallax.
- **Model de gest reescrit** (parallax-lab.js `wire()`): stepper amb
  previsualització — un gest = una frase; segueix el dit fins a +1;
  compromet en acabar (≥ MIN_COMMIT 0.12 avança, si no torna); la cua
  d'inèrcia (3 deltes baixant) es consumeix sense efecte; empenta nova
  dins la cua (delta > 1.4× + 4) = gest nou. Frontera: goma de pista
  (EDGE_HINT 0.12) i escapada només amb ≥ EDGE_ESCAPE_PX (380) fora del
  bloqueig d'arribada (ARRIVAL_LOCK_MS 450); enrere mai. Moviment per
  **molla críticament esmorteïda** (STIFF 200 / DAMP 28) en lloc del lerp.
  Retirats: fre exponencial 0.55^n, snap diferit 450ms, EDGE_RESET.
  Tàctil: mateix model (±1 des de l'origen, TOUCH_ESCAPE_PX 90).
- **Ranura d'app-reveal gran**: `width: min(94%, (alçada útil)·0.86·ratio)`;
  el motor fixa `--px-ar-ratio` numèric a la ranura (calc no divideix "4 / 3").
- **App12 = App15**: `max-height: 1200px` també per a App12 (paso 6).
  App11 (paso 5, mateix plànol) segueix al 700 per defecte — no demanat.
- **Export cuinat**: només canviava el paso 4 (línia nova als tips: "Pulsa
  sobre los números de la línea sonora…"). Paso 2, density i parallaxFx
  ja eren idèntics.
- Tests del motor reescrits per al model nou: 12 casos (empenta llarga =
  1 frase, curta torna, cua no suma, empenta nova dins la cua, teclat,
  frontera, bloqueig d'arribada, enrere mai). Suite: 90/1497.

### Pendent de l'usuari
- **Verificar l'scroll al navegador** (trackpad i ratolí): el model nou no
  s'ha provat en execució real, només amb el motor sota jsdom. Constants a
  afinar si cal: PX_PER_FRASE 260, MIN_COMMIT 0.12, EDGE_ESCAPE_PX 380,
  ARRIVAL_LOCK_MS 450, STIFF/DAMP 200/28.
