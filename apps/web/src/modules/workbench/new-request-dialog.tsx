'use client';
import { WorkbenchSelect } from './workbench-select';

import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  Textarea,
} from '@/components/ui';
import { messageUnits } from './message-templates';
import { customerAffairsApi } from '@/modules/customer-affairs/api/customer-affairs-client';

export function NewRequestDialog({
  open,
  onOpenChange,
  branchId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  branchId?: string;
  onCreated?: () => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [unit, setUnit] = useState('sales');
  const [priority, setPriority] = useState('normal');
  const [reference, setReference] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-w-3xl max-h-[90dvh] overflow-y-auto"
      >
        <DialogTitle>درخواست جدید</DialogTitle>
        <DialogDescription>
          عنوان، شرح و واحد مقصد را مشخص کنید؛ درخواست در کارتابل ثبت می‌شود.
        </DialogDescription>
        <form
          className="mt-5 grid gap-5 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!branchId || pending) return;
            setPending(true);
            setError('');
            setSuccess('');
            const unitLabel =
              messageUnits.find((item) => item.id === unit)?.label ?? unit;
            const nextActionAt = new Date(
              Date.now() + 24 * 60 * 60 * 1000,
            ).toISOString();
            void customerAffairsApi
              .createWorkbenchRequest(
                {
                  subject: title.trim(),
                  description: `${body.trim()}${reference.trim() ? `\n\nمرجع پرونده: ${reference.trim()}` : ''}`,
                  channel: 'CHAT',
                  contactOccurredAt: new Date().toISOString(),
                  category: `WORKBENCH_${unit.toUpperCase()}`,
                  serviceType: 'INTERNAL_REQUEST',
                  impact: priority === 'normal' ? 'NORMAL' : 'HIGH',
                  urgency:
                    priority === 'urgent'
                      ? 'HIGH'
                      : priority === 'high'
                        ? 'NORMAL'
                        : 'LOW',
                  priority: priority.toUpperCase() as
                    'NORMAL' | 'HIGH' | 'URGENT',
                  executionUnit: unitLabel,
                  references: [],
                  nextAction: `بررسی توسط واحد ${unitLabel}`,
                  nextActionAt,
                },
                branchId,
              )
              .then((response) => {
                setSuccess(
                  `درخواست ثبت شد. کد پیگیری: ${response.data.trackingNumber}`,
                );
                setTitle('');
                setBody('');
                setReference('');
                onCreated?.();
              })
              .catch((reason) =>
                setError(
                  reason instanceof Error
                    ? reason.message
                    : 'ثبت درخواست انجام نشد.',
                ),
              )
              .finally(() => setPending(false));
          }}
        >
          <label className="space-y-2 text-sm font-semibold">
            <span>عنوان درخواست *</span>
            <Input
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="space-y-2 text-sm font-semibold">
            <span>واحد مقصد *</span>
            <WorkbenchSelect
              label="واحد مقصد"
              value={unit}
              onValueChange={setUnit}
              required
              options={messageUnits
                .filter((item) => item.id !== 'ai')
                .map((item) => ({ value: item.id, label: item.label }))}
            />
          </label>
          <label className="space-y-2 text-sm font-semibold sm:col-span-2">
            <span>شرح درخواست *</span>
            <Textarea
              required
              rows={5}
              maxLength={10000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <label className="space-y-2 text-sm font-semibold">
            <span>اولویت</span>
            <WorkbenchSelect
              label="اولویت"
              value={priority}
              onValueChange={setPriority}
              options={[
                { value: 'normal', label: 'عادی' },
                { value: 'high', label: 'بالا' },
                { value: 'urgent', label: 'فوری' },
              ]}
            />
          </label>
          <label className="space-y-2 text-sm font-semibold">
            <span>مرجع پرونده مرتبط</span>
            <Input
              maxLength={200}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
          {error ? (
            <div className="sm:col-span-2">
              <Alert tone="error" title={error} />
            </div>
          ) : null}
          {success ? (
            <div className="sm:col-span-2">
              <Alert title={success} />
            </div>
          ) : null}
          <div className="flex gap-3 sm:col-span-2">
            <Button type="submit" disabled={pending || !branchId}>
              {pending ? 'در حال ثبت…' : 'ثبت درخواست'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              بستن فرم
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
