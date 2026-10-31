'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { Check, PhoneIncoming, Minus } from 'lucide-react';
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
import { callCenterApi } from './client';
import { LinkedRequestField } from './linked-request-field';
import {
  callDate,
  validPhone,
  sources,
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
  onMinimize,
  allowInternalNavigation = false,
}: {
  branchId: string;
  event: CallEvent;
  previous: Call | undefined;
  onSave: (call: Call) => Promise<void>;
  onClose: () => void;
  busy: boolean;
  onMinimize?: () => void;
  allowInternalNavigation?: boolean;
}) {
  const restoreFocus = useDialogReturnFocus();
  const completing = Boolean(event.completionToken);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [direction, setDirection] = useState(event.direction);
  const operatorLabel =
    direction === 'OUTBOUND' ? 'تماس‌گرفته‌شده از داخلی' : 'وصل شده به';
  const [requestState, setRequestState] = useState<{
    contact: string;
    rows: RequestCase[];
  } | null>(null);
  const requests =
    requestState?.contact === `${branchId}:${previous?.contactId}`
      ? requestState.rows
      : [];
  const [destinationState, setDestinationState] = useState<{
    branch: string;
    labels: string[];
    error: string;
  } | null>(null);
  const destinationsLoading = destinationState?.branch !== branchId;
  const destinations = destinationsLoading ? [] : destinationState.labels;
  const destinationError = destinationsLoading ? '' : destinationState.error;
  const [destinationRetry, setDestinationRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    callCenterApi
      .destinations(branchId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted)
          setDestinationState({
            branch: branchId,
            labels: result.data.map((row) => row.label),
            error: '',
          });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setDestinationState({
            branch: branchId,
            labels: [],
            error: 'دریافت فهرست کارکنان انجام نشد.',
          });
      });
    return () => controller.abort();
  }, [branchId, destinationRetry]);
  useEffect(() => {
    const controller = new AbortController();
    if (previous?.contactId)
      workflowApi
        .list(
          branchId,
          previous.contactId,
          controller.signal,
          1,
          1,
          undefined,
          true,
        )
        .then(async (result) => {
          const rows = [...result.data];
          for (
            let page = 2;
            rows.length < (result.meta?.total ?? rows.length);
            page++
          ) {
            if (controller.signal.aborted) return;
            if (page > 100) throw Error('REQUEST_OPTIONS_LIMIT');
            const next = await workflowApi.list(
              branchId,
              previous.contactId!,
              controller.signal,
              page,
              1,
              undefined,
              true,
            );
            if (!next.data.length) break;
            rows.push(...next.data);
          }
          if (!controller.signal.aborted)
            setRequestState({
              contact: `${branchId}:${previous?.contactId}`,
              rows: [...new Map(rows.map((row) => [row.id, row])).values()],
            });
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setError('دریافت درخواست‌های مخاطب انجام نشد.');
        });
    return () => controller.abort();
  }, [branchId, previous?.contactId]);
  useUnsavedGuard(dirty, allowInternalNavigation);
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
    if (!Object.hasOwn(outcomeLabels, value('outcome'))) {
      setError('نتیجه تماس را انتخاب کنید.');
      return;
    }
    setError('');
    try {
      const { ticketId: priorTicket, ...eventData } = event as Call;
      void priorTicket;
      await onSave({
        ...eventData,
        phone: value('phone'),
        direction: completing
          ? event.direction
          : (value('direction') as Call['direction']),
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
        className={styles.callDialog}
      >
        {onMinimize && (
          <button
            type="button"
            disabled={busy}
            onClick={onMinimize}
            aria-label="کوچک‌کردن فرم تماس"
            title="کوچک‌کردن فرم تماس"
            className="absolute end-14 top-4 rounded-lg p-2 text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Minus size={16} aria-hidden="true" />
          </button>
        )}
        <DialogTitle className="flex items-center gap-2 pe-20">
          <PhoneIncoming className="text-blue-500" />
          {completing
            ? 'ویرایش اطلاعات تماس'
            : event.direction === 'INBOUND'
              ? 'ثبت تماس جدید'
              : 'ثبت تماس پیگیری'}
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
            <section className={styles.formSection}>
              <h3>اطلاعات مخاطب</h3>
              <div className={styles.formGrid}>
                <label>
                  شماره تماس (اختیاری)
                  <input
                    name="phone"
                    dir="ltr"
                    type="tel"
                    placeholder="شماره مخفی یا نامعلوم: خالی بگذارید"
                    defaultValue={event.phone}
                    readOnly={Boolean(event.phone) || completing}
                    maxLength={24}
                    autoComplete="off"
                  />
                </label>
                <label>
                  نام مخاطب (اختیاری)
                  <input
                    name="name"
                    placeholder="اختیاری؛ مخاطب ناشناس"
                    defaultValue={previous?.name}
                    maxLength={100}
                  />
                </label>
              </div>
              <p className={styles.formHint}>
                برای تماس با شماره مخفی یا نامعلوم، شماره را خالی بگذارید.
              </p>
            </section>
            <section className={styles.formSection}>
              <h3>مشخصات تماس</h3>
              <div className={styles.formGrid}>
                <label>
                  نوع تماس
                  {completing ? (
                    <>
                      <input
                        aria-label="نوع تماس"
                        readOnly
                        value={
                          event.direction === 'INBOUND'
                            ? 'ورودی ـ تماس به شرکت'
                            : 'خروجی ـ تماس از شرکت'
                        }
                      />
                      <input
                        type="hidden"
                        name="direction"
                        value={event.direction}
                      />
                    </>
                  ) : (
                    <NativeSearchSelect
                      onChange={(e) => {
                        setDirty(true);
                        setDirection(e.target.value as CallEvent['direction']);
                      }}
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
                  )}
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
                    defaultValue={completing ? previous?.source : 'نامشخص'}
                  >
                    {sources.map((source) => (
                      <option key={source} value={source}>
                        {source}
                      </option>
                    ))}
                  </NativeSearchSelect>
                </label>
                <label>
                  {operatorLabel}
                  {completing && previous?.answerRecipient ? (
                    <>
                      <input
                        aria-label={operatorLabel}
                        readOnly
                        value={previous.answerRecipient.label}
                      />
                      <input
                        type="hidden"
                        name="operator"
                        value={previous.operator}
                      />
                    </>
                  ) : (
                    <>
                      <NativeSearchSelect
                        onChange={() => setDirty(true)}
                        aria-label={operatorLabel}
                        className={styles.control}
                        optionLimit={50}
                        disabled={busy}
                        aria-busy={destinationsLoading}
                        name="operator"
                        defaultValue={
                          completing ? previous?.operator : 'نامشخص'
                        }
                      >
                        {[
                          ...new Set([
                            'نامشخص',
                            ...(completing && previous?.operator
                              ? [previous.operator]
                              : []),
                            ...destinations,
                          ]),
                        ].map((operator) => (
                          <option key={operator} value={operator}>
                            {operator}
                          </option>
                        ))}
                      </NativeSearchSelect>
                      {destinationError && (
                        <span role="status">
                          {destinationError}{' '}
                          <button
                            type="button"
                            onClick={() => {
                              setDestinationState(null);
                              setDestinationRetry((value) => value + 1);
                            }}
                          >
                            تلاش مجدد
                          </button>
                        </span>
                      )}
                    </>
                  )}
                </label>
                <label>
                  نتیجه تماس *
                  <NativeSearchSelect
                    onChange={() => setDirty(true)}
                    name="outcome"
                    aria-label="نتیجه تماس"
                    required
                    className={styles.control}
                    disabled={busy}
                    defaultValue={completing ? (previous?.outcome ?? '') : ''}
                  >
                    <option value="">نتیجه تماس را انتخاب کنید</option>
                    {Object.entries(outcomeLabels).map(([key, title]) => (
                      <option key={key} value={key}>
                        {title}
                      </option>
                    ))}
                  </NativeSearchSelect>
                </label>
                <LinkedRequestField
                  requests={requests}
                  busy={busy}
                  selected={completing ? (previous?.ticketId ?? '') : ''}
                  onChange={() => setDirty(true)}
                />
              </div>
              <label>
                موضوع تماس *
                <input
                  name="subject"
                  defaultValue={completing ? previous?.subject : ''}
                  required
                  placeholder="موضوع همین تماس"
                  maxLength={200}
                />
              </label>
              <label>
                شرح تماس
                <textarea
                  name="note"
                  defaultValue={completing ? previous?.note : ''}
                  maxLength={2000}
                  placeholder="نیاز مسافر، نتیجه گفت‌وگو و اقدام بعدی..."
                />
              </label>
            </section>
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
                <Check size={16} /> {completing ? 'ذخیره تغییرات' : 'ثبت تماس'}
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
