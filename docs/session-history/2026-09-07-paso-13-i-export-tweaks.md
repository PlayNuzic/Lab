# 2026-09-07 — Paso 13 (text nou) + export del panell tweaks

Continuació de [2026-09-02](2026-09-02-analytics-test-usuari-clarity.md).

## 1. Paso 13 — «La línea temporal con compás»

Text nou de l'usuari (tanca el pendent obert des del 2026-08-31: el text antic descrivia la
línia helicoidal/espiral del donut i App17 és lineal des del redisseny del 2026-08). El text
nou parla només de compàs, repeticions, longitud i superíndex, sense cap referència circular.
Format reconstruït amb les convencions dels pasos veïns: `hl-yellow` a «línea temporal» (primera
aparició), negreta a «cantidad de compases», «longitud» i «superíndice». Caixa verda amb el
títol i els tres paràgrafs nous (longitud total a la vista, què observar, tip sobre la longitud).

## 2. Export del panell tweaks

Export amb `overrides` (1, 2, 4, 7, 11, 13, 17, 22, 29), `densityByPaso` (1, 13) i `parallaxFx`
(1, 2, 11, 28.5, 28.7). Comparat camp a camp amb el codi: gairebé tot ja estava cuinat de tandes
anteriors. Canvis reals aplicats:

- `slideContent[11].text`: tres negretes noves («extensos», «"ciclo"», «módulos»).
- `slideContent[13].tipsTitle`: «Prueba la línea temporal con compás» (l'export corregeix el
  «Circular» que havia quedat al primer redactat del dia).
- `slideMatrix` paso 13: densitat `compact` → `cozy`; com que `cozy` és `DEFAULT_DENSITY` i cap
  fila del codi l'explicita (18 `compact`, 3 `loose`), s'ha retirat el camp.
- `PRESETS[11]` (parallax-lab.js): entrada `app-reveal` off amb `fraseAparicio: 2`. Inert (el
  paso 11 no declara cap app des del 2026-08-31); es conserva amb els params afinats, com el 29.

No aplicat, i per què: `overrides[2].text` només difereix del codi en tres salts de línia entre
`</p>` i `<p>` (artefacte del contenteditable del panell). Contingut idèntic, zero canvi visual;
es manté el format del codi, més llegible.

Validació: `node --check` dels dos fitxers, validador de rangs de l'skill (tots els params dins
de rang) i `npm test` → **92 suites / 1534 tests**.

## Pendent

- Push (main va per davant d'origin des del 2026-09-01).
