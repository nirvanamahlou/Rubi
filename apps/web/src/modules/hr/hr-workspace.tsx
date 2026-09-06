'use client';

import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Download,
  FileArchive,
  FileText,
  Filter,
  History,
  Info,
  LockKeyhole,
  MonitorCog,
  Plane,
  Plus,
  Search,
  ShieldCheck,
  TimerReset,
  UserRound,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import {
  employeeTabs,
  hrHubCards,
  iranLocalizationStatus,
  normalizeSection,
  previewId,
  screenMeta,
  sectionTabs,
  type HrSectionId,
  type HrTab,
} from './hr.model';
import { FrappeWorkspaceScreen } from './frappe-workspace';
import {
  frappeWorkspaceIdsByHubSection,
  getFrappeWorkspace,
  normalizeFrappeWorkspace,
} from './frappe-workspaces';
import styles from './hr-workspace.module.css';
import {
  NewEmployeeDialog,
  type NewEmployeeFormValue,
} from './new-employee-dialog';

type UiState = 'loading' | 'empty' | 'error' | 'unauthorized' | 'forbidden';
type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral';

interface PreviewEmployee {
  id: string;
  name: string;
  initial: string;
  employment: string;
  kind: string;
  unit: string;
  position: string;
  manager: string;
  startedAt: string;
  status: string;
  tone: BadgeTone;
  local?: boolean;
}

interface PreviewTableData {
  columns: readonly string[];
  rows: readonly (readonly ReactNode[])[];
  totalLabel: string;
}

const previewEmployees: readonly PreviewEmployee[] = [
  {
    id: 'preview-employee-1',
    name: 'همکار نمایشی الف',
    initial: 'الف',
    employment: 'preview-employment-1',
    kind: 'تمام‌وقت',
    unit: 'شعبه نمایشی / عملیات سفر',
    position: 'کارشناس ارشد عملیات',
    manager: 'مدیر نمایشی الف',
    startedAt: '۱۴۰۳/۰۲/۰۱',
    status: 'فعال',
    tone: 'success',
  },
  {
    id: 'preview-employee-2',
    name: 'همکار نمایشی ب',
    initial: 'ب',
    employment: 'preview-employment-2',
    kind: 'تمام‌وقت',
    unit: 'شعبه نمایشی / فروش',
    position: 'سرپرست فروش سازمانی',
    manager: 'مدیر نمایشی ب',
    startedAt: '۱۴۰۱/۰۸/۱۵',
    status: 'فعال',
    tone: 'success',
  },
  {
    id: 'preview-employee-3',
    name: 'همکار نمایشی پ',
    initial: 'پ',
    employment: 'preview-employment-3',
    kind: 'پاره‌وقت',
    unit: 'شعبه نمایشی / مالی',
    position: 'کارشناس حسابداری',
    manager: 'مدیر نمایشی پ',
    startedAt: '۱۴۰۲/۰۶/۱۰',
    status: 'فعال',
    tone: 'success',
  },
  {
    id: 'preview-employee-4',
    name: 'همکار نمایشی ت',
    initial: 'ت',
    employment: 'preview-employment-4',
    kind: 'پاره‌وقت',
    unit: 'شعبه نمایشی / عملیات فرودگاهی',
    position: 'کارشناس خدمات فرودگاهی',
    manager: 'مدیر نمایشی ت',
    startedAt: '۱۴۰۵/۰۶/۲۰',
    status: 'در حال تکمیل',
    tone: 'warning',
  },
];

type DashboardPeriod = 'monthToDate' | 'week' | 'month';
type DashboardBranch = 'all' | 'central' | 'airport';
type DashboardUnit = 'all' | 'operations' | 'sales' | 'finance';
type DashboardTone = 'blue' | 'green' | 'violet' | 'orange' | 'rose';

interface DashboardFilters {
  period: DashboardPeriod;
  branch: DashboardBranch;
  unit: DashboardUnit;
}

interface DashboardMetric {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: DashboardTone;
}

interface DashboardComposition {
  label: string;
  count: number;
  percentage: number;
}

interface DashboardSnapshot {
  metrics: readonly DashboardMetric[];
  trend: readonly number[];
  composition: readonly DashboardComposition[];
}

const defaultDashboardFilters: DashboardFilters = {
  period: 'monthToDate',
  branch: 'all',
  unit: 'all',
};

const formatFa = (value: number) =>
  new Intl.NumberFormat('fa-IR').format(value);

function buildDashboardSnapshot(filters: DashboardFilters): DashboardSnapshot {
  const branchFactor =
    filters.branch === 'all' ? 1 : filters.branch === 'central' ? 0.64 : 0.36;
  const unitFactor =
    filters.unit === 'all'
      ? 1
      : filters.unit === 'operations'
        ? 0.42
        : filters.unit === 'sales'
          ? 0.31
          : 0.18;
  const factor = branchFactor * unitFactor;
  const active = Math.max(8, Math.round(86 * factor));
  const present = Math.max(6, Math.round(active * 0.85));
  const away = Math.max(1, Math.round(active * 0.1));
  const attention = Math.max(1, Math.round(14 * factor));
  const contracts = Math.max(1, Math.round(7 * branchFactor));
  const requests = Math.max(2, Math.round(23 * factor));
  const overtimeBase =
    filters.period === 'week' ? 84 : filters.period === 'month' ? 312 : 286;
  const overtime = Math.max(12, Math.round(overtimeBase * factor));
  const quality = Math.max(
    88,
    94 -
      (filters.branch === 'airport' ? 2 : 0) -
      (filters.unit === 'finance' ? 1 : 0),
  );
  const fullTime = Math.max(1, Math.round(active * 0.8));
  const partTime = Math.max(1, Math.round(active * 0.13));
  const consultants = Math.max(1, active - fullTime - partTime);
  const composition = [
    { label: 'تمام‌وقت', count: fullTime },
    { label: 'پاره‌وقت', count: partTime },
    { label: 'مشاور', count: consultants },
  ].map((item) => ({
    ...item,
    percentage: Math.max(4, Math.round((item.count / active) * 100)),
  }));
  const trend = [72, 73, 75, 74, 77, 79, 78, 81, 83, 82, 85, 86].map((value) =>
    Math.max(6, Math.round((value / 86) * active)),
  );

  return {
    metrics: [
      {
        label: 'کارکنان فعال',
        value: formatFa(active),
        hint: `+${formatFa(Math.max(1, Math.round(4 * factor)))} این فصل`,
        icon: UsersRound,
        tone: 'blue',
      },
      {
        label: 'حاضر امروز',
        value: formatFa(present),
        hint: `${formatFa(Math.round((present / active) * 100))}٪ کارکنان فعال`,
        icon: BadgeCheck,
        tone: 'green',
      },
      {
        label: 'در مرخصی',
        value: formatFa(away),
        hint: `${formatFa(Math.max(1, away - 3))} مرخصی · ${formatFa(Math.min(3, away))} مأموریت`,
        icon: Plane,
        tone: 'violet',
      },
      {
        label: 'نیازمند رسیدگی',
        value: formatFa(attention),
        hint: `${formatFa(Math.max(1, Math.round(attention * 0.36)))} مورد فوری`,
        icon: AlertTriangle,
        tone: 'orange',
      },
      {
        label: 'قرارداد نزدیک پایان',
        value: formatFa(contracts),
        hint: '۲۰ روز آینده',
        icon: FileText,
        tone: 'rose',
      },
      {
        label: 'درخواست در انتظار',
        value: formatFa(requests),
        hint: 'میانگین پاسخ ۱٫۸ روز',
        icon: FileArchive,
        tone: 'blue',
      },
      {
        label: 'اضافه‌کاری مصوب',
        value: `${formatFa(overtime)} ساعت`,
        hint: filters.period === 'week' ? 'هفته جاری' : 'ماه جاری',
        icon: TimerReset,
        tone: 'violet',
      },
      {
        label: 'کیفیت داده',
        value: `${formatFa(quality)}٪`,
        hint: 'هدف ۹۸٪',
        icon: ShieldCheck,
        tone: 'green',
      },
    ],
    trend,
    composition,
  };
}

