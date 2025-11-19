/**
 * dom-utils.js
 * Utilidades DOM con protección XSS mediante DOMPurify
 *
 * Proporciona funciones seguras para manipular el DOM y prevenir vulnerabilidades XSS.
 *
 * IMPORTANTE: Este módulo detecta automáticamente el entorno:
 * - Navegador: Usa DOMPurify global (cargado desde CDN en index.html)
 * - Node.js/Tests: Usa isomorphic-dompurify
 */

// Dynamic import based on environment
let DOMPurify;

if (typeof window !== 'undefined' && window.DOMPurify) {
  // Browser environment - use global DOMPurify from CDN
  DOMPurify = window.DOMPurify;
} else if (typeof global !== 'undefined') {
  // Node.js environment (tests) - use isomorphic-dompurify
  const module = await import('isomorphic-dompurify');
  DOMPurify = module.default;
} else {
  console.error('dom-utils: DOMPurify not available in this environment');
}

/**
 * Configuración de DOMPurify con atributos permitidos
 * Incluye atributos data-* personalizados para apps musicales
 */
const DOMPURIFY_CONFIG = {
  ALLOWED_ATTR: [
    'class',
    'data-note',
    'data-pulse',
    'data-interval',
    'data-intervalIndex',
    'data-soundinterval',    // Para futuras apps de intervalos sonoros
    'data-temporalinterval', // Para futuras apps de intervalos temporales
    'data-is',              // Alias corto para soundinterval
    'data-it'               // Alias corto para temporalinterval
  ]
};

/**
 * Sanitiza HTML utilizando DOMPurify para prevenir XSS
 * @param {string} html - Contenido HTML a sanitizar
 * @param {Object} [config] - Configuración adicional de DOMPurify (opcional)
 * @returns {string} HTML sanitizado
 *
 * @example
 * const clean = sanitizeHTML('<div>Safe content</div>');
 * element.innerHTML = clean;
 *
 * @example
 * // Con configuración personalizada
 * const clean = sanitizeHTML('<div data-custom="value">Test</div>', {
 *   ALLOWED_ATTR: ['class', 'data-custom']
 * });
 */
export function sanitizeHTML(html, config = {}) {
  if (typeof html !== 'string') {
    console.warn('sanitizeHTML: Input must be a string');
    return '';
  }

  // Merge configuración por defecto con configuración personalizada
  const finalConfig = {
    ...DOMPURIFY_CONFIG,
    ...config,
    ALLOWED_ATTR: [
      ...(DOMPURIFY_CONFIG.ALLOWED_ATTR || []),
      ...(config.ALLOWED_ATTR || [])
    ]
  };

  return DOMPurify.sanitize(html, finalConfig);
}

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

/**
 * Crea un elemento DOM de forma segura con contenido sanitizado
 * @param {string} tagName - Nombre de la etiqueta HTML (e.g., 'div', 'span')
 * @param {Object} options - Opciones de configuración
 * @param {string} [options.className] - Clases CSS a aplicar
 * @param {string} [options.html] - Contenido HTML (será sanitizado automáticamente)
 * @param {string} [options.text] - Contenido de texto (no necesita sanitización)
 * @param {Object} [options.attributes] - Atributos adicionales (serán filtrados)
 * @returns {HTMLElement} Elemento creado
 *
 * @example
 * const div = createSafeElement('div', {
 *   className: 'my-class',
 *   text: 'Safe content'
 * });
 *
 * @example
 * const cell = createSafeElement('div', {
 *   className: 'musical-cell',
 *   attributes: { 'data-note': '5', 'data-pulse': '2' }
 * });
 */
export function createSafeElement(tagName, options = {}) {
  if (typeof tagName !== 'string') {
    console.error('createSafeElement: tagName must be a string');
    return null;
  }

  const element = document.createElement(tagName);

  // Aplicar clases
  if (options.className) {
    element.className = options.className;
  }

  // Aplicar contenido de texto (sin sanitización necesaria)
  if (options.text) {
    element.textContent = options.text;
  }

  // Aplicar contenido HTML (con sanitización)
  if (options.html) {
    element.innerHTML = sanitizeHTML(options.html);
  }

  // Aplicar atributos permitidos
  if (options.attributes) {
    const allowedAttrs = DOMPURIFY_CONFIG.ALLOWED_ATTR;
    Object.entries(options.attributes).forEach(([key, value]) => {
      // Solo aplicar atributos permitidos o data-* custom
      if (allowedAttrs.includes(key) || key.startsWith('data-')) {
        element.setAttribute(key, value);
      } else {
        console.warn(`createSafeElement: Attribute '${key}' not allowed`);
      }
    });
  }

  return element;
}

/**
 * Reemplaza el contenido de un elemento con HTML sanitizado
 * @param {HTMLElement} element - Elemento destino
 * @param {string} html - Contenido HTML a insertar
 * @returns {boolean} true si se reemplazó correctamente
 *
 * @example
 * const container = document.getElementById('myContainer');
 * setSafeHTML(container, '<div>New content</div>');
 */
export function setSafeHTML(element, html) {
  if (!element || !(element instanceof HTMLElement)) {
    console.warn('setSafeHTML: Invalid element provided');
    return false;
  }

  element.innerHTML = sanitizeHTML(html);
  return true;
}

/**
 * Obtiene la configuración de DOMPurify utilizada
 * Útil para debugging o extensión
 * @returns {Object} Configuración actual de DOMPurify
 */
export function getDOMPurifyConfig() {
  return {
    ...DOMPURIFY_CONFIG,
    ALLOWED_ATTR: [...(DOMPURIFY_CONFIG.ALLOWED_ATTR || [])]
  };
}
