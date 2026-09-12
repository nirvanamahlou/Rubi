'use client';

import { AffairsSelect } from './affairs-select';
import type {
  CustomerAffairsDashboard,
  CustomerAffairsLeadView,
  CustomerAffairsTicketView,
} from '@rubi/contracts';
import {
  ArrowLeft,
  BarChart3,
  Clock3,
  Headphones,
  Home,
  Inbox,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Smile,
  Users,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { ErrorState } from '@/components/ui/surfaces';
import { useSuppressHrConnections } from '@/modules/hr/hr-connections-visibility';
import {
  customerAffairsApi as api,
  CustomerAffairsApiError,
  type AffairsReport,
} from '../api/customer-affairs-client';
import {
  DetailPanel,
  LeadForm,
  TicketForm,
  stageLabel,
  statusLabel,
  priorityLabel,
  type Detail,
} from './customer-affairs-workspace';
import s from './customer-affairs-rubi.module.css';

type View =
  | 'overview'
  | 'leads'
  | 'followups'
  | 'handoffs'
  | 'tickets'
  | 'queues'
  | 'satisfaction'
  | 'reports';
const sections = [
  { view: 'overview', title: 'نمای کلی', icon: Home },
  { view: 'leads', title: 'درخواست‌ها و سرنخ‌ها', icon: Users },
  { view: 'tickets', title: 'تیکت‌های پشتیبانی', icon: Inbox },
  { view: 'reports', title: 'گزارش‌ها', icon: BarChart3 },
] as const;
const hubs = [
  {
    view: 'leads',
    title: 'درخواست‌ها و سرنخ‌ها',
    text: 'ثبت نیاز سفر، ارزیابی شرایط و نمای مرحله‌ای سرنخ‌ها',
    icon: Users,
    color: 'blue',
  },
  {
    view: 'followups',
    title: 'پیگیری معوق',
    text: 'تماس، نتیجه، اقدام بعدی و پیگیری‌های معوق',
    icon: Clock3,
    color: 'amber',
  },
  {
    view: 'handoffs',
    title: 'منتظر پذیرش فروش',
    text: 'ارزیابی، ارسال بسته و پیگیری نتیجه فروش',
    icon: Send,
    color: 'teal',
  },
  {
    view: 'tickets',
    title: 'تیکت‌های پشتیبانی',
    text: 'شکایت، صدور، تغییر، کنسلی و استرداد',
    icon: Headphones,
    color: 'purple',
  },
  {
    view: 'queues',
    title: 'تیکت‌های معوق',
    text: 'پیگیری موارد معوق، ارجاع داخلی و تشدید',
    icon: ShieldCheck,
    color: 'red',
  },
  {
    view: 'satisfaction',
    title: 'رضایت و اقدام اصلاحی',
    text: 'مشاهده نتیجه رضایت و پیگیری اقدام اصلاحی در پرونده',
    icon: Smile,
    color: 'teal',
  },
] as const;
const views: readonly string[] = [...sections, ...hubs].map((x) => x.view);
const number = (n: number) => n.toLocaleString('fa-IR');
const date = (v?: string | null) =>
  v
    ? new Date(v).toLocaleString('fa-IR', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : 'تعیین نشده';
const accent = (color: string) =>
  ({ '--accent': `var(--ca-${color})` }) as CSSProperties;
type Loaded = {
  dashboard?: CustomerAffairsDashboard;
  leads: CustomerAffairsLeadView[];
  tickets: CustomerAffairsTicketView[];
  total: number;
  report?: AffairsReport;
  detail?: Detail;
};

export function CustomerAffairsRubiWorkspace() {
  useSuppressHrConnections(true);
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get('view');
  const view = (
    requested && views.includes(requested)
      ? requested
      : params.get('tab') === 'tickets'
        ? 'tickets'
        : params.get('tab') === 'leads'
          ? 'leads'
          : 'overview'
  ) as View;
  const family = ['leads', 'followups', 'handoffs'].includes(view)
    ? 'leads'
    : ['tickets', 'queues'].includes(view)
      ? 'tickets'
      : view === 'satisfaction'
        ? 'reports'
        : view;
  const ticketId = params.get('ticket');
  const leadId = params.get('lead');
  const id = ticketId || leadId;
  const tab = ticketId ? 'tickets' : 'leads';
  const search = params.get('search') || '';
  const filter = params.get('filter') || 'ALL';
  const sourceSite = params.get('sourceSite') || 'ALL';
  const page = Math.max(
    1,
    Math.min(100000, Math.floor(Number(params.get('page')) || 1)),
  );
  const board = params.get('layout') === 'board';
  const [form, setForm] = useState<'leads' | 'tickets' | null>(null);
  const [loaded, setLoaded] = useState<Loaded>({
    leads: [],
    tickets: [],
    total: 0,
  });
  const [attention, setAttention] = useState<CustomerAffairsLeadView[]>([]);
  const [state, setState] = useState<
    'loading' | 'ready' | 'error' | 'forbidden'
  >('loading');
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const navigate = (next: View, detailId?: string) => {
    setForm(null);
    const p = new URLSearchParams({ view: next });
    if (detailId) p.set(next === 'leads' ? 'lead' : 'ticket', detailId);
    router.push(`/customer-affairs?${p}`);
  };
  const change = (key: string, value: string) => {
    const p = new URLSearchParams(params.toString());
    p.set(key, value);
    if (key !== 'page' && key !== 'layout') p.delete('page');
    router.replace(`/customer-affairs?${p}`, { scroll: false });
  };
  useEffect(() => {
    let current = true;
    async function load() {
      const result: Loaded = { leads: [], tickets: [], total: 0 };
      if (id)
        result.detail = (
          await (tab === 'tickets' ? api.ticket(id) : api.lead(id))
        ).data as Detail;
      else if (view === 'overview') {
        const [dashboard, leads, tickets, overdue] = await Promise.all([
          api.dashboard(),
          api.leads('', { stage: 'HANDOFF_PROPOSED', pageSize: 5 }),
          api.tickets('', 'ALL', { pageSize: 5 }),
          api.leads('', { overdueOnly: true, pageSize: 5 }),
        ]);
        if (current) setAttention(overdue.data);
        result.dashboard = dashboard.data;
        result.leads = leads.data;
        result.tickets = tickets.data;
      } else if (view === 'reports' || view === 'satisfaction')
        result.report = (await api.report()).data;
      else if (family === 'leads') {
        const rows = await api.leads(search, {
          page,
          pageSize: 12,
          stage:
            view === 'handoffs' && filter === 'ALL'
              ? 'HANDOFF_PROPOSED'
              : filter,
          overdueOnly: view === 'followups',
        });
        result.leads = rows.data;
        result.total = rows.meta.total;
      } else if (family === 'tickets') {
        const rows = await api.tickets(search, filter, {
          page,
          pageSize: 12,
          overdueOnly: view === 'queues',
          sourceSite,
        });
        result.tickets = rows.data;
        result.total = rows.meta.total;
      }
      if (current) {
        setLoaded(result);
        setState('ready');
      }
    }
    void Promise.resolve()
      .then(() => {
        if (!current) return;
        setState('loading');
        return load();
      })
      .catch((e: unknown) => {
        if (current) {
          setState(
            e instanceof CustomerAffairsApiError && e.status === 403
              ? 'forbidden'
              : 'error',
          );
          setMessage(
            e instanceof Error ? e.message : 'دریافت اطلاعات انجام نشد.',
          );
        }
      });
    return () => {
      current = false;
    };
  }, [view, family, id, tab, search, filter, sourceSite, page, revision]);
  const reloadDetail = async () => {
    setRevision((x) => x + 1);
  };
  const title =
    hubs.find((x) => x.view === view)?.title ||
    sections.find((x) => x.view === view)?.title;
  const rows = family === 'leads' ? loaded.leads : loaded.tickets;
  const badge = (text: string | undefined) => (
    <span className={s.badge}>{text || 'نامشخص'}</span>
  );
  const report = loaded.report;
  return (
    <div className={s.workspace} dir="rtl">
      <header className={s.header}>
        <div>
          <span className={s.eyebrow}>ارتباط با مشتری</span>
          <h1>امور مشتریان</h1>
        </div>
        <div className={s.actions}>
          <Button variant="outline" onClick={() => setForm('tickets')}>
            <Plus size={16} />
            تیکت جدید
          </Button>
          <Button onClick={() => setForm('leads')}>
            <Plus size={16} />
            ثبت درخواست سفر
          </Button>
        </div>
      </header>
      <nav className={s.tabs} aria-label="بخش‌های امور مشتریان">
        {sections.map(({ view: v, title: t, icon: Icon }) => (
          <button
            key={v}
            className={s.tab}
            aria-current={family === v ? 'page' : undefined}
            onClick={() => navigate(v)}
          >
            <Icon aria-hidden="true" />
            {t}
          </button>
        ))}
      </nav>
      {form ? (
        form === 'leads' ? (
          <LeadForm
            onCancel={() => setForm(null)}
            onCreated={(row) => navigate('leads', row.id)}
          />
        ) : (
          <TicketForm
            onCancel={() => setForm(null)}
            onCreated={(row) => navigate('tickets', row.id)}
          />
        )
      ) : null}
      <>
        {(family === 'leads' || family === 'tickets') && !id && (
          <nav className={s.subtabs} aria-label="نماهای پرونده">
            {hubs
              .filter((x) =>
                (family === 'leads'
                  ? ['leads', 'followups', 'handoffs']
                  : ['tickets', 'queues']
                ).includes(x.view),
              )
              .map((x) => (
                <button
                  key={x.view}
                  aria-pressed={view === x.view}
                  onClick={() => navigate(x.view)}
                >
                  {x.view === 'leads' || x.view === 'tickets'
                    ? 'همه پرونده‌ها'
                    : x.title}
                </button>
              ))}
          </nav>
        )}
        {state === 'loading' ? (
          <div className={s.empty} role="status">
            در حال دریافت اطلاعات…
          </div>
        ) : state === 'error' || state === 'forbidden' ? (
          <ErrorState
            title={
              state === 'forbidden'
                ? 'دسترسی به این بخش مجاز نیست'
                : 'اطلاعات دریافت نشد'
            }
            description={message}
            action={
              <Button
                variant="outline"
                onClick={() => setRevision((x) => x + 1)}
              >
                تلاش دوباره
              </Button>
            }
          />
        ) : loaded.detail && id ? (
          <DetailPanel
            key={id}
            detail={loaded.detail}
            tab={tab}
            onBack={() => navigate(tab)}
            onReload={reloadDetail}
          />
        ) : (
          <>
            {view === 'overview' && (
              <>
                <div className={s.metrics}>
                  {[
                    {
                      label: 'سرنخ‌های باز',
                      value: loaded.dashboard?.leads.open,
                      view: 'leads',
                      icon: Users,
                      color: 'blue',
                    },
                    {
                      label: 'پیگیری‌های معوق',
                      value: loaded.dashboard?.leads.overdue,
                      view: 'followups',
                      icon: Clock3,
                      color: 'amber',
                    },
                    {
                      label: 'تیکت‌های باز',
                      value: loaded.dashboard?.tickets.open,
                      view: 'tickets',
                      icon: Inbox,
                      color: 'purple',
                    },
                    {
                      label: 'تیکت‌های معوق',
                      value: loaded.dashboard?.tickets.overdue,
                      view: 'queues',
                      icon: ShieldCheck,
                      color: 'red',
                    },
                  ].map((x) => (
                    <button
                      key={x.view}
                      className={s.metric}
                      onClick={() => navigate(x.view as View)}
                      style={accent(x.color)}
                    >
                      <span className={s.icon}>
                        <x.icon />
                      </span>
                      <div>
                        <strong>
                          {x.value === undefined ? '—' : number(x.value)}
                        </strong>
                        <p>{x.label}</p>
                        <small>مشاهده پرونده‌ها</small>
                      </div>
                    </button>
                  ))}
                </div>
                <section className={s.attention}>
                  <div className={s.panelHead}>
                    <div>
                      <h2>
                        <Clock3 aria-hidden="true" />
                        نیازمند پیگیری
                      </h2>
                      <p className={s.muted}>
                        درخواست‌هایی که موعد اقدام بعدی آن‌ها گذشته است
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => navigate('followups')}
                    >
                      مشاهده همه پیگیری‌ها <ArrowLeft size={16} />
                    </Button>
                  </div>
                  {attention.length ? (
                    attention.map((row) => (
                      <div className={s.listItem} key={row.id}>
                        <span className={s.icon} style={accent('amber')}>
                          <Clock3 aria-hidden="true" />
                        </span>
                        <div className={s.grow}>
                          <button
                            className={s.titleButton}
                            onClick={() => navigate('leads', row.id)}
                          >
                            {row.title}
                          </button>
                          <p className={s.muted}>{row.nextAction}</p>
                        </div>
                        <time className={s.due}>{date(row.nextActionAt)}</time>
                        <Button
                          variant="ghost"
                          onClick={() => navigate('leads', row.id)}
                        >
                          پیگیری <ArrowLeft size={15} />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className={s.empty}>پیگیری عقب‌افتاده‌ای ندارید.</p>
                  )}
                </section>
                <div className={s.columns}>
                  {(['tickets', 'leads'] as const).map((kind) => (
                    <section className={s.panel} key={kind}>
                      <div className={s.panelHead}>
                        <h2>
                          {kind === 'tickets'
                            ? 'آخرین تیکت‌ها'
                            : 'منتظر پذیرش فروش'}
                        </h2>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            navigate(
                              kind === 'tickets' ? 'tickets' : 'handoffs',
                            )
                          }
                        >
                          مشاهده همه
                        </Button>
                      </div>
                      {loaded[kind].length ? (
                        loaded[kind].map((row) => (
                          <div key={row.id} className={s.listItem}>
                            <div className={s.grow}>
                              <button
                                className={s.titleButton}
                                onClick={() => navigate(kind, row.id)}
                              >
                                {'subject' in row ? row.subject : row.title}
                              </button>
                              <p className={s.muted}>{row.trackingNumber}</p>
                            </div>
                            {badge(
                              'status' in row
                                ? statusLabel[row.status]
                                : stageLabel[row.stage],
                            )}
                          </div>
                        ))
                      ) : (
                        <p className={s.empty}>پرونده‌ای وجود ندارد.</p>
                      )}
                    </section>
                  ))}
                </div>
              </>
            )}
            {['leads', 'followups', 'handoffs', 'tickets', 'queues'].includes(
              view,
            ) && (
              <>
                {view === 'handoffs' && (
                  <div className={s.flow}>
                    {[
                      'ارزیابی شرایط',
                      'ارسال درخواست',
                      'پذیرش فروش',
                      'ادامه در فروش',
                    ].map((x, i) => (
                      <span key={x}>
                        <b>{number(i + 1)}</b>
                        {x}
                        {i < 3 && <ArrowLeft size={14} />}
                      </span>
                    ))}
                  </div>
                )}
                <section className={s.panel}>
                  <div className={s.panelHead}>
                    <h2>{title}</h2>
                    {view === 'leads' && (
                      <div className={s.subtabs}>
                        <button
                          aria-pressed={!board}
                          onClick={() => change('layout', 'table')}
                        >
                          جدولی
                        </button>
                        <button
                          aria-pressed={board}
                          onClick={() => change('layout', 'board')}
                        >
                          مرحله‌ای
                        </button>
                      </div>
                    )}
                  </div>
                  <div className={s.filters}>
                    <form
                      className={`${s.search} ${s.actions}`}
                      onSubmit={(event) => {
                        event.preventDefault();
                        change(
                          'search',
                          String(
                            new FormData(event.currentTarget).get('search') ||
                              '',
                          ),
                        );
                      }}
                    >
                      <Search aria-hidden="true" />
                      <Input
                        aria-label="جست‌وجوی پرونده"
                        placeholder="جست‌وجوی عنوان یا شماره پیگیری…"
                        name="search"
                        key={search}
                        defaultValue={search}
                        className="min-w-0 flex-1"
                      />
                      <Button type="submit" variant="outline">
                        جست‌وجو
                      </Button>
                    </form>
                    {view !== 'followups' && (
                      <AffairsSelect
                        aria-label="فیلتر وضعیت"
                        value={filter}
                        onChange={(e) => change('filter', e.target.value)}
                      >
                        <option value="ALL">
                          {view === 'handoffs' ? 'منتظر فروش' : 'همه وضعیت‌ها'}
                        </option>
                        {Object.entries(
                          family === 'leads' ? stageLabel : statusLabel,
                        ).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </AffairsSelect>
                    )}
                    {family === 'tickets' && (
                      <AffairsSelect
                        aria-label="فیلتر سایت"
                        value={sourceSite}
                        onChange={(event) =>
                          change('sourceSite', event.target.value)
                        }
                      >
                        <option value="ALL">همه سایت‌ها و کانال‌ها</option>
                        <option value="jahanbastan">
                          جهان باستان · jahanbastan.ir
                        </option>
                        <option value="nystkt">نیایش · nystkt.ir</option>
                      </AffairsSelect>
                    )}
                  </div>
                  {view === 'followups' || view === 'queues' ? (
                    <p className={`${s.panelBody} ${s.muted}`}>
                      این نما فقط پرونده‌های معوق را نمایش می‌دهد.
                    </p>
                  ) : null}
                  {!rows.length ? (
                    <p className={s.empty}>پرونده‌ای مطابق فیلترها پیدا نشد.</p>
                  ) : view === 'leads' && board ? (
                    <div className={s.board}>
                      {Object.entries(stageLabel).map(([stage, label]) => (
                        <section className={s.lane} key={stage}>
                          <h3>
                            {label}
                            <span>
                              {number(
                                loaded.leads.filter((x) => x.stage === stage)
                                  .length,
                              )}
                            </span>
                          </h3>
                          {loaded.leads
                            .filter((x) => x.stage === stage)
                            .map((row) => (
                              <button
                                key={row.id}
                                className={s.leadCard}
                                onClick={() => navigate('leads', row.id)}
                              >
                                <strong>{row.title}</strong>
                                <p>{row.trackingNumber}</p>
                                {badge(priorityLabel[row.priority])}
                                <p>
                                  {row.nextAction || 'اقدام بعدی تعیین نشده'}
                                </p>
                              </button>
                            ))}
                        </section>
                      ))}
                    </div>
                  ) : (
                    <table className={s.table}>
                      <thead>
                        <tr>
                          {[
                            'پرونده',
                            'وضعیت و اولویت',
                            family === 'leads' ? 'نیاز سفر' : 'مهلت پاسخ اولیه',
                            'اقدام بعدی',
                            family === 'leads' ? 'زمان پیگیری' : 'مهلت حل',
                          ].map((x) => (
                            <th key={x} scope="col">
                              {x}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.id}>
                            <td data-label="پرونده">
                              <div>
                                <button
                                  className={s.titleButton}
                                  onClick={() =>
                                    navigate(
                                      family as 'leads' | 'tickets',
                                      row.id,
                                    )
                                  }
                                >
                                  {'title' in row ? row.title : row.subject}
                                </button>
                                <p>{row.trackingNumber}</p>
                              </div>
                            </td>
                            <td data-label="وضعیت">
                              <div>
                                {badge(
                                  'stage' in row
                                    ? stageLabel[row.stage]
                                    : statusLabel[row.status],
                                )}
                                <p>{priorityLabel[row.priority]}</p>
                              </div>
                            </td>
                            <td
                              data-label={
                                family === 'leads' ? 'نیاز سفر' : 'پاسخ اولیه'
                              }
                            >
                              <div>
                                {'travelNeed' in row
                                  ? row.travelNeed
                                  : date(row.firstResponseDueAt)}
                                {'firstRespondedAt' in row &&
                                  row.firstRespondedAt && <p>پاسخ داده شده</p>}
                              </div>
                            </td>
                            <td data-label="اقدام بعدی">
                              <div>{row.nextAction || 'تعیین نشده'}</div>
                            </td>
                            <td
                              data-label={
                                family === 'leads' ? 'زمان پیگیری' : 'مهلت حل'
                              }
                            >
                              <div>
                                {!('stage' in row) && row.pausedAt
                                  ? 'متوقف؛ منتظر پاسخ مشتری'
                                  : date(
                                      'stage' in row
                                        ? row.nextActionAt
                                        : row.resolutionDueAt,
                                    )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <footer className={s.pager}>
                    <span>
                      {number(loaded.total)} پرونده · صفحه {number(page)}
                      {board && view === 'leads'
                        ? ' · تعداد ستون‌ها مربوط به همین صفحه است'
                        : ''}
                    </span>
                    <div className={s.actions}>
                      <Button
                        variant="outline"
                        disabled={page <= 1}
                        onClick={() => change('page', String(page - 1))}
                      >
                        قبلی
                      </Button>
                      <Button
                        variant="outline"
                        disabled={page * 12 >= loaded.total}
                        onClick={() => change('page', String(page + 1))}
                      >
                        بعدی
                      </Button>
                    </div>
                  </footer>
                </section>
              </>
            )}
            {report && (
              <>
                <section className={s.hero}>
                  <span className={s.icon}>
                    <BarChart3 />
                  </span>
                  <div>
                    <h2>{title}</h2>
                    <p className={s.muted}>
                      داده‌های ثبت‌شده تا {date(report.generatedAt)}؛ در محدوده
                      دسترسی شما
                    </p>
                  </div>
                </section>
                <div className={s.columns}>
                  {view === 'reports' && (
                    <section className={s.panel}>
                      <div className={s.panelHead}>
                        <h2>توزیع مرحله‌ای سرنخ‌ها</h2>
                      </div>
                      <div className={s.panelBody}>
                        {report.leadStages.length ? (
                          report.leadStages.map((x) => (
                            <div key={x.stage} className={s.reportRow}>
                              <div>
                                <span>{stageLabel[x.stage] || x.stage}</span>
                                <strong>{number(x._count._all)}</strong>
                              </div>
                              <div className={s.bar}>
                                <i
                                  style={{
                                    width: `${(100 * x._count._all) / Math.max(1, ...report.leadStages.map((y) => y._count._all))}%`,
                                  }}
                                />
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className={s.empty}>داده‌ای ثبت نشده است.</p>
                        )}
                      </div>
                    </section>
                  )}
                  <section className={s.panel}>
                    <div className={s.panelHead}>
                      <h2>رضایت مشتری</h2>
                    </div>
                    <div className={s.panelBody}>
                      <p>
                        میانگین امتیاز:{' '}
                        {report.satisfaction.average === null
                          ? 'هنوز ثبت نشده'
                          : number(report.satisfaction.average)}
                      </p>
                      <p className={s.muted}>
                        {number(report.satisfaction.count)} پاسخ ثبت‌شده
                      </p>
                      <p className={s.muted}>
                        دعوت رضایت و جزئیات اقدام اصلاحی از داخل پرونده پشتیبانی
                        در دسترس است.
                      </p>
                      <Button
                        variant="outline"
                        onClick={() => navigate('tickets')}
                      >
                        مشاهده پرونده‌های پشتیبانی
                      </Button>
                    </div>
                  </section>
                </div>
                <section className={s.panel}>
                  <div className={s.panelHead}>
                    <h2>وضعیت تیکت‌ها و اقدام اصلاحی</h2>
                  </div>
                  <div className={s.panelBody}>
                    {report.ticketStatuses.map((x) => (
                      <div className={s.reportRow} key={x.status}>
                        {statusLabel[x.status] || x.status}:{' '}
                        {number(x._count._all)}
                      </div>
                    ))}
                    {!report.ticketStatuses.length && (
                      <p className={s.muted}>تیکتی ثبت نشده است.</p>
                    )}
                    <h3>اقدام‌های اصلاحی</h3>
                    {report.correctiveActions.map((item) => (
                      <p className={s.muted} key={item.status}>
                        {(
                          {
                            OPEN: 'باز',
                            IN_PROGRESS: 'در حال انجام',
                            COMPLETED: 'تکمیل‌شده',
                            CLOSED: 'بسته',
                          } as Record<string, string>
                        )[item.status] || item.status}
                        : {number(item._count._all)}
                      </p>
                    ))}
                    {!report.correctiveActions.length && (
                      <p className={s.muted}>اقدام اصلاحی ثبت نشده است.</p>
                    )}
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </>
    </div>
  );
}
