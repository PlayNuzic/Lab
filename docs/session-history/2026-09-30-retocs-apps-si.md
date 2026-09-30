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

Nota per a verificacions futures: `chrome --headless=new --screenshot` desa la
captura però el procés no acaba sol; cal matar-lo pel seu `--user-data-dir`.
