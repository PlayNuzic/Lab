# 2026-09-23 — Imatges lligades a frases, intro «Introducción» i retocs del parallax

Continuació de `2026-09-23-intro-coda-i-presets-unificats.md`.

## Què s'ha fet

### Imatges lligades a una frase (parallax)
- Una imatge pot anar **amb** una frase (apareixen juntes, a la mateixa cel·la
  del scroll) o **sola** (cel·la pròpia, com fins ara).
  - Lligada: `<p>text<br><img …></p>` → CSS `:has(> br + img)`: sota el text,
    centrada horitzontalment, `max-height: 40dvh`.
  - Sola: `<p><img …></p>` → CSS `:has(> img):not(:has(> br))`.
  - La distinció és només CSS (el sanejador treu les classes); cap JS nou al
    driver.
- `class="ample"`: única classe que el sanejador conserva a `img`. Fa la imatge
  a tot l'ample del parallax (`width:100%`, `max-height:60dvh`,
  `object-fit:contain`); en pantalles baixes (`max-height: 820px`) baixa a
  `44dvh` perquè la frase, centrada verticalment, no pugi fins al títol.
- Tweaks → bloc **«Imágenes del parallax»** (sempre visible amb `?tweaks=1`):
  una fila per imatge (nom sense extensió + select de posició + ×) i un
  formulari per inserir-ne una de nova. El select té dos grups: «Junto a la
  frase» (`con:K`) i «Como paso propio» (`sola:K`).

### Intro (paso 1)
- Títol: «Música en movimiento» → **«Introducción»**.
- 13 frases; les de posiciones, intervalos, módulos, fracciones i escalas
  porten cadascuna el seu retall de la imatge del recorregut, i «Aquí empieza
  el viaje» la imatge sencera a tot l'ample.
- Retalls fets des del PNG original (1983×793) amb el canvas de Chrome
  headless (`toDataURL('image/webp')`; no hi ha cwebp/PIL): 5 fitxers a
  `sistema/images/frases/recorrido-*.webp`, ~10KB cadascun. Rangs x (px de
  l'original): [14,365] [365,793] [793,1190] [1190,1551] [1551,1983], y [108,660].
- `OVERRIDES_VERSION = 9`: només descarta el que hi hagi desat del paso 1
  (la resta d'edicions del panell es conserven).

### Altres
- Títols dels passos parallax: mateixa mida que els passos amb app (regla base
  `.slide__title`, `--fs-h1`) i en negreta (es va provar sense negreta i es va
  desfer).
- Fons del rellotge tret dels passos 11 i 28.7; `images/paso-11.jpg` esborrat.
- Enllaços de la coda: cursor de mà. El driver del scroll tapa les frases, així
  que el hover es calcula a mà (`getClientRects` dels `a` de la frase activa) i
  posa `.is-hover` + `cursor:pointer` al driver.
- Test nou: cursor de mà sobre un enllaç de la frase activa, es refà en canviar
  de frase.

## Pendent / ofert
- El text del lab 28.7 encara parla d'«una imagen de fondo».
- Queden regles de mode fosc i el selector «Tema» (el SI no tindrà mode fosc).
- Si el navegador de l'usuari mostra al paso 7 corba 1.5 o al 29 sense
  text-reveal, és config antiga desada: «Restaurar» als passos 7 i 29.
