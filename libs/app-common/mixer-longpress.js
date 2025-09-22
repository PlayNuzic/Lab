// libs/app-common/mixer-longpress.js
// Long-press (o click derecho) sobre el botón "play" para abrir el mixer.
// Abre el mixer llamando a window.NuzicMixer.open() si existe,
// o emite el evento 'nuzic:mixer:open' para que lo capture vuestro mixer.

(function () {
  const LONG_MS = 600;

  function openMixer() {
    const mixer = window.NuzicMixer;
    if (mixer && typeof mixer === 'object') {
      if (typeof mixer.open === 'function') {
        try { mixer.open(); return; } catch {}
      }
      if (typeof mixer.toggle === 'function') {
        const isOpen = typeof mixer.isOpen === 'function'
          ? (() => { try { return !!mixer.isOpen(); } catch { return false; } })()
          : false;
        if (!isOpen) {
          try { mixer.toggle(); return; } catch {}
        }
      }
    }
    document.dispatchEvent(new CustomEvent('nuzic:mixer:open'));
  }

  // Heurística para localizar el botón de play en App2/App3
  function findPlayButtons() {
    const candidates = [
      '#playBtn', '#playButton', '#play', '#playSeq',
      '[data-role="play"]', '[data-play]',
      '.btn-play', '.play', 'button[aria-label*="play" i]',
      'button'
    ];
    const btns = new Set();
    for (const sel of candidates) {
      document.querySelectorAll(sel).forEach(b => {
        // filtra por texto visible típico
        const txt = (b.textContent || '').trim().toLowerCase();
        if (sel === 'button') {
          if (!/play|reproducir|inicia|start|▶/i.test(txt)) return;
        }
        btns.add(b);
      });
    }
    return Array.from(btns);
  }

  function attachLongPress(btn) {
    if (!btn || btn.__nuzic_lp_bound__) return;
    btn.__nuzic_lp_bound__ = true;

    let timer = null;
    const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };

    const down = (ev) => {
      // No interfieras con atajos de accesibilidad
      if (ev.button === 2) return; // el contextmenu lo gestionamos aparte
      clear();
      timer = setTimeout(() => { clear(); openMixer(); }, LONG_MS);
    };
    const up = () => clear();

    btn.addEventListener('mousedown', down);
    btn.addEventListener('touchstart', down, { passive: true });
    btn.addEventListener('mouseup', up);
    btn.addEventListener('mouseleave', up);
    btn.addEventListener('touchend', up);
    btn.addEventListener('touchcancel', up);

    // Alternativa: click derecho abre mixer
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openMixer();
    });
  }

  function init() {
    findPlayButtons().forEach(attachLongPress);
    // Por si la UI cambia dinámicamente (SPA), reintenta un poco
    let retries = 10;
    const iv = setInterval(() => {
      findPlayButtons().forEach(attachLongPress);
      if (--retries <= 0) clearInterval(iv);
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
