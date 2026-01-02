// libs/soundlines/connection-renderer.js
// Renderitzador de línies de connexió entre soundlines

/**
 * Dibuixa línies de connexió entre dues soundlines
 * @param {Object} options - Opcions de configuració
 * @param {SVGElement} options.svg - Element SVG on dibuixar les línies
 * @param {HTMLElement} options.chromaticContainer - Contenidor de la soundline cromàtica
 * @param {Object} options.chromaticSoundline - API de la soundline cromàtica
 * @param {number[]} options.scaleNotes - Notes de l'escala a connectar (semitons 0-11)
 * @param {string} [options.cssLengthVar='--connection-length'] - Variable CSS per la llargada
 * @returns {boolean} True si s'han dibuixat les línies correctament
 */
export function drawConnectionLines(options) {
  const {
    svg,
    chromaticContainer,
    chromaticSoundline,
    scaleNotes,
    cssLengthVar = '--connection-length'
  } = options;

  if (!svg || !chromaticContainer || !chromaticSoundline) {
    console.warn('drawConnectionLines: Missing required elements');
    return false;
  }

  svg.innerHTML = '';

  const svgNS = 'http://www.w3.org/2000/svg';

  // Llegir llargada des de la variable CSS
  const styles = getComputedStyle(document.documentElement);
  const lengthRaw = styles.getPropertyValue(cssLengthVar).trim() || '80%';
  const lengthPct = parseFloat(lengthRaw) || 80;

  // Obtenir dimensions reals per alinear SVG amb soundline-container
  const containerRect = chromaticContainer.getBoundingClientRect();
  const svgRect = svg.getBoundingClientRect();

  // Offset vertical entre l'SVG i el soundline-container
  const offsetY = containerRect.top - svgRect.top;
  const containerHeight = containerRect.height;
  const svgHeight = svgRect.height;

  // Guard against zero dimensions (element not visible)
  if (svgHeight === 0 || containerHeight === 0) {
    console.warn('Connection SVG or container has zero height, skipping line drawing');
    return false;
  }

  // Línies horitzontals per cada semitono de l'escala
  scaleNotes.forEach((semitone, degree) => {
    // Posició relativa dins del soundline-container (0-100%)
    const notePct = chromaticSoundline.getNotePosition(semitone);
    // Convertir a posició absoluta dins del soundline-container
    const noteY = (notePct / 100) * containerHeight;
    // Afegir offset per convertir a coordenades de l'SVG
    const svgY = offsetY + noteY;
    // Convertir a percentatge de l'SVG
    const yPct = (svgY / svgHeight) * 100;

    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', '0%');
    line.setAttribute('y1', `${yPct}%`);
    line.setAttribute('x2', `${lengthPct}%`);
    line.setAttribute('y2', `${yPct}%`);
    line.setAttribute('class', 'connection-line');
    line.setAttribute('data-semitone', semitone);
    line.setAttribute('data-degree', degree);

    svg.appendChild(line);
  });

  return true;
}

/**
 * Crea un gestor de línies de connexió amb auto-resize
 * @param {Object} options - Opcions de configuració
 * @param {SVGElement} options.svg - Element SVG on dibuixar les línies
 * @param {HTMLElement} options.chromaticContainer - Contenidor de la soundline cromàtica
 * @param {Object} options.chromaticSoundline - API de la soundline cromàtica
 * @param {number[]} options.scaleNotes - Notes de l'escala inicial
 * @returns {Object} API del gestor
 */
export function createConnectionManager(options) {
  let { svg, chromaticContainer, chromaticSoundline, scaleNotes } = options;

  // Referència a la funció de resize per poder-la eliminar
  let resizeHandler = null;

  /**
   * Redibuixa les línies de connexió
   */
  function redraw() {
    drawConnectionLines({
      svg,
      chromaticContainer,
      chromaticSoundline,
      scaleNotes
    });
  }

  /**
   * Actualitza les notes de l'escala i redibuixa
   * @param {number[]} newScaleNotes - Noves notes de l'escala
   */
  function updateScaleNotes(newScaleNotes) {
    scaleNotes = newScaleNotes;
    redraw();
  }

  /**
   * Actualitza la soundline cromàtica (quan es recrea)
   * @param {Object} newChromaticSoundline - Nova API de soundline
   */
  function updateChromaticSoundline(newChromaticSoundline) {
    chromaticSoundline = newChromaticSoundline;
    redraw();
  }

  /**
   * Configura listener de resize automàtic
   */
  function enableAutoResize() {
    if (resizeHandler) return;

    resizeHandler = () => redraw();
    window.addEventListener('resize', resizeHandler);
  }

  /**
   * Desactiva listener de resize automàtic
   */
  function disableAutoResize() {
    if (!resizeHandler) return;

    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  /**
   * Neteja recursos
   */
  function dispose() {
    disableAutoResize();
    if (svg) {
      svg.innerHTML = '';
    }
  }

  return {
    redraw,
    updateScaleNotes,
    updateChromaticSoundline,
    enableAutoResize,
    disableAutoResize,
    dispose
  };
}
