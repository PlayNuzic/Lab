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

## Pendent

- Push (main va per davant d'origin).
- `SESSION_STATE.md` i l'acta del 2026-09-15 són d'una sessió paral·lela: no s'han tocat.
