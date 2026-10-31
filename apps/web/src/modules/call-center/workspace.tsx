'use client';
import { ScrollContinuation } from './scroll-continuation';
import { RecordingDownload } from './recording-download';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/overlays';
import { useDialogReturnFocus } from './use-dialog-focus';
import { DatePicker } from '@/components/ui/date-picker';
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  Headset,
  Plus,
  RotateCcw,
  Search,
  Eye,
  X,
  SlidersHorizontal,
  Users,
  BarChart3,
  Phone,
  FileText,
  PhoneIncoming,
  PhoneOutgoing,
} from 'lucide-react';
import { useAccessActor } from '@/modules/iam/access-context';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import {
  callDate,
  faNumber,
  sources,
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
  requestStatusOptions,
  taskLabels,
} from './workflow';
import { HostedCallForm } from './call-form-host';
import { WithoutOutcomeDialog } from './without-outcome-dialog';
import { useUnsavedGuard } from './use-unsaved-guard';
import styles from './workspace.module.css';
import { ReportHighlights } from './report-highlights';
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
        optionLimit={Math.max(50, options.length + 1)}
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
  if (!actor) return <p role="status">در حال دریافت دسترسی کال سنتر…</p>;
  if (!actor.permissions.includes('customer_affairs.call_center.read'))
    return <p role="alert">دسترسی مشاهده کال سنتر ندارید.</p>;
  const branch = actor.branchIds[0];
  if (!branch) return <p role="alert">شعبه مجازی در دسترس نیست.</p>;
  return (
    <>
      <Content
        key={`${actor.userId}:${branch}:${actor.permissions.join(',')}`}
        branch={branch}
        actorId={actor.userId}
        permissions={actor.permissions}
      />
    </>
  );
}
function Content({
  branch,
  actorId,
  permissions,
}: {
  branch: string;
  actorId: string;
  permissions: readonly string[];
}) {
  const [destinations, setDestinations] = useState<string[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    callCenterApi
      .destinations(branch, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted)
          setDestinations([...new Set(result.data.map((row) => row.label))]);
      })
      .catch(() => {
        if (!controller.signal.aborted) setDestinations([]);
      });
    return () => controller.abort();
  }, [branch]);
  const [advanced, setAdvanced] = useState(false);
  const [completionPrevious, setCompletionPrevious] = useState<Call | null>(
    null,
  );
  const [historyRevision, setHistoryRevision] = useState(0);
  const searchInput = useRef<HTMLInputElement>(null);
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
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [withoutOutcomeOpen, setWithoutOutcomeOpen] = useState(false);
  const [periodOpen, setPeriodOpen] = useState<'today' | 'week' | null>(null);
  const [callbacksOpen, setCallbacksOpen] = useState(false);
  const [selected, setSelected] = useState<ContactSummary | null>(null),
    [draft, setDraft] = useState<CallEvent | null>(null),
    [busy, setBusy] = useState(false);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    const refreshOutbound = () => {
      if (page === 1) setRefresh((value) => value + 1);
      else setMessage('تماس خروجی جدید ثبت شد؛ فهرست را تازه‌سازی کنید.');
    };
    window.addEventListener('call-center:outbound-received', refreshOutbound);
    return () =>
      window.removeEventListener(
        'call-center:outbound-received',
        refreshOutbound,
      );
  }, [page]);

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
    setCompletionPrevious(null);
    setDraft({
      id: crypto.randomUUID(),
      phone,
      direction,
      occurredAt: new Date().toISOString(),
      recordings: [],
    });
  }
  async function complete(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      const { data } = await callCenterApi.get(branch, id);
      setCompletionPrevious(data);
      setDraft(data);
    } catch (e) {
      setMessage(reasonText(e));
    } finally {
      setBusy(false);
    }
  }
  async function save(call: Call) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await callCenterApi.create(branch, call);
      setHistoryRevision((v) => v + 1);
      setRefresh((v) => v + 1);
      setDraft(null);
      setMessage(
        'تماس ذخیره شد؛ برای نمایش ترتیب جدید فهرست را تازه‌سازی کنید.',
      );
      if (
        selected &&
        selected.id === r.data.contactId &&
        (!call.completionToken || selected.latest.id === r.data.id)
      )
        setSelected({ ...selected, latest: r.data });
    } finally {
      setBusy(false);
    }
  }
  const filterNames: Partial<Record<keyof SearchFilters, string>> = {
    query: 'جست‌وجو',
    direction: 'جهت تماس',
    outcome: 'نتیجه تماس',
    source: 'منبع',
    unit: 'واحد',
    teamId: 'تیم',
    agentId: 'کارشناس',
    requestStatus: 'وضعیت درخواست',
    followUp: 'پیگیری',
    origin: 'روش ثبت',
    incomplete: 'تکمیل اطلاعات',
    from: 'از تاریخ',
    to: 'تا ابتدای تاریخ',
  };
  const filterValue = (key: string, value: string) =>
    key === 'agentId'
      ? (agents.find((a) => a.id === value)?.displayName ??
        'کارشناس انتخاب‌شده')
      : key === 'teamId'
        ? (teams.find((t) => t.id === value)?.name ?? 'تیم انتخاب‌شده')
        : ((
            {
              ...outcomes,
              ...requestLabels,
              ...taskLabels,
              INBOUND: 'ورودی',
              OUTBOUND: 'خروجی',
              MANUAL: 'دستی',
              TELEPHONY: 'تلفنی',
              TODAY: 'موعد امروز',
              OVERDUE: 'عقب‌افتاده',
              YES: 'نیازمند تکمیل',
              NO: 'تکمیل‌شده',
            } as Record<string, string>
          )[value] ?? value);
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
      <WorkQueue
        onWithoutOutcome={() => setWithoutOutcomeOpen(true)}
        onMissedCallbacks={() => setCallbacksOpen(true)}
        onPeriod={setPeriodOpen}
        branchId={branch}
        actorId={actorId}
        canManage={canManage}
        refreshKey={refresh}
      />
      <section className={styles.filterPanel} aria-label="جست‌وجو و فیلترها">
        <div className={styles.filters}>
          <div className={styles.searchField}>
            <span>جست‌وجوی مخاطب</span>{' '}
            <label className={styles.search}>
              <Search size={18} />
              <input
                ref={searchInput}
                type="search"
                aria-label="جست‌وجوی سروری"
                autoComplete="off"
                maxLength={120}
                placeholder="شماره کامل یا کلمه کامل نام و موضوع"
                value={filters.query}
                onChange={(e) => change('query', e.target.value)}
              />
            </label>
          </div>
          <button
            className={styles.clear}
            aria-expanded={advanced}
            aria-controls="cc-advanced"
            onClick={() => setAdvanced((v) => !v)}
          >
            <SlidersHorizontal size={16} />
            {advanced ? 'بستن فیلترها' : 'فیلترهای پیشرفته'}
            {Object.entries(filters).filter(
              ([key, value]) => value && !['query', 'scope'].includes(key),
            ).length > 0 &&
              ` · ${faNumber(Object.entries(filters).filter(([key, value]) => value && !['query', 'scope'].includes(key)).length)}`}
          </button>
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
        <div id="cc-advanced" hidden={!advanced}>
          <div className={styles.filterGroups}>
            <fieldset>
              <legend>محدوده و زمان</legend>{' '}
              <label>
                از تاریخ (تهران)
                <DatePicker
                  filterCalendar
                  defaultCalendarSystem="persian"
                  aria-label="از تاریخ (تهران)"
                  value={filters.from}
                  onChange={(value) => change('from', value)}
                />
              </label>
              <label>
                تا ابتدای تاریخ (تهران)
                <DatePicker
                  filterCalendar
                  defaultCalendarSystem="persian"
                  aria-label="تا ابتدای تاریخ (تهران)"
                  value={filters.to}
                  onChange={(value) => change('to', value)}
                />
              </label>
            </fieldset>
            <fieldset>
              <legend>مشخصات تماس</legend>{' '}
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
                options={['نامشخص', ...destinations].map((v) => [v, v])}
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
            </fieldset>
            <fieldset>
              <legend>مسئولیت و پیگیری</legend>{' '}
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
                options={Object.entries(requestStatusOptions)}
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
            </fieldset>
          </div>
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
                aria-label={`حذف فیلتر ${filterNames[k as keyof SearchFilters] ?? k}`}
              >
                {filterNames[k as keyof SearchFilters]}: {filterValue(k, v)}{' '}
                <X size={12} />
              </button>
            ))}
        </div>
      </section>
      {message && (
        <p role="status" className={styles.feedback}>
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error} <button onClick={reload}>تازه‌سازی و تلاش مجدد</button>
        </p>
      )}
      {loading && <p role="status">در حال دریافت فهرست…</p>}
      <div className={styles.content} data-history={!!selected}>
        <div className={styles.main}>
          <section className={styles.panel} aria-busy={loading}>
            <div className={styles.panelHeading}>
              <h2>
                <Users size={19} /> فهرست مخاطبان
              </h2>
              <p>
                {result
                  ? `${faNumber(result.meta.total)} مخاطب · زمان دریافت ${callDate(result.meta.asOf)}`
                  : 'هنوز داده‌ای دریافت نشده است.'}
              </p>
              <button className={styles.clear} onClick={reload}>
                <RotateCcw size={16} /> تازه‌سازی فهرست
              </button>
            </div>

            <div className={styles.tableScroll}>
              <table
                className={`${styles.table} ${styles.contactTable} ${styles.centeredTable}`}
              >
                <thead>
                  <tr>
                    {[
                      'نام مخاطب',
                      'شماره تماس',
                      'موضوع آخرین تماس',
                      'نوع آخرین تماس',
                      'منبع آشنایی',
                      'وصل شده به',
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
                    <tr
                      key={row.id}
                      data-selected={selected?.id === row.id}
                      onClick={() => {
                        if (
                          !loading &&
                          !error &&
                          canCreate &&
                          canManage &&
                          !busy &&
                          row.latest.origin !== 'SYNTHETIC'
                        )
                          void complete(row.latest.id);
                      }}
                      tabIndex={
                        canCreate &&
                        canManage &&
                        !loading &&
                        !error &&
                        !busy &&
                        row.latest.origin !== 'SYNTHETIC'
                          ? 0
                          : undefined
                      }
                      onKeyDown={(event) => {
                        if (
                          event.target === event.currentTarget &&
                          (event.key === 'Enter' || event.key === ' ') &&
                          canCreate &&
                          canManage &&
                          !loading &&
                          !error &&
                          !busy &&
                          row.latest.origin !== 'SYNTHETIC'
                        ) {
                          event.preventDefault();
                          void complete(row.latest.id);
                        }
                      }}
                      style={{
                        cursor: canCreate && canManage ? 'pointer' : undefined,
                      }}
                    >
                      <td data-label="نام مخاطب">
                        {row.latest.name || 'مخاطب ناشناس'}
                      </td>
                      <td data-label="شماره تماس" dir="ltr">
                        {row.latest.phone || 'شماره نامعلوم'}
                      </td>
                      <td
                        data-label="موضوع آخرین تماس"
                        className={styles.subject}
                        title={row.latest.subject}
                      >
                        {row.latest.subject}
                      </td>
                      <td data-label="نوع آخرین تماس">
                        <span
                          className={styles.badge}
                          data-direction={row.latest.direction}
                        >
                          {row.latest.direction === 'INBOUND'
                            ? 'ورودی'
                            : 'خروجی'}
                        </span>
                      </td>
                      <td data-label="منبع آشنایی">{row.latest.source}</td>
                      <td data-label="وصل شده به">
                        {row.latest.answerRecipient?.label ||
                          row.latest.operator ||
                          'نامشخص'}
                      </td>
                      <td data-label="آخرین تماس">
                        {callDate(row.latest.occurredAt)}
                      </td>
                      <td data-label="تعداد تماس">{faNumber(row.callCount)}</td>
                      <td data-label="نتیجه">
                        <span
                          className={styles.badge}
                          data-outcome={row.latest.outcome}
                        >
                          {row.latest.needsCompletion && !row.latest.outcome
                            ? 'نیازمند تکمیل'
                            : outcomes[row.latest.outcome ?? 'UNKNOWN']}
                        </span>
                      </td>
                      <td data-label="جزئیات">
                        <button
                          className={styles.view}
                          data-cc-focus-anchor
                          disabled={loading || !!error}
                          onClick={(event) => {
                            event.stopPropagation();
                            setNewRequestOpen(false);
                            setSelected(row);
                          }}
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
          <ReportPanel report={report} error={reportError} agents={agents} />
        </div>
        {selected && (
          <DossierFrame onClose={() => setSelected(null)}>
            <header className={styles.panelHeading}>
              <h2>پرونده مخاطب</h2>
              <button
                className={styles.iconButton}
                aria-label="بستن جزئیات"
                onClick={() => setSelected(null)}
              >
                <X size={18} />
              </button>
            </header>
            <h3>{selected.latest.name || 'مخاطب ناشناس'}</h3>
            <p dir="ltr" className={styles.phone}>
              {selected.latest.phone || 'شماره نامعلوم'}
            </p>
            {!!noteDrafts[selected.id]?.trim() && (
              <p role="status" className={styles.feedback}>
                یادداشت ثبت‌نشده این مخاطب حفظ شده است.
              </p>
            )}
            <button
              className={styles.followUp}
              data-cc-focus-anchor
              disabled={
                !canCreate ||
                !canManage ||
                busy ||
                selected.latest.origin === 'SYNTHETIC'
              }
              onClick={() => void complete(selected.latest.id)}
            >
              ویرایش اطلاعات مخاطب
            </button>
            <button
              className={styles.followUp}
              disabled={!canManage}
              onClick={() => setNewRequestOpen(true)}
            >
              درخواست جدید
            </button>
            <History
              key={`${selected.id}:${selected.latest.id}:${historyRevision}`}
              newRequestOpen={newRequestOpen}
              onRequestClose={() => setNewRequestOpen(false)}
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
          </DossierFrame>
        )}
      </div>

      {withoutOutcomeOpen && (
        <WithoutOutcomeDialog
          key={`${branch}:${historyRevision}`}
          branch={branch}
          revision={historyRevision}
          hidden={!!draft}
          canComplete={canCreate && canManage && !busy}
          onClose={() => setWithoutOutcomeOpen(false)}
          onComplete={complete}
        />
      )}
      {periodOpen && (
        <WithoutOutcomeDialog
          key={periodOpen + branch + historyRevision}
          mode={periodOpen}
          branch={branch}
          revision={historyRevision}
          hidden={!!draft}
          canComplete={canCreate && canManage && !busy}
          onClose={() => setPeriodOpen(null)}
          onComplete={complete}
        />
      )}
      {callbacksOpen && (
        <WithoutOutcomeDialog
          key={'callbacks:' + branch + ':' + historyRevision}
          mode="missed-callbacks"
          branch={branch}
          revision={historyRevision}
          hidden={!!draft}
          canComplete={canCreate && canManage && !busy}
          onClose={() => setCallbacksOpen(false)}
          onComplete={complete}
        />
      )}
      {draft && (
        <HostedCallForm
          retainOnNavigation
          branchId={branch}
          event={draft}
          previous={
            completionPrevious ??
            (selected?.latest.phone === draft.phone
              ? { ...selected.latest, note: '', recordings: [] }
              : undefined)
          }
          onSave={save}
          onClose={() => setDraft(null)}
          busy={busy}
        />
      )}
    </section>
  );
}
function DossierFrame({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const [compact] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 1200px)').matches,
  );
  const restoreFocus = useDialogReturnFocus();
  return compact ? (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        dir="rtl"
        className={styles.dossierDialog}
        onCloseAutoFocus={restoreFocus}
      >
        <DialogTitle className="sr-only">پرونده مخاطب</DialogTitle>
        <DialogDescription className="sr-only">
          تماس‌ها، درخواست‌ها و یادداشت‌های مخاطب
        </DialogDescription>
        <div className={styles.workspace}>{children}</div>
      </DialogContent>
    </Dialog>
  ) : (
    <aside className={`${styles.panel} ${styles.history}`}>{children}</aside>
  );
}
function ReportPanel({
  report,
  error,
  agents,
}: {
  agents: Operator[];
  report: Report | null;
  error: string;
}) {
  if (error) return <p role="alert">گزارش در دسترس نیست: {error}</p>;
  if (!report) return <p role="status">در حال محاسبه گزارش…</p>;
  const { data: r, meta } = report;
  return (
    <section className={`${styles.panel} ${styles.reportPanel}`}>
      <h2>
        <BarChart3 size={21} /> گزارش داده ثبت‌شده
      </h2>
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
          ['تماس ثبت‌شده', r.calls],
          ['مخاطب تلفنی یکتا', r.contacts],
          ['نیازمند تکمیل', r.incomplete],
        ].map(([label, value]) => (
          <article className={styles.stat} key={label}>
            <span className={styles.statIcon}>
              {label === 'تماس ثبت‌شده' ? (
                <Phone />
              ) : label === 'مخاطب تلفنی یکتا' ? (
                <Users />
              ) : (
                <FileText />
              )}
            </span>
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
      <ReportHighlights data={r} agents={agents} />

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
  newRequestOpen,
  onRequestClose,
}: {
  newRequestOpen: boolean;
  onRequestClose: () => void;
  branch: string;
  contact: ContactSummary;
  actorId: string;
  permissions: readonly string[];
  text: string;
  setText: (value: string) => void;
  onNoteSaved: (value: string) => void;
}) {
  const [section, setSection] = useState('calls');
  const sectionControls = useRef<HTMLDivElement>(null);
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
        setCalls((previous) =>
          callAfter
            ? [
                ...previous.filter(
                  (item) => !r.data.some((next) => next.id === item.id),
                ),
                ...r.data,
              ]
            : r.data,
        );
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
        setNotes((previous) =>
          noteAfter
            ? [
                ...previous.filter(
                  (item) => !r.data.some((next) => next.id === item.id),
                ),
                ...r.data,
              ]
            : r.data,
        );
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
      <div
        ref={sectionControls}
        className={styles.dossierTabs}
        role="group"
        aria-label="بخش‌های پرونده"
      >
        {(
          [
            ['calls', 'سابقه'],
            ['requests', 'درخواست‌ها'],
            ['notes', text.trim() ? 'یادداشت‌ها •' : 'یادداشت‌ها'],
          ] as const
        ).map(([value, label]) => (
          <button
            type="button"
            key={value}
            data-section={value}
            aria-pressed={section === value}
            aria-controls={`cc-dossier-${value}`}
            onClick={() => setSection(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div id="cc-dossier-calls" hidden={section !== 'calls'}>
        <h3 className={styles.sectionTitle}>سابقه تماس‌ها</h3>
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
              <span className={styles.timelineIcon}>
                {c.direction === 'INBOUND' ? (
                  <PhoneIncoming size={15} />
                ) : (
                  <PhoneOutgoing size={15} />
                )}
              </span>
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
                <p>
                  {c.direction === 'OUTBOUND'
                    ? 'تماس‌گرفته‌شده از داخلی'
                    : 'وصل شده به'}
                  : {c.answerRecipient?.label || c.operator || 'نامشخص'}
                </p>
                <p>
                  زمان ثبت: {c.createdAt ? callDate(c.createdAt) : 'نامشخص'}
                </p>
                <RecordingDownload
                  callId={c.id}
                  branchId={branch}
                  allowed={permissions.includes(
                    'customer_affairs.call_center.recordings.read',
                  )}
                />
              </details>
            </li>
          ))}
        </ol>
        <ScrollContinuation
          enabled={section === 'calls' && !!callNext && !loading && !error}
          onMore={() => {
            setLoading(true);
            setCallAfter(callNext!);
          }}
        />
      </div>
      <div id="cc-dossier-requests" hidden={section !== 'requests'}>
        <WorkflowPanel
          dossier
          newRequestOpen={newRequestOpen}
          onRequestClose={onRequestClose}
          branchId={branch}
          contactId={contact.id}
          actorId={actorId}
          canManage={permissions.includes(
            'customer_affairs.call_center.workflow.manage',
          )}
          calls={calls}
          onChanged={() => setRetry((value) => value + 1)}
          onLinked={(id, ticketId) =>
            setCalls((items) =>
              items.map((c) => (c.id === id ? { ...c, ticketId } : c)),
            )
          }
        />
      </div>
      <div id="cc-dossier-notes" hidden={section !== 'notes'}>
        <h3 className={styles.sectionTitle}>یادداشت‌ها</h3>
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
        <ScrollContinuation
          enabled={
            section === 'notes' && !!noteNext && !notesLoading && !noteError
          }
          onMore={() => {
            setNotesLoading(true);
            setNoteAfter(noteNext!);
          }}
        />
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
      </div>
    </>
  );
}
