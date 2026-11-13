// libs/app-common/inert-cell.js
// Caselles separadores dels editors de cel·les (les de color entre valors):
// no s'hi pot escriure i tampoc han d'agafar el focus. Si el poden agafar, un
// clic o el Tab s'hi queden, el cursor de text convida a escriure-hi i el que
// s'escriu es perd sense cap avís (test d'usuari P2-02, App14).

/**
 * Cert si l'element és una casella on es pot escriure.
 * @param {Element|null} el
 * @returns {boolean}
 */
function isEditableInput(el) {
  return !!el && el.tagName === 'INPUT' && !el.readOnly && !el.disabled;
}

/**
 * Casella editable veïna d'una separadora: mira només els germans immediats,
 * primer pel costat preferit i després per l'altre.
 * @param {HTMLElement} cell
 * @param {'previous'|'next'} [prefer='previous'] - 'previous' per als editors
 *   [valor][separador] (el separador és del valor d'abans); 'next' per als
 *   [separador][valor] (fila iT en ziga-zaga d'App15).
 * @returns {HTMLInputElement|null}
 */
export function findEditableNeighbour(cell, prefer = 'previous') {
  const prev = cell.previousElementSibling;
  const next = cell.nextElementSibling;
  const order = prefer === 'next' ? [next, prev] : [prev, next];
  return order.find(isEditableInput) ?? null;
}

/**
 * Converteix una casella separadora en inert: només lectura, fora del recorregut
 * del Tab, amb el cursor normal, i un clic hi passa el focus a la casella
 * editable del costat (si no n'hi ha, el focus es queda on era).
 * @param {HTMLInputElement} cell
 * @param {{ prefer?: 'previous'|'next' }} [options]
 * @returns {HTMLInputElement} la mateixa casella, per encadenar
 */
export function makeInertCell(cell, { prefer = 'previous' } = {}) {
  cell.readOnly = true;
  cell.tabIndex = -1;
  cell.style.cursor = 'default';
  cell.addEventListener('mousedown', (e) => {
    // Sense preventDefault el navegador hi posaria el focus igualment.
    e.preventDefault();
    findEditableNeighbour(cell, prefer)?.focus();
  });
  return cell;
}
