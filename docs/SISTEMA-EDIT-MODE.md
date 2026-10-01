# Sistema Interactivo — Mode edició de textos

Permet editar el contingut textual dels slides directament al navegador (títol, text teòric, títol i cos del tips) amb persistència a `localStorage`. Pensat com a eina de redacció iterativa abans de fixar els canvis a `slide-data.js`.

## Com fer-ho servir

1. Obre `sistema/index.html?tweaks=1` (o el mateix URL en el mode edició de Claude Design).
2. Al panell **Tweaks** marca **«Editar textos»**. Apareixen dos botons: **Exportar** i **Restaurar paso**.
3. Fes clic sobre el títol, el text o qualsevol camp del tips i edita'l. Es veu un outline verd quan el camp està en focus.
4. En fer `blur` (clicar fora o tab), el canvi es guarda a `localStorage` sota la clau `sistema.overrides`.
5. Pots navegar entre slides, canviar tema, recarregar, etc. Els canvis es mantenen.

## Fer permanents els canvis (fixar a `slide-data.js`)

**Camí habitual:** clica **Exportar**, enganxa el JSON a Claude i la skill
**`aplicar-tweaks`** el cuina al codi: textos a `slide-data.js` i efectes del parallax a
`PRESETS`. Després, al navegador, prem **Restaurar paso** (i el **Restaurar** del
Parallax Lab si hi havia efectes) per veure la versió del codi.

Fer-ho a mà:

1. Clica **Exportar** al panell. Es copia un JSON al porta-retalls amb l'estructura:
   ```json
   {
     "overrides": {
       "6": {
         "text": "<p>Nou primer paràgraf…</p><p>…</p>",
         "tipsTitle": "Prova el Plano Nuzic",
         "tips": "<p>…</p>"
       },
       "4": { "title": "Nou títol" }
     },
     "densityByPaso": { "13": "cozy" },
     "parallaxFx": { "2": { "mouse-tilt": { "on": true, "params": {} } } }
   }
   ```
   `densityByPaso` va al camp `density` de la fila del `slideMatrix`, i `parallaxFx` al
   mapa `PRESETS` de [sistema/js/parallax-lab.js](../sistema/js/parallax-lab.js) (vegeu
   el [manual del Parallax Lab](parallax-lab-manual.md)).
2. Obre [sistema/js/slide-data.js](../sistema/js/slide-data.js) i localitza `slideContent`.
3. Per cada paso d'`overrides`, aplica els valors sobre l'entrada corresponent:
   - `title` → camp `title` del `slideMatrix` (no de `slideContent`; el títol viu al matrix).
   - `text` → camp `text` dins `slideContent[paso]`.
   - `tipsTitle` → camp `tipsTitle` dins `slideContent[paso]`.
   - `tips` → camp `tips` dins `slideContent[paso]`.
4. Commiteja el canvi a `slide-data.js`.
5. Netega l'estat editat: al panell Tweaks, clica **Restaurar paso** a cada paso modificat — o bé des de la consola del navegador:
   ```js
   localStorage.removeItem('sistema.overrides');
   ```

## Camps editables

| Camp | On viu a `slide-data.js` | Format |
| --- | --- | --- |
| `title` | `slideMatrix[paso].title` | Text pla |
| `text` | `slideContent[paso].text` | HTML (`<p>`, `<h2>`/`<h3>`/`<h4>`, `<strong>`/`<b>`, `<em>`/`<i>`, `<code>`, `<ul>`/`<ol>`/`<li>`, `<blockquote>`, `<sup>`/`<sub>`, `<mark>`, `<a>`, `<img>`) |
| `tipsTitle` | `slideContent[paso].tipsTitle` | Text pla |
| `tips` | `slideContent[paso].tips` | HTML (mateixos tags que `text`) |

## Auto-sanitització de pastes

Quan enganxes contingut des de Google Docs / Word / pàgines web, el navegador
porta tot el format inline (`font-family: Arial`, `font-size: 11pt`,
`color: #000`, `line-height: 1.38`, etc.). Això **trenca la coherència
visual** del Sistema, que usa Ubuntu via `--font-body` i mides via
`clamp()`.

