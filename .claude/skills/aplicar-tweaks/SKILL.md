---
name: aplicar-tweaks
description: "Bakes the sistema/ tweaks-panel Export JSON into versioned code. Use when the user pastes the JSON produced by the panel's 'Exportar' button (sections overrides / densityByPaso / parallaxFx) and wants those localStorage-only edits made permanent in the codebase. Trigger: a pasted export payload, or phrasing like 'aplica aquest export', 'cuina aquesta config', 'aplica al paso N'."
---

# /aplicar-tweaks — cuinar l'export del panell tweaks al codi

El visor de slides (`sistema/`) desa les edicions del panell **tweaks** a `localStorage`
(per navegador). El botó **Exportar** ([tweaks.js](../../../sistema/js/tweaks.js)) empaqueta
tot en un sol JSON amb tres seccions, cadascuna amb un destí fix al codi. Aquest skill
agafa aquest JSON i reparteix cada secció al seu lloc, validat, **sense committar**.

## Entrada

El JSON de l'export té aquesta forma (qualsevol secció pot faltar o venir buida):

```json
{
  "overrides":     { "<paso>": { "title?": "...", "text?": "...", "tipsTitle?": "...", "tips?": "..." } },
  "densityByPaso": { "<paso>": "compact|loose|..." },
  "parallaxFx":    { "<paso>": { "<techId>": { "on": true|false, "params": { ... } } } }
}
```

De vegades l'usuari enganxa **només una secció** (p.ex. `{ "paso": 22, "parallaxFx": {...} }`
que és el que copia el botó "Copiar config" del Parallax Lab). Tracta-ho igual: mira quines
claus hi ha i cuina només aquestes.

## Mapa de destins

| Secció | Destí al codi | Com |
|---|---|---|
| `overrides[paso].text` / `.tips` / `.tipsTitle` | `slideContent[paso]` a [slide-data.js](../../../sistema/js/slide-data.js) | camps HTML; reemplaça el valor d'aquell paso |
| `overrides[paso].title` | on aquell paso ja llegeix el títol | normalment el camp `title` de la fila del `slideMatrix`; **grepa primer** per confirmar si el paso el treu de `slideMatrix` o de `slideContent` |
| `densityByPaso[paso]` | camp `density:` de la fila del `slideMatrix` d'aquell paso | afegeix/actualitza `density:'...'` a la fila |
| `parallaxFx[paso]` | mapa `PRESETS` a [parallax-lab.js](../../../sistema/js/parallax-lab.js) | una entrada per paso; ordre canònic de tècniques |

## Procediment

1. **Parseja i identifica** quines seccions porten dades. Per a cada paso afectat, obre el
   fitxer destí i localitza la fila/entrada existent (grep pel `paso:`).

