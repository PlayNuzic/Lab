# libs/pulse-seq

Sistema de seqüències de pulsos amb editor i parser.

## Fitxers

| Fitxer | Descripció |
|--------|------------|
| `index.js` | Exports unificats |
| `pulse-seq.js` | Controllers (estàndard + intervals) |
| `parser.js` | Parser i validació |
| `state.js` | Gestió d'estat |
| `editor.js` | Editor de seqüències |

## Ús

```javascript
import { createPulseSeqController } from '../../libs/pulse-seq/index.js';

const controller = createPulseSeqController({
  inputField: document.getElementById('seqInput'),
  lg: 8,
  onSelectionChange: (selected) => console.log(selected)
});

controller.setSelection([0, 2, 4]);
const selected = controller.getSelection();
```

## Mode Intervals

```javascript
import { createPulseSeqIntervalsController } from '../../libs/pulse-seq/index.js';

const controller = createPulseSeqIntervalsController({
  // Mateixa API però amb markup d'intervals
  markupVariant: 'intervals'
});
```

## Parser

```javascript
import { parseTokens, validateInteger, validateFraction } from '../../libs/pulse-seq/index.js';

const tokens = parseTokens('0 2 4 1/2');
```
