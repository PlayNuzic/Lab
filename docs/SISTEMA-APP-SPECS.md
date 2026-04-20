# Sistema Interactivo — Specs per app embedida

Input per al futur `sistema/js/slide-data.js` i briefing visual per a Claude Design. Valors validats empíricament al [test harness](../tests/embed-test.html) amb `?embed=true`.

> Els iframes reben `?embed=true`. El shared [libs/app-common/embed.css](../libs/app-common/embed.css) aplica automàticament: top-bar com a overlay discret (☰ visible al cantó superior esquerre), h1 amagat, main a 100vh, volum integrat a `.controls` o flotant. El Sistema no ha de fer cap ajustament CSS per app.

---

## 1. Matriu completa de slides (27 slides, 6 seccions)

Columnes:
- **Width** — slot horitzontal dins el grid 3-col del Sistema.
- **Aspect** — aspect-ratio de l'iframe (sweet spot validat).
- **App** — apps embedides al slide.

### Introducción

| Paso | Títol | Width | Aspect | App | Notes |
|------|-------|-------|--------|-----|-------|
| 1 | Intro: movimientos en la música | 2-col (img+text) | — | — | Sense app — imatge + text |
| 2 | Contar y Medir | 2-col (img+text) | — | — | Sense app — imatge + text |
| 3 | Contar y Medir la Música | 2-col-left | 4/3 | app11 | Plano aleatori (nomes play) |
| 4 | Línea Temporal | 2-col-left | 2/1 | app9 | Timeline horitzontal |
| 5 | Línea Sonora | **1-col-right** ⚠️ | **2/3** ⚠️ | app10 | Únic cas vertical — veure nota A |
| 6 | El Plano Musical | 2-col-left | 4/3 | App11A | Plano interactiu (click + random) |

### Descubriendo

| Paso | Títol | Width | Aspect | App | Notes |
|------|-------|-------|--------|-----|-------|
| 7 | Descubriendo la Música | 2-col-left | 4/3 | App12 | Plano + editor N-P |
| 8 | Midiendo el movimiento | 2-col-left | 2/1 | app13 | Intervals temporals intro |
| 9 | Intervalo Sonoro | 2-col-left | 3/2 | App14 | Layout 2-col propi |

### Intervalos

| Paso | Títol | Width | Aspect | App | Notes |
|------|-------|-------|--------|-----|-------|
| 10 | Intervalos en el Plano | 2-col-left | 4/3 | App15 | Plano + iS + iT |

### Ampliando

| Paso | Títol | Width | Aspect | App | Notes |
|------|-------|-------|--------|-----|-------|
| 11 | Intro Patrones/Ciclos/Módulos | 2-col (img+text) | — | — | Sense app — imatge + text |
| 12 | El compás: módulo temporal | 2-col-left | 2/1 | App16 | Lineal |
| 13 | Línea temporal en círculo | 2-col-left | **1/1** | App17 | ⚠️ Circular — aspect quadrat |
| 14 | Registro de octava | 2-col-left | 3/2 | App18 | Contingut curt vertical — veure nota B |
| 15 | Plano Modular | 2-col-left | 4/3 | App19 | Layout 2-col propi complex |
| 16 | Plano y Sucesión N-iT | 2-col-left | 4/3 | App20 | |

### Fraccionando

| Paso | Títol | Width | Aspect | App | Notes |
|------|-------|-------|--------|-----|-------|
| 17 | Fraccionando la Línea Temporal | 2-col-left | 2/1 | App26 | |
| 18 | Sucesión Pulsos Fraccionados | 2-col-left | 2/1 | App28 | |
| 19 | Sucesión iT Fraccionados | 2-col-left | 2/1 | App30 | |
| 20 | Sucesión en Plano Fracciones Simples | 2-col-left | 4/3 | App32 | |
| 21 | Fracciones Complejas | 2-col-left | 4/3 | App34 + App35 | Toggle App34↔App35 — veure nota C |

### Escalas

| Paso | Títol | Width | Aspect | App | Notes |
|------|-------|-------|--------|-----|-------|
| 22 | Escalas: Escogiendo Notas | 2-col-left | 3/2 | App21 | Scale app — volum flotant (nota D) |
| 23 | Estructura Escalar | 2-col-left | 3/2 | App22 | Scale app |
| 24 | Transposición | 2-col-left | 3/2 | App23 | Scale app |
| 25 | Probando diferentes Escalas | 2-col-left | 3/2 | App24 | Scale app minimal |
| 26 | Melodías con Escalas | 2-col-left | 4/3 | App25 + App25B | Toggle App25↔App25B — veure nota C |
| 27 | Intervalos con Escalas | 2-col-left | 4/3 | App25B | |

### Distribució de width

| Width | Pasos | Total |
|-------|-------|-------|
| 2-col (img+text, sense app) | 1, 2, 11 | 3 |
| 2-col-left (app a cols 1+2, text a col 3) | 3, 4, 6, 7, 8, 9, 10, 12, 13, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27 | 22 |
| **1-col-right** (text a col 1, app a col 2) | **5** | **1** |
| 2-col-right | — | 0 |

