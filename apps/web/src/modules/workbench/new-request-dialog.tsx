'use client';
import { WorkbenchSelect } from './workbench-select';

import { useState } from 'react';
import {
  Building2,
  ClipboardList,
  FileText,
  Flag,
  Link2,
  Send,
} from 'lucide-react';
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
        className="max-h-[90dvh] max-w-3xl overflow-y-auto p-0"
      >
        <div className="border-b bg-gradient-to-l from-primary/15 via-primary/5 to-background px-6 py-6">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <ClipboardList className="size-5" aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <DialogTitle>درخواست جدید</DialogTitle>
              <DialogDescription>
                درخواست خود را برای واحد مقصد ثبت کنید؛ پیگیری آن از کارتابل
                درخواست‌های میزکار انجام می‌شود.
              </DialogDescription>
            </div>
          </div>
        </div>
        <form
          className="grid gap-5 bg-muted/20 p-6 sm:grid-cols-2"
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
            <span className="flex items-center gap-2">
              <FileText className="size-4 text-primary" aria-hidden="true" />
              عنوان درخواست *
            </span>
            <Input
              required
              maxLength={200}
              placeholder="مثلاً: بررسی وضعیت پرونده ویزا"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="space-y-2 text-sm font-semibold">
            <span className="flex items-center gap-2">
              <Building2 className="size-4 text-primary" aria-hidden="true" />
              واحد مقصد *
            </span>
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
            <span className="flex items-center gap-2">
              <ClipboardList
                className="size-4 text-primary"
                aria-hidden="true"
              />
              شرح درخواست *
            </span>
            <Textarea
              required
              rows={5}
              maxLength={10000}
              placeholder="جزئیات مورد نیاز، زمان‌بندی و اطلاعات لازم برای رسیدگی را بنویسید."
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <label className="space-y-2 text-sm font-semibold">
            <span className="flex items-center gap-2">
              <Flag className="size-4 text-primary" aria-hidden="true" />
              اولویت
            </span>
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
            <span className="flex items-center gap-2">
              <Link2 className="size-4 text-primary" aria-hidden="true" />
              مرجع پرونده مرتبط
            </span>
            <Input
              maxLength={200}
              placeholder="اختیاری؛ شماره پرونده یا قرارداد"
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5 sm:col-span-2">
            <p className="text-xs text-muted-foreground">
              پس از ثبت، کد پیگیری در همین میزکار نمایش داده می‌شود.
            </p>
            <div className="flex gap-3">
              <Button type="submit" disabled={pending || !branchId}>
                <Send className="size-4" aria-hidden="true" />
                {pending ? 'در حال ثبت…' : 'ثبت و پیگیری درخواست'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => onOpenChange(false)}
              >
                انصراف
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
