/**
 * Adaptador de Gamificación para App2 - Sucesión de Pulsos
 * Conecta los eventos específicos de la aplicación con el sistema de gamificación
 */

import {
  initGamification,
  trackEvent,
  trackAppAction,
  EVENT_TYPES,
  getGamificationManager
} from '../../libs/gamification/index.js';

import {
  setGamificationDispatcher,
  initializeGamificationHooks
} from '../../libs/app-common/template.js';

import { setGamificationHooks } from '../../libs/app-common/audio-init.js';

// Variable para tracking del inicio de práctica
let practiceStartTime = null;
let lastLgValue = null;
let lastVValue = null;

/**
 * Inicializa el sistema de gamificación para App2
 */
export function initApp2Gamification() {
  console.log('Inicializando gamificación para App2...');

  // Inicializar el sistema de gamificación
  const initialized = initGamification('app2');

  if (!initialized) {
    console.log('Gamificación deshabilitada para App2');
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
    });
  } else {
    initializeGamificationHooks();
  }

  // Agregar listener para tap tempo preciso
  setupTapTempoTracking();

  // Agregar listener para selección de pulsos
  setupPulseSelectionTracking();

  console.log('Gamificación de App2 inicializada correctamente');
  return true;
}

/**
 * Maneja los eventos de UI
 */
