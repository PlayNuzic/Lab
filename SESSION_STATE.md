# SESSION_STATE

Cap tasca activa.

Última tasca completada: **Sistema — textos del document "NUZIC Textos SI" i
scroll del parallax** (2026-08-31). Commits a main `eee0ea7b`, `509f4ce0`,
`b038eefb` (cap pujat a origin). Acta amb el detall de les quatre tandes:
`docs/session-history/2026-08-31-sistema-textos-nuzic-si-i-scroll-parallax.md`.
Suite: 90/1496.

## Pendent (decisions i verificacions de l'usuari)

Verificació al navegador — el trackpad ja s'ha provat ("ara sí funciona
millor"); resta:
- **Ratolí amb cremallera**: un notch = una frase (detecció per `deltaMode`
  o `wheelDeltaY` múltiple de 120), a ritme NOTCH_MS 320. No provat.
- **Tàctil**: scroll natiu amb snap dins el driver (`touch-action: pan-y`).
  No provat.
- **Paso 2 fins al final**: última frase sencera, l'app al scroll següent,
  i com se'n surt. **Restaurar** als pasos 1, 2 i 11 (localStorage tapa
  PRESETS i textos).

Decisions:
- **`mida: 1` a l'app del paso 2**: amb l'app a tot l'espai, sobre l'iframe
  la roda és de l'app i per passar de paso cal nav o teclat. Amb `mida`
  < 1 queda marge on la roda encara funciona. Triar.
- **"Sucesión" a `Apps/` i `libs/`**: 51 llocs en 29 fitxers encara diuen
  "Sucesión" (títols d'app visibles dins el Sistema als pasos 3, 6 i 16, i
  el catàleg `Apps/index.html`), desalineats amb el "secuencia" del
  Sistema. No tocat: l'encàrrec era "al sistema". Estendre-ho o no.
- **Títol del paso 2** "Las posiciones": inventat (el document no en dóna).
- **Paso 13** ("La línea temporal con compás"): text adaptat perquè App17 ja
  no és circular, però ve d'una DIAPO que descrivia el donut. Rellegir.
- **App11 (paso 5)**: mateix plànol que App12/App15 però amb el
  `max-height` per defecte (700) mentre els altres dos van a 1200.
- **Coda (paso 29)**: mateixa recepta de `focus-mode` que la intro (rastre
  0.05) amb frases més curtes; potser admet un rastre més alt.
- **App17 al paso 11**: la matriu encara declara `apps:['App17']` (era per
  a `mask-zoom` amb fons=app); amb mask-zoom ara apagat no s'usa. Pendent
  de la tasca App17 anterior: treure'l o no.

Pendents coneguts documentats al codi (re-obrir quan toqui): A-03+T-04
(ear-training, dorment), A-10 (align 'cycle', decisió de producte), A-05
risc 2 (comptabilitat melòdica), A-08 (re-init d'instruments post
context-closed).
