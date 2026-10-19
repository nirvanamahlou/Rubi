'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { Check, PhoneIncoming } from 'lucide-react';
import { useDialogReturnFocus } from './use-dialog-focus';
import { useUnsavedGuard } from './use-unsaved-guard';
import { workflowApi, type RequestCase } from './workflow-client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import {
  callDate,
  validPhone,
  sources,
  operators,
  type Call,
  type CallEvent,
} from './model';
import styles from './workspace.module.css';
const outcomeLabels: Record<string, string> = {
  ANSWERED: 'گفت‌وگو انجام شد',
  NO_ANSWER: 'بدون پاسخ',
  BUSY: 'اشغال',
  FAILED: 'ناموفق',
};
export function CallForm({
  branchId,
  event,
  previous,
  onSave,
  onClose,
  busy,
}: {
  branchId: string;
  event: CallEvent;
  previous: Call | undefined;
  onSave: (call: Call) => Promise<void>;
  onClose: () => void;
  busy: boolean;
}) {
  const restoreFocus = useDialogReturnFocus();
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [requests, setRequests] = useState<RequestCase[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    if (previous?.contactId)
      workflowApi
        .list(branchId, previous.contactId, controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setRequests(result.data);
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setError('دریافت درخواست‌های مخاطب انجام نشد.');
        });
    return () => controller.abort();
  }, [branchId, previous?.contactId]);
  useUnsavedGuard(dirty);
  function close() {
    if (
      !busy &&
      (!dirty || window.confirm('اطلاعات تماس ذخیره نشده کنار گذاشته شوند؟'))
    )
      onClose();
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const data = new FormData(e.currentTarget);
    const value = (key: string) => String(data.get(key) ?? '').trim();
    if (value('phone') && !validPhone(value('phone'))) {
      setError('شماره تماس معتبر وارد کنید؛ مانند ۰۹۱۲۰۰۰۰۰۰۱.');
      return;
    }
    if (!value('subject')) {
      setError('موضوع تماس را وارد کنید.');
      return;
    }
    if (!value('outcome')) {
      setError('نتیجه تماس را انتخاب کنید.');
      return;
    }
    setError('');
    try {
      await onSave({
        ...event,
        phone: value('phone'),
        direction: value('direction') as Call['direction'],
        name: value('name'),
        subject: value('subject'),
        source: value('source'),
        operator: value('operator'),
        status: 'جدید',
        outcome: value('outcome'),
        ...(value('ticketId') ? { ticketId: value('ticketId') } : {}),
        note: value('note'),
      });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'ثبت تماس انجام نشد. اطلاعات فرم حفظ شده است.',
      );
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        onCloseAutoFocus={restoreFocus}
        dir="rtl"
        className="max-h-[90dvh] max-w-2xl overflow-y-auto"
      >
        <DialogTitle className="flex items-center gap-2 pe-9">
          <PhoneIncoming className="text-blue-500" />
          {event.direction === 'INBOUND' ? 'ثبت تماس ورودی' : 'ثبت تماس پیگیری'}
        </DialogTitle>
        <DialogDescription>
          {callDate(event.occurredAt)} ·{' '}
          {previous
            ? `تماس با ${previous.name} ـ سابقه تماس موجود است.`
            : 'اطلاعات مسافر و موضوع گفت‌وگو را تکمیل کنید.'}
        </DialogDescription>
        <form
          className={styles.form}
          onSubmit={submit}
          onChange={() => setDirty(true)}
        >
          <fieldset disabled={busy} className={styles.formFields}>
            <div className={styles.formGrid}>
              <label>
                شماره تماس
                <input
                  name="phone"
                  dir="ltr"
                  type="tel"
                  placeholder="شماره مخفی یا نامعلوم: خالی بگذارید"
                  defaultValue={event.phone}
                  readOnly={Boolean(event.phone)}
                  maxLength={24}
                  autoComplete="off"
                />
              </label>
              <label>
                نام مسافر
                <input
                  name="name"
                  placeholder="اختیاری؛ مخاطب ناشناس"
                  defaultValue={previous?.name}
                  maxLength={100}
                />
              </label>
              <label>
                نوع تماس
                <NativeSearchSelect
                  onChange={() => setDirty(true)}
                  aria-label="نوع تماس"
                  className={styles.control}
                  optionLimit={50}
                  disabled={busy}
                  name="direction"
                  defaultValue={event.direction}
                >
                  <option value="INBOUND">ورودی ـ تماس به شرکت</option>
                  <option value="OUTBOUND">خروجی ـ تماس از شرکت</option>
                </NativeSearchSelect>
              </label>
              <label>
                منبع آشنایی
                <NativeSearchSelect
                  onChange={() => setDirty(true)}
                  aria-label="منبع آشنایی"
                  className={styles.control}
                  optionLimit={50}
                  disabled={busy}
                  name="source"
                  defaultValue="نامشخص"
                >
                  {sources.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </NativeSearchSelect>
              </label>
              <label>
                وصل شده به
                <NativeSearchSelect
                  onChange={() => setDirty(true)}
                  aria-label="وصل شده به"
                  className={styles.control}
                  optionLimit={50}
                  disabled={busy}
                  name="operator"
                  defaultValue="نامشخص"
                >
                  {operators.map((operator) => (
                    <option key={operator} value={operator}>
                      {operator}
                    </option>
                  ))}
                </NativeSearchSelect>
              </label>
              <label>
                نتیجه تماس
                <NativeSearchSelect
                  onChange={() => setDirty(true)}
                  name="outcome"
                  aria-label="نتیجه تماس"
                  className={styles.control}
                  disabled={busy}
                  defaultValue=""
                >
                  <option value="">نتیجه تماس را انتخاب کنید</option>
                  {Object.entries(outcomeLabels).map(([key, title]) => (
                    <option key={key} value={key}>
                      {title}
                    </option>
                  ))}
                </NativeSearchSelect>
              </label>
              <label>
                درخواست مرتبط
                <NativeSearchSelect
                  onChange={() => setDirty(true)}
                  name="ticketId"
                  aria-label="درخواست مرتبط"
                  className={styles.control}
                  disabled={busy}
                  defaultValue=""
                >
                  <option value="">بدون اتصال؛ پس از ثبت تعیین می‌کنم</option>
                  {requests
                    .filter((request) => request.status !== 'CLOSED')
                    .map((request) => (
                      <option key={request.id} value={request.id}>
                        {request.title}
                      </option>
                    ))}
                </NativeSearchSelect>
              </label>
            </div>
            <label>
              موضوع تماس
              <input
                name="subject"
                required
                placeholder="موضوع همین تماس"
                maxLength={200}
              />
            </label>
            <label>
              شرح تماس
              <textarea
                name="note"
                maxLength={2000}
                placeholder="نیاز مسافر، نتیجه گفت‌وگو و اقدام بعدی..."
              />
            </label>
            <p className={styles.formHint}>
              پس از تأیید سرور، تماس در سابقه مسافر ذخیره می‌شود.
            </p>
            {error && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
            <footer>
              <button className={styles.primary}>
                <Check size={16} /> ثبت تماس
              </button>
              <button
                type="button"
                className={styles.secondary}
                onClick={close}
              >
                انصراف
              </button>
            </footer>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
