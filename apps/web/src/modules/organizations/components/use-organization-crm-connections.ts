'use client';

import type { B2bCrmConnectionsV1 } from '@rubi/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';

import { agencyClient } from '../api/agency-client';

export function useOrganizationCrmConnections(organizationId: string) {
  const [data, setData] = useState<B2bCrmConnectionsV1>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const request = useRef(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (!organizationId) return;
    const current = ++request.current;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      void agencyClient
        .crmConnections(organizationId, undefined, controller.signal)
        .then((result) => {
          if (current === request.current && !controller.signal.aborted)
            setData(result);
        })
        .catch((caught: unknown) => {
          if (current !== request.current || controller.signal.aborted) return;
          setData(undefined);
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
  }, [organizationId, revision]);

  return {
    data: organizationId ? data : undefined,
    loading: organizationId ? loading : false,
    error: organizationId ? error : '',
    refresh,
  };
}
