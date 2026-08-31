'use client';
import { useEffect, useState } from 'react';
import type { MasterDataRecord } from '@rubi/contracts';
import { masterDataApi } from '../api/client';
import { Button } from '@/components/ui/button';

export function MasterDataTransportAudit({
  record,
}: {
  record: MasterDataRecord;
}) {
  const [page, setPage] = useState(1);
  const requestKey = `${record.resource}:${record.id}:${record.version}:${page}`;
  const [responseState, setResponseState] = useState<{
    requestKey: string;
    rows: readonly Record<string, unknown>[];
    total: number;
    error?: string;
  }>();
  const result =
    responseState?.requestKey === requestKey ? responseState : undefined;
  useEffect(() => {
    let cancelled = false;
    void masterDataApi.audit(record.resource, record.id, page).then(
      (response) => {
        if (!cancelled)
          setResponseState({
            requestKey,
            rows: response.data,
            total: response.meta.total,
          });
      },
      () => {
        if (!cancelled)
          setResponseState({
            requestKey,
            rows: [],
            total: 0,
            error: 'دریافت تاریخچه ممکن نشد؛ دسترسی و اتصال را بررسی کنید.',
          });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [record.resource, record.id, page, requestKey]);
  return (
    <section
      aria-label="تاریخچه تغییرات"
      className="rounded-2xl border border-border p-4"
    >
      <h3 className="font-bold">تاریخچه تغییرات</h3>
      {!result ? (
        <p role="status">در حال دریافت تاریخچه…</p>
      ) : result.error ? (
        <p role="alert">{result.error}</p>
      ) : (
        <>
          {!result.rows.length ? (
            <p>تاریخچه‌ای ثبت نشده است.</p>
          ) : (
            <ol className="mt-3 space-y-3">
              {result.rows.map((row) => (
                <li
                  key={String(row.id)}
                  className="border-b border-border pb-2 text-sm"
                >
                  <span>
                    {String(row.action) === 'master_data.create'
                      ? 'ایجاد'
                      : 'به‌روزرسانی'}
                  </span>
                  <time className="ms-3" dateTime={String(row.occurredAt)}>
                    {new Date(String(row.occurredAt)).toLocaleString('fa-IR')}
                  </time>
                  <p className="mt-1 text-xs text-muted-foreground">
                    شناسه ثبت‌کننده: {String(row.actorUserId)}
                  </p>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              قبلی
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page * 25 >= result.total}
              onClick={() => setPage(page + 1)}
            >
              بعدی
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
