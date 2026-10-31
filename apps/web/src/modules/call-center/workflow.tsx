'use client';
import { OwnerSelect } from './owner-select';
import { RequestChoice } from './request-choice';
import { RequestReferral } from './request-referral';
import { RequestCustomer } from './request-customer';
import { useDialogReturnFocus } from './use-dialog-focus';
import { useUnsavedGuard } from './use-unsaved-guard';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { DatePicker } from '@/components/ui/date-picker';
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
import { CallKpiCards } from './kpis';
import { readApi } from './read-client';
import { DossierRequestCard } from './dossier-request-card';
import { ScrollContinuation } from './scroll-continuation';

export const requestStatusOptions: Record<string, string> = {
  IN_PROGRESS: 'منتظر اقدام کارشناس',
  WAITING_CUSTOMER: 'منتظر پاسخ مشتری',
  CLOSED: 'بسته‌شده',
};
export const requestLabels: Record<string, string> = {
  NEW: requestStatusOptions.IN_PROGRESS!,
  ...requestStatusOptions,
};
export const taskLabels: Record<string, string> = {
  OPEN: 'باز',
  COMPLETED: 'انجام‌شده',
  CANCELLED: 'لغوشده',
};
const priorities = { NORMAL: 'عادی', HIGH: 'بالا', URGENT: 'فوری' };
export function WorkflowPanel({
  branchId,
  contactId,
  canManage,
  actorId,
  onChanged,
  calls = [],
  onLinked,
  dossier = false,
  newRequestOpen = false,
  onRequestClose,
  requestId,
}: {
  requestId?: string;
  dossier?: boolean;
  newRequestOpen?: boolean;
  onRequestClose?: () => void;
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
  const [pageMeta, setPageMeta] = useState<{
    total: number;
    hasMoreTasks: boolean;
    contactCallCount?: number;
  }>({ total: 0, hasMoreTasks: false });
  const [requests, setRequests] = useState<RequestCase[]>([]);
  const [contactCall, setContactCall] = useState<Call | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [localEditor, setEditor] = useState<
    | { kind: 'request'; item?: RequestCase }
    | { kind: 'task'; request: RequestCase; item?: FollowUp }
    | null
  >(null);
  const editor =
    localEditor ??
    (newRequestOpen && canManage ? { kind: 'request' as const } : null);
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
        requestId,
      ),
      workflowApi.operators(branchId),
      requestId
        ? readApi.calls(branchId, contactId, undefined, controller.signal)
        : Promise.resolve(null),
    ])
      .then(([result, options, history]) => {
        if (!controller.signal.aborted) {
          setRequests((previous) =>
            dossier && requestPage > 1
              ? [
                  ...previous.filter(
                    (item) => !result.data.some((next) => next.id === item.id),
                  ),
                  ...result.data,
                ]
              : result.data,
          );
          setContactCall(history?.data[0] ?? null);
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
  }, [
    branchId,
    contactId,
    revision,
    requestPage,
    taskPage,
    requestId,
    dossier,
  ]);
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
        <h3>{dossier ? 'درخواست‌ها' : 'درخواست‌ها و اقدام‌های پیگیری'}</h3>
        {!dossier && !requestId && (
          <button
            type="button"
            disabled={!canManage}
            onClick={() => setEditor({ kind: 'request' })}
          >
            درخواست جدید
          </button>
        )}
      </header>
      {requestId && !loading && !error && contactCall && (
        <article className={styles.card} aria-label="اطلاعات مخاطب">
          <strong>{contactCall.name || 'نام ثبت نشده'}</strong>
          <p>
            شماره تماس: <bdi dir="ltr">{contactCall.phone || 'نامشخص'}</bdi>
          </p>
          <p>موضوع آخرین تماس: {contactCall.subject || 'ثبت نشده'}</p>
          <p>
            منبع: {contactCall.source} · واحد: {contactCall.operator}
          </p>
          <p>
            آخرین تماس: {callDate(contactCall.occurredAt)} · نتیجه:{' '}
            {contactCall.needsCompletion && !contactCall.outcome
              ? 'نیازمند تکمیل'
              : ((
                  {
                    ANSWERED: 'گفت‌وگو انجام شد',
                    NO_ANSWER: 'بدون پاسخ',
                    BUSY: 'اشغال',
                    FAILED: 'ناموفق',
                  } as Record<string, string>
                )[contactCall.outcome ?? ''] ?? 'نامشخص')}
          </p>
          {pageMeta.contactCallCount !== undefined && (
            <p>تعداد تماس: {faNumber(pageMeta.contactCallCount)}</p>
          )}
        </article>
      )}
      {!dossier && (
        <p>تماس‌های یک شماره می‌توانند مربوط به درخواست‌های متفاوت باشند.</p>
      )}
      {!dossier && (
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
      )}
      {!dossier && !requestId && (
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
      )}
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
      {!dossier &&
        !loading &&
        !error &&
        requests.length > 0 &&
        calls.length > 0 && (
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
      {!error &&
        visible.map((request) =>
          dossier ? (
            <DossierRequestCard
              key={request.id}
              request={request}
              canManage={canManage}
              onEdit={() => setEditor({ kind: 'request', item: request })}
            />
          ) : (
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
              {request.result && <p>نتیجه رسیدگی: {request.result}</p>}
              <button
                type="button"
                disabled={!canManage}
                onClick={() => setEditor({ kind: 'request', item: request })}
              >
                تکمیل اطلاعات و تغییر وضعیت درخواست
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
                    task.status === 'OPEN' &&
                    Date.parse(task.dueAt) < Date.now()
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
                    {requestLabels[entry.status]} · {entry.reason}{' '}
                    {entry.result && ` · ${entry.result}`}
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
          ),
        )}
      {dossier && (
        <ScrollContinuation
          enabled={!loading && !error && requestPage * 10 < pageMeta.total}
          onMore={() => {
            setLoading(true);
            setRequestPage((value) => value + 1);
          }}
        />
      )}
      {editor && (
        <WorkflowEditor
          key={editor.kind + (editor.item?.id ?? 'new')}
          editor={editor}
          contactCall={contactCall ?? calls[0]}
          operators={operators}
          branchId={branchId}
          contactId={contactId}
          onClose={() => {
            setEditor(null);
            onRequestClose?.();
          }}
          onSaved={() => {
            window.dispatchEvent(new Event('call-center:workflow-changed'));
            setLoading(true);
            if (dossier) setRequestPage(1);
            setRevision((value) => value + 1);
            setEditor(null);
            onRequestClose?.();
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
  onWithoutOutcome,
  onMissedCallbacks,
  onPeriod,
  branchId,
  canManage,
  refreshKey = 0,
}: {
  branchId: string;
  actorId: string;
  canManage: boolean;
  refreshKey?: number;
  onWithoutOutcome?: () => void;
  onPeriod?: ((period: 'today' | 'week') => void) | undefined;
  onMissedCallbacks?: () => void;
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
      requestId: string;
      contactId: string;
      branchId: string;
    } | null>(null);
  useEffect(() => {
    const refresh = () => {
      setLoading(true);
      setRevision((value) => value + 1);
    };
    window.addEventListener('call-center:workflow-changed', refresh);
    return () =>
      window.removeEventListener('call-center:workflow-changed', refresh);
  }, []);
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
      <CallKpiCards
        onWithoutOutcome={onWithoutOutcome}
        onMissedCallbacks={onMissedCallbacks}
        onPeriod={onPeriod}
        branchId={branchId}
        revision={`${refreshKey}:${revision}`}
      />
      <section className={`${styles.panel} ${styles.queue}`}>
        <header>
          <h3 tabIndex={-1} ref={queueHeading}>
            صف رسیدگی و پیگیری
          </h3>
          <button
            type="button"
            aria-expanded={!collapsed}
            aria-controls="cc-queue-body"
            className={styles.queueAction}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? (
              <ChevronDown size={16} aria-hidden="true" />
            ) : (
              <ChevronUp size={16} aria-hidden="true" />
            )}
            {collapsed ? 'نمایش صف' : 'جمع کردن صف'}
          </button>
          <button
            type="button"
            className={styles.queueAction}
            onClick={() => (
              setLoading(true),
              setError(''),
              setRevision((value) => value + 1)
            )}
          >
            <RotateCcw size={16} aria-hidden="true" />
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
                ['OPEN', 'درخواست‌های باز'],
                ['CLOSED', 'درخواست‌های بسته‌شده'],
                ['MINE', 'کارهای من'],
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
              {!data.data.length && <p>درخواستی در این صف نیست.</p>}
              <div className={styles.queueRows}>
                <div className={styles.queueColumns} aria-hidden="true">
                  <span>عنوان درخواست</span>
                  <span>کارشناس مسئول</span>
                  <span>وضعیت</span>
                  <span>اولویت</span>
                  <span>زمان ثبت درخواست</span>
                </div>
                {data.data.map((item) => (
                  <button
                    className={styles.queueRow}
                    key={item.id}
                    type="button"
                    onClick={(event) => {
                      queueTrigger.current = event.currentTarget;
                      setSelected({
                        requestId: item.id,
                        contactId: item.contactId,
                        branchId: item.branchId,
                      });
                    }}
                  >
                    <strong>{item.title}</strong>
                    <span>{item.ownerName ?? 'بدون مسئول'}</span>
                    <span className={styles.status} data-status={item.status}>
                      {requestLabels[item.status]}
                    </span>
                    <span
                      className={styles.priority}
                      data-priority={item.priority}
                    >
                      {priorities[item.priority as keyof typeof priorities] ??
                        'نامشخص'}
                    </span>
                    <time dateTime={item.createdAt}>
                      {item.createdAt ? callDate(item.createdAt) : 'نامشخص'}
                    </time>
                  </button>
                ))}
              </div>
              <nav
                className={styles.queuePagination}
                aria-label="صفحه‌بندی صف رسیدگی و پیگیری"
              >
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
                <span aria-live="polite">
                  {faNumber(page)} /{' '}
                  {faNumber(
                    Math.max(
                      1,
                      Math.ceil(data.meta.total / data.meta.pageSize),
                    ),
                  )}
                </span>
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
              </nav>
            </>
          )}
        </div>
        {selected && (
          <QueueRequestEditor
            key={selected.requestId}
            selected={selected}
            canManage={canManage}
            onClose={() => setSelected(null)}
            onReturnFocus={(event) => {
              event.preventDefault();
              queueTrigger.current?.focus();
            }}
            onSaved={() => {
              window.dispatchEvent(new Event('call-center:workflow-changed'));
              setSelected(null);
            }}
          />
        )}
      </section>
    </>
  );
}
function QueueRequestEditor({
  selected,
  canManage,
  onClose,
  onReturnFocus,
  onSaved,
}: {
  selected: { requestId: string; contactId: string; branchId: string };
  canManage: boolean;
  onClose: () => void;
  onReturnFocus: (event: Event) => void;
  onSaved: () => void;
}) {
  const [loaded, setLoaded] = useState<{
    item: RequestCase;
    contactCall: Call | undefined;
  } | null>(null);
  const [error, setError] = useState('');
  const handingOff = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      workflowApi.list(
        selected.branchId,
        selected.contactId,
        controller.signal,
        1,
        1,
        selected.requestId,
      ),
      readApi.calls(
        selected.branchId,
        selected.contactId,
        undefined,
        controller.signal,
      ),
    ])
      .then(([requests, history]) => {
        if (controller.signal.aborted) return;
        const item = requests.data.find(
          (request) => request.id === selected.requestId,
        );
        if (!item) throw new Error('دریافت درخواست‌ها انجام نشد.');
        handingOff.current = true;
        setLoaded({ item, contactCall: history.data[0] });
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : 'دریافت درخواست‌ها انجام نشد.',
          );
      });
    return () => controller.abort();
  }, [selected.branchId, selected.contactId, selected.requestId]);
  if (loaded)
    return (
      <WorkflowEditor
        editor={{ kind: 'request', item: loaded.item }}
        contactCall={loaded.contactCall}
        operators={[]}
        branchId={selected.branchId}
        contactId={selected.contactId}
        readOnly={!canManage}
        onReturnFocus={onReturnFocus}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        dir="rtl"
        onCloseAutoFocus={(event) => {
          if (handingOff.current) event.preventDefault();
          else onReturnFocus(event);
        }}
      >
        <DialogTitle>درخواست و مسئول رسیدگی</DialogTitle>
        <DialogDescription>
          {error || 'در حال دریافت درخواست‌ها…'}
        </DialogDescription>
        {error && <p role="alert">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
export function WorkflowEditor({
  editor,
  contactCall,
  operators,
  branchId,
  contactId,
  onClose,
  onSaved,
  readOnly = false,
  onReturnFocus,
}: {
  readOnly?: boolean;
  onReturnFocus?: (event: Event) => void;
  contactCall?: Call | undefined;
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
  const managementLocked =
    editor.kind === 'request' &&
    !!editor.item &&
    editor.item.canEditManagement !== true;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [dirty, setDirty] = useState(false);
  const [owner, setOwner] = useState(editor.item?.ownerId ?? '');
  const [ownersRevision, setOwnersRevision] = useState(0);
  const [ownersResult, setOwnersResult] = useState<{
    key: string;
    data: Operator[];
    error: string;
  } | null>(null);
  const ownersKey = `${branchId}:${ownersRevision}`;
  const ownersLoading =
    editor.kind === 'request' &&
    !managementLocked &&
    ownersResult?.key !== ownersKey;
  const requestOperators =
    ownersResult?.key === ownersKey ? ownersResult.data : [];
  const ownersError = ownersResult?.key === ownersKey ? ownersResult.error : '';
  useEffect(() => {
    if (editor.kind !== 'request' || managementLocked) return;
    let active = true;
    void workflowApi
      .requestOperators(branchId)
      .then(({ data }) => {
        if (!active) return;
        setOwnersResult({ key: ownersKey, data, error: '' });
        setOwner(
          (current) => current || (data.length === 1 ? data[0]!.id : ''),
        );
      })
      .catch(() => {
        if (active)
          setOwnersResult({
            key: ownersKey,
            data: [],
            error: 'دریافت فهرست کارشناسان ممکن نشد.',
          });
      });
    return () => {
      active = false;
    };
  }, [branchId, editor.kind, ownersKey, managementLocked]);
  const [status, setStatus] = useState(
    editor.kind === 'request'
      ? editor.item?.status && editor.item.status !== 'NEW'
        ? editor.item.status
        : 'IN_PROGRESS'
      : (editor.item?.status ?? 'OPEN'),
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
    if (busy || readOnly) return;
    if (
      editor.kind === 'request' &&
      !managementLocked &&
      (ownersLoading || ownersError)
    )
      return;
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
    if (editor.kind === 'request' && !value('reason')) {
      setError('دلیل تغییر، بستن یا بازگشایی را وارد کنید.');
      return;
    }
    if (editor.kind === 'request' && !editor.item && !owner) {
      setError('کارشناس مسئول را انتخاب کنید.');
      return;
    }
    if (editor.kind === 'request')
      payload = {
        ...base,
        status: editor.item ? status : 'IN_PROGRESS',
        title: value('title'),
        reason: value('reason'),
        ...(editor.item ? { result: value('result') } : {}),
      };
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
        onCloseAutoFocus={onReturnFocus ?? restoreFocus}
        onEscapeKeyDown={(event) => {
          // Radix observes Escape before the search input closes its own menu.
          const target = event.target;
          if (
            target instanceof Element &&
            target.matches('[role="combobox"][aria-expanded="true"]') &&
            target.closest('[data-call-owner-select]')
          )
            event.preventDefault();
        }}
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
        {contactCall && (
          <p className={styles.editorContact}>
            مخاطب: {contactCall.name || 'نام ثبت نشده'} ·{' '}
            <bdi dir="ltr">{contactCall.phone || 'شماره نامشخص'}</bdi> ·{' '}
            {contactCall.subject}
          </p>
        )}
        <form
          className={styles.form}
          onSubmit={submit}
          onChange={() => setDirty(true)}
        >
          <fieldset disabled={busy || readOnly}>
            {editor.kind === 'request' ? (
              <>
                <label>
                  عنوان درخواست
                  <input
                    name="title"
                    readOnly={managementLocked}
                    required
                    maxLength={160}
                    defaultValue={editor.item?.title}
                  />
                </label>
                <label>
                  <span>
                    دلیل تغییر، بستن یا بازگشایی{' '}
                    <span aria-hidden="true">*</span>
                  </span>
                  <textarea
                    name="reason"
                    maxLength={500}
                    required
                    defaultValue={editor.item?.reason}
                  />
                </label>
                {editor.item && (
                  <label>
                    اطلاعات تکمیلی و نتیجه رسیدگی
                    <textarea
                      name="result"
                      maxLength={1000}
                      required={status === 'CLOSED'}
                      defaultValue={editor.item.result}
                    />
                  </label>
                )}
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
                  <DatePicker
                    name="dueAt"
                    aria-label="موعد پیگیری"
                    includeTime
                    withinDialog
                    required
                    defaultValue={due}
                    onChange={() => setDirty(true)}
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
              {managementLocked ? (
                <input
                  aria-label="کارشناس مسئول"
                  readOnly
                  value={editor.item?.ownerName ?? 'بدون مسئول'}
                />
              ) : (
                <OwnerSelect
                  operators={
                    editor.kind === 'request' ? requestOperators : operators
                  }
                  value={owner}
                  disabled={
                    busy || (editor.kind === 'request' && ownersLoading)
                  }
                  required={editor.kind === 'request'}
                  onChange={(value) => {
                    setOwner(value);
                    setDirty(true);
                  }}
                />
              )}
              {editor.kind === 'request' && ownersLoading && (
                <span role="status">در حال دریافت کارشناسان…</span>
              )}
              {editor.kind === 'request' && ownersError && (
                <span role="alert">
                  {ownersError}{' '}
                  <button
                    type="button"
                    onClick={() => setOwnersRevision((value) => value + 1)}
                  >
                    تلاش مجدد
                  </button>
                </span>
              )}
            </label>
            {(editor.kind === 'task' || editor.item) && (
              <label>
                وضعیت
                <RequestChoice
                  label="وضعیت"
                  name="status"
                  value={status}
                  disabled={busy || managementLocked}
                  onValueChange={(value) => {
                    setStatus(value);
                    setDirty(true);
                  }}
                  options={Object.fromEntries(
                    Object.entries(
                      editor.kind === 'request'
                        ? requestStatusOptions
                        : taskLabels,
                    ).filter(
                      ([key]) =>
                        editor.item ||
                        (editor.kind === 'request'
                          ? key === 'IN_PROGRESS'
                          : key === 'OPEN'),
                    ),
                  )}
                />
              </label>
            )}
            <label>
              اولویت
              <RequestChoice
                label="اولویت"
                value={priority}
                disabled={busy || managementLocked}
                onValueChange={(value) => {
                  setPriority(value);
                  setDirty(true);
                }}
                options={priorities}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            {!readOnly && (
              <footer>
                <button type="submit">
                  {busy ? 'در حال ذخیره…' : 'ذخیره'}
                </button>
                <button type="button" onClick={close}>
                  انصراف
                </button>
              </footer>
            )}
          </fieldset>
          {readOnly && (
            <button type="button" onClick={close}>
              بستن
            </button>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
