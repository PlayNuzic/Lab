# SESSION_STATE - App30/App31 Development

## ESTAT ACTUAL (Gener 2026)

### ✅ FIXES COMPLETATS

#### Fix 1: InvalidAccessError Tone.js (RESOLT)
- **Problema**: Samplers (violin, piano, flute) fallaven amb `InvalidAccessError` en connectar-se al `melodicChannel`
- **Causa**: `createRhythmAudioInitializer` creava `TimelineAudio`, però instruments melòdics necessiten `MelodicTimelineAudio` que sincronitza el context amb `Tone.setContext(this._ctx)`
- **Solució aplicada**: Canviat a `createMelodicAudioInitializer({ defaultInstrument: 'violin' })`
- **Apps afectades**: App30, App31

#### Fix 2: Label i càlcul L Pfr (RESOLT)
- **Canvi**: `L iT` → `L Pfr` (Longitud Pulsos Fraccionats)
- **Càlcul nou**: `getTotalSubdivisions()` = `Lg × d / n`
  - Exemple amb 1/2: 6 × 2 / 1 = **12** pulsos fraccionats
  - Exemple amb 2/3: 6 × 3 / 2 = **9** pulsos fraccionats
- **Apps afectades**: App30, App31

#### Fix 3: Inicialització sons metrònom/cicle (RESOLT)
- **Problema**: El metrònom no sonava durant playback a App31
- **Causa**: `createMelodicAudioInitializer` no configura sons des dels dropdowns (a diferència de `createRhythmAudioInitializer`)
- **Solució aplicada**: Afegit `setBase()` i `setCycle()` a `initAudio()` per configurar sons des dels dropdowns
- **Apps afectades**: App30, App31

#### Fix 4: Visualització pulsos no-selectables (App31)
- **Canvi**: Pulsos que no coincideixen amb inici de cicle es mostren en gris
- **Implementació**: Afegit classe `non-selectable` als pulsos i números
- **Afegit**: Labels `cycle-label--integer` per mostrar números als polsos sencers

#### Fix 5: Playback oficial com App29 (RESOLT)
- **Problema**: Pulsos sencers no sonaven ni s'il·luminaven durant playback
- **Causa**: Playback manual amb `sleep()` i `playSound()` en lloc del sistema oficial
- **Solució aplicada**: Implementat `audio.play()` amb scheduling integrat (com App29)
  - Metrònom sona a TOTS els pulsos sencers (0-6)
  - Subdivisió sona a TOTES les subdivisions
  - Highlighting amb `highlightPulse()` i `highlightCycle()` callbacks
  - Notes melòdiques programades amb `scheduleMelodicNotes()`
- **Apps afectades**: App30, App31

---

## ✅ FUNCIONALITATS QUE JA FUNCIONEN

1. **Àudio melòdic** - Instruments (violin, piano, flute) sonen correctament ✓
2. **So del cicle (Subdivisión)** - Desplegable i so funcionen ✓
3. **So del metrònom** - Desplegable i so funcionen ✓
4. **Bidireccionalitat timeline ↔ iT-seq** ✓
5. **Rectangles iT** (interval-bar-visual) amb colors i etiquetes ✓
6. **Info column** - Σ iT i L Pfr amb càlculs correctes ✓
7. **Fracció inline** amb spinners ✓
8. **Drag des de cycle-markers** ✓
9. **Drag des de pulsos sencers (boles)** ✓
10. **Suport per silencis amb 's'** ✓
11. **Gaps a timeline es converteixen en silencis** ✓
12. **Mixer via longpress sobre play** ✓
13. **BPM fix a 70** ✓
14. **Lg fix a 6** ✓
15. **Random i Reset** funcionen correctament ✓

---

## ARQUITECTURA ACTUAL

```
App30/main.js (Fraccions Simples - n=1 fix):
├── createMelodicAudioInitializer({ defaultInstrument: 'violin' })
├── FIXED_NUMERATOR = 1
├── DEFAULT_DENOMINATOR = 2
├── createItfrLayout() - genera estructura iTfr amb L Pfr
├── initFractionEditorController() - mode inline, setSimpleMode()
├── renderTimeline() - pulses + cycle-markers
├── updateIntervalBars() - rectangles iT
├── attachDragHandlers() - drag des de markers i pulses
├── sanitizeItSeq() - valida entrada manual (inclou 's' per silencis)
├── syncItSeqFromSequence() - sequence → text
├── startPlayback() - àudio melòdic + metrònom + cicle
├── updateInfoDisplays() - Σ iT i L Pfr (getTotalSubdivisions)
└── handleRandom/handleReset - botons

App31/main.js (Fraccions Compostes - n editable 2-6):
├── createMelodicAudioInitializer({ defaultInstrument: 'violin' })
├── DEFAULT_NUMERATOR = 2, DEFAULT_DENOMINATOR = 3
├── MIN_NUMERATOR = 2, MAX_NUMERATOR = 6
├── initFractionEditorController() - mode inline, setComplexMode()
└── Resta igual que App30
```

## DIFERÈNCIES APP30 vs APP31

| Aspecte | App30 | App31 |
|---------|-------|-------|
| Fracció inicial | 1/2 | 2/3 |
| Numerador | Fix a 1 | Editable (2-6) |
| Mode fracció | setSimpleMode() | setComplexMode() |

---

## PENDENTS / POSSIBLES MILLORES FUTURES

1. **Responsive mobile** - Verificar comportament en mòbil
2. **Millores UX** - Feedback visual durant playback

---

## RECORDATORIS

- **SEMPRE llegir el fitxer ABANS de modificar-lo**
- **Testejar després de cada canvi petit**
- **Canvis s'han d'aplicar a AMBDUES apps (App30 i App31)**
