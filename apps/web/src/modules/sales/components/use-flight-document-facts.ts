'use client';
import { useEffect, useState } from 'react';
import { localizedFetch } from '@/i18n/localized-fetch';
import { getPublicApiBaseUrl } from '@/lib/environment';
import {
  readTicketDocumentFacts,
  type TicketDocumentFacts,
} from '@/modules/ticket-catalog/public/document-details';
const empty: Record<string, TicketDocumentFacts> = {};
export function useFlightDocumentFacts(
  offers: Parameters<typeof readTicketDocumentFacts>[0],
) {
  const key = JSON.stringify(offers);
  const [result, setResult] = useState<{
    key: string;
    facts: Record<string, TicketDocumentFacts>;
  }>();
  useEffect(() => {
    let active = true;
    const base = getPublicApiBaseUrl();
    if (!base) return;
    void readTicketDocumentFacts(
      JSON.parse(key) as Parameters<typeof readTicketDocumentFacts>[0],
      (path) =>
        localizedFetch(
          base +
            path.replace('/master-data/', '/master-data/selections/sales/'),
          { credentials: 'include', cache: 'no-store' },
        ),
    ).then((facts) => {
      if (active) setResult({ key, facts });
    });
    return () => {
      active = false;
    };
  }, [key]);
  return result?.key === key ? result.facts : empty;
}
