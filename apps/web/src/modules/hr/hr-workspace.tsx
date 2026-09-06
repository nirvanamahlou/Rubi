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
  PencilLine,
  Plus,
  Search,
  ShieldCheck,
  TimerReset,
  Trash2,
  UserRound,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import {
  initialOrganizationNodes,
  OrganizationChart,
  OrganizationNodeDialog,
  synchronizeOrganizationChartWithCatalog,
  type OrganizationNode,
  type OrganizationNodeFormValue,
} from './organization-chart';
import {
  initialOrganizationCatalogRecords,
  isOrganizationCatalogTab,
  OrganizationCatalogDialog,
  organizationCatalogSchemas,
  OrganizationCatalogTable,
  type OrganizationCatalogFormValue,
  type OrganizationCatalogRecords,
  type OrganizationCatalogTab,
} from './organization-catalog';
import {
  ContextualHrFormDialog,
  type ContextualHrFormContext,
} from './contextual-hr-form';
import {
  getHrPreviewDataset,
  type HrPreviewCell,
  type HrPreviewDataset,
  type HrPreviewTone,
} from './hr-preview-data';

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
  startedAtValue: string;
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
    unit: 'نیایش سیر / عملیات سفر',
    position: 'کارشناس ارشد عملیات',
    manager: 'مدیر نمایشی الف',
    startedAt: '۱۴۰۳/۰۲/۰۱',
    startedAtValue: '2024-04-20',
    status: 'فعال',
    tone: 'success',
  },
  {
    id: 'preview-employee-2',
    name: 'همکار نمایشی ب',
    initial: 'ب',
    employment: 'preview-employment-2',
    kind: 'تمام‌وقت',
    unit: 'نیایش سیر / فروش',
    position: 'سرپرست فروش سازمانی',
    manager: 'مدیر نمایشی ب',
    startedAt: '۱۴۰۱/۰۸/۱۵',
    startedAtValue: '2022-11-06',
    status: 'فعال',
    tone: 'success',
  },
  {
    id: 'preview-employee-3',
    name: 'همکار نمایشی پ',
    initial: 'پ',
    employment: 'preview-employment-3',
    kind: 'پاره‌وقت',
    unit: 'جهان باستان / مالی',
    position: 'کارشناس حسابداری',
    manager: 'مدیر نمایشی پ',
    startedAt: '۱۴۰۲/۰۶/۱۰',
    startedAtValue: '2023-09-01',
    status: 'فعال',
    tone: 'success',
  },
  {
    id: 'preview-employee-4',
    name: 'همکار نمایشی ت',
    initial: 'ت',
    employment: 'preview-employment-4',
    kind: 'پاره‌وقت',
    unit: 'جهان باستان / عملیات فرودگاهی',
    position: 'کارشناس خدمات فرودگاهی',
    manager: 'مدیر نمایشی ت',
    startedAt: '۱۴۰۵/۰۶/۲۰',
    startedAtValue: '2026-09-11',
    status: 'در حال تکمیل',
    tone: 'warning',
  },
];

type PreviewDatasetOverrides = Record<
  string,
  readonly (readonly HrPreviewCell[])[]
>;

type HrMutationAction = 'create' | 'edit' | 'delete';

export interface AutomaticHrHistoryEvent {
  action: HrMutationAction;
  section: HrSectionId;
  tab: string;
  title: string;
  subject: string;
  occurredAt?: string;
  eventId?: string;
}

const previewDatasetStorageKey = 'rubi.hr.preview-dataset-overrides.v1';

const isPreviewCell = (value: unknown): value is HrPreviewCell => {
  if (typeof value === 'string') return true;
  if (!value || typeof value !== 'object') return false;
  const cell = value as Record<string, unknown>;
  return (
    typeof cell.label === 'string' &&
    ['neutral', 'success', 'warning', 'danger'].includes(String(cell.tone))
  );
};

export function parseHrPreviewDatasetOverrides(
  serialized: string | null,
): PreviewDatasetOverrides {
  if (!serialized) return {};
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return {};
    const result: PreviewDatasetOverrides = {};
    for (const [key, rows] of Object.entries(parsed)) {
      if (
        Array.isArray(rows) &&
        rows.every(
          (row) =>
            Array.isArray(row) && row.every((cell) => isPreviewCell(cell)),
        )
      )
        result[key] = rows as readonly (readonly HrPreviewCell[])[];
    }
    return result;
  } catch {
    return {};
  }
}

interface PreviewDatasetStore {
  getDataset: (section: HrSectionId, tab: string) => HrPreviewDataset;
  deleteRow: (section: HrSectionId, tab: string, rowIndex: number) => void;
}

const previewDatasetKey = (section: HrSectionId, tab: string) =>
  `${section}:${tab}`;

const automaticHrHistoryTabs = new Set([
  previewDatasetKey('employee', 'audit'),
  previewDatasetKey('fleet', 'logs'),
  previewDatasetKey('reports', 'audit'),
]);

export const isAutomaticHrHistoryTab = (section: HrSectionId, tab: string) =>
  automaticHrHistoryTabs.has(previewDatasetKey(section, tab));

const previewCellText = (cell: HrPreviewCell) =>
  typeof cell === 'string' ? cell : cell.label;

const previewToneForStatus = (label: string): HrPreviewTone => {
  if (/فوری|رد|خطا|مسدود|لغو/.test(label)) return 'danger';
  if (/فعال|تأیید|تکمیل|آماده|منتشر|معتبر|مصوب|برگزار/.test(label))
    return 'success';
  if (/انتظار|بررسی|در حال|نیازمند|متوقف/.test(label)) return 'warning';
  return 'neutral';
};

