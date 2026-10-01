# 2026-10-01 — Línia temporal i línia sonora al parallax de Posiciones (paso 2)

## Què s'ha fet
- Paso 2: text reordenat des de l'export del panell. La frase dels dos eixos
  es parteix en tres, i el paso passa a tenir 9 frases.
  - «Una línea horizontal que representa el paso del tiempo» va amb
    `images/frases/linea-temporal.webp` (`class="eix"`).
  - «Y otra línea vertical que representa los sonidos.» va amb
    `images/frases/linea-sonora.webp` (`class="lateral"`).
- Imatges: captures de l'usuari (1844×134 i 124×914). El fons blanc s'ha fet
  transparent amb un BFS des de la vora sobre els píxels més clars que el
  farcit, i la vora suavitzada s'ha des-barrejat (alpha = (255 − c) / (255 − farcit)
  al canal amb més contrast). Retallades al contingut: 1835×120 i 120×904,
  ~5KB cadascuna.
- `PRESETS[2]` (parallax-lab.js): `app-reveal.fraseAparicio` 8 → 10. Amb 9
  frases, el 8 hauria obert l'app sobre «Tienes ese plano a un scroll…». El
  llindar és `min(fraseAparicio, total − 1)` sobre cel·les 0-based amb la
  cel·la de l'app inclosa.

## Classes noves d'imatge (`parallax.css`; el sanejador de `slides.js` les conserva)
- `--px-eix: min(72px, 13cqh)` a `.parallax-frases`: gruix comú dels eixos.
  Les dues captures tenen el mateix gruix original, així que surten a la
  mateixa escala. 13cqh perquè una línia sonora (≈1:7,5) càpiga sencera.
- `.lateral`: imatge vertical a la dreta del text (absolute, centrada amb la
  frase), amplada = `--px-eix`, `max-height: 100cqh`. La frase li reserva
  l'espai amb padding-right.
- `.eix`: eix horitzontal, alçada = `--px-eix`, `max-width: 100%`. En mòbil
  s'encongeix a l'amplada (allà no pot tenir la mateixa escala).
- `.slide--parallax:has(img.lateral)`: el halo del fons passa a l'esquerra
  (15% 10%) perquè la línia sonora no quedi sobre un fons del mateix color.

## Verificació
Headless (rAF substituït per setTimeout; vegeu l'acta del 2026-09-28).
- Gruix igual a les dues línies: 62 px a 1440×813 i 51 px a 1449×733.
- La línia sonora cobreix l'escenari sense pujar per sobre del títol.
- L'app es revela a la seva cel·la (c9), no a la frase 9.
- Suite: 95 suites / 1580 tests.
