'use client';
import { DatePicker } from '@/components/ui/date-picker';
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Headset, Plus, RotateCcw, Search, Eye, X } from 'lucide-react';
import { useAccessActor } from '@/modules/iam/access-context';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import {
  callDate,
  faNumber,
  sources,
  operators,
  type Call,
  type CallEvent,
} from './model';
import { callCenterApi, CallCenterHttpError, type CallNote } from './client';
import {
  readApi,
  emptySearch,
  type SearchFilters,
  type SearchPage,
  type ContactSummary,
  type Report,
} from './read-client';
import { workflowApi, type Operator } from './workflow-client';
import {
  WorkQueue,
  WorkflowPanel,
  requestLabels,
  taskLabels,
} from './workflow';
import { CallForm } from './call-form';
import { useUnsavedGuard } from './use-unsaved-guard';
import styles from './workspace.module.css';
const outcomes: Record<string, string> = {
  ANSWERED: 'گفت‌وگو انجام شد',
  NO_ANSWER: 'بدون پاسخ',
  BUSY: 'اشغال',
  FAILED: 'ناموفق',
  UNKNOWN: 'نامشخص',
};
const reasonText = (e: unknown) =>
  e instanceof Error ? e.message : 'دریافت اطلاعات انجام نشد.';
function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <label className={styles.filterSelect}>
      <span>{label}</span>
      <NativeSearchSelect
        className={styles.control}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">همه موارد</option>
        {options.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </NativeSearchSelect>
    </label>
  );
}
export function CallCenterWorkspace() {
  const actor = useAccessActor();
  const [chosen, setChosen] = useState('');
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    let active = true;
    if (actor?.branchIds[0])
      readApi
        .branches(actor.branchIds[0])
        .then((r) => {
          if (active) setBranches(r.data);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [actor]);
  const [hasDraft, setHasDraft] = useState(false);
  if (!actor) return <p role="status">در حال دریافت دسترسی کال سنتر…</p>;
  if (!actor.permissions.includes('customer_affairs.call_center.read'))
    return <p role="alert">دسترسی مشاهده کال سنتر ندارید.</p>;
  const branch = actor.branchIds.includes(chosen) ? chosen : actor.branchIds[0];
  if (!branch) return <p role="alert">شعبه مجازی در دسترس نیست.</p>;
  return (
    <>
      <Content
        key={`${actor.userId}:${branch}:${actor.permissions.join(',')}`}
        branch={branch}
        branchControl={
          <label>
            شعبه مجاز
            <NativeSearchSelect
              aria-label="شعبه مجاز کال سنتر"
              value={branch}
              onChange={(e) => {
                if (
                  !hasDraft ||
                  window.confirm(
                    'یادداشت ذخیره‌نشده با تغییر شعبه کنار گذاشته شود؟',
                  )
                )
                  setChosen(e.target.value);
              }}
            >
              {actor.branchIds.map((id, index) => (
                <option key={id} value={id}>
                  {branches.find((b) => b.id === id)?.name ??
                    'شعبه ' + faNumber(index + 1)}
                </option>
              ))}
            </NativeSearchSelect>
          </label>
        }
        onDirty={setHasDraft}
        actorId={actor.userId}
        permissions={actor.permissions}
      />
    </>
  );
}
function Content({
  onDirty,
  branchControl,
  branch,
  actorId,
  permissions,
}: {
  branch: string;
  branchControl: ReactNode;
  actorId: string;
  permissions: readonly string[];
  onDirty: (value: boolean) => void;
}) {
  const [filters, setFilters] = useState<SearchFilters>(emptySearch),
    [page, setPage] = useState(1),
    [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<SearchPage | null>(null),
    [report, setReport] = useState<Report | null>(null),
    [agents, setAgents] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [reportError, setReportError] = useState(''),
    [message, setMessage] = useState('');
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  useUnsavedGuard(Object.values(noteDrafts).some((v) => !!v.trim()));
  useEffect(
    () => onDirty(Object.values(noteDrafts).some((v) => !!v.trim())),
    [noteDrafts, onDirty],
  );
  const [selected, setSelected] = useState<ContactSummary | null>(null),
    [draft, setDraft] = useState<CallEvent | null>(null),
    [busy, setBusy] = useState(false);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    let active = true;
    readApi
      .teams(branch)
      .then((r) => {
        if (active) setTeams(r.units);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [branch]);
  const revision = useRef<string | undefined>(undefined);
  const canManage = permissions.includes(
      'customer_affairs.call_center.workflow.manage',
    ),
    canCreate = permissions.includes(
      'customer_affairs.call_center.calls.create',
    );
  useEffect(() => {
    let alive = true;
    workflowApi
      .operators(branch)
      .then((r) => {
        if (alive) setAgents(r.data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [branch]);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      readApi
        .search(branch, filters, page, revision.current, controller.signal)
        .then((r) => {
          if (controller.signal.aborted) return;
          revision.current = r.meta.revision;
          setResult(r);
          setLoading(false);
          setError('');
        })
        .catch((e) => {
          if (!controller.signal.aborted) {
            setLoading(false);
            setError(reasonText(e));
            if (
              e instanceof CallCenterHttpError &&
              [401, 403].includes(e.status)
            ) {
              setResult(null);
              setReport(null);
              setSelected(null);
            }
          }
        });
    }, 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [branch, filters, page, refresh]);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      readApi
        .report(branch, filters, controller.signal)
        .then((r) => {
          if (!controller.signal.aborted) {
            setReport(r);
            setReportError('');
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted) setReportError(reasonText(e));
        });
    }, 300);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [branch, filters, refresh]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 5000);
    return () => clearTimeout(timer);
  }, [message]);
  function change(key: keyof SearchFilters, value: string) {
    setLoading(true);
    setError('');
    setReport(null);
    revision.current = undefined;
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  }
  function reload() {
    setLoading(true);
    setError('');
    setPage(1);
    revision.current = undefined;
    setRefresh((v) => v + 1);
  }
  function open(phone = '', direction: CallEvent['direction'] = 'INBOUND') {
    setDraft({
      id: crypto.randomUUID(),
      phone,
      direction,
      occurredAt: new Date().toISOString(),
      recordings: [],
    });
  }
  async function save(call: Call) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await callCenterApi.create(branch, call);
      setDraft(null);
      setMessage(
        'تماس ذخیره شد؛ برای نمایش ترتیب جدید فهرست را تازه‌سازی کنید.',
      );
      if (selected && selected.id === r.data.contactId)
        setSelected({ ...selected, latest: r.data });
    } finally {
      setBusy(false);
    }
  }
  const pageCount = Math.max(1, Math.ceil((result?.meta.total ?? 0) / 20));
  return (
    <section dir="rtl" className={styles.workspace}>
      <header className={styles.header}>
        <div>
          <h1>
            <Headset /> کال سنتر
          </h1>
          <p>مدیریت تماس‌ها، درخواست‌ها و پیگیری‌های مشتری</p>
        </div>
        <button
          className={styles.primary}
          data-cc-focus-anchor
          disabled={!canCreate}
          onClick={() => open()}
        >
          <Plus size={18} /> ثبت تماس جدید
        </button>
      </header>
      <WorkQueue branchId={branch} actorId={actorId} canManage={canManage} />
      <div className={styles.filters}>
        {branchControl}
        <label className={styles.search}>
          <Search size={18} />
          <input
            type="search"
            aria-label="جست‌وجوی سروری"
            autoComplete="off"
            maxLength={120}
            placeholder="شماره کامل یا کلمه کامل نام و موضوع"
            value={filters.query}
            onChange={(e) => change('query', e.target.value)}
          />
        </label>
        <Select
          label="دامنه تماس"
          value={filters.scope}
          onChange={(v) => change('scope', v || 'LATEST')}
          options={[
            ['LATEST', 'آخرین تماس'],
            ['ANY', 'همه تاریخچه'],
          ]}
        />
        <Select
          label="جهت تماس"
          value={filters.direction}
          onChange={(v) => change('direction', v)}
          options={[
            ['INBOUND', 'ورودی'],
            ['OUTBOUND', 'خروجی'],
          ]}
        />
        <Select
          label="نتیجه تماس"
          value={filters.outcome}
          onChange={(v) => change('outcome', v)}
          options={Object.entries(outcomes)}
        />
        <Select
          label="منبع آشنایی"
          value={filters.source}
          onChange={(v) => change('source', v)}
          options={sources.map((v) => [v, v])}
        />
        <Select
          label="واحد ثبت‌شده تماس"
          value={filters.unit}
          onChange={(v) => change('unit', v)}
          options={operators.map((v) => [v, v])}
        />
        <Select
          label="تیم فعلی ثبت‌کننده"
          value={filters.teamId}
          onChange={(v) => change('teamId', v)}
          options={teams.map((t) => [t.id, t.name])}
        />
        <Select
          label="کارشناس ثبت‌کننده"
          value={filters.agentId}
          onChange={(v) => change('agentId', v)}
          options={agents.map((a) => [a.id, a.displayName])}
        />
        <Select
          label="وضعیت درخواست"
          value={filters.requestStatus}
          onChange={(v) => change('requestStatus', v)}
          options={Object.entries(requestLabels)}
        />
        <Select
          label="پیگیری مخاطب"
          value={filters.followUp}
          onChange={(v) => change('followUp', v)}
          options={[
            ...Object.entries(taskLabels),
            ['TODAY', 'موعد امروز'],
            ['OVERDUE', 'عقب‌افتاده'],
          ]}
        />
        <Select
          label="روش ثبت"
          value={filters.origin}
          onChange={(v) => change('origin', v)}
          options={[
            ['MANUAL', 'دستی'],
            ['TELEPHONY', 'تلفنی'],
            ['UNKNOWN', 'نامشخص'],
          ]}
        />
        <Select
          label="تکمیل اطلاعات"
          value={filters.incomplete}
          onChange={(v) => change('incomplete', v)}
          options={[
            ['YES', 'نیازمند تکمیل'],
            ['NO', 'تکمیل‌شده'],
          ]}
        />
        <label>
          از تاریخ میلادی (تهران)
          <DatePicker
            calendarSystem="gregorian"
            aria-label="از تاریخ میلادی (تهران)"
            value={filters.from}
            onChange={(value) => change('from', value)}
          />
        </label>
        <label>
          تا ابتدای تاریخ میلادی (تهران)
          <DatePicker
            calendarSystem="gregorian"
            aria-label="تا ابتدای تاریخ میلادی (تهران)"
            value={filters.to}
            onChange={(value) => change('to', value)}
          />
        </label>
        <button
          className={styles.clear}
          onClick={() => {
            setFilters(emptySearch);
            setReport(null);
            reload();
          }}
        >
          <RotateCcw size={16} /> پاک کردن فیلترها
        </button>
      </div>
      <p className={styles.formHint}>
        جست‌وجو روی کل داده مجاز است؛ کلمه کامل نام و موضوع، یا شماره کامل.
        فیلترهای تماس روی{' '}
        {filters.scope === 'ANY' ? 'یک تماس در کل تاریخچه' : 'آخرین تماس'} و
        فیلتر درخواست و پیگیری روی مخاطب اعمال می‌شوند. شماره مشترک به معنی یک
        شخص نیست.
      </p>
      <div className={styles.personTags} aria-label="فیلترهای اعمال‌شده">
        {Object.entries(filters)
          .filter(([k, v]) => v && k !== 'scope')
          .map(([k, v]) => (
            <button
              key={k}
              type="button"
              onClick={() => change(k as keyof SearchFilters, '')}
              aria-label={`حذف فیلتر ${k}`}
            >
              {v} ×
            </button>
          ))}
      </div>
      <p role="status">{message}</p>
      {error && (
        <p role="alert" className={styles.error}>
          {error} <button onClick={reload}>تازه‌سازی و تلاش مجدد</button>
        </p>
      )}
      <div className={styles.panelHeading}>
        <p>
          {result
            ? `${faNumber(result.meta.total)} مخاطب · زمان دریافت ${callDate(result.meta.asOf)}`
            : 'هنوز داده‌ای دریافت نشده است.'}
        </p>
        <button className={styles.clear} onClick={reload}>
          <RotateCcw size={16} /> تازه‌سازی فهرست
        </button>
      </div>
      {loading && <p role="status">در حال دریافت فهرست…</p>}
      <div className={styles.content} data-history={!!selected}>
        <div className={styles.main}>
          <section className={styles.panel} aria-busy={loading}>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {[
                      'نام مخاطب',
                      'شماره تماس',
                      'موضوع آخرین تماس',
                      'منبع',
                      'واحد',
                      'آخرین تماس',
                      'تعداد تماس',
                      'نتیجه',
                      'جزئیات',
                    ].map((t) => (
                      <th key={t}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result?.data.map((row) => (
                    <tr key={row.id} data-selected={selected?.id === row.id}>
                      <td>{row.latest.name || 'مخاطب ناشناس'}</td>
                      <td dir="ltr">{row.latest.phone || 'شماره نامعلوم'}</td>
                      <td className={styles.subject} title={row.latest.subject}>
                        {row.latest.subject}
                      </td>
                      <td>{row.latest.source}</td>
                      <td>{row.latest.operator}</td>
                      <td>{callDate(row.latest.occurredAt)}</td>
                      <td>{faNumber(row.callCount)}</td>
                      <td>{outcomes[row.latest.outcome ?? 'UNKNOWN']}</td>
                      <td>
                        <button
                          className={styles.view}
                          disabled={loading || !!error}
                          onClick={() => setSelected(row)}
                          aria-label={`مشاهده تاریخچه ${row.latest.name || 'مخاطب ناشناس'}`}
                        >
                          <Eye size={14} /> مشاهده
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loading && !error && !result?.data.length && (
              <div className={styles.empty}>
                <strong>مخاطبی برای نمایش وجود ندارد.</strong>
                <p>فیلترها را بررسی کنید یا تماس جدید ثبت کنید.</p>
              </div>
            )}
            <nav className={styles.pagination} aria-label="صفحه‌بندی مخاطبان">
              <button
                disabled={loading || page <= 1 || !!error}
                onClick={() => {
                  setLoading(true);
                  setPage((v) => v - 1);
                }}
              >
                قبلی
              </button>
              <span>
                {faNumber(page)} / {faNumber(pageCount)}
              </span>
              <button
                disabled={loading || page >= pageCount || !!error}
                onClick={() => {
                  setLoading(true);
                  setPage((v) => v + 1);
                }}
              >
                بعدی
              </button>
            </nav>
          </section>
          <ReportPanel report={report} error={reportError} />
        </div>
        {selected && (
          <aside className={`${styles.panel} ${styles.history}`}>
            <header className={styles.panelHeading}>
              <h2>سابقه مخاطب</h2>
              <button
                className={styles.iconButton}
                aria-label="بستن جزئیات"
                onClick={() => setSelected(null)}
              >
                <X size={18} />
              </button>
            </header>
            <h3>{selected.latest.name || 'مخاطب ناشناس'}</h3>
            <p dir="ltr">{selected.latest.phone || 'شماره نامعلوم'}</p>
            <button
              className={styles.followUp}
              data-cc-focus-anchor
              disabled={!canCreate}
              onClick={() => open(selected.latest.phone, 'OUTBOUND')}
            >
              ثبت تماس پیگیری
            </button>
            <History
              key={`${selected.id}:${selected.latest.id}`}
              branch={branch}
              contact={selected}
              text={noteDrafts[selected.id] ?? ''}
              onNoteSaved={(value) =>
                setNoteDrafts((previous) =>
                  previous[selected.id]?.trim() === value
                    ? { ...previous, [selected.id]: '' }
                    : previous,
                )
              }
              setText={(value) =>
                setNoteDrafts((previous) => ({
                  ...previous,
                  [selected.id]: value,
                }))
              }
              actorId={actorId}
              permissions={permissions}
            />
          </aside>
        )}
      </div>
      {draft && (
        <CallForm
          branchId={branch}
          event={draft}
          previous={
            selected?.latest.phone === draft.phone
              ? { ...selected.latest, note: '', recordings: [] }
              : undefined
          }
          onSave={save}
          onClose={() => setDraft(null)}
          busy={busy}
        />
      )}
    </section>
  );
}
function ReportPanel({
  report,
  error,
}: {
  report: Report | null;
  error: string;
}) {
  if (error) return <p role="alert">گزارش در دسترس نیست: {error}</p>;
  if (!report) return <p role="status">در حال محاسبه گزارش…</p>;
  const { data: r, meta } = report;
  return (
    <section className={styles.panel}>
      <h2>گزارش داده ثبت‌شده</h2>
      <p>
        گزارش تماس‌ها همیشه تمام تماس‌های منطبق با فیلتر و بازه را می‌شمارد؛
        گزینه آخرین تماس فقط برای فهرست مخاطبان است.
      </p>
      <p>
        {callDate(meta.from)} تا {callDate(meta.to)} · تهران · زمان تماس، پایان
        بازه غیرشامل
      </p>
      <div className={styles.stats}>
        {[
          ['تماس', r.calls],
          ['مخاطب تلفنی یکتا', r.contacts],
          ['نیازمند تکمیل', r.incomplete],
        ].map(([label, value]) => (
          <article className={styles.stat} key={label}>
            <span>{label}</span>
            <strong>{faNumber(Number(value))}</strong>
          </article>
        ))}
      </div>
      {r.unindexed > 0 && (
        <p role="alert">
          پوشش شاخص اطلاعات ناقص است؛ آمار تکمیل اطلاعات قطعی نیست.
        </p>
      )}
      <div className={styles.reports}>
        <div>
          <h3>جهت، نتیجه و روش ثبت تماس</h3>
          <table className={styles.table}>
            <tbody>
              {r.groups.map((g, i) => (
                <tr key={i}>
                  <td>{g.direction === 'INBOUND' ? 'ورودی' : 'خروجی'}</td>
                  <td>{outcomes[g.outcome ?? 'UNKNOWN']}</td>
                  <td>
                    {g.origin === 'MANUAL' ? 'دستی' : (g.origin ?? 'نامشخص')}
                  </td>
                  <td>{faNumber(g.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3>منابع تماس‌ها</h3>
          {r.sources.map((s, i) => (
            <p key={i}>
              {s.label}: {faNumber(s.count)}
            </p>
          ))}
        </div>
        <div>
          <h3>درخواست‌های ایجادشده در بازه</h3>
          <p>کل شعبه؛ وضعیت فعلی، مستقل از فیلتر تماس</p>
          {r.requests.map((s) => (
            <p key={s.status}>
              {requestLabels[s.status] ?? s.status}: {faNumber(s.count)}
            </p>
          ))}
        </div>
      </div>
      <h3>پیگیری‌های شعبه</h3>
      <p>
        باز، امروز و عقب‌افتاده: موجودی فعلی کل شعبه؛ انجام‌شده: تاریخ انجام در
        بازه گزارش.
      </p>
      <p>
        باز: {faNumber(r.tasks.open)} · امروز: {faNumber(r.tasks.today)} ·
        عقب‌افتاده: {faNumber(r.tasks.overdue)} · انجام‌شده:{' '}
        {faNumber(r.tasks.completed)}
      </p>
      <p>
        نرخ انجام به‌موقع:{' '}
        {r.tasks.onTimeRate === null
          ? 'قابل محاسبه نیست؛ پیگیری انجام‌شده‌ای در بازه وجود ندارد.'
          : `${faNumber(Math.round(r.tasks.onTimeRate * 100))}٪ (${faNumber(r.tasks.onTime)} از ${faNumber(r.tasks.completed)})`}
      </p>
      <details>
        <summary>فعالیت ثبت‌کنندگان واقعی تماس</summary>
        {r.tasks.activity?.map((a, i) => (
          <p key={i}>
            {a.role === 'CURRENT_OWNER'
              ? 'مسئول فعلی اقدام باز'
              : 'انجام‌دهنده ثبت‌شده اقدام'}{' '}
            · <bdi>{a.actorId ?? 'نامشخص'}</bdi>: {faNumber(a.count)}
          </p>
        ))}
        {r.registrations.map((a) => (
          <p key={a.actorId}>
            <bdi>{a.actorId}</bdi>: {faNumber(a.count)}
          </p>
        ))}
      </details>
      <p>
        مخاطب یکتا = گروه شماره در شعبه؛ هر تماس با شماره نامعلوم جداست. زمان
        انتظار، مدت مکالمه و تبدیل فروش هنوز داده معتبر ندارند.
      </p>
    </section>
  );
}
function History({
  branch,
  contact,
  actorId,
  permissions,
  text,
  setText,
  onNoteSaved,
}: {
  branch: string;
  contact: ContactSummary;
  actorId: string;
  permissions: readonly string[];
  text: string;
  setText: (value: string) => void;
  onNoteSaved: (value: string) => void;
}) {
  const [calls, setCalls] = useState<Call[]>([]),
    [notes, setNotes] = useState<CallNote[]>([]),
    [callAfter, setCallAfter] = useState<string | undefined>(),
    [noteAfter, setNoteAfter] = useState<string | undefined>();
  const [callNext, setCallNext] = useState<string | null>(null),
    [noteNext, setNoteNext] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [notesLoading, setNotesLoading] = useState(true),
    [error, setError] = useState(''),
    [noteError, setNoteError] = useState(''),
    [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false),
    [saved, setSaved] = useState('');
  const pending = useRef<{ text: string; id: string } | null>(null);

  useEffect(() => {
    const c = new AbortController();
    readApi
      .calls(branch, contact.id, callAfter, c.signal)
      .then((r) => {
        if (c.signal.aborted) return;
        setCalls(r.data);
        setCallNext(r.meta.next);
        setLoading(false);
        setError('');
      })
      .catch((e) => {
        if (!c.signal.aborted) {
          setError(reasonText(e));
          setLoading(false);
        }
      });
    return () => c.abort();
  }, [branch, contact.id, callAfter, retry]);
  useEffect(() => {
    const c = new AbortController();
    readApi
      .notes(branch, contact.id, noteAfter, c.signal)
      .then((r) => {
        if (c.signal.aborted) return;
        setNotes(r.data);
        setNoteNext(r.meta.next);
        setNotesLoading(false);
        setNoteError('');
      })
      .catch((e) => {
        if (!c.signal.aborted) {
          setNoteError(reasonText(e));
          setNotesLoading(false);
        }
      });
    return () => c.abort();
  }, [branch, contact.id, noteAfter, retry]);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy || !text.trim()) return;
    setBusy(true);
    const value = text.trim();
    if (pending.current?.text !== value)
      pending.current = { text: value, id: crypto.randomUUID() };
    try {
      await callCenterApi.note(branch, contact.id, pending.current.id, value);
      onNoteSaved(value);
      setSaved('یادداشت ذخیره شد.');
      setNoteAfter(undefined);
      setRetry((v) => v + 1);
      pending.current = null;
    } catch (e) {
      setNoteError(reasonText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <h3>تماس‌ها</h3>
      {loading && <p role="status">در حال دریافت تماس‌ها…</p>}
      {error && (
        <p role="alert">
          {error}
          <button
            onClick={() => {
              setLoading(true);
              setRetry((v) => v + 1);
            }}
          >
            تلاش مجدد
          </button>
        </p>
      )}
      <ol className={styles.timeline}>
        {calls.map((c) => (
          <li key={c.id}>
            <h3>{c.subject}</h3>
            <time dateTime={c.occurredAt}>{callDate(c.occurredAt)}</time>
            <p>
              {c.direction === 'INBOUND' ? 'ورودی' : 'خروجی'} ·{' '}
              {outcomes[c.outcome ?? 'UNKNOWN']}
            </p>
            <details>
              <summary>شرح تماس و اطلاعات ثبت</summary>
              <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {c.note || 'بدون شرح'}
              </p>
              <p>زمان ثبت: {c.createdAt ? callDate(c.createdAt) : 'نامشخص'}</p>
            </details>
          </li>
        ))}
      </ol>
      <div className={styles.pagination}>
        <button
          disabled={!callAfter || loading}
          onClick={() => {
            setLoading(true);
            setCallAfter(undefined);
          }}
        >
          جدیدترین تماس‌ها
        </button>
        <button
          disabled={!callNext || loading}
          onClick={() => {
            setLoading(true);
            setCallAfter(callNext!);
          }}
        >
          تماس‌های قدیمی‌تر
        </button>
      </div>
      <h3>یادداشت‌ها</h3>
      {notesLoading && <p role="status">در حال دریافت یادداشت‌ها…</p>}
      {noteError && (
        <p role="alert">
          {noteError}
          <button
            onClick={() => {
              setNotesLoading(true);
              setRetry((v) => v + 1);
            }}
          >
            تلاش مجدد
          </button>
        </p>
      )}
      {notes.map((n) => (
        <details key={n.id}>
          <summary>{callDate(n.at)}</summary>
          <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {n.text}
          </p>
        </details>
      ))}
      <div className={styles.pagination}>
        <button
          disabled={!noteAfter || notesLoading}
          onClick={() => {
            setNotesLoading(true);
            setNoteAfter(undefined);
          }}
        >
          یادداشت‌های جدید
        </button>
        <button
          disabled={!noteNext || notesLoading}
          onClick={() => {
            setNotesLoading(true);
            setNoteAfter(noteNext!);
          }}
        >
          یادداشت‌های قدیمی‌تر
        </button>
      </div>
      <form className={styles.note} onSubmit={save}>
        <label htmlFor="cc-note">یادداشت جدید</label>
        <textarea
          id="cc-note"
          maxLength={2000}
          value={text}
          disabled={
            busy ||
            !permissions.includes('customer_affairs.call_center.notes.create')
          }
          onChange={(e) => setText(e.target.value)}
        />
        <button
          className={styles.primary}
          disabled={
            busy ||
            !text.trim() ||
            !permissions.includes('customer_affairs.call_center.notes.create')
          }
        >
          ثبت یادداشت
        </button>
        <p role="status">{saved}</p>
      </form>
      <WorkflowPanel
        branchId={branch}
        contactId={contact.id}
        actorId={actorId}
        canManage={permissions.includes(
          'customer_affairs.call_center.workflow.manage',
        )}
        calls={calls}
        onLinked={(id, ticketId) =>
          setCalls((items) =>
            items.map((c) => (c.id === id ? { ...c, ticketId } : c)),
          )
        }
      />
    </>
  );
}
