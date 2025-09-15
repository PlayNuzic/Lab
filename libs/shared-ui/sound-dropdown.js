import { soundNames, soundLabels } from '../sound/index.js';

export function initSoundDropdown(container, { storageKey, eventType, getAudio, apply }) {
  if (!container) return;
  // Prevent double enhancement (e.g., if both header and app try to init)
  if (container.dataset.enhanced === '1') return;
  container.dataset.enhanced = '1';

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
    li.tabIndex = -1; // keep focus transitions inside the menu
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
  let pending = selected; // preview selection while panel is open

  function updateLabel() {
    toggle.textContent = soundLabels[selected] || selected;
    container.dataset.value = selected;
  }

  function updateListHighlight() {
    const children = [...list.children];
    children.forEach(li => li.classList.remove('selected', 'pending'));
    // Highlight the current pending choice
    children.forEach(li => {
      if (li.dataset.value === pending) li.classList.add('selected');
    });
  }

  function openPanel() {
    pending = selected;
    updateListHighlight();
    panel.style.display = 'block';
  }

  function isOpen() {
    return panel.style.display === 'block';
  }

  function indexOf(val){
    const i = soundNames.indexOf(val);
    return i < 0 ? 0 : i;
  }

  async function previewPending(){
    try {
      const a = await getAudio();
      if (a && typeof a.preview === 'function') a.preview(pending);
    } catch {}
  }

  async function movePending(delta){
    const idx = indexOf(pending);
    const next = (idx + delta + soundNames.length) % soundNames.length;
    pending = soundNames[next];
    updateListHighlight();
    await previewPending();
  }

  async function commitSelection() {
    if (pending === selected) return; // nothing to commit
    selected = pending;
    updateLabel();
    try { localStorage.setItem(storageKey, selected); } catch {}
    const a = await getAudio();
    await apply(a, selected);
    if (a && typeof a.preview === 'function') a.preview(selected);
    window.dispatchEvent(new CustomEvent('sharedui:sound', { detail: { type: eventType, value: selected } }));
  }

  async function commitAndClose() {
    await commitSelection();
    panel.style.display = 'none';
  }

  updateLabel();

  // Toggle open/close without affecting the outer menu state
  toggle.addEventListener('pointerdown', e => { e.stopPropagation(); });
  toggle.addEventListener('click', e => {
    e.stopPropagation();
    if (panel.style.display === 'block') {
      panel.style.display = 'none';
    } else {
      openPanel();
    }
  });

  // Keyboard navigation (Arrow keys) and commit shortcuts
  function onKeyDown(e){
    const k = e.key;
    if (k === 'ArrowDown' || k === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      if (!isOpen()) openPanel();
      movePending(+1);
    } else if (k === 'ArrowUp' || k === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      if (!isOpen()) openPanel();
      movePending(-1);
    } else if (k === 'Enter') {
      // Commit current pending like pressing "Salir"
      e.preventDefault();
      e.stopPropagation();
      if (isOpen()) {
        commitAndClose();
      } else {
        openPanel();
      }
    } else if (k === 'Escape') {
      // Only close our dropdown, keep the whole options menu open
      if (isOpen()) {
        e.preventDefault();
        e.stopPropagation();
        panel.style.display = 'none';
      }
    }
  }
  // Listen on both the toggle and the container for reliability
  toggle.addEventListener('keydown', onKeyDown);
  container.addEventListener('keydown', onKeyDown);

  // Preview on item click; do not commit until exit/outside
  list.addEventListener('pointerdown', e => { e.stopPropagation(); });
  list.addEventListener('click', async e => {
    const li = e.target.closest('li');
    if (!li) return;
    e.stopPropagation();
    pending = li.dataset.value;
    updateListHighlight();
    previewPending();
  });

  exitBtn.addEventListener('pointerdown', e => { e.stopPropagation(); });
  exitBtn.addEventListener('click', async e => {
    e.stopPropagation();
    await commitAndClose();
  });

  // Close on outside click; commit the last previewed option
  const onDocClick = async (e) => {
    if (!container.contains(e.target)) {
      await commitAndClose();
    }
  };
  document.addEventListener('click', onDocClick, true);
}
