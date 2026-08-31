# 2026-08-31 — App16: un sol compás (2-12 pulsos)

## Objectiu
Refer App16 perquè mostri **només un compás** amb un màxim de 12 pulsos
(abans: 2 compases per defecte, màxim manual 7, i el random variava els
cicles amb la regla `cyclesForCompas` 1/2/3 segons el compás).

Decisions de l'usuari: mantenir el superíndex de cicle (notació Nuzic,
sempre `¹`) i rang **mínim 2 / màxim 12** compartit entre manual i random.

## Canvis (`Apps/App16/`)

**main.js**
- Eliminat el concepte `cycles` + `cyclesForCompas`; `getTotalPulses()` = compás.
  `measureHeader.render(compas, 1)` → sempre un únic marcador.
- Constants: `MIN_COMPAS = 2`, `MAX_COMPAS = 12` (substitueixen
  `MAX_COMPAS=7` + `MIN/MAX_COMPAS_RANDOM`); `handleRandom` ja no necessita
  `maxOverride` ni cicles.
- **Validació tolerant durant el tecleig**: amb màxim 12, escriure "10-12"
  passa per "1" (invàlid, mínim 2). L'event `input` crida
  `handleCompasChange(v, { lenient: true })`: un "1" queda com a estat
  pendent (timeline buida, sense avís); la validació estricta salta al blur
  o al dígit següent. Segueix la política BPM del repo (no clampar mentre
  s'escriu).
- Spinners: des de buit, `+`/`−` van a 2; `−` s'atura a 2.
- **Esborrat el codi mort del fade-out** (`FADE_OUT_PULSES=0` des d'abans):
  `highlightNumber`, branques fade de `highlightPulse`/`clearHighlights`,
  rampes `setVolume`/`getVolume` a `handlePlay`/`onSchedule` (import
  eliminat), `applyFadeOut`, `currentStep`. Efecte lateral BO de retruc:
  desapareix el `setVolume(1.0)` de `stopPlayback`, que clavava el master
  a 1.0 en cada stop trepitjant el volum de l'usuari.
- **Bugfix latent**: `registerFactoryReset.onBeforeReload` referenciava una
  `MIXER_STORAGE_KEY` inexistent (ReferenceError en fer factory reset). Ara
  és una const real compartida amb `createMixerPersistence` ('app16-mixer').
- Tret el `classList.add('cycle-start')` redundant a `renderPulseNumbers`
  (`createNumberElement` del cycle-superscript ja el posa).

**index.html** — input compás `min="2" max="12"` (abans 1-7).

**styles.css** — fora el bloc `.fade-out`/`.pulse-number.hidden` orfe.

**No tocats**: `libs/shared-ui/measure-header.js` i
`libs/app-common/cycle-superscript.js` (compartits amb App19/App20; reben
els cicles per paràmetre i amb 1 rendeixen bé).

## Verificació
- `npm test`: 90 suites / 1476 tests OK.
- Puppeteer headless (perfil aïllat, servidor :8080 propi, tancat en acabar):
  teclejar "12" pinta 12 pulsos `0¹…11¹` amb 1 marcador (pas per "1" sense
  avís); blur amb "1" → warning "mínimo 2" + input buit; spinner des de buit
  → 2 i `−` no baixa de 2; 12 randoms → sempre 1 marcador i valors 2-12;
  play amb compás 5 → highlight avança i en acabar es neteja (P0 només al
  pols 0). Zero errors de consola.

## Notes
- `sistema/` incrusta App16 al pas 12 ("El compás: el módulo temporal",
  aspect 2/1) — pendent de l'usuari mirar-ho al navegador dins la diapositiva.
- Títol de l'app corregit a "Módulo Temporal - Compás" (`<title>` +
  `renderApp`); abans deia "Línea", herència d'App15.
