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
  Pencil,
  Phone,
  Plus,
  Power,
  Route,
  Save,
  Search,
  ShoppingCart,
  Target,
  Upload,
  UserRound,
  UsersRound,
  WandSparkles,
  X,
  type LucideIcon,
} from 'lucide-react';
import type {
  DocumentDetailV1,
  DocumentOptionsResponseV1,
} from '@rubi/contracts';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import {
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/overlays';
import {
  Badge,
  Card,
  EmptyState,
  FilterBar,
  PaginationShell,
} from '@/components/ui/surfaces';
import { cn } from '@/lib/utils';
import {
  documentsApi,
  DocumentsApiError,
} from '@/modules/documents/api/client';
import { campaignStatusLabels, type CampaignPreview } from '../model/marketing';
import {
  marketingSectionTabs,
  type MarketingPreviewItem,
} from '../model/reference-data';
import { downloadRowsAsExcel } from '../utils/excel-export';

type DetailSection = MarketingPreviewItem['section'];
type NoticeHandler = (message: string) => void;

interface PreviewRow {
  id: `preview-${string}`;
  cells: readonly string[];
  statusIndex?: number;
  occurredAt?: string;
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
  exportable = true,
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
  exportable?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [disabledRows, setDisabledRows] = useState<Set<string>>(
    () => new Set(),
  );
  const [editedTitles, setEditedTitles] = useState<Record<string, string>>({});
  const [editingRow, setEditingRow] = useState<PreviewRow | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
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
    return rows.filter((row, index) => {
      const occurredAt =
        row.occurredAt ??
        `2026-${index < 3 ? '09' : '08'}-${String(index < 3 ? 5 - index * 2 : 30 - index).padStart(2, '0')}`;
      return (
        (!needle ||
          [editedTitles[row.id] ?? row.cells[0], ...row.cells.slice(1)]
            .join(' ')
            .toLocaleLowerCase('fa-IR')
            .includes(needle)) &&
        (status === 'all' ||
          (row.statusIndex !== undefined &&
            row.cells[row.statusIndex] === status)) &&
        (!startDate || occurredAt >= startDate) &&
        (!endDate || occurredAt <= endDate)
      );
    });
  }, [editedTitles, endDate, rows, search, startDate, status]);
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
    <Panel
      actions={
        rows.length && exportable ? (
          <Button
            onClick={() => {
              downloadRowsAsExcel({
                filename: title,
                sheetName: title,
                columns,
                rows: filtered.map((row) => [
                  editedTitles[row.id] ?? row.cells[0] ?? '',
                  ...row.cells.slice(1),
                ]),
              });
              onNotice(`خروجی اکسل «${title}» دانلود شد.`);
            }}
            size="sm"
            variant="outline"
          >
            <Download aria-hidden="true" className="size-4" /> خروجی اکسل
          </Button>
        ) : undefined
      }
      title={title}
    >
      {searchable ? (
        <FilterBar className="m-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_12rem_12rem_12rem_auto]">
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
          <FormField id={`${section}-${tab}-start`} label="از تاریخ">
            <DatePicker
              id={`${section}-${tab}-start`}
              onChange={(value) => {
                setStartDate(value);
                setPage(1);
              }}
              placeholder="همه تاریخ‌ها"
              value={startDate}
            />
          </FormField>
          <FormField id={`${section}-${tab}-end`} label="تا تاریخ">
            <DatePicker
              id={`${section}-${tab}-end`}
              onChange={(value) => {
                setEndDate(value);
                setPage(1);
              }}
              placeholder="همه تاریخ‌ها"
              value={endDate}
            />
          </FormField>
          <Button
            onClick={() => {
              setSearch('');
              setStatus('all');
              setStartDate('');
              setEndDate('');
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
          <table className="w-full min-w-[64rem] text-right text-sm" dir="rtl">
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
                  className={cn(
                    'border-t border-border transition hover:bg-muted/30',
                    disabledRows.has(row.id) && 'opacity-55',
                  )}
                  key={row.id}
                >
                  {row.cells.map((cell, index) => (
                    <td className="p-4" key={`${row.id}-${columns[index]}`}>
                      {index === row.statusIndex ? (
                        <Badge className={statusClass(cell)}>{cell}</Badge>
                      ) : index === 0 ? (
                        (editedTitles[row.id] ?? cell)
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
                          onClick={() => {
                            setEditingRow(row);
                            setEditingTitle(
                              editedTitles[row.id] ?? row.cells[0] ?? '',
                            );
                          }}
                          size="icon"
                          variant="outline"
                        >
                          <Pencil aria-hidden="true" className="size-4" />
                        </Button>
                        <Button
                          aria-label={
                            disabledRows.has(row.id)
                              ? `فعال‌سازی ${row.cells[0]}`
                              : `غیرفعال‌سازی ${row.cells[0]}`
                          }
                          className={cn(
                            disabledRows.has(row.id)
                              ? 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                              : 'border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive',
                          )}
                          onClick={() => {
                            const isDisabled = disabledRows.has(row.id);
                            setDisabledRows((current) => {
                              const next = new Set(current);
                              if (next.has(row.id)) next.delete(row.id);
                              else next.add(row.id);
                              return next;
                            });
                            onNotice(
                              isDisabled
                                ? `«${row.cells[0]}» فعال شد.`
                                : `«${row.cells[0]}» غیرفعال شد.`,
                            );
                          }}
                          size="icon"
                          title={
                            disabledRows.has(row.id)
                              ? 'فعال‌سازی'
                              : 'غیرفعال‌سازی'
                          }
                          variant="outline"
                        >
                          <Power aria-hidden="true" className="size-4" />
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
      <Dialog
        open={Boolean(editingRow)}
        onOpenChange={(open) => {
          if (!open) setEditingRow(null);
        }}
      >
        <DialogContent className="max-w-xl text-right" dir="rtl">
          <DialogTitle>ویرایش {title}</DialogTitle>
          <DialogDescription>
            عنوان رکورد را ویرایش کنید؛ تغییر در همین فضای کاری اعمال می‌شود.
          </DialogDescription>
          <form
            className="mt-5 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!editingRow || editingTitle.trim().length < 2) return;
              setEditedTitles((current) => ({
                ...current,
                [editingRow.id]: editingTitle.trim(),
              }));
              onNotice(`«${editingTitle.trim()}» ویرایش شد.`);
              setEditingRow(null);
            }}
          >
            <FormField
              id={`${section}-${tab}-edit-title`}
              label="عنوان"
              required
            >
              <Input
                autoFocus
                id={`${section}-${tab}-edit-title`}
                minLength={2}
                onChange={(event) => setEditingTitle(event.target.value)}
                required
                value={editingTitle}
              />
            </FormField>
            <div className="flex justify-end gap-2">
              <Button
                onClick={() => setEditingRow(null)}
                type="button"
                variant="outline"
              >
                انصراف
              </Button>
              <Button type="submit">
                <Save aria-hidden="true" className="size-4" /> ذخیره تغییرات
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
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
    <section className="grid gap-5 text-right" dir="rtl">
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
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="روند ایجاد سرنخ و فروش منتسب">
          <div className="p-5">
            <div className="mb-4 flex flex-wrap items-center gap-5 text-xs font-bold">
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full bg-blue-500"
                />
                سرنخ جدید
              </span>
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full bg-emerald-500"
                />
                فروش منتسب
              </span>
            </div>
            <svg
              aria-label="روند ۳۰ روز اخیر؛ سرنخ جدید و فروش منتسب"
              className="h-52 w-full"
              role="img"
              viewBox="0 0 700 220"
            >
              <defs>
                <linearGradient
                  id="marketing-leads-area"
                  x1="0"
                  x2="0"
                  y1="0"
                  y2="1"
                >
                  <stop offset="0" stopColor="#3b82f6" stopOpacity="0.22" />
                  <stop offset="1" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                className="fill-none stroke-border [stroke-width:1]"
                d="M20 30H680M20 80H680M20 130H680M20 180H680"
              />
              <path
                d="M20 172 C90 158 110 120 170 135 S260 78 320 104 S410 55 470 82 S570 42 680 48 L680 180 L20 180 Z"
                fill="url(#marketing-leads-area)"
              />
              <path
                className="fill-none stroke-blue-500 [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:4]"
                data-series="leads"
                d="M20 172 C90 158 110 120 170 135 S260 78 320 104 S410 55 470 82 S570 42 680 48"
              />
              <path
                className="fill-none stroke-emerald-500 [stroke-dasharray:8_7] [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:4]"
                data-series="attributed-sales"
                d="M20 190 C90 184 110 166 170 174 S260 130 320 148 S410 104 470 116 S570 76 680 91"
              />
              {[
                [20, 172, 'blue'],
                [170, 135, 'blue'],
                [320, 104, 'blue'],
                [470, 82, 'blue'],
                [680, 48, 'blue'],
                [20, 190, 'emerald'],
                [170, 174, 'emerald'],
                [320, 148, 'emerald'],
                [470, 116, 'emerald'],
                [680, 91, 'emerald'],
              ].map(([cx, cy, tone]) => (
                <circle
                  className={
                    tone === 'blue' ? 'fill-blue-500' : 'fill-emerald-500'
                  }
                  cx={cx}
                  cy={cy}
                  key={`${tone}-${cx}`}
                  r="4.5"
                />
              ))}
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
            exportable={false}
            rows={topCampaigns}
            searchable={false}
            section="campaigns"
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

const segmentFieldOptions = [
  ['city', 'شهر'],
  ['favorite-destination', 'مقصد موردعلاقه'],
  ['last-purchase', 'آخرین خرید'],
  ['customer-type', 'نوع مشتری'],
  ['trip-count', 'تعداد سفر'],
  ['preferred-channel', 'کانال ترجیحی'],
  ['lead-score', 'امتیاز سرنخ'],
] as const;

const segmentOperatorOptions = [
  ['equals', 'برابر است با'],
  ['not-equals', 'برابر نیست با'],
  ['one-of', 'یکی از'],
  ['not-one-of', 'هیچ‌کدام از'],
  ['greater-than', 'بیشتر از'],
  ['less-than', 'کمتر از'],
] as const;

const segmentValueOptions: Record<
  string,
  readonly (readonly [string, string])[]
> = {
  city: [
    ['tehran', 'تهران'],
    ['mashhad', 'مشهد'],
    ['shiraz', 'شیراز'],
    ['isfahan', 'اصفهان'],
    ['tabriz', 'تبریز'],
  ],
  'favorite-destination': [
    ['europe', 'اروپا'],
    ['istanbul', 'استانبول'],
    ['dubai', 'دبی'],
    ['kish', 'کیش'],
    ['mashhad', 'مشهد'],
  ],
  'last-purchase': [
    ['one-month', '۱ ماه'],
    ['three-months', '۳ ماه'],
    ['six-months', '۶ ماه'],
    ['twelve-months', '۱۲ ماه'],
  ],
  'customer-type': [
    ['active', 'فعال'],
    ['vip', 'VIP'],
    ['corporate', 'سازمانی'],
    ['inactive', 'غیرفعال'],
  ],
  'trip-count': [
    ['one', '۱ سفر'],
    ['two', '۲ سفر'],
    ['three', '۳ سفر'],
    ['five-plus', '۵ سفر یا بیشتر'],
  ],
  'preferred-channel': [
    ['sms', 'پیامک'],
    ['email', 'ایمیل'],
    ['whatsapp', 'واتساپ'],
    ['push', 'پوش'],
  ],
  'lead-score': [
    ['twenty', '۲۰'],
    ['forty', '۴۰'],
    ['sixty', '۶۰'],
    ['eighty', '۸۰'],
  ],
};

interface SegmentRule {
  field: string;
  operator: string;
  value: string;
}

function SegmentBuilder({
  onNotice,
  onCreate,
}: {
  onNotice: NoticeHandler;
  onCreate: (row: PreviewRow) => void;
}) {
  const [rules, setRules] = useState<SegmentRule[]>([
    { field: 'city', operator: 'equals', value: 'tehran' },
    {
      field: 'favorite-destination',
      operator: 'one-of',
      value: 'europe',
    },
    { field: 'last-purchase', operator: 'greater-than', value: 'six-months' },
  ]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [segmentName, setSegmentName] = useState('');
  const [segmentType, setSegmentType] = useState('dynamic');
  const [segmentOwner, setSegmentOwner] = useState('marketing');
  const [segmentStatus, setSegmentStatus] = useState('active');
  const updateRule = (index: number, patch: Partial<SegmentRule>) =>
    setRules((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <Panel
          actions={
            <>
              <Button onClick={() => setDialogOpen(true)} size="sm">
                <Plus aria-hidden="true" className="size-4" /> سگمنت جدید
              </Button>
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
                disabled={!rules.length}
                onClick={() => onNotice('قواعد سگمنت ذخیره شدند.')}
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
                key={`${rule.field}-${index}`}
              >
                <SimpleSelect
                  ariaLabel={`فیلد شرط ${index + 1}`}
                  onChange={(field) => {
                    const values = segmentValueOptions[field] ?? [];
                    updateRule(index, {
                      field,
                      value: values[0]?.[0] ?? '',
                    });
                  }}
                  options={segmentFieldOptions}
                  value={rule.field}
                />
                <SimpleSelect
                  ariaLabel={`عملگر شرط ${index + 1}`}
                  onChange={(operator) => updateRule(index, { operator })}
                  options={segmentOperatorOptions}
                  value={rule.operator}
                />
                <SimpleSelect
                  ariaLabel={`مقدار شرط ${index + 1}`}
                  onChange={(value) => updateRule(index, { value })}
                  options={segmentValueOptions[rule.field] ?? []}
                  value={rule.value}
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
                  {
                    field: 'customer-type',
                    operator: 'equals',
                    value: 'active',
                  },
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
              ۱۲۶ مورد محدودیت ارسال
            </p>
          </div>
        </Card>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl text-right" dir="rtl">
          <DialogTitle>سگمنت جدید</DialogTitle>
          <DialogDescription>
            مشخصات سگمنت را وارد کنید؛ قواعد آن در سازنده بالای فهرست قابل تنظیم
            است.
          </DialogDescription>
          <form
            className="mt-5 grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (segmentName.trim().length < 3) {
                onNotice('نام سگمنت باید حداقل ۳ نویسه باشد.');
                return;
              }
              const typeLabel = segmentType === 'dynamic' ? 'پویا' : 'دستی';
              const ownerLabel =
                segmentOwner === 'marketing'
                  ? 'تیم مارکتینگ'
                  : segmentOwner === 'sales'
                    ? 'تیم فروش'
                    : 'سیستم';
              const statusLabel =
                segmentStatus === 'active' ? 'فعال' : 'پیش‌نویس';
              onCreate({
                id: `preview-segment-${Date.now()}`,
                cells: [
                  segmentName.trim(),
                  typeLabel,
                  '۰',
                  '۰',
                  'اکنون',
                  ownerLabel,
                  statusLabel,
                ],
                occurredAt: '2026-09-05',
                statusIndex: 6,
              });
              onNotice(`سگمنت «${segmentName.trim()}» ایجاد شد.`);
              setDialogOpen(false);
              setSegmentName('');
            }}
          >
            <FormField id="new-segment-name" label="نام سگمنت" required>
              <Input
                autoFocus
                id="new-segment-name"
                onChange={(event) => setSegmentName(event.target.value)}
                placeholder="مثلاً مشتریان سفرهای پاییزی"
                value={segmentName}
              />
            </FormField>
            <FormField id="new-segment-type" label="نوع سگمنت" required>
              <SimpleSelect
                ariaLabel="نوع سگمنت جدید"
                onChange={setSegmentType}
                options={[
                  ['dynamic', 'پویا'],
                  ['manual', 'دستی'],
                ]}
                value={segmentType}
              />
            </FormField>
            <FormField id="new-segment-owner" label="مالک" required>
              <SimpleSelect
                ariaLabel="مالک سگمنت جدید"
                onChange={setSegmentOwner}
                options={[
                  ['marketing', 'تیم مارکتینگ'],
                  ['sales', 'تیم فروش'],
                  ['system', 'سیستم'],
                ]}
                value={segmentOwner}
              />
            </FormField>
            <FormField id="new-segment-status" label="وضعیت" required>
              <SimpleSelect
                ariaLabel="وضعیت سگمنت جدید"
                onChange={setSegmentStatus}
                options={[
                  ['active', 'فعال'],
                  ['draft', 'پیش‌نویس'],
                ]}
                value={segmentStatus}
              />
            </FormField>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button
                onClick={() => setDialogOpen(false)}
                type="button"
                variant="outline"
              >
                انصراف
              </Button>
              <Button type="submit">
                <Save aria-hidden="true" className="size-4" /> ذخیره سگمنت
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
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

interface ScoringRule {
  id: string;
  label: string;
  score: number;
  polarity: 'positive' | 'negative';
  active: boolean;
}

const initialScoringRules: readonly ScoringRule[] = [
  {
    id: 'form-completed',
    label: 'تکمیل فرم درخواست سفر',
    score: 20,
    polarity: 'positive',
    active: true,
  },
  {
    id: 'price-viewed',
    label: 'بازدید صفحه قیمت بیش از ۲ بار',
    score: 12,
    polarity: 'positive',
    active: true,
  },
  {
    id: 'email-opened',
    label: 'بازکردن ایمیل کمپین',
    score: 5,
    polarity: 'positive',
    active: true,
  },
  {
    id: 'short-link-clicked',
    label: 'کلیک روی لینک کوتاه',
    score: 8,
    polarity: 'positive',
    active: true,
  },
  {
    id: 'no-response',
    label: 'عدم پاسخ در ۳ پیگیری',
    score: 15,
    polarity: 'negative',
    active: true,
  },
  {
    id: 'channel-unsubscribed',
    label: 'لغو رضایت کانال',
    score: 30,
    polarity: 'negative',
    active: true,
  },
  {
    id: 'invalid-phone',
    label: 'شماره تماس نامعتبر',
    score: 50,
    polarity: 'negative',
    active: true,
  },
  {
    id: 'inactive-90-days',
    label: 'بدون تعامل در ۹۰ روز',
    score: 20,
    polarity: 'negative',
    active: true,
  },
];

function LeadScoringPage({ onNotice }: { onNotice: NoticeHandler }) {
  const [rules, setRules] = useState<ScoringRule[]>(() => [
    ...initialScoringRules,
  ]);
  const [editor, setEditor] = useState<{
    open: boolean;
    id?: string;
    label: string;
    score: string;
    polarity: ScoringRule['polarity'];
  }>({ open: false, label: '', score: '10', polarity: 'positive' });
  const openEditor = (polarity: ScoringRule['polarity'], rule?: ScoringRule) =>
    setEditor({
      open: true,
      ...(rule ? { id: rule.id } : {}),
      label: rule?.label ?? '',
      score: String(rule?.score ?? 10),
      polarity,
    });
  const scoringGroups = [
    ['positive', 'قواعد امتیاز مثبت'],
    ['negative', 'قواعد امتیاز منفی'],
  ] as const;
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        {scoringGroups.map(([polarity, title]) => (
          <Panel
            actions={
              <Button
                onClick={() => openEditor(polarity)}
                size="sm"
                variant="outline"
              >
                <Plus aria-hidden="true" className="size-4" /> قانون جدید
              </Button>
            }
            key={polarity}
            title={title}
          >
            <div className="grid gap-3 p-4">
              {rules
                .filter((rule) => rule.polarity === polarity)
                .map((rule) => (
                  <div
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-xl border border-border p-4 transition',
                      !rule.active && 'opacity-55',
                    )}
                    key={rule.id}
                  >
                    <button
                      className="min-w-0 flex-1 text-right"
                      onClick={() => openEditor(polarity, rule)}
                      type="button"
                    >
                      <span className="font-bold">{rule.label}</span>
                      <strong
                        className={cn(
                          'me-3 whitespace-nowrap',
                          polarity === 'negative'
                            ? 'text-destructive'
                            : 'text-emerald-700',
                        )}
                      >
                        {polarity === 'negative' ? '−' : '+'}
                        {rule.score.toLocaleString('fa-IR')} امتیاز
                      </strong>
                    </button>
                    <div className="flex gap-1">
                      <Button
                        aria-label={`ویرایش قانون ${rule.label}`}
                        onClick={() => openEditor(polarity, rule)}
                        size="icon"
                        variant="outline"
                      >
                        <Pencil aria-hidden="true" className="size-4" />
                      </Button>
                      <Button
                        aria-label={
                          rule.active
                            ? `غیرفعال‌سازی قانون ${rule.label}`
                            : `فعال‌سازی قانون ${rule.label}`
                        }
                        className={cn(
                          rule.active
                            ? 'border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive'
                            : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50',
                        )}
                        onClick={() => {
                          setRules((items) =>
                            items.map((item) =>
                              item.id === rule.id
                                ? { ...item, active: !item.active }
                                : item,
                            ),
                          );
                          onNotice(
                            rule.active
                              ? `قانون «${rule.label}» غیرفعال شد.`
                              : `قانون «${rule.label}» فعال شد.`,
                          );
                        }}
                        size="icon"
                        variant="outline"
                      >
                        <Power aria-hidden="true" className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </Panel>
        ))}
      </div>
      <Dialog
        open={editor.open}
        onOpenChange={(open) => setEditor((current) => ({ ...current, open }))}
      >
        <DialogContent className="max-w-xl text-right" dir="rtl">
          <DialogTitle>{editor.id ? 'ویرایش قانون' : 'قانون جدید'}</DialogTitle>
          <DialogDescription>
            شرط و میزان امتیاز را مشخص کنید؛ تغییر بلافاصله در فهرست اعمال
            می‌شود.
          </DialogDescription>
          <form
            className="mt-5 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const score = Number(editor.score);
              if (
                editor.label.trim().length < 3 ||
                !Number.isFinite(score) ||
                score <= 0
              ) {
                onNotice('عنوان قانون و امتیاز مثبت معتبر وارد کنید.');
                return;
              }
              if (editor.id) {
                setRules((items) =>
                  items.map((item) =>
                    item.id === editor.id
                      ? {
                          ...item,
                          label: editor.label.trim(),
                          score,
                          polarity: editor.polarity,
                        }
                      : item,
                  ),
                );
              } else {
                setRules((items) => [
                  ...items,
                  {
                    id: `rule-${Date.now()}`,
                    label: editor.label.trim(),
                    score,
                    polarity: editor.polarity,
                    active: true,
                  },
                ]);
              }
              onNotice(
                editor.id
                  ? 'قانون امتیازدهی ویرایش شد.'
                  : 'قانون امتیازدهی ایجاد شد.',
              );
              setEditor((current) => ({ ...current, open: false }));
            }}
          >
            <FormField id="scoring-rule-label" label="شرط قانون" required>
              <Input
                autoFocus
                id="scoring-rule-label"
                onChange={(event) =>
                  setEditor((current) => ({
                    ...current,
                    label: event.target.value,
                  }))
                }
                placeholder="مثلاً مشاهده صفحه پیشنهاد"
                value={editor.label}
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="scoring-rule-polarity" label="نوع امتیاز" required>
                <SimpleSelect
                  ariaLabel="نوع امتیاز قانون"
                  onChange={(value) =>
                    setEditor((current) => ({
                      ...current,
                      polarity: value as ScoringRule['polarity'],
                    }))
                  }
                  options={[
                    ['positive', 'مثبت'],
                    ['negative', 'منفی'],
                  ]}
                  value={editor.polarity}
                />
              </FormField>
              <FormField id="scoring-rule-score" label="مقدار امتیاز" required>
                <Input
                  dir="ltr"
                  id="scoring-rule-score"
                  min="1"
                  onChange={(event) =>
                    setEditor((current) => ({
                      ...current,
                      score: event.target.value,
                    }))
                  }
                  type="number"
                  value={editor.score}
                />
              </FormField>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                onClick={() =>
                  setEditor((current) => ({ ...current, open: false }))
                }
                type="button"
                variant="outline"
              >
                انصراف
              </Button>
              <Button type="submit">
                <Save aria-hidden="true" className="size-4" /> ذخیره قانون
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

type AudienceInputKind = 'campaign-audience' | 'source';

function AudienceInputDialog({
  kind,
  open,
  onOpenChange,
  onCreate,
  onNotice,
}: {
  kind: AudienceInputKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (row: PreviewRow) => void;
  onNotice: NoticeHandler;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState(
    kind === 'campaign-audience' ? 'segment' : 'search',
  );
  const [campaign, setCampaign] = useState('europe');
  const [source, setSource] = useState('customers');
  const [memberCount, setMemberCount] = useState('1000');
  const [utmSource, setUtmSource] = useState('google');
  const [utmMedium, setUtmMedium] = useState('cpc');
  const [attributionWindow, setAttributionWindow] = useState('30');
  const [status, setStatus] = useState('active');
  const isCampaignAudience = kind === 'campaign-audience';
  const campaignLabels: Record<string, string> = {
    europe: 'جشنواره تابستان اروپا',
    istanbul: 'پرواز استانبول',
    dubai: 'هتل‌های دبی',
    corporate: 'کمپین B2B پاییز',
  };
  const statusLabel = status === 'active' ? 'فعال' : 'پیش‌نویس';

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-3xl text-right" dir="rtl">
        <DialogTitle>
          {isCampaignAudience ? 'افزودن مخاطبان کمپین' : 'افزودن منبع ورود'}
        </DialogTitle>
        <DialogDescription>
          {isCampaignAudience
            ? 'یک گروه تجمیعی را به کمپین متصل کنید؛ اطلاعات هویتی مخاطبان در مارکتینگ نگهداری نمی‌شود.'
            : 'مشخصات کانال و پارامترهای رهگیری منبع ورودی را ثبت کنید.'}
        </DialogDescription>
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim().length < 3) {
              onNotice('نام باید حداقل ۳ نویسه باشد.');
              return;
            }
            if (isCampaignAudience) {
              const count = Number(memberCount);
              if (!Number.isFinite(count) || count < 1) {
                onNotice('تعداد برآوردی مخاطبان را درست وارد کنید.');
                return;
              }
              const typeLabels: Record<string, string> = {
                segment: 'سگمنت پویا',
                corporate: 'سازمانی',
                partner: 'آژانس همکار',
              };
              const sourceLabels: Record<string, string> = {
                customers: 'قرارداد Customers',
                organizations: 'CRM سازمانی',
                marketing: 'سگمنت مارکتینگ',
              };
              onCreate({
                id: `preview-campaign-audience-${Date.now()}`,
                cells: [
                  name.trim(),
                  typeLabels[type] ?? type,
                  campaignLabels[campaign] ?? campaign,
                  count.toLocaleString('fa-IR'),
                  sourceLabels[source] ?? source,
                  'اکنون',
                  statusLabel,
                ],
                occurredAt: '2026-09-05',
                statusIndex: 6,
              });
              onNotice(`گروه مخاطبان «${name.trim()}» به کمپین افزوده شد.`);
            } else {
              if (utmSource.trim().length < 2 || utmMedium.trim().length < 2) {
                onNotice('UTM Source و UTM Medium را کامل وارد کنید.');
                return;
              }
              const typeLabels: Record<string, string> = {
                search: 'جست‌وجوی پولی',
                social: 'شبکه اجتماعی',
                referral: 'معرفی',
                event: 'رویداد و نمایشگاه',
                direct: 'ورود مستقیم',
              };
              onCreate({
                id: `preview-source-${Date.now()}`,
                cells: [
                  name.trim(),
                  typeLabels[type] ?? type,
                  utmSource.trim(),
                  utmMedium.trim(),
                  campaignLabels[campaign] ?? campaign,
                  `${Number(attributionWindow).toLocaleString('fa-IR')} روز`,
                  statusLabel,
                ],
                occurredAt: '2026-09-05',
                statusIndex: 6,
              });
              onNotice(`منبع ورود «${name.trim()}» افزوده شد.`);
            }
            onOpenChange(false);
          }}
        >
          <FormField
            id={`${kind}-name`}
            label={isCampaignAudience ? 'نام گروه مخاطبان' : 'نام منبع'}
            required
          >
            <Input
              autoFocus
              id={`${kind}-name`}
              minLength={3}
              onChange={(event) => setName(event.target.value)}
              placeholder={
                isCampaignAudience
                  ? 'مثلاً علاقه‌مندان سفر پاییزی'
                  : 'مثلاً تبلیغات جست‌وجوی پاییز'
              }
              required
              value={name}
            />
          </FormField>
          <FormField
            id={`${kind}-type`}
            label={isCampaignAudience ? 'نوع مخاطب' : 'نوع کانال'}
            required
          >
            <SimpleSelect
              ariaLabel={isCampaignAudience ? 'نوع مخاطب' : 'نوع کانال ورودی'}
              onChange={setType}
              options={
                isCampaignAudience
                  ? [
                      ['segment', 'سگمنت پویا'],
                      ['corporate', 'مخاطب سازمانی'],
                      ['partner', 'آژانس همکار'],
                    ]
                  : [
                      ['search', 'جست‌وجوی پولی'],
                      ['social', 'شبکه اجتماعی'],
                      ['referral', 'معرفی'],
                      ['event', 'رویداد و نمایشگاه'],
                      ['direct', 'ورود مستقیم'],
                    ]
              }
              value={type}
            />
          </FormField>
          <FormField id={`${kind}-campaign`} label="کمپین مرتبط" required>
            <SimpleSelect
              ariaLabel="کمپین مرتبط"
              onChange={setCampaign}
              options={[
                ['europe', 'جشنواره تابستان اروپا'],
                ['istanbul', 'پرواز استانبول'],
                ['dubai', 'هتل‌های دبی'],
                ['corporate', 'کمپین B2B پاییز'],
              ]}
              value={campaign}
            />
          </FormField>
          {isCampaignAudience ? (
            <>
              <FormField
                id="campaign-audience-source"
                label="منبع داده"
                required
              >
                <SimpleSelect
                  ariaLabel="منبع داده مخاطبان"
                  onChange={setSource}
                  options={[
                    ['customers', 'قرارداد Customers'],
                    ['organizations', 'CRM سازمانی'],
                    ['marketing', 'سگمنت مارکتینگ'],
                  ]}
                  value={source}
                />
              </FormField>
              <FormField
                id="campaign-audience-count"
                label="تعداد برآوردی"
                required
              >
                <Input
                  dir="ltr"
                  id="campaign-audience-count"
                  min="1"
                  onChange={(event) => setMemberCount(event.target.value)}
                  required
                  type="number"
                  value={memberCount}
                />
              </FormField>
            </>
          ) : (
            <>
              <FormField id="source-utm-source" label="UTM Source" required>
                <Input
                  dir="ltr"
                  id="source-utm-source"
                  onChange={(event) => setUtmSource(event.target.value)}
                  required
                  value={utmSource}
                />
              </FormField>
              <FormField id="source-utm-medium" label="UTM Medium" required>
                <Input
                  dir="ltr"
                  id="source-utm-medium"
                  onChange={(event) => setUtmMedium(event.target.value)}
                  required
                  value={utmMedium}
                />
              </FormField>
              <FormField
                id="source-attribution-window"
                label="پنجره انتساب (روز)"
                required
              >
                <Input
                  dir="ltr"
                  id="source-attribution-window"
                  min="1"
                  onChange={(event) => setAttributionWindow(event.target.value)}
                  required
                  type="number"
                  value={attributionWindow}
                />
              </FormField>
            </>
          )}
          <FormField id={`${kind}-status`} label="وضعیت" required>
            <SimpleSelect
              ariaLabel="وضعیت رکورد"
              onChange={setStatus}
              options={[
                ['active', 'فعال'],
                ['draft', 'پیش‌نویس'],
              ]}
              value={status}
            />
          </FormField>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              انصراف
            </Button>
            <Button type="submit">
              <Save aria-hidden="true" className="size-4" /> ذخیره
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const sourceRows: readonly PreviewRow[] = [
  {
    id: 'preview-source-google',
    cells: [
      'جست‌وجوی گوگل اروپا',
      'جست‌وجوی پولی',
      'google',
      'cpc',
      'جشنواره تابستان اروپا',
      '۳۰ روز',
      'فعال',
    ],
    statusIndex: 6,
  },
  {
    id: 'preview-source-instagram',
    cells: [
      'اینستاگرام هتل دبی',
      'شبکه اجتماعی',
      'instagram',
      'social',
      'هتل‌های دبی',
      '۱۴ روز',
      'فعال',
    ],
    statusIndex: 6,
  },
  {
    id: 'preview-source-exhibition',
    cells: [
      'نمایشگاه گردشگری',
      'رویداد و نمایشگاه',
      'tourism-expo',
      'offline',
      'کمپین B2B پاییز',
      '۶۰ روز',
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
  const [createdSegments, setCreatedSegments] = useState<PreviewRow[]>([]);
  const [createdCampaignAudiences, setCreatedCampaignAudiences] = useState<
    PreviewRow[]
  >([]);
  const [createdSources, setCreatedSources] = useState<PreviewRow[]>([]);
  const [inputKind, setInputKind] = useState<AudienceInputKind | null>(null);
  if (tab === 'segments') {
    return (
      <div className="grid gap-5">
        <SegmentBuilder
          onCreate={(row) => setCreatedSegments((items) => [row, ...items])}
          onNotice={onNotice}
        />
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
          rows={[...createdSegments, ...segmentRows]}
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
    return <LeadScoringPage onNotice={onNotice} />;
  }
  if (tab === 'sources') {
    return (
      <>
        <div className="flex justify-end">
          <Button onClick={() => setInputKind('source')}>
            <Plus aria-hidden="true" className="size-4" /> افزودن منبع ورود
          </Button>
        </div>
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
        <PreviewTable
          columns={[
            'نام منبع',
            'نوع کانال',
            'UTM Source',
            'UTM Medium',
            'کمپین پیش‌فرض',
            'پنجره انتساب',
            'وضعیت',
          ]}
          onNotice={onNotice}
          onOpen={onOpen}
          rows={[...createdSources, ...sourceRows]}
          section="audiences"
          tab={tab}
          title="فهرست منابع ورود"
          totalLabel="۳ نمونه مرجع"
        />
        {inputKind === 'source' ? (
          <AudienceInputDialog
            kind="source"
            onCreate={(row) => setCreatedSources((items) => [row, ...items])}
            onNotice={onNotice}
            onOpenChange={(open) => {
              if (!open) setInputKind(null);
            }}
            open
          />
        ) : null}
      </>
    );
  }
  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setInputKind('campaign-audience')}>
          <Plus aria-hidden="true" className="size-4" /> افزودن مخاطبان کمپین
        </Button>
      </div>
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
          ...createdCampaignAudiences,
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
      {inputKind === 'campaign-audience' ? (
        <AudienceInputDialog
          kind="campaign-audience"
          onCreate={(row) =>
            setCreatedCampaignAudiences((items) => [row, ...items])
          }
          onNotice={onNotice}
          onOpenChange={(open) => {
            if (!open) setInputKind(null);
          }}
          open
        />
      ) : null}
    </>
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

type MarketingAsset = {
  title: string;
  meta: string;
  icon: LucideIcon;
  documentId?: string;
};

function MarketingAssetUploadDialog({
  open,
  options,
  submitting,
  error,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  options: DocumentOptionsResponseV1['data'];
  submitting: boolean;
  error: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (form: FormData) => Promise<boolean>;
}) {
  const brandTypes = options.documentTypes.filter(
    (type) => type.domain === 'BRAND',
  );
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [documentTypeId, setDocumentTypeId] = useState(
    brandTypes.find((type) => type.code === 'BRAND_ASSET_TEMPLATE')?.id ??
      brandTypes[0]?.id ??
      '',
  );
  const [categoryId, setCategoryId] = useState(
    options.categories.find((category) => category.code === 'BRAND_ASSETS')
      ?.id ??
      options.categories[0]?.id ??
      '',
  );
  const [branchId, setBranchId] = useState(options.branches[0]?.id ?? '');
  const [ownerUserId, setOwnerUserId] = useState(
    options.currentUserId || options.owners[0]?.id || '',
  );
  const [confidentiality, setConfidentiality] = useState('INTERNAL');
  const [validationError, setValidationError] = useState('');
  const selectedType = brandTypes.find((type) => type.id === documentTypeId);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="max-h-[92dvh] max-w-3xl overflow-y-auto text-right"
        dir="rtl"
      >
        <DialogTitle>بارگذاری فایل محتوای مارکتینگ</DialogTitle>
        <DialogDescription>
          فایل پس از ثبت در کتابخانه محتوا، در «اسناد و فایل‌ها» نیز با دسته
          دارایی‌های برند ذخیره می‌شود.
        </DialogDescription>
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!file) {
              setValidationError('ابتدا فایل را انتخاب کنید.');
              return;
            }
            if (title.trim().length < 2) {
              setValidationError('عنوان فایل را کامل وارد کنید.');
              return;
            }
            if (!documentTypeId || !categoryId || !branchId || !ownerUserId) {
              setValidationError('نوع سند، دسته‌بندی، شعبه و مالک الزامی است.');
              return;
            }
            const form = new FormData();
            form.set('file', file);
            form.set('title', title.trim());
            if (description.trim()) form.set('description', description.trim());
            form.set('documentTypeId', documentTypeId);
            form.set('categoryId', categoryId);
            form.set('branchId', branchId);
            form.set('ownerUserId', ownerUserId);
            form.set('confidentiality', confidentiality);
            form.set('sourceModule', 'marketing');
            form.set('sourceEntityType', 'content-asset');
            form.set('sourceEntityId', `marketing-asset-${Date.now()}`);
            form.set('sourceDisplayLabel', `دارایی مارکتینگ: ${title.trim()}`);
            form.set('versionNote', 'ثبت از کتابخانه محتوای مارکتینگ');
            void onSubmit(form);
          }}
        >
          <div className="sm:col-span-2">
            <FormField id="marketing-asset-file" label="فایل" required>
              <Input
                accept={selectedType?.allowedMimeTypes.join(',')}
                id="marketing-asset-file"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setValidationError('');
                }}
                required
                type="file"
              />
            </FormField>
          </div>
          <FormField id="marketing-asset-title" label="عنوان محتوا" required>
            <Input
              autoFocus
              id="marketing-asset-title"
              onChange={(event) => {
                setTitle(event.target.value);
                setValidationError('');
              }}
              required
              value={title}
            />
          </FormField>
          <FormField id="marketing-asset-type" label="نوع سند" required>
            <SimpleSelect
              ariaLabel="نوع سند محتوای مارکتینگ"
              onChange={setDocumentTypeId}
              options={brandTypes.map((type) => [type.id, type.name] as const)}
              value={documentTypeId}
            />
          </FormField>
          <FormField id="marketing-asset-category" label="دسته‌بندی" required>
            <SimpleSelect
              ariaLabel="دسته‌بندی سند مارکتینگ"
              onChange={setCategoryId}
              options={options.categories.map(
                (category) => [category.id, category.name] as const,
              )}
              value={categoryId}
            />
          </FormField>
          <FormField id="marketing-asset-branch" label="شعبه" required>
            <SimpleSelect
              ariaLabel="شعبه مالک فایل مارکتینگ"
              onChange={setBranchId}
              options={options.branches.map(
                (branch) => [branch.id, branch.name] as const,
              )}
              value={branchId}
            />
          </FormField>
          <FormField id="marketing-asset-owner" label="مالک فایل" required>
            <SimpleSelect
              ariaLabel="مالک فایل مارکتینگ"
              onChange={setOwnerUserId}
              options={options.owners.map(
                (owner) => [owner.id, owner.displayName] as const,
              )}
              value={ownerUserId}
            />
          </FormField>
          <FormField id="marketing-asset-confidentiality" label="محرمانگی">
            <SimpleSelect
              ariaLabel="محرمانگی فایل مارکتینگ"
              onChange={setConfidentiality}
              options={[
                ['PUBLIC', 'عمومی'],
                ['INTERNAL', 'داخلی'],
                ['CONFIDENTIAL', 'محرمانه'],
              ]}
              value={confidentiality}
            />
          </FormField>
          <div className="sm:col-span-2">
            <FormField id="marketing-asset-description" label="توضیحات">
              <Textarea
                id="marketing-asset-description"
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                value={description}
              />
            </FormField>
          </div>
          {validationError || error ? (
            <p
              className="text-sm font-bold text-destructive sm:col-span-2"
              role="alert"
            >
              {validationError || error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button
              disabled={submitting}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              انصراف
            </Button>
            <Button disabled={submitting || !file} type="submit">
              <Upload aria-hidden="true" className="size-4" />
              {submitting ? 'در حال بارگذاری…' : 'ثبت در محتوا و اسناد'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ContentPage({
  tab,
  onOpen,
  onNotice,
}: {
  tab: string;
  onOpen: (item: MarketingPreviewItem) => void;
  onNotice: NoticeHandler;
}) {
  const router = useRouter();
  const [uploadedAssets, setUploadedAssets] = useState<MarketingAsset[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [documentOptions, setDocumentOptions] = useState<
    DocumentOptionsResponseV1['data'] | null
  >(null);

  const openUpload = async () => {
    setLoadingOptions(true);
    setUploadError('');
    try {
      const response = await documentsApi.options();
      const hasBrandType = response.data.documentTypes.some(
        (type) => type.domain === 'BRAND',
      );
      if (!hasBrandType) {
        throw new DocumentsApiError(
          'نوع سند دارایی برند در دسترسی فعلی شما موجود نیست.',
          403,
        );
      }
      setDocumentOptions(response.data);
      setUploadOpen(true);
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : 'گزینه‌های بارگذاری اسناد دریافت نشد.';
      setUploadError(message);
      onNotice(message);
    } finally {
      setLoadingOptions(false);
    }
  };

  const uploadAsset = async (form: FormData): Promise<boolean> => {
    setUploading(true);
    setUploadError('');
    try {
      const response = await documentsApi.upload(form);
      const document: DocumentDetailV1 = response.data;
      const extension = document.currentVersion.extension
        ? document.currentVersion.extension.toUpperCase()
        : 'فایل';
      setUploadedAssets((items) => [
        {
          title: document.title,
          meta: `${extension} · v${document.version.toLocaleString('fa-IR')} · ${document.archiveCode}`,
          icon: FileText,
          documentId: document.id,
        },
        ...items,
      ]);
      setUploadOpen(false);
      onNotice(
        `«${document.title}» بارگذاری شد و در بخش اسناد و فایل‌ها نیز ثبت شد.`,
      );
      return true;
    } catch (caught) {
      setUploadError(
        caught instanceof Error ? caught.message : 'بارگذاری فایل ناموفق بود.',
      );
      return false;
    } finally {
      setUploading(false);
    }
  };

  const downloadAsset = async (asset: MarketingAsset) => {
    if (!asset.documentId) {
      onNotice(`دانلود آزمایشی «${asset.title}» آماده شد.`);
      return;
    }
    try {
      const response = await documentsApi.download(asset.documentId);
      const url = URL.createObjectURL(response.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = asset.title;
      anchor.click();
      URL.revokeObjectURL(url);
      onNotice(`دانلود «${asset.title}» آغاز شد.`);
    } catch (caught) {
      onNotice(
        caught instanceof Error
          ? caught.message
          : 'دریافت فایل از اسناد ناموفق بود.',
      );
    }
  };

  if (tab === 'library') {
    const assets: readonly MarketingAsset[] = [
      ...uploadedAssets,
      { title: 'بنر اروپا — دسکتاپ', meta: 'تصویر · v4', icon: FileImage },
      { title: 'ویدئوی هتل دبی', meta: 'ویدئو · v2', icon: FileImage },
      { title: 'راهنمای سفر استانبول', meta: 'PDF · v3', icon: FileText },
      { title: 'بنر نوروز سازمانی', meta: 'تصویر · v1', icon: FileImage },
      { title: 'قالب ایمیل تابستان', meta: 'HTML · v5', icon: Mail },
      { title: 'QR بروشور نمایشگاه', meta: 'تصویر · v2', icon: Target },
      { title: 'لوگوی کمپین اروپا', meta: 'SVG · v1', icon: FileImage },
      { title: 'فایل بودجه رسانه', meta: 'Excel · v6', icon: FileText },
    ];
    return (
      <>
        <Panel
          actions={
            <Button disabled={loadingOptions} onClick={() => void openUpload()}>
              <Upload aria-hidden="true" className="size-4" />
              {loadingOptions ? 'در حال آماده‌سازی…' : 'بارگذاری فایل'}
            </Button>
          }
          title="کتابخانه محتوا"
        >
          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
            {assets.map(({ title, meta, icon: Icon, documentId }, index) => (
              <Card className="overflow-hidden" key={documentId ?? title}>
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
                        documentId
                          ? router.push(
                              `/documents?document=${encodeURIComponent(documentId)}`,
                            )
                          : onOpen({
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
                        void downloadAsset({
                          title,
                          meta,
                          icon: Icon,
                          ...(documentId ? { documentId } : {}),
                        })
                      }
                      size="icon"
                      variant="outline"
                    >
                      <Download aria-hidden="true" className="size-4" />
                    </Button>
                    <Button
                      aria-label={`غیرفعال‌سازی ${title}`}
                      className="border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => onNotice(`«${title}» غیرفعال شد.`)}
                      size="icon"
                      title="غیرفعال‌سازی"
                      variant="outline"
                    >
                      <Power aria-hidden="true" className="size-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Panel>
        {uploadOpen && documentOptions ? (
          <MarketingAssetUploadDialog
            error={uploadError}
            key={`${documentOptions.currentUserId}-${uploadOpen ? 'open' : 'closed'}`}
            onOpenChange={(open) => {
              setUploadOpen(open);
              if (!open) setUploadError('');
            }}
            onSubmit={uploadAsset}
            open
            options={documentOptions}
            submitting={uploading}
          />
        ) : null}
      </>
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

const discountUsageRows: readonly PreviewRow[] = [
  {
    id: 'preview-discount-usage-europe10',
    cells: [
      'EUROPE10',
      '۳٬۸۴۲ بار',
      '۱۸.۶ میلیارد',
      '۱.۹ میلیارد',
      '۴۸.۴ میلیون',
      'امروز ۱۰:۱۸',
      'فعال',
    ],
    statusIndex: 6,
  },
  {
    id: 'preview-discount-usage-ist5m',
    cells: [
      'IST5M',
      '۱٬۲۸۴ بار',
      '۷.۲ میلیارد',
      '۶۴۲ میلیون',
      '۵۶.۱ میلیون',
      'امروز ۰۹:۴۰',
      'فعال',
    ],
    statusIndex: 6,
  },
  {
    id: 'preview-discount-usage-vipdubai',
    cells: [
      'VIPDUBAI',
      '۳۴۸ بار',
      '۳.۸ میلیارد',
      '۴۵۶ میلیون',
      '۱۰۹ میلیون',
      'دیروز ۱۷:۲۵',
      'فعال',
    ],
    statusIndex: 6,
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
          'حداقل خرید',
          'سقف هر مشتری',
          'ترکیب‌پذیری',
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
              '۵۰ میلیون',
              '۱ بار',
              'غیرقابل ترکیب',
              'تابستان اروپا',
              'فعال',
            ],
            statusIndex: 12,
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
              '۴۰ میلیون',
              '۲ بار',
              'قابل ترکیب با امتیاز',
              'هتل‌های دبی',
              'فعال',
            ],
            statusIndex: 12,
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
              '۳۰ میلیون',
              '۱ بار',
              'غیرقابل ترکیب',
              'پرواز استانبول',
              'فعال',
            ],
            statusIndex: 12,
          },
        ]}
        section="offers"
        tab={tab}
        title="پیشنهادهای ویژه"
        totalLabel="۳ نمونه از ۲۸ پیشنهاد"
      />
    );
  }
  const config =
    tab === 'usage'
      ? {
          title: 'استفاده از تخفیف‌ها',
          columns: [
            'کد',
            'تعداد استفاده',
            'فروش حاصل',
            'ارزش تخفیف',
            'میانگین سبد',
            'آخرین استفاده',
            'وضعیت',
          ],
          rows: discountUsageRows,
          total: '۳ نمونه از ۶٬۸۴۰ استفاده',
        }
      : {
          title: 'کدهای تخفیف',
          columns: [
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
          ],
          rows: discountRows,
          total: '۳ نمونه از ۳۸ کد',
        };
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
        columns={config.columns}
        onNotice={onNotice}
        onOpen={onOpen}
        rows={config.rows}
        section="offers"
        tab={tab}
        title={config.title}
        totalLabel={config.total}
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

const journeyRunRows: readonly PreviewRow[] = [
  {
    id: 'preview-journey-run-europe-1204',
    cells: [
      'RUN-1204',
      'پیگیری سرنخ اروپا',
      'ثبت فرم اروپا',
      'مرحله ۳ از ۴',
      '۲ دقیقه پیش',
      'موفق',
    ],
    statusIndex: 5,
  },
  {
    id: 'preview-journey-run-cart-882',
    cells: [
      'RUN-0882',
      'سبد خرید رهاشده',
      'عدم تکمیل رزرو',
      'مرحله ۲ از ۵',
      '۵ دقیقه پیش',
      'درحال تلاش',
    ],
    statusIndex: 5,
  },
  {
    id: 'preview-journey-run-survey-431',
    cells: [
      'RUN-0431',
      'پس از سفر استانبول',
      'پایان رزرو',
      'مرحله ۴ از ۴',
      '۱۰ دقیقه پیش',
      'پایان‌یافته',
    ],
    statusIndex: 5,
  },
];

const journeyHistoryRows: readonly PreviewRow[] = [
  {
    id: 'preview-journey-history-published',
    cells: [
      'انتشار نسخه ۸',
      'پیگیری سرنخ اروپا',
      'مریم احمدی',
      'امروز ۱۰:۱۲',
      '۴ مرحله',
      'موفق',
    ],
    statusIndex: 5,
  },
  {
    id: 'preview-journey-history-paused',
    cells: [
      'توقف خودکار',
      'بازگشت مشتری غیرفعال',
      'سیستم',
      'دیروز ۱۸:۴۰',
      'عبور خطا از آستانه',
      'نیازمند اقدام',
    ],
    statusIndex: 5,
  },
  {
    id: 'preview-journey-history-edited',
    cells: [
      'ویرایش شرط',
      'سبد خرید رهاشده',
      'علی رضایی',
      '۲ روز پیش',
      'تأخیر ۲۴ ساعته',
      'ثبت‌شده',
    ],
    statusIndex: 5,
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
  onUseScenario,
}: {
  tab: string;
  onOpen: (item: MarketingPreviewItem) => void;
  onNotice: NoticeHandler;
  onUseScenario: (title: string) => void;
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
              <div className="mt-4 flex gap-2">
                <Button
                  onClick={() => onUseScenario(title as string)}
                  size="sm"
                >
                  استفاده از سناریو
                </Button>
                <Button
                  aria-label={`غیرفعال‌سازی سناریوی ${title}`}
                  className="border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => onNotice(`سناریوی «${title}» غیرفعال شد.`)}
                  size="icon"
                  title="غیرفعال‌سازی"
                  variant="outline"
                >
                  <Power aria-hidden="true" className="size-4" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    );
  }
  const config =
    tab === 'runs'
      ? {
          title: 'اجرای اتوماسیون‌ها',
          columns: [
            'شناسه اجرا',
            'سفر مشتری',
            'رویداد شروع',
            'مرحله فعلی',
            'آخرین تغییر',
            'وضعیت',
          ],
          rows: journeyRunRows,
          total: '۳ نمونه از ۲٬۴۵۶ اجرا',
        }
      : tab === 'history'
        ? {
            title: 'تاریخچه اجرا',
            columns: ['رویداد', 'سفر مشتری', 'عامل', 'زمان', 'جزئیات', 'وضعیت'],
            rows: journeyHistoryRows,
            total: '۳ نمونه از ۸۴ رویداد',
          }
        : {
            title: 'همه سفرهای مشتری',
            columns: [
              'نام سفر',
              'رویداد شروع',
              'مخاطب فعال',
              'ورودی ۳۰ روز',
              'نرخ تکمیل',
              'آخرین اجرا',
              'مالک',
              'وضعیت',
            ],
            rows: journeyRows,
            total: '۴ نمونه از ۱۸ سفر',
          };
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
        columns={config.columns}
        onNotice={onNotice}
        onOpen={onOpen}
        rows={config.rows}
        section="journeys"
        tab={tab}
        title={config.title}
        totalLabel={config.total}
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

type SectionFormKind = 'content' | 'offer' | 'journey';

const sectionFormDefinitions: Record<
  SectionFormKind,
  {
    title: string;
    nameLabel: string;
    types: readonly (readonly [string, string])[];
    hasDateRange: boolean;
  }
> = {
  content: {
    title: 'محتوای جدید',
    nameLabel: 'عنوان محتوا',
    types: [
      ['image', 'تصویر'],
      ['video', 'ویدئو'],
      ['document', 'سند'],
      ['landing', 'صفحه فرود'],
      ['form', 'فرم جذب'],
    ],
    hasDateRange: true,
  },
  offer: {
    title: 'پیشنهاد جدید',
    nameLabel: 'عنوان پیشنهاد',
    types: [
      ['discount-percent', 'تخفیف درصدی'],
      ['discount-amount', 'تخفیف مبلغی'],
      ['bundle', 'بسته ویژه'],
      ['coupon', 'کد تخفیف'],
    ],
    hasDateRange: true,
  },
  journey: {
    title: 'اتوماسیون جدید',
    nameLabel: 'نام سفر مشتری',
    types: [
      ['lead', 'پیگیری سرنخ'],
      ['cart', 'سبد خرید رهاشده'],
      ['post-trip', 'پس از سفر'],
      ['reactivation', 'فعال‌سازی مجدد'],
    ],
    hasDateRange: true,
  },
};

function SectionEntityFormDialog({
  kind,
  tab,
  open,
  onOpenChange,
  onSaved,
}: {
  kind: SectionFormKind;
  tab: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (name: string) => void;
}) {
  const definition = sectionFormDefinitions[kind];
  const isOffer = kind === 'offer';
  const isDiscountCode = isOffer && tab === 'discounts';
  const entityTypes: readonly (readonly [string, string])[] = isOffer
    ? isDiscountCode
      ? [
          ['discount-percent', 'تخفیف درصدی'],
          ['discount-amount', 'تخفیف مبلغی'],
        ]
      : [
          ['tour', 'تور ویژه'],
          ['flight', 'پرواز ویژه'],
          ['hotel', 'هتل ویژه'],
          ['bundle', 'بسته ترکیبی'],
        ]
    : definition.types;
  const [name, setName] = useState('');
  const [type, setType] = useState(entityTypes[0]?.[0] ?? '');
  const [status, setStatus] = useState('draft');
  const [startDate, setStartDate] = useState('2026-09-05');
  const [endDate, setEndDate] = useState('2026-10-05');
  const [description, setDescription] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [offerValue, setOfferValue] = useState('10');
  const [applicableService, setApplicableService] = useState('all');
  const [minimumPurchase, setMinimumPurchase] = useState('0');
  const [totalUsageLimit, setTotalUsageLimit] = useState('1000');
  const [perCustomerLimit, setPerCustomerLimit] = useState('1');
  const [combinability, setCombinability] = useState('exclusive');
  const dialogTitle = isDiscountCode
    ? 'افزودن کد تخفیف'
    : isOffer && tab === 'specials'
      ? 'افزودن پیشنهاد ویژه'
      : definition.title;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl text-right" dir="rtl">
        <DialogTitle>{dialogTitle}</DialogTitle>
        <DialogDescription>
          اطلاعات لازم را وارد کنید و برای افزودن به فضای کاری ذخیره کنید.
        </DialogDescription>
        <form
          className="mt-5 grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim().length < 3) return;
            if (isDiscountCode && couponCode.trim().length < 3) return;
            if (
              isOffer &&
              [offerValue, minimumPurchase, totalUsageLimit, perCustomerLimit]
                .map(Number)
                .some((value) => !Number.isFinite(value) || value < 0)
            )
              return;
            onSaved(name.trim());
            onOpenChange(false);
            setName('');
            setDescription('');
          }}
        >
          <FormField
            id={`${kind}-entity-name`}
            label={definition.nameLabel}
            required
          >
            <Input
              autoFocus
              id={`${kind}-entity-name`}
              minLength={3}
              onChange={(event) => setName(event.target.value)}
              placeholder={`${definition.nameLabel} را وارد کنید`}
              required
              value={name}
            />
          </FormField>
          <FormField id={`${kind}-entity-type`} label="نوع" required>
            <SimpleSelect
              ariaLabel={`نوع ${definition.title}`}
              onChange={setType}
              options={entityTypes}
              value={type}
            />
          </FormField>
          <FormField id={`${kind}-entity-status`} label="وضعیت" required>
            <SimpleSelect
              ariaLabel={`وضعیت ${definition.title}`}
              onChange={setStatus}
              options={[
                ['draft', 'پیش‌نویس'],
                ['active', 'فعال'],
                ['review', 'در انتظار تأیید'],
              ]}
              value={status}
            />
          </FormField>
          {isOffer ? (
            <>
              {isDiscountCode ? (
                <FormField id="offer-coupon-code" label="کد تخفیف" required>
                  <Input
                    dir="ltr"
                    id="offer-coupon-code"
                    minLength={3}
                    onChange={(event) =>
                      setCouponCode(event.target.value.toUpperCase())
                    }
                    placeholder="مثلاً AUTUMN10"
                    required
                    value={couponCode}
                  />
                </FormField>
              ) : null}
              <FormField
                id="offer-value"
                label={isDiscountCode ? 'مقدار تخفیف' : 'قیمت ویژه'}
                required
              >
                <Input
                  dir="ltr"
                  id="offer-value"
                  min="0"
                  onChange={(event) => setOfferValue(event.target.value)}
                  required
                  type="number"
                  value={offerValue}
                />
              </FormField>
              <FormField id="offer-service" label="خدمت قابل استفاده" required>
                <SimpleSelect
                  ariaLabel="خدمت قابل استفاده پیشنهاد"
                  onChange={setApplicableService}
                  options={[
                    ['all', 'همه خدمات'],
                    ['tour', 'تور'],
                    ['flight', 'پرواز'],
                    ['hotel', 'هتل'],
                    ['visa', 'ویزا'],
                  ]}
                  value={applicableService}
                />
              </FormField>
              <FormField
                id="offer-minimum-purchase"
                label="حداقل مبلغ خرید"
                required
              >
                <Input
                  dir="ltr"
                  id="offer-minimum-purchase"
                  min="0"
                  onChange={(event) => setMinimumPurchase(event.target.value)}
                  required
                  type="number"
                  value={minimumPurchase}
                />
              </FormField>
              <FormField
                id="offer-total-limit"
                label={isDiscountCode ? 'سقف کل استفاده' : 'ظرفیت کل پیشنهاد'}
                required
              >
                <Input
                  dir="ltr"
                  id="offer-total-limit"
                  min="1"
                  onChange={(event) => setTotalUsageLimit(event.target.value)}
                  required
                  type="number"
                  value={totalUsageLimit}
                />
              </FormField>
              <FormField
                id="offer-customer-limit"
                label="سقف استفاده هر مشتری"
                required
              >
                <Input
                  dir="ltr"
                  id="offer-customer-limit"
                  min="1"
                  onChange={(event) => setPerCustomerLimit(event.target.value)}
                  required
                  type="number"
                  value={perCustomerLimit}
                />
              </FormField>
              <FormField id="offer-combinability" label="ترکیب‌پذیری" required>
                <SimpleSelect
                  ariaLabel="قاعده ترکیب پیشنهاد"
                  onChange={setCombinability}
                  options={[
                    ['exclusive', 'غیرقابل ترکیب'],
                    ['points', 'قابل ترکیب با امتیاز'],
                    ['offers', 'قابل ترکیب با پیشنهاد دیگر'],
                  ]}
                  value={combinability}
                />
              </FormField>
            </>
          ) : null}
          {definition.hasDateRange ? (
            <>
              <FormField id={`${kind}-entity-start`} label="از تاریخ" required>
                <DatePicker
                  id={`${kind}-entity-start`}
                  onChange={setStartDate}
                  value={startDate}
                />
              </FormField>
              <FormField id={`${kind}-entity-end`} label="تا تاریخ" required>
                <DatePicker
                  id={`${kind}-entity-end`}
                  onChange={setEndDate}
                  value={endDate}
                />
              </FormField>
            </>
          ) : null}
          <div className="sm:col-span-2">
            <FormField id={`${kind}-entity-description`} label="توضیحات">
              <Textarea
                id={`${kind}-entity-description`}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                value={description}
              />
            </FormField>
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              انصراف
            </Button>
            <Button type="submit">
              <Save aria-hidden="true" className="size-4" /> ذخیره
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type PrimarySectionAction =
  | { label: string; behavior: 'builder' }
  | { label: string; behavior: 'form'; formKind: SectionFormKind };

function getPrimarySectionAction(
  section: DetailSection,
  tab: string,
): PrimarySectionAction | null {
  if (section === 'content') {
    return { label: 'محتوای جدید', behavior: 'form', formKind: 'content' };
  }
  if (section === 'offers' && tab === 'discounts') {
    return { label: 'افزودن کد تخفیف', behavior: 'form', formKind: 'offer' };
  }
  if (section === 'offers' && tab === 'specials') {
    return {
      label: 'افزودن پیشنهاد ویژه',
      behavior: 'form',
      formKind: 'offer',
    };
  }
  if (section === 'journeys' && tab === 'all') {
    return { label: 'ساخت اتوماسیون', behavior: 'builder' };
  }
  return null;
}

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
  const [formKind, setFormKind] = useState<SectionFormKind | null>(null);
  const primaryAction = getPrimarySectionAction(section, tab);
  const runPrimaryAction = () => {
    if (!primaryAction) return;
    if (primaryAction.behavior === 'builder') {
      setTab('builder');
      onNotice('سازنده سفر مشتری باز شد.');
      return;
    }
    if (primaryAction.behavior === 'form') {
      setFormKind(primaryAction.formKind);
    }
  };
  return (
    <>
      <Tabs className="text-right" dir="rtl" onValueChange={setTab} value={tab}>
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
          {primaryAction ? (
            <Button onClick={runPrimaryAction}>
              <Plus aria-hidden="true" className="size-4" />
              {primaryAction.label}
            </Button>
          ) : null}
        </div>
        {tabs.map(([key, , description]) => (
          <TabsContent className="mt-5" key={key} value={key}>
            <p className="mb-4 text-sm text-muted-foreground">{description}</p>
            {section === 'audiences' ? (
              <AudiencePage onNotice={onNotice} onOpen={onOpen} tab={key} />
            ) : null}
            {section === 'content' ? (
              <ContentPage onNotice={onNotice} onOpen={onOpen} tab={key} />
            ) : null}
            {section === 'offers' ? (
              <OffersPage onNotice={onNotice} onOpen={onOpen} tab={key} />
            ) : null}
            {section === 'journeys' ? (
              <JourneysPage
                onNotice={onNotice}
                onOpen={onOpen}
                onUseScenario={(title) => {
                  setTab('builder');
                  onNotice(`سناریوی «${title}» در سازنده بارگذاری شد.`);
                }}
                tab={key}
              />
            ) : null}
            {section === 'settings' ? (
              <SettingsPage onNotice={onNotice} onOpen={onOpen} tab={key} />
            ) : null}
          </TabsContent>
        ))}
      </Tabs>
      {formKind ? (
        <SectionEntityFormDialog
          key={formKind}
          kind={formKind}
          tab={tab}
          onOpenChange={(open) => {
            if (!open) setFormKind(null);
          }}
          onSaved={(name) => {
            onNotice(`«${name}» ذخیره شد.`);
          }}
          open
        />
      ) : null}
    </>
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
    <div className="grid gap-5 text-right" dir="rtl">
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
            onClick={() => onNotice('یک کپی آزمایشی از کمپین ساخته شد.')}
            size="sm"
            variant="outline"
          >
            <Copy aria-hidden="true" className="size-4" /> کپی کمپین
          </Button>
        </div>
      </Card>
      <Tabs dir="rtl" onValueChange={setTab} value={tab}>
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
              section="campaigns"
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
              section="campaigns"
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
              section="campaigns"
              tab="campaign-detail-sales"
              title="فروش منتسب به کمپین"
              totalLabel="۳ نمونه از ۳۵۲ فروش"
            />
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
