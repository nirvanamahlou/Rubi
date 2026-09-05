'use client';
import { useEffect, useState } from 'react';
import type { ReservationIntakeV1 } from '@rubi/contracts';
import { Button } from '@/components/ui/button';
import { Alert, Card, PageHeader } from '@/components/ui/surfaces';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';

export function ReservationInbox() {
  const [requests, setRequests] = useState<ReservationIntakeV1[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setBusy(true);
      setError('');
      void (async () => {
        const base = getPublicApiBaseUrl();
        if (!base) throw new Error('نشانی سرور پیکربندی نشده است.');
        const get = () =>
          fetch(`${base}/reservations/requests`, {
            credentials: 'include',
            cache: 'no-store',
          });
        let response = await get();
        if (
          response.status === 401 &&
          (await refreshAuthenticatedSession(base))
        )
          response = await get();
        if (!response.ok)
          throw new Error(
            'دریافت صف رزرواسیون ناموفق بود؛ دسترسی خود را بررسی کنید.',
          );
        const result = (await response.json()) as {
          data: ReservationIntakeV1[];
        };
        if (active) setRequests(result.data);
      })()
        .catch((reason: unknown) => {
          if (active)
            setError(
              reason instanceof Error ? reason.message : 'دریافت ناموفق بود.',
            );
        })
        .finally(() => {
          if (active) setBusy(false);
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [refresh]);
  return (
    <div className="grid gap-4">
      <PageHeader
        title="درخواست‌های رزرواسیون"
        description="قراردادهای دریافت‌شده برای بررسی ظرفیت و اجرای خدمات"
        actions={
          <Button disabled={busy} onClick={() => setRefresh(refresh + 1)}>
            به‌روزرسانی
          </Button>
        }
      />
      {busy ? (
        <p>در حال دریافت…</p>
      ) : error ? (
        <Alert tone="error" title={error} />
      ) : !requests.length ? (
        <p>درخواستی دریافت نشده است.</p>
      ) : (
        requests.map((request) => (
          <Card key={request.id} className="p-5">
            <h2 className="font-bold">
              قرارداد {request.snapshot.contractNumber}
            </h2>
            <p>نسخه {request.contractVersion} · در انتظار بررسی و اجرا</p>
            <p>
              {request.snapshot.passengerIds.length} مسافر ·{' '}
              {request.snapshot.serviceSelections
                .map((service) => service.titleSnapshot)
                .join('، ')}
            </p>
            <p>{new Date(request.receivedAt).toLocaleString('fa-IR')}</p>
          </Card>
        ))
      )}
    </div>
  );
}
