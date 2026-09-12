'use client';

import type { WorkbenchFeedbackDetailV1 } from '@rubi/contracts';
import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Skeleton,
} from '@/components/ui';
import { workbenchDate } from './model';
import { messageUnits } from './message-templates';
import { workbenchFeedbackApi } from './workbench-feedback-api';

export function WorkbenchFeedbackDetail({
  id,
  onClose,
}: {
  id: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<WorkbenchFeedbackDetailV1 | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void workbenchFeedbackApi
      .detail(id)
      .then((response) => {
        if (active) setDetail(response.data);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : 'دریافت نظرسنجی انجام نشد.',
          );
      });
    return () => {
      active = false;
    };
  }, [id]);
  const department = detail
    ? messageUnits.find(({ id: unitId }) => unitId === detail.department)?.label
    : null;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>جزئیات نظرسنجی</DialogTitle>
        <DialogDescription>
          متن کامل برای فرستنده و اعضای مجاز واحد مقصد نمایش داده می‌شود.
        </DialogDescription>
        {error ? (
          <Alert tone="error" title={error} />
        ) : detail ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{department ?? detail.department}</Badge>
              <Badge className="border border-border bg-background text-foreground">
                {detail.trackingNumber}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {workbenchDate(detail.submittedAt)}
              </span>
            </div>
            <div className="rounded-xl border bg-muted/30 p-4">
              <h3 className="font-bold">{detail.subject}</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7">
                {detail.body}
              </p>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <dt className="text-muted-foreground">فرستنده</dt>
                <dd className="mt-1 font-semibold">
                  {detail.sender?.displayName ?? 'ناشناس'}
                </dd>
              </div>
              <div className="rounded-lg border p-3">
                <dt className="text-muted-foreground">پیوست</dt>
                <dd className="mt-1 font-semibold">
                  {detail.attachmentCount.toLocaleString('fa-IR')} فایل ثبت‌شده
                  در اسناد
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <div className="space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-28 w-full" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
