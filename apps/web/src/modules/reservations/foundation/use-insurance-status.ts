'use client';
import { useEffect, useState } from 'react';
import { insuranceResponse } from '../components/reservation-insurance-documents';

export type InsuranceActionSummary = {
  selected?: boolean;
  total: number;
  ready: boolean;
  sandbox: boolean;
};
export function insuranceActionState(summary?: InsuranceActionSummary) {
  if (!summary?.selected && !summary?.total) return 'none';
  return summary.ready && summary.total > 0 ? 'ready' : 'incomplete';
}
export function useInsuranceStatus(id?: string, revision?: number) {
  const [result, setResult] = useState<{
    id: string;
    revision?: number | undefined;
    summary?: InsuranceActionSummary;
  }>();
  useEffect(() => {
    if (!id) return;
    let live = true;
    let sequence = 0;
    const refresh = () => {
      const call = ++sequence;
      void insuranceResponse(
        `reservations/requests/${encodeURIComponent(id)}/insurance`,
      )
        .then((response) => response.json() as Promise<InsuranceActionSummary>)
        .then((summary) => {
          if (live && call === sequence) setResult({ id, revision, summary });
        })
        .catch(() => {
          if (live && call === sequence) setResult({ id, revision });
        });
    };
    refresh();
    const timer = setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    window.addEventListener('reservation-workflow-changed', refresh);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('reservation-workflow-changed', refresh);
    };
  }, [id, revision]);
  return result?.id === id && result?.revision === revision
    ? result.summary
    : undefined;
}
