'use client';

import {
  AlertTriangle,
  BadgePercent,
  BarChart3,
  BellRing,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Copy,
  Download,
  Eye,
  FileImage,
  FileText,
  Filter,
  Gauge,
  Link2,
  Mail,
  Megaphone,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Power,
  Route,
  Save,
  Search,
  Send,
  ShieldCheck,
  ShoppingCart,
  Target,
  Upload,
  UserRound,
  UsersRound,
  WandSparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Checkbox,
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/ui/form-controls';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/overlays';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  FilterBar,
  PaginationShell,
} from '@/components/ui/surfaces';
import { cn } from '@/lib/utils';
import { campaignStatusLabels, type CampaignPreview } from '../model/marketing';
import {
  marketingSectionTabs,
  type MarketingPreviewItem,
} from '../model/reference-data';

type DetailSection = MarketingPreviewItem['section'];
type NoticeHandler = (message: string) => void;

interface PreviewRow {
  id: `preview-${string}`;
  cells: readonly string[];
  statusIndex?: number;
}

interface MetricDefinition {
  label: string;
  value: string;
  icon: LucideIcon;
  detail?: string;
  tone?: 'blue' | 'emerald' | 'amber' | 'violet' | 'rose';
}

const metricTones: Record<NonNullable<MetricDefinition['tone']>, string> = {
  blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/45 dark:text-blue-200',
  emerald:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/45 dark:text-emerald-200',
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/45 dark:text-amber-200',
  violet:
    'bg-violet-50 text-violet-700 dark:bg-violet-950/45 dark:text-violet-200',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-950/45 dark:text-rose-200',
};

function statusClass(value: string) {
  if (
    [
      'فعال',
      'سالم',
      'مجاز',
      'منتشرشده',
      'پایان‌یافته',
      'قطعی',
      'رفع‌شده',
    ].includes(value)
  ) {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200';
  }
  if (
    [
      'در انتظار تأیید',
      'درحال پیگیری',
      'زمان‌بندی‌شده',
      'در انتظار',
      'نیازمند اقدام',
      'درحال تلاش',
    ].includes(value)
  ) {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200';
  }
  if (['لغو', 'عدم ارسال', 'مسدود', 'ناموفق', 'منقضی'].includes(value)) {
    return 'bg-destructive/10 text-destructive';
  }
  return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200';
}

function MetricGrid({ metrics }: { metrics: readonly MetricDefinition[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(({ label, value, icon: Icon, detail, tone = 'blue' }) => (
        <Card className="flex min-h-24 items-center gap-4 p-4" key={label}>
          <span
            className={cn(
              'grid size-12 shrink-0 place-items-center rounded-full',
              metricTones[tone],
            )}
          >
            <Icon aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-black">{value}</p>
            {detail ? (
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                {detail}
              </p>
            ) : null}
          </div>
        </Card>
      ))}
    </div>
  );
}

