import { afterEach, expect, it, vi } from 'vitest';
import { AUTH_SESSION_RECOVERED_EVENT } from '@/lib/auth-session';
import { watchTelephonyWakeup } from './telephony-wakeup';

afterEach(() => vi.unstubAllGlobals());
it('restarts on visible focus, reconnection and auth recovery and removes listeners on unmount', () => {
  const window = new EventTarget();
  const document = Object.assign(new EventTarget(), {
    visibilityState: 'visible',
  });
  vi.stubGlobal('window', window);
  vi.stubGlobal('document', document);
  const wake = vi.fn();
  const dispose = watchTelephonyWakeup(wake);
  for (const event of ['focus', 'online', AUTH_SESSION_RECOVERED_EVENT])
    window.dispatchEvent(new Event(event));
  document.dispatchEvent(new Event('visibilitychange'));
  expect(wake).toHaveBeenCalledTimes(4);
  document.visibilityState = 'hidden';
  window.dispatchEvent(new Event('focus'));
  document.dispatchEvent(new Event('visibilitychange'));
  expect(wake).toHaveBeenCalledTimes(4);
  document.visibilityState = 'visible';
  document.dispatchEvent(new Event('visibilitychange'));
  expect(wake).toHaveBeenCalledTimes(5);
  dispose();
  window.dispatchEvent(new Event(AUTH_SESSION_RECOVERED_EVENT));
  document.dispatchEvent(new Event('visibilitychange'));
  expect(wake).toHaveBeenCalledTimes(5);
});
