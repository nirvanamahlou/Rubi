'use client';
import { useEffect, useState } from 'react';
export async function readPublicDocumentLink(
  path: string,
  signal?: AbortSignal,
) {
  const response = await fetch(path, {
    credentials: 'include',
    cache: 'no-store',
    ...(signal ? { signal } : {}),
  });
  const data = (await response.json()) as {
    code?: string;
    message?: unknown;
    url?: unknown;
    html?: unknown;
    documents?: Array<{ passengerId: string; url: string }>;
  };
  if (!response.ok && data.code === 'PUBLIC_DOCUMENTS_DISABLED')
    return { status: 'disabled' as const, url: '', html: '' };
  if (
    !response.ok ||
    typeof data.url !== 'string' ||
    typeof data.html !== 'string'
  )
    throw new Error(
      typeof data.message === 'string'
        ? data.message
        : 'PUBLIC_DOCUMENT_UNAVAILABLE',
    );
  return {
    status: 'ready' as const,
    url: data.url,
    html: data.html,
    documents: data.documents,
  };
}
/** Reads only the current authorized canonical document route; never submits local draft content. */
export function usePublicDocumentLink(path: string | undefined, revision = '') {
  const [loaded, setLoaded] = useState<{
    status: 'ready' | 'disabled' | 'failed';
    path: string;
    revision: string;
    url: string;
    html: string;
    documents?: Array<{ passengerId: string; url: string }> | undefined;
  }>();
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    const url = new URL(path, window.location.origin);
    url.searchParams.set('format', 'share');
    void readPublicDocumentLink(url.pathname + url.search, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted)
          setLoaded({ path, revision, ...result });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setLoaded({ path, revision, status: 'failed', url: '', html: '' });
      });
    return () => controller.abort();
  }, [path, revision]);
  return loaded && loaded.path === path && loaded.revision === revision
    ? loaded
    : undefined;
}
