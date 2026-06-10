/**
 * Tests for the cell-based sequence editor (H-02 extraction from App28-31)
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';
import {
  createCellSequenceEditor,
  fractionTokenValue,
  normalizeFractionToken
} from '../cell-editor.js';

describe('fractionTokenValue', () => {
  test('integer tokens', () => {
    expect(fractionTokenValue('3')).toBe(3);
    expect(fractionTokenValue(' 7 ')).toBe(7);
  });
  test('fraction tokens use denominator', () => {
    expect(fractionTokenValue('1.2', 4)).toBeCloseTo(1.5);
    expect(fractionTokenValue('0.1', 2)).toBeCloseTo(0.5);
  });
  test('non-strings → -1', () => {
    expect(fractionTokenValue(null)).toBe(-1);
    expect(fractionTokenValue(3)).toBe(-1);
  });
});

describe('normalizeFractionToken', () => {
  test('strips leading zeros', () => {
    expect(normalizeFractionToken('01')).toBe('1');
    expect(normalizeFractionToken('1.03')).toBe('1.3');
  });
  test('shorthand ".2" → "0.2"', () => {
    expect(normalizeFractionToken('.2')).toBe('0.2');
  });
  test('garbage → empty', () => {
    expect(normalizeFractionToken('abc')).toBe('');
    expect(normalizeFractionToken('')).toBe('');
  });
});

// ---------- helpers ----------

function fireInput(cell, value) {
  cell.value = value;
  cell.dispatchEvent(new Event('input', { bubbles: true }));
}
function fireKey(cell, key, opts = {}) {
  cell.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...opts }));
}

// Classify del Pfr (App28/29) replicat per als tests d'integració.
function pfrClassify(raw) {
  if (/^\d+$/.test(raw)) return 'defer';
  if (/^\d+\.$/.test(raw) || /^\.$/.test(raw)) return 'wait';
  if (/^\d+\.\d+$/.test(raw) || /^\.\d+$/.test(raw)) return 'commit';
  return 'clear';
}

describe('createCellSequenceEditor (variant Pfr)', () => {
  let host, endMarker, model, editor, commits, edits, deletes;

  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '';
    host = document.createElement('div');
    endMarker = document.createElement('input');
    endMarker.readOnly = true;
    endMarker.className = 'end-marker';
    host.appendChild(endMarker);
    document.body.appendChild(host);

    model = ['1', '3'];
    commits = []; edits = []; deletes = 0;

    editor = createCellSequenceEditor({
      host,
      endMarker,
      classes: { base: 'editor-cell editor-cell--p', input: 'editor-input' },
      input: {
        maxLength: 4,
        commitDelay: 1000,
        classify: pfrClassify,
        arrowNav: true,
        emptyEnterTab: true
      },
      getEntries: () => model.map(t => ({ display: t, token: t })),
      onCommitInput: (raw) => {
        commits.push(raw);
        if (raw === 'bad') return false;
        model.push(raw);
        editor.render();
        return true;
      },
      onEditEntry: (idx, raw) => {
        edits.push([idx, raw]);
        if (raw === '') { model.splice(idx, 1); editor.render(); return true; }
        if (raw === 'bad') return false;
        model[idx] = raw;
        editor.render();
        return true;
      },
      onDeleteLast: () => { deletes++; model.pop(); editor.render(); }
    });
    editor.render();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const valueCells = () => Array.from(host.querySelectorAll('input:not([readonly])'))
    .filter(c => c.dataset.entryIndex !== undefined);
  const inputCell = () => editor.getActiveInput();

  test('render: [valor][sep] per entrada + input + sep, preservant endMarker', () => {
    // 2 entrades → 2 valors + 2 separadors + 1 input + 1 separador + endMarker = 7 fills
    expect(host.children.length).toBe(7);
    expect(host.lastElementChild).toBe(endMarker);
    expect(valueCells().map(c => c.value)).toEqual(['1', '3']);
    expect(valueCells()[0].dataset.token).toBe('1');
    expect(inputCell()).not.toBeNull();
    // Separadors readonly i fora del tab order
    const seps = Array.from(host.querySelectorAll('input[readonly]')).filter(c => c !== endMarker);
    expect(seps).toHaveLength(3);
    seps.forEach(s => expect(s.tabIndex).toBe(-1));
  });

  test('dígit sol: commit en diferit (1000ms)', () => {
    fireInput(inputCell(), '5');
    expect(commits).toHaveLength(0);
    jest.advanceTimersByTime(999);
    expect(commits).toHaveLength(0);
    jest.advanceTimersByTime(1);
    expect(commits).toEqual(['5']);
    expect(model).toEqual(['1', '3', '5']);
  });

  test('"N.M" complet: commit immediat', () => {
    fireInput(inputCell(), '2.1');
    expect(commits).toEqual(['2.1']);
  });

  test('"N." parcial: espera sense commit', () => {
    fireInput(inputCell(), '2');
    fireInput(inputCell(), '2.');
    jest.advanceTimersByTime(2000);
    expect(commits).toHaveLength(0);
  });

  test('brossa: neteja el camp', () => {
    fireInput(inputCell(), 'x!');
    expect(inputCell().value).toBe('');
    jest.advanceTimersByTime(2000);
    expect(commits).toHaveLength(0);
  });

  test('Enter amb valor committeja; commit fallit buida el camp', () => {
    const input = inputCell();
    fireInput(input, 'bad');
    // 'bad' classifica com a clear → ja s'ha buidat; forcem valor i Enter
    input.value = 'bad';
    fireKey(input, 'Enter');
    expect(commits).toContain('bad');
    expect(input.value).toBe('');
    expect(model).toEqual(['1', '3']);
  });

  test('Backspace amb input buit esborra l\'última entrada', () => {
    fireKey(inputCell(), 'Backspace');
    expect(deletes).toBe(1);
    expect(model).toEqual(['1']);
  });

  test('edició de cel·la: blur amb valor nou aplica; invàlid restaura', () => {
    let cell = valueCells()[0];
    cell.focus();
    cell.value = '2';
    cell.blur();
    expect(edits).toEqual([[0, '2']]);
    expect(model).toEqual(['2', '3']);

    cell = valueCells()[1];
    cell.focus();
    cell.value = 'bad';
    cell.blur();
    expect(cell.value).toBe('3');   // restaurat
    expect(model).toEqual(['2', '3']);
  });

  test('edició de cel·la: blur buit esborra l\'entrada', () => {
    const cell = valueCells()[1];
    cell.focus();
    cell.value = '';
    cell.blur();
    expect(model).toEqual(['1']);
  });

  test('blur sense canvi no toca el model', () => {
    const cell = valueCells()[0];
    cell.focus();
    cell.blur();
    expect(edits).toHaveLength(0);
    expect(model).toEqual(['1', '3']);
  });

  test('fletxes naveguen entre cel·les editables', () => {
    const [first, second] = valueCells();
    first.focus();
    fireKey(first, 'ArrowRight');
    expect(document.activeElement).toBe(second);
    fireKey(second, 'ArrowLeft');
    expect(document.activeElement).toBe(first);
  });

  test('Enter buit navega (emptyEnterTab)', () => {
    const input = inputCell();
    input.focus();
    fireKey(input, 'Enter', { shiftKey: true });
    expect(document.activeElement).toBe(valueCells()[1]);
  });
});

describe('createCellSequenceEditor (variant iTfr)', () => {
  let host, model, editor, commits;
  const MAX_TOTAL = 8;

  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);

    model = [2, 3];
    commits = [];

    editor = createCellSequenceEditor({
      host,
      classes: { base: 'itfr-cell', value: 'itfr-value', separator: 'itfr-separator', input: 'itfr-input' },
      input: {
        maxLength: 2,
        inputMode: 'numeric',
        commitDelay: 500,
        classify: (raw) => /^\d+$/.test(raw) ? 'defer' : { sanitize: raw.replace(/\D/g, '') },
        commitOnBlur: true,
        doubleCommitGuard: true,
        refocusAfterCommit: true,
        refocusOnInvalid: true
      },
      getEntries: () => model.map(v => ({ display: String(v) })),
      showTrailingInput: () => model.reduce((a, b) => a + b, 0) < MAX_TOTAL,
      onCommitInput: (raw) => {
        commits.push(raw);
        const v = parseInt(raw, 10);
        if (!Number.isFinite(v) || v < 1) return false;
        if (model.reduce((a, b) => a + b, 0) + v > MAX_TOTAL) return false;
        model.push(v);
        editor.render();
        return true;
      },
      onEditEntry: (idx, raw) => {
        if (raw === '') { model.splice(idx, 1); editor.render(); return true; }
        const v = parseInt(raw, 10);
        if (!Number.isFinite(v) || v < 1) return false;
        model[idx] = v;
        editor.render();
        return true;
      },
      onDeleteLast: () => { model.pop(); editor.render(); }
    });
    editor.render();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('sense espai restant no hi ha input actiu', () => {
    expect(editor.getActiveInput()).not.toBeNull();
    fireInput(editor.getActiveInput(), '3');   // 2+3+3 = 8 = MAX
    jest.advanceTimersByTime(500);
    expect(model).toEqual([2, 3, 3]);
    expect(editor.getActiveInput()).toBeNull();
  });

  test('sanitize no mata el timer pendent (paritat App30)', () => {
    const input = editor.getActiveInput();
    fireInput(input, '3');          // arma el timer de 500ms
    fireInput(input, '3a');         // sanitize → "3", timer intacte
    expect(input.value).toBe('3');
    jest.advanceTimersByTime(500);
    expect(commits).toEqual(['3']);
  });

  test('guard anti doble-commit: timer + blur només committegen un cop', () => {
    const input = editor.getActiveInput();
    fireInput(input, '1');
    jest.advanceTimersByTime(500);  // commit per timer (re-renderitza)
    input.dispatchEvent(new Event('blur'));  // blur sobre l'element despenjat
    expect(commits).toEqual(['1']);
    expect(model).toEqual([2, 3, 1]);
  });

  test('commit fallit allibera el guard i permet reintentar', () => {
    const input = editor.getActiveInput();
    fireInput(input, '9');          // 2+3+9 > 8 → invàlid
    jest.advanceTimersByTime(500);
    expect(commits).toEqual(['9']);
    expect(input.value).toBe('');
    fireInput(input, '2');
    jest.advanceTimersByTime(500);
    expect(commits).toEqual(['9', '2']);
    expect(model).toEqual([2, 3, 2]);
  });

  test('commitOnBlur committeja el valor pendent', () => {
    const input = editor.getActiveInput();
    fireInput(input, '1');
    input.dispatchEvent(new Event('blur'));
    expect(commits).toEqual(['1']);
    expect(model).toEqual([2, 3, 1]);
  });

  test('refocus després de commit vàlid (10ms) torna a l\'input nou', () => {
    const input = editor.getActiveInput();
    fireInput(input, '1');
    jest.advanceTimersByTime(500);
    const fresh = editor.getActiveInput();
    expect(fresh).not.toBe(input);
    jest.advanceTimersByTime(50);   // refocus (10ms) + autofocus del nou (30ms)
    expect(document.activeElement).toBe(fresh);
  });
});
