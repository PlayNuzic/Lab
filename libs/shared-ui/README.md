# libs/shared-ui

Components UI compartits entre apps.

## Fitxers

| Fitxer | Descripció |
|--------|------------|
| `header.js` | Header amb controls d'àudio |
| `sound-dropdown.js` | Selector de sons + P1 Toggle |
| `hover.js` | Efectes hover |
| `index.css` | Estils base |
| `three-column-layout.css` | Layout 3 columnes (Apps 11-12) |

## Header

```javascript
import { initHeader } from '../../libs/shared-ui/header.js';

initHeader({
  title: 'App Title',
  audioControls: true,
  onMuteToggle: (muted) => audio.setMute(muted)
});
```

## Sound Dropdown

```javascript
import { initSoundDropdown, initP1ToggleUI } from '../../libs/shared-ui/sound-dropdown.js';

initSoundDropdown({
  container: dropdownElement,
  onSoundChange: (soundId) => audio.setSound(soundId)
});

// P1 Toggle (so addicional al primer puls)
initP1ToggleUI({
  checkbox: p1Checkbox,
  onChange: (enabled) => audio.setStartEnabled(enabled)
});
```

## CSS Variables

```css
:root {
  --col-left: 150px;
  --col-right: 150px;
  --layout-gap: 2rem;
}
```
