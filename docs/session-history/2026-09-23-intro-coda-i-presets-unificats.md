# 2026-09-23 — Intro breu amb la imatge, coda retocada i presets de parallax unificats

Continuació de [2026-09-21](2026-09-21-imatge-com-a-frase.md).

## 1. Textos (paso 1 i paso 29)

- **Paso 1**: la intro passa a la versió breu del PDF («INTRO GLOBAL MIX»), 7 frases de text
  **més la imatge del recorregut en setena posició**, just entre «Cada sonido es un punto. La
  música es el viaje de un punto a otro.» i «Escucha, observa y prueba». La imatge ocupa el
  lloc del paràgraf que enumerava posiciones‑intervalos‑módulos‑fracciones‑escalas, que és
  exactament el que dibuixa. Negretes: Sistema Nuzic, dónde, cuándo.
- **Paso 29**: «Si te ha gustado **este viaje**…» (abans «esta introducción»).

## 2. Export del panell cuinat

Canvis reals respecte del codi (la resta de l'export ja coincidia): `PRESETS` dels pasos 1, 2,
7, 11, 17, 22 i 29 — bàsicament **scroll-depth apagat a tots els intros** i la capa de
llegibilitat encesa. Densitats i pasos 28.5/28.7, sense canvis. Rangs validats amb el
validador de l'skill.

## 3. Unificació dels intros, i per què no ha quedat compartida

Revisió demanada per l'usuari: els set parallax de producció **no** tenien els mateixos valors
a les tècniques enceses. Cinc divergències (resolent els `{}` als defectes reals de cada
tècnica): mouse-tilt (15/0.15 al paso 1, 15/0.1 al 7, 12/0.1 a la resta), depth-blur corba
(1.5 al paso 7 contra 1.6), text-reveal (2 s/60 ms al paso 1 contra 0.8/30, i apagat al 29),
focus-mode rastre (0.05 als pasos 1 i 29 contra 0.04) i el **paso 2 sense focus-mode ni
bg-dim**, les dues tècniques de llegibilitat que porten tots els altres.

Unificat prenent el **paso 1 com a referència**: scroll-depth off · mouse-tilt 15/0.15 ·
depth-blur 2/1.6 · text-reveal 2/60 · focus-mode 2/0.05 · bg-dim per defecte. Fora de la
unificació, a posta: `app-reveal` (només el paso 2 té app), `mask-zoom` del paso 11, les
entrades apagades amb params afinats i els labs 28.5/28.7 (camp de proves).

Es va provar amb una constant compartida (`RECEPTA_INTRO` + spread), però l'usuari la va
descartar: vol tocar la intro tota sola. Cada paso torna a portar les seves entrades senceres,
en ordre canònic, amb els valors ja unificats. La garantia queda en un **test**: els intros de
capítol i la coda (2, 7, 11, 17, 22, 29) han de tenir els mateixos valors a les sis tècniques
de la recepta; el **paso 1 queda fora de la comparació** per poder divergir.

## 4. Tests que fixaven dades en lloc d'invariants

- `parallax-lab.test.js`: dos tests fixaven valors del preset del paso 22 (`multi-speed` encès,
  factor 2) i es van posar vermells amb l'export. Ara llegeixen el valor del preset i
  comproven l'**invariant** (setConfig no toca la resta d'entrades; getConfig no retorna la
  referència viva), així que no es trenquen a cada cuinada.
- `dom-utils.test.js` (commit a part): el test «should be more efficient than innerHTML» no
  comparava res amb innerHTML — cronometrava (`< 50 ms`) i saltava sol amb la màquina
  carregada. Ara comprova el camí: 500 fills niats, subarbre buit i **un `removeChild` per
  fill**. Verificat que atrapa la regressió que vigila (simulant `innerHTML = ''`: *Expected
  500, received 0*) i que la suite és estable en tres passades seguides.

Suite: **92 suites / 1537 tests**.

## Pendent

- Push.
- `SESSION_STATE.md` no s'ha tocat: una sessió paral·lela hi té la tasca del mapa global.
