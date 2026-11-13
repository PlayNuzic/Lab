/**
 * @jest-environment jsdom
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import { makeInertCell, findEditableNeighbour } from '../inert-cell.js';

function input({ readOnly = false, disabled = false, id } = {}) {
  const el = document.createElement('input');
  el.type = 'text';
  el.readOnly = readOnly;
  el.disabled = disabled;
  if (id) el.id = id;
  return el;
}

function mousedown(el) {
  const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
  el.dispatchEvent(ev);
  return ev;
}

describe('makeInertCell', () => {
  let row;
  beforeEach(() => {
    document.body.innerHTML = '';
    row = document.createElement('div');
    document.body.appendChild(row);
  });

  test('queda de només lectura, fora del Tab i amb el cursor normal', () => {
    const cell = makeInertCell(input());
    expect(cell.readOnly).toBe(true);
    expect(cell.tabIndex).toBe(-1);
    expect(cell.style.cursor).toBe('default');
  });

  test('un clic no hi deixa el focus: passa al valor d\'abans (App14: [rosa][valor][rosa])', () => {
    // Cas del test P2-02: +5 −1 amb les caselles roses de cada grup
    const before1 = makeInertCell(input());
    const val1 = input({ id: 'v1' });
    const after1 = makeInertCell(input());
    const before2 = makeInertCell(input());
    const val2 = input({ id: 'v2' });
    row.append(before1, val1, after1, before2, val2);

    const ev = mousedown(after1);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(val1);

    // La rosa d'abans d'un valor no té cap valor al davant: va al seu
    mousedown(before2);
    expect(document.activeElement).toBe(val2);
    mousedown(before1);
    expect(document.activeElement).toBe(val1);
  });

  test('prefer: \'next\' tria el valor de després (fila iT en ziga-zaga)', () => {
    const val1 = input({ id: 'v1' });
    const sep = makeInertCell(input(), { prefer: 'next' });
    const val2 = input({ id: 'v2' });
    row.append(val1, sep, val2);

    mousedown(sep);
    expect(document.activeElement).toBe(val2);
  });

  test('sense cap casella editable al costat, el focus es queda on era', () => {
    const editing = input({ id: 'editing' });
    document.body.appendChild(editing);
    editing.focus();

    const a = makeInertCell(input());
    const b = makeInertCell(input());
    row.append(a, b);

    const ev = mousedown(a);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(editing);
  });
});

describe('findEditableNeighbour', () => {
  test('salta caselles de només lectura i desactivades', () => {
    const row = document.createElement('div');
    const ro = input({ readOnly: true });
    const sep = input({ readOnly: true });
    const off = input({ disabled: true });
    row.append(ro, sep, off);
    expect(findEditableNeighbour(sep)).toBeNull();
    expect(findEditableNeighbour(sep, 'next')).toBeNull();
  });

  test('ignora elements que no són caselles (p.ex. el marcador final)', () => {
    const row = document.createElement('div');
    const val = input();
    const sep = input({ readOnly: true });
    const marker = document.createElement('div');
    row.append(val, sep, marker);
    expect(findEditableNeighbour(sep, 'next')).toBe(val);
  });
});
