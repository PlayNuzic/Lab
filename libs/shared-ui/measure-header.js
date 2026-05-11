// Compás header ("Com.") — reusable measure-bar widget.
//
// Visually mirrors the measure bar of the Nuzic main app: a yellow label
// on the left with "Compás", a track that spans the timeline, and circle
// markers above the first pulse of each measure (1, 2, ...). Marker 1
// also shows the beat value (pulsos-per-measure). A vertical yellow bar
// at the end connects with the timeline's double-bar closure.
//
// Alignment: the track width matches the host timeline/grid's inner area,
// and each marker is positioned by percentage `(cycleIndex / cycles) * 100`.
// Used by App16 (linear timeline) and App19 (plano-modular grid).

export function createMeasureHeader({ container, labelText = '' } = {}) {
  if (!container) return null;

  // Label visual a l'esquerra (rectangle groc). Per defecte queda SENSE
  // text (decoratiu/identitatiu), però l'app pot passar `labelText` per
  // mostrar text explícit (ex. App16 amb "Compàs"). App19/App20 segueixen
  // sense text per retro-compat.
  const labelEl = document.createElement('div');
  labelEl.className = 'measure-header__label';
  if (labelText) labelEl.textContent = labelText;

  const trackEl = document.createElement('div');
  trackEl.className = 'measure-header__track';

  const endBar = document.createElement('div');
  endBar.className = 'measure-header__end-bar';
  endBar.setAttribute('aria-hidden', 'true');

  container.innerHTML = '';
  container.appendChild(labelEl);
  container.appendChild(trackEl);
  container.appendChild(endBar);

  let currentCompas = null;
  let currentCycles = 0;

  function clearMarkers() {
    trackEl.querySelectorAll('.measure-marker').forEach(m => m.remove());
  }

  function buildMarker({ index, label, value, leftPercent }) {
    const marker = document.createElement('div');
    marker.className = 'measure-marker';
    marker.style.setProperty('--marker-left', `${leftPercent}%`);
    marker.dataset.cycle = String(index);

    const circle = document.createElement('div');
    circle.className = 'measure-marker__circle';
    circle.textContent = label;
    marker.appendChild(circle);

    // Only the first cycle shows the beat value next to the circle.
    if (value != null) {
      const valueEl = document.createElement('div');
      valueEl.className = 'measure-marker__value';
      valueEl.textContent = String(value);
      marker.appendChild(valueEl);
    }

    return marker;
  }

  /**
   * Render the header for the current compás + number of cycles.
   * The beat value (compas) is shown only on the first marker.
   */
  function render(compas, cycles) {
    clearMarkers();
    currentCompas = compas;
    currentCycles = cycles;

    if (!compas || compas < 1 || !cycles || cycles < 1) {
      container.classList.add('is-empty');
      return;
    }
    container.classList.remove('is-empty');

    const totalPulses = compas * cycles;
    for (let i = 0; i < cycles; i++) {
      const startPulse = i * compas;
      const leftPercent = (startPulse / totalPulses) * 100;
      const marker = buildMarker({
        index: i,
        label: String(i + 1),
        value: i === 0 ? compas : null,
        leftPercent,
      });
      trackEl.appendChild(marker);
    }
  }

  /**
   * Re-label markers during the fade-out phase so the bar mirrors the
   * super-index shift on the timeline (cycles 1-2 → 3-4 when the jump
   * happens). `startCycle` is the number the first marker should show.
   */
  function applyFadeOut(startCycle) {
    trackEl.querySelectorAll('.measure-marker').forEach((marker, idx) => {
      const circle = marker.querySelector('.measure-marker__circle');
      if (circle) circle.textContent = String(startCycle + idx);
      marker.classList.add('is-fade-out');
    });
  }

  /**
   * Remove the fade-out re-labeling (called when playback resets).
   */
  function clearFadeOut() {
    if (currentCompas != null && currentCycles > 0) {
      render(currentCompas, currentCycles);
    }
  }

  return { render, applyFadeOut, clearFadeOut };
}
