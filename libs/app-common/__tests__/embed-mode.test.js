/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "http://localhost/Apps/App12/index.html?embed=true"}
 */
// embed-mode.js és un script clàssic (no mòdul) que s'executa al <head>:
// l'avaluem tal qual dins del jsdom i comprovem els missatges que envia al
// Sistema (analytics) quan l'usuari toca play/random/reset o edita.
import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(path.resolve(process.cwd(), 'libs/app-common/embed-mode.js'), 'utf8');

let posted;
beforeAll(() => {
  posted = jest.spyOn(window, 'postMessage').mockImplementation(() => {});
  (0, eval)(SRC);
});
beforeEach(() => {
  posted.mockClear();
  document.body.innerHTML = `
    <button id="playBtn"><span id="play-icon">▶</span></button>
    <button id="randomBtn">🎲</button>
    <button id="resetBtn">🗑</button>
    <input id="inputBpm" type="number">
    <div id="editor" contenteditable="true"></div>`;
});

const sent = () => posted.mock.calls.map(c => c[0]);

test('activa el mode embed a <html>', () => {
  expect(document.documentElement.getAttribute('data-embed')).toBe('true');
});

test('play/random/reset envien app:* amb el nom de l\'app (des de l\'URL)', () => {
  document.getElementById('play-icon').click();   // clic a dins del botó
  document.getElementById('randomBtn').click();
  document.getElementById('resetBtn').click();
  expect(sent()).toEqual([
    { type: 'app:play', app: 'App12' },
    { type: 'app:random', app: 'App12' },
    { type: 'app:reset', app: 'App12' },
  ]);
});

test('la primera edició envia app:edit un sol cop; el BPM no compta', () => {
  const input = new Event('input', { bubbles: true });
  document.getElementById('inputBpm').dispatchEvent(input);
  expect(sent()).toEqual([]);
  document.getElementById('editor').dispatchEvent(new Event('input', { bubbles: true }));
  document.getElementById('editor').dispatchEvent(new Event('input', { bubbles: true }));
  expect(sent()).toEqual([{ type: 'app:edit', app: 'App12' }]);
});
