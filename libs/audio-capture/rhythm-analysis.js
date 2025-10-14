/**
 * Rhythm Analysis Module
 *
 * Analiza ritmos capturados y los compara con patrones esperados.
 * Calcula precisión, consistencia y métricas de rendimiento.
 *
 * @module libs/audio-capture/rhythm-analysis
 */

/**
 * Clase para analizar y comparar ritmos
 */
export class RhythmAnalyzer {
  constructor(options = {}) {
    this.config = {
      // Tolerancia para considerar un tap "correcto" (en ms)
      timingTolerance: options.timingTolerance || 100,

      // Tolerancia para variación en tempo (BPM)
      tempoTolerance: options.tempoTolerance || 10,

      // Ventana de análisis para consistencia (ms)
      consistencyWindow: options.consistencyWindow || 500,

      // Peso de diferentes métricas (suman 1.0)
      weights: {
        timing: options.timingWeight || 0.5,
        consistency: options.consistencyWeight || 0.3,
        tempo: options.tempoWeight || 0.2
      },

      ...options
    };
  }

  /**
   * Compara un ritmo grabado con uno esperado
   * @param {Array<number>} recordedTaps - Timestamps de taps grabados (ms)
   * @param {Array<number>} expectedTaps - Timestamps de taps esperados (ms)
   * @returns {Object} Resultados del análisis con accuracy, deviations, etc.
   */
  compareRhythm(recordedTaps, expectedTaps) {
    if (!recordedTaps || recordedTaps.length === 0) {
      return {
        accuracy: 0,
        timingAccuracy: 0,
        consistencyScore: 0,
        tempoAccuracy: 0,
        deviations: [],
        missedTaps: expectedTaps.length,
        extraTaps: 0,
        message: 'No se detectaron taps'
      };
    }

    if (!expectedTaps || expectedTaps.length === 0) {
      return {
        accuracy: 0,
        timingAccuracy: 0,
        consistencyScore: 0,
        tempoAccuracy: 0,
        deviations: [],
        missedTaps: 0,
        extraTaps: recordedTaps.length,
        message: 'No hay patrón esperado'
      };
    }

    // Normalizar timestamps (empezar desde 0)
    const recorded = this._normalizeTimestamps(recordedTaps);
    const expected = this._normalizeTimestamps(expectedTaps);

    // Emparejar taps grabados con esperados
    const matches = this._matchTaps(recorded, expected);

    // Calcular métricas individuales
    const timingAccuracy = this._calculateTimingAccuracy(matches);
    const consistencyScore = this._calculateConsistency(recorded);
    const tempoAccuracy = this._calculateTempoAccuracy(recorded, expected);

    // Calcular accuracy total (promedio ponderado)
    const accuracy =
      this.config.weights.timing * timingAccuracy +
      this.config.weights.consistency * consistencyScore +
      this.config.weights.tempo * tempoAccuracy;

    // Generar mensaje descriptivo
    const message = this._generateFeedbackMessage(accuracy, matches);

    return {
      accuracy: Math.round(accuracy * 100) / 100,
      timingAccuracy: Math.round(timingAccuracy * 100) / 100,
      consistencyScore: Math.round(consistencyScore * 100) / 100,
      tempoAccuracy: Math.round(tempoAccuracy * 100) / 100,
      deviations: matches.deviations,
      missedTaps: matches.missed.length,
      extraTaps: matches.extra.length,
      totalTaps: recorded.length,
      expectedTaps: expected.length,
      message: message,
      details: {
        matches: matches.matched,
        missed: matches.missed,
        extra: matches.extra
      }
    };
  }

  /**
   * Detecta el tempo (BPM) de una serie de taps
   * @param {Array<number>} taps - Timestamps de taps (ms)
   * @returns {Object} { bpm, confidence, intervals }
   */
  detectTempo(taps) {
    if (!taps || taps.length < 2) {
      return {
        bpm: 0,
        confidence: 0,
        intervals: [],
        message: 'Necesitas al menos 2 taps para detectar tempo'
      };
    }

    // Calcular intervalos entre taps consecutivos
    const intervals = [];
    for (let i = 1; i < taps.length; i++) {
      intervals.push(taps[i] - taps[i - 1]);
    }

    // Calcular intervalo promedio
    const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;

    // Calcular BPM (60000 ms = 1 minuto)
    const bpm = 60000 / avgInterval;

    // Calcular confianza basada en consistencia de intervalos
    const consistency = this._calculateConsistency(taps);

    return {
      bpm: Math.round(bpm * 10) / 10,
      confidence: Math.round(consistency * 100) / 100,
      intervals: intervals,
      avgInterval: Math.round(avgInterval),
      message: `Tempo detectado: ${Math.round(bpm)} BPM (confianza: ${Math.round(consistency * 100)}%)`
    };
  }

  /**
   * Calcula la consistencia de un ritmo (qué tan regular es)
   * @param {Array<number>} taps - Timestamps de taps (ms)
   * @returns {number} Score de 0 a 1 (1 = perfectamente consistente)
   */
  calculateConsistency(taps) {
    return this._calculateConsistency(taps);
  }