export function removeHrPreviewRow(
  rows: readonly (readonly HrPreviewCell[])[],
  rowIndex: number,
): readonly (readonly HrPreviewCell[])[] {
  return rows.filter((_, index) => index !== rowIndex);
}

export function saveHrPreviewRow(
  rows: readonly (readonly HrPreviewCell[])[],
  columns: readonly string[],
  values: readonly string[],
  rowIndex?: number,
): readonly (readonly HrPreviewCell[])[] {
  const existingRow = rowIndex === undefined ? undefined : rows[rowIndex];
  const nextRow = values.map((value, index): HrPreviewCell => {
    const column = columns[index] ?? '';
    const previous = existingRow?.[index];
    if (typeof previous === 'object' || column.includes('وضعیت'))
      return { label: value, tone: previewToneForStatus(value) };
    return value;
  });
  return rowIndex === undefined
    ? [nextRow, ...rows]
    : rows.map((row, index) => (index === rowIndex ? nextRow : row));
}

const mutationActionLabel: Readonly<Record<HrMutationAction, string>> = {
  create: 'ایجاد',
  edit: 'ویرایش',
  delete: 'حذف',
};

const automaticHistoryStatus: HrPreviewCell = {
  label: 'ثبت‌شده',
  tone: 'success',
};

const appendHistoryRow = (
  overrides: PreviewDatasetOverrides,
  section: HrSectionId,
  tab: string,
  row: readonly HrPreviewCell[],
): PreviewDatasetOverrides => {
  const key = previewDatasetKey(section, tab);
  const rows = overrides[key] ?? getHrPreviewDataset(section, tab).rows;
  return { ...overrides, [key]: [row, ...rows] };
};

const formatHistoryTimestamp = (date: Date) =>
  new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);

export function appendAutomaticHrHistory(
  overrides: PreviewDatasetOverrides,
  event: AutomaticHrHistoryEvent,
): PreviewDatasetOverrides {
  const eventId =
    event.eventId ?? `HR-AUDIT-${Date.now().toString(36).toUpperCase()}`;
  const timestamp = event.occurredAt ?? formatHistoryTimestamp(new Date());
  const action = mutationActionLabel[event.action];
  const eventLabel = `${action} ${event.title}`;
  const traceId = `trace-${eventId.slice(-8)}`;
  let next = appendHistoryRow(overrides, 'reports', 'audit', [
    eventId,
    eventLabel,
    'کاربر جاری',
    screenMeta[event.section].title,
    timestamp,
    traceId,
    'موفق',
    automaticHistoryStatus,
  ]);

  if (event.section === 'employees' || event.section === 'employee')
    next = appendHistoryRow(next, 'employee', 'audit', [
      `HR-EMP-AUDIT-${eventId.slice(-8)}`,
      `${eventLabel}: ${event.subject}`,
      'کاربر جاری',
      timestamp,
      'عملیات پرونده کارکنان',
      traceId,
      automaticHistoryStatus,
    ]);

  if (event.section === 'fleet' && event.tab === 'vehicles')
    next = appendHistoryRow(next, 'fleet', 'logs', [
      `HR-FLEET-LOG-${eventId.slice(-8)}`,
      event.subject,
      'ثبت سیستمی',
      timestamp.split('،')[0] ?? timestamp,
      '—',
      '—',
      '—',
      `${eventLabel} در رجیستر خودرو`,
      automaticHistoryStatus,
    ]);

  return next;
}

const employeeFormValue = (employee: PreviewEmployee): NewEmployeeFormValue => {
  const [branch = 'نیایش سیر', unit = 'عملیات سفر'] =
    employee.unit.split(' / ');
  const nameParts = employee.name.trim().split(/\s+/);
  return {
    firstName: nameParts.shift() ?? '',
    lastName: nameParts.join(' '),
    personnelCode: employee.id,
    employmentType: employee.kind,
    branch,
    unit,
    position: employee.position,
    manager: employee.manager,
    startedAt: employee.startedAtValue,
    status: employee.status as NewEmployeeFormValue['status'],
  };
};

