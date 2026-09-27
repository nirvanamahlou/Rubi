'use client';

import { ClipboardCheck } from 'lucide-react';
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
import { shouldShowWorkbenchRequestStatus } from './workbench-request-status';

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
      <div className="grid gap-3 lg:grid-cols-2">
        {rows.map((row, index) => (
          <Card className="p-4" key={row.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">
                  {row.trackingNumber} · {row.destinationUnit ?? 'واحد مقصد'}
                </p>
                <h3 className="mt-1 font-bold">{row.subject}</h3>
              </div>
              {shouldShowWorkbenchRequestStatus(row.status, index === 0) ? (
                <Badge>{row.status}</Badge>
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
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
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogTitle>جزئیات درخواست</DialogTitle>
          <DialogDescription>
            این درخواست از میزکار شما ثبت شده و برای واحد مقصد پیگیری می‌شود.
          </DialogDescription>
          {selected ? (
            <div className="mt-4 space-y-4 rounded-xl border bg-muted/30 p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-xs text-muted-foreground">
                  {selected.trackingNumber}
                </span>
                {shouldShowWorkbenchRequestStatus(
                  selected.status,
                  selected.id === rows[0]?.id,
                ) ? (
                  <Badge>{selected.status}</Badge>
                ) : null}
              </div>
              <h3 className="font-black">{selected.subject}</h3>
              <div>
                <dt className="text-xs text-muted-foreground">شرح درخواست</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words leading-7 text-foreground">
                  {selected.description}
                </dd>
              </div>
              <dl className="grid grid-cols-2 gap-4 text-muted-foreground">
                <div>
                  <dt className="text-xs">واحد مقصد</dt>
                  <dd className="mt-1 font-semibold text-foreground">
                    {selected.destinationUnit ?? 'تعیین نشده'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs">اولویت</dt>
                  <dd className="mt-1 font-semibold text-foreground">
                    {workbenchRequestPriorityLabel(selected.priority)}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs">موعد اقدام</dt>
                  <dd className="mt-1 font-semibold text-foreground">
                    {workbenchDate(selected.nextActionAt)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
