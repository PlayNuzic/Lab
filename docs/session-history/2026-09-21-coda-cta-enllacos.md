# 2026-09-21 — CODA: les 3 crides a l'acció, amb enllaços

Continuació de [2026-09-07](2026-09-07-paso-13-i-export-tweaks.md).

## 1. Les tres frases (paso 29)

El PDF "NUZIC Textos SI" deixava la CODA amb un encàrrec obert: «Te esperamos en: Cal fer 3 CTA
en 3 frases» (Nodes · App Nuzic Lite i pro · PlayNuzic). Escrites com tres frases del parallax
—una per scroll—, cadascuna amb el verb que li escau (l'usuari va descartar repetir «te
esperamos»):

- «Profundiza en el **sistema de Nodos**: cada dimensión —el tiempo, el sonido y la simbiosis
  entre ambos— desplegada a fondo.» → https://www.nuzic.org/sistema/
- «Compón con la app **Nuzic**: empieza con *Lite* y llega más lejos con *Pro*.»
  → https://www.nuzic.org/App/
- «Y ponlo en práctica con otros en **PlayNuzic**, donde el sistema se aprende creando.»
  → https://playnuzic.com/

## 2. Dues coses que feien que un enllaç dins d'una frase no funcionés

- **El sanejador els esborrava**: `<a>` no era a `ALLOWED_RICH_TAGS`. Afegit, amb `isSafeHref()`
  (http/https/mailto o ruta relativa; fora `javascript:`, `data:` i `//host`) i `target="_blank"
  rel="noopener"` automàtics per als externs; un href no segur desempaqueta l'enllaç i en deixa
  el text. Això importa perquè el text del fitxer no passa pel sanejador, però el que l'usuari
  edita al panell sí: sense el canvi, tocar el paso 29 al panell hauria matat els tres enllaços.
  El botó «Sin formato» (`clearFormatting`) treu l'href i després el sanejador desempaqueta
  l'`<a>` buit: el cicle es tanca sol, sense etiquetes mortes.
- **El driver es menjava el clic**: el `.parallax-driver` tapa el slide i el clic es reenviava a
  la frase de sota (hi glissava). Ara, si sota el punter hi ha un `a[href]`, se segueix l'enllaç
  **només quan la frase ja és l'activa**; a les frases atenuades el clic hi porta primer (navegar
  des d'una frase que encara no s'ha llegit seria un salt en fals). 2 tests nous.

Estil: `.parallax-frases p a` amb el color de les negretes (accent del capítol, vermell a la
coda) i subratllat. Verificat en headless: els tres `<a>` amb href i `target="_blank"`.
Suite: **92 suites / 1536 tests**.

## 3. Segona tanda: intro i coda reescrites, i el bug de «no surten les frases»

L'usuari no veia els CTA ni prement «Restaurar paso» ni amb hard reset. Dues causes possibles,
totes dues reals: el commit dels CTA encara no era a origin (GitHub Pages servia el text antic),
i en local mana el `localStorage` — els textos que ell mateix havia desat des del panell tapen
els del codi, i «Restaurar paso» només actua sobre el paso obert en aquell moment.

Arreglat d'arrel amb el mecanisme que ja es va fer servir el 2026-08-31: `OVERRIDES_VERSION` 7 → 8
amb `if (ver < 8) stored = {}` (es descarten els textos desats; les densitats no s'hi toquen).
Verificat en headless sembrant l'escenari exacte —override de text al paso 1 i al 29 amb
`sistema.overrides.version = 7`—: en carregar, `overrides={}`, versió 8 i el text nou a pantalla.

Textos (còpia de l'usuari, del PDF "NUZIC Textos SI"):
- **Paso 1**: la intro llarga («La música sucede en el tiempo…»), 7 frases, substitueix la versió
  curta anterior. Negretes: Sistema Nuzic, Dónde/Cuándo i els cinc conceptes del recorregut.
- **Paso 29**: la coda del PDF (5 frases) + les 3 CTA amb enllaç, reescrites per l'usuari
  («Si te ha gustado esta introducción…», «Sigue creando música…», «Si eres docente…»).
  Retocs meus, per revisar: «cxreación» → «creación», «desplegados» → «desplegadas» (concordança)
  i, a la tercera, el segon dels dos punts convertit en coma.

Suite: 92 suites / 1536 tests.

## Pendent

- Push (main va per davant d'origin).
- `SESSION_STATE.md` i l'acta del 2026-09-15 són d'una sessió paral·lela: no s'han tocat.
