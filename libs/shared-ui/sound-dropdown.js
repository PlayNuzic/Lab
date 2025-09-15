import { soundNames, soundLabels } from '../sound/index.js';

export function initSoundDropdown(container, { storageKey, eventType, getAudio, apply }) {
  if (!container) return;
  container.classList.add('custom-dropdown');

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'dropdown-toggle';
  container.appendChild(toggle);

  const panel = document.createElement('div');
  panel.className = 'dropdown-panel';
  panel.style.display = 'none';

  const list = document.createElement('ul');
  soundNames.forEach(name => {
    const li = document.createElement('li');
    li.dataset.value = name;
    li.textContent = soundLabels[name] || name;
    list.appendChild(li);
  });
  panel.appendChild(list);

  const exitBtn = document.createElement('button');
  exitBtn.type = 'button';
  exitBtn.className = 'dropdown-exit';
  exitBtn.textContent = 'Salir';
  panel.appendChild(exitBtn);

  container.appendChild(panel);

  const stored = (() => { try { return localStorage.getItem(storageKey); } catch { return null; } })();
  let selected = (stored && soundNames.includes(stored)) ? stored : soundNames[0];

  function updateUI() {
    toggle.textContent = soundLabels[selected] || selected;
    [...list.children].forEach(li => li.classList.toggle('selected', li.dataset.value === selected));
    container.dataset.value = selected;
  }
  updateUI();

  toggle.addEventListener('click', e => {
    e.stopPropagation();
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
  });

  list.addEventListener('click', async e => {
    const li = e.target.closest('li');
    if (!li) return;
    e.stopPropagation();
    selected = li.dataset.value;
    updateUI();
    try { localStorage.setItem(storageKey, selected); } catch {}
    const a = await getAudio();
    await apply(a, selected);
    if (a && typeof a.preview === 'function') a.preview(selected);
    window.dispatchEvent(new CustomEvent('sharedui:sound', { detail: { type: eventType, value: selected } }));
  });

  function closePanel() { panel.style.display = 'none'; }
  exitBtn.addEventListener('click', closePanel);
  document.addEventListener('click', e => {
    if (!container.contains(e.target)) closePanel();
  });
}
