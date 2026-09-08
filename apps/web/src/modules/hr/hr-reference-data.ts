'use client';
import { useEffect, useState } from 'react';
import type { HrRecordDto } from '@rubi/contracts';
import { allHrRecords, type HrStore } from './hr-store';

export function useHrReferenceData(store: HrStore) {
  const [loaded, setLoaded] = useState<HrRecordDto[] | null>(null);
  const [error, setError] = useState('');
  const truncated = store.data!.recordsTruncated;
  useEffect(() => {
    if (!truncated) return;
    let active = true;
    void allHrRecords({})
      .then((records) => {
        if (active) {
          setLoaded(records);
          setError('');
        }
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : 'دریافت مقادیر انتخابی انجام نشد.',
          );
      });
    return () => {
      active = false;
    };
  }, [truncated, store.revision]);
  return {
    data:
      truncated && loaded ? { ...store.data!, records: loaded } : store.data!,
    loading: truncated && !loaded && !error,
    error: truncated ? error : '',
  };
}
