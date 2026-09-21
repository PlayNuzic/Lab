# 2026-09-15 — Test d'usuari v3 (documents) + embut «Continuacion en frio» a Clarity

Continuació de [2026-09-02](2026-09-02-analytics-test-usuari-clarity.md). Cap canvi de codi.

## Decisions de l'equip (reunió sobre la v2)

- Primera ronda acotada: **només sessions moderades**, 3 persones per perfil (12 persones),
  **dues sessions de 60 min per persona**: sessió 1 = Introducción + Posiciones (pasos 1-6),
  sessió 2 = Intervalos (pasos 7-10), entre 2 i 7 dies després i sense usar el Sistema entremig.
- **Continuació en fred voluntària** des de Módulos (paso 11) fins a la Coda, 3 setmanes, amb
  diari i entrevista final. Sense test en mòbil. Grup intern ajornat a la segona ronda.
- Mesures noves: retenció (2 ítems de Posiciones a l'inici de la sessió 2), % que accepta
  continuar, % que torna, sessió en què assoleix Fracciones / Escalas / Coda.

## Enllaços (un sol codi per persona; `analytics.js` ja ho suporta sense canvis)

`?tester=CODI` (sessió 1) · `?tester=CODI&paso=7` (sessió 2) · `?tester=CODI&paso=11`
(continuació; és l'únic que s'envia a la persona). El full Participantes del registre els
compon sols.

## Clarity

Tercer embut **Continuacion en frio**: paso_11 → paso_17 → paso_22 → paso_29 (les sessions
que entren pel paso 11 no compten als embuts «Capitulos» ni «Posiciones e Intervalos»).
Segments sense canvis.

## Documents (fora del repo)

`~/Downloads/Test de usuario Nuzic/v3/`: 01 pla v3 (conserva les edicions manuals de la v2:
glossari com a secció 0, §1.3 reduït) · 02 targetes de les dues sessions + notes per al
moderador + tests previ / final A / final B + hoja de misión · 03 guió (S1, S2, pont, cierre)
· 04 observador (retenció, SA, sessió 1/2) · 05 registre xlsx (3 enllaços, continúa/vuelve,
resum per perfil) · 06 qüestionaris (F2a nou; conserva les edicions manuals de la v2) ·
07 consentiment (variant única amb les dues fases). Generats amb docx-js/exceljs des de
l'scratchpad; els v2 es mantenen a la carpeta arrel.

## Pendent

- Publicar la versió congelada abans del pilot (commit + push ja fets el 2026-09-0x:
  `37bbd08c`); comprovar els enllaços `&paso=7` i `&paso=11` i els events amb `?tester=PRUEBA`.
- Paso 13 abans que comenci la continuació en fred.

## 2026-09-16 — v3.1 (revisió de l'equip)

Documents a `~/Downloads/Test de usuario Nuzic/v3.1/`. Canvis: targetes amb franja gris per
al moderador (sessió, moment, paso, app, SA; es doblega abans d'entregar); test final A amb
un ítem nou per a tothom (P(3) + iT(2) → la següent nota al 5, marcat a la línia) i la
traducció de P3/P4 sense «compás de negras» (0-12); test final B amb «pulso absoluto 9» i un
ítem nou dins de compàs (pulso 2 del compás 1 + iT(3) → P(1²)) (0-10); tot el text de mode
fosc retirat (decisió d'identitat: el SI no en tindrà); paso 13 revisat i donat per bo.
Detectat: el títol dels tips del paso 12 («Prueba los Intervalos Temporales») és heretat del
paso 8. Sessions moderades: es mantenen d'una persona (pendent de decisió sobre fer-les per
perfil, 3 persones alhora).