  /**
   * Normaliza timestamps para empezar desde 0
   * @private
   * @param {Array<number>} taps
   * @returns {Array<number>}
   */
  _normalizeTimestamps(taps) {
    if (taps.length === 0) return [];
    const first = taps[0];
    return taps.map(t => t - first);
  }

  /**
   * Empareja taps grabados con esperados
   * @private
   * @param {Array<number>} recorded
   * @param {Array<number>} expected
   * @returns {Object}
   */
  _matchTaps(recorded, expected) {
    const matched = [];
    const deviations = [];
    const missed = [];
    const extra = [];

    const usedRecorded = new Set();
    const usedExpected = new Set();

    // Para cada tap esperado, buscar el más cercano grabado
    for (let i = 0; i < expected.length; i++) {
      const expectedTime = expected[i];
      let closestIdx = -1;
      let closestDiff = Infinity;

      for (let j = 0; j < recorded.length; j++) {
        if (usedRecorded.has(j)) continue;

        const diff = Math.abs(recorded[j] - expectedTime);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestIdx = j;
        }
      }

      // Si hay un match dentro de la tolerancia
      if (closestIdx !== -1 && closestDiff <= this.config.timingTolerance) {
        matched.push({
          expectedIdx: i,
          recordedIdx: closestIdx,
          expectedTime: expectedTime,
          recordedTime: recorded[closestIdx],
          deviation: recorded[closestIdx] - expectedTime
        });
        deviations.push(recorded[closestIdx] - expectedTime);
        usedRecorded.add(closestIdx);
        usedExpected.add(i);
      } else {
        missed.push({
          expectedIdx: i,
          expectedTime: expectedTime
        });
      }
    }

    // Taps extra (no emparejados)
    for (let j = 0; j < recorded.length; j++) {
      if (!usedRecorded.has(j)) {
        extra.push({
          recordedIdx: j,
          recordedTime: recorded[j]
        });
      }
    }

