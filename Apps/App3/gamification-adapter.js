/**
 * Adaptador de Gamificación para App3 - Fracciones Temporales
 * Conecta los eventos específicos de la aplicación con el sistema de gamificación
 */

import {
  initGamification,
  trackEvent,
  EVENT_TYPES,
  getGamificationManager
} from '../../libs/gamification/index.js';

import {
  setGamificationDispatcher,
  initializeGamificationHooks
} from '../../libs/app-common/template.js';

import { setGamificationHooks } from '../../libs/app-common/audio-init.js';

// Variables de estado
let practiceStartTime = null;
let lastLgValue = null;
let lastVValue = null;
let lastNumerator = null;
let lastDenominator = null;
let fractionsCreated = new Set();

/**
 * Inicializa el sistema de gamificación para App3
 */
export function initApp3Gamification() {
  console.log('Inicializando gamificación para App3...');

  // Inicializar el sistema de gamificación
  const initialized = initGamification('app3');

  if (!initialized) {
    console.log('Gamificación deshabilitada para App3');
    return false;
  }

  // Configurar dispatcher para eventos de UI
  setGamificationDispatcher((eventName, data) => {
    handleUIEvent(eventName, data);
  });

  // Configurar hooks de audio
  setGamificationHooks({
    onPlayStart: handlePlayStart,
    onPlayStop: handlePlayStop
  });

  // Inicializar hooks de UI después de que el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeGamificationHooks();
      setupFractionTracking();
    });
  } else {
    initializeGamificationHooks();
    setupFractionTracking();
  }

  console.log('Gamificación de App3 inicializada correctamente');
  return true;
}

/**
 * Maneja los eventos de UI
 */
function handleUIEvent(eventName, data) {
  switch (eventName) {
    case 'play_clicked':
      // Se trackea en handlePlayStart
      break;

    case 'randomize_used':
      trackEvent(EVENT_TYPES.RANDOMIZATION_USED, {
        app_id: 'app3',
        context: 'fractions',
        ...data
      });
      break;

    case 'loop_toggled':
      if (data.enabled) {
        trackEvent(EVENT_TYPES.LOOP_ACTIVATED, {
          app_id: 'app3',
          ...data
        });
      }
      break;

    case 'parameter_changed':
      handleParameterChange(data);
      break;

    case 'toggle_changed':
      trackEvent(EVENT_TYPES.ADVANCED_FEATURE_USED, {
        app_id: 'app3',
        feature: data.toggle,
        context: 'fraction_display',
        ...data
      });
      break;

    case 'tap_tempo_used':
      trackEvent(EVENT_TYPES.TAP_TEMPO_USED, {
        app_id: 'app3',
        ...data
      });
      break;
  }
}

/**
 * Maneja el inicio de reproducción
 */
function handlePlayStart(audioData) {
  practiceStartTime = Date.now();
  lastLgValue = audioData.totalPulses;
  lastVValue = audioData.intervalSec ? Math.round(60 / audioData.intervalSec) : null;

  trackEvent(EVENT_TYPES.PRACTICE_STARTED, {
    app_id: 'app3',
    lg_value: audioData.totalPulses,
    v_value: lastVValue,
    numerator: lastNumerator,
    denominator: lastDenominator,
    interval_sec: audioData.intervalSec,
    loop_enabled: audioData.loop,
    ...audioData
  });

  // Trackear si hay una fracción compleja
  if (lastNumerator && lastDenominator) {
    const complexity = calculateFractionComplexity(lastNumerator, lastDenominator);
    if (complexity === 'high' || complexity === 'expert') {
      trackEvent(EVENT_TYPES.COMPLEXITY_INCREASED, {
        app_id: 'app3',
        numerator: lastNumerator,
        denominator: lastDenominator,
        complexity: complexity
      });
    }
  }
}

/**
 * Maneja el fin de reproducción
 */
function handlePlayStop(audioData) {
  if (!practiceStartTime) return;

  const duration = Math.floor((Date.now() - practiceStartTime) / 1000);

  trackEvent(EVENT_TYPES.PRACTICE_COMPLETED, {
    app_id: 'app3',
    duration_seconds: duration,
    pulses_played: audioData.pulsesPlayed,
    total_pulses: audioData.totalPulses,
    completion_rate: audioData.totalPulses > 0 ?
      (audioData.pulsesPlayed / audioData.totalPulses) * 100 : 0,
    lg_value: lastLgValue,
    v_value: lastVValue,
    numerator: lastNumerator,
    denominator: lastDenominator,
    ...audioData
  });

  // Milestone de tiempo
  if (duration >= 300) { // 5 minutos
    trackEvent(EVENT_TYPES.PRACTICE_TIME_MILESTONE, {
      app_id: 'app3',
      milestone_minutes: Math.floor(duration / 60),
      duration_seconds: duration
    });
  }

  // Si se reprodujo un patrón con fracción
  if (lastNumerator && lastDenominator) {
    trackEvent(EVENT_TYPES.PATTERN_PLAYED, {
      app_id: 'app3',
      type: 'fraction_pattern',
      numerator: lastNumerator,
      denominator: lastDenominator,
      duration_seconds: duration
    });
  }

  practiceStartTime = null;
}

/**
 * Maneja cambios de parámetros
 */
