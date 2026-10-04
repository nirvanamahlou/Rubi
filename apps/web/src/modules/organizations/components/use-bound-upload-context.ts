'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';

export interface BoundUploadCallbacks {
  onUploaded: (id: string) => void;
  onBusyChange: (busy: boolean) => void;
  onUncertainChange?: ((uncertain: boolean) => void) | undefined;
}

/** Prevents a completed upload from updating a replaced dossier context. */
export function useBoundUploadContext(
  contextKey: string,
  callbacks: BoundUploadCallbacks,
) {
  const current = useRef({ contextKey, callbacks });
  const mounted = useRef(false);
  useLayoutEffect(() => {
    current.current = { contextKey, callbacks };
  }, [callbacks, contextKey]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return () => {
    const captured = current.current;
    return {
      isCurrent: () =>
        mounted.current && current.current.contextKey === captured.contextKey,
      uploaded: (id: string) => {
        if (
          mounted.current &&
          current.current.contextKey === captured.contextKey
        )
          current.current.callbacks.onUploaded(id);
      },
      busy: (busy: boolean) => {
        if (
          mounted.current &&
          current.current.contextKey === captured.contextKey
        )
          current.current.callbacks.onBusyChange(busy);
      },
      uncertain: (uncertain: boolean) => {
        if (
          mounted.current &&
          current.current.contextKey === captured.contextKey
        )
          current.current.callbacks.onUncertainChange?.(uncertain);
      },
    };
  };
}
