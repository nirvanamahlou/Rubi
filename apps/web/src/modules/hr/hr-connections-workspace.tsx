'use client';
import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  HR_CONNECTION_MODULES,
  HR_CONNECTION_STATUS_LABELS,
  HR_CONNECTION_TARGETS,
  type HrConnectionDto,
  type HrConnectionList,
  type HrConnectionStatus,
  type HrConnectionTarget,
  type HrRecordDto,
} from '@rubi/contracts';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/form-controls';
import { DatePicker } from '@/components/ui/date-picker';
import { HrApiError, hrApi, hrRequest } from './hr-api';
import { connectionsApi } from './hr-connections-api';

const selectClass =
  'w-full rounded-xl border border-input bg-surface p-2 text-sm text-foreground';
const titleOf = (target: string) =>
  HR_CONNECTION_MODULES.find((m) => m.key === target)?.title ?? target;
const dateLabel = (value: string) =>
  new Date(value).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' });
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : 'عملیات انجام نشد.';

export function HrConnectionsWorkspace({
  target,
  sourceMode,
  sourceRecord,
}: {
  target: string | undefined;
  sourceMode: boolean;
  sourceRecord: string | null;
}) {
  const [result, setResult] = useState<{
    key: string;
    data: HrConnectionList | null;
    error: string;
  } | null>(null);
  const [page, setPage] = useState(1),
    [status, setStatus] = useState('');
  const [filter, setFilter] = useState(target ?? ''),
    [revision, setRevision] = useState(0);
  const [create, setCreate] = useState(Boolean(sourceRecord));
  const requestKey = JSON.stringify({ filter, status, page, revision });
  const loading = result?.key !== requestKey;
  const data = loading ? null : result.data;
  const error = loading ? '' : result.error;
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    let active = true;
    void connectionsApi
      .list({
        page: String(page),
        ...(filter ? { target: filter } : {}),
        ...(status ? { status } : {}),
      })
      .then((value) => {
        if (active) setResult({ key: requestKey, data: value, error: '' });
      })
      .catch((e) => {
        if (active)
          setResult({
            key: requestKey,
            data: null,
            error:
              e instanceof HrApiError && e.status === 403
                ? 'برای مشاهده یا پاسخ، مجوز ارتباطات منابع انسانی این بخش باید به نقش شما اختصاص داده شود.'
                : errorText(e),
          });
      });
    return () => {
      active = false;
    };
  }, [filter, status, page, requestKey]);
  return (
    <div className="mt-4 space-y-4">
      {sourceMode ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {HR_CONNECTION_MODULES.map((module) => (
            <Link
              key={module.key}
              className="rounded-xl border border-border p-3 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              href={`${module.path}?hrConnections=1`}
            >
              <strong className="block text-sm">{module.title}</strong>
              <span className="mt-1 block text-xs text-muted-foreground">
                {module.purpose}
              </span>
            </Link>
          ))}
        </div>
      ) : null}
      <p className="rounded-xl bg-muted p-3 text-xs leading-6">
        این فهرست برای ارجاع و پاسخ بین بخش‌هاست. پاسخ درخواست، رسید پرداخت،
        صدور بلیط یا تأیید قطع دسترسی محسوب نمی‌شود؛ نتیجه عملیاتی باید در بخش
        مسئول ثبت شود.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        {!target ? (
          <label className="min-w-48 text-xs">
            بخش مقصد
            <select
              className={selectClass}
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">همه بخش‌های مجاز</option>
              {HR_CONNECTION_TARGETS.map((item) => (
                <option key={item} value={item}>
                  {titleOf(item)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="min-w-40 text-xs">
          وضعیت
          <select
            className={selectClass}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">همه وضعیت‌ها</option>
            {Object.entries(HR_CONNECTION_STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          به‌روزرسانی
        </Button>
        {data?.canSend && sourceMode ? (
          <Button onClick={() => setCreate(!create)}>
            {create ? 'بستن فرم' : 'ارجاع پرونده به بخش دیگر'}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      {loading ? <p role="status">در حال دریافت درخواست‌ها…</p> : null}
      {data ? (
        <>
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            aria-label="آمار درخواست‌های مجاز"
          >
            {[
              ['منتظر رسیدگی', data.counts.SUBMITTED],
              ['در حال رسیدگی', data.counts.IN_REVIEW],
              ['پاسخ دریافت شد', data.counts.ANSWERED],
              ['گذشته از مهلت', data.counts.overdue],
            ].map(([label, count]) => (
              <div key={label} className="rounded-xl bg-muted p-3">
                <span className="block text-xs">{label}</span>
                <strong className="text-xl">
                  {Number(count).toLocaleString('fa-IR')}
                </strong>
              </div>
            ))}
          </div>
          {create && sourceMode && data.canSend ? (
            <ReferralForm
              sourceId={sourceRecord}
              onSaved={() => {
                setCreate(false);
                refresh();
              }}
            />
          ) : null}
          {!data.items.length ? (
            <p className="py-4 text-sm text-muted-foreground">
              درخواستی با این فیلتر و سطح دسترسی وجود ندارد.
            </p>
          ) : (
            data.items.map((item) => (
              <ConnectionCard
                key={`${item.id}:${item.version}`}
                item={item}
                onSaved={refresh}
              />
            ))
          )}
          <div className="flex items-center justify-between gap-2 text-sm">
            <Button
              variant="outline"
              disabled={page <= 1 || loading}
              onClick={() => setPage(page - 1)}
            >
              صفحه قبل
            </Button>
            <span>
              {data.total.toLocaleString('fa-IR')} درخواست · صفحه{' '}
              {page.toLocaleString('fa-IR')}
            </span>
            <Button
              variant="outline"
              disabled={page * data.pageSize >= data.total || loading}
              onClick={() => setPage(page + 1)}
            >
              صفحه بعد
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

function ReferralForm({
  sourceId,
  onSaved,
}: {
  sourceId: string | null;
  onSaved: () => void;
}) {
  const [records, setRecords] = useState<HrRecordDto[]>([]),
    [selected, setSelected] = useState<HrRecordDto | null>(null);
  const [search, setSearch] = useState(''),
    [query, setQuery] = useState(''),
    [loadError, setLoadError] = useState('');
  const [target, setTarget] = useState<HrConnectionTarget>('tasks'),
    [title, setTitle] = useState(''),
    [message, setMessage] = useState(''),
    [due, setDue] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [acknowledged, setAcknowledged] = useState(false);
  const deadlineId = useId();
  const receipt = useRef<{ fingerprint: string; key: string } | null>(null);
  useEffect(() => {
    let active = true;
    void hrApi.records
      .list({ search: query, pageSize: 100 })
      .then((result) => {
        if (active) {
          setRecords(result.items);
          setLoadError('');
        }
      })
      .catch((e) => {
        if (active) setLoadError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [query]);
  useEffect(() => {
    if (!sourceId) return;
    let active = true;
    void hrRequest<HrRecordDto>(`/records/${encodeURIComponent(sourceId)}`)
      .then((record) => {
        if (active) setSelected(record);
      })
      .catch((e) => {
        if (active) setLoadError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [sourceId]);
  async function submit() {
    if (!selected || !due || !acknowledged) {
      setError('پرونده، مهلت و تأیید اشتراک متن لازم است.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const input = {
        target,
        title,
        message,
        sourceId: selected.id,
        sourceVersion: selected.version,
        dueAt: new Date(`${due}T23:59:59+03:30`).toISOString(),
      };
      const fingerprint = JSON.stringify(input);
      if (receipt.current?.fingerprint !== fingerprint)
        receipt.current = { fingerprint, key: crypto.randomUUID() };
      await connectionsApi.create(input, receipt.current.key);
      onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="space-y-3 rounded-xl border border-border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      aria-label="ارجاع پرونده منابع انسانی"
    >
      <h3 className="font-bold">درخواست همکاری از بخش دیگر</h3>
      <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          جست‌وجوی پرونده مبنا
          <Input value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <Button
          type="button"
          variant="outline"
          onClick={() => setQuery(search)}
        >
          جست‌وجو در پرونده‌ها
        </Button>
        <label className="text-sm">
          پرونده مبنا
          <select
            className={selectClass}
            required
            value={selected?.id ?? ''}
            onChange={(e) =>
              setSelected(records.find((r) => r.id === e.target.value) ?? null)
            }
          >
            <option value="">انتخاب پرونده</option>
            {selected && !records.some((r) => r.id === selected.id) ? (
              <option value={selected.id}>{selected.code}</option>
            ) : null}
            {records.map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} · {r.values[0]} · {r.status}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          بخش مقصد
          <select
            className={selectClass}
            value={target}
            onChange={(e) => setTarget(e.target.value as HrConnectionTarget)}
          >
            {HR_CONNECTION_TARGETS.map((key) => (
              <option key={key} value={key}>
                {titleOf(key)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          عنوان
          <Input
            required
            maxLength={160}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <div className="text-sm">
          <label htmlFor={deadlineId}>
            مهلت رسیدگی (پایان روز به وقت تهران)
          </label>
          <DatePicker id={deadlineId} required value={due} onChange={setDue} />
        </div>
        <label className="text-sm sm:col-span-2">
          متن موردنیاز بخش مقصد
          <Textarea
            required
            maxLength={2000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </label>
        <label className="flex items-start gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            required
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
          />
          متن بالا، نام کارمند و مرجع پرونده برای مسئولان مجاز بخش مقصد به
          اشتراک گذاشته شود.
        </label>
      </fieldset>
      {loadError || error ? (
        <p role="alert" className="text-destructive">
          {error || loadError}
        </p>
      ) : null}
      <Button type="submit" disabled={busy || !selected}>
        {busy ? 'در حال ارسال…' : 'ارسال درخواست'}
      </Button>
    </form>
  );
}

export function ConnectionCard({
  item,
  onSaved,
}: {
  item: HrConnectionDto;
  onSaved: () => void;
}) {
  const [note, setNote] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const receipt = useRef<{ fingerprint: string; key: string } | null>(null);
  async function respond(status: Exclude<HrConnectionStatus, 'SUBMITTED'>) {
    if (!note.trim()) {
      setError('توضیح رسیدگی یا پاسخ را وارد کنید.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const input = { version: item.version, status, note },
        fingerprint = JSON.stringify(input);
      if (receipt.current?.fingerprint !== fingerprint)
        receipt.current = { fingerprint, key: crypto.randomUUID() };
      await connectionsApi.respond(item.id, input, receipt.current.key);
      onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap justify-between gap-2">
        <h3 className="font-bold">{item.title}</h3>
        <span className="rounded-lg bg-muted px-2 py-1 text-xs">
          {HR_CONNECTION_STATUS_LABELS[item.status]}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {item.code} · {titleOf(item.target)}
        {item.employeeLabel ? ` · ${item.employeeLabel}` : ''}
      </p>
      <p className="my-3 whitespace-pre-wrap break-words text-sm leading-7">
        {item.message}
      </p>
      <div className="flex flex-wrap gap-4 text-xs">
        <span>مهلت: {dateLabel(item.dueAt)}</span>
        <span>
          مبنا: {item.sourceCode} · نسخه {item.sourceVersion}
        </span>
        {item.sourceHref ? (
          <Link className="underline" href={item.sourceHref}>
            مشاهده پرونده مبنا
          </Link>
        ) : null}
        <Link className="underline" href={`/${item.target}?hrConnections=1`}>
          بخش مقصد
        </Link>
      </div>
      {item.response ? (
        <p className="mt-3 whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">
          آخرین پاسخ: {item.response}
        </p>
      ) : null}
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer">سابقه رسیدگی</summary>
        <ol className="mt-2 space-y-2">
          {item.history.map((entry, index) => (
            <li key={index}>
              {dateLabel(entry.occurredAt)} ·{' '}
              {HR_CONNECTION_STATUS_LABELS[entry.status]}
              <p className="whitespace-pre-wrap">{entry.note}</p>
            </li>
          ))}
        </ol>
      </details>
      {item.canRespond || item.canCancel ? (
        <div className="mt-4 space-y-2">
          <label className="text-sm">
            توضیح رسیدگی
            <Textarea
              disabled={busy}
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {item.canRespond ? (
              <>
                <Button
                  disabled={busy}
                  onClick={() =>
                    void respond(
                      item.status === 'SUBMITTED' ? 'IN_REVIEW' : 'ANSWERED',
                    )
                  }
                >
                  {item.status === 'SUBMITTED' ? 'شروع رسیدگی' : 'ثبت پاسخ'}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void respond('REJECTED')}
                >
                  رد با توضیح
                </Button>
              </>
            ) : null}
            {item.canCancel ? (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void respond('CANCELLED')}
              >
                لغو درخواست
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </article>
  );
}
