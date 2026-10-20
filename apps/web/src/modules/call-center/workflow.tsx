'use client';
import { RequestReferral } from './request-referral';
import { RequestCustomer } from './request-customer';
import { useDialogReturnFocus } from './use-dialog-focus';
import { useUnsavedGuard } from './use-unsaved-guard';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import { callDate, faNumber } from './model';
import type { Call } from './model';
import {
  workflowApi,
  type Operator,
  type RequestCase,
  type FollowUp,
} from './workflow-client';
import styles from './workflow.module.css';

export const requestLabels: Record<string, string> = {
  NEW: 'باز',
  IN_PROGRESS: 'منتظر اقدام کارشناس',
  WAITING_CUSTOMER: 'منتظر پاسخ مشتری',
  CLOSED: 'بسته‌شده',
};
export const taskLabels: Record<string, string> = {
  OPEN: 'باز',
  COMPLETED: 'انجام‌شده',
  CANCELLED: 'لغوشده',
};
const priorities = { NORMAL: 'عادی', HIGH: 'بالا', URGENT: 'فوری' };
function OwnerSelect({
  operators,
  value,
  disabled,
  onChange,
}: {
  operators: Operator[];
  value: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
}) {
  return (
    <NativeSearchSelect
      aria-label="کارشناس مسئول"
      name="ownerId"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange?.(event.target.value)}
      optionLimit={100}
    >
      <option value="">بدون مسئول</option>
      {value && !operators.some((user) => user.id === value) && (
        <option value={value}>مسئول قبلی؛ برای ارجاع جدید انتخاب کنید</option>
      )}
      {operators.map((user) => (
        <option key={user.id} value={user.id}>
          {user.displayName}
        </option>
      ))}
    </NativeSearchSelect>
  );
}
export function WorkflowPanel({
  branchId,
  contactId,
  canManage,
  actorId,
  onChanged,
  calls = [],
  onLinked,
}: {
  branchId: string;
  contactId: string;
  canManage: boolean;
  actorId: string;
  onChanged?: () => void;
  calls?: Call[];
  onLinked?: (id: string, ticketId: string) => void;
}) {
  const [requestPage, setRequestPage] = useState(1),
    [taskPage, setTaskPage] = useState(1);
  const [pageMeta, setPageMeta] = useState({ total: 0, hasMoreTasks: false });
  const [requests, setRequests] = useState<RequestCase[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState<
    | { kind: 'request'; item?: RequestCase }
    | { kind: 'task'; request: RequestCase; item?: FollowUp }
    | null
  >(null);
  const [view, setView] = useState('ALL');
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      workflowApi.list(
        branchId,
        contactId,
        controller.signal,
        requestPage,
        taskPage,
      ),
      workflowApi.operators(branchId),
    ])
      .then(([result, options]) => {
        if (!controller.signal.aborted) {
          setRequests(result.data);
          setPageMeta(
            result.meta ?? { total: result.data.length, hasMoreTasks: false },
          );
          setOperators(options.data);
          setLoading(false);
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'دریافت درخواست‌ها انجام نشد.',
          );
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [branchId, contactId, revision, requestPage, taskPage]);
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
  }).format(new Date());
  const visible = requests.filter(
    (request) =>
      view === 'ALL' ||
      (view === 'UNASSIGNED'
        ? !request.ownerId && request.status !== 'CLOSED'
        : request.followUps.some(
            (task) =>
              task.status === 'OPEN' &&
              (view === 'MINE'
                ? task.ownerId === actorId
                : view === 'OVERDUE'
                  ? Date.parse(task.dueAt) < Date.now()
                  : new Intl.DateTimeFormat('en-CA', {
                      timeZone: 'Asia/Tehran',
                    }).format(new Date(task.dueAt)) === today),
          )),
  );
  return (
    <section
      className={styles.panel}
      aria-label="درخواست‌ها و اقدام‌های پیگیری"
    >
      <header>
        <h3>درخواست‌ها و اقدام‌های پیگیری</h3>
        <button
          type="button"
          disabled={!canManage}
          onClick={() => setEditor({ kind: 'request' })}
        >
          درخواست جدید
        </button>
      </header>
      <p>تماس‌های یک شماره می‌توانند مربوط به درخواست‌های متفاوت باشند.</p>
      <nav aria-label="صفحه‌بندی درخواست و اقدام">
        <button
          disabled={loading || requestPage === 1}
          onClick={() => {
            setLoading(true);
            setRequestPage((v) => v - 1);
            setTaskPage(1);
          }}
        >
          درخواست‌های قبلی
        </button>
        <span>
          {requestPage} / {Math.max(1, Math.ceil(pageMeta.total / 10))}
        </span>
        <button
          disabled={loading || requestPage * 10 >= pageMeta.total}
          onClick={() => {
            setLoading(true);
            setRequestPage((v) => v + 1);
            setTaskPage(1);
          }}
        >
          درخواست‌های بعدی
        </button>
        <button
          disabled={loading || taskPage === 1}
          onClick={() => {
            setLoading(true);
            setTaskPage((v) => v - 1);
          }}
        >
          اقدام‌های جدیدتر
        </button>
        <button
          disabled={loading || !pageMeta.hasMoreTasks}
          onClick={() => {
            setLoading(true);
            setTaskPage((v) => v + 1);
          }}
        >
          اقدام‌های قدیمی‌تر
        </button>
      </nav>
      <NativeSearchSelect
        aria-label="نمای پیگیری‌های این مخاطب"
        value={view}
        onChange={(event) => setView(event.target.value)}
      >
        <option value="ALL">همه درخواست‌های این مخاطب</option>
        <option value="MINE">کارهای من</option>
        <option value="TODAY">امروز</option>
        <option value="OVERDUE">عقب‌افتاده</option>
        <option value="UNASSIGNED">بدون مسئول</option>
      </NativeSearchSelect>
      {loading && <p role="status">در حال دریافت درخواست‌ها…</p>}
      {error && (
        <p role="alert">
          {error}{' '}
          <button
            type="button"
            onClick={() => (
              setLoading(true),
              setError(''),
              setRevision((value) => value + 1)
            )}
          >
            تلاش مجدد
          </button>
        </p>
      )}
      {!loading && !error && !visible.length && (
        <p>درخواستی در این نما وجود ندارد.</p>
      )}
      {!loading && !error && requests.length > 0 && calls.length > 0 && (
        <details>
          <summary>اتصال تماس‌ها به درخواست</summary>
          {calls.map((call) => (
            <CallRequestLink
              key={call.id + (call.ticketId ?? '')}
              call={call}
              requests={requests}
              branchId={branchId}
              disabled={!canManage}
              onLinked={(id, ticket) => onLinked?.(id, ticket)}
            />
          ))}
        </details>
      )}
      {!loading &&
        !error &&
        visible.map((request) => (
          <article key={request.id} className={styles.card}>
            <strong>{request.title}</strong>
            <RequestReferral
              branch={branchId}
              request={request}
              operators={operators}
              disabled={!canManage}
              onChanged={() => onChanged?.()}
            />
            <RequestCustomer
              key={request.id + ':' + request.version}
              branch={branchId}
              contact={contactId}
              request={request}
              onChanged={() => {
                setLoading(true);
                setRevision((v) => v + 1);
              }}
            />
            <p>
              {requestLabels[request.status]} ·{' '}
              {request.ownerName ?? 'بدون مسئول'} ·{' '}
              {priorities[request.priority as keyof typeof priorities]}
            </p>
            {request.reason && <p>{request.reason}</p>}
            <button
              type="button"
              disabled={!canManage}
              onClick={() => setEditor({ kind: 'request', item: request })}
            >
              ویرایش و ارجاع درخواست
            </button>
            <button
              type="button"
              disabled={!canManage || request.status === 'CLOSED'}
              onClick={() => setEditor({ kind: 'task', request })}
            >
              اقدام بعدی
            </button>
            {request.followUps.map((task) => (
              <div
                key={task.id}
                className={styles.task}
                data-overdue={
                  task.status === 'OPEN' && Date.parse(task.dueAt) < Date.now()
                }
              >
                <strong>{task.action}</strong>
                <p>
                  {taskLabels[task.status]} ·{' '}
                  {task.ownerName ??
                    operators.find((user) => user.id === task.ownerId)
                      ?.displayName ??
                    'مسئول قبلی'}{' '}
                  · {priorities[task.priority as keyof typeof priorities]}
                </p>
                <time dateTime={task.dueAt}>{callDate(task.dueAt)}</time>
                {task.status === 'OPEN' &&
                  Date.parse(task.dueAt) < Date.now() && (
                    <span> · موعد گذشته</span>
                  )}
                {task.result && <p>{task.result}</p>}
                <button
                  type="button"
                  disabled={
                    !canManage ||
                    task.status !== 'OPEN' ||
                    request.status === 'CLOSED'
                  }
                  onClick={() =>
                    setEditor({ kind: 'task', request, item: task })
                  }
                >
                  ویرایش / ثبت نتیجه
                </button>
                <details>
                  <summary>تاریخچه اقدام</summary>
                  {task.history.map((entry) => (
                    <p key={entry.version}>
                      {callDate(entry.at)} · {taskLabels[entry.status]} · موعد{' '}
                      {callDate(entry.dueAt)} ·{' '}
                      {operators.find((user) => user.id === entry.ownerId)
                        ?.displayName ?? entry.ownerId}
                    </p>
                  ))}
                </details>
              </div>
            ))}
            <details>
              <summary>تاریخچه درخواست</summary>
              {request.privateHistory?.map((entry) => (
                <p key={entry.version}>
                  {callDate(entry.at)} · {entry.title} ·{' '}
                  {requestLabels[entry.status]} · {entry.reason}
                </p>
              ))}
              {request.history.map((entry) => (
                <p key={entry.id}>
                  {callDate(entry.at)} · نسخه {entry.version} ·{' '}
                  {entry.action === 'REQUEST_CREATED'
                    ? 'ایجاد درخواست'
                    : entry.action === 'REQUEST_UPDATED'
                      ? 'تغییر درخواست'
                      : entry.action === 'CUSTOMER_LINKED'
                        ? 'اصلاح ارتباط مشتری'
                        : entry.action === 'REFERRED'
                          ? 'ارجاع درخواست'
                          : 'ثبت اقدام پیگیری'}{' '}
                  ·{' '}
                  {operators.find((user) => user.id === entry.actorId)
                    ?.displayName ?? entry.actorId}
                </p>
              ))}
            </details>
          </article>
        ))}
      {editor && (
        <WorkflowEditor
          key={editor.kind + (editor.item?.id ?? 'new')}
          editor={editor}
          operators={operators}
          branchId={branchId}
          contactId={contactId}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setLoading(true);
            setRevision((value) => value + 1);
            setEditor(null);
            onChanged?.();
          }}
        />
      )}
    </section>
  );
}
function CallRequestLink({
  call,
  requests,
  branchId,
  disabled,
  onLinked,
}: {
  call: Call;
  requests: RequestCase[];
  branchId: string;
  disabled: boolean;
  onLinked?: (id: string, ticket: string) => void;
}) {
  const [ticket, setTicket] = useState(call.ticketId ?? ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const retry = useRef<{ ticket: string; commandId: string } | null>(null);
  return (
    <div className={styles.task}>
      <p>
        {callDate(call.occurredAt)} · {call.subject}
      </p>
      <NativeSearchSelect
        aria-label="درخواست این تماس"
        value={ticket}
        disabled={disabled || busy}
        onChange={(event) => setTicket(event.target.value)}
      >
        <option value="">درخواست را انتخاب کنید</option>
        {requests.map((request) => (
          <option
            key={request.id}
            value={request.id}
            disabled={request.status === 'CLOSED'}
          >
            {request.title}
          </option>
        ))}
      </NativeSearchSelect>
      <button
        type="button"
        disabled={disabled || busy || !ticket || ticket === call.ticketId}
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          setError('');
          if (!retry.current || retry.current.ticket !== ticket)
            retry.current = { ticket, commandId: crypto.randomUUID() };
          try {
            const result = await workflowApi.link(branchId, call.id, {
              commandId: retry.current.commandId,
              ticketId: ticket,
              expectedTicketId: call.ticketId ?? null,
            });
            onLinked?.(result.data.id, result.data.ticketId);
          } catch (reason) {
            setError(
              reason instanceof Error ? reason.message : 'اتصال انجام نشد.',
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        ذخیره ارتباط
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

export function WorkQueue({
  branchId,
  actorId,
  canManage,
  incomplete,
  onIncomplete,
}: {
  branchId: string;
  actorId: string;
  canManage: boolean;
  incomplete?: number | undefined;
  onIncomplete?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const queueHeading = useRef<HTMLHeadingElement>(null);
  const queueTrigger = useRef<HTMLButtonElement | null>(null);
  const [view, setView] = useState('ALL'),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0);
  const [data, setData] = useState<Awaited<
    ReturnType<typeof workflowApi.queue>
  > | null>(null);
  const [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [selected, setSelected] = useState<{
      contactId: string;
      branchId: string;
    } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    workflowApi
      .queue(branchId, view, page, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setError('');
          setLoading(false);
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setData(null);
          setError(
            reason instanceof Error ? reason.message : 'دریافت صف انجام نشد.',
          );
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [branchId, view, page, revision]);
  return (
    <>
      <div className={styles.actionCards} aria-label="اقدام‌های فوری">
        {(
          [
            ['OVERDUE', 'درخواست با پیگیری عقب‌افتاده'],
            ['TODAY', 'درخواست با پیگیری امروز'],
            ['UNASSIGNED', 'درخواست بدون مسئول'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            data-tone={value}
            disabled={
              loading || !!error || data?.meta.counts?.[value] === undefined
            }
            onClick={() => {
              setView(value);
              setPage(1);
              setRevision((current) => current + 1);
              setCollapsed(false);
              setLoading(true);
              queueHeading.current?.focus();
            }}
          >
            <span>{label}</span>
            <strong>
              {loading
                ? '…'
                : data?.meta.counts?.[value] === undefined
                  ? '—'
                  : faNumber(data.meta.counts[value])}
            </strong>
            <small>همه شعب مجاز · درخواست یکتا</small>
          </button>
        ))}
        <button
          type="button"
          disabled={incomplete === undefined}
          onClick={onIncomplete}
        >
          <span>اطلاعات ناقص تماس</span>
          <strong>
            {incomplete === undefined ? '—' : faNumber(incomplete)}
          </strong>
          <small>شعبه، بازه و فیلتر فعلی گزارش</small>
        </button>
      </div>
      <section className={`${styles.panel} ${styles.queue}`}>
        <header>
          <h3 tabIndex={-1} ref={queueHeading}>
            صف رسیدگی و پیگیری
          </h3>
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-controls="cc-queue-body"
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? 'نمایش صف' : 'جمع کردن صف'}
          </button>
          <button
            type="button"
            onClick={() => (
              setLoading(true),
              setError(''),
              setRevision((value) => value + 1)
            )}
          >
            به‌روزرسانی
          </button>
        </header>
        <p>
          همه شعب مجاز · مستقل از فیلتر مخاطبان
          {data?.meta.asOf ? ` · به‌روز در ${callDate(data.meta.asOf)}` : ''}
        </p>
        <div id="cc-queue-body" hidden={collapsed}>
          <div
            className={styles.queueViews}
            role="group"
            aria-label="نمای صف رسیدگی"
          >
            {(
              [
                ['ALL', 'همه درخواست‌ها'],
                ['OPEN', 'باز'],
                ['MINE', 'کارهای من'],
                ['TODAY', 'امروز'],
                ['OVERDUE', 'عقب‌افتاده'],
                ['UNASSIGNED', 'بدون مسئول'],
                ['NO_ACTION', 'بدون اقدام بعدی'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => {
                  setLoading(true);
                  setError('');
                  setView(value);
                  setPage(1);
                  setRevision((current) => current + 1);
                }}
              >
                {label}
                {data?.meta.counts?.[value] !== undefined && !loading && !error
                  ? ` · ${faNumber(data.meta.counts[value])}`
                  : ''}
              </button>
            ))}
          </div>
          {loading && <p role="status">در حال دریافت صف…</p>}
          {error && <p role="alert">{error}</p>}
          {!loading && !error && data && (
            <>
              <p>
                {data.meta.total.toLocaleString('fa-IR')} درخواست · تاریخ امروز
                بر اساس تهران
              </p>
              <p className={styles.hint}>
                امروز و عقب‌افتاده ممکن است هم‌پوشان باشند. «بدون اقدام بعدی»:
                درخواست بازِ بدون پیگیری باز؛ منتظر پاسخ مشتری مستثناست.
              </p>
              {!data.data.length && <p>درخواستی در این صف نیست.</p>}
              <div className={styles.queueRows}>
                <div className={styles.queueColumns} aria-hidden="true">
                  <span>موضوع درخواست</span>
                  <span>شعبه</span>
                  <span>مسئول</span>
                  <span>وضعیت</span>
                  <span>موعد نزدیک‌ترین پیگیری</span>
                </div>
                {data.data.map((item) => (
                  <button
                    className={styles.queueRow}
                    key={item.id}
                    type="button"
                    onClick={(event) => {
                      queueTrigger.current = event.currentTarget;
                      setSelected({
                        contactId: item.contactId,
                        branchId: item.branchId,
                      });
                    }}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.branchName}</span>
                    <span>{item.ownerName ?? 'بدون مسئول'}</span>
                    <span className={styles.status} data-status={item.status}>
                      {requestLabels[item.status]}
                    </span>
                    <span
                      data-overdue={
                        !!item.dueAt &&
                        Date.parse(item.dueAt) <
                          Date.parse(data?.meta.asOf ?? '')
                      }
                    >
                      {item.dueAt ? (
                        <>
                          <time dateTime={item.dueAt}>
                            {callDate(item.dueAt)}
                          </time>
                          {Date.parse(item.dueAt) <
                            Date.parse(data?.meta.asOf ?? '') && (
                            <small>
                              {' '}
                              ·{' '}
                              {faNumber(
                                Math.max(
                                  1,
                                  Math.floor(
                                    (Date.parse(data?.meta.asOf ?? '') -
                                      Date.parse(item.dueAt)) /
                                      60000,
                                  ),
                                ),
                              )}{' '}
                              دقیقه تأخیر
                            </small>
                          )}
                        </>
                      ) : (
                        'بدون پیگیری باز'
                      )}
                    </span>
                  </button>
                ))}
              </div>
              <div>
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => {
                    setLoading(true);
                    setError('');
                    setPage((value) => value - 1);
                  }}
                >
                  قبلی
                </button>
                <span>{page.toLocaleString('fa-IR')}</span>
                <button
                  type="button"
                  disabled={page * data.meta.pageSize >= data.meta.total}
                  onClick={() => {
                    setLoading(true);
                    setError('');
                    setPage((value) => value + 1);
                  }}
                >
                  بعدی
                </button>
              </div>
            </>
          )}
        </div>
        {selected && (
          <Dialog
            open
            onOpenChange={(open) => {
              if (!open) setSelected(null);
            }}
          >
            <DialogContent
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                queueTrigger.current?.focus();
              }}
              dir="rtl"
              className="max-h-[90dvh] max-w-2xl overflow-y-auto"
            >
              <DialogTitle>رسیدگی به درخواست‌های مخاطب</DialogTitle>
              <DialogDescription>
                درخواست و اقدام‌های مرتبط را بررسی کنید.
              </DialogDescription>
              <WorkflowPanel
                key={selected.contactId}
                branchId={selected.branchId}
                actorId={actorId}
                contactId={selected.contactId}
                canManage={canManage}
                onChanged={() => (
                  setLoading(true),
                  setError(''),
                  setRevision((value) => value + 1)
                )}
              />
            </DialogContent>
          </Dialog>
        )}
      </section>
    </>
  );
}
function WorkflowEditor({
  editor,
  operators,
  branchId,
  contactId,
  onClose,
  onSaved,
}: {
  editor:
    | { kind: 'request'; item?: RequestCase }
    | { kind: 'task'; request: RequestCase; item?: FollowUp };
  operators: Operator[];
  branchId: string;
  contactId: string;
  onClose: () => void;
  onSaved: (data: RequestCase[]) => void;
}) {
  const restoreFocus = useDialogReturnFocus();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [dirty, setDirty] = useState(false);
  const [owner, setOwner] = useState(editor.item?.ownerId ?? '');
  const [status, setStatus] = useState(
    editor.item?.status ?? (editor.kind === 'task' ? 'OPEN' : 'NEW'),
  );
  const [priority, setPriority] = useState(editor.item?.priority ?? 'NORMAL');
  const stableId = useRef(editor.item?.id ?? crypto.randomUUID());
  const retry = useRef<{ body: string; commandId: string } | null>(null);
  const close = () => {
    if (
      !busy &&
      (!dirty || window.confirm('تغییرات ذخیره نشده کنار گذاشته شوند؟'))
    )
      onClose();
  };
  useUnsavedGuard(dirty);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? '').trim();
    const base = {
      id: stableId.current,
      expectedVersion: editor.item?.version ?? 0,
      ownerId: owner || null,
      status,
      priority,
    };
    let payload: unknown;
    if (editor.kind === 'request')
      payload = { ...base, title: value('title'), reason: value('reason') };
    else {
      if (!owner) {
        setError('کارشناس مسئول را انتخاب کنید.');
        return;
      }
      if (!value('dueAt')) {
        setError('موعد پیگیری را وارد کنید.');
        return;
      }
      payload = {
        ...base,
        ownerId: owner,
        action: value('action'),
        dueAt: new Date(value('dueAt')).toISOString(),
        result: value('result'),
      };
    }
    const body = JSON.stringify(payload);
    if (!retry.current || retry.current.body !== body)
      retry.current = { body, commandId: crypto.randomUUID() };
    setBusy(true);
    setError('');
    try {
      const input = { ...JSON.parse(body), commandId: retry.current.commandId };
      const response =
        editor.kind === 'request'
          ? await workflowApi.saveRequest(branchId, contactId, input)
          : await workflowApi.saveFollowUp(branchId, editor.request.id, input);
      onSaved(response.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'ذخیره انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  const due =
    editor.kind === 'task' && editor.item
      ? new Date(
          Date.parse(editor.item.dueAt) -
            new Date(editor.item.dueAt).getTimezoneOffset() * 60000,
        )
          .toISOString()
          .slice(0, 16)
      : '';
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
        className="max-h-[90dvh] overflow-y-auto"
      >
        <DialogTitle>
          {editor.kind === 'request'
            ? 'درخواست و مسئول رسیدگی'
            : 'اقدام پیگیری'}
        </DialogTitle>
        <DialogDescription>
          تغییرات پس از تأیید سرور ذخیره می‌شوند؛ زمان فرم بر اساس منطقه زمانی
          دستگاه است.
        </DialogDescription>
        <form
          className={styles.form}
          onSubmit={submit}
          onChange={() => setDirty(true)}
        >
          <fieldset disabled={busy}>
            {editor.kind === 'request' ? (
              <>
                <label>
                  عنوان درخواست
                  <input
                    name="title"
                    required
                    maxLength={160}
                    defaultValue={editor.item?.title}
                  />
                </label>
                <label>
                  دلیل تغییر، بستن یا بازگشایی
                  <textarea
                    name="reason"
                    maxLength={500}
                    required={
                      status === 'CLOSED' || editor.item?.status === 'CLOSED'
                    }
                    defaultValue={editor.item?.reason}
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  شرح اقدام
                  <textarea
                    name="action"
                    required
                    maxLength={500}
                    defaultValue={editor.item?.action}
                  />
                </label>
                <label>
                  موعد پیگیری
                  <input
                    name="dueAt"
                    type="datetime-local"
                    required
                    defaultValue={due}
                  />
                </label>
                <label>
                  نتیجه انجام یا دلیل لغو
                  <textarea
                    name="result"
                    maxLength={1000}
                    required={status !== 'OPEN'}
                    defaultValue={editor.item?.result}
                  />
                </label>
              </>
            )}
            <label>
              کارشناس مسئول
              <OwnerSelect
                operators={operators}
                value={owner}
                disabled={busy}
                onChange={(value) => {
                  setOwner(value);
                  setDirty(true);
                }}
              />
            </label>
            <label>
              وضعیت
              <NativeSearchSelect
                name="status"
                value={status}
                disabled={busy}
                onChange={(event) => {
                  const value = event.target.value;
                  setStatus(value);
                  setDirty(true);
                }}
              >
                {Object.entries(
                  editor.kind === 'request' ? requestLabels : taskLabels,
                )
                  .filter(
                    ([key]) =>
                      editor.item ||
                      (editor.kind === 'request'
                        ? key === 'NEW'
                        : key === 'OPEN'),
                  )
                  .map(([key, title]) => (
                    <option key={key} value={key}>
                      {title}
                    </option>
                  ))}
              </NativeSearchSelect>
            </label>
            <label>
              اولویت
              <NativeSearchSelect
                value={priority}
                disabled={busy}
                onChange={(event) => {
                  const value = event.target.value;
                  setPriority(value);
                  setDirty(true);
                }}
              >
                {Object.entries(priorities).map(([key, title]) => (
                  <option key={key} value={key}>
                    {title}
                  </option>
                ))}
              </NativeSearchSelect>
            </label>
            {error && <p role="alert">{error}</p>}
            <footer>
              <button type="submit">{busy ? 'در حال ذخیره…' : 'ذخیره'}</button>
              <button type="button" onClick={close}>
                انصراف
              </button>
            </footer>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
