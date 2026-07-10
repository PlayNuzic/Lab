# Manual del Parallax Lab

Guia d'ús de les 15 tècniques de parallax del laboratori ocult del `sistema/`,
amb els paràmetres reals de cada una i aplicacions suggerides per a les slides Nuzic.
Referents visuals del catàleg: la web de **GTA VI** (màscara-finestra, moments narratius)
i **delassus.com** (capes a velocitats diferents, inèrcia elàstica, deriva ambient).

---

## 1. Obrir el laboratori

```
npx http-server
http://localhost:8080/sistema/index.html?tweaks=1&paso=28.5   ← Lab A (símbols)
http://localhost:8080/sistema/index.html?tweaks=1&paso=28.7   ← Lab B (imatge + App11)
```

- El paràmetre `?paso=28.5` **desbloqueja sol** les slides ocultes del lab. Alternativa
  manual: 5 clics al badge de número d'un pas d'Escalas.
- **Lab A (28.5)**: fons de símbols Nuzic — ideal per a tècniques de capes i moviment.
- **Lab B (28.7)**: imatge de fons + ranura d'app (App11) — necessari per a les tècniques
  que treballen amb imatge (`Máscara zoom`, protagonisme de `Zoom deriva`) o amb app
  (`Aparición de app`).
- **Els passos intro reals (1, 7, 11, 17, 22) també tenen el constructor actiu**: obre
  qualsevol amb `?tweaks=1&paso=1` (o 7, 11, 17, 22) i ajusta'l en viu. Per defecte porten
  només `Profundidad de scroll` amb els valors clàssics — es veuen **exactament com
  sempre** fins que hi actives alguna cosa. Com que són slides de símbols (sense imatge ni
  app), `Máscara zoom` en mode imatge/app i `Aparición de app` no hi fan res; la resta de
  tècniques, totes.

### Navegació: scroll lliure

A tots els slides del constructor el scroll és **continu i reversible**: la roda o el dit
mouen el progrés proporcionalment, endavant i endarrere — l'usuari condueix i el motor
només suavitza (lerp). En parar el gest ~mig segon, el text s'assenta amb un **snap suau**
a la frase més propera. A l'última frase cal una **sobre-empenta** acumulada per saltar
al pas següent; **enrere no s'escapa mai per gest** (a la primera frase el scroll s'atura:
per tornar al pas anterior, fletxa ↑ o botó de navegació). Les fletxes ↑↓ mantenen el pas
discret de sempre, i amb `prefers-reduced-motion` el moviment és sec (sense lliscament).

## 2. El panell

A la secció **Parallax Lab** del panell de tweaks (la llista scrolleja; capçalera i botons
queden fixos):

| Control | Què fa |
|---|---|
| Checkbox de tècnica | Activa/desactiva la tècnica **en viu**, sense recarregar res |
| Sliders | Canvien els paràmetres en viu; només es re-aplica la tècnica tocada (l'iframe de l'app mai es recarrega) |
| 🎲 Aleatorio | Tria **2–4 tècniques a l'atzar** amb valors a l'atzar dins dels rangs (arrodonits al pas del slider) |
| Restaurar | Torna a la config per defecte del paso (només `Profundidad de scroll` activa) |
| Copiar config | Copia la config actual del paso com a **JSON** al porta-retalls |

La configuració es guarda **per paso** a `localStorage` (`sistema.parallaxFx`): sobreviu
recàrregues però és local del navegador. El JSON també surt a l'**export del panell de
tweaks** (camp `parallaxFx`), per endur-se receptes d'un ordinador a un altre.

## 3. Com es combinen (el concepte clau)

Cada tècnica escriu només els **seus canals** de moviment i un compositor únic els suma
(desplaçaments i rotacions) o els multiplica (escales). Conseqüència pràctica: **totes les
tècniques són apilables** — activar-ne una mai "trepitja" el moviment d'una altra, i l'ordre
d'activació no importa (l'ordre de pintat dels vels/overlays és fix i determinista).

Dos comportaments globals:

- **`prefers-reduced-motion`**: les tècniques de moviment no s'apliquen (els checkboxes
  queden deshabilitats); només entren les estàtiques (`Desenfoque`, `Viraje de color`) i
  `Aparición de app` sense animació.
- **Mode edició** del sistema: kill-switch — tot el parallax del lab es pausa mentre edites.

