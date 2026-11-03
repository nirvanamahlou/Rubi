'use client';
import { useEffect, useState } from 'react';
import { travelRequest } from '../components/travel-workflow-form';

function usePurchaseStatus(id?: string, revision?: number) {
  const [result, setResult] = useState<{
    id: string;
    revision: number | undefined;
    complete: boolean;
    registered: boolean;
  }>();
  useEffect(() => {
    if (!id) return;
    let live = true;
    let sequence = 0;
    const refresh = () => {
      const call = ++sequence;
      void travelRequest<{ data: { complete: boolean; registered?: boolean } }>(
        'reservations/requests/' +
          encodeURIComponent(id) +
          '/purchase-completion',
      )
        .then((response) => {
          if (live && call === sequence)
            setResult({
              id,
              revision,
              complete: response.data.complete === true,
              registered: response.data.registered === true,
            });
        })
        .catch(() => {
          if (live && call === sequence)
            setResult({ id, revision, complete: false, registered: false });
        });
    };
    refresh();
    const timer = setInterval(refresh, 30_000);
    window.addEventListener('reservation-workflow-changed', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener('reservation-workflow-changed', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [id, revision]);
  return result?.id === id && result?.revision === revision
    ? result
    : undefined;
}

export function usePurchaseCompletion(id?: string, revision?: number) {
  return usePurchaseStatus(id, revision)?.complete === true;
}

export function usePurchaseRegistration(id?: string, revision?: number) {
  return usePurchaseStatus(id, revision)?.registered === true;
}
