'use client';
import { useEffect, useState } from 'react';
import type { HrRecordDto } from '@rubi/contracts';
import { allHrRecords, type HrStore } from './hr-store';

export function useHrReferenceData(store: HrStore) {
  const [result, setResult] = useState<{
    revision: number;
    records?: HrRecordDto[];
    error?: string;
  }>();
  const loaded =
    result?.revision === store.revision ? result.records : undefined;
  const error = result?.revision === store.revision ? (result.error ?? '') : '';
  const truncated = store.data!.recordsTruncated;
  useEffect(() => {
    if (!truncated) return;
    let active = true;
    void allHrRecords({})
      .then((records) => {
        if (active) {
          setResult({ revision: store.revision, records });
        }
      })
      .catch((e) => {
        if (active)
          setResult({
            revision: store.revision,
            error:
              e instanceof Error
                ? e.message
                : 'دریافت مقادیر انتخابی انجام نشد.',
          });
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