function handleParameterChange(data) {
  trackEvent(EVENT_TYPES.PARAMETER_CHANGED, {
    app_id: 'app3',
    parameter_name: data.param,
    parameter_value: data.value,
    ...data
  });

  // Trackear cambios específicos
  if (data.param === 'Lg') {
    const newValue = parseInt(data.value);
    if (lastLgValue && newValue > lastLgValue && newValue > 30) {
      trackEvent(EVENT_TYPES.COMPLEXITY_INCREASED, {
        app_id: 'app3',
        parameter: 'Lg',
        old_value: lastLgValue,
        new_value: newValue,
        increase_percentage: ((newValue - lastLgValue) / lastLgValue) * 100
      });
    }
    lastLgValue = newValue;
  }

  if (data.param === 'V') {
    lastVValue = parseInt(data.value);
  }
}

/**
 * Configura el tracking de fracciones
 */
function setupFractionTracking() {
  // Buscar inputs de numerador y denominador
  const numeratorInputs = document.querySelectorAll('input[id*="randN"], input[name*="numerator"]');
  const denominatorInputs = document.querySelectorAll('input[id*="randD"], input[name*="denominator"]');

  // También monitorear el contenedor de fórmula
  const formulaEl = document.getElementById('formula');

  // Función para detectar fracciones
  const checkFraction = () => {
    // Intentar extraer fracción del display
    if (formulaEl) {
      const text = formulaEl.textContent;
      const fractionMatch = text.match(/(\d+)\s*\/\s*(\d+)/);
      if (fractionMatch) {
        const num = parseInt(fractionMatch[1]);
        const den = parseInt(fractionMatch[2]);
        trackFractionCreation(num, den);
      }
    }
  };

  // Observar cambios en la fórmula
  if (formulaEl) {
    const observer = new MutationObserver(checkFraction);
    observer.observe(formulaEl, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  // Monitorear inputs directos
  numeratorInputs.forEach(input => {
    input.addEventListener('change', (e) => {
      const num = parseInt(e.target.value);
      if (num && lastDenominator) {
        trackFractionCreation(num, lastDenominator);
      }
      lastNumerator = num;
    });
  });

  denominatorInputs.forEach(input => {
    input.addEventListener('change', (e) => {
      const den = parseInt(e.target.value);
      if (den && lastNumerator) {
        trackFractionCreation(lastNumerator, den);
      }
      lastDenominator = den;
    });
  });

  // Monitorear cambios en controles de aleatorización de fracciones
  const randNToggle = document.getElementById('randNToggle');
  const randDToggle = document.getElementById('randDToggle');

  [randNToggle, randDToggle].forEach(toggle => {
    if (toggle) {
      toggle.addEventListener('change', (e) => {
        if (e.target.checked) {
          trackEvent(EVENT_TYPES.RANDOMIZATION_USED, {
            app_id: 'app3',
            randomized: e.target.id.includes('N') ? 'numerator' : 'denominator'
          });
        }
      });
    }
  });
}

/**
 * Trackea la creación de una fracción
 */
function trackFractionCreation(numerator, denominator) {
  if (!numerator || !denominator || denominator === 0) return;

  const fractionKey = `${numerator}/${denominator}`;

  // Solo trackear fracciones nuevas
  if (!fractionsCreated.has(fractionKey)) {
    fractionsCreated.add(fractionKey);

    trackEvent(EVENT_TYPES.FRACTION_CREATED, {
      app_id: 'app3',
      numerator: numerator,
      denominator: denominator,
      fraction: fractionKey,
      decimal_value: numerator / denominator,
      complexity: calculateFractionComplexity(numerator, denominator),
      unique_fractions_count: fractionsCreated.size
    });

    // Si es una fracción particularmente compleja
    if (numerator > 7 || denominator > 16) {
      trackEvent(EVENT_TYPES.COMPLEXITY_INCREASED, {
        app_id: 'app3',
        type: 'complex_fraction',
        numerator: numerator,
        denominator: denominator
      });
    }
  }

  lastNumerator = numerator;
  lastDenominator = denominator;
}

/**
 * Calcula la complejidad de una fracción
 */
function calculateFractionComplexity(numerator, denominator) {
  const complexity = Math.max(numerator, denominator);

  if (complexity <= 4) return 'low';
  if (complexity <= 8) return 'medium';
  if (complexity <= 16) return 'high';
  return 'expert';
}

/**
 * Obtiene estadísticas de la sesión actual
 */
export function getApp3Stats() {
  const manager = getGamificationManager();
  const stats = manager.getStats();

  // Añadir estadísticas específicas de App3
  return {
    ...stats,
    app_specific: {
      unique_fractions: fractionsCreated.size,
      last_fraction: lastNumerator && lastDenominator ?
        `${lastNumerator}/${lastDenominator}` : null
    }
  };
}

/**
 * Obtiene el progreso de logros
 */
export function getApp3Achievements() {
  const manager = getGamificationManager();
  return manager.getAchievements();
}

// Exportar para debugging
if (typeof window !== 'undefined' && window.GAMIFICATION_DEBUG) {
  window.__APP3_GAMIFICATION = {
    getStats: getApp3Stats,
    getAchievements: getApp3Achievements,
    fractionsCreated: Array.from(fractionsCreated),
    lastFraction: lastNumerator && lastDenominator ?
      `${lastNumerator}/${lastDenominator}` : null
  };
}