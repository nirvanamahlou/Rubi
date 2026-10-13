'use client';

import type { B2bCrmConnectionsV1 } from '@nora/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';

import { agencyClient } from '../api/agency-client';
import {
  assertCrmContext,
  boundSnapshotRequest,
  crmContextKey,
  crmSnapshotValue,
} from '../model/crm-context';

export function useOrganizationCrmConnections(
  organizationId: string,
  branchId: string,
  sessionContextKey: string,
) {
  const [snapshot, setSnapshot] = useState<{
    key: string;
    data: B2bCrmConnectionsV1;
  }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const request = useRef(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const contextKey = crmContextKey(
    organizationId,
    branchId,
    sessionContextKey,
    revision,
  );

  useEffect(() => {
    if (!organizationId || !branchId || !sessionContextKey) return;
    const current = ++request.current;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      void boundSnapshotRequest(
        contextKey,
        controller.signal,
        () =>
          agencyClient.crmConnections(
            organizationId,
            branchId,
            controller.signal,
          ),
        (result) => assertCrmContext(result, organizationId, branchId),
      )
        .then((result) => {
          if (current === request.current && result) setSnapshot(result);
        })
        .catch((caught: unknown) => {
          if (current !== request.current || controller.signal.aborted) return;
          setError(
            caught instanceof Error
              ? caught.message
              : 'دریافت ارتباطات CRM ناموفق بود.',
          );
        })
        .finally(() => {
          if (current === request.current && !controller.signal.aborted)
            setLoading(false);
        });
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [organizationId, branchId, sessionContextKey, revision, contextKey]);

  const data = crmSnapshotValue(snapshot, contextKey);

  return {
    data: organizationId && branchId && sessionContextKey ? data : undefined,
    loading: organizationId && branchId && sessionContextKey ? loading : false,
    error: organizationId && branchId && sessionContextKey ? error : '',
    refresh,
  };
}
