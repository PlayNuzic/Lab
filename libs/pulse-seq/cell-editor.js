// libs/pulse-seq/cell-editor.js
// Editor de seqüència per cel·les (patró App12 "P-row"):
//   [valor][separador][valor][separador]…[input actiu][separador]
// Extret d'App28/29 (tokens Pfr) i App30/31 (enters iT), que en duplicaven
// ~250 línies cadascuna (auditoria H-02).
//
// El factory posseeix el DOM i NOMÉS el DOM: render de cel·les, timers de
// commit, navegació per teclat i gestió de focus. El MODEL és de l'app via
// callbacks: els que muten retornen `true` si han aplicat el canvi (l'app
// ja haurà re-renderitzat via editor.render() dins el seu sync) o `false`
// perquè el factory restauri l'estat visual de la cel·la.

/** Valor numèric d'un token fraccionari "B.S" per ordenar: B + S/d. */
export function fractionTokenValue(token, denominator = 1) {
  if (typeof token !== 'string') return -1;
  const trimmed = token.trim();
  if (trimmed.includes('.')) {
    const parts = trimmed.split('.');
    const base = parseInt(parts[0], 10) || 0;
    const subdiv = parseInt(parts[1], 10) || 0;
    const d = denominator || 1;
    return base + subdiv / d;
  }
  return parseInt(trimmed, 10) || 0;
}

/** Normalitza un token: "01"→"1", "1.03"→"1.3", ".2"→"0.2" (base 0 implícita),
 *  "5.0"→"5" (subdivisió 0 = el pols enter mateix). */
export function normalizeFractionToken(token) {
  if (typeof token !== 'string') return '';
  const trimmed = token.trim();
  if (!trimmed) return '';
  if (trimmed.includes('.')) {
    const [base, subdiv] = trimmed.split('.');
    const b = parseInt(base, 10) || 0;
    const s = parseInt(subdiv, 10) || 0;
    // Subdivisió 0 = el pols enter mateix → "5.0" es normalitza a "5".
    return s === 0 ? String(b) : `${b}.${s}`;
  }
  const n = parseInt(trimmed, 10);
  return Number.isFinite(n) ? String(n) : '';
}

/**
 * Crea un editor de cel·les de seqüència.
 *
 * @param {Object} config
 * @param {HTMLElement} config.host - Contenidor de cel·les (.pfr-cells / .itfr-cells)
 * @param {HTMLElement} [config.endMarker] - Node fix que es preserva al final (App28/29)
 * @param {Object} [config.classes] - { base, value, separator, input } per variant CSS
 * @param {Object} [config.input] - Comportament de la cel·la d'entrada (vegeu defaults)
 * @param {Function} config.getEntries - () => [{ display, token? }] compromesos en ordre
 * @param {Function} [config.showTrailingInput] - () => bool (iTfr: només si queda espai)
 * @param {Function} config.onCommitInput - (raw) => bool — commit de l'input actiu
 * @param {Function} config.onEditEntry - (index, raw) => bool — blur de cel·la ('' = esborrar)
 * @param {Function} config.onDeleteLast - () => void — Backspace amb input buit
 * @returns {{ render: Function, getActiveInput: Function, focusInput: Function }}
 */
