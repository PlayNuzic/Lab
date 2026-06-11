/** @jest-environment jsdom */
import { withPlayButtonLoading } from '../play-loading.js';

function makeBtn() {
  const btn = document.createElement('button');
  const icon = document.createElement('span');
  icon.className = 'icon-play';
  btn.appendChild(icon);
  document.body.appendChild(btn);
  return btn;
}

describe('withPlayButtonLoading (U-27)', () => {
  test('tasques ràpides: cap estat de càrrega visible', async () => {
    const btn = makeBtn();
    const result = await withPlayButtonLoading(btn, async () => 'ok', { delayMs: 50 });
    expect(result).toBe('ok');
    expect(btn.disabled).toBe(false);
    expect(btn.hasAttribute('aria-busy')).toBe(false);
  });

  test('tasques lentes: disabled + aria-busy mentre dura, restaurat després', async () => {
    const btn = makeBtn();
    let midState = null;
    await withPlayButtonLoading(btn, async () => {
      await new Promise(r => setTimeout(r, 40));
      midState = { disabled: btn.disabled, busy: btn.getAttribute('aria-busy') };
    }, { delayMs: 5 });
    expect(midState).toEqual({ disabled: true, busy: 'true' });
    expect(btn.disabled).toBe(false);
    expect(btn.hasAttribute('aria-busy')).toBe(false);
    expect(btn.querySelector('.icon-play').style.opacity).toBe('1');
  });

  test('restaura també quan la tasca llença', async () => {
    const btn = makeBtn();
    await expect(withPlayButtonLoading(btn, async () => {
      await new Promise(r => setTimeout(r, 30));
      throw new Error('boom');
    }, { delayMs: 5 })).rejects.toThrow('boom');
    expect(btn.disabled).toBe(false);
    expect(btn.hasAttribute('aria-busy')).toBe(false);
  });

  test('playBtn null: executa la tasca sense tocar res', async () => {
    const result = await withPlayButtonLoading(null, async () => 42);
    expect(result).toBe(42);
  });
});
