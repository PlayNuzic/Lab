# 2026-09-30 — Retocs a les apps del SI

Tanda de retocs a les apps incrustades al Sistema Interactivo (`sistema/`).

## 1. App9 (paso 3): la pastilla de BPM

**Petició:** afegir la pastilla de BPM a App9.

**Diagnosi:** la pastilla ja era al marcatge (`index.html` la injecta a `.inputs`),
però no es veia. El tema nuzic amaga `.inputs` quan només conté el BPM
(`.inputs:has(.bpm-inline):not(:has(.param))`, regla portada d'App13 al tema el
2026-04-11), perquè dona per fet que l'app l'ha traslladat a `.controls`. App13,
App15, App26… ho fan amb el helper compartit `reorderControls()` (H-08); App9 no
l'havia cridat mai. `docs/APPS-ADAPTACIONS-IFRAME.md` la donava per bona.

**Canvi (només App9):**

- `main.js`: `reorderControls()` + `document.querySelector('.inputs')?.remove()`
  abans de crear el `bpmController`. La `.inputs` buida es treu (com `.middle` a
  `index.html`) perquè el seu padding deixaria un forat d'uns 80px sobre la línia.
  L'ordre visual 🔊 ▶ BPM el fixa el tema (`order`); el volum el torna a posar a
  `.controls` el MutationObserver de `relocateSoundWrapperForNuzic`.
- `styles.css`: fora les regles de `.inputs`, que ja no s'usaven.
- `README.md` reescrit a partir del codi: el vell descrivia una versió antiga
  (sorolls amb `click11`, BPM aleatori de 75 a 200, 9 pulsos sonors).
- `docs/APPS-ADAPTACIONS-IFRAME.md`: entrada d'App9 amb el paso actual (3) i el
  mecanisme.