type DashboardPeriod = 'monthToDate' | 'week' | 'month';
type DashboardBranch = 'all' | 'niyayeshSeir' | 'jahanBastan';
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
    filters.branch === 'all'
      ? 1
      : filters.branch === 'niyayeshSeir'
        ? 0.64
        : 0.36;
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
      (filters.branch === 'jahanBastan' ? 2 : 0) -
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
  summary,
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
        {summary ? (applied ? 'بازه آزمایشی اعمال شد' : summary) : null}
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
          <option value="niyayeshSeir">نیایش سیر</option>
          <option value="jahanBastan">جهان باستان</option>
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
  onCreate,
  onDelete,
  onEdit,
}: {
  employees: readonly PreviewEmployee[];
  onCreate: () => void;
  onDelete: (employee: PreviewEmployee) => void;
  onEdit: (employee: PreviewEmployee) => void;
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
      <div className={styles.rowActions} key={`${employee.id}-actions`}>
        {!employee.local ? (
          <Link
            className={`${styles.button} ${styles.buttonSmall}`}
            href={`/hr?section=employee&employee=${employee.id}`}
          >
            مشاهده <ArrowLeft size={14} />
          </Link>
        ) : null}
        <ActionButton onClick={() => onEdit(employee)} small>
          <PencilLine aria-hidden="true" size={13} /> ویرایش
        </ActionButton>
        <button
          aria-label={`حذف کارمند ${employee.name}`}
          className={`${styles.button} ${styles.buttonSmall} ${styles.buttonDanger}`}
          onClick={() => {
            if (
              window.confirm(
                `«${employee.name}» از فهرست موقت کارکنان حذف شود؟`,
              )
            )
              onDelete(employee);
          }}
          type="button"
        >
          <Trash2 aria-hidden="true" size={13} /> حذف
        </button>
      </div>,
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
            <ActionButton onClick={onCreate} primary>
              <Plus size={15} /> کارمند جدید
            </ActionButton>
          </>
        }
        section="employees"
      />
      <DateRangeBar />
      <Panel title="فهرست کارکنان">
        <div className={`${styles.filterBar} ${styles.employeeFilters}`}>
          <label className={styles.fieldLabel}>
            <span>جست‌وجو</span>
            <div className={styles.searchInputWrap}>
              <Search
                aria-hidden="true"
                className={styles.searchInputIcon}
                size={15}
              />
              <input
                className={`${styles.control} ${styles.searchControl}`}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="نام، کد پرسنلی یا سمت"
                value={query}
              />
            </div>
          </label>
          <label className={styles.fieldLabel}>
            <span>وضعیت</span>
            <select
              aria-label="وضعیت"
              className={styles.control}
              defaultValue="all"
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="active">فعال</option>
            </select>
          </label>
          <label className={styles.fieldLabel}>
            <span>شعبه</span>
            <select
              aria-label="شعبه"
              className={styles.control}
              defaultValue="all"
            >
              <option value="all">همه شعب</option>
              <option value="niyayeshSeir">نیایش سیر</option>
              <option value="jahanBastan">جهان باستان</option>
            </select>
          </label>
          <label className={styles.fieldLabel}>
            <span>واحد</span>
            <select
              aria-label="واحد"
              className={styles.control}
              defaultValue="all"
            >
              <option value="all">همه واحدها</option>
              <option value="operations">عملیات سفر</option>
            </select>
          </label>
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
  openForm,
  datasetStore,
  initialTab,
}: {
  openAction: (title: string) => void;
  openForm: (context: ContextualHrFormContext) => void;
  datasetStore: PreviewDatasetStore;
  initialTab?: string | undefined;
}) {
  const [tab, setTab] = useState(
    employeeTabs.some((item) => item.id === initialTab)
      ? (initialTab ?? 'summary')
      : 'summary',
  );
  const active =
    employeeTabs.find((item) => item.id === tab) ?? employeeTabs[0];
  const ActiveIcon = active?.icon ?? UserRound;
  const dataset = datasetStore.getDataset('employee', tab);
  const isAutomaticHistory = isAutomaticHrHistoryTab('employee', tab);
  const profileData =
    tab === 'summary'
      ? null
      : isAutomaticHistory
        ? readonlyTable(dataset)
        : genericTable(
            dataset,
            (rowIndex, row) =>
              openForm({
                section: 'employee',
                tab,
                title: active?.label ?? 'پرونده کارمند',
                description: screenMeta.employee.description,
                columns: dataset.columns,
                mode: 'edit',
                rowIndex,
                initialValues: row.map(previewCellText),
              }),
            (rowIndex) => datasetStore.deleteRow('employee', tab, rowIndex),
          );
  const summaryItems = [
    ['کد پرسنلی', 'preview-employee-1'],
    ['نوع همکاری', 'تمام‌وقت'],
    ['شعبه', 'نیایش سیر'],
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
          <ActionButton onClick={() => setTab('audit')}>
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
        note={
          isAutomaticHistory
            ? 'این سابقه به‌صورت خودکار از عملیات پرونده ساخته می‌شود.'
            : 'دسترسی این نما بر اساس نقش و دامنه سازمانی کنترل می‌شود.'
        }
        title={active?.label ?? 'مشخصات'}
      >
        <div className={styles.panelBody}>
          {isAutomaticHistory ? <AutomaticHistoryNotice /> : null}
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
            profileData && <PreviewTable data={profileData} />
          )}
        </div>
      </Panel>
    </>
  );
}

function genericTable(
  dataset: HrPreviewDataset,
  editRow: (rowIndex: number, row: readonly HrPreviewCell[]) => void,
  deleteRow: (rowIndex: number) => void,
): PreviewTableData {
  const readonlyData = readonlyTable(dataset);
  return {
    columns: [...readonlyData.columns, 'عملیات'],
    rows: dataset.rows.map((row, rowIndex) => [
      ...(readonlyData.rows[rowIndex] ?? []),
      <div className={styles.rowActions} key={`actions-${rowIndex}`}>
        <ActionButton onClick={() => editRow(rowIndex, row)} small>
          <PencilLine aria-hidden="true" size={13} /> ویرایش
        </ActionButton>
        <button
          aria-label={`حذف ${previewCellText(row[0] ?? '')}`}
          className={`${styles.button} ${styles.buttonSmall} ${styles.buttonDanger}`}
          onClick={() => {
            if (
              window.confirm(
                `«${previewCellText(row[0] ?? '')}» از داده‌های موقت این نشست حذف شود؟`,
              )
            )
              deleteRow(rowIndex);
          }}
          type="button"
        >
          <Trash2 aria-hidden="true" size={13} /> حذف
        </button>
      </div>,
    ]),
    totalLabel: dataset.totalLabel,
  };
}

function readonlyTable(dataset: HrPreviewDataset): PreviewTableData {
  return {
    columns: dataset.columns,
    rows: dataset.rows.map((row, rowIndex) =>
      row.map((cell, cellIndex) => {
        if (typeof cell !== 'string')
          return (
            <Badge key={`status-${rowIndex}`} tone={cell.tone}>
              {cell.label}
            </Badge>
          );
        if (cellIndex === 0)
          return (
            <span dir="ltr" key={`id-${rowIndex}`}>
              {cell}
            </span>
          );
        return cell;
      }),
    ),
    totalLabel: dataset.totalLabel,
  };
}

