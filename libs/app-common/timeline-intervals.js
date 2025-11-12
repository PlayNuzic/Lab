/**
 * timeline-intervals.js
 * Sistema modular para crear y animar barras de intervalos en líneas temporales
 * Soporta orientación horizontal y vertical para App9 y MusicalMatrix
 *
 * IMPORTANTE: Requiere importar timeline-intervals.css en el HTML de la app
 */

/**
 * Crea barras de intervalos en un contenedor
 * @param {Object} config - Configuración
 * @param {HTMLElement} config.container - Contenedor donde crear las barras
 * @param {number} config.count - Número de intervalos a crear
 * @param {string} [config.orientation='horizontal'] - 'horizontal' o 'vertical'
 * @param {string} [config.cssClass='interval-bar'] - Clase CSS base
 * @returns {Array<HTMLElement>} Array de elementos de barra creados
 */
export function createIntervalBars(config) {
  const {
    container,
    count,
    orientation = 'horizontal',
    cssClass = 'interval-bar'
  } = config;

  if (!container) {
    console.error('createIntervalBars: container es requerido');
    return [];
  }

  const bars = [];
  for (let i = 1; i <= count; i++) {
    const bar = document.createElement('div');
    bar.className = `${cssClass} ${orientation}`;
    bar.dataset.interval = i;
    container.appendChild(bar);
    bars.push(bar);
  }

  return bars;
}

/**
 * Aplica configuración de variables CSS al contenedor de timeline
 * @param {HTMLElement} container - Contenedor de timeline
 * @param {Object} config - Configuración de variables
 * @param {string} [config.intervalColor] - Color de barras y números de intervalos (e.g., '#4A9EFF')
 * @param {string} [config.pulseColor] - Color de pulsos y números de pulsos (e.g., 'currentColor')
 * @param {string} [config.lineColor] - Color de línea temporal (e.g., '#666')
 * @param {string} [config.pulseNumberPosition] - Posición números de pulso: 'above' | 'below' | '10%' | '90%'
 * @param {string} [config.intervalNumberPosition] - Posición números de intervalo: 'above' | 'below' | '0%' | '100%'
 * @param {number|string} [config.pulseSize] - Tamaño de pulsos en px (e.g., 12 o '12px')
 * @param {number|string} [config.intervalBarHeight] - Altura de barras en px (e.g., 5 o '5px')
 * @param {number|string} [config.pulseNumberSize] - Tamaño fuente números de pulso (e.g., 1.8 o '1.8rem')
 * @param {number|string} [config.intervalNumberSize] - Tamaño fuente números de intervalo (e.g., 1.8 o '1.8rem')
 */
export function applyTimelineStyles(container, config = {}) {
  if (!container) return;

  const {
    intervalColor,
    pulseColor,
    lineColor,
    pulseNumberPosition,
    intervalNumberPosition,
    pulseSize,
    intervalBarHeight,
    pulseNumberSize,
    intervalNumberSize
  } = config;

  // Aplicar colores
  if (intervalColor) {
    container.style.setProperty('--timeline-interval-color', intervalColor);
  }
  if (pulseColor) {
    container.style.setProperty('--timeline-pulse-color', pulseColor);
  }
  if (lineColor) {
    container.style.setProperty('--timeline-line-color', lineColor);
  }

  // Aplicar tamaños de elementos
  if (pulseSize !== undefined) {
    const pulseSizeValue = typeof pulseSize === 'number' ? `${pulseSize}px` : pulseSize;
    container.style.setProperty('--timeline-pulse-size', pulseSizeValue);
  }
  if (intervalBarHeight !== undefined) {
    const barHeightValue = typeof intervalBarHeight === 'number' ? `${intervalBarHeight}px` : intervalBarHeight;
    container.style.setProperty('--timeline-interval-bar-height', barHeightValue);
  }

  // Aplicar tamaños de fuente
  if (pulseNumberSize !== undefined) {
    const pulseNumberSizeValue = typeof pulseNumberSize === 'number' ? `${pulseNumberSize}rem` : pulseNumberSize;
    container.style.setProperty('--timeline-pulse-number-size', pulseNumberSizeValue);
  }
  if (intervalNumberSize !== undefined) {
    const intervalNumberSizeValue = typeof intervalNumberSize === 'number' ? `${intervalNumberSize}rem` : intervalNumberSize;
    container.style.setProperty('--timeline-interval-number-size', intervalNumberSizeValue);
  }

  // Aplicar posiciones de números (soporta 'above', 'below', o valores específicos)
  if (pulseNumberPosition) {
    if (pulseNumberPosition === 'above' || pulseNumberPosition === 'below') {
      // Agregar clase utility
      const pulseNumbers = container.querySelectorAll('.pulse-number');
      pulseNumbers.forEach(num => num.classList.add(pulseNumberPosition));
    } else {
      // Aplicar valor directo (e.g., '90%', '10%')
      container.style.setProperty('--timeline-pulse-number-position', pulseNumberPosition);
    }
  }

  if (intervalNumberPosition) {
    if (intervalNumberPosition === 'above' || intervalNumberPosition === 'below') {
      const intervalNumbers = container.querySelectorAll('.interval-number');
      intervalNumbers.forEach(num => num.classList.add(intervalNumberPosition));
    } else {
      container.style.setProperty('--timeline-interval-number-position', intervalNumberPosition);
    }
  }
}

