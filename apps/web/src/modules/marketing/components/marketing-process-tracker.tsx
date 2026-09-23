'use client';

import type {
  MarketingProcessProjectionV1,
  MarketingProcessStageStatus,
} from '@nora/contracts';
import {
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Badge, Card, EmptyState } from '@/components/ui/surfaces';
import { cn } from '@/lib/utils';
import {
  fetchMarketingProcess,
  MarketingProcessApiError,
} from '../api/process-client';

const statusLabels: Record<MarketingProcessStageStatus, string> = {
  AVAILABLE: 'عملیاتی',
  PARTIAL: 'بخشی متصل',
  INFRASTRUCTURE_PENDING: 'در انتظار زیرساخت',
};

const statusClasses: Record<MarketingProcessStageStatus, string> = {
  AVAILABLE:
    'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200',
  PARTIAL:
    'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200',
  INFRASTRUCTURE_PENDING:
    'bg-slate-100 text-slate-700 dark:bg-slate-400/15 dark:text-slate-200',
};

function ProcessStageIcon({ status }: { status: MarketingProcessStageStatus }) {
  if (status === 'AVAILABLE')
    return <CheckCircle2 aria-hidden="true" className="size-5" />;
  if (status === 'PARTIAL')
    return <TriangleAlert aria-hidden="true" className="size-5" />;
  return <CircleDashed aria-hidden="true" className="size-5" />;
}

export function MarketingProcessTracker() {
  const [projection, setProjection] =
    useState<MarketingProcessProjectionV1 | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetchMarketingProcess(signal);
      setProjection(response.data);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setProjection(null);
      setError(
        cause instanceof MarketingProcessApiError || cause instanceof Error
          ? cause.message
          : 'دریافت وضعیت فرایند مارکتینگ ناموفق بود.',
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  const retry = () => {
    setLoading(true);
    setError('');
    void load();
  };

  useEffect(() => {
    const controller = new AbortController();
    void fetchMarketingProcess(controller.signal)
      .then((response) => {
        setProjection(response.data);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setProjection(null);
        setError(
          cause instanceof MarketingProcessApiError || cause instanceof Error
            ? cause.message
            : 'دریافت وضعیت فرایند مارکتینگ ناموفق بود.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  if (loading)
    return (
      <Card
        aria-live="polite"
        className="flex min-h-56 items-center justify-center gap-3 p-8 text-muted-foreground"
      >
        <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
        در حال دریافت وضعیت واقعی زیرساخت فرایند…
      </Card>
    );

  if (error || !projection)
    return (
      <EmptyState
        action={
          <Button onClick={retry} variant="outline">
            <RefreshCw aria-hidden="true" className="size-4" />
            تلاش دوباره
          </Button>
        }
        description={error || 'پاسخ معتبری از API دریافت نشد.'}
        title="وضعیت فرایند در دسترس نیست"
      />
    );

  const available = projection.stages.filter(
    (stage) => stage.status === 'AVAILABLE',
  ).length;
  const partial = projection.stages.filter(
    (stage) => stage.status === 'PARTIAL',
  ).length;
  const pending = projection.stages.length - available - partial;

  return (
    <section aria-labelledby="marketing-process-title" className="grid gap-5">
      <Card className="overflow-hidden p-0">
        <div className="grid gap-5 bg-gradient-to-l from-primary/10 via-surface to-surface p-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="text-lg font-black" id="marketing-process-title">
              زنجیره قابل‌پیگیری بازاریابی تا سفر
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
              هر مرحله فقط وقتی «عملیاتی» نمایش داده می‌شود که ماژول مالک و مسیر
              واقعی آن در سامانه موجود باشد. بخش‌های فاقد Persistence یا قرارداد
              عمومی با وضعیت صریح باقی مانده‌اند.
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-xl bg-emerald-100 px-4 py-3 text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-100">
              <dt>عملیاتی</dt>
              <dd className="mt-1 text-xl font-black">
                {available.toLocaleString('fa-IR')}
              </dd>
            </div>
            <div className="rounded-xl bg-amber-100 px-4 py-3 text-amber-900 dark:bg-amber-400/15 dark:text-amber-100">
              <dt>بخشی</dt>
              <dd className="mt-1 text-xl font-black">
                {partial.toLocaleString('fa-IR')}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-100 px-4 py-3 text-slate-800 dark:bg-slate-400/15 dark:text-slate-100">
              <dt>زیرساخت</dt>
              <dd className="mt-1 text-xl font-black">
                {pending.toLocaleString('fa-IR')}
              </dd>
            </div>
          </dl>
        </div>
      </Card>

      <ol className="grid gap-4" aria-label="مراحل فرایند بازاریابی">
        {projection.stages.map((stage, index) => (
          <li className="relative" key={stage.key}>
            {index < projection.stages.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute right-7 top-full h-4 w-px bg-border"
              />
            ) : null}
            <Card className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] lg:items-start">
              <div className="flex min-w-0 gap-4">
                <span
                  className={cn(
                    'grid size-14 shrink-0 place-items-center rounded-2xl',
                    statusClasses[stage.status],
                  )}
                >
                  <ProcessStageIcon status={stage.status} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">
                      مرحله {stage.order.toLocaleString('fa-IR')}
                    </span>
                    <Badge className={statusClasses[stage.status]}>
                      {statusLabels[stage.status]}
                    </Badge>
                  </div>
                  <h3 className="mt-2 font-black">{stage.title}</h3>
                  <p className="mt-1 text-sm leading-7 text-muted-foreground">
                    {stage.description}
                  </p>
                  <p className="mt-2 text-xs font-bold text-primary">
                    مالک: {stage.ownerModule}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 text-sm">
                <div>
                  <h4 className="font-bold">موارد قابل ثبت یا پیگیری</h4>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {stage.trackedFields.map((field) => (
                      <li key={field}>
                        <Badge>{field}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
                {stage.missingCapabilities.length ? (
                  <div>
                    <h4 className="font-bold text-amber-800 dark:text-amber-200">
                      زیرساخت باقی‌مانده
                    </h4>
                    <ul className="mt-1 list-inside list-disc space-y-1 text-xs leading-6 text-muted-foreground">
                      {stage.missingCapabilities.map((capability) => (
                        <li key={capability}>{capability}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              {stage.action.available ? (
                <Button asChild className="justify-center" variant="outline">
                  <Link href={stage.action.href}>
                    {stage.action.label}
                    <ArrowLeft aria-hidden="true" className="size-4" />
                  </Link>
                </Button>
              ) : (
                <Button disabled title="نیازمند تکمیل زیرساخت پایدار">
                  {stage.action.label}
                </Button>
              )}
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}
