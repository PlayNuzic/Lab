// Shared UI header for Lab: mirrors App1 header behavior

// --- Scheduling helpers (look-ahead y updateInterval) ---
function detectDeviceProfile() {
  const ua = (navigator && navigator.userAgent) ? navigator.userAgent : '';
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobi/i.test(ua);
  const isSmallScreen = (typeof window !== 'undefined')
    ? Math.min(window.innerWidth, window.innerHeight) <= 600
    : false;
  return (isMobileUA || isSmallScreen) ? 'mobile' : 'desktop';
}

function applySchedulingProfile(profile) {
  const profiles = {
    desktop:  { lookAhead: 0.02, updateInterval: 0.01 },
    balanced: { lookAhead: 0.03, updateInterval: 0.015 },
    mobile:   { lookAhead: 0.06, updateInterval: 0.03 },
  };
  const p = profiles[profile] || profiles.balanced;

  // Si Tone está disponible, aplicamos también al contexto global (opcional)
  try {
    const ctx = (typeof Tone !== 'undefined')
      ? (typeof Tone.getContext === 'function' ? Tone.getContext() : Tone.context)
      : null;
    if (ctx) {
      if (typeof ctx.lookAhead !== 'undefined') ctx.lookAhead = p.lookAhead;
      if (typeof ctx.updateInterval !== 'undefined') ctx.updateInterval = p.updateInterval;
    }
  } catch {}

  // Notificamos a las apps (cada app puede aplicarlo a su motor)
  window.dispatchEvent(new CustomEvent('sharedui:scheduling', { detail: { profile, ...p } }));
}

function applyTheme(value) {
  const v = value || 'system';
  if (v === 'system') {
    const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.body.dataset.theme = dark ? 'dark' : 'light';
  } else {
    document.body.dataset.theme = v;
  }
  window.dispatchEvent(new CustomEvent('sharedui:theme', { detail: { value: document.body.dataset.theme, raw: v } }));
}

function setSelectionColor(value) {
  const v = value || '#FFBB97';
  document.documentElement.style.setProperty('--selection-color', v);
  window.dispatchEvent(new CustomEvent('sharedui:selectioncolor', { detail: { value: v } }));
}

function setMute(value) {
  const v = !!value;
  try {
    if (typeof Tone !== 'undefined' && Tone.Destination) {
      Tone.Destination.mute = v;
    }
  } catch {}
  window.dispatchEvent(new CustomEvent('sharedui:mute', { detail: { value: v } }));
}

function wireMenu(detailsEl) {
  if (!detailsEl) return;
  const content = detailsEl.querySelector('.options-content');
  if (!content) return;

  // Close the menu if user interacts outside while it's open
  // Use pointerdown to avoid interfering with native <select> popups
  const handleOutside = (e) => {
    const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
    const inside = detailsEl.contains(e.target) || (path.length && path.includes(detailsEl));
    if (detailsEl.open && !inside) {
      detailsEl.removeAttribute('open');
    }
  };

  function solidMenuBackground(panel){
    if(!panel) return;
    const theme = document.body?.dataset?.theme || 'light';
    const rootStyles = getComputedStyle(document.documentElement);
    const bgVar = theme === 'dark' ? '--bg-dark' : '--bg-light';
    const txtVar = theme === 'dark' ? '--text-dark' : '--text-light';
    const bg = rootStyles.getPropertyValue(bgVar).trim() || getComputedStyle(document.body).backgroundColor;
    const txt = rootStyles.getPropertyValue(txtVar).trim() || getComputedStyle(document.body).color;
    panel.style.backgroundColor = bg;
    panel.style.color = txt;
    panel.style.backgroundImage = 'none';
  }

  detailsEl.addEventListener('toggle', () => {
    if (detailsEl.open) {
      document.addEventListener('pointerdown', handleOutside);
      solidMenuBackground(content);
      content.classList.add('opening');
      content.classList.remove('closing');
      content.style.maxHeight = content.scrollHeight + 'px';
      content.addEventListener('transitionend', () => {
        content.classList.remove('opening');
        content.style.maxHeight = '';
      }, { once: true });
    } else {
      document.removeEventListener('pointerdown', handleOutside);
      content.classList.add('closing');
      content.classList.remove('opening');
      content.style.maxHeight = content.scrollHeight + 'px';
      content.offsetHeight; // force reflow
      content.style.maxHeight = '0px';
      content.addEventListener('transitionend', () => {
        content.classList.remove('closing');
        content.style.maxHeight = '';
      }, { once: true });
    }
  });

  // Re-apply if theme changes while menu is open
  window.addEventListener('sharedui:theme', () => {
    if (detailsEl.open) solidMenuBackground(content);
  });
}

