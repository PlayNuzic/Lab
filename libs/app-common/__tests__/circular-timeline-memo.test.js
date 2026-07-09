/** @jest-environment jsdom */
/**
 * T-05: tests del memo render(lg,isCircular) (P-03) — el suite node de
 * circular-timeline.test.js usa mocks el createElement dels quals no
 * defineix `isConnected`; aquest fitxer usa jsdom real perquè el memo el
 * necessita.
 */
import { createCircularTimeline } from '../circular-timeline.js';

function makeTimeline() {
  const wrapper = document.createElement('div');
  wrapper.className = 'timeline-wrapper';
  const timeline = document.createElement('div');
  timeline.className = 'timeline';
  wrapper.appendChild(timeline);
  document.body.appendChild(wrapper);
  return { wrapper, timeline };
}

describe('createCircularTimeline — memo de render() (P-03)', () => {
  let timeline, timelineWrapper, controller;

  beforeEach(() => {
    ({ wrapper: timelineWrapper, timeline } = makeTimeline());
    // rAF síncron perquè applyCircularLayout (mode circular) resolgui al moment.
    global.requestAnimationFrame = (cb) => { cb(); return 1; };
    controller = createCircularTimeline({ timeline, timelineWrapper, getPulses: () => [] });
  });

  afterEach(() => {
    delete global.requestAnimationFrame;
    document.body.innerHTML = '';
  });

  test('dues crides amb el mateix (lg,isCircular) retornen === el mateix array', () => {
    const a = controller.render(5, { isCircular: false, silent: true });
    const b = controller.render(5, { isCircular: false, silent: true });
    expect(b).toBe(a);
  });

  test('buidar timeline.innerHTML invalida el memo via isConnected', () => {
    const a = controller.render(5, { isCircular: false, silent: true });
    expect(a[0].isConnected).toBe(true);

    timeline.innerHTML = '';
    expect(a[0].isConnected).toBe(false);

    const b = controller.render(5, { isCircular: false, silent: true });
    expect(b).not.toBe(a);
    expect(b[0].isConnected).toBe(true);
  });

  test('setCircular(true) sincronitza lastCircular amb el memo de render()', () => {
    const a = controller.render(5, { isCircular: false, silent: true });

    controller.setCircular(true, { silent: true });

    // lastCircular ja és `true`; una crida amb el mateix lg i isCircular:true
    // ha de fer memo-hit i retornar el MATEIX array (encara connectat).
    const b = controller.render(5, { isCircular: true, silent: true });
    expect(b).toBe(a);
  });
});
