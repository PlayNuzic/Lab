# 2026-09-28 — Cap frase del parallax pot tapar el títol

Continuació de `2026-09-23-imatges-lligades-a-frases.md`.

## Problema
A la intro (paso 1), «Aquí empieza el viaje» + la imatge a tot l'ample eren
més altes que l'escenari de frases. Com que la frase es centra amb
`top:50%` + `translateY(-50%)`, el que sobrava sortia per dalt i tapava el
títol.

## Solució (`sistema/css/parallax.css`)
- `.parallax-frases > p { max-height: 100% }`: la caixa de la frase mai és
  més alta que l'escenari. El centrat la deixa com a molt a dalt de tot, i
  el contingut que no hi cap desborda cap avall. Val per a qualsevol frase.
- `.parallax-frases { container-type: size }` perquè les imatges es limitin a
  l'alçada real de l'escenari (unitats `cqh`):
  - imatge sola: `min(58dvh, 100cqh)`;
  - imatge lligada: `min(40dvh, 100cqh - 2lh - marge)` (reserva 2 línies de
    text);
  - imatge lligada amb `.ample`: `min(60dvh, 100cqh - 2lh - marge)`.
  Cada `min()` porta abans un valor en `vh` de reserva.
  Substitueix el `@media (max-height: 820px)` de la tanda anterior.
- `margin-top: clamp(8px, 1.6vh, 18px)` a l'escenari: aire mínim sota el
  títol quan una frase l'omple sencer.
- `images/frases/recorrido.webp` retallat de nou del PNG original: files
  y [120, 663] de 793 (el dibuix ocupa [160, 623]), a amplada completa
  1983×543, 40KB (abans 1400×560 sense retallar).

## Verificació
Pàgina de diagnosi en headless: recorre totes les frases i mesura la vora
de dalt del contingut de la frase activa respecte al títol. Marge mínim
positiu a tot arreu: paso 1 de 1694×940 fins a 800×600 i mòbil; passos 2,
7, 11, 17, 22 i 29. Cap frase desborda per sota del slide.

Nota per a verificacions futures: en aquest Mac el Chrome headless no té
display link (`CVDisplayLinkCreateWithCGDisplay failed`) i
`requestAnimationFrame` no s'executa mai. El driver del parallax pinta dins
un rAF, així que la pàgina de diagnosi l'ha de substituir per un
`setTimeout(16)` i disparar l'event `scroll` a mà. A zsh, `$args` sense
cometes no es parteix en paraules.
