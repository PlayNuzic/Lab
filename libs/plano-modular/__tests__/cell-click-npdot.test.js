/**
 * @jest-environment jsdom
 */
import { createApp19Grid } from '../index.js';

// Regressió App20: en clicar el np-dot (no arrossegar) per crear una nota
// d'iT=1, el drag handler la crea i la selecciona; el click natiu bombollava a
// la cel·la i el toggle intern la desseleccionava (el rectangle només apareixia
// a la següent interacció). El grid ara ignora els clicks originats en un np-dot.
describe('cell click amb np-dot (App19/App20 grid)', () => {
  let container, grid;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    grid = createApp19Grid({ parent: container, columns: 8, cycleConfig: { compas: 4 } });
  });
  afterEach(() => { grid?.destroy(); document.body.innerHTML = ''; });

  const cellSel = (rowId, col) => container.querySelector(
    `.plano-cell[data-row-id="${rowId}"][data-col-index="${col}"]`
  );

  test('click sobre el np-dot NO togglea la selecció (la deixa el drag handler)', () => {
    const cell = cellSel('5r4', 2);
    // El drag handler acaba de crear la nota → seleccionada via loadSelection
    grid.loadSelection(['5r4-2']);
    expect(cell.classList.contains('plano-selected')).toBe(true);

    // Simulem el dot que afegeix el sync controller + el click natiu que bombolla
    const dot = document.createElement('div');
    dot.className = 'np-dot np-dot-clickable';
    cell.appendChild(dot);
    dot.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

    // ABANS del fix: el toggle intern la desseleccionava (rectangle desapareixia)
    expect(cell.classList.contains('plano-selected')).toBe(true);
  });

  test('click al cos de la cel·la (fora del dot) SÍ togglea (comportament normal)', () => {
    const cell = cellSel('5r4', 2);
    expect(cell.classList.contains('plano-selected')).toBe(false);
    cell.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(cell.classList.contains('plano-selected')).toBe(true); // toggle ON
  });
});
