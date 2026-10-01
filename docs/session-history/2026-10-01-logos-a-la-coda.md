# 2026-10-01 — Logos enllaçats a l'última frase de la coda (paso 29)

## Què s'ha fet
- Paso 29, frase «¿A dónde quieres ir ahora?»: a sota, tres logos en fila
  amb el nom sota cadascun: Sistema Nuzic, App Nuzic i PlayNuzic. Logo i nom
  formen un sol enllaç: `<a href><img alt="">Nom</a>`. Les adreces són les
  mateixes dels CTA d'abans de la coda.
- Fitxers SVG a `sistema/images/frases/`:
  - `logo-sistema-nuzic.svg`: el `nuzic.svg` original, sense el bloc de
    metadades C2PA.
  - `logo-app-nuzic.svg`: el símbol inline (sense `<use>`), amb `viewBox`
    (sense, no s'escala dins un `<img>`), fons fosc #43433b i marge igual al
    del Sistema (cercle = 24/28 de la caixa). Els seus elements crema no es
    veuen sobre blanc.
  - `logo-playnuzic.svg`: `viewBox` amb marge i el mateix fons fosc, perquè
    els tres requadres siguin iguals. Es va provar també sobre requadre clar;
    l'usuari s'ha quedat el fosc.
- `parallax.css`: `.parallax-frases p a:has(> img)` és inline-flex en columna
  (logo a sobre, nom a sota), sense subratllat, i el subratllat apareix amb
  hover o `.is-hover`. El logo fa `clamp(64px, 8vw, 128px)` amb
  `border-radius: 22%`.
- `tweaks.js`: la llista «Imágenes del parallax» ignora les imatges que van
  dins d'un `<a>` (`ENLLAC_G`), perquè no es puguin treure de l'enllaç.

## Verificació
Headless, amb `HTMLAnchorElement.prototype.click` interceptat. Per a cada
logo, tant sobre la imatge com sobre el nom: cursor de mà, `.is-hover` i el
clic porta a l'adreça correcta. Fora dels logos, cursor normal.
- Mida del logo: 115 px a 1440 i 64 px a 500.
- Llista de Tweaks: 0 imatges al paso 29 i 2 al paso 2.
- Suite: 95 suites / 1580 tests.
