'use client';

import { ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Skeleton,
} from '@/components/ui';
import {
  customerAffairsApi,
  CustomerAffairsApiError,
} from '@/modules/customer-affairs/api/customer-affairs-client';
import { workbenchDate } from './model';

type Referral = Awaited<
  ReturnType<typeof customerAffairsApi.workbenchReferrals>
>['data'][number];

export function WorkbenchCustomerAffairsReferrals({
  enabled,
  canRespond,
}: {
  enabled: boolean;
  canRespond: boolean;
}) {
  const [rows, setRows] = useState<Referral[]>([]);
  const [state, setState] = useState<
    'loading' | 'ready' | 'error' | 'forbidden'
  >(enabled ? 'loading' : 'forbidden');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  async function respond(row: Referral, status: 'IN_PROGRESS' | 'DONE') {
    setPending(row.id);
    setMessage('');
    try {
      await customerAffairsApi.respondReferral(
        row.id,
        status,
        status === 'DONE'
          ? 'اقدام واحد مقصد انجام شد.'
          : 'ارجاع در کارتابل دریافت شد.',
      );
      setRows((current) =>
        status === 'DONE'
          ? current.filter((item) => item.id !== row.id)
          : current.map((item) =>
              item.id === row.id ? { ...item, status } : item,
            ),
      );
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : 'پاسخ ارجاع ثبت نشد.',
      );
    } finally {
      setPending(null);
    }
  }
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void customerAffairsApi
      .workbenchReferrals()
      .then((response) => {
        if (!controller.signal.aborted) {
          setRows(response.data);
          setState('ready');
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setState(
            cause instanceof CustomerAffairsApiError && cause.status === 403
              ? 'forbidden'
              : 'error',
          );
          setMessage(
            cause instanceof Error ? cause.message : 'ارجاعات دریافت نشد.',
          );
        }
      });
    return () => controller.abort();
  }, [enabled]);
  if (state === 'forbidden') return null;
  if (state === 'loading') return <Skeleton className="h-32" />;
  if (state === 'error')
    return (
      <Alert
        title="ارجاعات امور مشتریان دریافت نشد"
        description={message}
        tone="error"
      />
    );
  if (!rows.length)
    return (
      <EmptyState
        title="ارجاع بازی ندارید"
        description="ارجاع‌های امور مشتریان که به شما یا صف عمومی سپرده شوند اینجا دیده می‌شوند."
        icon={ClipboardList}
      />
    );
  return (
    <section
      aria-labelledby="customer-affairs-referrals-title"
      className="space-y-3"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-black" id="customer-affairs-referrals-title">
          ارجاعات امور مشتریان
        </h2>
        <Badge>{rows.length.toLocaleString('fa-IR')} مورد</Badge>
      </div>
      {message ? (
        <Alert title="پاسخ ارجاع ثبت نشد" description={message} tone="error" />
      ) : null}
      {rows.map((row) => (
        <Card className="p-4" key={row.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">
                {row.trackingNumber} · {row.destinationModule}
              </p>
              <h3 className="mt-1 font-bold">{row.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {row.ticketSubject}
              </p>
            </div>
            <Badge>{row.status}</Badge>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>موعد: {workbenchDate(row.dueAt)}</span>
            <div className="flex flex-wrap gap-2">
              {canRespond && row.status === 'OPEN' ? (
                <Button
                  disabled={pending === row.id}
                  onClick={() => void respond(row, 'IN_PROGRESS')}
                  size="sm"
                  variant="outline"
                >
                  دریافت ارجاع
                </Button>
              ) : null}
              {canRespond ? (
                <Button
                  disabled={pending === row.id}
                  onClick={() => void respond(row, 'DONE')}
                  size="sm"
                >
                  ثبت انجام کار
                </Button>
              ) : null}
              <Button asChild size="sm" variant="outline">
                <Link
                  href={`/customer-affairs?tab=tickets&ticket=${encodeURIComponent(row.ticketId)}`}
                >
                  باز کردن تیکت
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </section>
  );
}
