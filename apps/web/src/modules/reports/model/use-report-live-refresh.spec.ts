import { afterEach, describe, it, expect, vi } from 'vitest';
import { subscribeReportRefresh } from './use-report-live-refresh';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe('live report refresh subscription', () => {
  it('refreshes visible reports on an interval, focus and visibility return, then cleans up', () => {
    vi.useFakeTimers();
    const windowTarget = new EventTarget(),
      documentTarget = new EventTarget();
    const doc = Object.assign(documentTarget, { visibilityState: 'visible' });
    vi.stubGlobal(
      'window',
      Object.assign(windowTarget, { setInterval, clearInterval }),
    );
    vi.stubGlobal('document', doc);
    const refresh = vi.fn(),
      dispose = subscribeReportRefresh(refresh);
    vi.advanceTimersByTime(15000);
    expect(refresh).toHaveBeenCalledTimes(1);
    doc.visibilityState = 'hidden';
    vi.advanceTimersByTime(15000);
    expect(refresh).toHaveBeenCalledTimes(1);
    doc.visibilityState = 'visible';
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    windowTarget.dispatchEvent(new Event('focus'));
    expect(refresh).toHaveBeenCalledTimes(3);
    dispose();
    vi.advanceTimersByTime(15000);
    windowTarget.dispatchEvent(new Event('focus'));
    documentTarget.dispatchEvent(new Event('visibilitychange'));
    expect(refresh).toHaveBeenCalledTimes(3);
  });
});