---

## 4. Les 15 tècniques

### A. Conduïdes per l'scroll (avancen amb les frases)

#### Profundidad de scroll — `scroll-depth`
El moviment base del sistema: les capes es desplacen, roten i escalen segons el progrés de
les frases, cada capa segons la seva profunditat. És el mateix moviment de les slides
parallax reals, ara amb sliders.

| Paràmetre | Rang | Defecte | Què controla |
|---|---|---|---|
| Amplitud horizontal | 0–120 vw | 60 | Recorregut lateral de les capes |
| Amplitud vertical | 0–180 vh | 90 | Recorregut vertical |
| Rotación máx. | 0–60° | 24 | Gir màxim per profunditat |
| Zoom por profundidad | 0–2 | 0.8 | Creixement de les capes en avançar |

**Aplicacions:** és la base de gairebé tot — deixa-la activa i ajusta les altres a sobre.
Amb els defectes reprodueix exactament les slides reals; amplituds baixes (20–30) donen un
parallax subtil per a slides amb molt de text; amplituds altes + zoom alt, una obertura
espectacular de capítol.

#### Multi-velocidad — `multi-speed`
Multiplica la velocitat de cada capa segons la seva profunditat. Amb dispersió 0 totes van
al mateix ritme; en pujar-la, les capes properes i llunyanes divergeixen — l'efecte "capes
que se separen" de delassus.

| Paràmetre | Rang | Defecte | Què controla |
|---|---|---|---|
| Factor de velocidad | 0–3 | 1 | Multiplicador global del desplaçament |
| Dispersión por profundidad | 0–2 | 0 | Quant divergeixen les capes entre elles |

**Només es nota amb `Profundidad de scroll` activa** (multiplica el seu desplaçament).
**Aplicacions:** donar sensació de profunditat real a slides amb molts símbols (Lab A);
factor < 1 per calmar un scroll-depth exagerat sense tocar-ne els paràmetres; dispersió
1.5–2 per a l'efecte "túnel" en obertures.

#### Rotación por progreso — `rotate-progress`
Les capes giren una mica més a mesura que avancen les frases, sumant-se a la rotació base.
Amb direcció alternada, capes parelles i senars giren en sentits oposats.

| Paràmetre | Rang | Defecte | Què controla |
|---|---|---|---|
| Grados de giro | 0–90° | 30 | Gir total acumulat al final |
| Alternar dirección | 0–1 | 1 | 1 = sentits oposats per capa |

**Aplicacions:** energia cinètica a slides de símbols — els glyphs Nuzic girant en
contrarotació fan un fons viu sense distreure; graus baixos (10–15) com a "respiració"
subtil; combina molt bé amb `Multi-velocidad`.

#### Zoom deriva (Ken Burns) — `zoom-drift`
Cada capa s'escala progressivament des d'un origen propi, com el clàssic efecte Ken Burns
documental. Si hi ha imatge de fons, ella és la protagonista.

| Paràmetre | Rang | Defecte | Què controla |
|---|---|---|---|
| Intensidad | 0–1.5 | 0.35 | Quant creix el zoom durant el recorregut |

**Aplicacions:** slides amb fotografia (Lab B) — la imatge respira mentre es llegeix;
intensitat baixa (0.15–0.25) per a elegància documental; alta (0.8+) per a dramatisme.
Amb `Máscara zoom` fa que la finestra-glyph i la imatge creixin alhora.

#### Viraje de color — `color-shift` *(estàtica — funciona amb reduced-motion)*
El matís, la saturació i el brillo del fons canvien segons el progrés, en salts discrets
per frase (mai transiciona el filtre — regla LP-07 del repo).

| Paràmetre | Rang | Defecte | Què controla |
|---|---|---|---|
| Giro de matiz | 0–180° | 40 | Quant vira el color al llarg del recorregut |
| Saturación | 0.2–2 | 1.2 | Saturació final |
| Brillo | 0.5–1.5 | 1 | Brillantor final |

**Aplicacions:** feedback de progrés — el color diu "ets al principi/final" sense mirar
res més; identitat per secció (un matís per capítol); giros grans (120°+) per a
transicions de món, petits (20–30°) com a temperatura emocional.

#### Gradiente viajero — `gradient-drift`
El resplendor radial del fons es desplaça pel slide a mesura que avancen les frases —
una llum que acompanya la narració.

