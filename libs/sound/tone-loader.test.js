/** @jest-environment jsdom */

import { jest } from '@jest/globals';

describe('tone-loader', () => {
  let originalCreateElement;
  let originalAppendChild;
  let ensureToneLoaded;

  beforeEach(async () => {
    jest.resetModules();

    originalCreateElement = document.createElement;
    originalAppendChild = document.head.appendChild;

    const scriptElement = {
      set src(value) {
        this._src = value;
      },
      get src() {
        return this._src;
      },
      onload: null,
      onerror: null
    };

    document.createElement = jest.fn(() => scriptElement);
    document.head.appendChild = jest.fn((node) => {
      setTimeout(() => {
        node.onload?.();
      });
      return node;
    });

    Object.defineProperty(navigator, 'userActivation', {
      configurable: true,
      value: { isActive: false }
    });

    ({ ensureToneLoaded } = await import('./tone-loader.js'));
  });

  afterEach(() => {
    document.createElement = originalCreateElement;
    document.head.appendChild = originalAppendChild;
    delete navigator.userActivation;
  });

  test('loads Tone immediately when called during first click', async () => {
    let ensurePromise;

    await new Promise((resolve) => {
      document.addEventListener(
        'click',
        () => {
          navigator.userActivation.isActive = true;
          ensurePromise = ensureToneLoaded();
          resolve();
        },
        { once: true }
      );

      document.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    });

    await expect(ensurePromise).resolves.toBe(true);
    expect(document.head.appendChild).toHaveBeenCalledTimes(1);
  });
});
