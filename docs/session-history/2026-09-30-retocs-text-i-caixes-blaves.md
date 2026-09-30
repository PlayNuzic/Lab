# 2026-09-30 — Retocs de text del SI i fora les caixes blaves

## Export del panell cuinat (`sistema/js/slide-data.js`)
- Paso 4: títol dels tips «Prueba la línea Sonora» (abans «Prueba Práctica»).
- Paso 22, frase 5: «más alegre o misteriosa; más luminosa u oscura».
- Paso 29 (coda): dues frases noves al final: «Como ocurre con cualquier
  viaje, el punto de llegada puede ser también un nuevo punto de partida.» i
  «¿A dónde quieres ir ahora?».
- L'export portava un `<p><b></b><br></p>` final (romanent del
  contenteditable). No s'ha cuinat, perquè al parallax seria una cel·la buida.
- La resta de l'export ja coincidia amb el codi: el text del paso 3, el
  tipsTitle del paso 12, el títol «Coda», la densitat i els efectes del
  parallax.

## Caixes blaves (`mark.hl-box`) fora del capítol Posiciones
Tretes amb el seu text als passos 3 (Pulso / Pulsación / Paso), 4 (línea
temporal / línea sonora / plano musical) i 5 (Par P-N). Ja no en queda cap al
SI. L'estil `.hl-box` (slides.css) i el botó del panell continuen existint.

## Nota: els dos «Restaurar» del panell
- «Restaurar paso» (`#tw-reset-paso`, tweaks.js) només descarta els
  overrides de text/títol/tips. Si el paso no en té, no fa res.
- «Restaurar» de la secció Parallax Lab (parallax-builder.js →
  `resetConfig`) és el que esborra la config d'efectes desada i torna al
  `PRESETS`.
Per això els passos 7 i 29 seguien exportant la config antiga.
