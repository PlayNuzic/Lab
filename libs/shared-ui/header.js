// Shared UI header for Lab: mirrors App1 header behavior

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

  detailsEl.addEventListener('toggle', () => {
    if (detailsEl.open) {
      content.classList.add('opening');
      content.classList.remove('closing');
      content.style.maxHeight = content.scrollHeight + 'px';
      content.addEventListener('transitionend', () => {
        content.classList.remove('opening');
        content.style.maxHeight = '';
      }, { once: true });
    } else {
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
}

function wireControls(root) {
  const themeSelect = root.querySelector('#themeSelect');
  const muteToggle = root.querySelector('#muteToggle');
  const selectColor = root.querySelector('#selectColor');

  if (themeSelect) {
    applyTheme(themeSelect.value);
    themeSelect.addEventListener('change', (e) => applyTheme(e.target.value));
  } else {
    applyTheme('system');
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
        <label for="themeSelect">Tema:
          <select id="themeSelect">
            <option value="system" selected>Sistema</option>
            <option value="light">Claro</option>
            <option value="dark">Oscuro</option>
          </select>
        </label>
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