export function createCellSequenceEditor({
  host,
  endMarker = null,
  classes = {},
  input: inputCfg = {},
  getEntries,
  showTrailingInput = () => true,
  onCommitInput,
  onEditEntry,
  onDeleteLast
}) {
  const cls = {
    base: classes.base ?? 'editor-cell',
    value: classes.value ?? '',
    separator: classes.separator ?? '',
    input: classes.input ?? '',
    silence: classes.silence ?? 'is-silence'
  };
  const cfg = {
    maxLength: inputCfg.maxLength ?? 4,
    inputMode: inputCfg.inputMode ?? null,
    commitDelay: inputCfg.commitDelay ?? 1000,
    // classify(raw) → 'defer' | 'wait' | 'commit' | 'clear' | { sanitize }
    classify: inputCfg.classify ?? (() => 'defer'),
    commitOnBlur: inputCfg.commitOnBlur ?? false,           // iTfr
    doubleCommitGuard: inputCfg.doubleCommitGuard ?? false, // iTfr (lliçó S25/S30)
    arrowNav: inputCfg.arrowNav ?? false,                   // Pfr
    emptyEnterTab: inputCfg.emptyEnterTab ?? false,         // Pfr
    refocusAfterCommit: inputCfg.refocusAfterCommit ?? false, // iTfr
    refocusOnInvalid: inputCfg.refocusOnInvalid ?? false      // iTfr
  };

  let activeInput = null;
  let commitTimer = null;
  const clearTimer = () => { clearTimeout(commitTimer); commitTimer = null; };

  const editableCells = () =>
    Array.from(host.querySelectorAll('input:not([readonly])'));
  const nextEditable = (cell) => {
    const all = editableCells();
    return all[all.indexOf(cell) + 1] || null;
  };
  const prevEditable = (cell) => {
    const all = editableCells();
    return all[all.indexOf(cell) - 1] || null;
  };

  function appendCell(cell) {
    if (endMarker) host.insertBefore(cell, endMarker);
    else host.appendChild(cell);
  }

  function createSeparator() {
    const cell = document.createElement('input');
    cell.type = 'text';
    cell.className = `${cls.base} ${cls.separator}`.trim();
    cell.placeholder = ' ';
    cell.readOnly = true;
    cell.tabIndex = -1;
    return cell;
  }

  function createValueCell(entry, entryIndex) {
    const cell = document.createElement('input');
    cell.type = 'text';
    cell.className = `${cls.base} ${cls.value}`.trim();
    cell.value = entry.display;
    if (entry.token != null) cell.dataset.token = entry.token;
    // Entrada de silenci (forat al model): cel·la buida amb classe pròpia
    // perquè l'app l'estili; editable — escriure-hi un número omple el forat.
    if (entry.silence) cell.classList.add(cls.silence || 'is-silence');
    cell.dataset.entryIndex = String(entryIndex);
    cell.readOnly = false;
    cell.style.cursor = 'text';

    let originalValue = cell.value;
    cell.addEventListener('focus', () => { originalValue = cell.value; cell.select(); });

    cell.addEventListener('blur', () => {
      const raw = cell.value.trim();
      if (raw === originalValue) { cell.value = originalValue; return; }
      const ok = onEditEntry(entryIndex, raw);
      // false → el model no ha canviat (invàlid/duplicat): restaurem.
      if (!ok) cell.value = originalValue;
    });

    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); cell.blur(); return; }
      if (e.key === 'Tab') {
        e.preventDefault();
        cell.blur();   // pot re-renderitzar; llavors next/prev dona null (paritat)
        const next = e.shiftKey ? prevEditable(cell) : nextEditable(cell);
        if (next) next.focus();
        return;
      }
      if (cfg.arrowNav && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        const target = e.key === 'ArrowRight' ? nextEditable(cell) : prevEditable(cell);
        if (target) { e.preventDefault(); target.focus(); target.select?.(); }
      }
    });
    return cell;
  }

  function createInputCell() {
    const cell = document.createElement('input');
    cell.type = 'text';
    cell.maxLength = cfg.maxLength;
    if (cfg.inputMode) cell.inputMode = cfg.inputMode;
    cell.className = `${cls.base} ${cls.input}`.trim();
    cell.readOnly = false;

    // Guard anti doble-commit (iTfr): input-debounce + blur poden disparar
    // tots dos; després d'un commit la cel·la es re-renderitza (descartada
    // del DOM) i el blur arriba sobre l'element despenjat.
    let committed = false;
    const guardedCommit = () => {
      if (cfg.doubleCommitGuard && committed) return;
      if (cfg.doubleCommitGuard) committed = true;
      const ok = onCommitInput(cell.value.trim());
      if (!ok) {
        if (cfg.doubleCommitGuard) committed = false;
        cell.value = '';
        if (cfg.refocusOnInvalid) setTimeout(() => cell.focus(), 10);
      } else if (cfg.refocusAfterCommit) {
        setTimeout(() => activeInput?.focus(), 10);
      }
    };

    cell.addEventListener('input', () => {
      const raw = cell.value.trim();
      if (!raw) { clearTimer(); return; }
      const action = cfg.classify(raw);
      if (action && typeof action === 'object' && 'sanitize' in action) {
        cell.value = action.sanitize;   // paritat iTfr: no toca el timer pendent
        return;
      }
      if (action === 'defer') {
        clearTimer();
        commitTimer = setTimeout(guardedCommit, cfg.commitDelay);
        return;
      }
      if (action === 'wait') { clearTimer(); return; }
      if (action === 'commit') { clearTimer(); guardedCommit(); return; }
      cell.value = '';   // 'clear'
      clearTimer();
    });

    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        clearTimer();
        if (cell.value.trim()) { guardedCommit(); return; }
        if (cfg.emptyEnterTab) {
          const target = e.shiftKey ? prevEditable(cell) : nextEditable(cell);
          if (target) { target.focus(); target.select?.(); }
        }
        return;
      }
      if (cfg.arrowNav && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        const target = e.key === 'ArrowRight' ? nextEditable(cell) : prevEditable(cell);
        if (target) { e.preventDefault(); target.focus(); target.select?.(); }
        return;
      }
      if (e.key === 'Backspace' && !cell.value) {
        e.preventDefault();
        clearTimer();
        onDeleteLast();
      }
    });

    if (cfg.commitOnBlur) {
      cell.addEventListener('blur', () => {
        clearTimer();
        if (cell.value.trim()) guardedCommit();
      });
    }

    setTimeout(() => cell.focus(), 30);
    return cell;
  }

  function render() {
    clearTimer();
    if (endMarker) {
      Array.from(host.children).forEach(c => { if (c !== endMarker) c.remove(); });
    } else {
      host.innerHTML = '';
    }
    activeInput = null;
    getEntries().forEach((entry, idx) => {
      appendCell(createValueCell(entry, idx));
      appendCell(createSeparator());
    });
    if (showTrailingInput()) {
      const input = createInputCell();
      appendCell(input);
      appendCell(createSeparator());
      activeInput = input;
    }
  }

  return {
    render,
    getActiveInput: () => activeInput,
    focusInput: () => activeInput?.focus()
  };
}
