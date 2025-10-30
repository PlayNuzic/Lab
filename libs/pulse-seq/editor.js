/**
 * pulse-seq-editor.js
 *
 * Editor de secuencia de pulsos con navegación personalizada por gaps (dobles espacios).
 * Maneja contenteditable con eventos de teclado especiales para movimiento entre tokens.
 */

/**
 * Extrae midpoints (posiciones entre tokens, donde hay doble espacio)
 * @param {string} text - Texto del campo
 * @returns {number[]} - Array de posiciones de midpoints
 */
export function getMidpoints(text) {
  const a = [];
  for (let i = 1; i < text.length; i++) {
    if (text[i - 1] === ' ' && text[i] === ' ') {
      a.push(i);
    }
  }
  return a;
}

/**
 * Normaliza gaps asegurando dobles espacios entre tokens
 * @param {string} text - Texto sin normalizar
 * @returns {string} - Texto con gaps normalizados
 */
export function normalizeGaps(text) {
  if (typeof text !== 'string') return '  ';
  const trimmed = text.trim();
  if (!trimmed) return '  ';
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  return tokens.length ? `  ${tokens.join('  ')}  ` : '  ';
}

/**
 * Crea editor de secuencia de pulsos con navegación por gaps
 * @param {object} config - Configuración del editor
 * @param {HTMLElement} config.editElement - Elemento contenteditable
 * @param {HTMLElement} [config.visualLayer] - Capa visual para renderizado de tokens
 * @param {Function} [config.onTextChange] - Callback cuando cambia el texto
 * @param {Function} [config.onUpdateVisualLayer] - Callback para actualizar capa visual
 * @param {Function} [config.onSanitize] - Callback para sanitizar (blur, enter)
 * @returns {object} - API del editor
 */