**Verificació:** CDP amb perfil aïllat i servidor propi (:8080, `-c-1`), amb
`sistema.consent` a `localStorage` perquè el banner no tapi l'app. La pastilla és
dins `.controls` i cap sencera a l'iframe del paso 3 a 1400×900, 1280×720,
1024×768 i 390×844 (a mòbil acaba als 280px dels 342 d'ample). Suite: 94 suites,
1569 tests.

## 2. App11A (paso 2): tempo aleatori entre 80 i 150

App11A no té control de BPM: cada Play en sorteja un (enter, uniforme). El marge
passa de 50-150 a **80-150** (`MIN_BPM` a `main.js`). `FIXED_BPM = 120` només és el
valor inicial (durada del clic a una cel·la abans del primer Play); se n'ha
corregit el comentari, que deia «not randomized».

## 3. App11 (paso 5): botó de reset

El reset era al template però amagat per CSS (`.controls .reset` a `styles.css`).
Ara es veu (fila 🔊 ▶ 🗑, l'ordre el fixa el tema) i `handleReset()` atura la
reproducció, deixa el plànol net (cel·les actives i etiquetes P-N) i torna el
tempo inicial (`FIXED_BPM`). Així, després del reset, Play torna a generar una
seqüència aleatòria (amb cel·les marcades, Play reprodueix la selecció). La
neteja de cel·les, que estava duplicada a `handlePlay` i `stopPlayback`, passa a
un helper `clearCells()`; `musicalGrid.clear()` no servia perquè no treu les
etiquetes, que són pròpies d'App11.

Verificat amb CDP: reset amb 3 cel·les marcades → 0 i cap etiqueta; reset a mig
play → aturat, icona de play restaurada, sense playhead. Botó sencer dins
l'iframe del paso 5 a 1400×900, 1024×768 i 390×844; cap error de pàgina.

Tips del paso 5 (`slide-data.js`), segona frase: «Pulsa ▶️ para escuchar las notas
que has marcado o, si no hay ninguna, de 4 a 8 notas aleatorias en 8 pulsos. Pulsa
🗑 para borrar el plano.»

## 4. Tooltips en català → castellà (App9-35)

Escombrat de tots els textos visibles (literals amb trets de català + inventari de
tot el que passa per `showTooltip`, `showValidationWarning`, `message:`, `title`,
`aria-label` i `placeholder`, a les apps i a les libs). Set textos en català, tots
en tooltips o avisos d'editor:

| App | Abans | Ara |
|-----|-------|-----|
| App14 | iS fora de rang [a, b] | iS fuera de rango [a, b] |
| App14, App15 | Valor invalida seqüència | El valor invalida la secuencia |
| App14 | Ajustat iS₍n₎: ±d | Ajustado iS₍n₎: ±d |
| App14 | Seqüència completa | Secuencia completa |
| App20 | Format: NrR (ex: 5r4) o S | Formato: NrR (ej. 5r4) o S |
| App30, App31 | Afegeix iTs per reproduir | Añade iTs para reproducir |

Queden en català, a posta: missatges de `console` (App13, App14), el peu del menú
«Rendimiento audio» (només amb `?dev`), i l'etiqueta `'Pols'` de
`circular-rings.js` (només App4, fora del rang).

## 5. Paso 2: no es pot sortir per scroll (2026-10-05)

**Problema:** al paso 2 (intro parallax de Posiciones, amb App11A via `app-reveal`), un
scroll amb molta inèrcia travessava la cel·la d'app i entrava a la de sortida, que prem
`btn-next`: l'usuari arribava al paso 3 sense haver vist l'app.

**Regla nova (`parallax-lab.js`):** si un parallax acaba en una app, l'app és el final
del recorregut. El driver no afegeix la cel·la de sortida (`ambSortida` = hi ha paso
següent **i** no hi ha app) i `step()` (↓, cremallera del ratolí) no escapa endavant.
Endavant només amb la nav (fletxa o menú) o →, que ja crida `go(+1)`. Enrere, igual que
sempre. Avui només afecta el paso 2, l'únic amb `app-reveal` actiu; els pasos 7, 17 i 22
declaren app però no la mostren dins el parallax i surten com sempre.

**Tests:** dos tests del driver actualitzats (ja no hi ha sortida després de l'app) i un
de nou (ni l'scroll ni `step(+1)` passen al paso següent; enrere funciona). Suite: 1585.

**Verificació (CDP, `requestAnimationFrame` substituït per `setTimeout`):** paso 2 = 9
frases + app, sense sortida; scroll fins al final i ↓ → continua al paso 2. Control: el
mateix scroll al paso 1 sí que passa al 2. Paso 2 + fletxa de la nav → paso 3.

**Documentació:**

- `docs/parallax-lab-manual.md`: l'apartat «Navegació» de §1 descrivia encara el model
  antic (lerp, inèrcia que es perd frase a frase, sobre-empenta), substituït pel driver
  natiu amb snap el 2026-09-01. Reescrit amb el comportament real (cel·les, sortida i
  la seva excepció, notches, fletxes, bloqueig d'entrada). A `app-reveal`, una línia
  que hi remet.
- Guia «Cómo navegar» (`sistema/index.html`), pasos de lectura: «…sigue bajando y entra
  el paso siguiente; si acaba en una app, pulsa ›.» Triada entre variants mesurades
  perquè el text no passi de 5 línies: una versió més llarga afegia una línia i amagava
  el títol plegat «Colores y cajas» a 1400×900.
- Capçalera de `parallax-lab.js`: cel·la d'app **o** de sortida.

## 6. Notes que sonaven al pols 0 sense ser enlloc (2026-10-05)

**Observat al test d'usuari** (App12 i App15): en fer Play, al pols 0 sonaven la nota de
l'usuari i una altra que no es veia enlloc. A l'Albert no li passava.

**Causa:** les previsualitzacions (clic a una cel·la, nota confirmada a l'editor) fan
`playNote(midi, dur, Tone.now())`. Si l'AudioContext és en pausa el rellotge està aturat:
la nota no sona, queda a la cua i sona quan el Play reprèn el context —al pols 0—,
també si l'usuari ja l'havia tret. El context queda en pausa típicament a Safari: el
primer clic carrega Tone.js (await) abans de `Tone.start()` i, fora del gest, Safari no
el deixa engegar. Al Chrome de l'Albert el context arrenca actiu (Media Engagement).
Reproduït amb CDP (context suspès a mà + clics reals): App12, cel·la 9 posada i treta +
nota 2 al pols 0 → al pols 0 sonaven 2, 9, 9 i 2; App15, 9 al pols 0, 🗑, 2 al pols 0 →
2, 9 i 2. Afecta les 13 apps amb previsualitzacions (App11, 11A, 12, 14, 15, 19-25B).

**Arranjament (`libs/sound/melodic-audio.js`, `_canSoundNow`):** una nota que no pot
sonar ara no es guarda per després. `playNote`/`playChord` intenten reprendre el
context: si torna en ≤150 ms (el gest encara val), la nota sona ara; si no, es descarta.
Les notes del scheduler (`_playScheduledNote`) es descarten sense reintent. Test nou:
`libs/sound/__tests__/melodic-audio.test.js` (6). Verificat amb CDP: Chrome (el clic
reprèn el context, cada nota sona en el seu clic i el pols 0 només toca la de l'usuari) i
simulació de Safari (resume que no respon: els clics no queden a la cua). Documentat a
`libs/sound/CLAUDE.md`.

**Safari real (prova A/B de l'Albert, finestres privades):** GitHub Pages (codi antic) →
al pols 0 sona la nota de més; Live Server (codi nou) → no. Causa confirmada i arranjament
validat. `safaridriver` no es va poder habilitar (l'usuari de treball no és administrador;
`--enable` ho exigeix i, fet des d'un altre compte, configuraria aquell compte). El punt 2
(engegar l'àudio dins del primer clic a Safari) es descarta: no cal.

**Treure una nota ja no la fa sonar:** App12, App25 i App25B tocaven la nota també quan el
clic la treia (App11, 19 i 20 ja no ho feien). Ara primer es mira si el clic la treu i
només sona si en posa una; els parells es tornen a llegir després de l'`await` de l'àudio.
Revisades: App11A (només previsualitza), App15 (el clic no treu notes), App21-24 (no
n'hi ha), App32-35 (s'esborra clicant la barra, sense so). Verificat amb CDP a les tres:
posar → sona; treure → silenci.

Nota per a verificacions futures: `chrome --headless=new --screenshot` desa la
captura però el procés no acaba sol; cal matar-lo pel seu `--user-data-dir`.