function handleUIEvent(eventName, data) {
  switch (eventName) {
    case 'play_clicked':
      // Se trackea en handlePlayStart cuando realmente empieza
      break;

    case 'randomize_used':
      trackEvent(EVENT_TYPES.RANDOMIZATION_USED, {
        app_id: 'app2',
        ...data
      });
      break;

    case 'loop_toggled':
      if (data.enabled) {
        trackEvent(EVENT_TYPES.LOOP_ACTIVATED, {
          app_id: 'app2',
          ...data
        });
      }
      break;

    case 'tap_tempo_used':
      // Se trackea en setupTapTempoTracking con más detalle
      break;

    case 'parameter_changed':
      handleParameterChange(data);
      break;

    case 'toggle_changed':
      trackEvent(EVENT_TYPES.ADVANCED_FEATURE_USED, {
        app_id: 'app2',
        feature: data.toggle,
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
    app_id: 'app2',
    lg_value: audioData.totalPulses,
    v_value: lastVValue,
    interval_sec: audioData.intervalSec,
    selected_count: audioData.selectedCount,
    loop_enabled: audioData.loop,
    ...audioData
  });

  // Trackear patrón creado si hay pulsos seleccionados
  if (audioData.selectedCount > 0) {
    trackEvent(EVENT_TYPES.PULSE_PATTERN_CREATED, {
      app_id: 'app2',
      pattern_length: audioData.totalPulses,
      selected_pulses: audioData.selectedCount,
      complexity: calculateComplexity(audioData.totalPulses, audioData.selectedCount)
    });
  }
}

/**
 * Maneja el fin de reproducción
 */
function handlePlayStop(audioData) {
  if (!practiceStartTime) return;

  const duration = Math.floor((Date.now() - practiceStartTime) / 1000);

  trackEvent(EVENT_TYPES.PRACTICE_COMPLETED, {
    app_id: 'app2',
    duration_seconds: duration,
    pulses_played: audioData.pulsesPlayed,
    total_pulses: audioData.totalPulses,
    completion_rate: audioData.totalPulses > 0 ?
      (audioData.pulsesPlayed / audioData.totalPulses) * 100 : 0,
    lg_value: lastLgValue,
    v_value: lastVValue,
    ...audioData
  });

  // Si se completó una sesión larga, trackear milestone
  if (duration >= 300) { // 5 minutos
    trackEvent(EVENT_TYPES.PRACTICE_TIME_MILESTONE, {
      app_id: 'app2',
      milestone_minutes: Math.floor(duration / 60),
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
    app_id: 'app2',
    parameter_name: data.param,
    parameter_value: data.value,
    ...data
  });

  // Si se aumenta significativamente Lg, trackear aumento de complejidad
  if (data.param === 'Lg' && lastLgValue) {
    const newValue = parseInt(data.value);
    if (newValue > lastLgValue && newValue > 30) {
      trackEvent(EVENT_TYPES.COMPLEXITY_INCREASED, {
        app_id: 'app2',
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
 * Configura el tracking de tap tempo
 */
function setupTapTempoTracking() {
  let tapTimes = [];
  const TAP_WINDOW_MS = 2000;

  document.addEventListener('click', (e) => {
    if (e.target.id === 'tapTempoBtn' || e.target.closest('#tapTempoBtn')) {
      const now = Date.now();

      // Limpiar taps antiguos
      tapTimes = tapTimes.filter(t => now - t < TAP_WINDOW_MS);
      tapTimes.push(now);

      trackEvent(EVENT_TYPES.TAP_TEMPO_USED, {
        app_id: 'app2',
        tap_count: tapTimes.length
      });

      // Si hay suficientes taps, calcular precisión
      if (tapTimes.length >= 3) {
        const intervals = [];
        for (let i = 1; i < tapTimes.length; i++) {
          intervals.push(tapTimes[i] - tapTimes[i-1]);
        }

        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((sum, int) => sum + Math.pow(int - avgInterval, 2), 0) / intervals.length;
        const stdDev = Math.sqrt(variance);
        const precision = 100 - Math.min(100, (stdDev / avgInterval) * 100);

        if (precision > 85) {
          trackEvent(EVENT_TYPES.TAP_TEMPO_ACCURATE, {
            app_id: 'app2',
            precision_percentage: Math.round(precision),
            tap_count: tapTimes.length,
            calculated_bpm: Math.round(60000 / avgInterval)
          });
        }
      }
    }
  });
}

/**
 * Configura el tracking de selección de pulsos
 */
function setupPulseSelectionTracking() {
  // Observar cambios en el contenedor de pulsos
  const pulseSeq = document.getElementById('pulseSeq');
  if (!pulseSeq) return;

  let lastSelectedCount = 0;

  const checkSelectedPulses = () => {
    const selected = pulseSeq.querySelectorAll('.pulse.selected').length;
    const total = pulseSeq.querySelectorAll('.pulse').length;

    if (selected > lastSelectedCount && selected > 0) {
      trackEvent(EVENT_TYPES.PULSE_PATTERN_CREATED, {
        app_id: 'app2',
        selected_pulses: selected,
        total_pulses: total,
        selection_percentage: (selected / total) * 100,
        complexity: calculateComplexity(total, selected)
      });
    }

    lastSelectedCount = selected;
  };

  // Usar MutationObserver para detectar cambios
  const observer = new MutationObserver(checkSelectedPulses);
  observer.observe(pulseSeq, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });

  // También escuchar clicks en los pulsos
  pulseSeq.addEventListener('click', (e) => {
    if (e.target.classList.contains('pulse')) {
      setTimeout(checkSelectedPulses, 10);
    }
  });
}

/**
 * Calcula la complejidad de un patrón
 */
function calculateComplexity(total, selected) {
  if (total === 0) return 'low';

  const ratio = selected / total;
  const complexity = total * (0.5 + ratio * 0.5);

  if (complexity < 10) return 'low';
  if (complexity < 30) return 'medium';
  if (complexity < 50) return 'high';
  return 'expert';
}

/**
 * Obtiene estadísticas de la sesión actual
 */
export function getApp2Stats() {
  const manager = getGamificationManager();
  return manager.getStats();
}

/**
 * Obtiene el progreso de logros
 */
export function getApp2Achievements() {
  const manager = getGamificationManager();
  return manager.getAchievements();
}

// Exportar para debugging si está habilitado
if (typeof window !== 'undefined' && window.GAMIFICATION_DEBUG) {
  window.__APP2_GAMIFICATION = {
    getStats: getApp2Stats,
    getAchievements: getApp2Achievements,
    practiceStartTime,
    lastLgValue,
    lastVValue
  };
}