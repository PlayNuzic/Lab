/**
 * Adaptador de Gamificación para App4 - Pulsos Fraccionados
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
let pulsePatternsCreated = new Set();
let cycleActivated = false;
let subdivisionActivated = false;

/**
 * Inicializa el sistema de gamificación para App4
 */
export function initApp4Gamification() {
  console.log('Inicializando gamificación para App4...');

  // Inicializar el sistema de gamificación
  const initialized = initGamification('app4');

  if (!initialized) {
    console.log('Gamificación deshabilitada para App4');
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
      setupAdvancedFeatureTracking();
      setupPulsePatternTracking();
    });
  } else {
    initializeGamificationHooks();
    setupAdvancedFeatureTracking();
    setupPulsePatternTracking();
  }

  console.log('Gamificación de App4 inicializada correctamente');
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
        app_id: 'app4',
        context: 'fractioned_pulses',
        ...data
      });
      break;

    case 'loop_toggled':
      if (data.enabled) {
        trackEvent(EVENT_TYPES.LOOP_ACTIVATED, {
          app_id: 'app4',
          with_fraction: lastNumerator && lastDenominator,
          ...data
        });
      }
      break;

    case 'parameter_changed':
      handleParameterChange(data);
      break;

    case 'toggle_changed':
      handleToggleChange(data);
      break;

    case 'tap_tempo_used':
      trackEvent(EVENT_TYPES.TAP_TEMPO_USED, {
        app_id: 'app4',
        with_subdivision: subdivisionActivated,
        ...data
      });
      break;
  }
}

/**
 * Maneja cambios en toggles específicos
 */
