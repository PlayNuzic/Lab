export function attachHover(el, { text = '', color = '#fff', background = 'rgba(0,0,0,0.6)', size = '0.75rem' } = {}) {
  if (!el) return;
  const tip = document.createElement('div');
  tip.className = 'hover-tip';
  tip.textContent = text;
  document.body.appendChild(tip);

  function show() {
    if (window.__hoversEnabled === false) return;
    const resolvedText = el.dataset.hoverText ?? text;
    if (!resolvedText) {
      hide();
      return;
    }
    tip.textContent = resolvedText;
    tip.style.background = el.dataset.hoverBackground ?? background;
    tip.style.color = el.dataset.hoverColor ?? color;
    tip.style.fontSize = el.dataset.hoverSize ?? size;
    const rect = el.getBoundingClientRect();
    // Position fixed uses viewport coordinates - rect already gives us that
    tip.style.left = rect.left + rect.width / 2 + 'px';
    tip.style.top = rect.top + 'px';
    tip.classList.add('show');
  }

  function hide() {
    tip.classList.remove('show');
  }

  el.addEventListener('mouseenter', show);
  el.addEventListener('mouseleave', hide);
  // U-05: paritat per a teclat (Tab mostra l'ajuda igual que el hover)...
  el.addEventListener('focus', show);
  el.addEventListener('blur', hide);
  // ...i en tàctil el mouseenter emulat deixava el tip enganxat fins a
  // tocar un altre element: auto-amagat passats 2s quan no hi ha hover real.
  if (typeof matchMedia === 'function' && matchMedia('(hover: none)').matches) {
    el.addEventListener('touchend', () => {
      setTimeout(hide, 2000);
    }, { passive: true });
  }
}
