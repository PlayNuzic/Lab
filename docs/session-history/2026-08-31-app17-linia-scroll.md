# 2026-08-31 — App17: de donut circular a línia amb scroll

## Objectiu
Redisseny profund d'App17: fora la timeline circular; línia estil App16
que pot albergar **fins a 6 compases** de 2-12 pulsos, amb **scroll
horitzontal** manual i **auto-scroll suau per compás** durant el playback.
Es mantenen el control dual (Compás amb el Cycle niat al cercle) i la
pastilla Longitud.

Decisions de l'usuari: auto-scroll per salt de compás però amb lliscament
suau (no salt sec); capçalera measure-header amb el número de cada compás;
compás 2-12 (validació tolerant com App16), cycles 1-6.

## Arquitectura nova (`Apps/App17/`)

**DOM (creat a `initializeApp`)**
```
.timeline-wrapper
  #timelineScroll            ← overflow-x: auto (touch-action: pan-x)
    .tl-scroll-content       ← width: max(100%, 2·band + 2·inset + N·pulse-min-w)
      #measureHeader         ← component compartit measure-header (label "Compás",
                                marcadors 1..cycles, valor del compás al 1r)
      #timeline              ← franja crema; bandes grogues via ::before/::after
```
Capçalera i timeline **scrollen solidàries** (un sol contenidor — sense
sync JS). `--total-pulses` (JS) governa l'amplada; si tot cap, 100% i cap
scroll (idèntic a App16).

**Geometria**: #timeline té marges laterals `--com-band-w` i les bandes
grogues es pinten fora de la seva caixa (`left: -band` / `left: 100%`).
Centres de pols a `[--tl-inset, 100% − --tl-inset]` (JS posa `--pulse-left`
en fracció d'aquesta zona). El track del header usa el mateix sistema
(`--tl-side-pad: var(--com-band-w)` + override de `left/right` a l'inset),
així els marcadors cauen exactament sobre els downbeats. Sense els hacks
de box-shadow/margin-right d'App16 (allà els endcaps es projecten fora del
wrapper; aquí viuen dins el contingut d'scroll).

**Auto-scroll (playback)**: al downbeat de cada compás,
`smoothScrollTo(scrollEl, target, 'left', 750, 'easeInOut')` de
**`libs/plano-modular/plano-scroll.js`** (reutilitzat, importa directe;
respecta prefers-reduced-motion). Target = centre del downbeat − 3/4 de
pols de context; play comença amb scrollLeft=0. El marcador del compás en
curs s'omple de groc (`.measure-marker.is-current`, app-side via
`data-cycle` — cap canvi al component compartit).

**Playback**: mode linear del `cycle-superscript` (números únics 0¹..11⁶,
highlight per índex absolut — fora el mòdul visual del donut). El conteig
global de playback passa del centre del donut a la **pastilla Longitud**
(`totalLengthController.updateGlobalStep`, ja suportat pel mòdul; `reset()`
torna al total en aturar). P0 a cada inici de compás via `configureMeasure`.

**Inputs**: compás 2-12 amb validació **lenient** ("1" pendent com App16) +
l'**auto-jump** Compás→Cycle d'App17 (el timer del "1" pendent fa validació
estricta diferida en comptes de saltar). Cycle 1-6 amb el mateix patró
d'avís que el compás (retoc de l'usuari: fora el clamp silenciós — fora de
rang → tooltip amb el límit + input buit + focus per reintentar; l'ENTER
invàlid no fa blur). Amb cycle buit es mostra 1 compás (Longitud continua
a `--` fins tenir tots dos).

**Eliminat**: `circular-timeline-ring` (segueix viu per App1 loop),
ResizeObserver, centre del donut (`total-length-center`), `cycleDigit`,
toggle `cycleHighlight` (+ checkbox del menú), no-ops del disseny vell
(`updateCycleCounter`, `highlightCycleCircle`...), persistència morta de
pulsos/cycles (sempre comencen buits; només es desen els màxims del random).

**index.html**: + `measure-header.css`; inputs 2-12/1-6; menú random
"Pulsos máximo" 2-12 (abans 1-99) i "Compases máximo" 1-6 default 6 (abans
"Cycles máximo" 1-12 default 8); fora `showCycleHighlightToggle`.

## `sistema/` (pas 13)
- `slide-data.js`: aspect `1/1`→`2/1`, group `circular`→`timeline-complex`
  (mateix tractament d'iframe que App16 al pas 12; layout B-app-left es manté).
- `slides.css`: retirada la regla `.slide[data-app="App17"]` del quadrat
  700×700 (era per al cercle); queda una nota. Pas 11 NO es toca (l'usuari
  diu que App17 acabarà fora d'allà).

## Verificació
- `npm test`: 90 suites / 1476 tests OK.
- Puppeteer (perfil aïllat, servidor :8080 propi, tancat en acabar):
  4×3 → 12 números, 3 marcadors, Longitud 12, sense scroll; "1" pendent
  sense avís i "12" commiteja; 12×6 → 72 números, 6 marcadors, scroll de
  4200px, endcap+doble barra al final; play 12×2 @150bpm → al compás 2
  scrollLeft 0→744 amb lliscament, marcador 2 ple, Longitud comptant
  (14/24), final net (total restaurat, cap highlight); auto-jump
  Compás→Cycle OK; 800×400 usable. Zero errors de consola.

## Retocs post-revisió (mateixa sessió)
- Cycle amb avisos de límit (patró compás) en lloc de clamp silenciós.
- `SCROLL_GLIDE_MS` 600→750→940 (dos retocs de +25%: dins l'iframe del
  sistema el lliscament encara es percebia massa ràpid).
- Títols: App17 → **"Módulo Temporal - Compases"**, App16 →
  **"Módulo Temporal - Pulsos por compás"** (`<title>` + renderApp; nota:
  escrit amb l'accent castellà "compás" per coherència amb la UI de l'app).
  També a les tarjetes d'`Apps/index.html`.
- "Nº de compases" més a prop del cercle: override App17 de l'offset del
  tema `clamp(0rem, 1.5vw, 1.1rem)` → `clamp(0rem, 0.7vw, 0.5rem)` (màxim
  0.5rem provat per l'usuari a l'inspector; pendent vw escalat en proporció).
- **Pas 13 tallat per sota (fix)**: en embed desktop el contingut feia
  ~545px i l'iframe 2/1 en dona ~488 (`overflow: hidden` d'embed.css
  tallava els controls; el pas 12/App16 cabia perquè té menys columna
  vertical). Compactació de marges NOMÉS en `html[data-embed="true"]`:
  `.inputs` margin 40/20→8/12px (el gruix), wrapper 16/16→4/4,
  padding-bottom del contingut d'scroll 20→14px (mínim dels ticks),
  controls margin-top 10→4. Verificat a 977×488, 910×455 i 1100×550:
  controls sencers amb marge (461/442/479 < viewport). Standalone intacte.

## Pendents / decisions de contingut (usuari)
- Títol del pas 13 ("Línea temporal en círculo") i treure App17 del pas 11.
- Verificació al navegador real (pas 13 del sistema inclòs).
