// it-renderer.js
// Renderiza bloques de intervalos temporales (iT) - SIEMPRE todos los Lg intervalos

import { calculateAllIntervals } from './it-calculator.js';
import { computeIntervalNumberFontRem } from '../../Apps/App5/utils.js';

/**
 * Crea un renderer de intervalos temporales que SIEMPRE muestra todos los Lg intervalos.
 * Los intervalos son las entidades seleccionables, con estilo basado en el estado de selección.
 *
 * @param {Object} config
 * @param {HTMLElement} config.timeline - Elemento timeline donde renderizar
 * @param {Function} config.getLg - Función que retorna el valor actual de Lg
 * @param {Function} config.isCircular - Función que indica si la timeline es circular
 * @param {Function} config.getSelectedIntervals - Función que retorna Set de números de intervalos seleccionados
 * @param {Function} config.onIntervalClick - Callback cuando se hace click en un intervalo
 * @returns {Object} API del renderer
 */
export function createIntervalRenderer(config = {}) {
  const {
    timeline,
    getLg = () => 0,
    isCircular = () => false,
    getSelectedIntervals = () => new Set(),
    onIntervalClick = null
  } = config;

  if (!timeline) {
    throw new Error('createIntervalRenderer requires a timeline element');
  }

  // Store { interval, element } pairs
  let intervalElements = [];

  /**
   * Limpia todos los bloques de intervalos del DOM
   */
  function clear() {
    intervalElements.forEach(({ element }) => {
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    });
    intervalElements = [];
  }

  /**
   * Crea un bloque de intervalo DOM con número centrado y click handler
   */
  function createIntervalBlock({ interval, isSelected, onClick }) {
    const div = document.createElement('div');
    div.className = 'interval-block';
    div.dataset.intervalNumber = String(interval.number);
    div.dataset.startPulse = String(interval.startPulse);
    div.dataset.endPulse = String(interval.endPulse);

    if (isSelected) {
      div.classList.add('selected');
    }

    // Agregar número centrado con tamaño adaptativo
    const label = document.createElement('span');
    label.className = 'interval-number';
    label.textContent = interval.number;

    // Aplicar tamaño adaptativo basado en Lg
    const lg = getLg();
    const fontRem = computeIntervalNumberFontRem(lg);
    label.style.fontSize = fontRem + 'rem';

    div.appendChild(label);

    // Agregar click handler
    if (onClick) {
      div.addEventListener('click', onClick);
      div.style.cursor = 'pointer';
    }

    // Agregar drag enter handler para drag selection
    div.addEventListener('pointerenter', () => {
      if (onIntervalDragEnter) {
        onIntervalDragEnter(interval.number);
      }
    });

    return div;
  }

  /**
   * Main render function - crea elementos DOM para TODOS los Lg intervalos
   */
  function render() {
    clear();

    const lg = Number(getLg());
    if (!Number.isFinite(lg) || lg <= 0) return;

    const intervals = calculateAllIntervals(lg);
    const selectedSet = getSelectedIntervals ? getSelectedIntervals() : new Set();

    intervals.forEach((interval) => {
      const isSelected = selectedSet.has(interval.number);
      const block = createIntervalBlock({
        interval,
        isSelected,
        onClick: () => {
          if (onIntervalClick) onIntervalClick(interval.number);
        }
      });

      intervalElements.push({ interval, element: block });
      timeline.appendChild(block);
    });

    updatePositions();
  }

  /**
   * Actualiza posiciones de todos los bloques sin recrear DOM
   */
  function updatePositions() {
    const lg = Number(getLg());
    if (!Number.isFinite(lg) || lg <= 0) return;

    const circular = isCircular ? isCircular() : false;

    if (circular) {
      updateCircularPositions(lg);
    } else {
      updateLinearPositions(lg);
    }
  }

  /**
   * Posiciona intervalos en layout linear (encima de la timeline)
   */
  function updateLinearPositions(lg) {
    intervalElements.forEach(({ interval, element }) => {
      // Calcular posición entre startPulse y endPulse
      const startPercent = (interval.startPulse / lg) * 100;
      const endPercent = (interval.endPulse / lg) * 100;
      const centerPercent = (startPercent + endPercent) / 2;
      const widthPercent = endPercent - startPercent;

      // Posicionar centrado horizontalmente, reposando encima de la timeline
      element.style.left = `${centerPercent}%`;
      element.style.top = '50%'; // Alineado con la línea central
      element.style.width = `${widthPercent}%`;
      element.style.transform = 'translateX(-50%) translateY(-100%)'; // -100% = reposa encima
    });
  }

  /**
   * Posiciona intervalos en layout circular (alrededor del círculo)
   */
  function updateCircularPositions(lg) {
    // Obtener dimensiones de la timeline para cálculos circulares
    const rect = timeline.getBoundingClientRect();
    const width = rect.width || 0;
    const height = rect.height || 0;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - 10;

    intervalElements.forEach(({ interval, element }) => {
      // Calcular ángulos para pulsos start y end
      // Offset +PI/2 para empezar arriba (12 o'clock)
      const startAngle = (interval.startPulse / lg) * 2 * Math.PI + Math.PI / 2;
      const endAngle = (interval.endPulse / lg) * 2 * Math.PI + Math.PI / 2;
      const midAngle = (startAngle + endAngle) / 2;

      // Posicionar en el arco, offset hacia afuera del círculo
      const offsetRadius = radius + 20; // 20px fuera del círculo
      const x = cx + offsetRadius * Math.cos(midAngle);
      const y = cy + offsetRadius * Math.sin(midAngle);

      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
      element.style.transform = `translate(-50%, -50%) rotate(${midAngle + Math.PI / 2}rad)`;

      // Calcular ancho aproximado del arco
      const arcLength = Math.abs(endAngle - startAngle) * radius;
      element.style.width = `${Math.max(arcLength, 30)}px`;
    });
  }

  /**
   * Actualiza el estado de selección sin re-render completo
   */
  function updateSelection() {
    const selectedSet = getSelectedIntervals ? getSelectedIntervals() : new Set();

    intervalElements.forEach(({ interval, element }) => {
      if (selectedSet.has(interval.number)) {
        element.classList.add('selected');
      } else {
        element.classList.remove('selected');
      }
    });
  }

  // Placeholder para drag enter handler (será configurado externamente)
  let onIntervalDragEnter = null;

  return {
    render,
    updatePositions,
    updateSelection,
    clear,
    setDragEnterHandler: (handler) => { onIntervalDragEnter = handler; },
    getIntervalElements: () => intervalElements.map(ie => ie.element)
  };
}