function SimpleSelect({
  ariaLabel,
  options,
  value,
  onChange,
}: {
  ariaLabel: string;
  options: readonly (readonly [string, string])[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select onValueChange={onChange} value={value}>
      <SelectTrigger aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([optionValue, label]) => (
          <SelectItem key={optionValue} value={optionValue}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Panel({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <header className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-black">{title}</h3>
          {description ? (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </header>
      {children}
    </Card>
  );
}

function PreviewTable({
  title,
  columns,
  rows,
  totalLabel,
  section,
  tab,
  onOpen,
  onNotice,
  searchable = true,
  actions = true,
}: {
  title: string;
  columns: readonly string[];
  rows: readonly PreviewRow[];
  totalLabel: string;
  section: DetailSection;
  tab: string;
  onOpen: (item: MarketingPreviewItem) => void;
  onNotice: NoticeHandler;
  searchable?: boolean;
  actions?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const statuses = useMemo(
    () =>
      Array.from(
        new Set(
          rows.flatMap((row) =>
            row.statusIndex === undefined ? [] : [row.cells[row.statusIndex]],
          ),
        ),
      ).filter(Boolean) as string[],
    [rows],
  );
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('fa-IR');
    return rows.filter(
      (row) =>
        (!needle ||
          row.cells.join(' ').toLocaleLowerCase('fa-IR').includes(needle)) &&
        (status === 'all' ||
          (row.statusIndex !== undefined &&
            row.cells[row.statusIndex] === status)),
    );
  }, [rows, search, status]);
  const pageSize = 3;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visibleRows = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const openRow = (row: PreviewRow) =>
    onOpen({
      id: row.id,
      section,
      tab,
      title: row.cells[0] ?? title,
      description: row.cells.slice(1).join(' · '),
      status:
        row.statusIndex === undefined
          ? 'داده آزمایشی'
          : (row.cells[row.statusIndex] ?? 'داده آزمایشی'),
      meta: `نمونه ${title}`,
      updatedAt: '2026-09-03T08:30:00.000Z',
    });
  return (
    <Panel title={title}>
      {searchable ? (
        <FilterBar className="m-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem_auto]">
          <FormField id={`${section}-${tab}-search`} label="جست‌وجو">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="absolute end-3 top-3.5 size-4 text-muted-foreground"
              />
              <Input
                className="pe-10"
                id={`${section}-${tab}-search`}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="جست‌وجو در داده‌های آزمایشی"
                value={search}
              />
            </div>
          </FormField>
          <FormField id={`${section}-${tab}-status`} label="وضعیت">
            <SimpleSelect
              ariaLabel="فیلتر وضعیت"
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              options={[
                ['all', 'همه وضعیت‌ها'],
                ...statuses.map((item) => [item, item] as const),
              ]}
              value={status}
            />
          </FormField>
          <Button
            onClick={() => {
              setSearch('');
              setStatus('all');
              setPage(1);
              onNotice(`فیلترهای ${title} پاک شد.`);
            }}
            variant="outline"
          >
            <Filter aria-hidden="true" className="size-4" />
            پاک‌کردن فیلتر
          </Button>
        </FilterBar>
      ) : null}
      {visibleRows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                {columns.map((column) => (
                  <th className="p-4 text-start" key={column}>
                    {column}
                  </th>
                ))}
                {actions ? <th className="p-4 text-start">عملیات</th> : null}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr
                  className="border-t border-border transition hover:bg-muted/30"
                  key={row.id}
                >
                  {row.cells.map((cell, index) => (
                    <td className="p-4" key={`${row.id}-${columns[index]}`}>
                      {index === row.statusIndex ? (
                        <Badge className={statusClass(cell)}>{cell}</Badge>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                  {actions ? (
                    <td className="p-4">
                      <div className="flex gap-1">
                        <Button
                          aria-label={`مشاهده ${row.cells[0]}`}
                          onClick={() => openRow(row)}
                          size="icon"
                          variant="outline"
                        >
                          <Eye aria-hidden="true" className="size-4" />
                        </Button>
                        <Button
                          aria-label={`ویرایش ${row.cells[0]}`}
                          onClick={() =>
                            onNotice(`فرم ویرایش ${row.cells[0]} باز شد.`)
                          }
                          size="icon"
                          variant="outline"
                        >
                          <Pencil aria-hidden="true" className="size-4" />
                        </Button>
                        <Button
                          aria-label={`عملیات بیشتر ${row.cells[0]}`}
                          onClick={() =>
                            onNotice(`منوی عملیات ${row.cells[0]} باز شد.`)
                          }
                          size="icon"
                          variant="ghost"
                        >
                          <MoreHorizontal
                            aria-hidden="true"
                            className="size-4"
                          />
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4">
          <EmptyState
            description="عبارت جست‌وجو یا وضعیت را تغییر دهید."
            title="رکوردی پیدا نشد"
          />
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
        <PaginationShell currentPage={currentPage} totalLabel={totalLabel} />
        <div className="flex gap-2">
          <Button
            aria-label="صفحه قبل"
            disabled={currentPage === 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            size="sm"
            variant="outline"
          >
            قبلی
          </Button>
          <Button
            aria-label="صفحه بعد"
            disabled={currentPage === pages}
            onClick={() => setPage((value) => Math.min(pages, value + 1))}
            size="sm"
            variant="outline"
          >
            بعدی
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function ProgressRows({
  rows,
}: {
  rows: readonly (readonly [string, number, string])[];
}) {
  return (
    <div className="grid gap-4 p-5">
      {rows.map(([label, percent, value]) => (
        <div
          className="grid gap-2 sm:grid-cols-[11rem_1fr_8rem] sm:items-center"
          key={label}
        >
          <span className="font-bold">{label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-gradient-to-l from-primary to-cyan-400"
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </span>
          <span className="text-xs text-muted-foreground">{value}</span>
        </div>
      ))}
    </div>
  );
}

export function MarketingDashboardReference({
  onOpen,
  onNotice,
}: {
  onOpen: (item: MarketingPreviewItem) => void;
  onNotice: NoticeHandler;
}) {
  const [startDate, setStartDate] = useState('2026-08-03');
  const [endDate, setEndDate] = useState('2026-09-03');
  const [site, setSite] = useState('all');
  const [channel, setChannel] = useState('all');
  const topCampaigns: readonly PreviewRow[] = [
    {
      id: 'preview-dashboard-europe',
      cells: [
        'جشنواره تابستان اروپا',
        'پیامک، ایمیل',
        '۲.۱ میلیارد',
        '۱٬۴۸۲',
        '۸.۶ میلیارد',
        '۴.۱×',
        'فعال',
      ],
      statusIndex: 6,
    },
    {
      id: 'preview-dashboard-istanbul',
      cells: [
        'پرواز استانبول شهریور',
        'پوش، سایت',
        '۱.۴ میلیارد',
        '۹۶۸',
        '۴.۹ میلیارد',
        '۳.۵×',
        'فعال',
      ],
      statusIndex: 6,
    },
    {
      id: 'preview-dashboard-dubai',
      cells: [
        'هتل‌های دبی پاییز',
        'شبکه اجتماعی',
        '۹۸۰ میلیون',
        '۷۴۱',
        '۲.۸ میلیارد',
        '۲.۹×',
        'درحال اجرا',
      ],
      statusIndex: 6,
    },
  ];
  return (
    <section className="grid gap-5">
      <FilterBar className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_12rem_12rem_auto]">
        <FormField id="dashboard-reference-start" label="از تاریخ">
          <DatePicker
            id="dashboard-reference-start"
            onChange={setStartDate}
            value={startDate}
          />
        </FormField>
        <FormField id="dashboard-reference-end" label="تا تاریخ">
          <DatePicker
            id="dashboard-reference-end"
            onChange={setEndDate}
            value={endDate}
          />
        </FormField>
        <FormField id="dashboard-reference-site" label="سایت">
          <SimpleSelect
            ariaLabel="انتخاب سایت"
            onChange={setSite}
            options={[
              ['all', 'هر دو سایت'],
              ['main', 'سایت اصلی'],
              ['second', 'سایت دوم'],
            ]}
            value={site}
          />
        </FormField>
        <FormField id="dashboard-reference-channel" label="کانال">
          <SimpleSelect
            ariaLabel="انتخاب کانال"
            onChange={setChannel}
            options={[
              ['all', 'همه کانال‌ها'],
              ['sms', 'پیامک'],
              ['email', 'ایمیل'],
              ['social', 'شبکه اجتماعی'],
            ]}
            value={channel}
          />
        </FormField>
        <Button
          onClick={() =>
            onNotice(`فیلتر داشبورد از ${startDate} تا ${endDate} اعمال شد.`)
          }
        >
          <Filter aria-hidden="true" className="size-4" />
          اعمال فیلتر
        </Button>
      </FilterBar>
      <MetricGrid
        metrics={[
          {
            label: 'کمپین فعال',
            value: '۱۲',
            icon: Megaphone,
            detail: '+۲ این ماه',
          },
          {
            label: 'بودجه مصرف‌شده',
            value: '۸.۴ میلیارد',
            icon: CircleDollarSign,
            detail: '۶۸٪ بودجه',
            tone: 'amber',
          },
          {
            label: 'سرنخ جدید',
            value: '۳٬۸۴۲',
            icon: UsersRound,
            detail: '+۱۸٪',
            tone: 'violet',
          },
          {
            label: 'مشتری جدید',
            value: '۹۱۴',
            icon: UserRound,
            detail: '+۱۲٪',
            tone: 'emerald',
          },
          {
            label: 'فروش منتسب',
            value: '۲۶.۸ میلیارد',
            icon: BarChart3,
            detail: '+۲۳٪',
            tone: 'emerald',
          },
          { label: 'نرخ تبدیل', value: '۲۳.۸٪', icon: Target, detail: '+۳.۱٪' },
          {
            label: 'CAC',
            value: '۱.۹ میلیون',
            icon: CircleDollarSign,
            detail: '-۸٪ بهتر',
            tone: 'amber',
          },
          {
            label: 'ROAS',
            value: '۳.۱۹×',
            icon: Gauge,
            detail: 'هدف ۳×',
            tone: 'violet',
          },
        ]}
      />
      <Alert
        description="همه اعداد این صفحه دقیقاً داده آزمایشی مرجع هستند و به Analytics یا مالی متصل نیستند."
        title="داشبورد نمایشی"
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="روند ایجاد سرنخ و فروش منتسب">
          <div className="p-5">
            <svg
              aria-label="روند آزمایشی ۳۰ روز اخیر"
              className="h-52 w-full"
              viewBox="0 0 700 220"
            >
              <path
                className="stroke-border"
                d="M20 30H680M20 80H680M20 130H680M20 180H680"
              />
              <path
                className="fill-none stroke-primary [stroke-width:4]"
                d="M20 172 C90 158 110 120 170 135 S260 78 320 104 S410 55 470 82 S570 42 680 48"
              />
            </svg>
          </div>
        </Panel>
        <Panel title="قیف تبدیل">
          <div className="grid justify-items-center gap-2 p-5 text-center text-sm font-bold">
            {[
              ['۳۸٬۴۲۰ بازدید', 'w-full'],
              ['۸٬۶۱۰ مخاطب', 'w-5/6'],
              ['۳٬۸۴۲ سرنخ', 'w-2/3'],
              ['۱٬۴۲۸ سفارش', 'w-1/2'],
              ['۹۱۴ فروش', 'w-1/3'],
            ].map(([label, width], index) => (
              <div
                className={cn(
                  'rounded-lg px-3 py-2.5',
                  width,
                  index === 4
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-blue-100 text-blue-800',
                )}
                key={label}
              >
                {label}
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="عملکرد کانال‌ها">
          <ProgressRows
            rows={[
              ['پیامک', 84, '۳۴٪'],
              ['ایمیل', 68, '۲۷٪'],
              ['شبکه اجتماعی', 55, '۲۲٪'],
              ['پوش', 31, '۱۲٪'],
              ['سایر', 14, '۵٪'],
            ]}
          />
        </Panel>
        <div className="xl:col-span-2">
          <PreviewTable
            actions={false}
            columns={[
              'کمپین',
              'کانال',
              'هزینه',
              'سرنخ',
              'فروش',
              'ROAS',
              'وضعیت',
            ]}
            onNotice={onNotice}
            onOpen={onOpen}
            rows={topCampaigns}
            searchable={false}
            section="reports"
            tab="dashboard"
            title="کمپین‌های برتر"
            totalLabel="۳ کمپین آزمایشی"
          />
        </div>
        <Panel title="هشدارهای مهم">
          <div className="grid gap-3 p-4">
            {[
              ['کمپین در انتظار تأیید', '۳ کمپین بیش از ۲۴ ساعت', Megaphone],
              [
                'بودجه نزدیک به پایان',
                'جشنواره تابستان اروپا',
                CircleDollarSign,
              ],
              ['خطای ارسال بالا', 'ارسال پیامک گروه آژانس‌ها', MessageCircle],
              ['سرنخ بدون پیگیری', '۱۲۸ سرنخ بیشتر از ۴۸ ساعت', UsersRound],
            ].map(([title, description, Icon]) => {
              const AlertIcon = Icon as LucideIcon;
              return (
                <button
                  className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-start transition hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
                  key={title as string}
                  onClick={() => onNotice(`جزئیات هشدار «${title}» باز شد.`)}
                  type="button"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
                    <AlertIcon aria-hidden="true" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm">{title as string}</strong>
                    <small className="text-muted-foreground">
                      {description as string}
                    </small>
                  </span>
                  <span className="text-xs font-bold text-primary">بررسی</span>
                </button>
              );
            })}
          </div>
        </Panel>
      </div>
    </section>
  );
}

function SegmentBuilder({ onNotice }: { onNotice: NoticeHandler }) {
  const [rules, setRules] = useState([
    ['شهر', 'برابر است با', 'تهران'],
    ['مقصد موردعلاقه', 'یکی از', 'اروپا'],
    ['آخرین خرید', 'بیشتر از', '۶ ماه'],
  ]);
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
      <Panel
        actions={
          <>
            <Button
              onClick={() =>
                onNotice('پیش‌نمایش سگمنت با ۴٬۲۸۰ عضو نمایش داده شد.')
              }
              size="sm"
              variant="outline"
            >
              پیش‌نمایش
            </Button>
            <Button
              onClick={() => onNotice('سگمنت آزمایشی ذخیره شد.')}
              size="sm"
            >
              ذخیره سگمنت
            </Button>
          </>
        }
        title="سازنده سگمنت پویا"
      >
        <div className="grid gap-3 p-5">
          <strong>همه شرایط زیر برقرار باشد (AND)</strong>
          {rules.map((rule, index) => (
            <div
              className="grid gap-2 rounded-xl border border-border bg-muted/25 p-3 md:grid-cols-[1fr_1fr_1fr_auto]"
              key={`${rule[0]}-${index}`}
            >
              <SimpleSelect
                ariaLabel={`فیلد شرط ${index + 1}`}
                onChange={() => undefined}
                options={[[rule[0] ?? '', rule[0] ?? '']]}
                value={rule[0] ?? ''}
              />
              <SimpleSelect
                ariaLabel={`عملگر شرط ${index + 1}`}
                onChange={() => undefined}
                options={[[rule[1] ?? '', rule[1] ?? '']]}
                value={rule[1] ?? ''}
              />
              <Input
                aria-label={`مقدار شرط ${index + 1}`}
                readOnly
                value={rule[2]}
              />
              <Button
                aria-label={`حذف شرط ${index + 1}`}
                onClick={() =>
                  setRules((items) =>
                    items.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
                size="icon"
                variant="outline"
              >
                <X aria-hidden="true" className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            className="justify-self-start"
            onClick={() =>
              setRules((items) => [
                ...items,
                ['نوع مشتری', 'برابر است با', 'فعال'],
              ])
            }
            size="sm"
            variant="outline"
          >
            <Plus aria-hidden="true" className="size-4" /> افزودن شرط
          </Button>
        </div>
      </Panel>
      <Card className="grid place-items-center bg-gradient-to-br from-blue-50 to-cyan-50 p-6 text-center dark:from-blue-950/45 dark:to-cyan-950/35">
        <div>
          <span className="text-sm text-muted-foreground">اعضای برآوردی</span>
          <strong className="mt-2 block text-4xl font-black text-primary">
            ۴٬۲۸۰
          </strong>
          <small className="mt-2 block text-muted-foreground">
            بروزرسانی امروز ۱۰:۲۰
          </small>
          <div className="my-4 border-t border-border" />
          <p className="leading-7">
            ۳٬۹۴۰ مشتری
            <br />
            ۳۴۰ سرنخ
            <br />
            ۱۲۶ لغو عضویت
          </p>
        </div>
      </Card>
    </div>
  );
}

const segmentRows: readonly PreviewRow[] = [
  {
    id: 'preview-segment-europe',
    cells: [
      'علاقه‌مندان اروپا',
      'پویا',
      '۱۲٬۸۴۰',
      '۳',
      'امروز ۱۰:۲۰',
      'مریم احمدی',
      'فعال',
    ],
    statusIndex: 6,
  },
  {
    id: 'preview-segment-vip',
    cells: [
      'مشتریان VIP',
      'پویا',
      '۲٬۴۸۰',
      '۲',
      'امروز ۰۹:۱۰',
      'سیستم',
      'فعال',
    ],
    statusIndex: 6,
  },
  {
    id: 'preview-segment-exhibition',
    cells: [
      'بازدیدکنندگان نمایشگاه',
      'دستی',
      '۸۴۰',
      '۱',
      'دیروز',
      'علی رضایی',
      'فعال',
    ],
    statusIndex: 6,
  },
  {
    id: 'preview-segment-inactive',
    cells: [
      'بدون خرید در ۱۲ ماه',
      'پویا',
      '۶٬۲۲۰',
      '۰',
      'امروز ۰۸:۴۰',
      'سیستم',
      'فعال',
    ],
    statusIndex: 6,
  },
];

function AudiencePage({
  tab,
  onOpen,
  onNotice,
}: {
  tab: string;
  onOpen: (item: MarketingPreviewItem) => void;
  onNotice: NoticeHandler;
}) {
  if (tab === 'segments') {
    return (
      <div className="grid gap-5">
        <SegmentBuilder onNotice={onNotice} />
        <PreviewTable
          columns={[
            'نام سگمنت',
            'نوع',
            'تعداد اعضا',
            'کمپین فعال',
            'آخرین بروزرسانی',
            'مالک',
            'وضعیت',
          ]}
          onNotice={onNotice}
          onOpen={onOpen}
          rows={segmentRows}
          section="audiences"
          tab={tab}
          title="فهرست سگمنت‌ها"
          totalLabel="۴ نمونه از ۳۴ سگمنت"
        />
      </div>
    );
  }
  if (tab === 'leads') {
    return (
      <div className="grid gap-5">
        <MetricGrid
          metrics={[
            { label: 'سرنخ جدید', value: '۱٬۸۴۲', icon: Target },
            {
              label: 'بدون پیگیری',
              value: '۲۱۸',
              icon: AlertTriangle,
              tone: 'rose',
            },
            {
              label: 'واجد شرایط',
              value: '۷۴۲',
              icon: CheckCircle2,
              tone: 'emerald',
            },
            {
              label: 'تبدیل‌شده',
              value: '۳۲۸',
              icon: BarChart3,
              tone: 'violet',
            },
          ]}
        />
        <PreviewTable
          columns={[
            'نام',
            'تلفن',
            'منبع ورود',
            'کمپین',
            'امتیاز',
            'وضعیت',
            'کارشناس فروش',
            'آخرین پیگیری',
          ]}
          onNotice={onNotice}
          onOpen={onOpen}
          rows={[
            {
              id: 'preview-lead-sara',
              cells: [
                'سارا محمدی',
                '۰۹۱۲•••۴۲۱۸',
                'فرم اروپا',
                'تابستان اروپا',
                '۸۷',
                'واجد شرایط',
                'علی رضایی',
                'امروز ۱۰:۱۲',
              ],
              statusIndex: 5,
            },
            {
              id: 'preview-lead-reza',
              cells: [
                'رضا کریمی',
                '۰۹۳۵•••۸۲۴۰',
                'تبلیغ گوگل',
                'پرواز استانبول',
                '۷۲',
                'درحال پیگیری',
                'مینا موسوی',
                'دیروز ۱۶:۴۰',
              ],
              statusIndex: 5,
            },
            {
              id: 'preview-lead-maryam',
              cells: [
                'مریم شریفی',
                '۰۹۱۰•••۱۲۹۴',
                'صفحه فرود',
                'هتل دبی',
                '۴۸',
                'جدید',
                'تخصیص‌نیافته',
                '۲ روز پیش',
              ],
              statusIndex: 5,
            },
          ]}
          section="audiences"
          tab={tab}
          title="سرنخ‌های مارکتینگ"
          totalLabel="۳ نمونه از ۱٬۸۴۲ سرنخ"
        />
      </div>
    );
  }
  if (tab === 'scoring') {
    const scoringGroups = [
      [
        'قواعد امتیاز مثبت',
        [
          ['تکمیل فرم درخواست سفر', '+۲۰ امتیاز'],
          ['بازدید صفحه قیمت بیش از ۲ بار', '+۱۲ امتیاز'],
          ['بازکردن ایمیل کمپین', '+۵ امتیاز'],
          ['کلیک روی لینک کوتاه', '+۸ امتیاز'],
        ],
      ],
      [
        'قواعد امتیاز منفی',
        [
          ['عدم پاسخ در ۳ پیگیری', '-۱۵ امتیاز'],
          ['لغو عضویت از کانال', '-۳۰ امتیاز'],
          ['شماره تماس نامعتبر', '-۵۰ امتیاز'],
          ['بدون تعامل در ۹۰ روز', '-۲۰ امتیاز'],
        ],
      ],
    ] as const;
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {scoringGroups.map(([title, rules]) => (
          <Panel
            actions={
              <Button
                onClick={() => onNotice(`فرم قانون جدید برای ${title} باز شد.`)}
                size="sm"
                variant="outline"
              >
                <Plus aria-hidden="true" className="size-4" /> قانون
              </Button>
            }
            key={title}
            title={title}
          >
            <div className="grid gap-3 p-4">
              {rules.map(([label, score]) => (
                <button
                  className="flex items-center justify-between rounded-xl border border-border p-4 text-start hover:bg-muted/30"
                  key={label}
                  onClick={() =>
                    onNotice(`قانون «${label}» برای ویرایش باز شد.`)
                  }
                  type="button"
                >
                  <span className="font-bold">{label}</span>
                  <strong
                    className={
                      score.startsWith('-')
                        ? 'text-destructive'
                        : 'text-emerald-700'
                    }
                  >
                    {score}
                  </strong>
                </button>
              ))}
            </div>
          </Panel>
        ))}
      </div>
    );
  }
  if (tab === 'sources') {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="منابع ورود سرنخ" description="۳۰ روز اخیر">
          <ProgressRows
            rows={[
              ['جستجوی گوگل', 86, '۳۴٪'],
              ['کمپین پیامک', 62, '۲۵٪'],
              ['شبکه اجتماعی', 48, '۱۹٪'],
              ['معرفی', 31, '۱۲٪'],
            ]}
          />
        </Panel>
        <Panel title="اولین و آخرین منبع">
          <dl className="p-5">
            {[
              ['سرنخ‌های چندمنبعی', '۳۸٪'],
              ['تغییر منبع تا تبدیل', '۲۱٪'],
              ['میانگین نقاط تماس', '۳.۴'],
              ['منبع بدون UTM', '۶٪'],
            ].map(([label, value]) => (
              <div
                className="flex justify-between border-b border-dashed border-border py-3 last:border-0"
                key={label}
              >
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-black">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    );
  }
  if (tab === 'subscriptions') {
    return (
      <div className="grid gap-5">
        <MetricGrid
          metrics={[
            { label: 'عضویت فعال', value: '۸۶٬۴۲۰', icon: MessageCircle },
            {
              label: 'لغو عضویت ۳۰ روز',
              value: '۶۲۸',
              icon: Power,
              tone: 'rose',
            },
            {
              label: 'لیست عدم ارسال',
              value: '۱٬۸۴۲',
              icon: AlertTriangle,
              tone: 'amber',
            },
            {
              label: 'رضایت ثبت‌شده',
              value: '۹۴٪',
              icon: ShieldCheck,
              tone: 'emerald',
            },
          ]}
        />
        <PreviewTable
          columns={[
            'مخاطب',
            'پیامک',
            'ایمیل',
            'واتساپ',
            'پوش',
            'آخرین تغییر',
            'منبع رضایت',
            'وضعیت',
          ]}
          onNotice={onNotice}
          onOpen={onOpen}
          rows={[
            {
              id: 'preview-subscription-sara',
              cells: [
                'سارا محمدی',
                'فعال',
                'فعال',
                'فعال',
                'فعال',
                'امروز',
                'فرم سایت',
                'مجاز',
              ],
              statusIndex: 7,
            },
            {
              id: 'preview-subscription-reza',
              cells: [
                'رضا کریمی',
                'فعال',
                'لغو',
                'فعال',
                'فعال',
                'دیروز',
                'مرکز تماس',
                'محدود',
              ],
              statusIndex: 7,
            },
            {
              id: 'preview-subscription-maryam',
              cells: [
                'مریم شریفی',
                'عدم ارسال',
                'عدم ارسال',
                'عدم ارسال',
                'عدم ارسال',
                '۲ روز پیش',
                'درخواست مشتری',
                'مسدود',
              ],
              statusIndex: 7,
            },
          ]}
          section="audiences"
          tab={tab}
          title="عضویت‌ها و رضایت مشتری"
          totalLabel="۳ نمونه از ۸۶٬۴۲۰ عضویت"
        />
      </div>
    );
  }
  return (
    <PreviewTable
      columns={[
        'نام',
        'نوع',
        'کمپین / سازمان',
        'تعداد',
        'منبع',
        'آخرین تغییر',
        'وضعیت',
      ]}
      onNotice={onNotice}
      onOpen={onOpen}
      rows={[
        {
          id: 'preview-campaign-audience-agencies',
          cells: [
            'گروه آژانس‌های همکار',
            'آژانس‌ها',
            'کمپین B2B پاییز',
            '۳۴۲',
            'B2B',
            'امروز',
            'فعال',
          ],
          statusIndex: 6,
        },
        {
          id: 'preview-campaign-audience-pars',
          cells: [
            'کارکنان شرکت پارس',
            'سازمانی',
            'پیشنهاد سفر شرکتی',
            '۱٬۲۸۰',
            'مشتریان سازمانی',
            'دیروز',
            'فعال',
          ],
          statusIndex: 6,
        },
        {
          id: 'preview-campaign-audience-europe',
          cells: [
            'مشتریان تور اروپا',
            'مشتریان',
            'تابستان اروپا',
            '۱۲٬۸۴۰',
            'Customers',
            'امروز',
            'فعال',
          ],
          statusIndex: 6,
        },
      ]}
      section="audiences"
      tab={tab}
      title="مخاطبان کمپین‌ها"
      totalLabel="۳ نمونه از ۱۸ گروه"
    />
  );
}

function ChannelCheckbox({
  checked,
  icon: Icon,
  label,
  onChange,
}: {
  checked: boolean;
  icon: LucideIcon;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface p-3 hover:bg-muted/30">
      <Icon aria-hidden="true" className="size-5 text-primary" />
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
      />
      <span className="font-bold">{label}</span>
    </label>
  );
}

function MessageComposer({ onNotice }: { onNotice: NoticeHandler }) {
  const [message, setMessage] = useState(
    'تا ۳۱ شهریور، سفر اروپا را با نرخ ویژه رزرو کنید. مشاهده پیشنهادها: {{short_link}}',
  );
  const [campaign, setCampaign] = useState('europe');
  const [audience, setAudience] = useState('europe-fans');
  const [sendMode, setSendMode] = useState('now');
  const [channels, setChannels] = useState({
    sms: true,
    email: false,
    whatsapp: false,
    push: false,
  });
  const toggle = (key: keyof typeof channels, value: boolean) =>
    setChannels((current) => ({ ...current, [key]: value }));
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
      <Card className="p-5">
        <h3 className="text-lg font-black">ارسال پیام</h3>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <FormField id="message-campaign" label="کمپین">
            <SimpleSelect
              ariaLabel="انتخاب کمپین پیام"
              onChange={setCampaign}
              options={[
                ['europe', 'جشنواره تابستان اروپا'],
                ['istanbul', 'پرواز استانبول'],
              ]}
              value={campaign}
            />
          </FormField>
          <FormField id="message-audience" label="مخاطبان">
            <SimpleSelect
              ariaLabel="انتخاب مخاطبان پیام"
              onChange={setAudience}
              options={[
                ['europe-fans', 'علاقه‌مندان اروپا · ۱۲٬۸۴۰'],
                ['vip', 'مشتریان VIP · ۲٬۴۸۰'],
              ]}
              value={audience}
            />
          </FormField>
          <div className="grid gap-2 md:col-span-2">
            <span className="text-sm font-bold">کانال‌ها</span>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <ChannelCheckbox
                checked={channels.sms}
                icon={Phone}
                label="پیامک"
                onChange={(value) => toggle('sms', value)}
              />
              <ChannelCheckbox
                checked={channels.email}
                icon={Mail}
                label="ایمیل"
                onChange={(value) => toggle('email', value)}
              />
              <ChannelCheckbox
                checked={channels.whatsapp}
                icon={MessageCircle}
                label="واتساپ"
                onChange={(value) => toggle('whatsapp', value)}
              />
              <ChannelCheckbox
                checked={channels.push}
                icon={BellRing}
                label="پوش"
                onChange={(value) => toggle('push', value)}
              />
            </div>
          </div>
          <FormField id="message-template" label="قالب پیام">
            <SimpleSelect
              ariaLabel="انتخاب قالب پیام"
              onChange={() => undefined}
              options={[['wave-2', 'اروپا — موج دوم']]}
              value="wave-2"
            />
          </FormField>
          <FormField id="message-mode" label="روش ارسال">
            <SimpleSelect
              ariaLabel="روش ارسال"
              onChange={setSendMode}
              options={[
                ['now', 'ارسال فوری'],
                ['scheduled', 'زمان‌بندی'],
              ]}
              value={sendMode}
            />
          </FormField>
          {sendMode === 'scheduled' ? (
            <FormField id="message-date" label="تاریخ ارسال">
              <DatePicker
                id="message-date"
                onChange={() => undefined}
                value="2026-09-12"
              />
            </FormField>
          ) : null}
          <FormField id="message-body" label="متن پیام">
            <Textarea
              id="message-body"
              onChange={(event) => setMessage(event.target.value)}
              rows={6}
              value={message}
            />
          </FormField>
          <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
            <span className="text-muted-foreground">هزینه برآوردی</span>
            <strong className="mt-2 block">۲۴۹ میلیون تومان</strong>
            <small className="mt-1 block text-muted-foreground">
              ۱۲٬۴۵۴ مخاطب مجاز
            </small>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
            <span className="text-muted-foreground">وضعیت تأیید</span>
            <Badge className="mt-2 block w-fit bg-emerald-100 text-emerald-800">
              قالب و بودجه تأییدشده
            </Badge>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-between gap-2 border-t border-border pt-4">
          <Button
            onClick={() => onNotice('پیش‌نویس پیام به‌صورت محلی ذخیره شد.')}
            variant="outline"
          >
            <Save aria-hidden="true" className="size-4" /> ذخیره پیش‌نویس
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => onNotice('پیش‌نمایش پیام بروزرسانی شد.')}
              variant="outline"
            >
              <Eye aria-hidden="true" className="size-4" /> پیش‌نمایش
            </Button>
            <Button
              onClick={() =>
                onNotice(
                  'نیت ارسال برای تأیید نهایی ثبت شد؛ ارسال واقعی انجام نشد.',
                )
              }
            >
              <Send aria-hidden="true" className="size-4" /> تأیید و ارسال
            </Button>
          </div>
        </div>
      </Card>
      <Card className="bg-slate-100 p-5 dark:bg-slate-950">
        <p className="text-center text-sm text-muted-foreground">
          پیش‌نمایش پیامک
        </p>
        <div className="mt-5 rounded-2xl rounded-br-sm bg-emerald-100 p-4 text-sm leading-7 text-emerald-950 shadow-sm dark:bg-emerald-950 dark:text-emerald-100">
          <strong>نیایش سیر</strong>
          <p className="mt-2 whitespace-pre-wrap">
            {message.replace('{{short_link}}', 'nys.ir/eu25')}
          </p>
          <small className="mt-2 block text-emerald-700 dark:text-emerald-300">
            اکنون · ۱۰:۲۸
          </small>
        </div>
      </Card>
    </div>
  );
}

const communicationRows: readonly PreviewRow[] = [
  {
    id: 'preview-communication-europe',
    cells: [
      'جشنواره تابستان اروپا',
      'پیامک',
      '۲۲٬۴۸۰',
      'امروز ۱۰:۰۰',
      '۲۱٬۹۸۴',
      '۴۹۶',
      '۲۱٬۶۴۰',
      '—',
      '۱٬۸۴۲',
      '۱۸',
      '۴۳۸ میلیون',
      'پایان‌یافته',
    ],
    statusIndex: 11,
  },
  {
    id: 'preview-communication-istanbul',
    cells: [
      'پرواز استانبول',
      'پوش',
      '۹٬۸۴۰',
      'دیروز ۱۸:۳۰',
      '۹٬۶۸۲',
      '۱۵۸',
      '۹٬۵۴۰',
      '۴٬۲۱۲',
      '۸۶۴',
      '۲۴',
      '۳۲ میلیون',
      'پایان‌یافته',
    ],
    statusIndex: 11,
  },
  {
    id: 'preview-communication-dubai',
    cells: [
      'هتل‌های دبی',
      'ایمیل',
      '۱۸٬۲۱۰',
      'فردا ۱۲:۰۰',
      '—',
      '—',
      '—',
      '—',
      '—',
      '—',
      '۲۸ میلیون',
      'زمان‌بندی‌شده',
    ],
    statusIndex: 11,
  },
];

function CommunicationsPage({
  tab,
  onOpen,
  onNotice,
}: {
  tab: string;
  onOpen: (item: MarketingPreviewItem) => void;
  onNotice: NoticeHandler;
}) {
  if (tab === 'send') return <MessageComposer onNotice={onNotice} />;
  if (tab === 'templates') {
    return (
      <div className="grid gap-5">
        <MetricGrid
          metrics={[
            { label: 'همه قالب‌ها', value: '۶۸', icon: FileText },
            {
              label: 'تأییدشده',
              value: '۵۲',
              icon: CheckCircle2,
              tone: 'emerald',
            },
            {
              label: 'در انتظار تأیید',
              value: '۹',
              icon: Clock3,
              tone: 'amber',
            },
            { label: 'منقضی', value: '۷', icon: AlertTriangle, tone: 'rose' },
          ]}
        />
        <PreviewTable
          columns={[
            'نام قالب',
            'کانال',
            'موضوع / آغاز متن',
            'سرویس‌دهنده',
            'نسخه',
            'آخرین استفاده',
            'تأیید سرویس',
            'وضعیت',
          ]}
          onNotice={onNotice}
          onOpen={onOpen}
          rows={[
            {
              id: 'preview-template-europe',
              cells: [
                'اروپا — موج دوم',
                'پیامک',
                'تا ۳۱ شهریور، سفر اروپا...',
                'کاوه‌نگار',
                'v3',
                'امروز',
                'تأییدشده',
                'فعال',
              ],
              statusIndex: 7,
            },
            {
              id: 'preview-template-dubai',
              cells: [
                'پیشنهاد هتل دبی',
                'ایمیل',
                'اقامت ویژه در دبی',
                'SendGrid',
                'v2',
                'دیروز',
                'داخلی',
                'فعال',
              ],
              statusIndex: 7,
            },
            {
              id: 'preview-template-cart',
              cells: [
                'یادآوری سبد خرید',
                'واتساپ',
                'رزرو شما هنوز کامل نشده...',
                'Meta',
                'v4',
                '۲ روز پیش',
                'تأییدشده',
                'فعال',
              ],
              statusIndex: 7,
            },
          ]}
          section="communications"
          tab={tab}
          title="قالب‌های پیام"
          totalLabel="۳ نمونه از ۶۸ قالب"
        />
      </div>
    );
  }
  const title =
    tab === 'scheduled'
      ? 'ارسال‌های زمان‌بندی‌شده'
      : tab === 'channels'
        ? 'عملکرد کانال‌ها'
        : 'تاریخچه ارسال‌ها';
  return (
    <div className="grid gap-5">
      <MetricGrid
        metrics={[
          { label: 'کل ارسال', value: '۱.۲۸ میلیون', icon: Send },
          {
            label: 'تحویل‌شده',
            value: '۱.۱۸ میلیون',
            icon: CheckCircle2,
            tone: 'emerald',
          },
          { label: 'بازشده', value: '۴۲۱ هزار', icon: Mail, tone: 'violet' },
          {
            label: 'ناموفق',
            value: '۳۱ هزار',
            icon: AlertTriangle,
            tone: 'rose',
          },
        ]}
      />
      <PreviewTable
        columns={[
          'کمپین',
          'کانال',
          'مخاطب',
          'زمان',
          'موفق',
          'ناموفق',
          'تحویل',
          'بازشدن',
          'کلیک',
          'لغو عضویت',
          'هزینه',
          'وضعیت',
        ]}
        onNotice={onNotice}
        onOpen={onOpen}
        rows={communicationRows}
        section="communications"
        tab={tab}
        title={title}
        totalLabel="۳ نمونه از ۴۲ ارسال"
      />
    </div>
  );
}

const contentTableRows = {
  forms: [
    {
      id: 'preview-form-europe',
      cells: [
        'درخواست مشاوره اروپا',
        'ثبت‌نام',
        'تابستان اروپا',
        'صفحه اروپا',
        '۱٬۸۴۲',
        '۶۸٪',
        'امروز ۱۰:۲۴',
        'منتشرشده',
      ],
      statusIndex: 7,
    },
    {
      id: 'preview-form-istanbul',
      cells: [
        'نظرسنجی سفر استانبول',
        'نظرسنجی',
        'پرواز استانبول',
        '—',
        '۶۴۸',
        '۵۴٪',
        'دیروز ۲۱:۱۰',
        'منتشرشده',
      ],
      statusIndex: 7,
    },
    {
      id: 'preview-form-nowruz',
      cells: [
        'پیش‌ثبت‌نام نوروز',
        'ثبت‌نام',
        'نوروز ۱۴۰۶',
        'نوروز زودهنگام',
        '۰',
        '—',
        '—',
        'پیش‌نویس',
      ],
      statusIndex: 7,
    },
  ],
  landing: [
    {
      id: 'preview-landing-europe',
      cells: [
        'تابستان اروپا',
        'travel.niyayesh.ir/europe',
        'تابستان اروپا',
        'درخواست مشاوره اروپا',
        '۳۸٬۴۲۰',
        '۴.۸٪',
        'امروز ۰۸:۰۰',
        'منتشرشده',
      ],
      statusIndex: 7,
    },
    {
      id: 'preview-landing-istanbul',
      cells: [
        'پرواز استانبول',
        'niyayesh.ir/istanbul',
        'پرواز استانبول',
        'فرم تماس سریع',
        '۲۴٬۸۸۰',
        '۳.۹٪',
        'دیروز',
        'منتشرشده',
      ],
      statusIndex: 7,
    },
    {
      id: 'preview-landing-nowruz',
      cells: [
        'نوروز ۱۴۰۶',
        'travel.niyayesh.ir/nowruz',
        'نوروز ۱۴۰۶',
        'پیش‌ثبت‌نام نوروز',
        '۰',
        '—',
        '—',
        'پیش‌نویس',
      ],
      statusIndex: 7,
    },
  ],
  links: [
    {
      id: 'preview-link-europe',
      cells: [
        'صفحه اروپا - پیامک',
        '/europe-summer',
        'sms / campaign',
        'nys.ir/eu25',
        'دانلود',
        '۱۸٬۴۲۰',
        '۱٬۲۸۴',
        'تابستان اروپا',
        'فعال',
      ],
      statusIndex: 8,
    },
    {
      id: 'preview-link-istanbul',
      cells: [
        'استانبول - پوش',
        '/istanbul-flight',
        'push / notification',
        'nys.ir/is25',
        'دانلود',
        '۹٬۸۴۰',
        '۴۸۶',
        'پرواز استانبول',
        'فعال',
      ],
      statusIndex: 8,
    },
    {
      id: 'preview-link-dubai',
      cells: [
        'هتل دبی - اینستاگرام',
        '/dubai-hotels',
        'instagram / social',
        'nys.ir/dbh',
        'دانلود',
        '۱۲٬۲۲۰',
        '۵۴۲',
        'هتل‌های دبی',
        'فعال',
      ],
      statusIndex: 8,
    },
  ],
} satisfies Record<string, readonly PreviewRow[]>;

function ContentPage({
  tab,
  onOpen,
  onNotice,
}: {
  tab: string;
  onOpen: (item: MarketingPreviewItem) => void;
  onNotice: NoticeHandler;
}) {
  if (tab === 'library') {
    const assets = [
      ['بنر اروپا — دسکتاپ', 'تصویر · v4', FileImage],
      ['ویدئوی هتل دبی', 'ویدئو · v2', FileImage],
      ['راهنمای سفر استانبول', 'PDF · v3', FileText],
      ['بنر نوروز سازمانی', 'تصویر · v1', FileImage],
      ['قالب ایمیل تابستان', 'HTML · v5', Mail],
      ['QR بروشور نمایشگاه', 'تصویر · v2', Target],
      ['لوگوی کمپین اروپا', 'SVG · v1', FileImage],
      ['فایل بودجه رسانه', 'Excel · v6', FileText],
    ] as const;
    return (
      <Panel
        actions={
          <Button
            onClick={() =>
              onNotice('انتخاب‌گر فایل آزمایشی باز شد؛ فایلی ارسال نشد.')
            }
          >
            <Upload aria-hidden="true" className="size-4" /> بارگذاری فایل
          </Button>
        }
        title="کتابخانه محتوا"
      >
        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
          {assets.map(([title, meta, Icon], index) => (
            <Card className="overflow-hidden" key={title}>
              <div className="grid h-28 place-items-center bg-gradient-to-br from-blue-50 to-violet-50 dark:from-blue-950/40 dark:to-violet-950/40">
                <Icon aria-hidden="true" className="size-10 text-primary" />
              </div>
              <div className="p-4">
                <strong>{title}</strong>
                <small className="mt-1 block text-muted-foreground">
                  {meta} · تأییدشده
                </small>
                <div className="mt-3 flex gap-1">
                  <Button
                    aria-label={`مشاهده ${title}`}
                    onClick={() =>
                      onOpen({
                        id: `preview-asset-${index}`,
                        section: 'content',
                        tab,
                        title,
                        description: meta,
                        status: 'تأییدشده',
                        meta,
                        updatedAt: '2026-09-03T08:30:00.000Z',
                      })
                    }
                    size="icon"
                    variant="outline"
                  >
                    <Eye aria-hidden="true" className="size-4" />
                  </Button>
                  <Button
                    aria-label={`دانلود ${title}`}
                    onClick={() =>
                      onNotice(`دانلود آزمایشی «${title}» آماده شد.`)
                    }
                    size="icon"
                    variant="outline"
                  >
                    <Download aria-hidden="true" className="size-4" />
                  </Button>
                  <Button
                    aria-label={`عملیات بیشتر ${title}`}
                    onClick={() => onNotice(`منوی عملیات «${title}» باز شد.`)}
                    size="icon"
                    variant="ghost"
                  >
                    <MoreHorizontal aria-hidden="true" className="size-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Panel>
    );
  }
  const config =
    tab === 'forms'
      ? {
          title: 'فرم‌ها',
          columns: [
            'نام فرم',
            'نوع',
            'کمپین',
            'صفحه فرود',
            'تعداد پاسخ',
            'نرخ تکمیل',
            'آخرین پاسخ',
            'وضعیت',
          ],
          total: '۳ نمونه از ۱۸ فرم',
        }
      : tab === 'landing'
        ? {
            title: 'صفحات فرود',
            columns: [
              'عنوان',
              'دامنه / سایت',
              'کمپین',
              'فرم متصل',
              'بازدید',
              'تبدیل',
              'آخرین انتشار',
              'وضعیت',
            ],
            total: '۳ نمونه از ۱۲ صفحه',
          }
        : {
            title: 'UTM، لینک کوتاه و QR Code',
            columns: [
              'عنوان',
              'نشانی مقصد',
              'UTM Source / Medium',
              'لینک کوتاه',
              'QR',
              'کلیک',
              'تبدیل',
              'کمپین',
              'وضعیت',
            ],
            total: '۳ نمونه از ۱۴۲ لینک',
          };
  return (
    <div className="grid gap-5">
      {tab === 'links' ? (
        <MetricGrid
          metrics={[
            { label: 'لینک فعال', value: '۱۴۲', icon: Link2 },
            {
              label: 'کلیک ۳۰ روز',
              value: '۸۶٬۴۲۰',
              icon: Target,
              tone: 'violet',
            },
            {
              label: 'نرخ تبدیل',
              value: '۴.۷٪',
              icon: BarChart3,
              tone: 'emerald',
            },
            {
              label: 'لینک منقضی',
              value: '۸',
              icon: AlertTriangle,
              tone: 'rose',
            },
          ]}
        />
      ) : null}
      <PreviewTable
        columns={config.columns}
        onNotice={onNotice}
        onOpen={onOpen}
        rows={contentTableRows[tab as keyof typeof contentTableRows] ?? []}
        section="content"
        tab={tab}
        title={config.title}
        totalLabel={config.total}
      />
    </div>
  );
}

const discountRows: readonly PreviewRow[] = [
  {
    id: 'preview-discount-europe10',
    cells: [
      'EUROPE10',
      'تخفیف اروپا',
      'درصدی',
      '۱۰٪',
      'تور و هتل اروپا',
      '۵۰ میلیون',
      '۵٬۰۰۰',
      '۳٬۸۴۲',
      'تا ۳۱ شهریور',
      'تابستان اروپا',
      'فعال',
    ],
    statusIndex: 10,
  },
  {
    id: 'preview-discount-ist5m',
    cells: [
      'IST5M',
      'پرواز استانبول',
      'مبلغی',
      '۵ میلیون',
      'پرواز استانبول',
      '۳۰ میلیون',
      '۲٬۰۰۰',
      '۱٬۲۸۴',
      'تا ۲۵ شهریور',
      'پرواز استانبول',
      'فعال',
    ],
    statusIndex: 10,
  },
  {
    id: 'preview-discount-vipdubai',
    cells: [
      'VIPDUBAI',
      'ویژه VIP',
      'درصدی',
      '۱۲٪',
      'هتل دبی',
      '۸۰ میلیون',
      '۵۰۰',
      '۳۴۸',
      'تا ۱۵ مهر',
      'هتل‌های دبی',
      'فعال',
    ],
    statusIndex: 10,
  },
];

function OffersPage({
  tab,
  onOpen,
  onNotice,
}: {
  tab: string;
  onOpen: (item: MarketingPreviewItem) => void;
  onNotice: NoticeHandler;
}) {
  if (tab === 'specials') {
    return (
      <PreviewTable
        columns={[
          'عنوان',
          'خدمت',
          'مقصد / تأمین‌کننده',
          'قیمت اصلی',
          'قیمت ویژه',
          'ظرفیت',
          'سایت',
          'بازه اعتبار',
          'کمپین',
          'وضعیت',
        ]}
        onNotice={onNotice}
        onOpen={onOpen}
        rows={[
          {
            id: 'preview-special-paris',
            cells: [
              'تور پاریس ۷ شب',
              'تور',
              'فرانسه',
              '۱۴۸ میلیون',
              '۱۲۹ میلیون',
              '۲۴',
              'هر دو سایت',
              '۱ تا ۳۱ شهریور',
              'تابستان اروپا',
              'فعال',
            ],
            statusIndex: 9,
          },
          {
            id: 'preview-special-dubai',
            cells: [
              'هتل دبی ۴ شب',
              'هتل',
              'دبی / Atlantis',
              '۹۲ میلیون',
              '۷۸ میلیون',
              '۱۸',
              'سایت اصلی',
              '۱۵ شهریور تا ۱۵ مهر',
              'هتل‌های دبی',
              'فعال',
            ],
            statusIndex: 9,
          },
          {
            id: 'preview-special-istanbul',
            cells: [
              'پرواز استانبول',
              'پرواز',
              'ترکیش',
              '۴۸ میلیون',
              '۴۲ میلیون',
              '۶۰',
              'سایت دوم',
              '۵ تا ۲۵ شهریور',
              'پرواز استانبول',
              'فعال',
            ],
            statusIndex: 9,
          },
        ]}
        section="offers"
        tab={tab}
        title="پیشنهادهای ویژه"
        totalLabel="۳ نمونه از ۲۸ پیشنهاد"
      />
    );
  }
  const title =
    tab === 'usage'
      ? 'گزارش استفاده از تخفیف‌ها'
      : tab === 'rules'
        ? 'قوانین استفاده'
        : 'کدهای تخفیف';
  return (
    <div className="grid gap-5">
      <MetricGrid
        metrics={[
          { label: 'کد فعال', value: '۳۸', icon: BadgePercent },
          {
            label: 'استفاده ۳۰ روز',
            value: '۶٬۸۴۰',
            icon: WandSparkles,
            tone: 'violet',
          },
          {
            label: 'ارزش تخفیف',
            value: '۲.۴ میلیارد',
            icon: CircleDollarSign,
            tone: 'amber',
          },
          {
            label: 'درحال انقضا',
            value: '۶',
            icon: AlertTriangle,
            tone: 'rose',
          },
        ]}
      />
      <PreviewTable
        columns={[
          'کد',
          'عنوان',
          'نوع',
          'مقدار',
          'خدمت / مقصد',
          'حداقل خرید',
          'سقف استفاده',
          'مصرف‌شده',
          'اعتبار',
          'کمپین',
          'وضعیت',
        ]}
        onNotice={onNotice}
        onOpen={onOpen}
        rows={discountRows}
        section="offers"
        tab={tab}
        title={title}
        totalLabel="۳ نمونه از ۳۸ کد"
      />
    </div>
  );
}

const journeyRows: readonly PreviewRow[] = [
  {
    id: 'preview-journey-europe',
    cells: [
      'پیگیری سرنخ اروپا',
      'ثبت فرم اروپا',
      '۱٬۲۸۴',
      '۳٬۸۴۰',
      '۷۸٪',
      '۲ دقیقه پیش',
      'مریم احمدی',
      'فعال',
    ],
    statusIndex: 7,
  },
  {
    id: 'preview-journey-cart',
    cells: [
      'سبد خرید رهاشده',
      'عدم تکمیل رزرو',
      '۶۴۸',
      '۱٬۹۲۰',
      '۶۲٪',
      '۵ دقیقه پیش',
      'سیستم',
      'فعال',
    ],
    statusIndex: 7,
  },
  {
    id: 'preview-journey-istanbul',
    cells: [
      'پس از سفر استانبول',
      'پایان رزرو',
      '۳۲۸',
      '۸۴۰',
      '۸۸٪',
      '۱۰ دقیقه پیش',
      'علی رضایی',
      'فعال',
    ],
    statusIndex: 7,
  },
  {
    id: 'preview-journey-return',
    cells: [
      'بازگشت مشتری غیرفعال',
      'بدون خرید ۱۲ ماه',
      '۲٬۴۸۰',
      '۴٬۲۰۰',
      '۴۱٪',
      'دیروز',
      'سمیرا نادری',
      'متوقف',
    ],
    statusIndex: 7,
  },
];

function JourneyBuilder({ onNotice }: { onNotice: NoticeHandler }) {
  return (
    <Panel
      actions={
        <>
          <Button
            onClick={() => onNotice('پیش‌نویس سفر مشتری ذخیره شد.')}
            variant="outline"
          >
            <Save aria-hidden="true" className="size-4" /> ذخیره پیش‌نویس
          </Button>
          <Button
            onClick={() =>
              onNotice('اتوماسیون آزمایشی فعال شد؛ پیام واقعی ارسال نمی‌شود.')
            }
          >
            <Power aria-hidden="true" className="size-4" /> فعال‌سازی
          </Button>
        </>
      }
      title="سازنده سفر مشتری"
    >
      <div className="min-h-[32rem] overflow-x-auto bg-[radial-gradient(circle,_hsl(var(--border))_1px,_transparent_1px)] bg-[size:20px_20px] p-8">
        <div className="mx-auto grid min-w-[48rem] max-w-5xl grid-cols-[1fr_5rem_1fr_5rem_1fr] items-center gap-3">
          <button
            className="rounded-2xl border border-emerald-300 bg-surface p-5 text-start shadow-sm"
            onClick={() => onNotice('تنظیمات رویداد شروع باز شد.')}
            type="button"
          >
            <strong>شروع</strong>
            <p className="mt-2 text-sm text-muted-foreground">
              ثبت فرم درخواست اروپا
            </p>
            <Badge className="mt-3 bg-emerald-100 text-emerald-800">
              رویداد سایت
            </Badge>
          </button>
          <div className="h-0.5 bg-border" />
          <button
            className="rounded-2xl border border-amber-300 bg-surface p-5 text-start shadow-sm"
            onClick={() => onNotice('تنظیمات شرط امتیاز باز شد.')}
            type="button"
          >
            <strong>شرط</strong>
            <p className="mt-2 text-sm text-muted-foreground">
              امتیاز سرنخ بیشتر از ۶۰؟
            </p>
            <Badge className="mt-3 bg-amber-100 text-amber-800">
              شاخه تصمیم
            </Badge>
          </button>
          <div className="h-0.5 bg-border" />
          <div className="grid gap-5">
            <button
              className="rounded-2xl border border-blue-300 bg-surface p-5 text-start shadow-sm"
              onClick={() => onNotice('اقدام مسیر بله باز شد.')}
              type="button"
            >
              <strong>اگر بله</strong>
              <p className="mt-2 text-sm text-muted-foreground">
                ارسال پیامک + تخصیص فروش
              </p>
              <Badge className="mt-3">اقدام</Badge>
            </button>
            <button
              className="rounded-2xl border border-violet-300 bg-surface p-5 text-start shadow-sm"
              onClick={() => onNotice('اقدام مسیر خیر باز شد.')}
              type="button"
            >
              <strong>اگر خیر</strong>
              <p className="mt-2 text-sm text-muted-foreground">
                ارسال ایمیل آموزشی پس از ۲۴ ساعت
              </p>
              <Badge className="mt-3 bg-violet-100 text-violet-800">
                تأخیر
              </Badge>
            </button>
          </div>
        </div>
        <Button
          className="mt-8"
          onClick={() => onNotice('انتخاب‌گر مرحله جدید باز شد.')}
          variant="outline"
        >
          <Plus aria-hidden="true" className="size-4" /> افزودن مرحله
        </Button>
      </div>
    </Panel>
  );
}

function JourneysPage({
  tab,
  onOpen,
  onNotice,
}: {
  tab: string;
  onOpen: (item: MarketingPreviewItem) => void;
  onNotice: NoticeHandler;
}) {
  if (tab === 'builder') return <JourneyBuilder onNotice={onNotice} />;
  if (tab === 'scenarios') {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          ['خوش‌آمدگویی سرنخ جدید', '۳ مرحله · پیامک و ایمیل', Target],
          ['رهاکردن فرم رزرو', '۵ مرحله · پوش و تماس', ShoppingCart],
          ['پیگیری پس از سفر', '۴ مرحله · ایمیل و نظرسنجی', Mail],
          ['فعال‌سازی مشتری غیرفعال', '۶ مرحله · چندکاناله', UsersRound],
          ['یادآوری انقضای ویزا', '۳ مرحله · پیامک', CalendarDays],
          ['تبریک تولد مشتری VIP', '۲ مرحله · پیشنهاد ویژه', BadgePercent],
        ].map(([title, meta, Icon]) => {
          const ScenarioIcon = Icon as LucideIcon;
          return (
            <Card className="p-5" key={title as string}>
              <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <ScenarioIcon aria-hidden="true" className="size-6" />
              </span>
              <h3 className="mt-4 font-black">{title as string}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {meta as string}
              </p>
              <Button
                className="mt-4"
                onClick={() => onNotice(`سناریوی «${title}» در سازنده کپی شد.`)}
                size="sm"
              >
                استفاده از سناریو
              </Button>
            </Card>
          );
        })}
      </div>
    );
  }
  const title =
    tab === 'runs'
      ? 'اجرای اتوماسیون‌ها'
      : tab === 'history'
        ? 'تاریخچه اجرا'
        : 'همه سفرهای مشتری';
  return (
    <div className="grid gap-5">
      <MetricGrid
        metrics={[
          { label: 'اتوماسیون فعال', value: '۱۸', icon: Route },
          {
            label: 'ورودی امروز',
            value: '۴٬۸۲۰',
            icon: UsersRound,
            tone: 'violet',
          },
          {
            label: 'اقدام موفق',
            value: '۹۴٪',
            icon: CheckCircle2,
            tone: 'emerald',
          },
          {
            label: 'خطای اجرا',
            value: '۲۸',
            icon: AlertTriangle,
            tone: 'rose',
          },
        ]}
      />
      <PreviewTable
        columns={[
          'نام سفر',
          'رویداد شروع',
          'مخاطب فعال',
          'ورودی ۳۰ روز',
          'نرخ تکمیل',
          'آخرین اجرا',
          'مالک',
          'وضعیت',
        ]}
        onNotice={onNotice}
        onOpen={onOpen}
        rows={journeyRows}
        section="journeys"
        tab={tab}
        title={title}
        totalLabel="۴ نمونه از ۱۸ سفر"
      />
    </div>
  );
}

const reportRows: readonly PreviewRow[] = [
  {
    id: 'preview-report-europe',
    cells: [
      'جشنواره تابستان اروپا',
      '۲.۱ میلیارد',
      '۱٬۴۸۲',
      '۳۵۲',
      '۶.۴ میلیارد',
      '۵.۸ میلیارد',
      '۱.۴ میلیون',
      '۱۷۶٪',
      '۳.۰۵×',
    ],
  },
  {
    id: 'preview-report-istanbul',
    cells: [
      'پرواز استانبول',
      '۱.۴ میلیارد',
      '۹۶۸',
      '۲۱۸',
      '۵.۲ میلیارد',
      '۴.۹ میلیارد',
      '۱.۵ میلیون',
      '۲۵۰٪',
      '۳.۷۱×',
    ],
  },
  {
    id: 'preview-report-dubai',
    cells: [
      'هتل‌های دبی',
      '۹۸۰ میلیون',
      '۷۴۱',
      '۱۶۵',
      '۳.۱ میلیارد',
      '۲.۸ میلیارد',
      '۱.۳ میلیون',
      '۱۸۶٪',
      '۳.۱۶×',
    ],
  },
];

function ReportsPage({
  tab,
  onOpen,
  onNotice,
}: {
  tab: string;
  onOpen: (item: MarketingPreviewItem) => void;
  onNotice: NoticeHandler;
}) {
  const [startDate, setStartDate] = useState('2026-08-03');
  const [endDate, setEndDate] = useState('2026-09-03');
  const [site, setSite] = useState('all');
  const [channel, setChannel] = useState('all');
  const title =
    marketingSectionTabs.reports.find(([key]) => key === tab)?.[1] ??
    'عملکرد کمپین';
  return (
    <div className="grid gap-5">
      <FilterBar className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_12rem_12rem_auto]">
        <FormField id="reports-start" label="از تاریخ">
          <DatePicker
            id="reports-start"
            onChange={setStartDate}
            value={startDate}
          />
        </FormField>
        <FormField id="reports-end" label="تا تاریخ">
          <DatePicker id="reports-end" onChange={setEndDate} value={endDate} />
        </FormField>
        <FormField id="reports-site" label="سایت">
          <SimpleSelect
            ariaLabel="سایت گزارش"
            onChange={setSite}
            options={[
              ['all', 'هر دو سایت'],
              ['main', 'سایت اصلی'],
              ['second', 'سایت دوم'],
            ]}
            value={site}
          />
        </FormField>
        <FormField id="reports-channel" label="کانال">
          <SimpleSelect
            ariaLabel="کانال گزارش"
            onChange={setChannel}
            options={[
              ['all', 'همه کانال‌ها'],
              ['sms', 'پیامک'],
              ['email', 'ایمیل'],
              ['social', 'شبکه اجتماعی'],
            ]}
            value={channel}
          />
        </FormField>
        <Button
          onClick={() =>
            onNotice(
              `گزارش ${title} از ${startDate} تا ${endDate} بروزرسانی شد.`,
            )
          }
        >
          <Filter aria-hidden="true" className="size-4" /> اعمال فیلتر
        </Button>
      </FilterBar>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-100">
        <span>نمای ذخیره‌شده: گزارش هفتگی مدیر</span>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => onNotice('فیلتر گزارش به‌صورت محلی ذخیره شد.')}
            size="sm"
            variant="outline"
          >
            <Save aria-hidden="true" className="size-4" /> ذخیره فیلتر
          </Button>
          <Button
            onClick={() => onNotice('فرم زمان‌بندی گزارش باز شد.')}
            size="sm"
            variant="outline"
          >
            <CalendarDays aria-hidden="true" className="size-4" /> زمان‌بندی
            گزارش
          </Button>
          <Button
            onClick={() => onNotice(`خروجی آزمایشی ${title} آماده شد.`)}
            size="sm"
          >
            <Download aria-hidden="true" className="size-4" /> خروجی
          </Button>
        </div>
      </div>
      <MetricGrid
        metrics={[
          {
            label: 'فروش منتسب',
            value: '۲۶.۸ میلیارد',
            icon: CircleDollarSign,
            detail: '+۲۳٪',
            tone: 'emerald',
          },
          {
            label: 'سرنخ',
            value: '۳٬۸۴۲',
            icon: Target,
            detail: '+۱۸٪',
            tone: 'violet',
          },
          {
            label: 'CAC',
            value: '۱.۹ میلیون',
            icon: BarChart3,
            detail: '-۸٪',
            tone: 'amber',
          },
          { label: 'ROAS', value: '۳.۱۹×', icon: Gauge, detail: '+۰.۴×' },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={title} description="مقایسه با دوره قبل">
          <div className="p-5">
            <svg
              aria-label={`نمودار آزمایشی ${title}`}
              className="h-52 w-full"
              viewBox="0 0 700 220"
            >
              <path
                className="stroke-border"
                d="M20 30H680M20 80H680M20 130H680M20 180H680"
              />
              <path
                className="fill-none stroke-primary [stroke-width:4]"
                d="M20 172 C90 158 110 120 170 135 S260 78 320 104 S410 55 470 82 S570 42 680 48"
              />
            </svg>
          </div>
        </Panel>
        <Panel title="مقایسه کانال‌ها" description="سهم از نتیجه">
          <ProgressRows
            rows={[
              ['پیامک', 84, '۳۴٪'],
              ['ایمیل', 68, '۲۷٪'],
              ['شبکه اجتماعی', 55, '۲۲٪'],
              ['پوش', 31, '۱۲٪'],
            ]}
          />
        </Panel>
      </div>
      <PreviewTable
        actions={false}
        columns={[
          'کمپین',
          'هزینه',
          'سرنخ',
          'مشتری جدید',
          'فروش ناخالص',
          'فروش خالص',
          'CAC',
          'ROI',
          'ROAS',
        ]}
        onNotice={onNotice}
        onOpen={onOpen}
        rows={reportRows}
        searchable={false}
        section="reports"
        tab={tab}
        title="جزئیات گزارش"
        totalLabel="۳ نمونه از ۲۴ ردیف"
      />
    </div>
  );
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      aria-checked={checked}
      aria-label={label}
      className={cn(
        'relative h-7 w-12 rounded-full transition focus-visible:ring-2 focus-visible:ring-ring',
        checked ? 'bg-primary' : 'bg-muted-foreground/35',
      )}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span
        className={cn(
          'absolute top-1 size-5 rounded-full bg-white shadow transition-all',
          checked ? 'start-6' : 'start-1',
        )}
      />
    </button>
  );
}

function ChannelSettings({ onNotice }: { onNotice: NoticeHandler }) {
  const services = [
    ['sms', 'پنل پیامک', 'کاوه‌نگار · خط ۱۰۰۰۸۴۲۱', true, 'سالم'],
    ['email', 'سرویس ایمیل', 'SendGrid · ایمیل سازمانی مارکتینگ', true, 'سالم'],
    [
      'whatsapp',
      'واتساپ',
      'Meta Business · در انتظار تأیید',
      false,
      'نیازمند اقدام',
    ],
    ['push', 'پوش‌نوتیفیکیشن', 'Firebase · هر دو سایت', true, 'سالم'],
    ['internal', 'اعلان داخل سایت', 'Rubi Notification Service', true, 'سالم'],
  ] as const;
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(services.map(([id, , , initial]) => [id, initial])),
  );
  return (
    <Panel
      actions={
        <Button
          onClick={() =>
            onNotice('فرم اتصال سرویس باز شد؛ Credential دریافت نمی‌شود.')
          }
        >
          <Plus aria-hidden="true" className="size-4" /> اتصال سرویس
        </Button>
      }
      title="کانال‌ها و سرویس‌ها"
    >
      <div className="grid gap-3 p-5">
        {services.map(([id, title, description, , status]) => (
          <div
            className="grid gap-3 rounded-xl border border-border p-4 md:grid-cols-[1fr_10rem_auto] md:items-center"
            key={id}
          >
            <div>
              <strong>{title}</strong>
              <small className="mt-1 block text-muted-foreground">
                {description}
              </small>
            </div>
            <Badge className={statusClass(status)}>{status}</Badge>
            <Toggle
              checked={enabled[id] ?? false}
              label={`فعال‌سازی ${title}`}
              onChange={(value) => {
                setEnabled((current) => ({ ...current, [id]: value }));
                onNotice(`${title} ${value ? 'فعال' : 'غیرفعال'} شد.`);
              }}
            />
          </div>
        ))}
      </div>
    </Panel>
  );
}

function SettingsPage({
  tab,
  onOpen,
  onNotice,
}: {
  tab: string;
  onOpen: (item: MarketingPreviewItem) => void;
  onNotice: NoticeHandler;
}) {
  if (tab === 'channels') return <ChannelSettings onNotice={onNotice} />;
  if (tab === 'sites') {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {(
          [
            [
              'سایت اصلی',
              'niyayesh.ir',
              'GTM-NYS001',
              '۸ فرم',
              '۶ صفحه',
              '۱۴ رویداد',
            ],
            [
              'سایت دوم',
              'travel.niyayesh.ir',
              'GTM-NYS002',
              '۸ فرم',
              '۶ صفحه',
              '۱۴ رویداد',
            ],
          ] as const
        ).map(([title, domain, key, forms, landings, events]) => (
          <Panel
            actions={
              <Badge className="bg-emerald-100 text-emerald-800">فعال</Badge>
            }
            key={title}
            title={title}
          >
            <dl className="p-5">
              {[
                ['دامنه', domain],
                ['کلید رهگیری', key],
                ['فرم متصل', forms],
                ['صفحه فرود', landings],
                ['رویدادهای فعال', events],
              ].map(([label, value]) => (
                <div
                  className="flex justify-between border-b border-dashed border-border py-3 last:border-0"
                  key={label}
                >
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-bold">{value}</dd>
                </div>
              ))}
              <Button
                className="mt-4"
                onClick={() => onNotice(`تنظیمات ${title} برای ویرایش باز شد.`)}
                variant="outline"
              >
                <Pencil aria-hidden="true" className="size-4" /> ویرایش تنظیمات
              </Button>
            </dl>
          </Panel>
        ))}
      </div>
    );
  }
  if (tab === 'roles') {
    return (
      <PreviewTable
        columns={[
          'نقش',
          'کاربران',
          'کمپین',
          'مخاطبان حساس',
          'ارسال',
          'بودجه',
          'تأیید',
          'گزارش',
          'تنظیمات',
        ]}
        onNotice={onNotice}
        onOpen={onOpen}
        rows={[
          {
            id: 'preview-role-manager',
            cells: [
              'مدیر مارکتینگ',
              '۳',
              'کامل',
              'مشاهده محدود',
              'کامل',
              'کامل',
              'تأیید',
              'کامل',
              'مدیریت',
            ],
          },
          {
            id: 'preview-role-specialist',
            cells: [
              'کارشناس مارکتینگ',
              '۱۲',
              'ایجاد و ویرایش',
              'ماسک‌شده',
              'با تأیید',
              'مشاهده',
              'درخواست',
              'مشاهده',
              'بدون دسترسی',
            ],
          },
          {
            id: 'preview-role-content',
            cells: [
              'تولیدکننده محتوا',
              '۶',
              'مشاهده',
              'بدون دسترسی',
              'بدون دسترسی',
              'بدون دسترسی',
              'درخواست محتوا',
              'مشاهده',
              'بدون دسترسی',
            ],
          },
          {
            id: 'preview-role-analyst',
            cells: [
              'تحلیلگر گزارش',
              '۴',
              'فقط مشاهده',
              'تجمیعی',
              'بدون دسترسی',
              'مشاهده',
              'بدون دسترسی',
              'کامل',
              'بدون دسترسی',
            ],
          },
        ]}
        section="settings"
        tab={tab}
        title="نقش‌ها و دسترسی‌های مارکتینگ"
        totalLabel="۴ نمونه از ۶ نقش"
      />
    );
  }
  if (tab === 'alerts') {
    return (
      <PreviewTable
        columns={[
          'عنوان',
          'شرط فعال‌شدن',
          'دریافت‌کنندگان',
          'کانال اعلان',
          'اولویت',
          'آخرین رخداد',
          'وضعیت',
        ]}
        onNotice={onNotice}
        onOpen={onOpen}
        rows={[
          {
            id: 'preview-alert-budget',
            cells: [
              'پایان بودجه',
              'مصرف بیشتر از ۸۵٪',
              'مدیر کمپین، مالی',
              'اعلان داخل سیستم، ایمیل',
              'زیاد',
              'امروز ۰۹:۳۰',
              'فعال',
            ],
            statusIndex: 6,
          },
          {
            id: 'preview-alert-errors',
            cells: [
              'خطای ارسال بالا',
              'خطای بیشتر از ۵٪',
              'مدیر مارکتینگ، فنی',
              'اعلان، پیامک',
              'بحرانی',
              'دیروز ۱۸:۱۰',
              'فعال',
            ],
            statusIndex: 6,
          },
          {
            id: 'preview-alert-coupon',
            cells: [
              'کد تخفیف درحال انقضا',
              'کمتر از ۷ روز',
              'مالک کمپین',
              'ایمیل',
              'متوسط',
              '۲ روز پیش',
              'فعال',
            ],
            statusIndex: 6,
          },
          {
            id: 'preview-alert-lead',
            cells: [
              'سرنخ بدون پیگیری',
              'بیشتر از ۴۸ ساعت',
              'مدیر فروش',
              'اعلان',
              'زیاد',
              'امروز ۱۰:۰۰',
              'فعال',
            ],
            statusIndex: 6,
          },
        ]}
        section="settings"
        tab={tab}
        title="قواعد اعلان و هشدار"
        totalLabel="۴ نمونه از ۱۸ هشدار"
      />
    );
  }
  if (tab === 'logs') {
    return (
      <div className="grid gap-5">
        <MetricGrid
          metrics={[
            {
              label: 'خطای ارسال ۲۴ ساعت',
              value: '۳۱۸',
              icon: AlertTriangle,
              tone: 'rose',
            },
            { label: 'اتصال ناسالم', value: '۱', icon: Link2, tone: 'amber' },
            { label: 'Event ناموفق', value: '۲۸', icon: Route, tone: 'rose' },
            {
              label: 'تلاش مجدد موفق',
              value: '۹۲٪',
              icon: CheckCircle2,
              tone: 'emerald',
            },
          ]}
        />
        <PreviewTable
          actions={false}
          columns={[
            'زمان',
            'نوع',
            'سرویس / Job',
            'شرح عمومی',
            'تلاش مجدد',
            'کاربر / Actor',
            'Correlation ID',
            'وضعیت',
          ]}
          onNotice={onNotice}
          onOpen={onOpen}
          rows={[
            {
              id: 'preview-log-sms',
              cells: [
                'امروز ۱۰:۲۴',
                'ارسال',
                'SMS Worker',
                'عدم پاسخ سرویس‌دهنده',
                '۳ از ۵',
                'system',
                'cor-88f21',
                'درحال تلاش',
              ],
              statusIndex: 7,
            },
            {
              id: 'preview-log-event',
              cells: [
                'امروز ۰۹:۵۸',
                'Event',
                'LeadCreated Handler',
                'Timeout در پردازش',
                'موفق',
                'system',
                'cor-88e94',
                'رفع‌شده',
              ],
              statusIndex: 7,
            },
            {
              id: 'preview-log-whatsapp',
              cells: [
                'دیروز ۲۲:۱۰',
                'اتصال',
                'WhatsApp',
                'Token نیازمند تمدید',
                '—',
                'admin',
                'cor-87d12',
                'نیازمند اقدام',
              ],
              statusIndex: 7,
            },
          ]}
          searchable={false}
          section="settings"
          tab={tab}
          title="لاگ‌ها و خطاهای عملیاتی · فقط مدیر سیستم"
          totalLabel="۳ نمونه از ۴۷ رخداد"
        />
      </div>
    );
  }
  const settings = [
    ['منطقه زمانی گزارش‌ها', 'Asia/Tehran'],
    ['مدل انتساب پیش‌فرض', 'Last Click'],
    ['دوره نگهداری داده تحلیلی', '۲۴ ماه'],
    ['حد تأیید بودجه مدیر مارکتینگ', '۲ میلیارد تومان'],
    ['نمایش جزئیات فنی خطا', 'فقط کاربران فنی'],
  ] as const;
  return (
    <Panel
      actions={
        <Button
          onClick={() => onNotice('تغییرات تنظیمات عمومی در Preview ذخیره شد.')}
        >
          <Save aria-hidden="true" className="size-4" /> ذخیره تغییرات
        </Button>
      }
      title="تنظیمات عمومی مارکتینگ"
    >
      <div className="grid gap-3 p-5">
        {settings.map(([label, value]) => (
          <div
            className="grid gap-3 rounded-xl border border-border p-4 md:grid-cols-[1fr_15rem_auto] md:items-center"
            key={label}
          >
            <div>
              <strong>{label}</strong>
              <small className="mt-1 block text-muted-foreground">
                قابل تغییر توسط مدیر مجاز
              </small>
            </div>
            <SimpleSelect
              ariaLabel={label}
              onChange={() => undefined}
              options={[[value, value]]}
              value={value}
            />
            <Button
              onClick={() => onNotice(`ویرایش «${label}» فعال شد.`)}
              size="sm"
              variant="outline"
            >
              ویرایش
            </Button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

const sectionActionLabels: Record<DetailSection, string> = {
  audiences: 'سگمنت جدید',
  communications: 'ارسال پیام',
  content: 'محتوای جدید',
  offers: 'پیشنهاد جدید',
  journeys: 'ساخت اتوماسیون',
  reports: 'خروجی گزارش',
  settings: 'خروجی تنظیمات',
};

export function MarketingReferenceSection({
  section,
  onOpen,
  onNotice,
}: {
  section: DetailSection;
  onOpen: (item: MarketingPreviewItem) => void;
  onNotice: NoticeHandler;
}) {
  const tabs = marketingSectionTabs[section];
  const [tab, setTab] = useState(tabs.at(0)?.[0] ?? '');
  const runPrimaryAction = () => {
    if (section === 'communications') {
      setTab('send');
      onNotice('فرم ارسال پیام باز شد.');
      return;
    }
    if (section === 'journeys') {
      setTab('builder');
      onNotice('سازنده سفر مشتری باز شد.');
      return;
    }
    onNotice(`${sectionActionLabels[section]} در محیط آزمایشی باز شد.`);
  };
  return (
    <Tabs onValueChange={setTab} value={tab}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <TabsList
          aria-label={`زیر‌بخش‌های ${section}`}
          className="flex h-auto w-full flex-wrap justify-start gap-1 bg-blue-50 p-2 dark:bg-blue-950/40 xl:w-auto"
        >
          {tabs.map(([key, label]) => (
            <TabsTrigger key={key} value={key}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        {section !== 'reports' && section !== 'settings' ? (
          <Button onClick={runPrimaryAction}>
            <Plus aria-hidden="true" className="size-4" />
            {sectionActionLabels[section]}
          </Button>
        ) : null}
      </div>
      {tabs.map(([key, , description]) => (
        <TabsContent className="mt-5" key={key} value={key}>
          <p className="mb-4 text-sm text-muted-foreground">{description}</p>
          {section === 'audiences' ? (
            <AudiencePage onNotice={onNotice} onOpen={onOpen} tab={key} />
          ) : null}
          {section === 'communications' ? (
            <CommunicationsPage onNotice={onNotice} onOpen={onOpen} tab={key} />
          ) : null}
          {section === 'content' ? (
            <ContentPage onNotice={onNotice} onOpen={onOpen} tab={key} />
          ) : null}
          {section === 'offers' ? (
            <OffersPage onNotice={onNotice} onOpen={onOpen} tab={key} />
          ) : null}
          {section === 'journeys' ? (
            <JourneysPage onNotice={onNotice} onOpen={onOpen} tab={key} />
          ) : null}
          {section === 'reports' ? (
            <ReportsPage onNotice={onNotice} onOpen={onOpen} tab={key} />
          ) : null}
          {section === 'settings' ? (
            <SettingsPage onNotice={onNotice} onOpen={onOpen} tab={key} />
          ) : null}
        </TabsContent>
      ))}
    </Tabs>
  );
}

const campaignDetailTabs = [
  ['overview', 'نمای کلی'],
  ['audience', 'مخاطبان'],
  ['channels', 'محتوا و کانال‌ها'],
  ['budget', 'بودجه'],
  ['links', 'لینک‌ها و UTM'],
  ['leads', 'سرنخ‌ها'],
  ['sales', 'فروش'],
  ['report', 'گزارش'],
  ['activity', 'فعالیت‌ها'],
] as const;

export function CampaignDetailReference({
  campaign,
  onNotice,
}: {
  campaign: CampaignPreview;
  onNotice: NoticeHandler;
}) {
  const [tab, setTab] = useState('overview');
  const noopOpen = () => undefined;
  const status = campaignStatusLabels[campaign.status];
  return (
    <div className="grid gap-5">
      <Card className="flex flex-col gap-4 bg-gradient-to-l from-blue-50 to-surface p-5 dark:from-blue-950/40 lg:flex-row lg:items-center">
        <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Megaphone aria-hidden="true" className="size-8" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-xl font-black">{campaign.name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono" dir="ltr">
              {campaign.internalCode}
            </span>{' '}
            · {campaign.campaignType} · ۱ تا ۳۱ شهریور ۱۴۰۵
          </p>
        </div>
        <Badge className={statusClass(status)}>{status}</Badge>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => onNotice('گزارش سریع کمپین باز شد.')}
            size="sm"
            variant="outline"
          >
            <BarChart3 aria-hidden="true" className="size-4" /> گزارش سریع
          </Button>
          <Button
            onClick={() => onNotice('یک کپی آزمایشی از کمپین ساخته شد.')}
            size="sm"
            variant="outline"
          >
            <Copy aria-hidden="true" className="size-4" /> کپی کمپین
          </Button>
        </div>
      </Card>
      <Tabs onValueChange={setTab} value={tab}>
        <TabsList
          aria-label="صفحات جزئیات کمپین"
          className="flex h-auto w-full flex-wrap justify-start gap-1 bg-blue-50 p-2 dark:bg-blue-950/40"
        >
          {campaignDetailTabs.map(([key, label]) => (
            <TabsTrigger key={key} value={key}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent className="mt-5" value="overview">
          <div className="grid gap-4 xl:grid-cols-3">
            <Panel className="xl:col-span-2" title="هدف و برنامه اجرا">
              <dl className="grid gap-x-8 p-5 md:grid-cols-2">
                {[
                  ['نوع کمپین', campaign.campaignType],
                  ['سایت', 'هر دو سایت'],
                  ['خدمت', 'تور و پرواز اروپا'],
                  ['مسئول', 'مریم احمدی'],
                  ['شروع', '۱۴۰۵/۰۶/۰۱'],
                  ['پایان', '۱۴۰۵/۰۶/۳۱'],
                  ['هدف فروش', '۸ میلیارد تومان'],
                  ['بودجه مصوب', '۳.۲ میلیارد تومان'],
                ].map(([label, value]) => (
                  <div
                    className="flex justify-between border-b border-dashed border-border py-3"
                    key={label}
                  >
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-bold">{value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
            <Panel title="پیشرفت هدف">
              <div className="grid place-items-center p-5 text-center">
                <div className="grid size-32 place-items-center rounded-full bg-[conic-gradient(hsl(var(--primary))_0_72%,hsl(var(--muted))_72%)]">
                  <span className="grid size-24 place-items-center rounded-full bg-surface text-2xl font-black">
                    ۷۲٪
                  </span>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  ۵.۸ از ۸ میلیارد فروش خالص
                </p>
              </div>
            </Panel>
            <Panel
              className="xl:col-span-2"
              title="روند فروش روزانه"
              description="مقایسه با هدف"
            >
              <div className="p-5">
                <svg
                  aria-label="روند فروش آزمایشی"
                  className="h-52 w-full"
                  viewBox="0 0 700 220"
                >
                  <path
                    className="stroke-border"
                    d="M20 30H680M20 80H680M20 130H680M20 180H680"
                  />
                  <path
                    className="fill-none stroke-primary [stroke-width:4]"
                    d="M20 180 C100 160 120 145 180 150 S290 100 360 105 S480 58 540 74 S620 46 680 52"
                  />
                </svg>
              </div>
            </Panel>
            <Panel title="وضعیت کانال‌ها">
              <ProgressRows
                rows={[
                  ['پیامک', 82, '۸۲٪'],
                  ['ایمیل', 61, '۶۱٪'],
                  ['پوش', 48, '۴۸٪'],
                ]}
              />
            </Panel>
          </div>
        </TabsContent>
        <TabsContent className="mt-5" value="audience">
          <div className="grid gap-5">
            <MetricGrid
              metrics={[
                { label: 'کل مخاطبان', value: '۲۴٬۸۶۰', icon: UsersRound },
                {
                  label: 'یکتا',
                  value: '۲۳٬۴۱۲',
                  icon: UserRound,
                  tone: 'emerald',
                },
                {
                  label: 'تکراری حذف‌شده',
                  value: '۱٬۴۴۸',
                  icon: Filter,
                  tone: 'amber',
                },
                { label: 'لغو عضویت', value: '۳۸۶', icon: Power, tone: 'rose' },
              ]}
            />
            <PreviewTable
              actions={false}
              columns={[
                'سگمنت',
                'نوع',
                'قانون',
                'تعداد',
                'آخرین بروزرسانی',
                'وضعیت',
              ]}
              onNotice={onNotice}
              onOpen={noopOpen}
              rows={[
                {
                  id: 'preview-detail-segment-europe',
                  cells: [
                    'علاقه‌مندان اروپا',
                    'پویا',
                    'مقصد موردعلاقه = اروپا',
                    '۱۲٬۸۴۰',
                    'امروز ۰۹:۲۰',
                    'فعال',
                  ],
                  statusIndex: 5,
                },
                {
                  id: 'preview-detail-segment-vip',
                  cells: [
                    'مشتریان VIP',
                    'پویا',
                    'سطح مشتری = VIP',
                    '۲٬۴۸۰',
                    'امروز ۰۹:۲۰',
                    'فعال',
                  ],
                  statusIndex: 5,
                },
                {
                  id: 'preview-detail-segment-page',
                  cells: [
                    'بازدیدکنندگان صفحه اروپا',
                    'پویا',
                    'رویداد سایت در ۳۰ روز',
                    '۹٬۵۴۰',
                    'امروز ۰۹:۲۰',
                    'فعال',
                  ],
                  statusIndex: 5,
                },
              ]}
              searchable={false}
              section="audiences"
              tab="campaign-detail-audience"
              title="سگمنت‌های انتخاب‌شده"
              totalLabel="۳ سگمنت"
            />
          </div>
        </TabsContent>
        <TabsContent className="mt-5" value="channels">
          <div className="grid gap-5">
            <div className="grid gap-4 md:grid-cols-3">
              {[
                ['پیامک', '۳ ارسال', 'آخرین: امروز ۱۰:۰۰', Phone],
                ['ایمیل', '۲ ارسال', 'آخرین: دیروز ۱۸:۳۰', Mail],
                ['پوش‌نوتیفیکیشن', '۴ ارسال', 'آخرین: ۲ ساعت پیش', BellRing],
              ].map(([label, count, last, Icon]) => {
                const ChannelIcon = Icon as LucideIcon;
                return (
                  <Card className="p-5" key={label as string}>
                    <ChannelIcon
                      aria-hidden="true"
                      className="size-6 text-primary"
                    />
                    <h3 className="mt-3 font-black">{label as string}</h3>
                    <strong className="mt-2 block">{count as string}</strong>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {last as string}
                    </p>
                    <Button
                      className="mt-4"
                      onClick={() => onNotice(`برنامه ${label} باز شد.`)}
                      size="sm"
                      variant="outline"
                    >
                      مشاهده برنامه
                    </Button>
                  </Card>
                );
              })}
            </div>
            <PreviewTable
              actions={false}
              columns={['زمان', 'کانال', 'قالب', 'مخاطب', 'وضعیت']}
              onNotice={onNotice}
              onOpen={noopOpen}
              rows={[
                {
                  id: 'preview-detail-send-sms',
                  cells: [
                    '۱۴۰۵/۰۶/۱۸ · ۱۰:۰۰',
                    'پیامک',
                    'اروپا - موج دوم',
                    '۲۲٬۴۸۰',
                    'ارسال‌شده',
                  ],
                  statusIndex: 4,
                },
                {
                  id: 'preview-detail-send-email',
                  cells: [
                    '۱۴۰۵/۰۶/۲۰ · ۱۸:۳۰',
                    'ایمیل',
                    'هتل‌های منتخب اروپا',
                    '۱۸٬۲۱۰',
                    'زمان‌بندی‌شده',
                  ],
                  statusIndex: 4,
                },
                {
                  id: 'preview-detail-send-push',
                  cells: [
                    '۱۴۰۵/۰۶/۲۲ · ۱۲:۰۰',
                    'پوش',
                    'یادآوری پایان جشنواره',
                    '۹٬۸۴۰',
                    'پیش‌نویس',
                  ],
                  statusIndex: 4,
                },
              ]}
              searchable={false}
              section="communications"
              tab="campaign-detail-channels"
              title="برنامه زمان‌بندی ارسال"
              totalLabel="۳ نمونه از ۸ ارسال"
            />
          </div>
        </TabsContent>
        <TabsContent className="mt-5" value="budget">
          <div className="grid gap-5">
            <MetricGrid
              metrics={[
                {
                  label: 'بودجه مصوب',
                  value: '۳.۲ میلیارد',
                  icon: CircleDollarSign,
                },
                {
                  label: 'هزینه واقعی',
                  value: '۲.۱ میلیارد',
                  icon: CheckCircle2,
                  tone: 'emerald',
                },
                {
                  label: 'تعهد باز',
                  value: '۴۲۰ میلیون',
                  icon: Clock3,
                  tone: 'amber',
                },
                {
                  label: 'مانده',
                  value: '۶۸۰ میلیون',
                  icon: CircleDollarSign,
                  tone: 'violet',
                },
              ]}
            />
            <PreviewTable
              actions={false}
              columns={[
                'نوع هزینه',
                'تأمین‌کننده',
                'مبلغ برآوردی',
                'مبلغ قطعی',
                'تاریخ',
                'سند مالی',
                'وضعیت',
              ]}
              onNotice={onNotice}
              onOpen={noopOpen}
              rows={[
                {
                  id: 'preview-detail-cost-sms',
                  cells: [
                    'پیامک',
                    'کاوه‌نگار',
                    '۴۵۰ میلیون',
                    '۴۲۰ میلیون',
                    '۱۴۰۵/۰۶/۱۰',
                    'FIN-8821',
                    'قطعی',
                  ],
                  statusIndex: 6,
                },
                {
                  id: 'preview-detail-cost-ads',
                  cells: [
                    'تبلیغ کلیکی',
                    'گوگل ادز',
                    '۹۰۰ میلیون',
                    '۸۸۰ میلیون',
                    '۱۴۰۵/۰۶/۱۲',
                    'FIN-8848',
                    'قطعی',
                  ],
                  statusIndex: 6,
                },
                {
                  id: 'preview-detail-cost-content',
                  cells: [
                    'تولید محتوا',
                    'تیم داخلی',
                    '۲۸۰ میلیون',
                    '—',
                    '۱۴۰۵/۰۶/۲۵',
                    '—',
                    'در انتظار',
                  ],
                  statusIndex: 6,
                },
              ]}
              searchable={false}
              section="reports"
              tab="campaign-detail-budget"
              title="ریز هزینه‌های کمپین"
              totalLabel="۳ نمونه از ۸ هزینه"
            />
          </div>
        </TabsContent>
        <TabsContent className="mt-5" value="links">
          <PreviewTable
            actions={false}
            columns={[
              'عنوان',
              'صفحه مقصد',
              'منبع / رسانه',
              'لینک کوتاه',
              'کلیک',
              'تبدیل',
              'QR',
              'وضعیت',
            ]}
            onNotice={onNotice}
            onOpen={noopOpen}
            rows={[
              {
                id: 'preview-detail-link-main',
                cells: [
                  'صفحه اصلی اروپا',
                  '/europe-summer',
                  'sms / campaign',
                  'nys.ir/eu25',
                  '۱۸٬۴۲۰',
                  '۱٬۲۸۴',
                  'دانلود',
                  'فعال',
                ],
                statusIndex: 7,
              },
              {
                id: 'preview-detail-link-hotels',
                cells: [
                  'هتل‌های اروپا',
                  '/hotels/europe',
                  'email / campaign',
                  'nys.ir/euh',
                  '۹٬۸۶۰',
                  '۷۴۲',
                  'دانلود',
                  'فعال',
                ],
                statusIndex: 7,
              },
              {
                id: 'preview-detail-link-flights',
                cells: [
                  'پروازهای ویژه',
                  '/flight/europe',
                  'push / campaign',
                  'nys.ir/euf',
                  '۶٬۲۲۰',
                  '۴۸۶',
                  'دانلود',
                  'فعال',
                ],
                statusIndex: 7,
              },
            ]}
            searchable={false}
            section="content"
            tab="campaign-detail-links"
            title="لینک‌ها، UTM و QR Code"
            totalLabel="۳ نمونه از ۶ لینک"
          />
        </TabsContent>
        <TabsContent className="mt-5" value="leads">
          <div className="grid gap-5">
            <MetricGrid
              metrics={[
                { label: 'سرنخ جدید', value: '۱٬۴۸۲', icon: Target },
                {
                  label: 'پیگیری‌شده',
                  value: '۱٬۱۲۴',
                  icon: Phone,
                  tone: 'emerald',
                },
                {
                  label: 'واجد شرایط',
                  value: '۶۴۸',
                  icon: CheckCircle2,
                  tone: 'violet',
                },
                {
                  label: 'بدون پیگیری',
                  value: '۱۲۸',
                  icon: AlertTriangle,
                  tone: 'rose',
                },
              ]}
            />
            <PreviewTable
              actions={false}
              columns={[
                'نام',
                'تماس',
                'منبع',
                'امتیاز',
                'وضعیت پیگیری',
                'کارشناس',
                'آخرین اقدام',
              ]}
              onNotice={onNotice}
              onOpen={noopOpen}
              rows={[
                {
                  id: 'preview-detail-lead-sara',
                  cells: [
                    'سارا محمدی',
                    '۰۹۱۲•••۴۲۱۸',
                    'صفحه فرود / پیامک',
                    '۸۷',
                    'واجد شرایط',
                    'علی رضایی',
                    'امروز ۱۰:۱۲',
                  ],
                  statusIndex: 4,
                },
                {
                  id: 'preview-detail-lead-reza',
                  cells: [
                    'رضا کریمی',
                    '۰۹۳۵•••۸۲۴۰',
                    'فرم اروپا / ایمیل',
                    '۷۲',
                    'درحال پیگیری',
                    'مینا موسوی',
                    'دیروز ۱۶:۴۰',
                  ],
                  statusIndex: 4,
                },
                {
                  id: 'preview-detail-lead-maryam',
                  cells: [
                    'مریم شریفی',
                    '۰۹۱۰•••۱۲۹۴',
                    'لینک کوتاه / پوش',
                    '۴۸',
                    'جدید',
                    'تخصیص‌نیافته',
                    '۲ روز پیش',
                  ],
                  statusIndex: 4,
                },
              ]}
              searchable={false}
              section="audiences"
              tab="campaign-detail-leads"
              title="سرنخ‌های کمپین"
              totalLabel="۳ نمونه از ۱٬۴۸۲ سرنخ"
            />
          </div>
        </TabsContent>
        <TabsContent className="mt-5" value="sales">
          <div className="grid gap-5">
            <MetricGrid
              metrics={[
                { label: 'سفارش', value: '۴۲۸', icon: ShoppingCart },
                {
                  label: 'رزرو موفق',
                  value: '۳۵۲',
                  icon: CheckCircle2,
                  tone: 'emerald',
                },
                {
                  label: 'فروش ناخالص',
                  value: '۶.۴ میلیارد',
                  icon: CircleDollarSign,
                  tone: 'violet',
                },
                {
                  label: 'فروش خالص',
                  value: '۵.۸ میلیارد',
                  icon: BarChart3,
                  tone: 'emerald',
                },
              ]}
            />
            <PreviewTable
              actions={false}
              columns={[
                'شماره سفارش',
                'مشتری',
                'خدمت',
                'مبلغ ناخالص',
                'تخفیف',
                'لغو / استرداد',
                'فروش خالص',
                'منبع انتساب',
                'تاریخ',
              ]}
              onNotice={onNotice}
              onOpen={noopOpen}
              rows={[
                {
                  id: 'preview-detail-sale-98214',
                  cells: [
                    'ORD-98214',
                    'سارا محمدی',
                    'تور فرانسه',
                    '۸۲ میلیون',
                    '۴ میلیون',
                    '۰',
                    '۷۸ میلیون',
                    'last-click',
                    'امروز ۱۲:۲۰',
                  ],
                },
                {
                  id: 'preview-detail-sale-98187',
                  cells: [
                    'ORD-98187',
                    'رضا کریمی',
                    'پرواز استانبول',
                    '۴۶ میلیون',
                    '۲ میلیون',
                    '۰',
                    '۴۴ میلیون',
                    'first-click',
                    'امروز ۱۰:۴۰',
                  ],
                },
                {
                  id: 'preview-detail-sale-98042',
                  cells: [
                    'ORD-98042',
                    'مریم شریفی',
                    'هتل دبی',
                    '۱۲۴ میلیون',
                    '۶ میلیون',
                    '۱۸ میلیون',
                    '۱۰۰ میلیون',
                    'last-click',
                    'دیروز ۱۹:۱۰',
                  ],
                },
              ]}
              searchable={false}
              section="reports"
              tab="campaign-detail-sales"
              title="فروش منتسب به کمپین"
              totalLabel="۳ نمونه از ۳۵۲ فروش"
            />
          </div>
        </TabsContent>
        <TabsContent className="mt-5" value="report">
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="هدف در برابر نتیجه">
              <ProgressRows
                rows={[
                  ['فروش', 72, '۷۲٪'],
                  ['سرنخ', 91, '۹۱٪'],
                  ['نرخ تبدیل', 100, '۱۰۶٪'],
                  ['ROAS', 97, '۹۷٪'],
                ]}
              />
            </Panel>
            <Panel title="شاخص‌های نهایی">
              <dl className="p-5">
                {[
                  ['نرخ تبدیل', '۲۳.۸٪'],
                  ['CAC', '۱.۹ میلیون تومان'],
                  ['ROI', '۱۷۶٪'],
                  ['ROAS', '۳.۱۹×'],
                ].map(([label, value]) => (
                  <div
                    className="flex justify-between border-b border-dashed border-border py-3 last:border-0"
                    key={label}
                  >
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-black">{value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </div>
        </TabsContent>
        <TabsContent className="mt-5" value="activity">
          <Panel title="تاریخچه فعالیت‌ها">
            <div className="grid gap-3 p-5">
              {[
                ['بودجه کمپین تأیید شد', 'علی رضایی', 'امروز ۱۰:۲۸'],
                ['ارسال پیامک موج دوم انجام شد', 'سیستم', 'امروز ۱۰:۰۵'],
                ['سگمنت مخاطبان بروزرسانی شد', 'سیستم', 'امروز ۰۹:۲۰'],
                ['قالب ایمیل ویرایش شد', 'مریم احمدی', 'دیروز ۱۸:۱۲'],
                ['کمپین فعال شد', 'حسین موسوی', '۱۴۰۵/۰۶/۰۱'],
              ].map(([title, actor, date]) => (
                <button
                  className="flex items-center gap-3 rounded-xl border border-border p-4 text-start hover:bg-muted/30"
                  key={title}
                  onClick={() => onNotice(`جزئیات فعالیت «${title}» باز شد.`)}
                  type="button"
                >
                  <Clock3 aria-hidden="true" className="size-5 text-primary" />
                  <span>
                    <strong className="block">{title}</strong>
                    <small className="text-muted-foreground">
                      {actor} · {date}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