function AutomaticHistoryNotice() {
  return (
    <div className={styles.previewNote} role="note">
      <History aria-hidden="true" size={16} />
      <span>
        رکوردهای این بخش از عملیات مرتبط به‌صورت خودکار ثبت می‌شوند و افزودن،
        ویرایش یا حذف دستی ندارند.
      </span>
    </div>
  );
}
function OrganizationSection({
  initialTab,
  onMutation,
}: {
  initialTab?: string | undefined;
  onMutation: (
    action: HrMutationAction,
    tab: string,
    title: string,
    subject: string,
  ) => void;
}) {
  const tabs = sectionTabs.organization ?? [];
  const [tab, setTab] = useState(
    tabs.some((item) => item.id === initialTab)
      ? (initialTab ?? 'orgchart')
      : 'orgchart',
  );
  const [nodes, setNodes] = useState<readonly OrganizationNode[]>(
    initialOrganizationNodes,
  );
  const [catalogRecords, setCatalogRecords] =
    useState<OrganizationCatalogRecords>(initialOrganizationCatalogRecords);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<
    OrganizationNode | undefined
  >();
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false);
  const [catalogDialogTab, setCatalogDialogTab] =
    useState<OrganizationCatalogTab>('branches');
  const [editingCatalogRecord, setEditingCatalogRecord] = useState<
    OrganizationCatalogFormValue | undefined
  >();
  const [organizationNotice, setOrganizationNotice] = useState('');
  const active = tabs.find((item) => item.id === tab);
  const ActiveIcon = active?.icon ?? FileText;
  const catalogTab = isOrganizationCatalogTab(tab) ? tab : null;

  const openCreate = () => {
    setEditingNode(undefined);
    setOrganizationNotice('');
    setDialogOpen(true);
  };
  const openEdit = (node: OrganizationNode) => {
    setEditingNode(node);
    setOrganizationNotice('');
    setDialogOpen(true);
  };
  const openCatalogCreate = (nextTab: OrganizationCatalogTab) => {
    setCatalogDialogTab(nextTab);
    setEditingCatalogRecord(undefined);
    setOrganizationNotice('');
    setCatalogDialogOpen(true);
  };
  const openCatalogEdit = (
    nextTab: OrganizationCatalogTab,
    record: OrganizationCatalogFormValue,
  ) => {
    setCatalogDialogTab(nextTab);
    setEditingCatalogRecord(record);
    setOrganizationNotice('');
    setCatalogDialogOpen(true);
  };
  const saveNode = (value: OrganizationNodeFormValue) => {
    if (editingNode?.catalogSource) {
      const sourceTab =
        editingNode.catalogSource === 'branch' ? 'branches' : 'units';
      const sourceRecord = catalogRecords[sourceTab].find(
        (record) => record.id === editingNode.id,
      );
      if (sourceRecord) {
        const parentNode = nodes.find((node) => node.id === value.parentId);
        const nextRecord: OrganizationCatalogFormValue = {
          ...sourceRecord,
          title: value.name,
          branch:
            editingNode.catalogSource === 'branch' ? value.name : value.branch,
          parent: parentNode?.catalogSource === 'unit' ? parentNode.name : '',
          manager: value.manager,
          effectiveFrom: value.effectiveFrom,
          status: value.status,
        };
        let nextRecords: OrganizationCatalogRecords = {
          ...catalogRecords,
          [sourceTab]: catalogRecords[sourceTab].map((record) =>
            record.id === sourceRecord.id ? nextRecord : record,
          ),
        };
        if (sourceRecord.title !== nextRecord.title) {
          if (sourceTab === 'branches')
            nextRecords = {
              ...nextRecords,
              units: nextRecords.units.map((unit) =>
                unit.branch === sourceRecord.title
                  ? { ...unit, branch: nextRecord.title }
                  : unit,
              ),
            };
          else
            nextRecords = {
              ...nextRecords,
              units: nextRecords.units.map((unit) =>
                unit.parent === sourceRecord.title
                  ? { ...unit, parent: nextRecord.title }
                  : unit,
              ),
              positions: nextRecords.positions.map((position) =>
                position.unit === sourceRecord.title
                  ? { ...position, unit: nextRecord.title }
                  : position,
              ),
            };
        }
        setCatalogRecords(nextRecords);
        setNodes((current) =>
          synchronizeOrganizationChartWithCatalog(current, nextRecords),
        );
        setOrganizationNotice(
          `گره «${nextRecord.title}» و داده ساختاری مرتبط به‌روزرسانی شدند.`,
        );
        onMutation(
          'edit',
          sourceTab,
          organizationCatalogSchemas[sourceTab].singular,
          nextRecord.title,
        );
        setDialogOpen(false);
        setEditingNode(undefined);
        return;
      }
    }
    const node: OrganizationNode = {
      ...value,
      parentId: value.parentId || null,
      positionCapacity: Number(value.positionCapacity),
    };
    setNodes((current) =>
      editingNode
        ? current.map((item) => (item.id === editingNode.id ? node : item))
        : [...current, node],
    );
    setOrganizationNotice(
      editingNode
        ? `گره «${node.name}» در چارت این نشست ویرایش شد.`
        : `گره «${node.name}» به چارت این نشست اضافه شد.`,
    );
    onMutation(
      editingNode ? 'edit' : 'create',
      'orgchart',
      'گره سازمانی',
      node.name,
    );
    setDialogOpen(false);
    setEditingNode(undefined);
  };
  const saveCatalogRecord = (value: OrganizationCatalogFormValue) => {
    const schema = organizationCatalogSchemas[catalogDialogTab];
    const previous = editingCatalogRecord;
    const items = previous
      ? catalogRecords[catalogDialogTab].map((item) =>
          item.id === previous.id ? value : item,
        )
      : [...catalogRecords[catalogDialogTab], value];
    let nextRecords: OrganizationCatalogRecords = {
      ...catalogRecords,
      [catalogDialogTab]: items,
    };
    if (previous?.title && previous.title !== value.title) {
      if (catalogDialogTab === 'branches')
        nextRecords = {
          ...nextRecords,
          units: nextRecords.units.map((item) =>
            item.branch === previous.title
              ? { ...item, branch: value.title }
              : item,
          ),
        };
      if (catalogDialogTab === 'units')
        nextRecords = {
          ...nextRecords,
          units: nextRecords.units.map((item) =>
            item.parent === previous.title
              ? { ...item, parent: value.title }
              : item,
          ),
          positions: nextRecords.positions.map((item) =>
            item.unit === previous.title
              ? { ...item, unit: value.title }
              : item,
          ),
        };
      if (catalogDialogTab === 'grades')
        nextRecords = {
          ...nextRecords,
          positions: nextRecords.positions.map((item) =>
            item.grade === previous.title
              ? { ...item, grade: value.title }
              : item,
          ),
        };
    }
    setCatalogRecords(nextRecords);
    const chartChanged = ['branches', 'units', 'positions'].includes(
      catalogDialogTab,
    );
    if (chartChanged)
      setNodes((current) =>
        synchronizeOrganizationChartWithCatalog(current, nextRecords),
      );
    setOrganizationNotice(
      chartChanged
        ? editingCatalogRecord
          ? `${schema.singular} «${value.title}» و چارت سازمانی این نشست به‌روزرسانی شدند.`
          : `${schema.singular} «${value.title}» به فهرست اضافه و چارت سازمانی به‌روزرسانی شد.`
        : editingCatalogRecord
          ? `${schema.singular} «${value.title}» در فهرست این نشست ویرایش شد.`
          : `${schema.singular} «${value.title}» به فهرست این نشست اضافه شد.`,
    );
    onMutation(
      editingCatalogRecord ? 'edit' : 'create',
      catalogDialogTab,
      schema.singular,
      value.title,
    );
    setCatalogDialogOpen(false);
    setEditingCatalogRecord(undefined);
  };
  const deleteNode = (node: OrganizationNode) => {
    if (node.catalogSource) {
      const sourceTab = node.catalogSource === 'branch' ? 'branches' : 'units';
      const sourceRecord = catalogRecords[sourceTab].find(
        (record) => record.id === node.id,
      );
      if (sourceRecord) {
        deleteCatalogRecord(sourceTab, sourceRecord);
        return;
      }
    }
    setNodes((current) => {
      const deletedIds = new Set([node.id]);
      let changed = true;
      while (changed) {
        changed = false;
        current.forEach((item) => {
          if (
            item.parentId &&
            deletedIds.has(item.parentId) &&
            !deletedIds.has(item.id)
          ) {
            deletedIds.add(item.id);
            changed = true;
          }
        });
      }
      return current.filter((item) => !deletedIds.has(item.id));
    });
    setOrganizationNotice(
      `گره «${node.name}» و زیرشاخه‌های آن از چارت موقت این نشست حذف شد.`,
    );
    onMutation('delete', 'orgchart', 'گره سازمانی', node.name);
  };
  function deleteCatalogRecord(
    nextTab: OrganizationCatalogTab,
    record: OrganizationCatalogFormValue,
  ) {
    let nextRecords: OrganizationCatalogRecords = {
      ...catalogRecords,
      [nextTab]: catalogRecords[nextTab].filter(
        (item) => item.id !== record.id,
      ),
    };
    if (nextTab === 'branches') {
      const removedUnits = new Set(
        nextRecords.units
          .filter((unit) => unit.branch === record.title)
          .map((unit) => unit.title),
      );
      nextRecords = {
        ...nextRecords,
        units: nextRecords.units.filter(
          (unit) => !removedUnits.has(unit.title),
        ),
        positions: nextRecords.positions.filter(
          (position) => !removedUnits.has(position.unit),
        ),
      };
    }
    if (nextTab === 'units') {
      const removedUnits = new Set([record.title]);
      let changed = true;
      while (changed) {
        changed = false;
        nextRecords.units.forEach((unit) => {
          if (removedUnits.has(unit.parent) && !removedUnits.has(unit.title)) {
            removedUnits.add(unit.title);
            changed = true;
          }
        });
      }
      nextRecords = {
        ...nextRecords,
        units: nextRecords.units.filter(
          (unit) => !removedUnits.has(unit.title),
        ),
        positions: nextRecords.positions.filter(
          (position) => !removedUnits.has(position.unit),
        ),
      };
    }
    setCatalogRecords(nextRecords);
    const chartChanged = ['branches', 'units', 'positions'].includes(nextTab);
    if (chartChanged)
      setNodes((current) =>
        synchronizeOrganizationChartWithCatalog(current, nextRecords),
      );
    setOrganizationNotice(
      chartChanged
        ? `${organizationCatalogSchemas[nextTab].singular} «${record.title}» حذف و چارت سازمانی به‌روزرسانی شد.`
        : `${organizationCatalogSchemas[nextTab].singular} «${record.title}» از فهرست موقت این نشست حذف شد.`,
    );
    onMutation(
      'delete',
      nextTab,
      organizationCatalogSchemas[nextTab].singular,
      record.title,
    );
  }

  return (
    <>
      <PageHead
        actions={
          <>
            <ActionButton disabled>
              <Download size={15} /> خروجی مجاز
            </ActionButton>
            <ActionButton
              onClick={() => {
                if (tab === 'orgchart') openCreate();
                else if (catalogTab) openCatalogCreate(catalogTab);
              }}
              primary
            >
              <Plus size={15} />{' '}
              {tab === 'orgchart'
                ? 'گره جدید'
                : catalogTab
                  ? `افزودن ${organizationCatalogSchemas[catalogTab].singular}`
                  : 'مورد جدید'}
            </ActionButton>
          </>
        }
        section="organization"
      />
      <DateRangeBar />
      <Tabs active={tab} items={tabs} onChange={setTab} />
      {organizationNotice ? (
        <div className={styles.notice} role="status">
          <BadgeCheck aria-hidden="true" size={17} />
          {organizationNotice}
        </div>
      ) : null}
      <Panel
        icon={<ActiveIcon size={17} />}
        note={
          tab === 'orgchart'
            ? 'چارت با ثبت شعبه، واحد یا سمت خودکار به‌روزرسانی می‌شود؛ هر گره را نیز می‌توانید از روی کارت ویرایش کنید.'
            : 'فقط شناسه‌ها و ردیف‌های صریحاً نمایشی نمایش داده شده‌اند.'
        }
        title={active?.label ?? 'ساختار سازمانی'}
      >
        {tab === 'orgchart' ? (
          <OrganizationChart
            nodes={nodes}
            onDelete={deleteNode}
            onEdit={openEdit}
          />
        ) : (
          <>
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
            {catalogTab ? (
              <OrganizationCatalogTable
                onDelete={(record) => deleteCatalogRecord(catalogTab, record)}
                onEdit={(record) => openCatalogEdit(catalogTab, record)}
                records={catalogRecords[catalogTab]}
                tab={catalogTab}
              />
            ) : null}
          </>
        )}
      </Panel>
      {dialogOpen ? (
        <OrganizationNodeDialog
          initialNode={editingNode}
          branchOptions={catalogRecords.branches.map((branch) => branch.title)}
          managerOptions={previewEmployees.map((employee) => employee.name)}
          nodes={nodes}
          onClose={() => setDialogOpen(false)}
          onSubmit={saveNode}
        />
      ) : null}
      <OrganizationCatalogDialog
        initialRecord={editingCatalogRecord}
        managers={previewEmployees.map((employee) => employee.name)}
        onClose={() => setCatalogDialogOpen(false)}
        onSubmit={saveCatalogRecord}
        open={catalogDialogOpen}
        records={catalogRecords}
        tab={catalogDialogTab}
      />
    </>
  );
}

