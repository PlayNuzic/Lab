// index.js
// Barrel export para el módulo temporal-intervals

export { calculateIntervals, getTotalDuration, findIntervalAtPosition, areConsecutiveSelected } from './it-calculator.js';
export { createIntervalRenderer } from './it-renderer.js';

// Re-exportar estilos para importación fácil (no ejecutable, solo referencia)
// Los estilos se deben importar manualmente en el HTML o main CSS de la app
