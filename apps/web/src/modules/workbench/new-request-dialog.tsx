'use client';
import { WorkbenchSelect } from './workbench-select';

import { useEffect, useRef, useState } from 'react';
import type { WorkbenchRequestOptionsV1 } from '@nora/contracts';
import { ClipboardList, FileText, Flag, Link2, Send } from 'lucide-react';
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
import { RequestRecipientFields } from './request-recipient-fields';
import { customerAffairsApi } from '@/modules/customer-affairs/api/customer-affairs-client';

type NewRequestDialogProps = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  branchId?: string;
  onCreated?: () => void;
};

export function NewRequestDialog(props: NewRequestDialogProps) {
  return props.open ? <NewRequestForm {...props} /> : null;
}

function NewRequestForm({
  open,
  onOpenChange,
  branchId,
  onCreated,
}: NewRequestDialogProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [unit, setUnit] = useState('');
  const [recipient, setRecipient] = useState('');
  const [optionsVersion, setOptionsVersion] = useState(0);
  const [options, setOptions] = useState<{
    branchId: string;
    version: number;
    units: WorkbenchRequestOptionsV1['units'];
    error: string;
  } | null>(null);
  const optionsMatch =
    options?.branchId === branchId && options?.version === optionsVersion;
  const units = optionsMatch ? options!.units : [];
  const optionsLoading = Boolean(open && branchId && !optionsMatch);
  const optionsError = optionsMatch ? options!.error : '';
  const [priority, setPriority] = useState('normal');
  const [reference, setReference] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const submitting = useRef(false);
  const key = useRef<string | null>(null);
  useEffect(() => {
    key.current = null;
  }, [title, body, unit, recipient, priority, reference]);
  useEffect(() => {
    if (!open || !branchId) return;
    let active = true;
    void customerAffairsApi
      .workbenchRequestOptions(branchId)
      .then(({ data }) => {
        if (active) {
          setOptions({
            branchId,
            version: optionsVersion,
            units: data.units,
            error: '',
          });
          setUnit('');
          setRecipient('');
        }
      })
      .catch((reason) => {
        if (active)
          setOptions({
            branchId,
            version: optionsVersion,
            units: [],
            error:
              reason instanceof Error
                ? reason.message
                : 'فهرست واحدها و کاربران دریافت نشد.',
          });
      });
    return () => {
      active = false;
    };
  }, [open, branchId, optionsVersion]);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => !submitting.current && onOpenChange(value)}
    >
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
                واحد و کاربر گیرنده را انتخاب کنید؛ درخواست در کارتابل میزکار
                همان کاربر دریافت می‌شود.
              </DialogDescription>
            </div>
          </div>
        </div>
        <form
          className="grid gap-5 bg-muted/20 p-6 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!branchId || submitting.current) return;
            const member = units
              .find((item) => item.id === unit)
              ?.users.find((item) => item.id === recipient);
            if (!member) {
              setError('واحد مقصد و کاربر گیرنده را انتخاب کنید.');
              return;
            }
            if (
              `${body.trim()}${reference.trim() ? `\n\nمرجع پرونده: ${reference.trim()}` : ''}`
                .length > 2000
            ) {
              setError('شرح درخواست همراه مرجع پرونده حداکثر ۲۰۰۰ نویسه است.');
              return;
            }
            submitting.current = true;
            setPending(true);
            setError('');
            setSuccess('');
            key.current ??= crypto.randomUUID();
            void customerAffairsApi
              .createWorkbenchRequest(
                {
                  subject: title.trim(),
                  description: body.trim(),
                  reference: reference.trim(),
                  organizationUnitId: unit,
                  executionOwnerUserId: recipient,
                  priority: priority.toUpperCase() as
                    'NORMAL' | 'HIGH' | 'URGENT',
                },
                branchId,
                key.current,
              )
              .then((response) => {
                setTitle('');
                setBody('');
                setReference('');
                key.current = null;
                setSuccess(
                  `درخواست برای ${member.displayName} ارسال شد. کد پیگیری: ${response.data.trackingNumber}`,
                );
                onCreated?.();
              })
              .catch((reason) =>
                setError(
                  reason instanceof Error
                    ? reason.message
                    : 'ثبت درخواست انجام نشد.',
                ),
              )
              .finally(() => {
                submitting.current = false;
                setPending(false);
              });
          }}
        >
          <label className="space-y-2 text-sm font-semibold">
            <span className="flex items-center gap-2">
              <FileText className="size-4 text-primary" aria-hidden="true" />
              عنوان درخواست *
            </span>
            <Input
              required
              minLength={3}
              disabled={pending}
              maxLength={200}
              placeholder="مثلاً: بررسی وضعیت پرونده ویزا"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <div className="sm:col-span-2 grid gap-5 sm:grid-cols-2">
            <RequestRecipientFields
              units={units}
              unitId={unit}
              recipientId={recipient}
              disabled={pending || optionsLoading}
              onUnitChange={setUnit}
              onRecipientChange={setRecipient}
            />
            {optionsLoading ? (
              <p role="status" className="text-sm text-muted-foreground">
                در حال دریافت واحدها و کاربران…
              </p>
            ) : null}
            {optionsError ? (
              <div className="sm:col-span-2">
                <Alert tone="error" title={optionsError} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOptionsVersion((value) => value + 1)}
                >
                  دریافت دوباره فهرست
                </Button>
              </div>
            ) : null}
            {!optionsLoading && !optionsError && !units.length ? (
              <p className="sm:col-span-2 text-sm text-muted-foreground">
                واحد سازمانی فعالی در این شعبه ثبت نشده است.
              </p>
            ) : null}
          </div>
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
              minLength={3}
              disabled={pending}
              rows={5}
              maxLength={2000}
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
              disabled={pending}
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
              disabled={pending}
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
              <Button
                type="submit"
                disabled={
                  pending || optionsLoading || !branchId || !recipient || !unit
                }
              >
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
