'use client';

import { Building2, ClipboardCheck, Clock3, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';

import {
  Alert,
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  Skeleton,
} from '@/components/ui';
import { customerAffairsApi } from '@/modules/customer-affairs/api/customer-affairs-client';
import { workbenchDate } from './model';
import { workbenchRequestPriorityLabel } from './workbench-request-priority';
import {
  shouldShowWorkbenchRequestStatus,
  workbenchRequestStatusLabel,
} from './workbench-request-status';

type WorkbenchRequest = Awaited<
  ReturnType<typeof customerAffairsApi.workbenchRequests>
>['data'][number];

export function WorkbenchOwnRequests() {
  const [rows, setRows] = useState<WorkbenchRequest[]>([]);
  const [selected, setSelected] = useState<WorkbenchRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void customerAffairsApi
      .workbenchRequests()
      .then(({ data }) => {
        if (active) setRows(data);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : 'درخواست‌ها دریافت نشدند.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  if (loading) return <Skeleton className="h-32" />;
  if (error)
    return (
      <Alert
        tone="error"
        title="درخواست‌های من دریافت نشدند"
        description={error}
      />
    );
  if (!rows.length)
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="هنوز درخواستی ثبت نکرده‌اید"
        description="درخواست‌های بین‌واحدی ثبت‌شده از میزکار اینجا پیگیری می‌شوند."
      />
    );
  return (
    <section
      className="space-y-3"
      aria-labelledby="workbench-own-requests-title"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-black" id="workbench-own-requests-title">
          درخواست‌های ثبت‌شده من
        </h2>
        <Badge>{rows.length.toLocaleString('fa-IR')} مورد</Badge>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {rows.map((row, index) => (
          <Card
            className="overflow-hidden border-primary/15 bg-gradient-to-br from-surface via-surface to-primary/5 p-0 shadow-sm"
            key={row.id}
          >
            <div className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <FileText className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted-foreground">
                      {row.trackingNumber}
                    </p>
                    <h3 className="mt-1 truncate font-black">{row.subject}</h3>
                  </div>
                </div>
                {shouldShowWorkbenchRequestStatus(row.status, index === 0) ? (
                  <Badge>{workbenchRequestStatusLabel(row.status)}</Badge>
                ) : null}
              </div>
              <p className="max-h-12 overflow-hidden text-sm leading-6 text-muted-foreground">
                {row.description || 'شرحی برای این درخواست ثبت نشده است.'}
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <span className="flex items-center gap-2 rounded-xl bg-muted/70 px-3 py-2 text-muted-foreground">
                  <Building2
                    className="size-4 text-primary"
                    aria-hidden="true"
                  />
                  {row.destinationUnit ?? 'واحد مقصد'}
                </span>
                <span className="flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 font-semibold text-violet-800 dark:bg-violet-950/40 dark:text-violet-100">
                  <Clock3 className="size-4" aria-hidden="true" />
                  فوریت: {workbenchRequestPriorityLabel(row.priority)}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-primary/10 bg-primary/5 px-5 py-3 text-xs text-muted-foreground">
              <span>موعد اقدام: {workbenchDate(row.nextActionAt)}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelected(row)}
              >
                جزئیات درخواست
              </Button>
            </div>
          </Card>
        ))}
      </div>
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent
          dir="rtl"
          className="max-w-xl overflow-hidden p-0 [&>button]:text-white [&>button:hover]:bg-white/15 [&>button:focus-visible]:ring-white"
        >
          {selected ? (
            <div className="text-sm">
              <div className="bg-gradient-to-l from-blue-700 via-blue-600 to-violet-600 p-6 pe-14 text-white">
                <div className="flex items-start gap-3">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                    <FileText className="size-6" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <DialogTitle className="truncate text-xl font-black">
                      {selected.subject}
                    </DialogTitle>
                    <DialogDescription className="mt-1 truncate text-white">
                      {selected.trackingNumber}
                    </DialogDescription>
                  </div>
                </div>
              </div>
              <div className="space-y-5 p-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    ثبت‌شده از میزکار شما
                  </span>
                  {shouldShowWorkbenchRequestStatus(
                    selected.status,
                    selected.id === rows[0]?.id,
                  ) ? (
                    <Badge>
                      {workbenchRequestStatusLabel(selected.status)}
                    </Badge>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
                  <dt className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                    <FileText
                      className="size-4 text-primary"
                      aria-hidden="true"
                    />
                    شرح درخواست
                  </dt>
                  <dd className="mt-3 whitespace-pre-wrap break-words leading-7 text-foreground">
                    {selected.description ||
                      'شرحی برای این درخواست ثبت نشده است.'}
                  </dd>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-muted-foreground">
                  <div className="rounded-xl bg-muted/60 p-3">
                    <dt className="text-xs">واحد مقصد</dt>
                    <dd className="mt-1 font-semibold text-foreground">
                      {selected.destinationUnit ?? 'تعیین نشده'}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-violet-50 p-3 dark:bg-violet-950/40">
                    <dt className="text-xs">فوریت</dt>
                    <dd className="mt-1 font-semibold text-foreground">
                      {workbenchRequestPriorityLabel(selected.priority)}
                    </dd>
                  </div>
                  <div className="col-span-2 rounded-xl bg-muted/60 p-3">
                    <dt className="text-xs">موعد اقدام</dt>
                    <dd className="mt-1 font-semibold text-foreground">
                      {workbenchDate(selected.nextActionAt)}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
