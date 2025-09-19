// libs/shared-ui/performance-audio-menu.js
(function () {
  const DETAILS_CLASS = 'nuzic-audio-perf';
  const PANEL_CLASS = 'nuzic-audio-perf-panel';
  const AUDIO = () => (window.NuzicAudioEngine || null);

  function extractElements(container) {
    const sr = container.querySelector('#nza-sr');
    const apply = container.querySelector('#nza-apply-sr');
    const hz = container.querySelector('#nza-hz');
    const hzOut = container.querySelector('#nza-hz-out');
    const intMs = container.querySelector('#nza-int');
    return { sr, apply, hz, hzOut, intMs };
  }

  function createPanel() {
    const panel = document.createElement('div');
    panel.className = PANEL_CLASS;
    panel.innerHTML = `
      <div class="perf-row">
        <label for="nza-sr">Sample Rate (Hz)</label>
        <input id="nza-sr" type="number" min="22050" step="100" value="48000" />
        <button id="nza-apply-sr" type="button">Aplicar</button>
      </div>
      <div class="perf-row">
        <label for="nza-hz">Schedule Horizon (ms)</label>
        <input id="nza-hz" type="range" min="40" max="240" step="5" value="120" />
        <output id="nza-hz-out" for="nza-hz">120</output>
      </div>
      <div class="perf-row readonly">
        <label>Scheduler Interval (ms)</label>
        <span id="nza-int">20</span>
      </div>
      <div class="perf-foot">Los cambios de Sample Rate solo aplican si el motor aún no inició.</div>
    `;
    return panel;
  }

  function syncFromEngine(elements) {
    const { sr, hz, hzOut, intMs } = elements;
    if (!sr || !hz || !hzOut || !intMs) return;
    const engine = AUDIO();
    if (!engine) return;

    Promise.resolve(engine.configurePerformance({})).then((info) => {
      if (!info) return;
      if (info.actualSampleRate && sr) sr.value = info.actualSampleRate;
      if (hz) {
        hz.value = info.scheduleHorizonMs;
        hz.dispatchEvent(new Event('input'));
      }
      if (hzOut) hzOut.textContent = String(info.scheduleHorizonMs);
      if (intMs) intMs.textContent = String(info.schedulerIntervalMs);
    }).catch(() => {});
  }

  function wireInteractions(panel) {
    const elements = extractElements(panel);
    const { sr, apply, hz, hzOut, intMs } = elements;

    if (hz && hzOut) {
      hzOut.textContent = String(hz.value);
      hz.addEventListener('input', async () => {
        hzOut.textContent = hz.value;
        const engine = AUDIO();
        if (!engine) return;
        try {
          const info = await engine.configurePerformance({ scheduleHorizonMs: +hz.value });
          if (info && intMs) intMs.textContent = String(info.schedulerIntervalMs);
        } catch (err) {
          console.warn('[AudioPerf] schedule update failed', err);
        }
      });
    }

    if (apply && sr) {
      apply.addEventListener('click', async () => {
        const engine = AUDIO();
        if (!engine) return;
        try {
          const info = await engine.configurePerformance({ requestedSampleRate: +sr.value });
          syncFromEngine(elements);
          console.log('[AudioPerf] SR ->', info?.actualSampleRate);
        } catch (err) {
          console.warn('[AudioPerf] sample-rate update failed', err);
        }
      });
    }

    syncFromEngine(elements);
  }

  function install(attempt = 0) {
    const header = document.querySelector('header.top-bar');
    const optionsContent = header?.querySelector('details.menu .options-content');
    if (!optionsContent) {
      if (attempt < 10) window.setTimeout(() => install(attempt + 1), 150);
      return;
    }

    if (optionsContent.querySelector(`details.${DETAILS_CLASS}`)) return;

    const details = document.createElement('details');
    details.className = DETAILS_CLASS;

    const summary = document.createElement('summary');
    summary.textContent = 'Rendimiento audio';
    details.appendChild(summary);

    const panel = createPanel();
    details.appendChild(panel);
    optionsContent.appendChild(details);

    details.addEventListener('toggle', (event) => {
      if (!event.target.open && typeof summary.focus === 'function') {
        // ensure focus can return to the menu summary when closing
        summary.focus({ preventScroll: true });
      }
    });

    optionsContent.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && details.open) {
        details.open = false;
      }
    });

    wireInteractions(panel);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => install());
  } else {
    install();
  }
})();
