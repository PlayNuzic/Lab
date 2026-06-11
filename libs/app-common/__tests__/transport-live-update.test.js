import { jest } from '@jest/globals';
import { createLiveTransportPush } from '../transport-live-update.js';

jest.useFakeTimers();

describe('createLiveTransportPush (A-13)', () => {
  test('col·lapsa transitòries: només l\'última programació aplica', () => {
    const apply = jest.fn();
    const push = createLiveTransportPush({ apply, delayMs: 250 });
    push.schedule(); // '2'
    jest.advanceTimersByTime(100);
    push.schedule(); // '24'
    jest.advanceTimersByTime(100);
    push.schedule(); // '240'
    jest.advanceTimersByTime(249);
    expect(apply).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  test('isLive es re-comprova al dispar (stop dins la finestra = cap push)', () => {
    const apply = jest.fn();
    let playing = true;
    const push = createLiveTransportPush({ apply, isLive: () => playing, delayMs: 250 });
    push.schedule();
    playing = false;
    jest.advanceTimersByTime(300);
    expect(apply).not.toHaveBeenCalled();
  });

  test('cancel() descarta el push pendent', () => {
    const apply = jest.fn();
    const push = createLiveTransportPush({ apply, delayMs: 250 });
    push.schedule();
    push.cancel();
    jest.advanceTimersByTime(300);
    expect(apply).not.toHaveBeenCalled();
  });

  test('flush() aplica immediatament el pendent', () => {
    const apply = jest.fn();
    const push = createLiveTransportPush({ apply, delayMs: 250 });
    push.flush(); // res pendent: no-op
    expect(apply).not.toHaveBeenCalled();
    push.schedule();
    push.flush();
    expect(apply).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(300);
    expect(apply).toHaveBeenCalledTimes(1); // i el timer ha quedat net
  });
});