function handleToggleChange(data) {
  // Detectar activación de ciclo/subdivisión
  if (data.toggle === 'cycleToggleBtn') {
    cycleActivated = data.enabled;

    if (data.enabled) {
      trackEvent(EVENT_TYPES.ADVANCED_FEATURE_USED, {
        app_id: 'app4',
        feature: 'cycle_mode',
        with_fraction: lastNumerator && lastDenominator,
        ...data
      });
    }
  } else if (data.toggle === 'pulseToggleBtn' || data.toggle === 'selectedToggleBtn') {
    subdivisionActivated = data.enabled;

    trackEvent(EVENT_TYPES.ADVANCED_FEATURE_USED, {
      app_id: 'app4',
      feature: 'subdivision_toggle',
      type: data.toggle,
      ...data
    });
  } else {
    trackEvent(EVENT_TYPES.ADVANCED_FEATURE_USED, {
      app_id: 'app4',
      feature: data.toggle,
      ...data
    });
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
    app_id: 'app4',
    lg_value: audioData.totalPulses,
    v_value: lastVValue,
    numerator: lastNumerator,
    denominator: lastDenominator,
    cycle_enabled: cycleActivated,
    subdivision_enabled: subdivisionActivated,
    interval_sec: audioData.intervalSec,
    loop_enabled: audioData.loop,
    selected_count: audioData.selectedCount,
    ...audioData
  });

  // Calcular complejidad del patrón fraccionado
  const complexity = calculatePatternComplexity();

  if (complexity === 'high' || complexity === 'expert') {
    trackEvent(EVENT_TYPES.COMPLEXITY_INCREASED, {
      app_id: 'app4',
      lg_value: lastLgValue,
      numerator: lastNumerator,
      denominator: lastDenominator,
      complexity: complexity,
      with_cycle: cycleActivated,
      with_subdivision: subdivisionActivated
    });
  }

  // Trackear patrón con pulsos fraccionados
  if (lastNumerator && lastDenominator && audioData.selectedCount > 0) {
    const patternKey = `${lastLgValue}:${lastNumerator}/${lastDenominator}:${audioData.selectedCount}`;

    if (!pulsePatternsCreated.has(patternKey)) {
      pulsePatternsCreated.add(patternKey);

      trackEvent(EVENT_TYPES.PULSE_PATTERN_CREATED, {
        app_id: 'app4',
        pattern_type: 'fractioned',
        lg_value: lastLgValue,
        numerator: lastNumerator,
        denominator: lastDenominator,
        selected_pulses: audioData.selectedCount,
        unique_patterns: pulsePatternsCreated.size,
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
    app_id: 'app4',
    duration_seconds: duration,
    pulses_played: audioData.pulsesPlayed,
    total_pulses: audioData.totalPulses,
    completion_rate: audioData.totalPulses > 0 ?
      (audioData.pulsesPlayed / audioData.totalPulses) * 100 : 0,
    lg_value: lastLgValue,
    v_value: lastVValue,
    numerator: lastNumerator,
    denominator: lastDenominator,
    cycle_enabled: cycleActivated,
    subdivision_enabled: subdivisionActivated,
    ...audioData
  });

  // Milestone de tiempo
  if (duration >= 300) { // 5 minutos
    trackEvent(EVENT_TYPES.PRACTICE_TIME_MILESTONE, {
      app_id: 'app4',
      milestone_minutes: Math.floor(duration / 60),
      duration_seconds: duration,
      with_advanced_features: cycleActivated || subdivisionActivated
    });
  }

  // Trackear patrón dominado si se completó con alta precisión
  if (audioData.pulsesPlayed === audioData.totalPulses && duration > 30) {
    trackEvent(EVENT_TYPES.PATTERN_MASTERED, {
      app_id: 'app4',
      pattern_type: 'fractioned_pulses',
      lg_value: lastLgValue,
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
    app_id: 'app4',
    parameter_name: data.param,
    parameter_value: data.value,
    ...data
  });

  if (data.param === 'Lg') {
    const newValue = parseInt(data.value);
    if (lastLgValue && newValue > lastLgValue && newValue > 30) {
      trackEvent(EVENT_TYPES.COMPLEXITY_INCREASED, {
        app_id: 'app4',
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
 * Configura el tracking de características avanzadas
 */
function setupAdvancedFeatureTracking() {
  // Monitorear cambios en inputs de fracción inline
  const fractionSlot = document.getElementById('fractionInlineSlot');

  if (fractionSlot) {
    const observer = new MutationObserver(() => {
      checkInlineFraction();
    });

    observer.observe(fractionSlot, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  // Monitorear inputs de numerador y denominador
  document.addEventListener('change', (e) => {
    if (e.target.matches('input[id*="randN"], input[name*="numerator"]')) {
      const num = parseInt(e.target.value);
      if (num) {
        lastNumerator = num;
        trackFractionChange(num, lastDenominator);
      }
    }

    if (e.target.matches('input[id*="randD"], input[name*="denominator"]')) {
      const den = parseInt(e.target.value);
      if (den) {
        lastDenominator = den;
        trackFractionChange(lastNumerator, den);
      }
    }
  });
}

/**
 * Verifica fracciones inline
 */
function checkInlineFraction() {
  const fractionSlot = document.getElementById('fractionInlineSlot');
  if (!fractionSlot) return;

  const text = fractionSlot.textContent;
  const match = text.match(/(\d+)\s*\/\s*(\d+)/);

  if (match) {
    const num = parseInt(match[1]);
    const den = parseInt(match[2]);
    trackFractionChange(num, den);
  }
}

/**
 * Trackea cambios en fracciones
 */
function trackFractionChange(numerator, denominator) {
  if (!numerator || !denominator || denominator === 0) return;

  lastNumerator = numerator;
  lastDenominator = denominator;

  // Trackear creación de fracción compleja
  if (numerator > 5 || denominator > 8) {
    trackEvent(EVENT_TYPES.FRACTION_CREATED, {
      app_id: 'app4',
      numerator: numerator,
      denominator: denominator,
      fraction: `${numerator}/${denominator}`,
      complexity: calculateFractionComplexity(numerator, denominator),
      context: 'fractioned_pulses'
    });
  }
}

/**
 * Configura el tracking de patrones de pulsos
 */
function setupPulsePatternTracking() {
  const pulseSeq = document.getElementById('pulseSeq');
  if (!pulseSeq) return;

  let lastPattern = '';

  const checkPattern = () => {
    const pulses = Array.from(pulseSeq.querySelectorAll('.pulse'));
    const pattern = pulses.map(p => p.classList.contains('selected') ? '1' : '0').join('');

    if (pattern !== lastPattern && pattern.includes('1')) {
      const selectedCount = (pattern.match(/1/g) || []).length;

      trackEvent(EVENT_TYPES.PULSE_PATTERN_CREATED, {
        app_id: 'app4',
        pattern: pattern,
        total_pulses: pulses.length,
        selected_pulses: selectedCount,
        density: selectedCount / pulses.length,
        with_fraction: lastNumerator && lastDenominator,
        with_cycle: cycleActivated
      });

      lastPattern = pattern;
    }
  };

  // Observar cambios
  const observer = new MutationObserver(checkPattern);
  observer.observe(pulseSeq, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });

  // Clicks en pulsos
  pulseSeq.addEventListener('click', (e) => {
    if (e.target.classList.contains('pulse')) {
      setTimeout(checkPattern, 10);
    }
  });
}

/**
 * Calcula la complejidad del patrón fraccionado
 */
function calculateFractionComplexity(numerator, denominator) {
  const complexity = Math.max(numerator || 1, denominator || 1);

  if (complexity <= 4) return 'low';
  if (complexity <= 8) return 'medium';
  if (complexity <= 12) return 'high';
  return 'expert';
}

/**
 * Calcula la complejidad general del patrón
 */
function calculatePatternComplexity() {
  let score = 0;

  // Complejidad base por Lg
  if (lastLgValue) {
    if (lastLgValue > 50) score += 40;
    else if (lastLgValue > 30) score += 30;
    else if (lastLgValue > 15) score += 20;
    else score += 10;
  }

  // Complejidad por fracción
  if (lastNumerator && lastDenominator) {
    const fractionComplexity = Math.max(lastNumerator, lastDenominator);
    if (fractionComplexity > 12) score += 30;
    else if (fractionComplexity > 8) score += 20;
    else if (fractionComplexity > 4) score += 10;
  }

  // Bonus por características avanzadas
  if (cycleActivated) score += 15;
  if (subdivisionActivated) score += 15;

  if (score >= 70) return 'expert';
  if (score >= 50) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

/**
 * Obtiene estadísticas de la sesión actual
 */
export function getApp4Stats() {
  const manager = getGamificationManager();
  const stats = manager.getStats();

  return {
    ...stats,
    app_specific: {
      unique_patterns: pulsePatternsCreated.size,
      last_fraction: lastNumerator && lastDenominator ?
        `${lastNumerator}/${lastDenominator}` : null,
      cycle_active: cycleActivated,
      subdivision_active: subdivisionActivated
    }
  };
}

/**
 * Obtiene el progreso de logros
 */
export function getApp4Achievements() {
  const manager = getGamificationManager();
  return manager.getAchievements();
}

// Exportar para debugging
if (typeof window !== 'undefined' && window.GAMIFICATION_DEBUG) {
  window.__APP4_GAMIFICATION = {
    getStats: getApp4Stats,
    getAchievements: getApp4Achievements,
    patternsCreated: Array.from(pulsePatternsCreated),
    lastFraction: lastNumerator && lastDenominator ?
      `${lastNumerator}/${lastDenominator}` : null,
    cycleActivated,
    subdivisionActivated
  };
}