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

Nota per a verificacions futures: `chrome --headless=new --screenshot` desa la
captura però el procés no acaba sol; cal matar-lo pel seu `--user-data-dir`.
