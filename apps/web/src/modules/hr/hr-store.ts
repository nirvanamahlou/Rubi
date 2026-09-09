'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  HrBootstrapDto,
  HrRecordCreate,
  HrRecordDto,
  HrRecordUpdate,
} from '@rubi/contracts';
import { hrApi } from './hr-api';

export function useHrStore() {
  const [data, setData] = useState<HrBootstrapDto | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    try {
      const next = await hrApi.bootstrap();
      if (request === generation.current) {
        setData(next);
        setError('');
        setRevision((value) => value + 1);
      }
    } catch (e) {
      if (request === generation.current)
        setError(e instanceof Error ? e.message : 'دریافت اطلاعات انجام نشد.');
      throw e;
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, []);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh().catch(() => undefined);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      invalidate();
    };
  }, [refresh, invalidate]);
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible')
        void refresh().catch(() => undefined);
    };
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, [refresh]);
  const remember = useCallback((records: readonly HrRecordDto[]) => {
    setData((current) => {
      if (!current) return current;
      const incoming = new Map(records.map((record) => [record.id, record]));
      return {
        ...current,
        records: [
          ...current.records.map((record) => {
            const next = incoming.get(record.id);
            incoming.delete(record.id);
            return next ?? record;
          }),
          ...incoming.values(),
        ],
      };
    });
  }, []);
  const mutated = useCallback(async () => {
    setRevision((value) => value + 1);
    window.dispatchEvent(new Event('rubi:hr-server-change'));
    await refresh().catch(() => undefined);
  }, [refresh]);
  const create = useCallback(
    async (input: HrRecordCreate, key: string) => {
      const record = await hrApi.records.create(input, key);
      remember([record]);
      await mutated();
      return record;
    },
    [remember, mutated],
  );
  const update = useCallback(
    async (record: HrRecordDto, input: Omit<HrRecordUpdate, 'version'>) => {
      const result = await hrApi.records.update(record.id, {
        ...input,
        version: record.version,
      });
      remember([result]);
      await mutated();
      return result;
    },
    [remember, mutated],
  );
  const remove = useCallback(
    async (record: HrRecordDto) => {
      await hrApi.records.remove(record.id, record.version);
      await mutated();
    },
    [mutated],
  );
  return {
    data,
    error,
    loading,
    revision,
    refresh,
    remember,
    create,
    update,
    remove,
    mutated,
  };
}
export type HrStore = ReturnType<typeof useHrStore>;

export async function allHrRecords(
  query: Record<string, string | number>,
): Promise<HrRecordDto[]> {
  const records: HrRecordDto[] = [];
  let page = 1;
  while (true) {
    const result = await hrApi.records.list({ ...query, page, pageSize: 200 });
    records.push(...result.items);
    if (records.length >= result.total || !result.items.length) return records;
    page++;
    if (page > 500)
      throw new Error(
        'حجم گزارش زیاد است؛ بازه یا فیلتر دقیق‌تری انتخاب کنید.',
      );
  }
}
