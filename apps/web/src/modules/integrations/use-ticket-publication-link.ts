'use client';
import { useMemo, useSyncExternalStore } from 'react';
export function ticketPublicationLink(search: string) {
  const query = new URLSearchParams(search);
  return ['tickets', 'hotels'].includes(query.get('view') ?? '')
    ? query
    : undefined;
}
const serverSearch = () => '';
const browserSearch = () => window.location.search;
function subscribeLocation(change: () => void) {
  window.addEventListener('popstate', change);
  return () => window.removeEventListener('popstate', change);
}
/** The first server/client render agrees; browser location is read after hydration without an effect state cascade. */
export function useTicketPublicationLink() {
  const search = useSyncExternalStore(
    subscribeLocation,
    browserSearch,
    serverSearch,
  );
  return useMemo(() => ticketPublicationLink(search), [search]);
}
