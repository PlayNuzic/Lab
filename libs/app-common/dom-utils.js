/**
 * dom-utils.js
 * Utilidades DOM básicas sin dependencias externas
 *
 * Proporciona funciones seguras para manipular el DOM.
 */

/**
 * Limpia el contenido de un elemento DOM de forma segura
 * Elimina todos los hijos del elemento sin riesgo de XSS
 *
 * IMPORTANTE: Usar en lugar de `element.innerHTML = ''` para mejor rendimiento
 * y prevención de vulnerabilidades.
 *
 * @param {HTMLElement} element - Elemento a limpiar
 * @returns {boolean} true si se limpió correctamente, false si hubo error
 *
 * @example
 * const container = document.getElementById('myContainer');
 * clearElement(container); // Limpia todo el contenido
 *
 * @example
 * // Verificar resultado
 * if (clearElement(container)) {
 *   console.log('Container limpiado');
 * }
 */
export function clearElement(element) {
  if (!element || !(element instanceof HTMLElement)) {
    console.warn('clearElement: Invalid element provided');
    return false;
  }

  // Método más eficiente que innerHTML = ''
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }

  return true;
}
