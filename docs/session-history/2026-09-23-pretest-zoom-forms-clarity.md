# 2026-09-23 — Pre-test: guia, Zoom, Google Forms, Clarity i detall paso a paso

Continuació de [2026-09-15](2026-09-15-test-usuari-v3-embut-continuacio.md). Cap canvi de codi.

- Kit a `~/Downloads/Test de usuario Nuzic/v3.2/` (complet: els documents sense canvis es
  copien de v3.1, inclòs el 01 editat a mà). Nous: `00_Guia rapida del pre-test.docx`
  (una persona, sessions 1 i 2 seguides, 135 min; Zoom; formularis; Clarity amb exercicis
  de familiarització), `03` i `04` v3.2 (Zoom + detall de cada paso 1-11 amb el text de les
  targetes, full paso a paso per a l'observador), `08_Crear formularios Google.gs`.
- `08_Crear formularios Google.gs` (Google Apps Script, l'executa l'usuari: script.new →
  crearTodo → permisos): 6 formularis (F0; S1 inicio = F1 + test previ; S1 cierre = F2a;
  S2 final = test A + F2; Diario; Cierre continuación = test B + F4) amb salts per perfil,
  un full «Test de usuario Nuzic · Respuestas» amb una pestanya per formulari i una
  pestanya «Enlaces» amb els enllaços del Sistema i dels formularis preomplerts (codi i
  perfil) per a PP-01 i els 12 codis. Provat amb una simulació estricta de
  FormApp/SpreadsheetApp/DriveApp; no executat contra Google (cal l'autorització de l'usuari).
- Clarity: segments nous «Pre-test · PP-01» i «Prueba técnica · PRUEBA» (URL conté
  tester=…). Comprovat que els esdeveniments nous ja arriben (app_play/edit/random,
  primer_scroll, capitulo_completado, paso_N_largo, indice_abierto) i les etiquetes
  entrada/modo/paso/section/t_primer_scroll. Hi ha un esdeveniment `paso_0` d'origen no
  identificat (slides.js no fixa mai 0; possiblement proves en local).

## Pendent
- Origen de `paso_0` a Clarity (baixa prioritat).

## Tarda · sessions només per Zoom (v4)

- Formularis creats per l'usuari amb l'script: carpeta «Test de usuario Nuzic · Formularios»
  (dins de «TEST Usuarios SI», Drive 1a2VNVtZOPO01v4a2WrWCjC7vxijKf28j). Verificat amb el
  connector de Drive: 6 formularis + full, i la pestanya «Enlaces» amb les 13 files preomplertes.
- Decisió: totes les sessions a distància per Zoom; sense targetes físiques. Kit a
  `~/Downloads/Test de usuario Nuzic/v4 (Zoom)/`: `03` guió del moderador v4 (24 moments
  S1-1…S2-13 amb text literal DI/TAREA/CHAT/SI, salts assistits per enllaç `&paso=N` —mai
  per l'índex, per no contaminar T5—, prova tècnica amb la persona, «si algo falla»,
  annexos: resum d'una pàgina, correus, pre-test), `04` guió de l'observador v4 (mateixos
  moments, avisos per xat privat, fulls imprimibles per sessió), `07` consentiment per
  correu, `00` guia del pre-test adaptada. 02 (targetes, tests en paper) i 06 (qüestionaris
  en paper) queden obsolets.
- Paso 12: títol dels tips ja corregit per l'usuari («Prueba el compás», commit 83dc494e).

## Vespre · guions per passos i guió del pre-test (v5)

- Revisada la versió local del SI encara no pujada (commits 538d3128…83dc494e): passos d'app
  amb el text a l'esquerra i l'app a la dreta (3 i 8: títol i text a dalt, app a sota, tips a
  la dreta), indicador «Haz scroll» als passos de lectura 1, 2 i 7, paso 11 sense imatge,
  paso 1 amb 13 frases i dibuixos a les 7-12. Descripcions de pantalla actualitzades.
- Pas 2: amb el cursor sobre el pla (App11A) la roda és de l'app (ranura a z-index 3 sobre el
  driver), no passa al paso 3; se'n surt amb el cursor fora del pla, la barra ‹ › o les fletxes.
- Kit a `~/Downloads/Test de usuario Nuzic/v5 (Zoom)/`: `03` guió del moderador v5 ordenat
  per passos (mateixos codis S1-1…S2-13; taula d'avisos de l'observador; el salt assistit
  SA 6 i T3 ordenats dins del paso 6), `04` guió de l'observador v5 (columna «Paso» als
  moments), `00_Guion del pre-test PP-01.docx` (document únic: preparació, enllaços reals de
  PP-01, les dues parts per passos amb caixes «Observación», pausa, cronòmetre a zero a la
  part 2, entrevista de protocol, «Qué mirar del protocolo», Clarity, full d'ajustos). Substitueix
  la guia ràpida i l'annex C del 03. 05, 07 i 08 sense canvis (copiats de v4). El 01 no era a
  la carpeta v4; continua a v3.1/v3.2.
- Els tres guions surten d'un nucli comú (scratchpad `sesiones.js`, `kit()`/`sesion1()`/
  `sesion2()` amb opció `piloto`), perquè el guió real i el del pre-test diguin el mateix.

## 2026-09-28 · mostra de 2 persones per perfil (kit v5.1)

- Decisió: 2 persones per perfil, una per sessió → 8 persones i 16 sessions (sessions 1 una
  setmana, sessions 2 la següent). Kit a `~/Downloads/Test de usuario Nuzic/v5.1 (Zoom, 2 por
  perfil)/`: pla v3.2 (§3.4, equilibri d'edat només majors d'edat, calendari de 7 setmanes),
  moderador v5.1, pre-test 1.1, registre v3.2 (Incidencias amb 8 columnes i fórmules refetes),
  consentiment v4.1 i l'script de formularis amb 8 codis. Edicions fetes sobre l'XML dels .docx
  (els scripts generadors del scratchpad ja no hi eren). La pestanya «Enlaces» del full de Google
  conserva les files P*-03, sense ús.
- Formularis verificats sense compte de Google: s'obren i s'envien anònimament.
