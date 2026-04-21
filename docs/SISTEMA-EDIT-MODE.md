# Sistema Interactivo — Mode edició de textos

Permet editar el contingut textual dels slides directament al navegador (títol, text teòric, títol i cos del tips) amb persistència a `localStorage`. Pensat com a eina de redacció iterativa abans de fixar els canvis a `slide-data.js`.

## Com fer-ho servir

1. Obre `sistema/index.html?tweaks=1` (o el mateix URL en el mode edició de Claude Design).
2. Al panell **Tweaks** marca **«Editar textos»**. Apareixen dos botons: **Exportar** i **Restaurar paso**.
3. Fes clic sobre el títol, el text o qualsevol camp del tips i edita'l. Es veu un outline verd quan el camp està en focus.
4. En fer `blur` (clicar fora o tab), el canvi es guarda a `localStorage` sota la clau `sistema.overrides`.
5. Pots navegar entre slides, canviar tema, recarregar, etc. Els canvis es mantenen.

## Fer permanents els canvis (fixar a `slide-data.js`)

1. Clica **Exportar** al panell. Es copia un JSON al porta-retalls amb l'estructura:
   ```json
   {
     "6": {
       "text": "<p>Nou primer paràgraf…</p><p>…</p>",
       "tipsTitle": "Prova el Plano Nuzic",
       "tips": "<p>…</p>"
     },
     "4": { "title": "Nou títol" }
   }
   ```
2. Obre [sistema/js/slide-data.js](../sistema/js/slide-data.js) i localitza `slideContent`.
3. Per cada paso del JSON, aplica els valors sobre l'entrada corresponent:
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

| Camp        | On viu a `slide-data.js`         | Format      |
|-------------|----------------------------------|-------------|
| `title`     | `slideMatrix[paso].title`        | Text pla    |
| `text`      | `slideContent[paso].text`        | HTML (`<p>`, `<strong>`, `<em>`, `<code>`) |
| `tipsTitle` | `slideContent[paso].tipsTitle`   | Text pla    |
| `tips`      | `slideContent[paso].tips`        | HTML        |

## Detalls tècnics

- Els overrides s'apliquen al render via `getOverride(paso, field)` a [sistema/js/slides.js](../sistema/js/slides.js); si no hi ha override, es llegeix del contingut original.
- Els camps editables porten `data-field="…"` i reben `contenteditable="true"` quan el mode edició està actiu (`body[data-editable="true"]`).
- El guardat es produeix a `blur` de cada camp; no cal botó desar.
- El panell d'accions (`Exportar` / `Restaurar paso`) només apareix quan «Editar textos» està activat.

## Troubleshooting

- **He editat i al recarregar no es veuen els canvis** — comprova que «Editar textos» estava activat quan editaves. Sense ell, els camps no són `contenteditable` i no hi ha `blur` que guardi.
- **Vull veure el JSON sense copiar** — `localStorage.getItem('sistema.overrides')` des de la consola, o mira el log de la consola després de clicar **Exportar** (també s'hi imprimeix).
- **He trencat el format del text** — `Restaurar paso` el recupera a l'original del `slide-data.js`.