const requestKinds = [
  ['مرخصی', CalendarDays, 'blue'],
  ['مأموریت', Plane, 'violet'],
  ['اصلاح تردد', TimerReset, 'orange'],
  ['تجهیزات', MonitorCog, 'green'],
] as const;

const stateMessages: Record<UiState, [string, string]> = {
  loading: [
    'در حال دریافت اطلاعات',
    'اطلاعات منابع انسانی در حال بارگذاری است.',
  ],
  empty: [
    'رکوردی پیدا نشد',
    'فیلترها را تغییر دهید یا پس از اتصال منبع دوباره بررسی کنید.',
  ],
  error: [
    'دریافت اطلاعات انجام نشد',
    'ارتباط با سرویس برقرار نشد. دوباره تلاش کنید.',
  ],
  unauthorized: ['ورود لازم است', 'برای ادامه وارد حساب کاربری شوید.'],
  forbidden: ['دسترسی مجاز نیست', 'مجوز مشاهده این بخش یا شعبه را ندارید.'],
};

function ActionButton({
  children,
  disabled,
  primary,
  small,
  onClick,
  type = 'button',
}: {
  children: ReactNode;
  disabled?: boolean;
  primary?: boolean;
  small?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      className={`${styles.button} ${primary ? styles.buttonPrimary : ''} ${small ? styles.buttonSmall : ''}`}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
}

function PageHead({
  actions,
  section,
}: {
  actions?: ReactNode;
  section: HrSectionId;
}) {
  const meta = screenMeta[section];
  return (
    <header className={styles.pageHead}>
      <div className={styles.title}>
        <div className={styles.crumb}>
          خانه ‹ منابع انسانی{section === 'home' ? '' : ` ‹ ${meta.title}`}
        </div>
        <h1>{meta.title}</h1>
        <p>{meta.description}</p>
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}

function DateRangeBar({
  initialFrom = '2026-08-23',
  initialTo = '2026-09-22',
  onApply,
  summary = 'شهریور ۱۴۰۵ · داده نمایشی',
}: {
  initialFrom?: string;
  initialTo?: string;
  onApply?: (range: { from: string; to: string }) => void;
  summary?: string;
}) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [applied, setApplied] = useState(false);
  return (
    <section aria-label="بازه زمانی" className={styles.dateBar}>
      <div className={styles.dateLead}>بازه زمانی گزارش</div>
      <label className={styles.fieldLabel}>
        <span>از تاریخ</span>
        <DatePicker id="hr-from-date" onChange={setFrom} value={from} />
      </label>
      <label className={styles.fieldLabel}>
        <span>تا تاریخ</span>
        <DatePicker id="hr-to-date" onChange={setTo} value={to} />
      </label>
      <span className={styles.dateSummary}>
        {applied ? 'بازه آزمایشی اعمال شد' : summary}
      </span>
      <ActionButton
        onClick={() => {
          setApplied(true);
          onApply?.({ from, to });
        }}
        primary
      >
        <Filter aria-hidden="true" size={15} /> اعمال بازه
      </ActionButton>
    </section>
  );
}

function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: BadgeTone;
}) {
  const toneClass = {
    success: styles.badgeSuccess,
    warning: styles.badgeWarning,
    danger: styles.badgeDanger,
    neutral: styles.badgeNeutral,
  }[tone];
  return <span className={`${styles.badge} ${toneClass}`}>{children}</span>;
}

