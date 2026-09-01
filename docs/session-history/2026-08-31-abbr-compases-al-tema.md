# 2026-08-31 — "Nº de compases": offset unificat al tema (App17/19/20)

## Petició
Posar l'etiqueta `abbr--secondary` ("Nº de compases") d'App19 i App20 a la
mateixa posició que la d'App17 (més a prop del cercle).

## Decisió: tocar el tema, no duplicar l'override
Els **únics** consumidors de la pastilla dual `.param--large--dual` són
App17, App19 i App20 (verificat per grep a `Apps/` i `libs/`), i totes tres
volen el mateix offset. En lloc de copiar l'override d'App17 a les altres
dues (tres còpies de la mateixa regla), s'ha corregit el **default del
tema** i s'ha eliminat l'override local, que quedava redundant:

- `libs/shared-ui/nuzic-theme.css` — `.abbr--secondary` de la pastilla
  dual: `top: calc(100% + clamp(0rem, 1.5vw, 1.1rem))` →
  `clamp(0rem, 0.7vw, 0.5rem)`. Comentari actualitzat amb el perquè i amb
  els tres consumidors.
- `Apps/App17/styles.css` — fora el bloc d'override (8 línies).

App19/App20 no tenien cap regla local: només calia el canvi al tema.

## Verificació (Puppeteer)
Gap entre l'etiqueta i la mini-pastilla del cycle, **idèntic a les tres**:
8.0px a 1400×900 standalone i 6.6px a 950×713 en mode embed (`top`
computat 43.19px / 40.83px als tres casos). Cap error de pàgina.
Suite: 90 suites, tots els tests verds.

## Nota
L'etiqueta és `position: absolute`, així que moure-la no altera el layout
de `.inputs` a cap de les tres apps (App19/App20 la tenen dins una fila
`align-items: flex-end` amb Registro i Longitud als costats).
