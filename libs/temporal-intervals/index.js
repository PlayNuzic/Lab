// index.js
// Barrel export para el módulo temporal-intervals
// App5 "Pulsaciones" - Sistema de intervalos siempre renderizados

// Calculator functions - NEW: calculateAllIntervals siempre retorna Lg intervalos
export {
  calculateAllIntervals,  // NEW: Principal función para App5
  calculateIntervals,     // DEPRECATED: Mantenida por compatibilidad
  getTotalDuration,
  findIntervalAtPosition,
  areConsecutiveSelected
} from './it-calculator.js';

// Renderer - Completamente reescrito para renderizar SIEMPRE todos los intervalos
export { createIntervalRenderer } from './it-renderer.js';

// Re-exportar estilos para importación fácil (no ejecutable, solo referencia)
// Los estilos se deben importar manualmente en el HTML o main CSS de la app
// import '../../libs/temporal-intervals/it-styles.css'; (si se usa un bundler)
// o <link rel="stylesheet" href="../../libs/temporal-intervals/it-styles.css"> en HTML