2. **`parallaxFx` → `PRESETS`** (el cas més freqüent):
   - Escriu/actualitza `PRESETS[paso]` amb les tècniques en **ordre canònic** (l'ordre de
     l'array `TECNIQUES`): scroll-depth, multi-speed, mouse-tilt, float-drift, depth-blur,
     color-shift, rotate-progress, zoom-drift, inertia, gradient-drift, mask-zoom,
     text-reveal, marquee, spotlight, focus-mode, bg-dim, app-reveal.
   - **Conserva les entrades `on:false` amb params afinats** — així, en activar-les al
     panell, ja surten a punt.
   - **Valida rangs** abans d'escriure (vegeu sota). Si un valor cau fora de rang o un
     `techId` no existeix, atura't i informa; no escriguis brossa.
   - Les tècniques absents de l'export queden fora del preset (off amb defaults). No cal
     llistar-les.

3. **`overrides` → `slideContent` / `slideMatrix`**:
   - `text`/`tips`/`tipsTitle` són **HTML ja sanejat** (el panell hi passa `sanitizeHtml`);
     copia'ls tal qual dins `slideContent[paso]`. Usa template literals per al multilínia.
   - `title`: grepa on el llegeix aquell paso i posa'l allà (evita duplicar-lo als dos llocs).

4. **`densityByPaso` → `slideMatrix`**: afegeix o canvia `density:'...'` a la fila del paso.

5. **Idempotència per paso**: toca **només** els pasos presents a l'export. Mai reescriguis
   pasos que no hi surten ni facis `PRESETS = {...}` sencer de zero si ja en tenia d'altres.

6. **Verifica**: `node --check` dels fitxers tocats + `NODE_OPTIONS=--experimental-vm-modules
   npx jest` (tota la suite en verd). Per a `parallaxFx`, corre també el
   validador de rangs de sota.

7. **No committis.** Deixa-ho a l'arbre de treball i resumeix a l'usuari què s'ha cuinat i on.

## Validador de rangs per a parallaxFx

Enganxa el bloc `parallaxFx` (o el `params` per tècnica) i corre:

```bash
node -e "
import('./sistema/js/parallax-techniques.js').then(m => {
  const FX = /* enganxa aquí { techId: {on,params}, ... } */;
  let bad = 0;
  for (const [id, cfg] of Object.entries(FX)) {
    const t = m.TECNIQUES.find(x => x.id === id);
    if (!t) { console.log('techId desconegut:', id); bad++; continue; }
    for (const [k, v] of Object.entries(cfg.params || {})) {
      const p = t.params.find(pp => pp.key === k);
      if (!p) { console.log(id + '.' + k + ' — param desconegut'); bad++; continue; }
      if (v < p.min || v > p.max) { console.log(id + '.' + k + ' = ' + v + ' FORA [' + p.min + ',' + p.max + ']'); bad++; }
    }
  }
  console.log(bad ? bad + ' problemes' : 'Tots els valors dins de rang ✓');
});
"
```

## Convencions i matisos (institucionals)

- **Prioritat de config al motor**: `localStorage` de l'usuari > `PRESETS[paso]` > defecte
  genèric (scroll-depth sol). Conseqüència: en un navegador que ja ha tocat aquell paso, el
  preset cuinat **no es veu** fins que l'usuari prem el **Restaurar de la secció Parallax
  Lab** (que esborra el localStorage d'efectes del paso i cau al preset). **No és el
  «Restaurar paso»** de dalt del panell: aquest només descarta textos, i si el paso no en
  té no fa res. Els textos cuinats tampoc es veuen si el navegador en té una versió desada:
  allà sí que cal «Restaurar paso». Recorda tots dos al resum, segons el que s'hagi cuinat.
- **L'export porta TOTA la config desada al navegador**, no només el que s'acaba de tocar.
  Abans de cuinar, compara cada camp amb el codi actual (i, si n'hi ha, amb l'export
  anterior): cuina només el que canvia de debò. Si un valor difereix del codi però ja hi
  era en exports anteriors, pot ser config antiga no restaurada (cas real: els passos 7 i
  29 després d'unificar els presets). Pregunta abans de sobreescriure el codi amb això.
- **Romanents de l'editor**: un `<p><b></b><br></p>` o `<p><br></p>` buit no es cuina. Al
  parallax cada `<p>` és una cel·la del scroll, i quedaria una cel·la en blanc. Avisa'n.
- **Si canvia el nombre de frases** d'un paso amb `app-reveal` actiu, revisa
  `fraseAparicio` a `PRESETS`. Per fer entrar l'app a la seva cel·la, ha de ser nombre de
  frases + 1 (vegeu `docs/parallax-lab-manual.md`, `Aparición de app`).
- `PRESETS` viu clonat en profunditat quan es llegeix (`preset()` fa `JSON.parse(JSON.stringify)`),
  així que pots escriure literals JSON purs sense por a aliasing.
- Els camps `text`/`tips` ja vénen sanejats; **no els re-escapis** ni els reformategis.
- La numeració de pasos pot tenir decimals (28.5, 28.7, 1.5…). Respecta la clau tal com ve.
- Regla d'or del repo: no toquis la lògica del motor (`wire()` i tècniques a
  `parallax-lab.js`/`parallax-techniques.js`, `wireParallax` a `slides.js`) ni `parallax.css`;
  dins de `parallax-lab.js` només s'edita el mapa `PRESETS`. Res fora dels destins
  d'aquest mapa. Cap `git add -A` — committa només si l'usuari ho demana i només els fitxers
  tocats.

## Sortida a l'usuari

Resum breu: quins pasos i quines seccions s'han cuinat, on (fitxer), el resultat de la suite,
i el recordatori de quin botó cal prémer per veure-ho en un navegador que ja tenia config
d'aquell paso: «Restaurar» (Parallax Lab) per a `parallaxFx`, «Restaurar paso» per a
`overrides`.