function Tabs({
  active,
  items,
  onChange,
}: {
  active: string;
  items: readonly HrTab[];
  onChange: (id: string) => void;
}) {
  return (
    <div aria-label="زیرصفحه‌های بخش" className={styles.tabs} role="tablist">
      {items.map((item) => {
        const Icon = item.icon;
        const selected = active === item.id;
        return (
          <button
            aria-selected={selected}
            className={`${styles.tab} ${selected ? styles.tabActive : ''}`}
            key={item.id}
            onClick={() => onChange(item.id)}
            role="tab"
            type="button"
          >
            <Icon aria-hidden="true" size={15} />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function Panel({
  action,
  children,
  icon,
  note,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  icon?: ReactNode;
  note?: string;
  title: string;
}) {
  return (
    <section className={styles.panel}>
      <header className={styles.panelHead}>
        <div>
          <div className={styles.panelTitle}>
            {icon}
            {title}
          </div>
          {note ? <div className={styles.panelNote}>{note}</div> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function PreviewTable({ data }: { data: PreviewTableData }) {
  return (
    <>
      <div className={styles.tableWrap} tabIndex={0}>
        <table className={styles.table}>
          <thead>
            <tr>
              {data.columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, rowIndex) => (
              <tr key={`preview-row-${rowIndex + 1}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.panelBody}>
        <span className={styles.source}>
          {data.totalLabel} · همه موارد این نما داده نمایشی هستند.
        </span>
      </div>
    </>
  );
}

function Person({ employee }: { employee: PreviewEmployee }) {
  return (
    <div className={styles.person}>
      <span className={styles.avatar}>{employee.initial}</span>
      <span>
        <b>{employee.name}</b>
        <small dir="ltr">employment: {employee.employment}</small>
      </span>
    </div>
  );
}

export function HrState({ state }: { state: UiState }) {
  const [title, message] = stateMessages[state];
  return (
    <section
      className={`${styles.panel} ${styles.fallback}`}
      role={state === 'error' ? 'alert' : 'status'}
    >
      <LockKeyhole aria-hidden="true" size={31} />
      <h2>{title}</h2>
      <p>{message}</p>
      {state === 'unauthorized' ? (
        <Link href="/login?next=/hr">ورود به سامانه</Link>
      ) : null}
    </section>
  );
}

function HubScreen() {
  return (
    <>
      <PageHead section="home" />
      <DateRangeBar />
      <div className={styles.boundary}>
        <Info aria-hidden="true" size={17} />
        اطلاعات شخص، کاربر، مشتری و سازمان هویت‌های مستقل‌اند؛ داده مالی و فایل
        باینری از قرارداد عمومی ماژول مالک دریافت می‌شود.
      </div>
      <section aria-label="بخش‌های منابع انسانی" className={styles.hubGrid}>
        {hrHubCards.map((card) => {
          const Icon = card.icon;
          const relatedWorkspaces = (
            frappeWorkspaceIdsByHubSection[card.id] ?? []
          ).map(getFrappeWorkspace);
          return (
            <article
              className={`${styles.hubCard} ${styles[card.tone]}`}
              key={card.id}
            >
              <Link className={styles.hubMain} href={`/hr?section=${card.id}`}>
                <div className={styles.hubTop}>
                  <span className={styles.hubIcon}>
                    <Icon aria-hidden="true" size={26} />
                  </span>
                  <div className={styles.hubCopy}>
                    <h2>{card.title}</h2>
                    <p>{card.description}</p>
                  </div>
                </div>
                <div className={styles.pills}>
                  {card.pills.map((pill) => (
                    <span className={styles.pill} key={pill}>
                      {pill}
                    </span>
                  ))}
                </div>
              </Link>
              {relatedWorkspaces.length ? (
                <div
                  aria-label={`فضاهای کاری Frappe مرتبط با ${card.title}`}
                  className={styles.hubWorkspaces}
                >
                  <span className={styles.hubWorkspacesLabel}>
                    امکانات Frappe HR
                  </span>
                  {relatedWorkspaces.map((workspace) => {
                    const WorkspaceIcon = workspace.icon;
                    const itemCount = workspace.groups.reduce(
                      (sum, group) => sum + group.items.length,
                      0,
                    );
                    return (
                      <Link
                        className={styles.hubWorkspaceLink}
                        href={`/hr?workspace=${workspace.id}`}
                        key={workspace.id}
                      >
                        <WorkspaceIcon aria-hidden="true" size={14} />
                        <span>{workspace.shortTitle}</span>
                        <small>{formatFa(itemCount)} امکان</small>
                      </Link>
                    );
                  })}
                </div>
              ) : null}
              <div className={styles.hubFoot}>
                <small>{card.footer}</small>
                <Link
                  className={styles.hubSectionLink}
                  href={`/hr?section=${card.id}`}
                >
                  ورود به بخش ←
                </Link>
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}

function DashboardKpiGrid({ items }: { items: readonly DashboardMetric[] }) {
  return (
    <section aria-label="شاخص‌های آزمایشی منابع انسانی" className={styles.kpis}>
      {items.map(({ hint, icon: Icon, label, tone, value }) => (
        <article className={styles.kpi} data-tone={tone} key={label}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>{label}</span>
            <span className={styles.kpiIcon}>
              <Icon aria-hidden="true" size={18} />
            </span>
          </div>
          <div
            aria-label={`${label}: ${value}، داده آزمایشی`}
            className={`${styles.kpiValue} ${value.includes(' ') ? styles.kpiValueCompact : ''}`}
          >
            {value}
          </div>
          <div className={styles.kpiTrend}>{hint}</div>
        </article>
      ))}
    </section>
  );
}

function KpiGrid({
  items,
}: {
  items: readonly (readonly [string, string, LucideIcon])[];
}) {
  return (
    <section aria-label="شاخص‌ها" className={styles.kpis}>
      {items.map(([label, hint, Icon]) => (
        <article className={styles.kpi} key={label}>
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>{label}</span>
            <span className={styles.kpiIcon}>
              <Icon aria-hidden="true" size={17} />
            </span>
          </div>
          <div aria-label="داده متصل موجود نیست" className={styles.kpiValue}>
            —
          </div>
          <div className={styles.kpiHint}>{hint} · پس از اتصال منبع</div>
        </article>
      ))}
    </section>
  );
}

function Dashboard({ openAction }: { openAction: (title: string) => void }) {
  const [draftFilters, setDraftFilters] = useState(defaultDashboardFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultDashboardFilters);
  const [filterStatus, setFilterStatus] = useState(
    'آخرین بروزرسانی: ۱۰:۳۸ · داده آزمایشی',
  );
  const snapshot = useMemo(
    () => buildDashboardSnapshot(appliedFilters),
    [appliedFilters],
  );
  const trendMin = Math.min(...snapshot.trend) - 2;
  const trendMax = Math.max(...snapshot.trend) + 2;
  const trendPoints = snapshot.trend.map((value, index) => {
    const x = 20 + (660 / (snapshot.trend.length - 1)) * index;
    const y = 180 - ((value - trendMin) / (trendMax - trendMin)) * 130;
    return { value, x: Math.round(x), y: Math.round(y) };
  });
  const linePoints = trendPoints.map(({ x, y }) => `${x},${y}`).join(' ');
  const areaPoints = `20,200 ${linePoints} 680,200`;
  const inbox: PreviewTableData = {
    columns: ['موضوع', 'کارمند', 'واحد', 'مرحله', 'موعد', 'وضعیت'],
    rows: [
      [
        'تغییر حساب مقصد',
        'همکار نمایشی الف',
        'عملیات سفر',
        'تأییدکننده دوم',
        'امروز',
        <Badge key="1" tone="danger">
          فوری
        </Badge>,
      ],
      [
        'تمدید قرارداد',
        'همکار نمایشی ب',
        'فروش سازمانی',
        'بررسی HR',
        '۲ روز دیگر',
        <Badge key="2" tone="warning">
          نزدیک موعد
        </Badge>,
      ],
      [
        'اصلاح تردد',
        'همکار نمایشی پ',
        'مالی',
        'مدیر مستقیم',
        'امروز',
        <Badge key="3">در انتظار</Badge>,
      ],
    ],
    totalLabel: '۳ ردیف پیش‌نمایش',
  };
  return (
    <>
      <PageHead section="dashboard" />
      <DateRangeBar
        initialFrom="2026-03-21"
        initialTo="2026-09-03"
        onApply={() =>
          setFilterStatus('بازه زمانی اعمال شد · داده آزمایشی بروزرسانی شد')
        }
        summary="انتخاب ماه و سال به‌صورت گردشی"
      />
      <section className={`${styles.panel} ${styles.filterBar}`}>
        <select
          aria-label="بازه گزارش"
          className={styles.control}
          onChange={(event) =>
            setDraftFilters((current) => ({
              ...current,
              period: event.target.value as DashboardPeriod,
            }))
          }
          value={draftFilters.period}
        >
          <option value="monthToDate">امروز — ۱۴ شهریور ۱۴۰۵</option>
          <option value="week">۷ روز اخیر</option>
          <option value="month">ماه کامل</option>
        </select>
        <select
          aria-label="شعبه"
          className={styles.control}
          onChange={(event) =>
            setDraftFilters((current) => ({
              ...current,
              branch: event.target.value as DashboardBranch,
            }))
          }
          value={draftFilters.branch}
        >
          <option value="all">همه شعب</option>
          <option value="central">دفتر مرکزی</option>
          <option value="airport">شعبه فرودگاه</option>
        </select>
        <select
          aria-label="واحد سازمانی"
          className={styles.control}
          onChange={(event) =>
            setDraftFilters((current) => ({
              ...current,
              unit: event.target.value as DashboardUnit,
            }))
          }
          value={draftFilters.unit}
        >
          <option value="all">همه واحدها</option>
          <option value="operations">عملیات سفر</option>
          <option value="sales">فروش سازمانی</option>
          <option value="finance">مالی</option>
        </select>
        <ActionButton
          onClick={() => {
            setAppliedFilters(draftFilters);
            setFilterStatus('فیلترها اعمال شد · داده آزمایشی بروزرسانی شد');
          }}
        >
          <Filter size={15} /> اعمال فیلتر
        </ActionButton>
        <span aria-live="polite" className={styles.filterStatus}>
          {filterStatus}
        </span>
      </section>
      <div style={{ height: 14 }} />
      <DashboardKpiGrid items={snapshot.metrics} />
      <section className={styles.grid3}>
        <div className={`${styles.panel} ${styles.chart} ${styles.span2}`}>
          <div className={styles.chartHead}>
            <b>روند تعداد کارکنان و ورود/خروج</b>
            <small>۱۲ ماه اخیر · داده آزمایشی</small>
          </div>
          <svg
            aria-label={`نمودار آزمایشی روند کارکنان؛ آخرین مقدار ${formatFa(snapshot.trend.at(-1) ?? 0)} نفر`}
            role="img"
            viewBox="0 0 700 220"
          >
            <defs>
              <linearGradient id="hrArea" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#1674e8" stopOpacity=".2" />
                <stop offset="1" stopColor="#1674e8" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              className={styles.chartGrid}
              d="M20 30H680M20 80H680M20 130H680M20 180H680"
            />
            <polygon className={styles.chartArea} points={areaPoints} />
            <polyline className={styles.chartLine} points={linePoints} />
            {trendPoints.map(({ value, x, y }, index) => (
              <circle
                aria-label={`${formatFa(value)} نفر`}
                className={styles.chartDot}
                cx={x}
                cy={y}
                key={`${x}-${value}`}
                r={index === trendPoints.length - 1 ? 6 : 4}
              />
            ))}
          </svg>
          <div aria-hidden="true" className={styles.chartLabels}>
            {['مهر', 'آذر', 'بهمن', 'فروردین', 'خرداد', 'شهریور'].map(
              (month) => (
                <span key={month}>{month}</span>
              ),
            )}
          </div>
        </div>
        <div className={`${styles.panel} ${styles.chart}`}>
          <div className={styles.chartHead}>
            <b>ترکیب کارکنان</b>
            <small>{formatFa(snapshot.trend.at(-1) ?? 0)} همکار آزمایشی</small>
          </div>
          <div className={styles.barList}>
            {snapshot.composition.map(({ count, label, percentage }) => (
              <div className={styles.barRow} key={label}>
                <span>{label}</span>
                <div className={styles.bar}>
                  <i style={{ width: `${percentage}%` }} />
                </div>
                <b>{formatFa(count)}</b>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className={styles.grid3}>
        <div className={styles.span2}>
          <Panel
            action={<Link href="/hr?section=requests">مشاهده همه</Link>}
            icon={<FileArchive size={17} />}
            title="کارتابل فوری مدیر HR"
          >
            <PreviewTable data={inbox} />
          </Panel>
        </div>
        <Panel icon={<AlertTriangle size={17} />} title="هشدارها">
          <div className={`${styles.panelBody} ${styles.alertList}`}>
            {(
              [
                [
                  'قراردادهای نزدیک پایان',
                  '۷ قرارداد · ۲۰ روز آینده',
                  FileText,
                ],
                ['مدارک منقضی', '۵ مدرک · بررسی این هفته', FileArchive],
                ['مغایرت‌های تردد', '۲ مغایرت · نیازمند تأیید', TimerReset],
              ] as const
            ).map(([title, hint, Icon]) => (
              <div className={styles.alert} key={String(title)}>
                <span className={styles.alertIcon}>
                  <Icon size={16} />
                </span>
                <div>
                  <b>{String(title)}</b>
                  <small>{String(hint)}</small>
                </div>
                <button
                  className={styles.textButton}
                  onClick={() => openAction(String(title))}
                  type="button"
                >
                  بررسی
                </button>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </>
  );
}

function Employees({
  employees,
  openAction,
}: {
  employees: readonly PreviewEmployee[];
  openAction: (title: string) => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () =>
      employees.filter((employee) =>
        `${employee.name} ${employee.id} ${employee.position}`.includes(
          query.trim(),
        ),
      ),
    [employees, query],
  );
  const data: PreviewTableData = {
    columns: [
      'کارمند',
      'کد پرسنلی',
      'نوع همکاری',
      'شعبه و واحد',
      'سمت',
      'مدیر مستقیم',
      'تاریخ شروع',
      'وضعیت',
      'عملیات',
    ],
    rows: filtered.map((employee) => [
      <Person employee={employee} key={employee.id} />,
      employee.id,
      employee.kind,
      employee.unit,
      employee.position,
      employee.manager,
      employee.startedAt,
      <Badge key={`${employee.id}-status`} tone={employee.tone}>
        {employee.status}
      </Badge>,
      employee.local ? (
        <button
          className={`${styles.button} ${styles.buttonSmall}`}
          disabled
          key={`${employee.id}-local`}
          title="پرونده موقت پس از اتصال API قابل مشاهده خواهد بود"
          type="button"
        >
          ثبت‌شده در نشست
        </button>
      ) : (
        <Link
          className={`${styles.button} ${styles.buttonSmall}`}
          href={`/hr?section=employee&employee=${employee.id}`}
          key={`${employee.id}-link`}
        >
          مشاهده پرونده <ArrowLeft size={14} />
        </Link>
      ),
    ]),
    totalLabel: `${filtered.length.toLocaleString('fa-IR')} پرونده نمایشی`,
  };
  return (
    <>
      <PageHead
        actions={
          <>
            <ActionButton disabled>
              <Download size={15} /> خروجی مجاز
            </ActionButton>
            <ActionButton onClick={() => openAction('ورود گروهی')}>
              ورود گروهی
            </ActionButton>
            <ActionButton onClick={() => openAction('کارمند جدید')} primary>
              <Plus size={15} /> کارمند جدید
            </ActionButton>
          </>
        }
        section="employees"
      />
      <DateRangeBar />
      <Panel title="فهرست کارکنان">
        <div className={styles.filterBar}>
          <label className={styles.fieldLabel}>
            <span>جست‌وجو</span>
            <span style={{ position: 'relative' }}>
              <Search
                aria-hidden="true"
                size={15}
                style={{ insetInlineStart: 10, position: 'absolute', top: 12 }}
              />
              <input
                className={`${styles.control} ${styles.searchControl}`}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="نام، کد پرسنلی یا سمت"
                style={{ paddingInlineStart: 32 }}
                value={query}
              />
            </span>
          </label>
          <select
            aria-label="وضعیت"
            className={styles.control}
            defaultValue="all"
          >
            <option value="all">همه وضعیت‌ها</option>
            <option value="active">فعال</option>
          </select>
          <select
            aria-label="شعبه"
            className={styles.control}
            defaultValue="all"
          >
            <option value="all">همه شعب</option>
            <option value="preview">شعبه نمایشی</option>
          </select>
          <select
            aria-label="واحد"
            className={styles.control}
            defaultValue="all"
          >
            <option value="all">همه واحدها</option>
            <option value="operations">عملیات سفر</option>
          </select>
          <ActionButton>
            <Filter size={15} /> فیلتر
          </ActionButton>
        </div>
        {filtered.length ? (
          <PreviewTable data={data} />
        ) : (
          <div className={styles.empty}>
            رکورد نمایشی مطابق جست‌وجو پیدا نشد.
          </div>
        )}
      </Panel>
    </>
  );
}

function EmployeeProfile({
  openAction,
}: {
  openAction: (title: string) => void;
}) {
  const [tab, setTab] = useState('summary');
  const active =
    employeeTabs.find((item) => item.id === tab) ?? employeeTabs[0];
  const ActiveIcon = active?.icon ?? UserRound;
  const summaryItems = [
    ['کد پرسنلی', 'preview-employee-1'],
    ['نوع همکاری', 'تمام‌وقت'],
    ['شعبه', 'شعبه نمایشی'],
    ['واحد', 'عملیات سفر'],
    ['سمت', 'کارشناس ارشد عملیات'],
    ['مدیر مستقیم', 'مدیر نمایشی الف'],
    ['اطلاعات بانکی', '••••••••'],
    ['شناسه هویتی', '••••••••'],
  ];
  return (
    <>
      <PageHead
        actions={
          <ActionButton onClick={() => openAction('تاریخچه پرونده')}>
            <History size={15} /> تاریخچه
          </ActionButton>
        }
        section="employee"
      />
      <DateRangeBar />
      <section className={styles.employeeBanner}>
        <span className={styles.profileAvatar}>الف</span>
        <div className={styles.employeeMain}>
          <h2>همکار نمایشی الف</h2>
          <div className={styles.employeeMeta}>
            <Badge tone="success">همکاری فعال</Badge>
            <span dir="ltr">preview-employee-1</span>
            <span>•</span>
            <span>کارشناس ارشد عملیات سفر</span>
            <span>•</span>
            <span>مدیر: مدیر نمایشی الف</span>
          </div>
        </div>
        <div className={styles.employeeActions}>
          <Link className={styles.button} href="/hr?section=employees">
            تغییر کارمند
          </Link>
          <ActionButton onClick={() => openAction('پرونده ۳۶۰ درجه')} primary>
            <UserRound size={15} /> پرونده ۳۶۰ درجه
          </ActionButton>
        </div>
      </section>
      <Tabs active={tab} items={employeeTabs} onChange={setTab} />
      <Panel
        icon={<ActiveIcon size={17} />}
        note="دسترسی این نما بر اساس نقش و دامنه سازمانی کنترل می‌شود."
        title={active?.label ?? 'مشخصات'}
      >
        <div className={styles.panelBody}>
          {tab === 'summary' ? (
            <div className={styles.summaryGrid}>
              {summaryItems.map(([label, value]) => (
                <div className={styles.summaryItem} key={label}>
                  <span>{label}</span>
                  <b>{value}</b>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className={styles.previewNote}>
                <Info size={16} />
                محتوای این تب پس از اتصال قرارداد عمومی ماژول مالک نمایش داده
                می‌شود. این نما هیچ داده حساس یا عملیاتی را شبیه‌سازی نمی‌کند.
              </div>
              <div className={styles.empty}>
                هنوز رکورد متصل برای «{active?.label}» وجود ندارد.
              </div>
            </>
          )}
        </div>
      </Panel>
    </>
  );
}

function genericTable(
  section: HrSectionId,
  tab: string,
  openAction: (title: string) => void,
): PreviewTableData {
  const operation = (
    <ActionButton
      key="action"
      onClick={() => openAction('مشاهده جزئیات')}
      small
    >
      مشاهده
    </ActionButton>
  );
  const id = (index: number) => (
    <span dir="ltr">{previewId(section, index)}</span>
  );
  if (section === 'recruitment')
    return {
      columns: [
        'شناسه',
        'عنوان',
        'واحد',
        'تعداد/مرحله',
        'بودجه',
        'مالک',
        'وضعیت',
        'عملیات',
      ],
      rows: [
        [
          id(0),
          tab === 'staffing' ? 'برنامه نیروی انسانی نمایشی' : 'فرصت نمایشی الف',
          'عملیات سفر',
          tab === 'interviews' ? 'مرحله فنی' : '—',
          '—',
          'کارشناس نمایشی HR',
          <Badge key="w" tone="warning">
            در جریان
          </Badge>,
          operation,
        ],
        [
          id(1),
          tab === 'referrals' ? 'معرفی نمایشی کارکنان' : 'متقاضی نمایشی ب',
          'فروش',
          tab === 'offers' ? 'پیشنهاد' : 'غربالگری',
          '—',
          'مدیر نمایشی ب',
          <Badge key="n">پیش‌نویس</Badge>,
          operation,
        ],
      ],
      totalLabel: '۲ ردیف جذب پیش‌نمایش',
    };
  if (section === 'lifecycle')
    return {
      columns: [
        'شناسه',
        'کارمند',
        'فرایند',
        'تاریخ اثر',
        'مسئول',
        'تسویه/دسترسی',
        'وضعیت',
        'عملیات',
      ],
      rows: [
        [
          id(0),
          'همکار نمایشی الف',
          tab,
          '۱۴۰۵/۰۶/۱۵',
          'کارشناس نمایشی HR',
          'در انتظار قرارداد عمومی',
          <Badge key="w" tone="warning">
            در جریان
          </Badge>,
          operation,
        ],
        [
          id(1),
          'همکار نمایشی ب',
          tab === 'settlement' ? 'تسویه نهایی نمایشی' : 'چک‌لیست نمایشی',
          '۱۴۰۵/۰۶/۲۰',
          'مدیر نمایشی ب',
          '—',
          <Badge key="n">پیش‌نویس</Badge>,
          operation,
        ],
      ],
      totalLabel: '۲ فرایند چرخه همکاری',
    };
  if (section === 'expenses')
    return {
      columns: [
        'شناسه',
        'کارمند',
        'نوع',
        'ارز',
        'مبلغ',
        'مرحله تأیید',
        'وضعیت مالی',
        'عملیات',
      ],
      rows: [
        [
          id(0),
          'همکار نمایشی الف',
          tab === 'advances' ? 'مساعده نمایشی' : 'هزینه سفر نمایشی',
          'IRR',
          '—',
          'تأیید مدیر',
          <Badge key="w" tone="warning">
            ارسال‌نشده
          </Badge>,
          operation,
        ],
        [
          id(1),
          'همکار نمایشی ب',
          tab === 'claims' ? 'بازپرداخت نمایشی' : 'مأموریت نمایشی',
          'USD',
          '—',
          'کنترل مالی',
          <Badge key="n">نیازمند نرخ معتبر</Badge>,
          operation,
        ],
      ],
      totalLabel: '۲ درخواست هزینه چندارزی',
    };
  if (section === 'benefits')
    return {
      columns: [
        'شناسه',
        'عنوان',
        'کارمند/دامنه',
        'تاریخ اثر',
        'مبلغ/نرخ',
        'مدرک',
        'وضعیت',
        'عملیات',
      ],
      rows: [
        [
          id(0),
          tab === 'taxSlabs' ? 'پله مالیاتی نمایشی' : 'قاعده مزایای نمایشی',
          'دامنه نمایشی',
          '۱۴۰۵/۰۱/۰۱',
          '—',
          'سند مرجع تأییدنشده',
          <Badge key="w" tone="warning">
            غیرفعال
          </Badge>,
          operation,
        ],
        [
          id(1),
          tab === 'loans' ? 'وام نمایشی' : 'درخواست نمایشی مزایا',
          'همکار نمایشی الف',
          '۱۴۰۵/۰۶/۱۵',
          '—',
          '••••••••',
          <Badge key="n">پیش‌نمایش</Badge>,
          operation,
        ],
      ],
      totalLabel: '۲ ردیف مالیات و مزایا',
    };
  if (section === 'fleet')
    return {
      columns: [
        'شناسه',
        'خودرو',
        'پلاک/شناسه حساس',
        'استفاده‌کننده',
        'بازه',
        'کیلومتر/هزینه',
        'وضعیت',
        'عملیات',
      ],
      rows: [
        [
          id(0),
          'خودروی نمایشی الف',
          '••••••••',
          'همکار نمایشی الف',
          'بازه نمایشی',
          '—',
          <Badge key="s" tone="success">
            تخصیص نمایشی
          </Badge>,
          operation,
        ],
        [
          id(1),
          'خودروی نمایشی ب',
          '••••••••',
          'تخصیص‌نیافته',
          '—',
          '—',
          <Badge key="n">آزاد</Badge>,
          operation,
        ],
      ],
      totalLabel: '۲ خودرو/سابقه پیش‌نمایش',
    };
  if (section === 'hrSettings')
    return {
      columns: [
        'شناسه',
        'قابلیت',
        'دامنه',
        'کنترل امنیتی',
        'وابستگی',
        'وضعیت',
        'عملیات',
      ],
      rows: [
        [
          id(0),
          tab === 'integrations' ? 'REST API و Webhook' : 'تنظیم نمایشی HR',
          'شرکت و شعبه',
          'IAM + Audit',
          'قرارداد عمومی',
          <Badge key="w" tone="warning">
            نیازمند اتصال
          </Badge>,
          operation,
        ],
        [
          id(1),
          tab === 'companies'
            ? 'تقویم شمسی و بومی‌سازی ایران'
            : 'گردش‌کار نمایشی',
          'چندشرکتی',
          'Deny by default',
          'تصمیم قانونی مصوب',
          <Badge key="n">Phase A</Badge>,
          operation,
        ],
      ],
      totalLabel: '۲ قابلیت تنظیمات پیش‌نمایش',
    };
  if (section === 'organization')
    return {
      columns: [
        'شناسه',
        'عنوان',
        'والد',
        'مسئول',
        'تاریخ اثر',
        'وضعیت',
        'عملیات',
      ],
      rows: [
        [
          id(0),
          tab === 'positions' ? 'سمت نمایشی' : 'واحد نمایشی الف',
          'ساختار نمایشی',
          'همکار نمایشی الف',
          '۱۴۰۵/۰۱/۰۱',
          <Badge key="s" tone="success">
            فعال
          </Badge>,
          operation,
        ],
        [
          id(1),
          tab === 'positions' ? 'شغل نمایشی' : 'واحد نمایشی ب',
          'ساختار نمایشی',
          'تعیین نشده',
          '۱۴۰۵/۰۱/۰۱',
          <Badge key="w" tone="warning">
            نیازمند تکمیل
          </Badge>,
          operation,
        ],
      ],
      totalLabel: '۲ ردیف پیش‌نمایش',
    };
  if (section === 'contracts')
    return {
      columns: [
        'شناسه',
        'کارمند',
        'نوع',
        'شروع',
        'پایان',
        'نسخه',
        'وضعیت',
        'عملیات',
      ],
      rows: [
        [
          id(0),
          'همکار نمایشی الف',
          tab === 'templates' ? 'قالب قرارداد' : 'تمام‌وقت',
          '۱۴۰۵/۰۱/۰۱',
          '۱۴۰۵/۱۲/۲۹',
          'preview-v1',
          <Badge key="s" tone="success">
            فعال
          </Badge>,
          operation,
        ],
        [
          id(1),
          'همکار نمایشی ب',
          'پاره‌وقت',
          '۱۴۰۴/۰۷/۰۱',
          '۱۴۰۵/۰۷/۳۰',
          'preview-v2',
          <Badge key="w" tone="warning">
            نیازمند بررسی
          </Badge>,
          operation,
        ],
      ],
      totalLabel: '۲ قرارداد نمایشی',
    };
  if (section === 'time')
    return {
      columns: [
        'شناسه',
        'کارمند',
        'دوره',
        'نوع',
        'مقدار معتبر',
        'نسخه منبع',
        'وضعیت',
        'عملیات',
      ],
      rows: [
        [
          id(0),
          'همکار نمایشی الف',
          'شهریور ۱۴۰۵',
          tab,
          '—',
          'preview-source-v1',
          <Badge key="s" tone="success">
            تأیید نمایشی
          </Badge>,
          operation,
        ],
        [
          id(1),
          'همکار نمایشی ب',
          'شهریور ۱۴۰۵',
          tab,
          '—',
          'preview-source-v1',
          <Badge key="w" tone="warning">
            در انتظار
          </Badge>,
          operation,
        ],
      ],
      totalLabel: '۲ ردیف پیش‌نمایش',
    };
  if (section === 'development')
    return {
      columns: [
        'شناسه',
        'کارمند',
        'موضوع',
        'دوره',
        'مسئول',
        'نتیجه',
        'وضعیت',
        'عملیات',
      ],
      rows: [
        [
          id(0),
          'همکار نمایشی الف',
          tab === 'skills' ? 'مهارت نمایشی' : 'برنامه توسعه نمایشی',
          'فصل جاری',
          'مدیر نمایشی الف',
          '—',
          <Badge key="w" tone="warning">
            در جریان
          </Badge>,
          operation,
        ],
        [
          id(1),
          'همکار نمایشی ب',
          'هدف نمایشی',
          'فصل جاری',
          'مدیر نمایشی ب',
          '—',
          <Badge key="n">پیش‌نویس</Badge>,
          operation,
        ],
      ],
      totalLabel: '۲ مورد پیش‌نمایش',
    };
  if (section === 'assets')
    return {
      columns: [
        'شناسه',
        'کارمند',
        'تجهیز',
        'برچسب دارایی',
        'تحویل',
        'وضعیت',
        'عملیات',
      ],
      rows: [
        [
          id(0),
          'همکار نمایشی الف',
          'تجهیز نمایشی الف',
          'preview-asset-1',
          '۱۴۰۵/۰۱/۱۵',
          <Badge key="s" tone="success">
            تحویل‌شده
          </Badge>,
          operation,
        ],
        [
          id(1),
          'همکار نمایشی ب',
          'تجهیز نمایشی ب',
          'preview-asset-2',
          '—',
          <Badge key="w" tone="warning">
            درخواست باز
          </Badge>,
          operation,
        ],
      ],
      totalLabel: '۲ تجهیز پیش‌نمایش',
    };
  if (section === 'documents')
    return {
      columns: [
        'شناسه',
        'کارمند',
        'نوع مدرک',
        'نسخه',
        'انقضا',
        'سطح دسترسی',
        'وضعیت',
        'عملیات',
      ],
      rows: [
        [
          id(0),
          'همکار نمایشی الف',
          'مدرک نمایشی الف',
          'preview-v1',
          '۱۴۰۶/۰۱/۱۵',
          'محرمانه',
          <Badge key="s" tone="success">
            بررسی‌شده
          </Badge>,
          operation,
        ],
        [
          id(1),
          'همکار نمایشی ب',
          'مدرک نمایشی ب',
          'preview-v1',
          '—',
          'محرمانه',
          <Badge key="w" tone="warning">
            نیازمند تکمیل
          </Badge>,
          operation,
        ],
      ],
      totalLabel: '۲ مدرک پیش‌نمایش',
    };
  if (section === 'finance')
    return {
      columns: [
        'شناسه',
        'دوره',
        'نسخه',
        'حساب مقصد',
        'مبلغ',
        'مالک',
        'وضعیت',
        'عملیات',
      ],
      rows: [
        [
          id(0),
          'شهریور ۱۴۰۵',
          'preview-v1',
          '••••••••',
          '—',
          'منابع انسانی',
          <Badge key="w" tone="warning">
            پیش‌نمایش
          </Badge>,
          operation,
        ],
        [
          id(1),
          'مرداد ۱۴۰۵',
          'preview-v1',
          '••••••••',
          '—',
          'مالی',
          <Badge key="n">فاقد اتصال</Badge>,
          operation,
        ],
      ],
      totalLabel: '۲ بسته پیش‌نمایش',
    };
  if (section === 'reports')
    return {
      columns: [
        'شناسه',
        'عنوان',
        'دامنه',
        'تاریخ مبنا',
        'مالک',
        'خروجی',
        'وضعیت',
        'عملیات',
      ],
      rows: [
        [
          id(0),
          'گزارش نیروی انسانی',
          'شعبه مجاز',
          'بازه انتخابی',
          'HR',
          'غیرفعال',
          <Badge key="n">بدون داده</Badge>,
          operation,
        ],
        [
          id(1),
          tab === 'access' ? 'کنترل دسترسی محرمانه' : 'Audit اختصاصی',
          'دامنه نقش',
          'بازه انتخابی',
          'امنیت',
          'غیرفعال',
          <Badge key="w" tone="warning">
            نیازمند منبع
          </Badge>,
          operation,
        ],
      ],
      totalLabel: '۲ گزارش پیش‌نمایش',
    };
  return {
    columns: ['شناسه', 'عنوان', 'دوره', 'نسخه', 'مقدار', 'وضعیت', 'عملیات'],
    rows: [
      [
        id(0),
        `رکورد نمایشی ${tab}`,
        'شهریور ۱۴۰۵',
        'preview-v1',
        '—',
        <Badge key="n">پیش‌نمایش</Badge>,
        operation,
      ],
    ],
    totalLabel: '۱ ردیف پیش‌نمایش',
  };
}

function OrganizationChart() {
  return (
    <div className={styles.orgChart}>
      <div className={`${styles.orgNode} ${styles.orgNodePrimary}`}>
        <b>مدیریت نمایشی</b>
        <small>همکار نمایشی الف</small>
      </div>
      <div className={styles.orgLevel}>
        <div className={styles.orgNode}>
          <b>واحد عملیات سفر</b>
          <small>۲ سمت نمایشی</small>
        </div>
        <div className={styles.orgNode}>
          <b>واحد فروش</b>
          <small>۲ سمت نمایشی</small>
        </div>
        <div className={styles.orgNode}>
          <b>واحد مالی</b>
          <small>۱ سمت نمایشی</small>
        </div>
      </div>
    </div>
  );
}

function Requests({ openAction }: { openAction: (title: string) => void }) {
  const tabs = sectionTabs.requests ?? [];
  const [tab, setTab] = useState(tabs[0]?.id ?? 'inbox');
  const data: PreviewTableData = {
    columns: [
      'شناسه',
      'نوع',
      'درخواست‌کننده',
      'ثبت',
      'مالک مرحله',
      'موعد',
      'مرحله فعلی',
      'اثر مالی',
      'وضعیت',
      'عملیات',
    ],
    rows: [
      [
        <span dir="ltr" key="i1">
          preview-request-1
        </span>,
        'تغییر حساب مقصد',
        'همکار نمایشی الف',
        'امروز',
        'تأییدکننده دوم',
        'امروز',
        'تأیید حساس',
        'نسخه مقصد بعدی',
        <Badge key="s1" tone="danger">
          فوری
        </Badge>,
        <ActionButton
          key="a1"
          onClick={() => openAction('درخواست نمایشی')}
          small
        >
          مشاهده
        </ActionButton>,
      ],
      [
        <span dir="ltr" key="i2">
          preview-request-2
        </span>,
        'مرخصی',
        'همکار نمایشی ب',
        'دیروز',
        'مدیر مستقیم',
        'امروز',
        'تأیید مدیر',
        'رزرو نمایشی',
        <Badge key="s2" tone="warning">
          در انتظار
        </Badge>,
        <ActionButton
          key="a2"
          onClick={() => openAction('درخواست نمایشی')}
          small
        >
          مشاهده
        </ActionButton>,
      ],
      [
        <span dir="ltr" key="i3">
          preview-request-3
        </span>,
        'مأموریت',
        'همکار نمایشی پ',
        'دیروز',
        'مالی',
        'فردا',
        'کنترل بودجه',
        '—',
        <Badge key="s3">در جریان</Badge>,
        <ActionButton
          key="a3"
          onClick={() => openAction('درخواست نمایشی')}
          small
        >
          مشاهده
        </ActionButton>,
      ],
    ],
    totalLabel: '۳ درخواست پیش‌نمایش',
  };
  return (
    <>
      <PageHead
        actions={
          <ActionButton onClick={() => openAction('درخواست جدید')} primary>
            <Plus size={15} /> درخواست جدید
          </ActionButton>
        }
        section="requests"
      />
      <DateRangeBar />
      <Tabs active={tab} items={tabs} onChange={setTab} />
      <section className={styles.requestCards}>
        {requestKinds.map(([title, Icon, tone]) => (
          <article className={styles.requestCard} key={title}>
            <span className={`${styles.hubIcon} ${styles[tone]}`}>
              <Icon size={21} />
            </span>
            <div>
              <b>{title}</b>
              <small>تعداد پس از اتصال منبع</small>
            </div>
          </article>
        ))}
      </section>
      <Panel title="کارتابل درخواست‌ها">
        {tab === 'mobile' ? (
          <div className={styles.panelBody}>
            <div className={styles.boundary}>
              <Info aria-hidden="true" size={17} />
              نمای موبایل برای ثبت و تأیید درخواست، مشاهده حضور و دریافت فیش
              آماده است؛ فعال‌سازی اعلان Push و داده عملیاتی به قرارداد IAM و
              سرویس‌های عمومی وابسته است.
            </div>
          </div>
        ) : null}
        <div className={styles.filterBar}>
          <input
            aria-label="جست‌وجوی درخواست"
            className={`${styles.control} ${styles.searchControl}`}
            placeholder="جست‌وجو در درخواست یا کارمند"
          />
          <select
            aria-label="کارتابل"
            className={styles.control}
            defaultValue="mine"
          >
            <option value="mine">کارتابل من</option>
            <option value="all">همه موارد مجاز</option>
          </select>
          <select
            aria-label="نوع درخواست"
            className={styles.control}
            defaultValue="all"
          >
            <option value="all">همه انواع</option>
            <option value="leave">مرخصی</option>
          </select>
          <ActionButton>
            <Filter size={15} /> فیلتر
          </ActionButton>
        </div>
        <PreviewTable data={data} />
      </Panel>
    </>
  );
}

function PayrollOverview({
  openAction,
}: {
  openAction: (title: string) => void;
}) {
  const data: PreviewTableData = {
    columns: ['مرحله', 'ورودی', 'نسخه', 'مسئول', 'تکمیل', 'وضعیت'],
    rows: [
      [
        'دریافت کارکرد',
        '—',
        'preview-calc-v1',
        'منابع انسانی',
        '—',
        <Badge key="n1">فاقد اتصال</Badge>,
      ],
      [
        'قرارداد و احکام',
        '—',
        'preview-hc-v1',
        'کارگزینی',
        '—',
        <Badge key="n2">فاقد اتصال</Badge>,
      ],
      [
        'محاسبه آزمایشی',
        '—',
        'preview-payrun-v1',
        'حقوق و دستمزد',
        '—',
        <Badge key="w" tone="warning">
          متوقف
        </Badge>,
      ],
      ['ارسال مالی', '—', '—', 'مالی', '—', <Badge key="n3">در انتظار</Badge>],
    ],
    totalLabel: 'چرخه نمایشی؛ اجرای حقوق غیرفعال است',
  };
  const payrollKpis: readonly (readonly [string, string, LucideIcon])[] = [
    ['ناخالص دوره', 'ارز و Decimal', WalletCards],
    ['کسورات', 'محاسبه قانونی', FileText],
    ['خالص پرداخت', 'پس از تأیید', BadgeCheck],
    ['مغایرت باز', 'کنترل مسدودکننده', AlertTriangle],
  ];
  return (
    <>
      <section className={styles.payrollHero}>
        <div>
          <h2>چرخه حقوق شهریور ۱۴۰۵</h2>
          <p>
            این نمای کنترل برای بررسی طراحی است. محاسبه قانونی، ثبت حقوق یا
            ارسال مالی تا اتصال سرویس‌های تأییدشده انجام نمی‌شود.
          </p>
        </div>
        <div className={styles.heroMetrics}>
          <div className={styles.heroMetric}>
            <small>کارکنان</small>
            <b>—</b>
          </div>
          <div className={styles.heroMetric}>
            <small>مرحله</small>
            <b>پیش‌نمایش</b>
          </div>
          <div className={styles.heroMetric}>
            <small>نسخه</small>
            <b dir="ltr">preview-v1</b>
          </div>
        </div>
      </section>
      <KpiGrid items={payrollKpis} />
      <Panel
        action={
          <ActionButton
            disabled
            onClick={() => openAction('اجرای حقوق')}
            primary
          >
            <Plus size={15} /> اجرای حقوق
          </ActionButton>
        }
        icon={<WalletCards size={17} />}
        note="محاسبه جاری، معوق و بین‌ماه با نسخه فرمول و تاریخ اثر مستقل"
        title="مراحل پردازش حقوق"
      >
        <PreviewTable data={data} />
      </Panel>
    </>
  );
}

function TabbedSection({
  section,
  openAction,
  initialTab,
}: {
  section: Exclude<
    HrSectionId,
    'home' | 'dashboard' | 'employees' | 'employee' | 'requests'
  >;
  openAction: (title: string) => void;
  initialTab?: string | undefined;
}) {
  const tabs = sectionTabs[section] ?? [];
  const [tab, setTab] = useState(
    tabs.some((item) => item.id === initialTab)
      ? (initialTab ?? 'list')
      : (tabs[0]?.id ?? 'list'),
  );
  const active = tabs.find((item) => item.id === tab);
  const ActiveIcon = active?.icon ?? FileText;
  const isPayrollOverview = section === 'payroll' && tab === 'overview';
  const data = genericTable(section, tab, openAction);
  return (
    <>
      <PageHead
        actions={
          <>
            <ActionButton disabled>
              <Download size={15} /> خروجی مجاز
            </ActionButton>
            <ActionButton
              onClick={() =>
                openAction(`ایجاد در ${screenMeta[section].title}`)
              }
              primary
            >
              <Plus size={15} /> مورد جدید
            </ActionButton>
          </>
        }
        section={section}
      />
      <DateRangeBar />
      {tabs.length ? (
        <Tabs active={tab} items={tabs} onChange={setTab} />
      ) : null}
      {isPayrollOverview ? (
        <PayrollOverview openAction={openAction} />
      ) : (
        <Panel
          icon={<ActiveIcon size={17} />}
          note="فقط شناسه‌ها و ردیف‌های صریحاً نمایشی نمایش داده شده‌اند."
          title={active?.label ?? screenMeta[section].title}
        >
          {section === 'organization' && tab === 'orgchart' ? (
            <OrganizationChart />
          ) : (
            <>
              {section === 'hrSettings' && tab === 'companies' ? (
                <div className={styles.panelBody}>
                  <div className={styles.previewNote}>
                    <Info aria-hidden="true" size={16} />
                    <span>
                      تقویم شمسی رابط فعال است. خروجی بیمه، مالیات و بانک ایران
                      تا دریافت قواعد قانونی نسخه‌دار و قراردادهای عمومی
                      تأییدشده غیرفعال می‌ماند.
                      <br />
                      {iranLocalizationStatus
                        .map((item) => `${item.label}: ${item.status}`)
                        .join(' · ')}
                    </span>
                  </div>
                </div>
              ) : null}
              <div className={styles.filterBar}>
                <input
                  aria-label="جست‌وجو"
                  className={`${styles.control} ${styles.searchControl}`}
                  placeholder="جست‌وجو در داده نمایشی"
                />
                <select
                  aria-label="وضعیت"
                  className={styles.control}
                  defaultValue="all"
                >
                  <option value="all">همه وضعیت‌ها</option>
                  <option value="active">فعال</option>
                </select>
                <ActionButton>
                  <Filter size={15} /> فیلتر
                </ActionButton>
              </div>
              <PreviewTable data={data} />
            </>
          )}
        </Panel>
      )}
    </>
  );
}

function PreviewDialog({ close, title }: { close: () => void; title: string }) {
  const [date, setDate] = useState('');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    close();
  }
  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) close();
      }}
      open
    >
      <DialogContent className={styles.modal} dir="rtl">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          این فرم فقط رفتار رابط را نمایش می‌دهد و هیچ اطلاعاتی ذخیره یا به
          سرویس دیگری ارسال نمی‌کند.
        </DialogDescription>
        <form onSubmit={submit}>
          <div className={styles.previewNote}>
            <Info size={16} />
            فقط داده نمایشی وارد کنید. اطلاعات واقعی کارکنان در این پیش‌نمایش
            مجاز نیست.
          </div>
          <div className={styles.formGrid}>
            <label className={styles.fieldLabel}>
              <span>عنوان نمایشی</span>
              <input
                className={styles.control}
                defaultValue="رکورد نمایشی"
                maxLength={100}
                required
              />
            </label>
            <label className={styles.fieldLabel}>
              <span>شناسه</span>
              <input
                className={styles.control}
                dir="ltr"
                disabled
                value="preview-new-record"
              />
            </label>
            <label className={styles.fieldLabel}>
              <span>تاریخ اثر</span>
              <DatePicker id="hr-dialog-date" onChange={setDate} value={date} />
            </label>
            <label className={styles.fieldLabel}>
              <span>اطلاعات حساس</span>
              <input
                aria-label="اطلاعات حساس پوشیده"
                className={styles.control}
                disabled
                value="••••••••"
              />
            </label>
          </div>
          <div className={styles.modalFooter}>
            <ActionButton onClick={close}>انصراف</ActionButton>
            <ActionButton primary type="submit">
              اعمال در پیش‌نمایش
            </ActionButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function HrWorkspace({
  sectionId,
  tabId,
  workspaceId,
}: {
  sectionId?: string | undefined;
  tabId?: string | undefined;
  workspaceId?: string | undefined;
}) {
  const section = normalizeSection(sectionId);
  const workspace = normalizeFrappeWorkspace(workspaceId);
  const [employees, setEmployees] =
    useState<readonly PreviewEmployee[]>(previewEmployees);
  const [dialogTitle, setDialogTitle] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  function closeDialog() {
    if (dialogTitle)
      setNotice('عملیات فقط در پیش‌نمایش بررسی شد؛ ذخیره دائمی انجام نشد.');
    setDialogTitle(null);
  }
  const openAction = (title: string) => {
    setNotice('');
    setDialogTitle(title);
  };
  const addEmployee = (value: NewEmployeeFormValue) => {
    const name = `${value.firstName} ${value.lastName}`.trim();
    const statusTone: Record<NewEmployeeFormValue['status'], BadgeTone> = {
      فعال: 'success',
      'در حال تکمیل': 'warning',
      'تعلیق‌شده': 'neutral',
    };
    const date = new Date(`${value.startedAt}T12:00:00.000Z`);
    const startedAt = Number.isNaN(date.getTime())
      ? value.startedAt
      : new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }).format(date);
    setEmployees((current) => [
      {
        id: value.personnelCode,
        name,
        initial: value.firstName.charAt(0),
        employment: `preview-employment-${value.personnelCode}`,
        kind: value.employmentType,
        unit: `${value.branch} / ${value.unit}`,
        position: value.position,
        manager: value.manager,
        startedAt,
        status: value.status,
        tone: statusTone[value.status],
        local: true,
      },
      ...current,
    ]);
    setDialogTitle(null);
    setNotice(`کارمند «${name}» به فهرست موقت این نشست اضافه شد.`);
  };
  let screen: ReactNode;
  if (workspace) screen = <FrappeWorkspaceScreen workspaceId={workspace} />;
  else if (section === 'home') screen = <HubScreen />;
  else if (section === 'dashboard')
    screen = <Dashboard openAction={openAction} />;
  else if (section === 'employees')
    screen = <Employees employees={employees} openAction={openAction} />;
  else if (section === 'employee')
    screen = <EmployeeProfile openAction={openAction} />;
  else if (section === 'requests')
    screen = <Requests openAction={openAction} />;
  else
    screen = (
      <TabbedSection
        initialTab={tabId}
        openAction={openAction}
        section={section}
      />
    );
  return (
    <main
      className={styles.workspace}
      data-hr-mode="preview"
      dir="rtl"
      lang="fa"
    >
      {notice ? (
        <div className={styles.notice} role="status">
          <BadgeCheck aria-hidden="true" size={17} />
          {notice}
        </div>
      ) : null}
      {screen}
      {dialogTitle === 'کارمند جدید' ? (
        <NewEmployeeDialog
          existingPersonnelCodes={employees.map((employee) => employee.id)}
          managerOptions={employees.map((employee) => employee.name)}
          onClose={() => setDialogTitle(null)}
          onSubmit={addEmployee}
        />
      ) : dialogTitle ? (
        <PreviewDialog close={closeDialog} title={dialogTitle} />
      ) : null}
    </main>
  );
}
