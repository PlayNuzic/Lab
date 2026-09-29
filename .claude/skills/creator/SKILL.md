---
name: creator
description: Create new PlayNuzic Lab apps following established patterns and conventions
---

# App Creator Skill

You are creating a new app for the PlayNuzic Lab monorepo. Follow these steps strictly.

## Before Starting
1. Ask the user for: app number, concept, which existing app is closest in functionality
2. Read the closest existing app (`index.html`, `main.js`, and its `CLAUDE.md` if it has one — only some apps do)
3. Check `libs/` for ALL reusable components before writing any app-specific code

## File Structure
Every app MUST have:
```
Apps/AppN/
├── index.html    # HTML with module imports
├── main.js       # App logic
├── styles.css    # App styles (import shared styles)
├── utils.js      # App-specific utilities (if needed)
└── CLAUDE.md     # App documentation for Claude
```

## Required Initialization Pattern
```javascript
import { bindAppRhythmElements } from '../../libs/app-common/dom.js';
import { createRhythmAudioInitializer } from '../../libs/app-common/audio-init.js';
import TimelineAudio from '../../libs/sound/index.js';

const { elements, leds, ledHelpers } = bindAppRhythmElements('appN', { /* extra elements */ });
const initAudio = createRhythmAudioInitializer({...});
const audio = await initAudio();
```

## DO NOT use legacy patterns
- `initRhythmApp()` — deprecated
- `createStandardElementMap()` — deprecated
- `bindRhythmAppEvents()` — deprecated

## Shared Components Available
Check these before creating anything new:
- **Audio:** audio-init.js, audio.js, audio-schedule.js, audio-toggles.js
- **UI:** fraction-editor.js, timeline-layout.js, template.js, tap-tempo-handler.js
- **Loop:** loop-control.js (3 variants: base, rhythm, pulse-memory)
- **State:** preferences.js, led-manager.js
- **Visual:** visual-sync.js, circular-timeline.js
- **Header/Controls:** libs/shared-ui/ (header, dropdowns, hover, tooltips)
- **Sequencing:** libs/pulse-seq/, libs/matrix-seq/, libs/interval-sequencer/
- **Notation:** libs/notation/
- **Grid:** libs/musical-grid/
- **Random:** libs/random/

## localStorage Convention
- Prefix: `appN:` or `appN::` (use `createPreferenceStorage`)
- Mute: '1' = muted, '0' = unmuted
- Theme: sync with system via `setupThemeSync`

## After Creating
1. Write a CLAUDE.md for the new app (follow existing app CLAUDE.md format)
2. Run `npm test` to ensure nothing is broken
3. Test in browser: `npx http-server` → open `http://localhost:8080/Apps/AppN/`
