// libs/shared-ui/performance-audio-menu.js
(function () {
  const AUDIO = () => (window.NuzicAudioEngine || null);

  function install() {
    const header = document.querySelector('header, .header, #header');
    if (!header) return;

    // Localiza item "Rendimiento"
    const items = Array.from(header.querySelectorAll('a,button,li,div,span'))
      .filter(el => /rendimiento/i.test(el.textContent || ''));
    const anchor = items[0] || header;

    // Renombra
    if (items[0]) items[0].textContent = 'Rendimiento Audio';

    // Crea panel
    const panel = document.createElement('div');
    panel.className = 'nuzic-audio-perf-panel';
    panel.innerHTML = `
      <div class="perf-row">
        <label>Sample Rate (Hz)</label>
        <input id="nza-sr" type="number" min="22050" step="100" value="48000" />
        <button id="nza-apply-sr">Aplicar</button>
      </div>
      <div class="perf-row">
        <label>Schedule Horizon (ms)</label>
        <input id="nza-hz" type="range" min="40" max="240" step="5" value="120" />
        <output id="nza-hz-out">120</output>
      </div>
      <div class="perf-row readonly">
        <label>Scheduler Interval (ms)</label>
        <span id="nza-int">20</span>
      </div>
      <div class="perf-foot">Los cambios de Sample Rate solo aplican si el motor aún no inició.</div>
    `;
    anchor.parentElement?.insertBefore(panel, anchor.nextSibling);

    const sr = panel.querySelector('#nza-sr');
    const apply = panel.querySelector('#nza-apply-sr');
    const hz = panel.querySelector('#nza-hz');
    const hzOut = panel.querySelector('#nza-hz-out');
    const intMs = panel.querySelector('#nza-int');

    const syncFromEngine = async () => {
      const engine = AUDIO();
      if (!engine) return;
      const info = await engine.configurePerformance({});
      if (info.actualSampleRate) sr.value = info.actualSampleRate;
      hz.value = info.scheduleHorizonMs;
      hzOut.textContent = String(info.scheduleHorizonMs);
      intMs.textContent = String(info.schedulerIntervalMs);
    };

    apply.addEventListener('click', async () => {
      const engine = AUDIO();
      if (!engine) return;
      const info = await engine.configurePerformance({ requestedSampleRate: +sr.value });
      await syncFromEngine();
      console.log('[AudioPerf] SR ->', info.actualSampleRate);
    });
    hz.addEventListener('input', async () => {
      hzOut.textContent = hz.value;
      const engine = AUDIO();
      if (!engine) return;
      const info = await engine.configurePerformance({ scheduleHorizonMs: +hz.value });
      intMs.textContent = String(info.schedulerIntervalMs);
    });

    syncFromEngine();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
})();