    return { matched, deviations, missed, extra };
  }

  /**
   * Calcula accuracy basada en timing
   * @private
   * @param {Object} matches
   * @returns {number} Score de 0 a 1
   */
  _calculateTimingAccuracy(matches) {
    if (matches.matched.length === 0) {
      return 0;
    }

    // Calcular accuracy para cada match
    const accuracies = matches.matched.map(match => {
      const deviation = Math.abs(match.deviation);
      // Función lineal: 0 desviación = 1.0, tolerancia = 0.0
      const accuracy = Math.max(0, 1 - (deviation / this.config.timingTolerance));
      return accuracy;
    });

    // Promedio
    const avgAccuracy = accuracies.reduce((sum, val) => sum + val, 0) / accuracies.length;

    // Penalización por taps perdidos/extra
    const totalExpected = matches.matched.length + matches.missed.length;
    const completionRate = matches.matched.length / totalExpected;

    return avgAccuracy * completionRate;
  }

  /**
   * Calcula consistencia de intervalos
   * @private
   * @param {Array<number>} taps
   * @returns {number} Score de 0 a 1
   */
  _calculateConsistency(taps) {
    if (taps.length < 2) return 1;

    // Calcular intervalos
    const intervals = [];
    for (let i = 1; i < taps.length; i++) {
      intervals.push(taps[i] - taps[i - 1]);
    }

    if (intervals.length === 0) return 1;

    // Calcular desviación estándar
    const avg = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);

    // Normalizar: 0 desviación = 1.0, más desviación = menor score
    // Usar coeficiente de variación (stdDev / avg)
    if (avg === 0) return 1;
    const cv = stdDev / avg;

    // Mapear a score de 0-1 (cv de 0.5 o más = 0)
    const consistency = Math.max(0, 1 - (cv / 0.5));

    return consistency;
  }

  /**
   * Calcula accuracy de tempo
   * @private
   * @param {Array<number>} recorded
   * @param {Array<number>} expected
   * @returns {number} Score de 0 a 1
   */
  _calculateTempoAccuracy(recorded, expected) {
    const recordedTempo = this.detectTempo(recorded);
    const expectedTempo = this.detectTempo(expected);

    if (recordedTempo.bpm === 0 || expectedTempo.bpm === 0) {
      return 1; // No penalizar si no hay suficientes datos
    }

    const bpmDiff = Math.abs(recordedTempo.bpm - expectedTempo.bpm);

    // Función lineal: 0 diferencia = 1.0, tolerancia = 0.0
    const accuracy = Math.max(0, 1 - (bpmDiff / this.config.tempoTolerance));

    return accuracy;
  }

  /**
   * Genera mensaje de feedback basado en accuracy
   * @private
   * @param {number} accuracy - Score de 0 a 1
   * @param {Object} matches
   * @returns {string}
   */
  _generateFeedbackMessage(accuracy, matches) {
    const percentage = Math.round(accuracy * 100);

    let message = '';

    if (percentage >= 90) {
      message = '¡Excelente! Ritmo casi perfecto.';
    } else if (percentage >= 75) {
      message = '¡Muy bien! Buen ritmo con pequeñas desviaciones.';
    } else if (percentage >= 60) {
      message = 'Bien. Intenta mantener el tempo más constante.';
    } else if (percentage >= 40) {
      message = 'Regular. Practica para mejorar la precisión.';
    } else {
      message = 'Sigue practicando. Concéntrate en el tempo.';
    }

    // Añadir detalles específicos
    if (matches.missed.length > 0) {
      message += ` Te faltaron ${matches.missed.length} tap(s).`;
    }
    if (matches.extra.length > 0) {
      message += ` Tuviste ${matches.extra.length} tap(s) de más.`;
    }

    return message;
  }

  /**
   * Analiza un ritmo libre (sin patrón esperado)
   * Útil para ejercicios de improvisación o detección de patrones
   * @param {Array<number>} taps - Timestamps de taps (ms)
   * @returns {Object} Análisis del ritmo
   */
  analyzeFreeRhythm(taps) {
    if (!taps || taps.length < 2) {
      return {
        tempo: { bpm: 0, confidence: 0 },
        consistency: 0,
        patterns: [],
        message: 'Necesitas al menos 2 taps para analizar'
      };
    }

    const tempo = this.detectTempo(taps);
    const consistency = this.calculateConsistency(taps);

    // Detectar patrones simples (grupos de intervalos similares)
    const patterns = this._detectPatterns(taps);

    return {
      tempo: tempo,
      consistency: consistency,
      patterns: patterns,
      totalTaps: taps.length,
      duration: taps[taps.length - 1] - taps[0],
      message: `Ritmo libre: ${Math.round(tempo.bpm)} BPM, consistencia ${Math.round(consistency * 100)}%`
    };
  }

  /**
   * Detecta patrones rítmicos simples
   * @private
   * @param {Array<number>} taps
   * @returns {Array<Object>}
   */
  _detectPatterns(taps) {
    if (taps.length < 3) return [];

    const intervals = [];
    for (let i = 1; i < taps.length; i++) {
      intervals.push(taps[i] - taps[i - 1]);
    }

    // Agrupar intervalos similares (dentro del 20% de diferencia)
    const groups = [];
    for (const interval of intervals) {
      let foundGroup = false;
      for (const group of groups) {
        const avgInterval = group.sum / group.count;
        if (Math.abs(interval - avgInterval) / avgInterval < 0.2) {
          group.sum += interval;
          group.count++;
          foundGroup = true;
          break;
        }
      }
      if (!foundGroup) {
        groups.push({ sum: interval, count: 1 });
      }
    }

    // Convertir grupos a patrones
    const patterns = groups
      .map(group => ({
        interval: Math.round(group.sum / group.count),
        occurrences: group.count,
        bpm: Math.round(60000 / (group.sum / group.count))
      }))
      .sort((a, b) => b.occurrences - a.occurrences);

    return patterns;
  }

  /**
   * Actualiza configuración del analizador
   * @param {Object} newConfig
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };

    // Normalizar pesos si se cambian
    if (newConfig.weights) {
      const totalWeight = Object.values(this.config.weights).reduce((sum, val) => sum + val, 0);
      if (Math.abs(totalWeight - 1.0) > 0.01) {
        console.warn(`⚠️ Los pesos deben sumar 1.0 (actual: ${totalWeight})`);
      }
    }
  }
}

/**
 * Crea una instancia de RhythmAnalyzer con configuración predeterminada
 * @param {Object} options - Opciones de configuración
 * @returns {RhythmAnalyzer}
 */
export function createRhythmAnalyzer(options = {}) {
  return new RhythmAnalyzer(options);
}

/**
 * Función helper para generar un patrón esperado basado en BPM y duración
 * @param {number} bpm - Beats por minuto
 * @param {number} beats - Número de beats
 * @param {number} startTime - Timestamp de inicio (ms)
 * @returns {Array<number>} Array de timestamps esperados
 */
export function generateExpectedPattern(bpm, beats, startTime = 0) {
  const interval = 60000 / bpm; // ms entre beats
  const pattern = [];

  for (let i = 0; i < beats; i++) {
    pattern.push(startTime + (i * interval));
  }

  return pattern;
}

/**
 * Función helper para convertir un patrón de fracciones a timestamps
 * Útil para ejercicios de reconocimiento de fracciones rítmicas
 * @param {Array<number>} fractions - Array de posiciones fraccionales (0=inicio, 0.25=cuarto, 0.5=mitad, 0.75=tres cuartos, 1=fin)
 * @param {number} bpm - Beats por minuto (para referencia de negra)
 * @param {number} startTime - Timestamp de inicio (ms)
 * @returns {Array<number>} Array de timestamps
 */
export function fractionsToTimestamps(fractions, bpm, startTime = 0) {
  const quarterNote = 60000 / bpm; // Duración de una negra en ms
  const timestamps = [];

  for (const fraction of fractions) {
    // Convertir fracción de posición a timestamp
    // Cada fracción representa una posición en el ciclo de 4 negras (1 compás de 4/4)
    const timestamp = startTime + (fraction * quarterNote * 4);
    timestamps.push(timestamp);
  }

  return timestamps;
}
