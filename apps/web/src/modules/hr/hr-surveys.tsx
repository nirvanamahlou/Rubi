'use client';

import { useCallback, useEffect, useState } from 'react';
import type { WorkbenchFeedbackInboxResponseV1 } from '@nora/contracts';
import { Button, Card } from '@/components/ui';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';

async function loadSurveys(
  page: number,
  retried = false,
): Promise<WorkbenchFeedbackInboxResponseV1> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl) throw new Error('نشانی سرویس تنظیم نشده است.');
  const response = await fetch(
    `${baseUrl}/workbench/feedback/hr/inbox?page=${page}&pageSize=20`,
    {
      credentials: 'include',
      cache: 'no-store',
      headers: { accept: 'application/json' },
    },
  );
  if (
    response.status === 401 &&
    !retried &&
    (await refreshAuthenticatedSession(baseUrl))
  ) {
    return loadSurveys(page, true);
  }
  if (!response.ok) {
    throw new Error(
      response.status === 403
        ? 'برای مشاهده نظرسنجی‌های منابع انسانی دسترسی ندارید.'
        : 'دریافت نظرسنجی‌ها انجام نشد.',
    );
  }
  return response.json() as Promise<WorkbenchFeedbackInboxResponseV1>;
}

export function HrSurveys() {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<WorkbenchFeedbackInboxResponseV1 | null>(
    null,
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(() => {
    setLoading(true);
    setError('');
    setRevision((value) => value + 1);
  }, []);
  useEffect(() => {
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    let active = true;
    void loadSurveys(page)
      .then((value) => {
        if (active) {
          setResult(value);
          setError('');
        }
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : 'دریافت نظرسنجی‌ها انجام نشد.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, revision]);

  return (
    <section className="space-y-5" aria-label="نظرسنجی‌های منابع انسانی">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black">نظرسنجی‌ها و پیشنهادها</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            نظرهای ثبت‌شده در میزکار کاربران با مقصد منابع انسانی
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={refresh}
          disabled={loading}
        >
          به‌روزرسانی
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {loading && !result ? (
        <p role="status">در حال دریافت نظرسنجی‌ها…</p>
      ) : null}
      {!loading && !error && result?.total === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          هنوز نظرسنجی‌ای برای منابع انسانی ثبت نشده است.
        </Card>
      ) : null}
      {result?.data.map((item) => (
        <Card key={item.id} className="space-y-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="font-bold">{item.subject}</h2>
            <span className="text-xs text-muted-foreground">
              {new Date(item.submittedAt).toLocaleString('fa-IR')}
            </span>
          </div>
          <p className="whitespace-pre-wrap break-words text-sm leading-7">
            {item.body}
          </p>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>
              {item.anonymous
                ? 'فرستنده ناشناس'
                : (item.sender?.displayName ?? 'فرستنده نامشخص')}
            </span>
            <span>کد پیگیری: {item.trackingNumber}</span>
            {item.attachmentCount > 0 ? (
              <span>{item.attachmentCount.toLocaleString('fa-IR')} پیوست</span>
            ) : null}
          </div>
        </Card>
      ))}
      {result && result.total > result.pageSize ? (
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={page <= 1 || loading}
            onClick={() => {
              setLoading(true);
              setPage((value) => value - 1);
            }}
          >
            صفحه قبل
          </Button>
          <span className="text-sm text-muted-foreground">
            صفحه {page.toLocaleString('fa-IR')} از{' '}
            {Math.ceil(result.total / result.pageSize).toLocaleString('fa-IR')}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={page * result.pageSize >= result.total || loading}
            onClick={() => {
              setLoading(true);
              setPage((value) => value + 1);
            }}
          >
            صفحه بعد
          </Button>
        </div>
      ) : null}
    </section>
  );
}
