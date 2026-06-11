# Audio Engine — Context for Claude

## HIGH-RISK: Modify with extreme caution
- `timeline-processor.js` — AudioWorklet timing + polyrhythmic voices. Changes here affect ALL apps.

## Timing Rules
- Processing block: 128 samples
- Epsilon for beat comparison: `1e-9` (prevents double-trigger)
- `secondsPerBeat`: always `Math.max(1e-6, value)` to avoid division by zero
- Tempo alignment options: `'immediate'`, `'nextPulse'` (default), `'cycle'`
- Loop wrap: `currentStep %= totalBeats`
- Tempo ramp: linear per sample, `rampStep = (targetSpb - startSpb) / rampSamples`

## Polyrhythmic Voices
- Period = numerator / denominator (both minimum 1)
- Voice countdown uses same `1e-9` epsilon

## Mixer
- Master volume default: 0.75, clamping always [0, 1]
- Solo logic: if any channel has solo, all non-solo channels mute
- Rhythm channels al motor melòdic (pulse/start/accent/subdivision): volume 0.6 (LA-09: 0.1 feia el metrònom inaudible sota l'instrument; clau de persistència bumped a :v2 pel canvi). Apps rítmiques pures: defaults del bus del motor.
- Melodic instrument channel: volume 1.0
- Linear-to-dB conversion: `20 * Math.log10(clampedValue)`

## AudioContext
- Requires user gesture (`event.isTrusted === true`) before initialization
- Latency hint: `'interactive'`
- SamplerPool (1-3ms latency) preferred over Tone.Sampler (20-50ms)
- Pool size: max 16 simultaneous voices per pitch class
- SamplerPool has drift compensation: shortens duration when `when < now`

## Scheduling Sync (sample-instrument alignment)
- Samples scheduled proactively in `tick()` with future `when` time
- A-04: el handler del missatge 'pulse' invoca `tick()` directament via `_tickFn` (MessagePort no es throttleja) — primer pols immediat i agenda viva en pestanyes en segon pla; el setInterval és backup
- LA-08: `engine-ready.js` — el motor senyala el bus melòdic en crear-lo (signalMelodicChannelReady) i piano/flute esperen la promesa (whenMelodicChannelReady, timeout 1500ms) en lloc de fer polling
- A-10: el rebobinat de `setTempo` cancel·la les fonts del lookahead (`_futureSources` per pas absolut) abans de re-agendar — sense flams; el SamplerPool cancel·la veus no començades via `cancelScheduledVoices()`
- `_sampleOffsetSec` (0-20ms): delays samples to compensate for instrument callback latency
- `onSchedule(step, when)` callback: fires from `tick()` alongside samples for proactive instrument scheduling
- `registerNoteProvider(id, fn)`: declarative API — provider returns `[{midi, duration, velocity}]`, engine handles timing
- `onPulse` is for visual feedback only — never schedule audio in onPulse
- Configurable via `setSampleOffset()`, `setScheduling({sampleOffset})`, or `configurePerformance({sampleOffsetMs})`
- UI control in performance-audio-menu.js "Sample Offset (ms)" slider — NOMÉS en mode dev (?dev / nuzic-debug); en producció ho gestionen el preset balanced + el scheduling bridge. La fila de Sample Rate es va eliminar (re-creava el context i trencava l'invariant 44100 pinnat).

## Sample Mapping
- pulso → click9 (Hi-Hat), pulso0 → click7 (Bombo), seleccionados → click8 (Caja)
- start → click7, cycle → click10 (Ride)
- Piano/flauta: mp3 vendoritzats a `samples/instruments/{salamander,flute}/` (local primer,
  CDN com a fallback si Tone.loaded() falla)
- Preload/prefetch (P-12): Tone.js via `<link rel="preload">` + `prefetchDefaultSamples()`
  en idle — només mouen bytes, MAI creen AudioContext ni descodifiquen abans del gest

## ADSR Defaults
- attack: 0.005, decay: 0.1, sustain: 0.8, release: 0.3
- Quick release for stop-all: 0.05 (prevents clicks)

## Tests
- `__tests__/`: index, mixer, tone-loader, melodic-sequence, registry-controller, sampler-pool (LH-17: layout unificat, cap test co-locat)
- Tests produce controlled `console.warn` when simulating fetch errors — DO NOT remove them without adjusting asserts
