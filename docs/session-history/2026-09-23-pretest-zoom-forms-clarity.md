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
- Clarity: confirmar a la propera sessió (millor amb un altre ordinador) que ara hi ha gravació
  (canvi `3c4b6dbd`). Reactivar la «Detección de bots» quan acabi la ronda.
- Consentiment: falten els imports de l'incentiu.

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

## 2026-09-30 · navegació amb el menú i pont a la continuació (kit v5.2)

- Decisions de l'equip després d'un simulacre: cap salt assistit per enllaç (només un, amb la
  barra, al minut 40 de la S1); ajudes de navegació als pasos 1 i 7; l'observador enganxa els
  enllaços al xat; T4b = «primero suba mucho y luego baje poco a poco» (el primer iS surt de la
  nota 0); T5 = tornar al pla musical de Posiciones i regressar al paso 10; T5b fora (H11 només
  orientació); T6 = pont a la continuació amb l'entrega dins la sessió.
- Trobat: `?paso=N` sempre mana sobre el paso desat (slides.js), així que l'enllaç per seguir ha de
  ser el de la sessió 1 sense paso; el de `&paso=11` només s'obre un cop, a l'entrega.
- Kit a `~/Downloads/Test de usuario Nuzic/v5.2 (Zoom, navegación y puente)/`: pla v3.3, moderador
  v5.2, observador v5.2 (enllaços que pega i annex d'enllaços dels pasos), pre-test 1.2, registre
  v3.3, script de formularis (sense la fila Módulos del S2). Generadors reconstruïts des del
  transcript (l'scratchpad s'havia buidat).
- Botó «Diario» al SI (aprovat): `sistema/js/diario.js` + `#btn-diario` a index.html + estils a
  nav.css. Només amb codi de tester i des del paso 11 (DEV: a tots els pasos); a sobre de
  «Privacidad», píndola verda amb llapis i dos polsos en aparèixer (sense animació amb
  reduced-motion); a ≤900px, en línia a l'esquerra de «Privacidad». Obre el Diari amb el codi i
  el paso preomplerts. `?tester=off` (analytics.js) oblida el codi i treu el paràmetre de l'URL.
  Tests: diario.test.js (9) + 2 casos a analytics.test.js; suite 95/1580. Verificat al navegador
  (Live Server :5500) a 1440×900 i 820×900: no tapa les apps.
- Registre v3.4: fulla «Enlaces» amb selector de codi (B3) i tots els enllaços de la persona en
  l'ordre de la sessió (formularis amb codi i perfil preomplerts) + els 29 pasos. Substitueix la
  pestanya «Pasos» que es volia al full de Google.
- Formulari S2: en lloc d'editar-lo, l'script de formularis (v3.3) té `recrearS2()`: desvincula i envia a
  la paperera l'antic, en crea un de nou sense la fila de Módulos i actualitza la pestanya «Enlaces».
  Executat per l'usuari el 2026-10-01: S2 nou 1FAIpQLSccj2fMdp9Hsa5ilmGyBeRg36xIu04NWz3ypT5iEQ7v-lPadw
  (codi entry.1449376972, perfil entry.1760292967; l'antic queda «closedform» a la paperera). Nou
  enllaç posat a la fulla «Enlaces» del registre v3.4 i al guió del pre-test; prellenat verificat.

## 2026-10-01 · minuts per paso (kit v5.3)

- Base: les versions retocades a mà per l'usuari (`~/Downloads/v5.2 (Zoom, navegación y puente)/`).
  Kit a `~/Downloads/Test de usuario Nuzic/v5.3 (Zoom, minutos por paso)/`: moderador i observador v5.3
  i pre-test 1.3 amb els minuts previstos a cada títol de paso (S1: 1 12-17, 2 17-22, 3 22-27,
  4 27-32, 5 32-40, 6 40-45; S2: 7 8-12, 8 12-20, 9 20-30, 10 30-48, 11 43-48 només a l'entrega),
  la columna Min de l'annex A omplerta i els fulls «paso a paso» de l'observador amb els minuts.
  Fora els recuadres «Qué verás» (moderador i pre-test; l'observador conserva la fila «En pantalla»).
  Els textos de tasca retocats per l'usuari al pre-test (T0, T1, T4a, T4c, T5, frase del salt i
  «te lo mando luego») passats al moderador i a l'observador. Edicions fetes sobre l'XML dels .docx
  de l'usuari; 01, 05 i 07 copiats sense canvis.

## 2026-10-01 (vespre) · revisió de l'equip (kit v5.4)

- Fora el guió propi del pre-test: el PP-01 es fa amb el guió del moderador (el de la v5.3 enviat a
  la paperera; queden còpies a les carpetes antigues). Base: el moderador retocat a la reunió
  (T3 sense «corta», retenció de la S2 amb P(4) N(10), pregunta P2-P3, frase del salt al paso 4).
- Continuació en frío de dues setmanes (moderador, pla, consentiment); recordatori als 7 dies;
  calendari del pla de 7 a 6 setmanes.
- Observador v5.4 reescrit: part de consulta + una hoja de observación per sessió en l'ordre de la
  sessió (avisos, enllaços a enganxar, camps de cada tasca i espai d'anotació al costat de cada
  «Qué anotar»); fora la fila «En pantalla» i els fulls separats. Clau amb P(4) N(10).
- Kit a `~/Downloads/Test de usuario Nuzic/v5.4 (Zoom, hojas de observación)/`.
- Correcció: Google Docs fusionava les taules de camps amb la de «Qué anotar» (11 parelles de taules
  sense paràgraf entremig); ara porten un paràgraf de separació i les caselles buides són més altes.

## Pre-test PP-01 (2026-10-02)

- Les dues sessions es van fer seguides (10 min de pausa) en ~1 h 20: **decisió de l'equip, una sola
  sessió**. Cal retocar tota la documentació (pendent).
- Buidatge: transcripció local amb mlx-whisper (large-v3-turbo, ~3 min per 65 min d'àudio) +
  fotogrames del vídeo cada 30 s per a la cronologia. Whisper s'inventa text als silencis
  («La Iglesia de Jesucristo…», «Gracias por ver el video»): netejats com a «[…]».
- Registre v3.4 omplert amb perfil «PP» (Resumen no el compta). Transcripció a
  `~/Downloads/Test de usuario Nuzic/Sesiones/PP-01/`.
- Errors de protocol: el moderador es salta el paso 6 a la S1; no es passa el formulari «S2 Al
  terminar» (l'observador el creia del final del fred) ni l'enllaç «seguir»; el moderador indica
  el paso següent («Paso 9», «Paso 10») i fa una ajuda a T5.

## Kit v6 · sessió única (2026-10-02)

- Carpeta `~/Downloads/Test de usuario Nuzic/v6 (Zoom, sesión única)/`: pla v4.0, moderador v6.0,
  observador v6.0, registre v4.0, consentiment v5.0, script de formularis v4.0.
- Sessió de 90 min: part 1 (pasos 1-6, T0-T3, transferència, min 0-40), pausa (40-45), part 2
  (pasos 7-10, T4a-T5, puente, 45-75), formulari final (75-85). Avisos: SA 6 al min 32, «Min 37»
  transferència, «Min 68» T5. El formulari «Antes de empezar» passa a la prova tècnica (15 min, el dia
  abans) per cabre en 90 min. Sense retenció; la transferència (0-4) té columna pròpia al registre.
- Formularis: «S1 Cierre» s'integra al final («Al terminar la sesión», secció «Sobre la sesión» amb
  facilitat 1-7 i graella «¿Dirías que has entendido…?»). Funció `actualizarV6()` per actualitzar els
  formularis existents sense canviar enllaços (provada amb un mock de FormApp/Drive/Sheets).
- L'entrevista breu passa a la trucada final de la continuació.
- Moderador i pla editats in situ sobre els .docx (helper `dx.py` amb lxml: conserva estils i retocs).
- Registre v4.0: Excel el donava per malmès. Dues causes en fer *round-trip* amb openpyxl d'un xlsx desat
  per Excel: (1) Excel agrupa amplades de columnes contigües (`<col min=5 max=6>`); tocar-ne una de dins
  deixa definicions superposades → cal desfer els grups abans (sense perdre `hidden`); (2) openpyxl
  escriu `cp:lastModifiedBy xml:space="preserve"` si el nom acaba en espai («Albert ») i Excel ho
  tracta com a error de paquet («reparación en nivel de archivo», contingut idèntic) → posar
  `wb.properties.lastModifiedBy = None`. Validació útil: xmllint amb els XSD de `python-docx/ref/xsd`.

## Clarity del PP-01 i analítica abans del consentiment (2026-10-05)

- La sessió del PP-01 (2/10) no sortia a Clarity: la va classificar com a **bot** i l'exclou (segment
  «Pre-test · PP-01»: 0 sessions, «1 sesiones de bot excluidas»). Desactivada la «Detección de bots»
  (Configuración → Configuración avanzada) durant la ronda; reactivar-la en acabar. Amb la detecció
  desactivada apareixen les dades agregades (esdeveniments, pàgines, temps), però no la gravació ni els
  mapes de calor. Passades al registre v4.0.
- `actualizarV6` (Apps Script) s'aturava: `form.moveItem(item, i)` no accepta l'ítem tipat que torna
  `addPageBreakItem()`. v4.1 mou per índex (`moveItem(from, to)`) i recol·loca l'estat a mitges.
- Error d'analítica: abans d'acceptar l'avís `window.clarity` no existeix i `analytics.js` perdia
  `paso_1`, `identify`/`tester`/`upgrade` i `primer_scroll` de tots els testers. Ara les crides es guarden
  en memòria (màx. 300) i s'envien en ordre quan `consent.js` dispara `sistema:consent` (en acceptar o
  en tornar amb consentiment); si no s'accepta, no surt res. Verificat a la pàgina real amb una Clarity
  simulada (sense enviar res).
- Correu a la Marta (PP-01, enviat per l'Albert): primer el formulari final (preomplert amb PP-01 i
  P2), després l'enllaç per seguir (`?tester=PP-01`, sense paso), el diari i la trucada final del 16/10.
- Registre v4.0: el perfil del PP-01 passa de «PP» a «P2 (pre-test)» (Participantes, Observación,
  Cuestionarios). El Resumen compta perfils exactes («P2»), així que el pre-test continua fora.

## Primera sessió de la mostra · P1-01 (2026-10-05)

- Sessió única amb el guió v6.0 (66 min). Buidatge: transcripció local amb Whisper i cronologia de pasos
  llegint la barra d'adreces del vídeo cada 5 s (`?paso=N`, amb el rellotge de la pantalla compartida).
  Hoja de l'observador completada en blau sobre la del Drive, sense tocar el que hi havia escrit; registre
  v4.0 (Participantes, Observación, Cuestionarios, 12 incidències noves) i transcripció a
  `Sesiones/P1-01/`.
- Resultats: Posiciones bé (T1-T3, 2/3 sense ajuda); Intervalos amb ajuda a T4a-T4c; T5 fallida;
  transferència 2/4, test A 3/12, SUS 55. «Fàcil, però no he après res».
- Va fer servir el navegador del PP-01: l'enllaç sense paso va obrir el paso 11 (T0 allà) i l'avís de
  Clarity no va sortir. → El progrés es desa per codi de tester (`91677058`, `tester.js`): un codi nou
  comença pel paso 1 i el progrés antic només l'hereta el codi que hi havia desat.
- Passar del paso 7 al 8 amb l'scroll és el comportament previst (no és incidència); el moderador li va
  demanar tornar enrere. Al paso 2 una altra sessió ja havia tret la sortida per scroll (`b8a8457a`).
- Compartir la pantalla completa va deixar veure altres finestres amb dades privades a la gravació: des
  de la v6.1 es comparteix només la finestra del navegador.

## Kit v6.1 (2026-10-05)

- Observador: a cada paso, files «Frases literales» i «Incidencias y fuera del guion» (codi FG); la taula
  final queda per al debrief; resultats i codis per marcar (text guia en gris); sense els t_…; pasos 1 i 7
  sense les columnes de tips i app; T6 en vermell (1r paso 11, 2n «Sistema · sesión»); text neutre.
- Moderador: T4b al paso 9 i T4c al 10 (el pas 8→9 i 9→10 s'observa sense tasca); compartir la finestra
  del navegador; T1 sense «sola»; no explicar abans de les consignes ni ajudar a T5; ajuda de nivell 3 =
  EA3. Alerta: alguns paràgrafs del .docx tenen el text dins de controls de contingut (`w:sdt`), que
  python-docx no veu a `p.text` (l'«Éxito» de T4b semblava buit).
- Fitxer de participants a part del registre (noms i contactes, fora del repo):
  `~/Downloads/Test de usuario Nuzic/00_Participantes y reclutamiento.xlsx`.
- Resum per a l'equip en PowerPoint: `~/Downloads/Test de usuario Nuzic/Resumen primeras sesiones del test.pptx`.

## Clarity: sessions sense gravació (2026-10-05)

- El P1-01 surt a Clarity (dades agregades; ja arriben `paso_1` i `primer_scroll`, la correcció de
  l'analítica funciona) però, com el PP-01, sense gravació. Només s'ha gravat una visita de 4 s sense
  canvis de paso.
- Causa probable: en acabar cada paso de lectura, el driver del parallax feia `btnNext.click()`, un clic
  sintètic (`isTrusted=false`) que Clarity registra; un per paso fa semblar automatitzada una sessió
  llarga. → `parallax-lab.js` dispara `sistema:nav` i `slides.js` crida `go()` (`3c4b6dbd`). Altres
  factors possibles: sessions llargues i ~35 «pàgines» per sessió (cada `?paso=` és una pàgina nova).
- Safari: Clarity hi funciona, però l'ITP esborra el `localStorage` després de 7 dies sense entrar a la
  web; el codi de tester es recupera de l'enllaç, el progrés no.

## Kit v6.2 (2026-10-07)

- Benvinguda i T1: es demana llegir els textos en veu alta (amb llibertat de rellegir o saltar frases).
  Observador: «Lee en voz alta» al moment 1 i «¿Relee frases o se salta alguna?» als pasos 1, 2 i 7.
- Tasques complementàries (sufix ·2), just després de la primera i amb el seu SEQ: T2·2 al paso 3 (fer-ho
  anar més ràpid), T3·2 (melodia amb un silenci), T4a·2 («corto, medio, largo»), T4b·2 (començar greu,
  pujar de cop i baixar a poc a poc), T4c·2 (canviar només les durades). Si es va tard, es treuen primer,
  excepte T4a·2.
- Minuts: pasos 1, 4 i 7 més curts (les sessions reals van durar 65-66 min); SA 6 al minut 30, «Min 36»
  transferència, «Min 70» T5, formulari 77-87.
- Registre v4.0: el Resumen deixa les ·2 fora de les mètriques actuals (comparables amb PP-01 i P1-01) i
  les compta en dues files noves; esborrades les files d'exemple EJ-00 (es buiden i es mantenen les
  fórmules: esborrar files amb openpyxl desquadra les fórmules de sota).