function wireControls(root) {
  const themeSelect = root.querySelector('#themeSelect');
  const hoverToggle = root.querySelector('#hoverToggle');
  const muteToggle = root.querySelector('#muteToggle');
  const selectColor = root.querySelector('#selectColor');
  const schedSelect = root.querySelector('#schedProfileSelect');

  if (themeSelect) {
    applyTheme(themeSelect.value);
    themeSelect.addEventListener('change', (e) => applyTheme(e.target.value));
  } else {
    applyTheme('system');
  }

  if (hoverToggle) {
    window.__hoversEnabled = hoverToggle.checked;
    hoverToggle.addEventListener('change', (e) => {
      window.__hoversEnabled = e.target.checked;
      if (!e.target.checked) {
        document.querySelectorAll('.hover-tip').forEach(t => t.classList.remove('show'));
      }
      window.dispatchEvent(new CustomEvent('sharedui:hover', { detail: { value: e.target.checked } }));
    });
  } else {
    window.__hoversEnabled = true;
  }

  if (selectColor) {
    const initial = selectColor.value || getComputedStyle(document.documentElement).getPropertyValue('--selection-color').trim() || '#FFBB97';
    selectColor.value = initial;
    setSelectionColor(initial);
    selectColor.addEventListener('input', (e) => setSelectionColor(e.target.value));
  }

  if (muteToggle) {
    setMute(muteToggle.checked);
    muteToggle.addEventListener('change', (e) => setMute(e.target.checked));
  }

  // Scheduling profile (nuevo)
  if (schedSelect) {
    const def = detectDeviceProfile();
    // Després (força el valor per defecte segons dispositiu)
    schedSelect.value = def;       // 'mobile' o 'desktop' segons detectDeviceProfile()
    applySchedulingProfile(def);
    schedSelect.addEventListener('change', (e) => applySchedulingProfile(e.target.value));
  } else {
    // Fallback: aplica perfil por defecto aunque el header no tenga el select
    applySchedulingProfile(detectDeviceProfile());
  }
}

export function initHeader() {
  const header = document.querySelector('header.top-bar');
  const menu = document.querySelector('header.top-bar details.menu');
  if (header && menu) {
    wireMenu(menu);
    wireControls(header);
    return { header, menu };
  }
  return renderHeader({ title: document.title || 'App' });
}

export function renderHeader({ title = 'App', mount } = {}) {
  const container = mount || document.body;
  const header = document.createElement('header');
  header.className = 'top-bar';
  header.innerHTML = `
    <details class="menu" id="optionsMenu">
      <summary>☰</summary>
      <div class="options-content">
        <label for="schedProfileSelect">Rendimiento:
          <select id="schedProfileSelect">
            <option value="mobile">Móvil</option>
            <option value="balanced" selected>Equilibrado</option>
            <option value="desktop">Escritorio</option>
          </select>
        </label>
        <label for="themeSelect">Tema:
          <select id="themeSelect">
            <option value="system" selected>Sistema</option>
            <option value="light">Claro</option>
            <option value="dark">Oscuro</option>
          </select>
        </label>
        <label for="hoverToggle">Etiquetas de ayuda <input type="checkbox" id="hoverToggle" checked /></label>
        <label for="muteToggle">Silencio <input type="checkbox" id="muteToggle" /></label>
        <label for="selectColor">Color selección <input type="color" id="selectColor" value="#FFBB97" /></label>
        <hr class="menu-separator" />
      </div>
    </details>
    <h1>${title}</h1>
  `;
  container.prepend(header);
  const menu = header.querySelector('details.menu');
  wireMenu(menu);
  wireControls(header);
  return { header, menu };
}
