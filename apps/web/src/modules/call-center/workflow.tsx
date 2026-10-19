'use client';
import { useUnsavedGuard } from './use-unsaved-guard';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import { callDate } from './model';
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
      workflowApi.list(branchId, contactId, controller.signal),
      workflowApi.operators(branchId),
    ])
      .then(([result, options]) => {
        if (!controller.signal.aborted) {
          setRequests(result.data);
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
  }, [branchId, contactId, revision]);
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
          onSaved={(data) => {
            setRequests(data);
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
}: {
  branchId: string;
  actorId: string;
  canManage: boolean;
}) {
  const [view, setView] = useState('MINE'),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0);
  const [data, setData] = useState<Awaited<
    ReturnType<typeof workflowApi.queue>
  > | null>(null);
  const [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    workflowApi
      .queue(branchId, view, page, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error ? reason.message : 'دریافت صف انجام نشد.',
          );
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [branchId, view, page, revision]);
  return (
    <section className={styles.panel}>
      <header>
        <h3>صف رسیدگی و پیگیری شعبه</h3>
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
      <NativeSearchSelect
        aria-label="نمای صف رسیدگی"
        value={view}
        onChange={(event) => {
          setLoading(true);
          setError('');
          setView(event.target.value);
          setPage(1);
        }}
      >
        <option value="MINE">کارهای من</option>
        <option value="TODAY">امروز</option>
        <option value="OVERDUE">عقب‌افتاده</option>
        <option value="UNASSIGNED">بدون مسئول</option>
        <option value="ALL">همه درخواست‌های باز شعبه</option>
      </NativeSearchSelect>
      {loading && <p role="status">در حال دریافت صف…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && data && (
        <>
          <p>
            {data.meta.total.toLocaleString('fa-IR')} درخواست · تاریخ امروز بر
            اساس تهران
          </p>
          {!data.data.length && <p>درخواستی در این صف نیست.</p>}
          {data.data.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelected(item.contactId)}
            >
              {item.title} · {item.ownerName ?? 'بدون مسئول'} ·{' '}
              {requestLabels[item.status]}
            </button>
          ))}
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
      {selected && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
        >
          <DialogContent
            dir="rtl"
            className="max-h-[90dvh] max-w-2xl overflow-y-auto"
          >
            <DialogTitle>رسیدگی به درخواست‌های مخاطب</DialogTitle>
            <DialogDescription>
              درخواست و اقدام‌های مرتبط را بررسی کنید.
            </DialogDescription>
            <WorkflowPanel
              key={selected}
              branchId={branchId}
              actorId={actorId}
              contactId={selected}
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
      <DialogContent dir="rtl" className="max-h-[90dvh] overflow-y-auto">
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
