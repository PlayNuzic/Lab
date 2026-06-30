# interval-overlay

Overlay de **línies i números d'interval** (visual idèntic a App15 / App25B) per a
**qualsevol graella** amb un contenidor posicionat. Desacobla la visualització
melòdica de la implementació concreta de la graella (`musical-grid`,
`plano-modular`…).

## Què dibuixa

Per a cada parella de notes consecutives:
- una **barra vertical** amb **fletxa** al destí (ascendent/descendent) i **punt**
  a l'origen;
- el cas **iS(0)** (uníson): barra curta + el "0" a sobre (sense fletxa ni punt);
- una **caixa** amb el número (delta), amb ancoratge de vora perquè no surti del grid.

Els **silencis** (`isRest`) no dibuixen línia i no trenquen la cadena (la línia va
de la nota anterior a la següent, com App15).

## Geometria

- **Horitzontal en % EXACTE** (`column / totalColumns`) → encaixa amb columnes 1fr
  sense la deriva de `índex × offsetWidth` arrodonit.
- **Vertical en px** via `cellHeight` (línia de divisió d'una nota =
  `(noteCount − note) · cellHeight`).

## Ús

```js
import { createIntervalOverlay } from '../../libs/interval-overlay/index.js';

const overlay = createIntervalOverlay({ matrix }); // matrix = contenidor posicionat
overlay.render(events, {
  totalColumns,            // nombre total de columnes del grid
  noteCount: 12,           // files
  cellHeight,              // px (enter exacte)
  baseNote: 0,             // nota d'origen implícita
  formatValue: (d) => (d > 0 ? `+${d}` : `${d}`),
  showNumbers: true        // false amaga els números però conserva barres/fletxes
});
// events: [{ note, column, isRest? }]
overlay.clear();
```

Cal enllaçar `interval-overlay.css` (classes `iv-overlay`, `iv-bar`, `iv-num`;
color via `--iv-color`).

## Consumidors

- **App32–35** (plano-modular): línies d'interval cromàtic + halters + np-dots.
- App15 / App25B encara tenen la versió INLINE (`createIntervalLine`); poden
  adoptar aquest mòdul més endavant.

## Tests

`libs/interval-overlay/__tests__/interval-overlay.test.js` (jsdom).
