import { AUTH_SESSION_RECOVERED_EVENT } from '@/lib/auth-session';

/** Restart authenticated polling after browser suspension or session recovery. */
export function watchTelephonyWakeup(wake: () => void) {
  const visible = () => {
    if (document.visibilityState === 'visible') wake();
  };
  const events = ['focus', 'online', AUTH_SESSION_RECOVERED_EVENT];
  for (const event of events) window.addEventListener(event, visible);
  document.addEventListener('visibilitychange', visible);
  return () => {
    for (const event of events) window.removeEventListener(event, visible);
    document.removeEventListener('visibilitychange', visible);
  };
}
