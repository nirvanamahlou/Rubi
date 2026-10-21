'use client';
import { useEffect, useState } from 'react';
/** Reads only the current authorized canonical document route; never submits local draft content. */
export function usePublicDocumentLink(path: string | undefined, revision = '') {
  const [loaded, setLoaded] = useState<{
    path: string;
    revision: string;
    url: string;
    html: string;
    documents?: Array<{ passengerId: string; url: string }>;
  }>();
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    const url = new URL(path, window.location.origin);
    url.searchParams.set('format', 'share');
    void fetch(url.pathname + url.search, {
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => (response.ok ? response.json() : undefined))
      .then((result: unknown) => {
        if (controller.signal.aborted || !result || typeof result !== 'object')
          return;
        const data = result as {
          url?: unknown;
          html?: unknown;
          documents?: Array<{ passengerId: string; url: string }>;
        };
        if (typeof data.url === 'string' && typeof data.html === 'string')
          setLoaded({
            path,
            revision,
            url: data.url,
            html: data.html,
            documents: data.documents,
          });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [path, revision]);
  return loaded?.path === path && loaded.revision === revision
    ? loaded
    : undefined;
}