function Requests({
  openForm,
  datasetStore,
}: {
  openForm: (context: ContextualHrFormContext) => void;
  datasetStore: PreviewDatasetStore;
}) {
  const tabs = sectionTabs.requests ?? [];
  const [tab, setTab] = useState(tabs[0]?.id ?? 'inbox');
  const active = tabs.find((item) => item.id === tab);
  const dataset = datasetStore.getDataset('requests', tab);
  const openCurrentForm = (
    mode: ContextualHrFormContext['mode'],
    rowIndex?: number,
    row?: readonly HrPreviewCell[],
  ) =>
    openForm({
      section: 'requests',
      tab,
      title: active?.label ?? 'درخواست منابع انسانی',
      description: screenMeta.requests.description,
      columns: dataset.columns,
      mode,
      ...(rowIndex === undefined ? {} : { rowIndex }),
      ...(row ? { initialValues: row.map(previewCellText) } : {}),
    });
  const data = genericTable(
    dataset,
    (rowIndex, row) => openCurrentForm('edit', rowIndex, row),
    (rowIndex) => datasetStore.deleteRow('requests', tab, rowIndex),
  );
  return (
    <>
      <PageHead
        actions={
          <ActionButton onClick={() => openCurrentForm('create')} primary>
            <Plus size={15} /> افزودن {active?.label ?? 'درخواست'}
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
      <Panel title={active?.label ?? 'کارتابل درخواست‌ها'}>
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
            placeholder={`جست‌وجو در ${active?.label ?? 'درخواست‌ها'}`}
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
            aria-label="وضعیت درخواست"
            className={styles.control}
            defaultValue="all"
          >
            <option value="all">همه وضعیت‌ها</option>
            <option value="pending">در انتظار</option>
            <option value="completed">تکمیل‌شده</option>
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
  openForm,
  datasetStore,
  initialTab,
}: {
  section: Exclude<
    HrSectionId,
    | 'home'
    | 'dashboard'
    | 'employees'
    | 'employee'
    | 'organization'
    | 'requests'
  >;
  openAction: (title: string) => void;
  openForm: (context: ContextualHrFormContext) => void;
  datasetStore: PreviewDatasetStore;
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
  const isAutomaticHistory = isAutomaticHrHistoryTab(section, tab);
  const dataset = datasetStore.getDataset(section, tab);
  const openCurrentForm = (
    mode: ContextualHrFormContext['mode'],
    rowIndex?: number,
    row?: readonly HrPreviewCell[],
  ) =>
    openForm({
      section,
      tab,
      title: active?.label ?? screenMeta[section].title,
      description: screenMeta[section].description,
      columns: dataset.columns,
      mode,
      ...(rowIndex === undefined ? {} : { rowIndex }),
      ...(row ? { initialValues: row.map(previewCellText) } : {}),
    });
  const data = isAutomaticHistory
    ? readonlyTable(dataset)
    : genericTable(
        dataset,
        (rowIndex, row) => openCurrentForm('edit', rowIndex, row),
        (rowIndex) => datasetStore.deleteRow(section, tab, rowIndex),
      );
  return (
    <>
      <PageHead
        actions={
          <>
            <ActionButton disabled>
              <Download size={15} /> خروجی مجاز
            </ActionButton>
            {isAutomaticHistory ? null : (
              <ActionButton onClick={() => openCurrentForm('create')} primary>
                <Plus size={15} /> افزودن{' '}
                {active?.label ?? screenMeta[section].title}
              </ActionButton>
            )}
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
          note={
            isAutomaticHistory
              ? 'این سابقه از عملیات مرتبط به‌صورت خودکار ساخته می‌شود.'
              : 'فقط شناسه‌ها و ردیف‌های صریحاً نمایشی نمایش داده شده‌اند.'
          }
          title={active?.label ?? screenMeta[section].title}
        >
          {isAutomaticHistory ? (
            <div className={styles.panelBody}>
              <AutomaticHistoryNotice />
            </div>
          ) : null}
          {section === 'hrSettings' && tab === 'companies' ? (
            <div className={styles.panelBody}>
              <div className={styles.previewNote}>
                <Info aria-hidden="true" size={16} />
                <span>
                  تقویم شمسی رابط فعال است. خروجی بیمه، مالیات و بانک ایران تا
                  دریافت قواعد قانونی نسخه‌دار و قراردادهای عمومی تأییدشده
                  غیرفعال می‌ماند.
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
        </Panel>
      )}
    </>
  );
}

function DetailDialog({ close, title }: { close: () => void; title: string }) {
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
          جزئیات این مورد در حالت پیش‌نمایش نمایش داده می‌شود و داده عملیاتی
          ذخیره یا ارسال نمی‌شود.
        </DialogDescription>
        <div className={styles.previewNote}>
          <Info aria-hidden="true" size={16} />
          این پنجره فقط برای مشاهده است. ایجاد و ویرایش از فرم اختصاصی هر
          زیرصفحه انجام می‌شود.
        </div>
        <div className={styles.modalFooter}>
          <ActionButton onClick={close} primary>
            بستن
          </ActionButton>
        </div>
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
  const [editingEmployee, setEditingEmployee] =
    useState<PreviewEmployee | null>(null);
  const [previewDatasetOverrides, setPreviewDatasetOverrides] =
    useState<PreviewDatasetOverrides>({});
  const [previewStorageReady, setPreviewStorageReady] = useState(false);
  const [dialogTitle, setDialogTitle] = useState<string | null>(null);
  const [contextualForm, setContextualForm] =
    useState<ContextualHrFormContext | null>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const serialized = window.sessionStorage.getItem(previewDatasetStorageKey);
    const timer = window.setTimeout(() => {
      setPreviewDatasetOverrides(parseHrPreviewDatasetOverrides(serialized));
      setPreviewStorageReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!previewStorageReady) return;
    window.sessionStorage.setItem(
      previewDatasetStorageKey,
      JSON.stringify(previewDatasetOverrides),
    );
  }, [previewDatasetOverrides, previewStorageReady]);
  function closeDialog() {
    if (dialogTitle)
      setNotice('عملیات فقط در پیش‌نمایش بررسی شد؛ ذخیره دائمی انجام نشد.');
    setDialogTitle(null);
  }
  const openAction = (title: string) => {
    setNotice('');
    setContextualForm(null);
    setDialogTitle(title);
  };
  const openForm = (context: ContextualHrFormContext) => {
    setNotice('');
    setDialogTitle(null);
    setContextualForm(context);
  };
  const getDataset = (datasetSection: HrSectionId, tab: string) => {
    const base = getHrPreviewDataset(datasetSection, tab);
    const key = previewDatasetKey(datasetSection, tab);
    const rows = previewDatasetOverrides[key];
    if (!rows) return base;
    return {
      ...base,
      rows,
      totalLabel: `${rows.length.toLocaleString('fa-IR')} رکورد نمایشی در نشست`,
    };
  };
  const deleteDatasetRow = (
    datasetSection: HrSectionId,
    tab: string,
    rowIndex: number,
  ) => {
    const key = previewDatasetKey(datasetSection, tab);
    const row = getDataset(datasetSection, tab).rows[rowIndex];
    const subject = previewCellText(row?.[1] ?? row?.[0] ?? 'رکورد');
    const title =
      sectionTabs[datasetSection]?.find((item) => item.id === tab)?.label ??
      screenMeta[datasetSection].title;
    setPreviewDatasetOverrides((current) => {
      const rows =
        current[key] ?? getHrPreviewDataset(datasetSection, tab).rows;
      const next = {
        ...current,
        [key]: removeHrPreviewRow(rows, rowIndex),
      };
      return appendAutomaticHrHistory(next, {
        action: 'delete',
        section: datasetSection,
        tab,
        title,
        subject,
      });
    });
    setNotice('رکورد از مجموعه‌داده موقت این نشست حذف شد.');
  };
  const datasetStore: PreviewDatasetStore = {
    getDataset,
    deleteRow: deleteDatasetRow,
  };
  const saveEmployee = (value: NewEmployeeFormValue) => {
    const wasEditing = Boolean(editingEmployee);
    const name = `${value.firstName} ${value.lastName}`.trim();
    const statusTone: Record<NewEmployeeFormValue['status'], BadgeTone> = {
      فعال: 'success',
      'در حال تکمیل': 'warning',
      تعلیق‌شده: 'neutral',
    };
    const date = new Date(`${value.startedAt}T12:00:00.000Z`);
    const startedAt = Number.isNaN(date.getTime())
      ? value.startedAt
      : new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }).format(date);
    const nextEmployee: PreviewEmployee = {
      id: value.personnelCode,
      name,
      initial: value.firstName.charAt(0),
      employment:
        editingEmployee?.employment ??
        `preview-employment-${value.personnelCode}`,
      kind: value.employmentType,
      unit: `${value.branch} / ${value.unit}`,
      position: value.position,
      manager: value.manager,
      startedAt,
      startedAtValue: value.startedAt,
      status: value.status,
      tone: statusTone[value.status],
      local: true,
    };
    setEmployees((current) =>
      editingEmployee
        ? current.map((employee) =>
            employee.id === editingEmployee.id ? nextEmployee : employee,
          )
        : [nextEmployee, ...current],
    );
    setPreviewDatasetOverrides((current) =>
      appendAutomaticHrHistory(current, {
        action: wasEditing ? 'edit' : 'create',
        section: 'employees',
        tab: 'list',
        title: 'کارمند',
        subject: name,
      }),
    );
    setDialogTitle(null);
    setEditingEmployee(null);
    setNotice(
      editingEmployee
        ? `اطلاعات کارمند «${name}» در فهرست موقت این نشست ویرایش شد.`
        : `کارمند «${name}» به فهرست موقت این نشست اضافه شد.`,
    );
  };
  let screen: ReactNode;
  if (workspace)
    screen = <FrappeWorkspaceScreen key={workspace} workspaceId={workspace} />;
  else if (section === 'home') screen = <HubScreen />;
  else if (section === 'dashboard')
    screen = <Dashboard openAction={openAction} />;
  else if (section === 'employees')
    screen = (
      <Employees
        employees={employees}
        onCreate={() => {
          setEditingEmployee(null);
          openAction('کارمند جدید');
        }}
        onDelete={(employee) => {
          setEmployees((current) =>
            current.filter((item) => item.id !== employee.id),
          );
          setPreviewDatasetOverrides((current) =>
            appendAutomaticHrHistory(current, {
              action: 'delete',
              section: 'employees',
              tab: 'list',
              title: 'کارمند',
              subject: employee.name,
            }),
          );
          setNotice(`کارمند «${employee.name}» از فهرست موقت این نشست حذف شد.`);
        }}
        onEdit={(employee) => {
          setNotice('');
          setDialogTitle(null);
          setEditingEmployee(employee);
        }}
      />
    );
  else if (section === 'employee')
    screen = (
      <EmployeeProfile
        datasetStore={datasetStore}
        initialTab={tabId}
        key={`employee:${tabId ?? ''}`}
        openAction={openAction}
        openForm={openForm}
      />
    );
  else if (section === 'organization')
    screen = (
      <OrganizationSection
        initialTab={tabId}
        key={`organization:${tabId ?? ''}`}
        onMutation={(action, tab, title, subject) =>
          setPreviewDatasetOverrides((current) =>
            appendAutomaticHrHistory(current, {
              action,
              section: 'organization',
              tab,
              title,
              subject,
            }),
          )
        }
      />
    );
  else if (section === 'requests')
    screen = <Requests datasetStore={datasetStore} openForm={openForm} />;
  else
    screen = (
      <TabbedSection
        datasetStore={datasetStore}
        initialTab={tabId}
        key={`${section}:${tabId ?? ''}`}
        openAction={openAction}
        openForm={openForm}
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
      {contextualForm ? (
        <ContextualHrFormDialog
          context={contextualForm}
          onClose={() => setContextualForm(null)}
          onSubmit={(values) => {
            const key = previewDatasetKey(
              contextualForm.section,
              contextualForm.tab,
            );
            setPreviewDatasetOverrides((current) => {
              const rows =
                current[key] ??
                getHrPreviewDataset(contextualForm.section, contextualForm.tab)
                  .rows;
              const next = {
                ...current,
                [key]: saveHrPreviewRow(
                  rows,
                  contextualForm.columns,
                  values,
                  contextualForm.rowIndex,
                ),
              };
              return appendAutomaticHrHistory(next, {
                action: contextualForm.mode,
                section: contextualForm.section,
                tab: contextualForm.tab,
                title: contextualForm.title,
                subject: values[1] ?? values[0] ?? contextualForm.title,
              });
            });
            setNotice(
              contextualForm.mode === 'edit'
                ? `${contextualForm.title} در مجموعه‌داده موقت این نشست ویرایش شد.`
                : `${contextualForm.title} به مجموعه‌داده موقت این نشست اضافه شد.`,
            );
            setContextualForm(null);
          }}
        />
      ) : dialogTitle === 'کارمند جدید' || editingEmployee ? (
        <NewEmployeeDialog
          existingPersonnelCodes={employees
            .filter((employee) => employee.id !== editingEmployee?.id)
            .map((employee) => employee.id)}
          initialValue={
            editingEmployee ? employeeFormValue(editingEmployee) : undefined
          }
          managerOptions={employees.map((employee) => employee.name)}
          onClose={() => {
            setDialogTitle(null);
            setEditingEmployee(null);
          }}
          onSubmit={saveEmployee}
        />
      ) : dialogTitle ? (
        <DetailDialog close={closeDialog} title={dialogTitle} />
      ) : null}
    </main>
  );
}
