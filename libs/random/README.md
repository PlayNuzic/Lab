# libs/random

Sistema de randomització per a paràmetres de ritme.

## Fitxers

| Fitxer | Descripció |
|--------|------------|
| `index.js` | Exports unificats |
| `core.js` | `randomize()` base |
| `config.js` | Gestió de configuració |
| `menu.js` | UI de menús random |
| `fractional.js` | Randomització de fraccions |

## Ús

```javascript
import { randomize, DEFAULT_RANGES } from '../../libs/random/index.js';

// Randomitzar un valor
const lg = randomize('Lg'); // Usa DEFAULT_RANGES.Lg

// Amb rang personalitzat
const v = randomize('V', { min: 60, max: 180 });
```

## Ranges per defecte

```javascript
DEFAULT_RANGES = {
  Lg: { min: 2, max: 30 },
  V: { min: 40, max: 320 },
  T: { min: 0.1, max: 10 }
}
```

## UI Menu

```javascript
import { initRandomMenu, mergeRandomConfig } from '../../libs/random/index.js';

initRandomMenu({
  container: menuElement,
  onRandomize: (values) => applyValues(values)
});
```
