'use client';
import { useUnsavedGuard } from './use-unsaved-guard';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';
import { WorkQueue, WorkflowPanel } from './workflow';
import { workflowApi, type RequestCase } from './workflow-client';
import { useAccessActor } from '@/modules/iam/access-context';
import { callCenterApi, type CallNote, type CallCenterPage } from './client';
import {
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Eye,
  RotateCcw,
  Headset,
  MessageCircle,
  Pencil,
  Phone,
  PhoneIncoming,
  Plus,
  Search,
  Trophy,
  UserRound,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import {
  callDate,
  faNumber,
  filterContacts,
  groupCalls,
  normalizePhone,
  operators,
  saveCall,
  sources,
  statuses,
  validPhone,
  type Call,
  type CallEvent,
  type Status,
} from './model';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import styles from './workspace.module.css';

const outcomeLabels: Record<string, string> = {
  ANSWERED: 'گفت‌وگو انجام شد',
  NO_ANSWER: 'بدون پاسخ',
  BUSY: 'اشغال',
  FAILED: 'ناموفق',
};
const emptyFilters = {
  query: '',
  direction: '',
  source: '',
  operator: '',
  status: '',
};
const colors = [
  '#9caab8',
  '#299ded',
  '#f3ad39',
  '#52c5c5',
  '#6969d8',
  '#b46cdb',
];
function tone(status: Status) {
  if (status === 'بدون پاسخ') return 'red';
  if (status === 'نهایی شده' || status === 'جدید') return 'green';
  if (status === 'منتظر تماس مجدد') return 'amber';
  return 'blue';
}
function Badge({ status }: { status: Status }) {
  return (
    <span className={styles.badge} data-tone={tone(status)}>
      {status}
    </span>
  );
}

export function CallCenterWorkspace() {
  const actor = useAccessActor();
  const branchId = actor?.branchIds[0];
  if (!actor || !branchId)
    return <p role="status">در حال دریافت دسترسی و شعبه کال سنتر…</p>;
  return (
    <CallCenterContent
      key={`${actor.userId}:${branchId}:${[...actor.permissions].sort().join(',')}`}
      actorId={actor.userId}
      branchId={branchId}
      permissions={actor.permissions}
    />
  );
}

function CallCenterContent({
  branchId,
  permissions,
  actorId,
}: {
  branchId: string;
  actorId: string;
  permissions: readonly string[];
}) {
  const [calls, setCalls] = useState<Call[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState<CallEvent | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const selectedRef = useRef<string | null>(null);
  useEffect(() => {
    selectedRef.current = selectedPhone;
  }, [selectedPhone]);
  const [notes, setNotes] = useState<Record<string, CallNote[]>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [noteBusy, setNoteBusy] = useState(false);
  const [loadedPage, setLoadedPage] = useState(1);
  const [totalContacts, setTotalContacts] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const noteRetry = useRef<{
    contactId: string;
    text: string;
    id: string;
  } | null>(null);
  const canCreate = permissions.includes(
    'customer_affairs.call_center.calls.create',
  );
  const canNote = permissions.includes(
    'customer_affairs.call_center.notes.create',
  );
  const acceptPage = useCallback((result: CallCenterPage, replace = false) => {
    const incoming = result.data.flatMap((contact) => contact.calls);
    setCalls((previous) =>
      replace
        ? incoming
        : [
            ...new Map(
              [...previous, ...incoming].map((call) => [call.id, call]),
            ).values(),
          ],
    );
    setNotes((previous) => ({
      ...(replace ? {} : previous),
      ...Object.fromEntries(
        result.data.map((contact) => [contact.id, contact.notes]),
      ),
    }));
    setTotalContacts(result.meta.total);
    setLoadedPage(result.meta.page);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    callCenterApi
      .list(branchId, 1, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        acceptPage(result, true);
        setSelectedPhone(
          result.data[0]?.calls[0]
            ? result.data[0].calls[0].phone || `unknown:${result.data[0].id}`
            : null,
        );
        setError('');
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          reason instanceof Error
            ? reason.message
            : 'دریافت تماس‌ها انجام نشد.',
        );
        setLoading(false);
      });
    return () => controller.abort();
  }, [branchId, reloadKey, acceptPage]);
  async function loadMore() {
    setLoading(true);
    setError('');
    try {
      acceptPage(await callCenterApi.list(branchId, loadedPage + 1));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'دریافت تماس‌ها انجام نشد.',
      );
    } finally {
      setLoading(false);
    }
  }
  const contacts = useMemo(() => groupCalls(calls), [calls]);
  const filtered = filterContacts(contacts, filters);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pageCount);
  const shown = filtered.slice((currentPage - 1) * 10, currentPage * 10);
  const selected = contacts.find((contact) => contact.phone === selectedPhone);
  useUnsavedGuard(
    Boolean(
      note.trim() || Object.values(noteDrafts).some((value) => value.trim()),
    ),
  );
  const sourceCounts = sources.map(
    (source) =>
      contacts.filter(({ latest }) => latest.source === source).length,
  );
  const gradient = sourceCounts
    .map((count, index) => {
      const start = contacts.length
        ? (sourceCounts.slice(0, index).reduce((sum, value) => sum + value, 0) /
            contacts.length) *
          360
        : 0;
      const end =
        start + (contacts.length ? (count / contacts.length) * 360 : 0);
      return `${colors[index]} ${start}deg ${end}deg`;
    })
    .join(', ');

  const inbound = calls.filter((call) => call.direction === 'INBOUND').length;
  const outbound = calls.length - inbound;
  function changeFilter(key: keyof typeof filters, value: string) {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPage(1);
  }
  function openCall(direction: CallEvent['direction'], phone = '') {
    setDraft({
      id: crypto.randomUUID(),
      direction,
      phone,
      occurredAt: new Date().toISOString(),
      recordings: [],
    });
  }
  function selectPhone(phone: string | null) {
    if (selectedPhone)
      setNoteDrafts((previous) => ({ ...previous, [selectedPhone]: note }));
    setSelectedPhone(phone);
    setNote(phone ? (noteDrafts[phone] ?? '') : '');
  }
  async function submitCall(call: Call) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await callCenterApi.create(branchId, call);
      setCalls((previous) => saveCall(previous, result.data));
      selectPhone(
        normalizePhone(result.data.phone) || `unknown:${result.data.contactId}`,
      );
      setPage(1);
      setDraft(null);
      setMessage('تماس و سابقه پیگیری در سرور ذخیره شد.');
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'ثبت تماس انجام نشد.',
      );
      throw reason;
    } finally {
      setBusy(false);
    }
  }
  async function addNote(event: FormEvent) {
    event.preventDefault();
    const contactId = selected?.latest.contactId,
      savedSelection = selectedPhone,
      text = note.trim();
    if (!contactId || !text || noteBusy) return;
    if (
      noteRetry.current?.contactId !== contactId ||
      noteRetry.current.text !== text
    )
      noteRetry.current = { contactId, text, id: crypto.randomUUID() };
    setNoteBusy(true);
    setError('');
    try {
      const result = await callCenterApi.note(
        branchId,
        contactId,
        noteRetry.current.id,
        text,
      );
      setNotes((previous) => ({
        ...previous,
        [contactId]: [
          ...(previous[contactId] ?? []).filter(
            (entry) => entry.id !== result.data.id,
          ),
          result.data,
        ],
      }));
      setNoteDrafts((previous) => ({
        ...previous,
        [savedSelection ?? '']: '',
      }));
      if (selectedRef.current === savedSelection)
        setNote((current) => (current.trim() === text ? '' : current));
      noteRetry.current = null;
      setMessage('یادداشت در سرور ذخیره شد.');
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'ثبت یادداشت انجام نشد.',
      );
    } finally {
      setNoteBusy(false);
    }
  }
  return (
    <section className={styles.workspace} dir="rtl" aria-label="پنل کال سنتر">
      <header className={styles.header}>
        <div>
          <h1>
            <Headset /> کال سنتر
          </h1>
          <p>مدیریت تماس‌ها، پیگیری‌ها و سرنخ‌های ورودی</p>
        </div>
        <button
          className={styles.primary}
          disabled={!canCreate || loading}
          onClick={() => openCall('INBOUND')}
        >
          <Plus size={17} /> ثبت تماس جدید
        </button>
      </header>
      <div className={styles.preview}>
        <span>
          <i /> اطلاعات تماس‌ها و یادداشت‌ها در سرور ذخیره می‌شوند.
        </span>
        <span>
          آمار بر اساس {faNumber(contacts.length)} پرونده بارگذاری‌شده
        </span>
      </div>
      <WorkQueue
        branchId={branchId}
        actorId={actorId}
        canManage={permissions.includes(
          'customer_affairs.call_center.workflow.manage',
        )}
      />
      <div className={styles.stats}>
        {[
          {
            label: 'تعداد تماس‌ها',
            value: faNumber(calls.length),
            detail: 'مجموع تماس‌های پرونده‌های بارگذاری‌شده',
            Icon: Phone,
            color: 'blue',
          },
          {
            label: 'مخاطبان بارگذاری‌شده',
            value: faNumber(contacts.length),
            detail: 'پیگیری‌های زمان‌دار در صف رسیدگی نمایش داده می‌شوند',
            Icon: ClipboardList,
            color: 'amber',
          },
          {
            label: 'تماس‌های ورودی / خروجی',
            value: `${faNumber(inbound)} / ${faNumber(outbound)}`,
            detail: 'بر اساس جهت ثبت‌شده تماس',
            Icon: PhoneIncoming,
            color: 'green',
          },
          {
            label: 'میانگین زمان پاسخ',
            value: '—',
            detail: 'زمان پاسخ از API دریافت نشده است',
            Icon: Clock3,
            color: 'blue',
          },
        ].map(({ label, value, detail, Icon, color }) => (
          <article className={styles.stat} key={label}>
            <span className={styles.statIcon} data-tone={color}>
              <Icon />
            </span>
            <div>
              <h2>{label}</h2>
              <strong dir="auto">{value}</strong>
              <p>{detail}</p>
            </div>
          </article>
        ))}
      </div>
      <div className={styles.filters}>
        <label className={styles.search}>
          <Search size={19} />
          <input
            type="search"
            autoComplete="off"
            aria-label="جست‌وجو در تماس‌ها"
            placeholder="جست‌وجو در نام، شماره، موضوع ..."
            value={filters.query}
            onChange={(e) => changeFilter('query', e.target.value)}
          />
        </label>
        <FilterSelect
          label="نوع تماس"
          value={filters.direction}
          onChange={(v) => changeFilter('direction', v)}
          options={[
            ['INBOUND', 'ورودی'],
            ['OUTBOUND', 'خروجی'],
          ]}
        />
        <FilterSelect
          label="منبع آشنایی"
          value={filters.source}
          onChange={(v) => changeFilter('source', v)}
          options={sources.map((s) => [s, s])}
        />
        <FilterSelect
          label="اپراتور"
          value={filters.operator}
          onChange={(v) => changeFilter('operator', v)}
          options={operators.map((s) => [s, s])}
        />
        <FilterSelect
          label="نتیجه تماس / وضعیت قبلی"
          value={filters.status}
          onChange={(v) => changeFilter('status', v)}
          options={[
            ...Object.entries(outcomeLabels),
            ...statuses.map((s) => [s, s] as const),
          ]}
        />
        <button
          className={styles.clear}
          onClick={() => {
            setFilters(emptyFilters);
            setPage(1);
          }}
        >
          <RotateCcw size={17} /> پاک کردن فیلترها
        </button>
      </div>
      <div role="status" className={styles.feedback}>
        {message}
      </div>
      {error && (
        <div role="alert" className={styles.error}>
          {error}{' '}
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setReloadKey((value) => value + 1);
            }}
          >
            تلاش دوباره
          </button>
        </div>
      )}
      {loading && <p role="status">در حال دریافت تماس‌ها…</p>}
      {contacts.length < totalContacts && (
        <div className={styles.pagination}>
          <span>
            نمایش {faNumber(contacts.length)} از {faNumber(totalContacts)}{' '}
            پرونده؛ جست‌وجو و آمار روی موارد بارگذاری‌شده است.
          </span>
          <button disabled={loading} onClick={() => void loadMore()}>
            بارگذاری پرونده‌های بیشتر
          </button>
        </div>
      )}
      <div className={styles.content} data-history={Boolean(selected)}>
        <div className={styles.main}>
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <h2>
                <Phone size={18} /> لیست تماس‌ها
              </h2>
              <small>
                {filtered.length
                  ? `نمایش ${faNumber((currentPage - 1) * 10 + 1)} تا ${faNumber(Math.min(currentPage * 10, filtered.length))} از ${faNumber(filtered.length)} مورد`
                  : 'بدون نتیجه'}
              </small>
            </div>
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {[
                      'نام مسافر',
                      'شماره تماس',
                      'موضوع تماس',
                      'منبع آشنایی',
                      'وصل شده به',
                      'تاریخ آخرین تماس',
                      'تماس‌های بعدی',
                      'وضعیت',
                      'جزئیات',
                    ].map((title) => (
                      <th key={title}>{title}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((contact) => (
                    <tr
                      key={contact.phone}
                      data-selected={selectedPhone === contact.phone}
                    >
                      <td>{contact.latest.name || 'مخاطب ناشناس'}</td>
                      <td dir="ltr">
                        {contact.latest.phone || 'شماره نامعلوم'}
                      </td>
                      <td
                        className={styles.subject}
                        title={contact.latest.subject}
                      >
                        {contact.latest.subject}
                      </td>
                      <td>{contact.latest.source}</td>
                      <td>{contact.latest.operator}</td>
                      <td className={styles.date}>
                        {callDate(contact.latest.occurredAt)}
                      </td>
                      <td>
                        <span
                          className={styles.count}
                          data-tone={contact.followUps >= 5 ? 'red' : 'blue'}
                        >
                          {faNumber(contact.followUps)}
                        </span>
                      </td>
                      <td>
                        {contact.latest.outcome ? (
                          <span>
                            {outcomeLabels[contact.latest.outcome] ??
                              'نتیجه نامشخص'}
                          </span>
                        ) : (
                          <Badge status={contact.latest.status} />
                        )}
                      </td>
                      <td>
                        <button
                          className={styles.view}
                          aria-label={`مشاهده تاریخچه ${contact.latest.name || 'مخاطب ناشناس'}`}
                          onClick={() => selectPhone(contact.phone)}
                        >
                          <Eye size={14} /> مشاهده
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!shown.length && (
                <div className={styles.empty}>
                  <Search />
                  <strong>تماسی با این مشخصات پیدا نشد</strong>
                  <p>جست‌وجو یا فیلترها را تغییر دهید.</p>
                </div>
              )}
            </div>
            {pageCount > 1 && (
              <nav className={styles.pagination} aria-label="صفحه‌بندی تماس‌ها">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronRight size={16} /> قبلی
                </button>
                <span>
                  {faNumber(currentPage)} از {faNumber(pageCount)}
                </span>
                <button
                  disabled={currentPage === pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  بعدی <ChevronLeft size={16} />
                </button>
              </nav>
            )}
          </section>
          <div className={styles.reports}>
            <section className={styles.panel}>
              <div className={styles.panelHeading}>
                <h2>
                  <Trophy className={styles.gold} size={20} /> بیشترین تماس‌های
                  بعدی
                </h2>
              </div>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>نام مسافر</th>
                    <th>تماس‌های بعدی</th>
                  </tr>
                </thead>
                <tbody>
                  {[...contacts]
                    .sort((a, b) => b.followUps - a.followUps)
                    .slice(0, 5)
                    .map((contact, index) => (
                      <tr key={contact.phone}>
                        <td>{faNumber(index + 1)}</td>
                        <td>
                          <button
                            className={styles.textButton}
                            onClick={() => selectPhone(contact.phone)}
                          >
                            {contact.latest.name || 'مخاطب ناشناس'}
                          </button>
                        </td>
                        <td>
                          <span
                            className={styles.count}
                            data-tone={index === 0 ? 'red' : 'blue'}
                          >
                            {faNumber(contact.followUps)}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </section>
            <section className={styles.panel}>
              <div className={styles.panelHeading}>
                <h2>
                  <BarChart3 size={20} /> عملکرد اپراتورها
                </h2>
              </div>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>اپراتور</th>
                    <th>تعداد تماس</th>
                    <th>سهم تماس‌ها</th>
                  </tr>
                </thead>
                <tbody>
                  {operators.map((operator) => {
                    const count = calls.filter(
                      (call) => call.operator === operator,
                    ).length;
                    const percent = calls.length
                      ? Math.round((count / calls.length) * 100)
                      : 0;
                    return (
                      <tr key={operator}>
                        <td>
                          <span className={styles.operator}>
                            <UserRound size={18} />
                            {operator}
                          </span>
                        </td>
                        <td>{faNumber(count)}</td>
                        <td>
                          <span>{faNumber(percent)}٪</span>
                          <span className={styles.bar}>
                            <i style={{ width: `${percent}%` }} />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
            <section className={styles.panel}>
              <div className={styles.panelHeading}>
                <h2>
                  <BarChart3 size={20} /> منابع آشنایی
                </h2>
              </div>
              <div className={styles.sources}>
                <div className={styles.legend}>
                  {sources.map((source, index) => (
                    <div key={source}>
                      <i style={{ background: colors[index] }} />
                      <span>{source}</span>
                      <b>{faNumber(sourceCounts[index]!)}</b>
                      <span className={styles.bar}>
                        <i
                          style={{
                            width: `${contacts.length ? (sourceCounts[index]! / contacts.length) * 100 : 0}%`,
                            background: colors[index],
                          }}
                        />
                      </span>
                    </div>
                  ))}
                </div>
                <div
                  className={styles.donut}
                  style={{ '--chart': gradient } as CSSProperties}
                  role="img"
                  aria-label={`مجموع ${faNumber(contacts.length)} مسافر؛ تفکیک منابع در جدول کنار نمودار`}
                >
                  <div>
                    <small>کل مسافران</small>
                    <strong>{faNumber(contacts.length)}</strong>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
        {selected && (
          <aside
            className={`${styles.panel} ${styles.history}`}
            aria-label="تاریخچه پیگیری مسافر"
          >
            <div className={styles.panelHeading}>
              <h2>تاریخچه پیگیری مسافر</h2>
              <button
                className={styles.iconButton}
                aria-label="بستن تاریخچه"
                onClick={() => selectPhone(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className={styles.person}>
              <span className={styles.avatar}>
                <UserRound size={28} />
              </span>
              <div>
                <strong>{selected.latest.name || 'مخاطب ناشناس'}</strong>
                <span dir="ltr">
                  {selected.latest.phone || 'شماره نامعلوم'} <Phone size={12} />
                </span>
              </div>
            </div>
            <div className={styles.personTags}>
              <span>{selected.latest.source}</span>
              {selected.latest.outcome ? (
                <span>
                  {outcomeLabels[selected.latest.outcome] ?? 'نتیجه نامشخص'}
                </span>
              ) : (
                <Badge status={selected.latest.status} />
              )}
            </div>
            <button
              className={styles.followUp}
              disabled={!canCreate}
              onClick={() => openCall('OUTBOUND', selected.latest.phone)}
            >
              <Plus size={15} /> ثبت تماس پیگیری
            </button>
            <ol className={styles.timeline}>
              {[...selected.calls].reverse().map((call, index) => (
                <li key={call.id}>
                  <span
                    className={styles.timelineIcon}
                    data-tone={index === 0 ? 'green' : 'blue'}
                  >
                    {index === 0 ? (
                      <Phone size={15} />
                    ) : (
                      <MessageCircle size={15} />
                    )}
                  </span>
                  <h3>
                    {index === 0
                      ? 'تماس اولیه'
                      : `تماس بعدی ${faNumber(index)}`}{' '}
                    ـ {call.subject}
                  </h3>
                  <time dateTime={call.occurredAt}>
                    {callDate(call.occurredAt)} ·{' '}
                    {call.direction === 'INBOUND' ? 'ورودی' : 'خروجی'}
                  </time>
                  <p>{call.note || 'یادداشتی برای این تماس ثبت نشده است.'}</p>
                  <small>
                    {call.origin === 'MANUAL' ? 'ثبت دستی' : 'سابقه قبلی'} ·{' '}
                    {outcomeLabels[call.outcome ?? ''] ?? 'نتیجه نامشخص'}
                    {call.ticketId
                      ? ' · متصل به درخواست'
                      : ' · بدون درخواست مرتبط'}
                  </small>
                  {call.recordings.map((recording) => (
                    <label className={styles.recording} key={recording.id}>
                      {recording.title}
                      <audio controls preload="none" src={recording.url} />
                    </label>
                  ))}
                </li>
              ))}
            </ol>
            {!selected.calls.some((call) => call.recordings.length) && (
              <p className={styles.noAudio}>
                فایل صوتی برای این تماس‌ها دریافت نشده است.
              </p>
            )}
            {(notes[selected.latest.contactId ?? ''] ?? []).map((entry) => (
              <div className={styles.savedNote} key={entry.id}>
                <Pencil size={12} />
                <p>{entry.text}</p>
                <small>{callDate(entry.at)}</small>
              </div>
            ))}
            <WorkflowPanel
              key={selected.latest.contactId}
              branchId={branchId}
              contactId={selected.latest.contactId!}
              calls={selected.calls}
              onLinked={(id, ticketId) =>
                setCalls((previous) =>
                  previous.map((call) =>
                    call.id === id ? { ...call, ticketId } : call,
                  ),
                )
              }
              actorId={actorId}
              canManage={permissions.includes(
                'customer_affairs.call_center.workflow.manage',
              )}
            />
            <form onSubmit={addNote} className={styles.note}>
              <label htmlFor="call-center-note">
                <Pencil size={14} /> یادداشت جدید
              </label>
              <textarea
                id="call-center-note"
                placeholder="یادداشت خود را وارد کنید..."
                value={note}
                disabled={noteBusy || !canNote}
                maxLength={2000}
                onChange={(e) => setNote(e.target.value)}
              />
              <button
                className={styles.primary}
                disabled={!note.trim() || noteBusy || !canNote}
              >
                <Check size={14} /> ثبت یادداشت
              </button>
            </form>
          </aside>
        )}
      </div>
      {draft && (
        <CallForm
          branchId={branchId}
          event={draft}
          previous={
            contacts.find(
              (contact) => contact.phone === normalizePhone(draft.phone),
            )?.latest
          }
          onSave={submitCall}
          busy={busy}
          onClose={() => setDraft(null)}
        />
      )}
    </section>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.filterSelect}>
      <span>{label}</span>
      <NativeSearchSelect
        aria-label={label}
        className={styles.control}
        optionLimit={50}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">همه موارد</option>
        {options.map(([key, title]) => (
          <option key={key} value={key}>
            {title}
          </option>
        ))}
      </NativeSearchSelect>
    </label>
  );
}

function CallForm({
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
