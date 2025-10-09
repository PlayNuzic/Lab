// it-renderer.js
// Renderiza bloques de intervalos temporales (iT) sobre la timeline

import { calculateIntervals } from './it-calculator.js';

/**
 * Crea un renderer de intervalos temporales para una timeline
 * @param {Object} config
 * @param {HTMLElement} config.timeline - Elemento timeline donde renderizar
 * @param {Function} config.getSelectedPulses - Función que retorna Set de pulsos seleccionados
 * @param {Function} config.getLg - Función que retorna la longitud actual
 * @param {Function} config.isCircular - Función que indica si la timeline es circular
 * @returns {Object} API del renderer
 */
export function createIntervalRenderer(config = {}) {
  const {
    timeline,
    getSelectedPulses = () => new Set(),
    getLg = () => 0,
    isCircular = () => false
  } = config;

  if (!timeline) {
    throw new Error('createIntervalRenderer requires a timeline element');
  }

  let intervalBlocks = [];

  /**
   * Limpia todos los bloques de intervalos del DOM
   */
  function clearIntervals() {
    intervalBlocks.forEach(block => {
      if (block && block.parentNode) {
        block.parentNode.removeChild(block);
      }
    });
    intervalBlocks = [];
  }

  /**
   * Crea un bloque de intervalo DOM
   */
  function createIntervalBlock(interval, index) {
    const block = document.createElement('div');
    block.className = 'interval-block';
    block.dataset.intervalIndex = String(index);
    block.dataset.start = String(interval.start);
    block.dataset.end = String(interval.end);
    block.dataset.duration = String(interval.duration);
    return block;
  }

  /**
   * Posiciona un bloque en modo linear
   */
  function positionLinearBlock(block, interval, lg) {
    if (!Number.isFinite(lg) || lg <= 0) return;

    const startPercent = (interval.start / lg) * 100;
    const endPercent = (interval.end / lg) * 100;
    const widthPercent = endPercent - startPercent;

    block.style.left = `${startPercent}%`;
    block.style.width = `${widthPercent}%`;
    block.style.top = '50%';
    block.style.height = '8px';
    block.style.transform = 'translate(0, -50%)';
  }

  /**
   * Posiciona un bloque en modo circular
   */
  function positionCircularBlock(block, interval, lg, rect) {
    if (!Number.isFinite(lg) || lg <= 0) return;
    if (!rect) return;

    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const radius = Math.min(rect.width, rect.height) / 2 - 10;

    const startAngle = (interval.start / lg) * 2 * Math.PI + Math.PI / 2;
    const endAngle = (interval.end / lg) * 2 * Math.PI + Math.PI / 2;

    const startX = cx + radius * Math.cos(startAngle);
    const startY = cy + radius * Math.sin(startAngle);
    const endX = cx + radius * Math.cos(endAngle);
    const endY = cy + radius * Math.sin(endAngle);

    // Calcular el punto medio del arco
    const midAngle = (startAngle + endAngle) / 2;
    const midX = cx + radius * Math.cos(midAngle);
    const midY = cy + radius * Math.sin(midAngle);

    // Posicionar el bloque en el punto medio
    block.style.left = `${midX}px`;
    block.style.top = `${midY}px`;

    // Calcular la longitud del arco
    const arcLength = radius * Math.abs(endAngle - startAngle);
    block.style.width = `${Math.max(arcLength, 20)}px`;
    block.style.height = '8px';

    // Rotar el bloque para seguir el arco
    const rotation = midAngle + Math.PI / 2;
    block.style.transform = `translate(-50%, -50%) rotate(${rotation}rad)`;
  }

  /**
   * Renderiza todos los intervalos
   */
  function render() {
    clearIntervals();

    const selectedPulses = getSelectedPulses();
    const lg = getLg();

    if (!selectedPulses || selectedPulses.size === 0) return;
    if (!Number.isFinite(lg) || lg <= 0) return;

    const intervals = calculateIntervals(selectedPulses, lg);
    if (intervals.length === 0) return;

    const circular = isCircular();
    const rect = circular ? timeline.getBoundingClientRect() : null;

    intervals.forEach((interval, index) => {
      const block = createIntervalBlock(interval, index);

      if (circular) {
        positionCircularBlock(block, interval, lg, rect);
      } else {
        positionLinearBlock(block, interval, lg);
      }

      timeline.appendChild(block);
      intervalBlocks.push(block);
    });
  }

  /**
   * Actualiza las posiciones de los bloques existentes (sin recrear DOM)
   */
  function updatePositions() {
    const lg = getLg();
    const circular = isCircular();
    const rect = circular ? timeline.getBoundingClientRect() : null;

    intervalBlocks.forEach(block => {
      const start = Number(block.dataset.start);
      const end = Number(block.dataset.end);
      const duration = Number(block.dataset.duration);

      if (!Number.isFinite(start) || !Number.isFinite(end)) return;

      const interval = { start, end, duration };

      if (circular) {
        positionCircularBlock(block, interval, lg, rect);
      } else {
        positionLinearBlock(block, interval, lg);
      }
    });
  }

  return {
    render,
    updatePositions,
    clearIntervals,
    getIntervalBlocks: () => intervalBlocks.slice()
  };
}
