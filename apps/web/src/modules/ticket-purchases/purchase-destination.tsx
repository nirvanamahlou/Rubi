'use client';
import { useEffect, useState } from 'react';
import { getActiveCityReference } from '@/modules/ticket-catalog/api/references';
export function PurchaseDestination({ id }: { id?: string | undefined }) {
  const [result, setResult] = useState<{ id: string; name: string }>();
  useEffect(() => {
    let live = true;
    if (id)
      getActiveCityReference(id, 'procurement')
        .then((city) => {
          if (live) setResult({ id: id!, name: city?.name ?? '' });
        })
        .catch(() => {});
    return () => {
      live = false;
    };
  }, [id]);
  return <span>{result?.id === id ? result?.name || '—' : '—'}</span>;
}
