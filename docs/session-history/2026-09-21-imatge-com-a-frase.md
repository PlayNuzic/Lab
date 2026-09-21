# 2026-09-21 — Una imatge pot ser una frase del parallax

Continuació de [2026-09-21 (coda)](2026-09-21-coda-cta-enllacos.md).

## La idea: cap canvi al motor

Una imatge dins del text d'un paso és **una frase més**: `<p><img src="images/frases/…"
alt="…"></p>`. El driver li dona la seva cel·la de scroll, el focus-mode la fon com les altres
i el progrés la compta — tot gratis, sense tècnica nova ni cap línia a `parallax-lab.js`. La
regla del motor («mai tocar `.parallax-frases` ni els seus `<p>`») queda intacta.

**Separada de les imatges de fons** (petició de l'usuari), en mecanisme i en fitxers:
la imatge de fons d'un paso segueix sent `slideContent[paso].image` → `.parallax-img` (una capa
amb `data-depth`, que bg-dim atenua) i viu a `sistema/images/`; les imatges de frase viuen a
`sistema/images/frases/` i no passen per allà.

## Canvis

- `slides.js`: el sanejador accepta `<img>` i en conserva `src` (amb `isSafeHref`, el mateix
  criteri que els enllaços) i `alt`; un `src` no segur elimina la imatge. Calia perquè el text
  editat al panell passa pel sanejador.
- `parallax.css`: `.parallax-frases > p:has(> img)` sense caixa de text (`line-height: 0`),
  imatge centrada, `max-width: min(100%, 60rem)`, `max-height: 58dvh` i cantonades arrodonides.
  En tema fosc la il·lustració (fons clar) va sobre una targeta blanca amb padding: si no,
  enlluerna i el text fosc que porta dibuixat es perd.
- Panell (`index.html`, `tweaks.css`, `tweaks.js`): bloc **«Imagen como frase»** dins del mode
  edició — ruta, descripció (alt), selector de posició («Al principio» / «Después de la frase
  N» / «Al final») i botó Insertar. Reescriu el text del paso amb la imatge a la posició
  escollida i el desa com qualsevol altra edició, així que surt a l'**Exportar** i es cuina a
  `slide-data.js` pel camí de sempre. Si el paso no és de parallax, el bloc queda inert.
- `slide-data.js`: la il·lustració del recorregut al **paso 1**, entre les frases 5 i 6 (just
  després d'«A lo largo de este recorrido aprenderemos…», que és el que il·lustra).

## Imatge

`sistema/images/frases/recorrido.webp` — 1400×560, **32 KB**. L'original era un PNG de 1983×793
i 978 KB; sense `cwebp` ni PIL a la màquina i amb l'ffmpeg sense `libwebp`, la conversió s'ha fet
amb el canvas del Chrome headless (`toDataURL('image/webp', 0.9)`): 30× més lleuger amb el text
del diagrama intacte.

## Verificació

`slides.js` i `tweaks.js` són scripts de pàgina sense exports (no hi ha harness de Jest per a
ells), així que la prova és en navegador headless: paso 1 → 8 frases i 9 cel·les de driver, la
imatge a la frase 6, `src`/`alt` correctes i render de ~960 px; captures en clar i en fosc. El
control del panell, conduït de punta a punta a un altre paso (7): amagat fora del mode edició,
7 opcions de posició, inserció després de la frase 2 → imatge a la frase 3, atributs escapats i
override desat. Suite: 92 suites / 1536 tests.

## Pendent

- Push.