| Paràmetre | Rang | Defecte | Què controla |
|---|---|---|---|
| Recorrido | 0–100% | 70 | Distància que viatja el focus de llum |
| Intensidad | 0–1 | 0.5 | Opacitat del resplendor |

**Aplicacions:** guiar la mirada amb subtilesa; sensació d'"alba → migdia" mentre
s'avança; amb intensitat baixa (0.2) és un ambient gairebé subliminal que dona vida a
slides llargues de teoria.

#### Máscara zoom (GTA) — `mask-zoom`
La tècnica estrella de GTA VI: la imatge només es veu **dins d'un símbol gegant** que fa
de finestra; en avançar, la màscara s'engrandeix fins que la imatge omple tot el slide.

| Paràmetre | Rang | Defecte | Què controla |
|---|---|---|---|
| Escala inicial de la máscara | 10–100% | 40 | Mida de la finestra-glyph a l'inici |
| Escala final de la máscara | 150–800% | 400 | Mida al final (el moment "fons ple") |
| Fondo (0 imagen · 1 app) | 0–1 | 0 | Què hi ha darrere la finestra |

**Amb `Fondo` a 0 necessita imatge de fons (Lab B).** Amb **`Fondo` a 1 la finestra
ensenya l'APP en directe**: l'iframe passa a pantalla completa darrere de les frases
(decoratiu — la roda segueix navegant) i el glyph es va obrint fins que l'app omple el
slide; l'iframe es crea una sola vegada i es comparteix amb `Aparición de app` (P-26).
Si el slide no té app, cau amb gràcia al mode imatge. El desenfocament de `Desenfoque
de profundidad` queda exclòs de la imatge emmascarada a propòsit (la protagonista
sempre nítida).
**Aplicacions:** obertures de capítol — el símbol del capítol com a finestra que es fon
en la imatge del tema; amb `Fondo` a 1, presentar una app "a través" del glyph de la
seva funció mentre es veu funcionant en viu (el "moment vídeo" de GTA amb app real);
escala inicial petita (15–20%) per a màxim misteri.

### B. Amb vida pròpia (no depenen de l'scroll)

#### Deriva flotante — `float-drift`
Les capes deriven de manera contínua i suau, com si l'escena respirés, independentment
de l'scroll.

| Paràmetre | Rang | Defecte | Què controla |
|---|---|---|---|
| Amplitud | 0–40 px | 14 | Radi de la deriva |
| Duración | 2–15 s | 7 | Període d'un cicle (més alt = més lent) |

**Aplicacions:** que cap slide sembli "morta" mentre l'alumne llegeix; amb amplitud petita
(6–10) i durada llarga (10+) és una respiració meditativa perfecta per a pasos
contemplatius; de fons sota qualsevol combinació.

#### Marquesina de símbolos — `marquee`
Els símbols del capítol es llisquen sense parar pel fons en una franja contínua, com un
teletip.

| Paràmetre | Rang | Defecte | Què controla |
|---|---|---|---|
| Velocidad | 10–120 s | 40 | Temps d'una volta completa (més alt = més lent) |
| Tamaño | 40–200 px | 90 | Mida dels símbols |
| Opacidad | 0.02–0.3 | 0.08 | Presència de la franja |

**Aplicacions:** identitat de capítol (els seus símbols com a textura de marca); portades
de secció amb opacitat baixa (0.05) com a paper pintat viu; mida gran (150+) + opacitat
molt baixa per a un efecte aquarel·la de fons.

#### Desenfoque de profundidad — `depth-blur` *(estàtica — funciona amb reduced-motion)*
Les capes es desenfoquen segons la profunditat, com l'enfocament selectiu d'una càmera de
cinema. Fix — no varia amb l'scroll.

| Paràmetre | Rang | Defecte | Què controla |
|---|---|---|---|
| Desenfoque máx. | 0–8 px | 3 | Blur de la capa més llunyana |
| Curva de caída | 0.3–3 | 1 | Com de ràpid creix el blur amb la distància |

**Aplicacions:** quan les frases són les protagonistes i el fons ha de fer d'atmosfera;
"profunditat de camp" cinematogràfica a slides d'imatge; amb `Foco` crea la sensació
d'ull que enfoca on mira.

