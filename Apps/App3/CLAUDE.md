# App3: Fraction Editor

## Purpose
Represent rhythmic fractions (n/d) with linear/circular timeline and audio.
Test bed for `fraction-editor` integration with mixer, preferences, and shared randomization.

## Flow
1. `bindAppRhythmElements('app3')`
2. `createPreferenceStorage({ prefix: 'app3', separator: '::' })` — centralizes localStorage
3. `createRhythmAudioInitializer` → registers channels: pulse/cycle
4. `createFractionEditor({ mode: 'block', defaults, storage })` → syncs n/d inputs
5. `initAudioToggles` → Pulse/Cycle buttons (persistent), linked to mixer
6. `createTimelineRenderer` + `gridFromOrigin` → subdivision layout for both timeline modes
7. `initRandomMenu` + `applyBaseRandomConfig` → Lg/V/n/d randomization (`allowComplex`)

## Fraction Validation
- denominator > 0, numerator > 0, numerator < denominator
- Fraction key format: `"base+numerator/denominator"` (e.g., `makeFractionKey(3, 1, 4)` → `"3+1/4"`)

## State
- localStorage prefix `app3::`: Lg/V, fractions, random, audio prefs, theme, mixer config
- Local caches: `pulseNumberLabels`, `cycleMarkers`, `cycleLabels`, `bars`, `lastStructureSignature`

## Tests
Shared tests: fraction-editor, audio-toggles, subdivision, notation-utils, tap-resync.
