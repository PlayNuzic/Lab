const DEFAULT_OVERLAY_IDS = ['pulseSeqHighlight', 'pulseSeqHighlight2'];

function defaultMarkupBuilder({ root, initialText }) {
  if (!root) return { editEl: null };
  const mk = (cls, txt) => {
    const span = document.createElement('span');
    span.className = `pz ${cls}`;
    if (txt != null) span.textContent = txt;
    return span;
  };
  root.textContent = '';
  const edit = mk('edit', initialText);
  edit.contentEditable = 'true';
  root.append(
    mk('prefix', 'Pulsos ('),
    mk('zero', '0'),
    edit,
    mk('suffix', ')'),
    mk('lg', '')
  );
  return { editEl: edit };
}

function ensureOverlay(id, parent) {
  if (!id || !parent) return null;
  let overlay = document.getElementById(id);
  if (overlay) {
    if (overlay.parentNode !== parent) {
      overlay.parentNode?.removeChild(overlay);
      parent.appendChild(overlay);
    }
    return overlay;
  }
  overlay = document.createElement('div');
  overlay.id = id;
  parent.appendChild(overlay);
  return overlay;
}

function normalizeRangeValue(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function placeOverlay({ rect, el, host, scrollLeft, scrollTop }) {
  if (!rect || !el || !host) {
    if (el) el.classList.remove('active');
    return;
  }
  const hostRect = host.getBoundingClientRect();
  const sx = Number.isFinite(scrollLeft) ? scrollLeft : host.scrollLeft;
  const sy = Number.isFinite(scrollTop) ? scrollTop : host.scrollTop;
  const cx = rect.left - hostRect.left + sx + rect.width / 2;
  const cy = rect.top - hostRect.top + sy + rect.height / 2;
  const size = Math.max(rect.width, rect.height) * 0.75;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.left = `${cx}px`;
  el.style.top = `${cy}px`;
  el.classList.remove('active');
  void el.offsetWidth;
  el.classList.add('active');
}

export default function createPulseSeqController(options = {}) {
  const state = {
    datasetFlag: options.datasetFlag || 'seqInited',
    overlayIds: Array.isArray(options.overlayIds) && options.overlayIds.length
      ? options.overlayIds.slice(0, 2)
      : DEFAULT_OVERLAY_IDS.slice(0, 2),
    root: null,
    editEl: null,
    overlayParent: null,
    highlightEls: [null, null],
    rectResolver: null,
    onTextSet: typeof options.onTextSet === 'function' ? options.onTextSet : null,
    memory: [],
    drag: {
      isDragging: false,
      dragMode: 'select',
      lastKey: null,
      suppressKey: null,
      detach: [],
      resolveTarget: null,
      applySelection: null,
      isSelectionActive: null,
      onDragStart: null,
      onDragEnd: null
    }
  };

  function resolveEditElement(root) {
    if (!root) return null;
    return root.querySelector('.pz.edit') || root;
  }

  function mount(config = {}) {
    const host = config.root || state.root;
    if (!host) return null;
    const datasetFlag = config.datasetFlag || state.datasetFlag;

    let alreadyInit = host.dataset?.[datasetFlag] === '1';
    if (!alreadyInit) {
      const initialText = (host.textContent || '').trim();
      const builder = typeof config.markupBuilder === 'function'
        ? config.markupBuilder
        : defaultMarkupBuilder;
      const result = builder({ root: host, initialText });
      const edit = result && result.editEl ? result.editEl : resolveEditElement(host);
      state.editEl = edit;
      host.dataset[datasetFlag] = '1';
      alreadyInit = true;
    }

    state.root = host;
    if (!state.editEl) {
      state.editEl = resolveEditElement(host);
    }

    state.overlayParent = config.highlightParent || host;
    state.overlayIds.forEach((id, idx) => {
      state.highlightEls[idx] = ensureOverlay(id, state.overlayParent);
    });

    if (typeof config.onMarkupReady === 'function') {
      config.onMarkupReady({
        root: host,
        editEl: state.editEl,
        highlightEls: state.highlightEls
      });
    }

    if (typeof config.onTextSet === 'function') {
      state.onTextSet = config.onTextSet;
    }

    if (typeof config.rectResolver === 'function') {
      state.rectResolver = config.rectResolver;
    }

    return {
      root: host,
      editEl: state.editEl,
      highlightEls: state.highlightEls.slice()
    };
  }

  function destroy() {
    state.drag.detach.forEach((fn) => {
      try { fn(); } catch {}
    });
    state.drag.detach = [];
    state.drag.isDragging = false;
    state.drag.lastKey = null;
    state.drag.suppressKey = null;
  }

  function getText() {
    if (!state.editEl) return '';
    return state.editEl.textContent || '';
  }

  function setText(value, opts = {}) {
    if (!state.editEl) return;
    const str = String(value ?? '');
    state.editEl.textContent = str;
    const handler = opts.onTextSet || state.onTextSet;
    if (typeof handler === 'function') {
      handler(str);
    }
  }

  function getOrCreateTextNode() {
    if (!state.editEl) return null;
    let node = state.editEl.firstChild;
    if (!node) {
      node = document.createTextNode('');
      state.editEl.appendChild(node);
    }
    return node;
  }

  function setSelectionRange(start, end) {
    if (!state.editEl) return;
    try {
      const node = getOrCreateTextNode();
      if (!node) return;
      const len = node.textContent.length;
      const s = normalizeRangeValue(start, 0);
      const e = normalizeRangeValue(end, len);
      const range = document.createRange();
      range.setStart(node, Math.max(0, Math.min(len, s)));
      range.setEnd(node, Math.max(0, Math.min(len, e)));
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch {}
  }

  function caretPosition() {
    if (!state.editEl) return 0;
    try {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return 0;
      const range = sel.getRangeAt(0);
      if (!state.editEl.contains(range.startContainer)) return 0;
      return range.startOffset;
    } catch {
      return 0;
    }
  }

  function collectMidpoints(text) {
    const mids = [];
    for (let i = 1; i < text.length; i += 1) {
      if (text[i - 1] === ' ' && text[i] === ' ') {
        mids.push(i);
      }
    }
    return mids;
  }

  function moveCaretToNearestMidpoint() {
    if (!state.editEl) return;
    const node = getOrCreateTextNode();
    if (!node) return;
    const text = node.textContent || '';
    const mids = collectMidpoints(text);
    if (!mids.length) return;
    const pos = caretPosition();
    let best = mids[0];
    let bestDist = Math.abs(pos - best);
    mids.forEach((mid) => {
      const dist = Math.abs(pos - mid);
      if (dist < bestDist) {
        best = mid;
        bestDist = dist;
      }
    });
    setSelectionRange(best, best);
  }

  function moveCaretStep(direction = 1) {
    if (!state.editEl) return;
    const dir = direction >= 0 ? 1 : -1;
    const node = getOrCreateTextNode();
    if (!node) return;
    const text = node.textContent || '';
    const mids = collectMidpoints(text);
    if (!mids.length) return;
    const pos = caretPosition();
    if (dir > 0) {
      for (let i = 0; i < mids.length; i += 1) {
        if (mids[i] > pos) {
          setSelectionRange(mids[i], mids[i]);
          return;
        }
      }
      setSelectionRange(mids[mids.length - 1], mids[mids.length - 1]);
    } else {
      for (let i = mids.length - 1; i >= 0; i -= 1) {
        if (mids[i] < pos) {
          setSelectionRange(mids[i], mids[i]);
          return;
        }
      }
      setSelectionRange(mids[0], mids[0]);
    }
  }

  function ensureMemory(size) {
    const target = Math.max(0, Number(size) || 0);
    if (target >= state.memory.length) {
      for (let i = state.memory.length; i <= target; i += 1) {
        state.memory[i] = false;
      }
    }
  }

  function setMemory(index, value) {
    const idx = Math.max(0, Number(index) || 0);
    ensureMemory(idx);
    state.memory[idx] = !!value;
  }

  function clearMemory() {
    state.memory.length = 0;
  }

  function setRectResolver(resolver) {
    state.rectResolver = typeof resolver === 'function' ? resolver : null;
  }

  function setActiveIndex(index, options = {}) {
    const { highlightEls } = state;
    const primary = highlightEls[0];
    const secondary = highlightEls[1];
    const host = state.overlayParent || state.root;
    if (!host) return;

    if (index == null || !Number.isFinite(Number(index))) {
      if (primary) primary.classList.remove('active');
      if (secondary) secondary.classList.remove('active');
      return;
    }

    const rectResolver = options.getRect || state.rectResolver;
    const rect = options.rect || (rectResolver ? rectResolver(index) : null);
    placeOverlay({
      rect,
      el: primary,
      host,
      scrollLeft: options.scrollLeft,
      scrollTop: options.scrollTop
    });

    if (secondary) {
      const trailingIndex = options.trailingIndex;
      if (trailingIndex != null) {
        const trailingRect = options.trailingRect
          || (rectResolver ? rectResolver(trailingIndex) : null);
        placeOverlay({
          rect: trailingRect,
          el: secondary,
          host,
          scrollLeft: options.scrollLeft,
          scrollTop: options.scrollTop
        });
      } else {
        secondary.classList.remove('active');
      }
    }
  }

  function clearActive() {
    state.highlightEls.forEach((el) => {
      if (el) el.classList.remove('active');
    });
  }

  function attachDragHandlers({
    timeline,
    resolveTarget,
    applySelection,
    isSelectionActive,
    onDragStart,
    onDragEnd
  } = {}) {
    destroyDrag();
    state.drag.resolveTarget = typeof resolveTarget === 'function' ? resolveTarget : null;
    state.drag.applySelection = typeof applySelection === 'function' ? applySelection : null;
    state.drag.isSelectionActive = typeof isSelectionActive === 'function' ? isSelectionActive : null;
    state.drag.onDragStart = typeof onDragStart === 'function' ? onDragStart : null;
    state.drag.onDragEnd = typeof onDragEnd === 'function' ? onDragEnd : null;

    if (!timeline || typeof timeline.addEventListener !== 'function') return;

    const handlePointerDown = (event) => {
      const info = state.drag.resolveTarget
        ? state.drag.resolveTarget({ event, target: event.target })
        : null;
      if (!info || !info.key) {
        state.drag.isDragging = false;
        state.drag.lastKey = null;
        state.drag.suppressKey = null;
        state.drag.dragMode = 'select';
        return;
      }
      const active = state.drag.isSelectionActive
        ? !!state.drag.isSelectionActive(info)
        : false;
      state.drag.dragMode = active ? 'deselect' : 'select';
      state.drag.isDragging = true;
      state.drag.lastKey = info.key;
      state.drag.suppressKey = info.key;
      state.drag.applySelection?.(info, state.drag.dragMode === 'select');
      state.drag.onDragStart?.({ info, mode: state.drag.dragMode });
    };

    const handlePointerUp = () => {
      if (!state.drag.isDragging) return;
      state.drag.isDragging = false;
      state.drag.lastKey = null;
      state.drag.onDragEnd?.();
    };

    const handlePointerCancel = () => {
      state.drag.isDragging = false;
      state.drag.lastKey = null;
      state.drag.suppressKey = null;
      state.drag.onDragEnd?.();
    };

    timeline.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerCancel);

    state.drag.detach.push(() => timeline.removeEventListener('pointerdown', handlePointerDown));
    state.drag.detach.push(() => document.removeEventListener('pointerup', handlePointerUp));
    state.drag.detach.push(() => document.removeEventListener('pointercancel', handlePointerCancel));
  }

  function destroyDrag() {
    state.drag.detach.forEach((fn) => {
      try { fn(); } catch {}
    });
    state.drag.detach = [];
    state.drag.isDragging = false;
    state.drag.dragMode = 'select';
    state.drag.lastKey = null;
    state.drag.suppressKey = null;
  }

  function handleDragEnter(info) {
    if (!state.drag.isDragging) return;
    if (!info || !info.key) return;
    if (state.drag.lastKey === info.key) return;
    state.drag.lastKey = info.key;
    state.drag.applySelection?.(info, state.drag.dragMode === 'select');
  }

  function shouldSuppressClick(key) {
    return key != null && key === state.drag.suppressKey;
  }

  function consumeSuppressClick(key) {
    if (key != null && key === state.drag.suppressKey) {
      state.drag.suppressKey = null;
      return true;
    }
    return false;
  }

  return {
    mount,
    destroy,
    getText,
    setText,
    setSelectionRange,
    moveCaretToNearestMidpoint,
    moveCaretStep,
    setActiveIndex,
    clearActive,
    setRectResolver,
    memory: {
      ensure: ensureMemory,
      set: setMemory,
      clear: clearMemory,
      data: state.memory
    },
    drag: {
      attach: attachDragHandlers,
      destroy: destroyDrag,
      handleEnter: handleDragEnter,
      shouldSuppressClick,
      consumeSuppressClick,
      isDragging: () => state.drag.isDragging,
      mode: () => state.drag.dragMode
    },
    callbacks: {
      moveCaretToNearestMidpoint,
      moveCaretStep,
      handleDragEnter,
      shouldSuppressClick,
      consumeSuppressClick
    },
    getEditElement: () => state.editEl
  };
}