### C. Interactives amb el ratolí (escriptori)

#### Inclinación 3D (ratón) — `mouse-tilt`
El fons s'inclina en 3D seguint el cursor, amb suavitzat i una lleugera paral·laxi per
profunditat; en sortir el punter torna al pla. En tàctil gairebé no actua.

| Paràmetre | Rang | Defecte | Què controla |
|---|---|---|---|
| Intensidad | 0–30° | 12 | Inclinació màxima |
| Suavizado | 0.02–0.3 | 0.1 | Persecució del cursor (baix = més "mantega") |
| Paralaje | 0–40 px | 16 | Desplaçament extra per capa |
| Perspectiva | 400–2000 px | 900 | Profunditat de la càmera (baix = més dramàtic) |

**Aplicacions:** portades i moments "toca'm" — convida a explorar amb el ratolí;
intensitat baixa (5–8) com a vida subtil a qualsevol slide d'escriptori; perspectiva
400–600 per a efecte diorama.

#### Foco (ratón) — `spotlight`
Un vel fosc amb un forat de llum que segueix el cursor, com un focus d'escenari; en
sortir el punter, torna suaument al centre.

| Paràmetre | Rang | Defecte | Què controla |
|---|---|---|---|
| Radio | 10–60 vw | 30 | Mida del cercle de llum |
| Fuerza | 0–0.8 | 0.35 | Foscor del vel |

**Aplicacions:** dirigir l'atenció durant una explicació en directe (el professor
"il·lumina" amb el ratolí); slides de misteri/descobriment; força alta (0.6+) + radi
petit per a drama total. El vel enfosqueix tots els altres efectes de fons — és sempre
la capa de dalt.

### D. Temporització

#### Inercia elástica — `inertia`
Les capes persegueixen el moviment amb retard i rebot elàstic, esglaonats capa a capa.
Pura temporització CSS: no anima res pel seu compte, canvia **com** es mou tot el que ja
es mou.

| Paràmetre | Rang | Defecte | Què controla |
|---|---|---|---|
| Duración | 0.2–2.5 s | 1.1 | Temps de persecució |
| Rebote | 0–2 | 1 | Overshoot elàstic en frenar |
| Escalonado | 0–0.4 s | 0.12 | Retard afegit per capa (efecte cua) |

**Aplicacions:** l'ingredient que fa "físic" qualsevol combo d'scroll (sensació
delassus); esglaonat alt (0.2+) per a l'efecte cua de cometa entre capes; nota que també
amorteix `Inclinación 3D` i `Deriva flotante` — amb durada llarga tot es torna dens i
oníric (pot ser exactament el que vols, o no).

### E. Narratives

#### Título letra a letra — `text-reveal`
El títol del pas apareix lletra a lletra, amb entrada esglaonada d'opacitat i
desplaçament vertical. És l'única tècnica autoritzada a tocar el títol (mai les frases).

| Paràmetre | Rang | Defecte | Què controla |
|---|---|---|---|
| Duración | 0.2–2 s | 0.8 | Entrada de cada lletra |
| Escalonado | 0–80 ms | 30 | Retard entre lletres consecutives |

**Aplicacions:** entrada de títol a qualsevol obertura; esglaonat alt (60–80) per a
efecte màquina d'escriure lent i solemne; amb `Aparición de app`, primer el títol es
construeix i després l'app entra — seqüència de presentació completa.

#### Aparición de app — `app-reveal` *(estàtica — amb reduced-motion apareix sense animació)*
El "moment vídeo" de GTA portat a Nuzic: **l'app entra en escena en arribar a una frase
concreta**. L'iframe es crea una sola vegada i després només es mostra/amaga (mai es
recarrega — regla P-26); si tornes enrere, l'app s'amaga i reapareix al llindar.

| Paràmetre | Rang | Defecte | Què controla |
|---|---|---|---|
| Frase de aparición | 1–8 | 3 | A quina frase entra l'app |
| Escala inicial | 0.6–1 | 0.85 | Des d'on creix en aparèixer |
| Duración | 0.2–1.5 s | 0.6 | Temps de l'entrada |

**Necessita la ranura d'app (Lab B — App11).**
**Aplicacions:** el patró narratiu central del mètode — N frases de teoria i, quan el
concepte ja és a l'aire, l'eina apareix per tocar-lo; frase 1 per a "app primer,
explicació després"; l'última frase com a "recompensa" final del pas.