El paso 14 (App18) pot ser un segon cas 1-col si voleu aspect encara més vertical. Decisió empírica.

---

## 2. Notes especials

### A — Paso 5 (app10), únic cas "1-col-right"

App10 és la Línea Sonora (soundline vertical). Amb un aspect **2/3** (estret i alt) ocupa **una sola columna (la del centre)**. Al Sistema:

```
+---------+---------+---------+
|  TEXT   | IFRAME  |  tips?  |
| (col 1) | app10   | (col 3) |
+---------+---------+---------+
```

És l'únic slide que no usa el 2/3 de l'ample. Al pla originalment figurava com `span-right`, però hem descobert que amb `1-col` queda millor visualment. L'iframe fa `clamp(25rem, 85vh, 62.5rem)` d'ample i aprofita l'alçada completa.

### B — Paso 14 (App18), candidat a 1-col

App18 (Registro de octava) té contingut curt verticalment i podria anar bé a 1-col amb aspect vertical. En el harness actual està provat a 2-col-left 3/2 i funciona, però verifiqueu si 1-col queda millor alineat amb el format de l'slide.

### C — Pasos 21 i 26: apps amb variant/toggle

- **Paso 21** — **App34** (principal) + **App35** (extra). A la web del Sistema, Paso 21 mostra App34 amb un enllaç/toggle opcional a App35 (fraccions complexes). El Sistema pot gestionar-ho amb un sub-selector.
- **Paso 26** — **App25** (principal) + **App25B** (variant iS). Situació similar. Paso 27 ja usa App25B en solitari.

### D — Scale apps (App21-24): volum flotant

Les scale apps no tenen `.controls` estàndard perquè sobreescriuen `.timeline-wrapper`. El volum es col·loca automàticament via `position: fixed` entre els `.soundline-play` buttons (gestionat per `relocateSoundWrapperForNuzic()` a [libs/shared-ui/header.js](../libs/shared-ui/header.js)). **El Sistema no ha de fer res** — funciona dins l'iframe.

### E — Pasos 1, 2, 11: slides sense app

Usen template 2-col amb imatge a un costat i text a l'altre. Sense iframe. Necessiten imatges a `sistema/assets/images/` (carrer, cintes metriques, diagrama patrons/ciclos).

---

## 3. Estructura del slide (text + tips)

Cada slide amb app té tres slots:

- **IFRAME** (width + aspect segons taula) — la columna principal.
- **Text teòric** — a la columna restant del grid 3-col.
- **Caixa tips/pràctica** — DINS de la columna de text, sota el bloc teòric. Fons `rgba(124, 214, 179, 0.15)`, border-left `#7cd6b3` 3px, text `#43433b`. **NO canvia en dark mode** (colors fixos).

Exemple 2-col-left:
```
+-------------------+-------------------+-------------------+
|                                       |  TEXT TEÒRIC      |
|           IFRAME (span 2)             |                   |
|                                       |  ┌─────────────┐  |
|                                       |  │ TIPS BOX    │  |
|                                       |  │ (verd pale) │  |
|                                       |  └─────────────┘  |
+-------------------+-------------------+-------------------+
```

Exemple 1-col-right (Paso 5):
```
+-------------------+-------------------+-------------------+
|  TEXT TEÒRIC      |                   |                   |
|                   |     IFRAME        |   (buit)          |
|  ┌─────────────┐  |   (span 1)        |                   |
|  │ TIPS BOX    │  |                   |                   |
|  └─────────────┘  |                   |                   |
+-------------------+-------------------+-------------------+
```

---

## 4. Dark mode

`data-theme="dark"` al `<body>` del Sistema. El text teòric hereta (bg blanc→`#1e1e1e`, text `#43433b`→`#eee8d8`). La caixa tips **NO canvia**. L'iframe hereta el dark mode si el Sistema propaga `?theme=dark` a l'URL (implementació pendent — les apps actualment el llegeixen de localStorage).

---

## 5. Responsive vertical (< 768px)

Una sola columna. Ordre:
1. Text teòric
2. Caixa tips
3. IFRAME

Al mobil, tots els slides (inclòs Paso 5) usen 1-col full width per a l'iframe.

---

## 6. Referències

- Document pla general: [SISTEMA-INTERACTIVO-PLAN.md](SISTEMA-INTERACTIVO-PLAN.md)
- Adaptacions per app: [APPS-ADAPTACIONS-IFRAME.md](APPS-ADAPTACIONS-IFRAME.md)
- Harness de validació: [tests/embed-test.html](../tests/embed-test.html)
- Shared embed CSS: [libs/app-common/embed.css](../libs/app-common/embed.css)
- Shared embed script: [libs/app-common/embed-mode.js](../libs/app-common/embed-mode.js)