export function createPulseSeqEditor({
  editElement,
  visualLayer = null,
  onTextChange = null,
  onUpdateVisualLayer = null,
  onSanitize = null
}) {

  const TEXT_NODE_TYPE = 3;

  /**
   * Obtiene el texto actual del editor
   */
  function getText() {
    const node = editElement.firstChild;
    if (!node) return '';
    return node.nodeType === TEXT_NODE_TYPE ? (node.textContent || '') : (editElement.textContent || '');
  }

  /**
   * Establece el texto del editor
   */
  function setText(str) {
    const node = editElement.firstChild;
    if (node && node.nodeType === TEXT_NODE_TYPE) {
      node.textContent = str;
    } else {
      editElement.textContent = str;
    }
    if (onUpdateVisualLayer) {
      onUpdateVisualLayer(str);
    }
    if (onTextChange) {
      onTextChange(str);
    }
  }

  /**
   * Establece la selección (caret)
   */
  function setSelection(start, end) {
    const node = editElement.firstChild;
    if (!node) return;

    const textLength = (node.textContent || '').length;
    const safeStart = Math.min(Math.max(0, start), textLength);
    const safeEnd = Math.min(Math.max(0, end), textLength);

    try {
      const range = document.createRange();
      range.setStart(node, safeStart);
      range.setEnd(node, safeEnd);
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } catch (error) {
      // Ignorar errores de rango
    }
  }

  /**
   * Obtiene la posición actual del caret
   */
  function getCaretPosition() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return 0;
    const range = sel.getRangeAt(0);
    if (!editElement.contains(range.startContainer)) return 0;
    return range.startOffset;
  }

  /**
   * Mueve el caret al midpoint más cercano
   */
  function moveCaretToNearestMidpoint() {
    const text = getText();
    const mids = getMidpoints(text);
    if (mids.length === 0) return;

    const pos = getCaretPosition();
    let best = mids[0];
    let minDist = Math.abs(pos - best);

    for (const m of mids) {
      const dist = Math.abs(pos - m);
      if (dist < minDist) {
        best = m;
        minDist = dist;
      }
    }

    setSelection(best, best);
  }

  /**
   * Mueve el caret un paso en la dirección indicada
   * @param {number} dir - Dirección (-1 izquierda, +1 derecha)
   */
  function moveCaretStep(dir) {
    const text = getText();
    const mids = getMidpoints(text);
    if (mids.length === 0) return;

    const pos = getCaretPosition();

    if (dir < 0) {
      // Mover a la izquierda
      for (let i = mids.length - 1; i >= 0; i--) {
        if (mids[i] < pos) {
          setSelection(mids[i], mids[i]);
          return;
        }
      }
      // Si no hay anterior, ir al primero
      setSelection(mids[0], mids[0]);
    } else {
      // Mover a la derecha
      for (let i = 0; i < mids.length; i++) {
        if (mids[i] > pos) {
          setSelection(mids[i], mids[i]);
          return;
        }
      }
      // Si no hay siguiente, ir al último
      setSelection(mids[mids.length - 1], mids[mids.length - 1]);
    }
  }

  /**
   * Handler de teclas de navegación
   */
  function handleKeyDown(e) {
    // Enter: sanitizar
    if (e.key === 'Enter') {
      e.preventDefault();
      if (onSanitize) {
        onSanitize({ causedBy: 'enter' });
      }
      return;
    }

    // Navegación por gaps
    if (e.key === 'ArrowLeft' || e.key === 'Home') {
      e.preventDefault();
      moveCaretStep(-1);
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'End') {
      e.preventDefault();
      moveCaretStep(1);
      return;
    }

    // Permitir solo dígitos, punto, navegación y espacio
    const allowed = new Set([
      'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight',
      'ArrowUp', 'ArrowDown', 'Home', 'End', 'Tab', ' '
    ]);
    if (!/^[0-9]$/.test(e.key) && e.key !== '.' && !allowed.has(e.key)) {
      e.preventDefault();
      return;
    }

    // Espacio: normalizar y mover al midpoint
    if (e.key === ' ') {
      e.preventDefault();
      const text = getText();
      const pos = getCaretPosition();
      const mids = getMidpoints(text);

      // Si estamos en midpoint, no hacer nada
      if (mids.includes(pos)) return;

      // Normalizar y mover
      const normalized = normalizeGaps(text);
      if (normalized !== text) {
        setText(normalized);
        const newMids = getMidpoints(normalized);
        if (newMids.length > 0) {
          // Buscar midpoint más cercano a la posición original
          let best = newMids[0];
          let minDist = Math.abs(pos - best);
          for (const m of newMids) {
            const dist = Math.abs(pos - m);
            if (dist < minDist) {
              best = m;
              minDist = dist;
            }
          }
          setSelection(best, best);
        } else {
          setSelection(0, 0);
        }
      } else {
        setSelection(0, 0);
      }
      return;
    }

    // Backspace: borrar token a la izquierda
    if (e.key === 'Backspace') {
      e.preventDefault();
      handleBackspace();
      return;
    }

    // Delete: borrar token a la derecha
    if (e.key === 'Delete') {
      e.preventDefault();
      handleDelete();
      return;
    }
  }

  /**
   * Handler de Backspace: borra token a la izquierda
   */
  function handleBackspace() {
    const node = editElement.firstChild || editElement;
    let text = node.textContent || '';

    const sel = window.getSelection && window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const rng = sel.getRangeAt(0);
    if (!editElement.contains(rng.startContainer)) return;

    let pos = rng.startOffset;
    if (pos <= 0 || text.length === 0) return;

    // Ajustar al midpoint más cercano
    const mids = getMidpoints(text);
    if (mids.length) {
      let best = mids[0];
      let minDist = Math.abs(pos - best);
      for (const m of mids) {
        const dist = Math.abs(pos - m);
        if (dist < minDist) {
          best = m;
          minDist = dist;
        }
      }
      pos = best;
    }

    // Buscar token a la izquierda del midpoint
    const isDigit = (c) => c >= '0' && c <= '9';
    let i = pos - 1;

    // Saltar espacios
    while (i >= 0 && text[i] === ' ') i--;
    if (i < 0) return; // No hay número a la izquierda
    if (!(isDigit(text[i]) || text[i] === '.')) return;

    const endNum = i + 1;
    let startNum = i;

    // Retroceder por dígitos
    while (startNum >= 0 && isDigit(text[startNum])) startNum--;

    // Si hay punto, incluirlo
    if (startNum >= 0 && text[startNum] === '.') {
      startNum--;
      // Incluir dígitos antes del punto (para n.m)
      while (startNum >= 0 && isDigit(text[startNum])) startNum--;
    }

    startNum = Math.max(0, startNum + 1);

    // Construir nuevo texto
    const left = text.slice(0, startNum);
    const right = text.slice(pos + 1); // Saltar un espacio (derecho del midpoint)
    const out = left + '  ' + right;
    const normalizedOut = normalizeGaps(out);

    node.textContent = normalizedOut;
    if (onUpdateVisualLayer) {
      onUpdateVisualLayer(normalizedOut);
    }

    const caret = Math.min(normalizedOut.length, left.length + 1);
    setSelection(caret, caret);

    try {
      moveCaretToNearestMidpoint();
    } catch (error) {
      // Ignorar errores
    }
  }

  /**
   * Handler de Delete: borra token a la derecha
   */
  function handleDelete() {
    const node = editElement.firstChild || editElement;
    let text = node.textContent || '';

    const sel = window.getSelection && window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const rng = sel.getRangeAt(0);
    if (!editElement.contains(rng.startContainer)) return;

    let pos = rng.startOffset;
    if (pos >= text.length) return;

    // Ajustar al midpoint más cercano
    const mids = getMidpoints(text);
    if (mids.length) {
      let best = mids[0];
      let minDist = Math.abs(pos - best);
      for (const m of mids) {
        const dist = Math.abs(pos - m);
        if (dist < minDist) {
          best = m;
          minDist = dist;
        }
      }
      pos = best;
    }

    // Buscar número a la derecha del midpoint
    const isDigit = (c) => c >= '0' && c <= '9';
    let k = pos;

    // Saltar espacios
    while (k < text.length && text[k] === ' ') k++;
    if (k >= text.length) return;
    if (!(isDigit(text[k]) || text[k] === '.')) return;

    let end = k;
    let dotConsumed = false;

    // Consumir punto inicial (para .n)
    if (text[end] === '.') {
      dotConsumed = true;
      end++;
    }

    // Consumir dígitos y punto (para n.m)
    while (end < text.length) {
      const ch = text[end];
      if (isDigit(ch)) {
        end++;
        continue;
      }
      if (ch === '.' && !dotConsumed) {
        dotConsumed = true;
        end++;
        continue;
      }
      break;
    }

    // Saltar espacios tras el número (máximo 2 para no duplicar)
    let s = 0;
    while (end + s < text.length && text[end + s] === ' ') s++;

    const left = text.slice(0, pos - 1); // Elimina espacio izquierdo del midpoint
    const right = text.slice(end + Math.min(s, 2));
    const out = left + '  ' + right;
    const normalizedOut = normalizeGaps(out);

    node.textContent = normalizedOut;
    if (onUpdateVisualLayer) {
      onUpdateVisualLayer(normalizedOut);
    }

    const caret = Math.min(normalizedOut.length, left.length + 1);
    setSelection(caret, caret);

    try {
      moveCaretToNearestMidpoint();
    } catch (error) {
      // Ignorar errores
    }
  }

  /**
   * Handler de blur: sanitizar
   */
  function handleBlur() {
    if (onSanitize) {
      onSanitize({ causedBy: 'blur' });
    }
  }

  /**
   * Handler de mouseup: mover al midpoint más cercano
   */
  function handleMouseUp() {
    setTimeout(moveCaretToNearestMidpoint, 0);
  }

  /**
   * Handler de focus: normalizar e ir al midpoint
   */
  function handleFocus() {
    setTimeout(() => {
      const node = editElement.firstChild || editElement;
      let text = node.textContent || '';

      if (text.length === 0) {
        text = '  ';
      } else {
        const normalized = normalizeGaps(text);
        if (normalized !== text) {
          text = normalized;
        }
      }

      node.textContent = text;
      if (onUpdateVisualLayer) {
        onUpdateVisualLayer(text);
      }

      moveCaretToNearestMidpoint();
    }, 0);
  }

  /**
   * Adjunta todos los event listeners
   */
  function attach() {
    editElement.addEventListener('keydown', handleKeyDown);
    editElement.addEventListener('blur', handleBlur);
    editElement.addEventListener('mouseup', handleMouseUp);
    editElement.addEventListener('focus', handleFocus);
  }

  /**
   * Remueve todos los event listeners
   */
  function detach() {
    editElement.removeEventListener('keydown', handleKeyDown);
    editElement.removeEventListener('blur', handleBlur);
    editElement.removeEventListener('mouseup', handleMouseUp);
    editElement.removeEventListener('focus', handleFocus);
  }

  // API pública
  return {
    attach,
    detach,
    getText,
    setText,
    setSelection,
    getCaretPosition,
    moveCaretToNearestMidpoint,
    moveCaretStep
  };
}
