# Shared UI — Context for Claude

## Purpose
Unified header, sound controls, dropdowns, tooltips shared across all apps.

## Main Exports
- `initHeader({ title, audioControls, onMuteToggle })` — Top-bar header. El menú hamburguesa (☰) és NOMÉS dev (?dev / nuzic-debug): es renderitza sempre (les apps llegeixen els seus elements; els selects de so alimenten l'àudio) però queda ocult per a l'alumne — sons al mixer, resets in-place, la resta són ajustos de demo
- `initSoundDropdown()` — Sound selector with P1 toggle
- `initP1ToggleUI()` — Pulse 1 toggle
- Hover/tooltip helpers
- `performance-audio-menu.js` — Schedule horizon + sample offset (eina de diagnòstic, NOMÉS dev; la fila de Sample Rate es va eliminar — trencava l'invariant del context 44100 pinnat)

## Event System
Emits events that apps must handle:
- `sharedui:theme` — Theme change
- `sharedui:mute` — Mute toggle
- `sharedui:selectioncolor` — Selection color change
- `sharedui:scheduling` — Scheduling profile change

## CSS Variables (defined in `:root`)
`--col-left`, `--col-right`, `--layout-gap`, `--select-color`, `--text-color`

## Rules
- Always search here FIRST before creating new UI components
- Maintains accessibility: focus management, keyboard navigation, ARIA roles
- No dedicated tests — verify via `npm test` against app-common and sound libs
