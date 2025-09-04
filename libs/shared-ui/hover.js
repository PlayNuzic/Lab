export function attachHover(el, { text = '', color = '#fff', background = 'rgba(0,0,0,0.6)', size = '0.75rem' } = {}) {
  if (!el) return;
  const tip = document.createElement('div');
  tip.className = 'hover-tip';
  tip.textContent = text;
  document.body.appendChild(tip);

  function show() {
    if (window.__hoversEnabled === false) return;
    tip.textContent = text;
    tip.style.background = background;
    tip.style.color = color;
    tip.style.fontSize = size;
    const rect = el.getBoundingClientRect();
    tip.style.left = rect.left + rect.width / 2 + 'px';
    tip.style.top = rect.top + window.scrollY + 'px';
    tip.classList.add('show');
  }

  function hide() {
    tip.classList.remove('show');
  }

  el.addEventListener('mouseenter', show);
  el.addEventListener('mouseleave', hide);
}
