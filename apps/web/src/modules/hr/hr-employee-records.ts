'use client';
import { useEffect, useState } from 'react';
import type { HrRecordDto } from '@nora/contracts';
import { allHrRecords } from './hr-store';

export function useHrEmployeeRecords(
  employeeId: string | undefined,
  revision: number,
  range?: { from: string; to: string },
) {
  const key = JSON.stringify([employeeId, revision, range?.from, range?.to]);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    records?: HrRecordDto[];
    error?: string;
  }>();
  useEffect(() => {
    if (!employeeId) return;
    let active = true;
    void allHrRecords({
      employeeId,
      ...(range?.from ? { from: range.from } : {}),
      ...(range?.to ? { to: range.to } : {}),
    })
      .then((records) => {
        if (active) setResult({ key, records });
      })
      .catch((error: unknown) => {
        if (active)
          setResult({
            key,
            error:
              error instanceof Error
                ? error.message
                : 'دریافت پرونده انجام نشد.',
          });
      });
    return () => {
      active = false;
    };
  }, [employeeId, key, attempt, range?.from, range?.to]);
  const current = result?.key === key ? result : undefined;
  return {
    records: current?.records,
    error: current?.error,
    loading: Boolean(employeeId && !current?.records && !current?.error),
    retry: () => setAttempt((value) => value + 1),
  };
}