/**
 * Ilumina una barra de intervalo específica
 * @param {HTMLElement} container - Contenedor con las barras
 * @param {number} intervalIndex - Índice del intervalo (1-based)
 * @param {number} [duration=0] - Duración en ms antes de desactivar (0 = manual)
 * @param {string} [cssClass='interval-bar'] - Clase CSS base
 */
export function highlightIntervalBar(container, intervalIndex, duration = 0, cssClass = 'interval-bar') {
  if (!container) return;

  // Support both data-interval (App9) and data-intervalIndex (musical-grid)
  const bar = container.querySelector(
    `.${cssClass}[data-interval="${intervalIndex}"], ` +
    `.${cssClass}[data-intervalIndex="${intervalIndex}"]`
  );
  if (!bar) return;

  bar.classList.add('active');

  if (duration > 0) {
    setTimeout(() => {
      bar.classList.remove('active');
    }, duration);
  }
}

/**
 * Limpia todos los highlights de barras de intervalos
 * @param {HTMLElement} container - Contenedor con las barras
 * @param {string} [cssClass='interval-bar'] - Clase CSS base
 */
export function clearIntervalHighlights(container, cssClass = 'interval-bar') {
  if (!container) return;

  const bars = container.querySelectorAll(`.${cssClass}`);
  bars.forEach(bar => bar.classList.remove('active'));
}

/**
 * Posiciona barras de intervalos en layout horizontal
 * @param {HTMLElement} container - Contenedor con las barras
 * @param {number} totalPulses - Número total de pulsos (e.g., 9 para pulsos 0-8)
 * @param {string} [cssClass='interval-bar'] - Clase CSS base
 */
export function layoutHorizontalIntervalBars(container, totalPulses, cssClass = 'interval-bar') {
  if (!container) return;

  const bars = container.querySelectorAll(`.${cssClass}`);
  const pulseSpacing = 100 / (totalPulses - 1); // % entre pulsos

  bars.forEach(bar => {
    const interval = parseInt(bar.dataset.interval);
    // Intervalo N va entre pulso (N-1) y pulso N
    const startPercent = (interval - 1) * pulseSpacing;
    const widthPercent = pulseSpacing;

    bar.style.left = `${startPercent}%`;
    bar.style.width = `${widthPercent}%`;
  });
}

/**
 * Posiciona barras de intervalos en layout vertical
 * @param {HTMLElement} container - Contenedor con las barras
 * @param {number} totalPulses - Número total de pulsos
 * @param {string} [cssClass='interval-bar'] - Clase CSS base
 */
export function layoutVerticalIntervalBars(container, totalPulses, cssClass = 'interval-bar') {
  if (!container) return;

  const bars = container.querySelectorAll(`.${cssClass}`);
  const pulseSpacing = 100 / (totalPulses - 1); // % entre pulsos

  bars.forEach(bar => {
    const interval = parseInt(bar.dataset.interval);
    // Intervalo N va entre pulso (N-1) y pulso N
    const startPercent = (interval - 1) * pulseSpacing;
    const heightPercent = pulseSpacing;

    bar.style.top = `${startPercent}%`;
    bar.style.height = `${heightPercent}%`;
  });
}
