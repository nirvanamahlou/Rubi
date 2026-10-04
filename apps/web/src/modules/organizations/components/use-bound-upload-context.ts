'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';

export interface BoundUploadCallbacks {
  onUploaded: (id: string) => void;
  onConfidentialGrant?:
    ((documentId: string, token: string) => void) | undefined;
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
      confidentialGrant: (documentId: string, token: string) => {
        if (
          mounted.current &&
          current.current.contextKey === captured.contextKey
        )
          current.current.callbacks.onConfidentialGrant?.(documentId, token);
      },
      publish: (documentId: string, token?: string) => {
        if (
          mounted.current &&
          current.current.contextKey === captured.contextKey
        ) {
          current.current.callbacks.onUploaded(documentId);
          if (token)
            current.current.callbacks.onConfidentialGrant?.(documentId, token);
        }
      },
      busy: (busy: boolean) => {
        if (
          mounted.current &&
          current.current.contextKey === captured.contextKey
        )
          current.current.callbacks.onBusyChange(busy);
      },
      releaseBusy: () => {
        // This uploader's pending guard prevents another operation from
        // replacing its busy state before this operation's finally block.
        // Release against the latest mounted context after a real context
        // switch; never call a parent after this uploader has unmounted.
        if (mounted.current) current.current.callbacks.onBusyChange(false);
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