El paste és intervingut a [sistema/js/slides.js — `handlePaste`](../sistema/js/slides.js):

- **Camps de text pla** (`title`, `tipsTitle`): s'enganxa només `text/plain`,
  sense cap tag HTML.
- **Camps rich** (`text`, `tips`):
  1. S'agafa el `text/html` del clipboard.
  2. Es passa per `sanitizeHtml()`:
     - Es conserven només els tags semàntics (`p`, `h2`–`h4`, `strong`, `b`,
       `em`, `i`, `code`, `br`, `ul`, `ol`, `li`, `blockquote`, `sup`, `sub`,
       `mark`, `a`, `img`).
     - Tot la resta s'unwrap (es mantenen els fills, es treu el wrapper).
     - `<span>` amb `font-weight: bold` → `<strong>`. Amb `font-style:
       italic` → `<em>`. Amb tots dos → `<strong><em>...</em></strong>`.
     - Es treuen **tots** els atributs (`style`, `class`, `dir`, `id`, etc.), amb
       aquestes excepcions:
       - `<mark>` conserva la classe de ressaltat (`hl-pink`, `hl-yellow`, `hl-box`);
         sense cap classe vàlida, es desembolica.
       - `<a>` conserva l'`href` si és segur (http(s), mailto o ruta relativa) i, si
         és extern, hi afegeix `target="_blank" rel="noopener"`.
       - `<img>` conserva `src` (si és segur) i `alt`, i només les classes de
         col·locació del parallax `ample`, `lateral` i `eix` (vegeu el
         [manual del Parallax Lab](parallax-lab-manual.md), §7).
     - `&nbsp;` → espai normal. Múltiples espais → un sol. Paràgrafs buits → eliminats.
  3. S'insereix l'HTML net al cursor.

A més, **a `loadOverrides()`** el contingut existent al `localStorage`
també es passa per `sanitizeHtml()` un cop a la càrrega — així les
edicions antigues amb format brut es netegen automàticament la primera
vegada que es recarrega la pàgina.

I a **`persistField()`** (al `blur`) es torna a sanititzar com a defensa
en profunditat per si el contingut va arribar via un camí no-paste.

## Detalls tècnics

- Els overrides s'apliquen al render via `getOverride(paso, field)` a [sistema/js/slides.js](../sistema/js/slides.js); si no hi ha override, es llegeix del contingut original.
- Els camps editables porten `data-field="…"` i reben `contenteditable="true"` quan el mode edició està actiu (`body[data-editable="true"]`).
- El guardat es produeix a `blur` de cada camp; no cal botó desar.
- El panell d'accions (`Exportar` / `Restaurar paso`) només apareix quan «Editar textos» està activat.
- **Dos botons de restaurar, dues coses diferents:**
  - **Restaurar paso** (a dalt) descarta només els textos editats del paso (`sistema.overrides`). Si el paso no en té, no fa res.
  - **Restaurar**, a la secció **Parallax Lab**, descarta els efectes desats del paso (`sistema.parallaxFx`) i torna a la recepta del codi (`PRESETS`).
- Quan el codi reescriu un paso sencer, `OVERRIDES_VERSION` (a `slides.js`) pot descartar automàticament els textos desats d'aquell paso en la càrrega següent (v9: paso 1).
- Les imatges dins de les frases del parallax es gestionen al bloc **«Imágenes del parallax»** del panell (vegeu el [manual del Parallax Lab](parallax-lab-manual.md), §7).

## Troubleshooting

- **He editat i al recarregar no es veuen els canvis** — comprova que «Editar textos» estava activat quan editaves. Sense ell, els camps no són `contenteditable` i no hi ha `blur` que guardi.
- **Vull veure el JSON sense copiar** — `localStorage.getItem('sistema.overrides')` des de la consola, o mira el log de la consola després de clicar **Exportar** (també s'hi imprimeix).
- **He trencat el format del text** — `Restaurar paso` el recupera a l'original del `slide-data.js`.
- **He cuinat una recepta de parallax al codi i no la veig** — el teu navegador té la config desada d'aquell paso, i mana sobre el codi. Prem **Restaurar** a la secció Parallax Lab (no «Restaurar paso»).
