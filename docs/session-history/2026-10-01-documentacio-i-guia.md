# 2026-10-01 — Documentació al dia i retocs de la guia «Cómo navegar»

## Guia «Cómo navegar» (`sistema/index.html`, `nav.css`)
- Fora «Caja azul»: ja no queda cap `hl-box` al contingut. També s'ha tret
  l'estil `.nav-guide__swatch--box`.
- Fora «Loop — Repite en bucle» i la seva icona: cap app del SI el fa servir.
- «Sonido»: fora la frase dels tres botons de capa. Ara diu que en algunes
  apps, mantenint pulsat el play, apareix el mesclador (`mixer-menu.js`,
  long-press de 500 ms; també amb clic dret o tecla de menú).
- «Colores y cajas»: rosa i groc en dues línies.

## Contingut
- Paso 28.7 (Lab B): el text ja no parla d'«imagen de fondo», que es va
  treure el 2026-09-23. Ara diu que la màscara hi deixa veure l'app.
- Comentari del preset del paso 11 (`parallax-lab.js`) al dia.

## Documentació
- `docs/parallax-lab-manual.md`:
  - ara diu 17 tècniques, i documenta `focus-mode` i `bg-dim`, que no hi eren;
  - `app-reveal`: rang 1–16, paràmetre `mida` i com es compta la cel·la de l'app;
  - Lab B sense imatge, i el mode imatge de `mask-zoom` sense banc de proves;
  - què fa de debò «Restaurar» (torna a `PRESETS`);
  - «Recepta dels intros» a la taula de receptes;
  - secció nova §7, imatges dins de les frases;
  - secció nova §8, camí a producció.
- `docs/SISTEMA-EDIT-MODE.md`:
  - format actual de l'export i camí amb la skill;
  - etiquetes i atributs que conserva el sanejador;
  - els dos botons de restaurar;
  - `OVERRIDES_VERSION`;
  - nova entrada de resolució de problemes.
- Skill `aplicar-tweaks`:
  - quin «Restaurar» correspon a cada secció de l'export;
  - comparar l'export amb el codi (pot portar config antiga);
  - no cuinar paràgrafs buits de l'editor;
  - revisar `fraseAparicio` si canvia el nombre de frases.

## Pendent / ofert
- El botó «Caja» del panell (crea `hl-box`) continua existint, però cap
  contingut no el fa servir.
