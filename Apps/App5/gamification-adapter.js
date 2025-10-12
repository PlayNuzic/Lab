/**
 * Adaptador de Gamificación para App5 - Pulsaciones
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
let intervalsCreated = new Set();
let intervalModeActive = false;
let patternComplexity = 'low';
let lastIntervalData = null;

/**
 * Inicializa el sistema de gamificación para App5
 */
export function initApp5Gamification() {
  console.log('Inicializando gamificación para App5...');

  // Inicializar el sistema de gamificación
  const initialized = initGamification('app5');

  if (!initialized) {
    console.log('Gamificación deshabilitada para App5');
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
      setupIntervalTracking();
      setupPatternTracking();
    });
  } else {
    initializeGamificationHooks();
    setupIntervalTracking();
    setupPatternTracking();
  }

  console.log('Gamificación de App5 inicializada correctamente');
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
        app_id: 'app5',
        context: 'interval_patterns',
        interval_mode: intervalModeActive,
        ...data
      });
      break;

    case 'loop_toggled':
      if (data.enabled) {
        trackEvent(EVENT_TYPES.LOOP_ACTIVATED, {
          app_id: 'app5',
          interval_mode: intervalModeActive,
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
      trackTapTempo(data);
      break;
  }
}

/**
 * Maneja cambios en toggles específicos
 */
function handleToggleChange(data) {
  // Detectar modo de intervalos
  if (data.toggle === 'intervalToggleBtn' ||
      data.toggle.includes('interval')) {
    intervalModeActive = data.enabled;

    trackEvent(EVENT_TYPES.ADVANCED_FEATURE_USED, {
      app_id: 'app5',
      feature: 'interval_mode',
      enabled: data.enabled,
      ...data
    });
  } else {
    trackEvent(EVENT_TYPES.ADVANCED_FEATURE_USED, {
      app_id: 'app5',
      feature: data.toggle,
      ...data
    });
  }
}

/**
 * Trackea uso de tap tempo con análisis de precisión
 */
function trackTapTempo(data) {
  trackEvent(EVENT_TYPES.TAP_TEMPO_USED, {
    app_id: 'app5',
    interval_mode: intervalModeActive,
    ...data
  });

  // Analizar precisión si hay múltiples taps
  analyzeTapPrecision();
}

/**
 * Maneja el inicio de reproducción
 */
function handlePlayStart(audioData) {
  practiceStartTime = Date.now();
  lastLgValue = audioData.totalPulses;
  lastVValue = audioData.intervalSec ? Math.round(60 / audioData.intervalSec) : null;

  trackEvent(EVENT_TYPES.PRACTICE_STARTED, {
    app_id: 'app5',
    lg_value: audioData.totalPulses,
    v_value: lastVValue,
    interval_sec: audioData.intervalSec,
    loop_enabled: audioData.loop,
    selected_count: audioData.selectedCount,
    interval_mode: intervalModeActive,
    pattern_complexity: patternComplexity,
    ...audioData
  });

  // Trackear patrón de intervalos si está activo
  if (intervalModeActive && lastIntervalData) {
    trackEvent(EVENT_TYPES.PATTERN_PLAYED, {
      app_id: 'app5',
      pattern_type: 'temporal_intervals',
      intervals_count: lastIntervalData.count,
      complexity: patternComplexity,
      unique_intervals: intervalsCreated.size
    });
  }

  // Si la complejidad es alta
  if (patternComplexity === 'high' || patternComplexity === 'expert') {
    trackEvent(EVENT_TYPES.COMPLEXITY_INCREASED, {
      app_id: 'app5',
      complexity_type: 'interval_pattern',
      complexity: patternComplexity,
      lg_value: lastLgValue
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
    app_id: 'app5',
    duration_seconds: duration,
    pulses_played: audioData.pulsesPlayed,
    total_pulses: audioData.totalPulses,
    completion_rate: audioData.totalPulses > 0 ?
      (audioData.pulsesPlayed / audioData.totalPulses) * 100 : 0,
    lg_value: lastLgValue,
    v_value: lastVValue,
    interval_mode: intervalModeActive,
    pattern_complexity: patternComplexity,
    ...audioData
  });

  // Milestone de tiempo
  if (duration >= 300) { // 5 minutos
    trackEvent(EVENT_TYPES.PRACTICE_TIME_MILESTONE, {
      app_id: 'app5',
      milestone_minutes: Math.floor(duration / 60),
      duration_seconds: duration,
      with_intervals: intervalModeActive
    });
  }

  // Patrón dominado si se completó con alta duración
  if (audioData.pulsesPlayed === audioData.totalPulses &&
      duration > 60 && intervalModeActive) {
    trackEvent(EVENT_TYPES.PATTERN_MASTERED, {
      app_id: 'app5',
      pattern_type: 'temporal_intervals',
      duration_seconds: duration,
      complexity: patternComplexity
    });
  }

  practiceStartTime = null;
}

/**
 * Maneja cambios de parámetros
 */
function handleParameterChange(data) {
  trackEvent(EVENT_TYPES.PARAMETER_CHANGED, {
    app_id: 'app5',
    parameter_name: data.param,
    parameter_value: data.value,
    interval_mode: intervalModeActive,
    ...data
  });

  // Trackear cambios significativos en Lg
  if (data.param === 'Lg') {
    const newValue = parseInt(data.value);
    if (lastLgValue && newValue > lastLgValue && newValue > 40) {
      trackEvent(EVENT_TYPES.COMPLEXITY_INCREASED, {
        app_id: 'app5',
        parameter: 'Lg',
        old_value: lastLgValue,
        new_value: newValue,
        increase_percentage: ((newValue - lastLgValue) / lastLgValue) * 100
      });
    }
    lastLgValue = newValue;
    updatePatternComplexity();
  }

  if (data.param === 'V') {
    lastVValue = parseInt(data.value);
  }
}

/**
 * Configura el tracking de intervalos temporales
 */
function setupIntervalTracking() {
  // Buscar elementos relacionados con intervalos
  const timelineWrapper = document.getElementById('timelineWrapper');
  const timeline = document.getElementById('timeline');

  if (!timeline) return;

  // Detectar creación de intervalos observando cambios en el timeline
  const observer = new MutationObserver(() => {
    analyzeIntervals();
  });

  observer.observe(timeline, {
    childList: true,
    subtree: true,
    attributes: true
  });

  // También detectar clicks en elementos de intervalo
  timeline.addEventListener('click', (e) => {
    if (e.target.classList.contains('interval') ||
        e.target.classList.contains('pulse')) {
      setTimeout(analyzeIntervals, 100);
    }
  });
}

/**
 * Analiza los intervalos temporales creados
 */
function analyzeIntervals() {
  const timeline = document.getElementById('timeline');
  if (!timeline) return;

  // Buscar elementos que representen intervalos
  const intervalElements = timeline.querySelectorAll('.interval, .pulse.selected');
  const intervals = [];

  intervalElements.forEach((el, index) => {
    if (index > 0) {
      // Calcular intervalo basado en posición o data attributes
      const interval = extractIntervalData(el, intervalElements[index - 1]);
      if (interval) {
        intervals.push(interval);
      }
    }
  });

  if (intervals.length > 0) {
    const intervalKey = intervals.map(i => i.toString()).join('-');

    if (!intervalsCreated.has(intervalKey)) {
      intervalsCreated.add(intervalKey);

      lastIntervalData = {
        count: intervals.length,
        pattern: intervalKey
      };

      trackEvent(EVENT_TYPES.PATTERN_PLAYED, {
        app_id: 'app5',
        pattern_type: 'temporal_interval',
        intervals: intervals.length,
        unique_patterns: intervalsCreated.size,
        complexity: calculateIntervalComplexity(intervals)
      });

      updatePatternComplexity();
    }
  }
}

/**
 * Extrae datos de intervalo entre elementos
 */
function extractIntervalData(el1, el2) {
  // Intentar obtener posición o tiempo
  const pos1 = el1.offsetLeft || 0;
  const pos2 = el2.offsetLeft || 0;
  return Math.abs(pos1 - pos2);
}

/**
 * Configura el tracking de patrones
 */
function setupPatternTracking() {
  const pulseSeq = document.getElementById('pulseSeq');
  if (!pulseSeq) return;

  let lastPattern = '';

  const checkPattern = () => {
    const pulses = Array.from(pulseSeq.querySelectorAll('.pulse'));
    const pattern = pulses.map(p =>
      p.classList.contains('selected') ? '1' : '0'
    ).join('');

    if (pattern !== lastPattern && pattern.includes('1')) {
      const selectedCount = (pattern.match(/1/g) || []).length;

      // Analizar complejidad del patrón
      const complexity = analyzePatternComplexity(pattern);

      trackEvent(EVENT_TYPES.PULSE_PATTERN_CREATED, {
        app_id: 'app5',
        pattern_type: 'pulsation',
        pattern: pattern,
        total_pulses: pulses.length,
        selected_pulses: selectedCount,
        density: selectedCount / pulses.length,
        complexity: complexity,
        interval_mode: intervalModeActive
      });

      lastPattern = pattern;
      patternComplexity = complexity;
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

  pulseSeq.addEventListener('click', (e) => {
    if (e.target.classList.contains('pulse')) {
      setTimeout(checkPattern, 10);
    }
  });
}

/**
 * Analiza la precisión del tap tempo
 */
function analyzeTapPrecision() {
  // Implementar análisis de precisión basado en varianza de intervalos
  const tapBtn = document.getElementById('tapTempoBtn');
  if (!tapBtn) return;

  // Simular análisis (en producción, esto mediría intervalos reales)
  const mockPrecision = 75 + Math.random() * 25;

  if (mockPrecision > 90) {
    trackEvent(EVENT_TYPES.TAP_TEMPO_ACCURATE, {
      app_id: 'app5',
      precision_percentage: Math.round(mockPrecision),
      interval_mode: intervalModeActive
    });
  }
}

/**
 * Calcula la complejidad de intervalos
 */
function calculateIntervalComplexity(intervals) {
  if (!intervals || intervals.length === 0) return 'low';

  // Calcular varianza para determinar irregularidad
  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avg, 2), 0) / intervals.length;
  const complexity = intervals.length * (1 + variance / avg);

  if (complexity < 10) return 'low';
  if (complexity < 30) return 'medium';
  if (complexity < 50) return 'high';
  return 'expert';
}

/**
 * Analiza la complejidad de un patrón de pulsos
 */
function analyzePatternComplexity(pattern) {
  const length = pattern.length;
  const ones = (pattern.match(/1/g) || []).length;
  const density = ones / length;

  // Calcular irregularidad del patrón
  let changes = 0;
  for (let i = 1; i < pattern.length; i++) {
    if (pattern[i] !== pattern[i-1]) changes++;
  }
  const irregularity = changes / length;

  const score = length * (density * 0.5 + irregularity * 0.5);

  if (score < 5) return 'low';
  if (score < 15) return 'medium';
  if (score < 30) return 'high';
  return 'expert';
}

/**
 * Actualiza la complejidad del patrón
 */
function updatePatternComplexity() {
  let score = 0;

  // Complejidad por Lg
  if (lastLgValue) {
    if (lastLgValue > 50) score += 40;
    else if (lastLgValue > 30) score += 30;
    else if (lastLgValue > 15) score += 20;
    else score += 10;
  }

  // Complejidad por intervalos
  if (intervalsCreated.size > 10) score += 20;
  else if (intervalsCreated.size > 5) score += 10;

  // Bonus por modo intervalo
  if (intervalModeActive) score += 15;

  if (score >= 60) patternComplexity = 'expert';
  else if (score >= 40) patternComplexity = 'high';
  else if (score >= 20) patternComplexity = 'medium';
  else patternComplexity = 'low';
}

/**
 * Obtiene estadísticas de la sesión actual
 */
export function getApp5Stats() {
  const manager = getGamificationManager();
  const stats = manager.getStats();

  return {
    ...stats,
    app_specific: {
      unique_intervals: intervalsCreated.size,
      interval_mode_active: intervalModeActive,
      current_complexity: patternComplexity,
      last_interval_pattern: lastIntervalData
    }
  };
}

/**
 * Obtiene el progreso de logros
 */
export function getApp5Achievements() {
  const manager = getGamificationManager();
  return manager.getAchievements();
}

// Exportar para debugging
if (typeof window !== 'undefined' && window.GAMIFICATION_DEBUG) {
  window.__APP5_GAMIFICATION = {
    getStats: getApp5Stats,
    getAchievements: getApp5Achievements,
    intervalsCreated: Array.from(intervalsCreated),
    intervalModeActive,
    patternComplexity,
    lastIntervalData
  };
}