# Audio Engine — Context for Claude

## HIGH-RISK: Modify with extreme caution
- `clock.js` — AudioWorklet timing. Changes here affect ALL apps.

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
- Rhythmic channels (pulse/start/accent/subdivision): volume 0.1
- Melodic instrument channel: volume 1.0
- Linear-to-dB conversion: `20 * Math.log10(clampedValue)`

## AudioContext
- Requires user gesture (`event.isTrusted === true`) before initialization
- Latency hint: `'interactive'`
- SamplerPool (1-3ms latency) preferred over Tone.Sampler (20-50ms)
- Pool size: max 16 simultaneous voices per pitch class

## Sample Mapping
- pulso → click9 (Hi-Hat), pulso0 → click7 (Bombo), seleccionados → click8 (Caja)
- start → click7, cycle → click10 (Ride)

## ADSR Defaults
- attack: 0.005, decay: 0.1, sustain: 0.8, release: 0.3
- Quick release for stop-all: 0.05 (prevents clicks)

## Tests
- `index.test.js`, `mixer.test.js`
- Tests produce controlled `console.warn` when simulating fetch errors — DO NOT remove them without adjusting asserts
