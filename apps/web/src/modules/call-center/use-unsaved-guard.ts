'use client';
import { useEffect } from 'react';

const approved = new WeakSet<Event>();
/** Private drafts stay in memory; warn before reload, closing, or following a link. */
export function useUnsavedGuard(
  dirty: boolean,
  allowInternalNavigation = false,
) {
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    const navigation = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        approved.has(event) ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (event.target as Element | null)?.closest?.('a[href]');
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.target === '_blank' ||
        link.hasAttribute('download')
      )
        return;
      const destination = new URL(link.href, location.href);
      if (allowInternalNavigation && destination.origin === location.origin)
        return;
      if (
        destination.pathname === location.pathname &&
        destination.search === location.search &&
        destination.origin === location.origin
      )
        return;
      if (
        window.confirm(
          'پیش‌نویس‌های ثبت‌نشده با خروج از صفحه از بین می‌روند. ادامه می‌دهید؟',
        )
      )
        approved.add(event);
      else {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', navigation, true);
    return () => {
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('click', navigation, true);
    };
  }, [dirty, allowInternalNavigation]);
}
