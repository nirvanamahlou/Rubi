'use client';
import { useEffect, useRef, useState } from 'react';
import { Phone, RotateCcw } from 'lucide-react';
import { useAccessActor } from '@/modules/iam/access-context';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { callCenterRequest, CallCenterHttpError } from './client';
import { workflowApi, type Operator } from './workflow-client';
import { useUnsavedGuard } from './use-unsaved-guard';
import styles from './telephony.module.css';
import { telephonyDraftName } from './telephony-draft';
import { OperationalCallPopup } from './operational-call-popup';
export interface AttentionCall {
  id: string;
  callId: string;
  branchId: string;
  version: number;
  state: string;
  synthetic: boolean;
  claimed: boolean;
  deferred: boolean;
  call: {
    direction?: string;
    phone: string;
    name: string;
    subject: string;
    note: string;
  };
  technical: {
    caller: { kind: string; value: string | null };
    callerName?: string | null;
    destination: { kind: string; value: string | null };
    extension: string | null;
    occurredAt: string;
    receivedAt: string;
    legs: number;
    recordingCount: number;
  };
}
interface Snapshot {
  incoming?: AttentionCall[];
  data: AttentionCall[];
  meta: { total: number; page: number };
}
const states: Record<string, string> = {
  RINGING: 'در حال زنگ',
  ANSWERED: 'پاسخ داده شده',
  ENDED: 'پایان‌یافته',
  UNKNOWN: 'وضعیت نامشخص',
};
export function TelephonyAttention({
  outboundOnly = false,
}: {
  outboundOnly?: boolean;
}) {
  const actor = useAccessActor();
  // Explicit local rollout hold: no automatic attention UI before owner activation.
  if (
    outboundOnly
      ? process.env.NEXT_PUBLIC_CALL_CENTER_OUTBOUND_POPUPS_ENABLED !== 'true'
      : process.env.NEXT_PUBLIC_CALL_CENTER_POPUPS_ENABLED === 'false'
  )
    return null;
  const allowed =
    !!actor?.permissions.includes(
      'customer_affairs.call_center.workflow.manage',
    ) && !!actor.permissions.includes('customer_affairs.call_center.read');
  if (!allowed || !actor) return null;
  return (
    <Attention
      key={actor.userId + actor.branchIds.join(',')}
      branch={actor.branchIds[0] ?? ''}
      outboundOnly={outboundOnly}
    />
  );
}
function Attention({
  branch,
  outboundOnly,
}: {
  branch: string;
  outboundOnly: boolean;
}) {
  const [rows, setRows] = useState<AttentionCall[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1);
  const [current, setCurrent] = useState<AttentionCall | null>(null),
    [open, setOpen] = useState(false),
    [leader, setLeader] = useState(false),
    [status, setStatus] = useState('در حال اتصال'),
    [blocked, setBlocked] = useState(false),
    [error, setError] = useState('');
  const [history, setHistory] = useState<
    { id: string; subject: string; occurredAt: string }[]
  >([]);
  const [draft, setDraft] = useState({ name: '', subject: '', note: '' }),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [operators, setOperators] = useState<Operator[]>([]),
    [target, setTarget] = useState('');
  const [tab] = useState(() => crypto.randomUUID());
  const currentRef = useRef<AttentionCall | null>(null),
    button = useRef<HTMLButtonElement>(null),
    seen = useRef(new Set<string>());
  useUnsavedGuard(dirty);
  useEffect(() => {
    currentRef.current = current;
  }, [current]);
  useEffect(() => {
    return () => {
      void callCenterRequest('/telephony/lease', branch, {
        method: 'POST',
        body: JSON.stringify({ tabId: tab, release: true }),
        keepalive: true,
      }).catch(() => {});
    };
  }, [branch, tab]);
  useEffect(() => {
    if (blocked) return;
    let disposed = false;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const visible = document.visibilityState === 'visible';
        const lease = await callCenterRequest<{ leader: boolean }>(
          '/telephony/lease',
          branch,
          {
            method: 'POST',
            body: JSON.stringify({ tabId: tab, release: !visible }),
            signal: abort.signal,
          },
        );
        const data = await callCenterRequest<Snapshot>(
          `/telephony?page=${page}`,
          branch,
          { signal: abort.signal },
        );
        if (disposed) return;
        setLeader(lease.leader);
        const attention = (data.incoming ?? data.data).filter(
          (row) =>
            !outboundOnly ||
            (!row.synthetic && row.call.direction === 'OUTBOUND'),
        );
        const visibleRows = [
          ...new Map(
            [...data.data, ...attention].map((row) => [row.id, row]),
          ).values(),
        ];
        setRows(visibleRows);
        setTotal(data.meta.total);
        setStatus(
          lease.leader ? 'دریافت اعلان فعال' : 'دریافت در تب دیگر یا پس‌زمینه',
        );
        const selected = currentRef.current;
        if (selected) {
          const fresh = visibleRows.find((r) => r.id === selected.id);
          if (fresh) setCurrent(fresh);
        }
        if (
          lease.leader &&
          visible &&
          !selected &&
          !document.querySelector('[role="dialog"]')
        ) {
          const incoming = attention.find(
            (r) => !r.deferred && !seen.current.has(r.id),
          );
          if (incoming) {
            seen.current.add(incoming.id);
            setCurrent(incoming);
            setDraft({
              name: telephonyDraftName(incoming),
              subject: incoming.call.subject,
              note: incoming.call.note,
            });
            setDirty(false);
            setOpen(true);
            if (outboundOnly)
              window.dispatchEvent(new Event('call-center:outbound-received'));
          }
        }
      } catch (e) {
        if (disposed) return;
        if (e instanceof CallCenterHttpError && [401, 403].includes(e.status)) {
          setBlocked(true);
          setRows([]);
          setCurrent(null);
          setDraft({ name: '', subject: '', note: '' });
          setOpen(false);
          setDirty(false);
          setStatus('نشست یا مجوز دریافت معتبر نیست');
        } else setStatus('ارتباط قطع است؛ داده قبلی نمایش داده می‌شود');
      } finally {
        if (!disposed)
          timer = setTimeout(() => {
            void poll();
          }, 2000);
      }
    }
    void poll();
    return () => {
      disposed = true;
      abort.abort();
      clearTimeout(timer);
    };
  }, [branch, page, blocked, tab, outboundOnly]);
  const currentId = current?.id,
    currentBranch = current?.branchId;
  useEffect(() => {
    if (!currentId || !currentBranch) return;
    let live = true;
    callCenterRequest<{
      data: { id: string; subject: string; occurredAt: string }[];
    }>(`/telephony/${currentId}/history`, currentBranch)
      .then((r) => {
        if (live) setHistory(r.data);
      })
      .catch(() => {
        if (live) setHistory([]);
      });
    workflowApi
      .operators(currentBranch)
      .then((r) => {
        if (live) setOperators(r.data);
      })
      .catch(() => {
        if (live) setOperators([]);
      });
    return () => {
      live = false;
    };
  }, [currentId, currentBranch]);
  function select(row: AttentionCall) {
    if (current?.id === row.id) {
      setOpen(true);
      return;
    }
    if (dirty && current?.id !== row.id) {
      setError('ابتدا پیش‌نویس تماس جاری را ثبت کنید.');
      return;
    }
    setCurrent(row);
    setDraft({
      name: telephonyDraftName(row),
      subject: row.call.subject,
      note: row.call.note,
    });
    setDirty(false);
    seen.current.add(row.id);
    setOpen(true);
    setError('');
  }
  async function action(kind: 'CLAIM' | 'SAVE' | 'DEFER' | 'TRANSFER') {
    if (!current || busy) return;
    setBusy(true);
    setError('');
    try {
      await callCenterRequest(
        `/telephony/${current.id}/actions`,
        current.branchId,
        {
          method: 'POST',
          body: JSON.stringify({
            version: current.version,
            tabId: tab,
            action: kind,
            ...(kind === 'SAVE' ? draft : {}),
            ...(kind === 'TRANSFER' ? { targetUserId: target } : {}),
          }),
        },
      );
      if (kind === 'SAVE' || kind === 'TRANSFER') {
        setCurrent(null);
        setOpen(false);
        setDirty(false);
        setDraft({ name: '', subject: '', note: '' });
        setStatus('عملیات ثبت شد');
      } else if (kind === 'DEFER') {
        setOpen(false);
        if (!dirty) setCurrent(null);
        setStatus('در صف تکمیل اطلاعات باقی ماند');
      } else {
        const result = await callCenterRequest<Snapshot>('/telephony', branch);
        const next = result.data.find((r) => r.id === current.id);
        if (next) setCurrent(next);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ثبت انجام نشد.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside
      className={outboundOnly ? undefined : styles.attention}
      aria-label="صف تماس تلفنی"
    >
      {!outboundOnly && (
        <>
          <button ref={button} type="button" onClick={() => setOpen(true)}>
            <Phone size={18} /> تماس‌ها ({total})
          </button>
          <small role="status">{status}</small>
          {blocked && (
            <button onClick={() => setBlocked(false)} type="button">
              <RotateCcw size={14} /> تلاش مجدد
            </button>
          )}
        </>
      )}
      {open && current && !current.synthetic && (
        <OperationalCallPopup
          key={current.id}
          row={current}
          tabId={tab}
          leader={leader}
          onClose={() => {
            setOpen(false);
            setCurrent(null);
            setDirty(false);
          }}
        />
      )}
      <Dialog
        open={!outboundOnly && open && (!current || current.synthetic)}
        onOpenChange={(value) => setOpen(value)}
      >
        <DialogContent
          className={styles.dialog}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            button.current?.focus();
          }}
        >
          <DialogTitle>صف تماس و تکمیل اطلاعات</DialogTitle>
          <DialogDescription>
            ایزابل متصل نشده است. بستن این پنجره تماس را حذف نمی‌کند؛ پیش‌نویس
            تا خروج از صفحه در حافظه می‌ماند.
          </DialogDescription>
          <p role="status">{status}</p>
          <div className={styles.queue}>
            {rows.map((row) => (
              <button
                type="button"
                aria-pressed={current?.id === row.id}
                key={row.id}
                onClick={() => select(row)}
              >
                {row.synthetic ? 'آزمایشی · ' : ''}
                <bdi>{row.call.phone || 'شماره نامعلوم'}</bdi> ·{' '}
                {states[row.state] ?? row.state}
              </button>
            ))}
          </div>
          {!rows.length && <p>تماسی برای رسیدگی در این صفحه وجود ندارد.</p>}
          <div className={styles.actions}>
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              قبلی
            </button>
            <span>{page}</span>
            <button
              disabled={page * 25 >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              بعدی
            </button>
          </div>
          {current && (
            <>
              <div className={styles.technical}>
                <strong>
                  {current.synthetic
                    ? 'تماس مصنوعی — بدون صوت واقعی'
                    : 'اطلاعات فنی تماس'}
                </strong>
                <p>
                  <bdi>{current.call.phone || 'مخفی یا نامعلوم'}</bdi> · داخلی{' '}
                  {current.technical.extension ?? 'نامعلوم'} ·{' '}
                  {states[current.state]}
                </p>
                <p>
                  وقوع:{' '}
                  {new Date(current.technical.occurredAt).toLocaleString(
                    'fa-IR',
                    { timeZone: 'Asia/Tehran' },
                  )}
                </p>
                <p>
                  دریافت سرور:{' '}
                  {new Date(current.technical.receivedAt).toLocaleString(
                    'fa-IR',
                    { timeZone: 'Asia/Tehran' },
                  )}
                </p>
                <small>
                  {current.technical.legs} مرحله ·{' '}
                  {current.technical.recordingCount} مرجع صوت (پخش هنوز متصل
                  نیست)
                </small>
              </div>
              <div>
                <strong>سه تماس قبلی همین مخاطب</strong>
                {history.length ? (
                  history.map((h) => (
                    <p key={h.id}>
                      {h.subject || 'موضوع ثبت نشده'} ·{' '}
                      {new Date(h.occurredAt).toLocaleString('fa-IR', {
                        timeZone: 'Asia/Tehran',
                      })}
                    </p>
                  ))
                ) : (
                  <p>سابقه‌ای برای نمایش وجود ندارد.</p>
                )}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void action('SAVE');
                }}
                className={styles.form}
              >
                <label>
                  نام مخاطب
                  <input
                    value={draft.name}
                    maxLength={100}
                    onChange={(e) => {
                      setDraft({ ...draft, name: e.target.value });
                      setDirty(true);
                    }}
                  />
                </label>
                <label>
                  موضوع تماس
                  <input
                    required
                    value={draft.subject}
                    maxLength={200}
                    onChange={(e) => {
                      setDraft({ ...draft, subject: e.target.value });
                      setDirty(true);
                    }}
                  />
                </label>
                <label>
                  توضیحات تجاری
                  <textarea
                    value={draft.note}
                    maxLength={2000}
                    rows={4}
                    onChange={(e) => {
                      setDraft({ ...draft, note: e.target.value });
                      setDirty(true);
                    }}
                  />
                </label>
                <div className={styles.actions}>
                  <button
                    type="button"
                    disabled={!leader || busy || current.claimed}
                    onClick={() => void action('CLAIM')}
                  >
                    {current.claimed ? 'در اختیار شما' : 'پذیرش رسیدگی'}
                  </button>
                  <button
                    type="submit"
                    disabled={!leader || busy || !current.claimed}
                  >
                    ثبت اطلاعات
                  </button>
                  <button
                    type="button"
                    disabled={!leader || busy}
                    onClick={() => void action('DEFER')}
                  >
                    تکمیل در فرصتی دیگر
                  </button>
                </div>
                <label>
                  انتقال به کارشناس
                  <NativeSearchSelect
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    aria-label="کارشناس مقصد"
                  >
                    <option value="">انتخاب کارشناس</option>
                    {operators.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.displayName}
                      </option>
                    ))}
                  </NativeSearchSelect>
                </label>
                <button
                  type="button"
                  disabled={
                    !target || !current.claimed || !leader || busy || dirty
                  }
                  onClick={() => void action('TRANSFER')}
                >
                  انتقال رسیدگی
                </button>
              </form>
            </>
          )}
          {error && <p role="alert">{error}</p>}
        </DialogContent>
      </Dialog>
    </aside>
  );
}