---

## 5. Receptes recomanades

| Recepta | Tècniques | On | Sensació |
|---|---|---|---|
| **Obertura GTA** | Máscara zoom + Zoom deriva + Viraje de color + Título letra a letra | Lab B | La imatge del tema es revela a través del glyph mentre el color vira |
| **Obertura GTA amb app viva** | Máscara zoom (Fondo=1) + Título letra a letra | Lab B | L'app funcionant es revela a través del glyph fins omplir el slide |
| **Profunditat delassus** | Profundidad de scroll + Multi-velocidad (dispersió 1.5) + Inercia + Deriva flotante | Lab A | Capes que se separen i persegueixen el gest amb elasticitat |
| **Presentació d'app** | Título letra a letra + Aparición de app + Foco | Lab B | Títol → teoria → l'app entra i el focus la il·lumina |
| **Ambient de lectura** | Deriva flotante (suau) + Gradiente viajero + Desenfoque | Lab A o B | Fons viu però discret; les frases manen |
| **Portada de capítol** | Marquesina + Inclinación 3D + Viraje de color | Lab A | Identitat de símbols + convit a explorar amb el ratolí |
| **Diorama interactiu** | Inclinación 3D (perspectiva 500) + Foco + Inercia | Lab A | Escena 3D densa que respon a la mà |

El botó **🎲 Aleatorio** és la manera ràpida de descobrir combos que no se t'haurien
acudit — quan en surti un de bo, **Copiar config** i guarda'l.

## 6. Interaccions conegudes i límits

- **`Multi-velocidad` sola no es veu**: multiplica el desplaçament de `Profundidad de
  scroll`; sense ella activa no hi ha res a multiplicar.
- **`Inercia` amorteix `Inclinación 3D` i `Deriva flotante`** — és el seu propòsit
  (retemporitza tot el moviment); amb durada 2.5 s tot es torna lent i pesat.
- **`Máscara zoom` anul·la el blur sobre la imatge emmascarada** (decisió de composició:
  la protagonista sempre nítida); les altres capes sí que es desenfoquen.
- **`Máscara zoom` amb `Fondo`=app + `Aparición de app` alhora**: composen — l'aparició
  decideix QUAN hi ha app (a partir de la seva frase) i la màscara decideix COM es veu
  (finestra-glyph a pantalla completa). Abans de la frase d'aparició, la finestra queda
  buida; és deliberat, però si vols l'app de fons des del principi, desactiva
  `Aparición de app`.
- **`Foco` sempre pinta a sobre** de `Marquesina` i `Gradiente viajero` — el vel els
  enfosqueix, coherent amb la metàfora de focus d'escenari.
- **Tècniques amb requisits de contingut**: `Máscara zoom` i el protagonisme de `Zoom
  deriva` volen imatge (Lab B); `Aparición de app` vol ranura d'app (Lab B);
  `Marquesina` fa servir els símbols del capítol; `Título letra a letra` vol títol.
  Sense el seu contingut, la tècnica simplement no fa res (no dona error).
- **`Inclinación 3D` i `Foco` són d'escriptori**: en tàctil amb prou feines actuen.
- L'estat es guarda **per paso i per navegador** (localStorage); per compartir una
  recepta, `Copiar config` o l'export del panell de tweaks.

## 7. Del laboratori a producció

Els passos intro reals (1, 7, 11, 17, 22) **ja llegeixen el constructor**: cada un té la
seva configuració per paso, i per defecte és el moviment clàssic (`Profundidad de scroll`
amb els valors de sempre). El camí per endurir una recepta:

1. Prova combos al lab (28.5/28.7) o directament al pas real amb `?tweaks=1&paso=N`.
2. **Copiar config** → JSON amb `{ tècnica: { on, params } }` (o export complet del
   panell, camp `parallaxFx`, que inclou tots els pasos).
3. Tingues present que la config viu a `localStorage` (per navegador): per portar una
   recepta a un altre ordinador o deixar-la fixa per a tothom, el JSON copiat és
   l'especificació exacta — les tècniques són apilables i deterministes, així que el que
   veus amb el panell és el que es veuria desplegat.

*Manual generat el 2026-07-05 · Arquitectura i procés: `docs/session-history/2026-07-04-parallax-lab.md`*
