'use client';

import type {
  MasterDataRecord,
  MasterDataResource,
  MasterDataStatus,
  MasterInsuranceSummary,
} from '@rubi/contracts';
import {
  ArrowRight,
  Banknote,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Database,
  Eye,
  FilePenLine,
  FileSpreadsheet,
  FilterX,
  Globe2,
  Link2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldPlus,
  Umbrella,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import {
  FormField,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/form-controls';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  FilterBar,
  PageHeader,
  PaginationShell,
  Skeleton,
} from '@/components/ui/surfaces';
import { masterDataApi, MasterDataApiError } from '../api/client';
import { getMasterDataDefinition } from '../model/catalog';
import {
  MasterDataLiveForm,
  type MasterDataFormMode,
} from './master-data-live-form';
import {
  MasterDataKpiGrid,
  type MasterDataKpiItem,
} from './master-data-kpi-grid';
import { MasterDataProfileDialog } from './master-data-profile-dialog';

type RequestState = 'loading' | 'ready' | 'error' | 'forbidden';

const tabs = [
  { resource: 'insurers', label: 'شرکت‌های بیمه', icon: Umbrella },
  { resource: 'insurance-plans', label: 'طرح‌های بیمه', icon: ShieldCheck },
  { resource: 'insurance-coverages', label: 'پوشش‌ها', icon: ShieldPlus },
] as const satisfies readonly {
  resource: MasterDataResource;
  label: string;
  icon: typeof Umbrella;
}[];

type InsuranceResource = (typeof tabs)[number]['resource'];

const rules: Record<InsuranceResource, { title: string; text: string }> = {
  insurers: {
    title: 'مالکیت سازمانی الزامی است',
    text: 'هر شرکت بیمه به Organization فعال با نقش بیمه‌گر (INSURANCE_PROVIDER) متصل می‌شود؛ قیمت و قرارداد در این صفحه نگهداری نمی‌شود. · Organization Reference',
  },
  'insurance-plans': {
    title: 'طرح، کاتالوگ مرجع محصول است',
    text: 'قیمت و قرارداد در Procurement و صدور، لغو و استرداد در Reservations و Integrations انجام می‌شود. · Domain Boundary',
  },
  'insurance-coverages': {
    title: 'مبلغ با سقف و ارز مستقل ثبت می‌شود',
    text: 'سقف پوشش و فرانشیز جزء تعریف مرجع پوشش‌اند؛ مبلغ فروش و نرخ خرید از Procurement خوانده می‌شود. · Decimal + Currency',
  },
};

const profileFields: Record<
  InsuranceResource,
  readonly { key: string; label: string }[]
> = {
  insurers: [
    { key: 'englishName', label: 'نام انگلیسی' },
    { key: 'organizationName', label: 'سازمان مرتبط' },
    { key: 'countryName', label: 'کشور' },
    { key: 'logoFileReference', label: 'Reference لوگو' },
    { key: 'planCount', label: 'تعداد طرح‌ها' },
  ],
  'insurance-plans': [
    { key: 'englishName', label: 'عنوان انگلیسی' },
    { key: 'insurerName', label: 'بیمه‌گر' },
    { key: 'destinationRegion', label: 'مقصد یا منطقه' },
    { key: 'minimumAge', label: 'حداقل سن' },
    { key: 'maximumAge', label: 'حداکثر سن' },
    { key: 'validFrom', label: 'شروع اعتبار' },
    { key: 'validTo', label: 'پایان اعتبار' },
    { key: 'coverageNames', label: 'پوشش‌ها' },
    { key: 'description', label: 'شرح استفاده' },
  ],
  'insurance-coverages': [
    { key: 'englishName', label: 'عنوان انگلیسی' },
    { key: 'coverageLimit', label: 'سقف تعهد' },
    { key: 'currencyCode', label: 'ارز' },
    { key: 'deductibleAmount', label: 'فرانشیز' },
    { key: 'description', label: 'شرح' },
    { key: 'planCount', label: 'استفاده در طرح‌ها' },
  ],
};

function attribute(record: MasterDataRecord, key: string, fallback = '—') {
  const value = record.attributes[key];
  return value === null || value === undefined || value === ''
    ? fallback
    : String(value);
}

function localDate(value: string) {
  if (value === '—') return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('fa-IR');
}

function statusBadge(record: MasterDataRecord) {
  return (
    <Badge
      className={
        record.status === 'active'
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : 'bg-muted text-muted-foreground'
      }
    >
      {record.status === 'active' ? 'فعال' : 'غیرفعال'}
    </Badge>
  );
}

export function MasterDataInsuranceWorkspace() {
  const [resource, setResource] = useState<InsuranceResource>('insurers');
  const [records, setRecords] = useState<readonly MasterDataRecord[]>([]);
  const [requestState, setRequestState] = useState<RequestState>('loading');
  const [summary, setSummary] = useState<MasterInsuranceSummary>();
  const [countries, setCountries] = useState<readonly MasterDataRecord[]>([]);
  const [insurers, setInsurers] = useState<readonly MasterDataRecord[]>([]);
  const [currencies, setCurrencies] = useState<readonly MasterDataRecord[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | MasterDataStatus>('all');
  const [referenceFilter, setReferenceFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<MasterDataRecord>();
  const [profileOpen, setProfileOpen] = useState(false);
  const [formMode, setFormMode] = useState<MasterDataFormMode | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const definition = getMasterDataDefinition(resource);
  const currentTab = tabs.find((tab) => tab.resource === resource) ?? tabs[0];
  const CurrentIcon = currentTab.icon;

  const load = useCallback(async () => {
    setRequestState('loading');
    try {
      const response = await masterDataApi.list(resource, {
        search,
        status,
        sortBy: 'name',
        sortDirection: 'asc',
        page,
        pageSize: 25,
        ...(resource === 'insurers' && referenceFilter !== 'all'
          ? { countryId: referenceFilter }
          : {}),
        ...(resource === 'insurance-plans' && referenceFilter !== 'all'
          ? { insurerId: referenceFilter }
          : {}),
        ...(resource === 'insurance-coverages' && referenceFilter !== 'all'
          ? { currencyId: referenceFilter }
          : {}),
      });
      setRecords(response.data);
      setTotal(response.meta.total);
      setRequestState('ready');
    } catch (error) {
      setRecords([]);
      setRequestState(
        error instanceof MasterDataApiError && error.status === 403
          ? 'forbidden'
          : 'error',
      );
    }
  }, [page, referenceFilter, resource, search, status]);

  const loadSummary = useCallback(async () => {
    try {
      const response = await masterDataApi.insuranceSummary();
      setSummary(response.data);
    } catch {
      setSummary(undefined);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSummary();
      void Promise.all(
        [
          ['countries', setCountries],
          ['insurers', setInsurers],
          ['currencies', setCurrencies],
        ].map(async ([target, setter]) => {
          const response = await masterDataApi.list(
            target as MasterDataResource,
            {
              search: '',
              status: 'active',
              sortBy: 'name',
              sortDirection: 'asc',
              page: 1,
              pageSize: 100,
            },
          );
          (setter as (rows: readonly MasterDataRecord[]) => void)(
            response.data,
          );
        }),
      ).catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSummary]);

  const kpis = useMemo<readonly MasterDataKpiItem[]>(() => {
    if (resource === 'insurers')
      return [
        {
          label: 'کل شرکت‌ها',
          value: summary?.insurers.total ?? '—',
          icon: Building2,
          tone: 'sky',
        },
        {
          label: 'فعال',
          value: summary?.insurers.active ?? '—',
          icon: CheckCircle2,
          tone: 'emerald',
        },
        {
          label: 'کشورهای تحت پوشش',
          value: summary?.insurers.countries ?? '—',
          icon: Globe2,
          tone: 'violet',
        },
        {
          label: 'لوگوی ناقص',
          value: summary?.insurers.missingLogo ?? '—',
          icon: CircleAlert,
          tone: 'amber',
        },
      ];
    if (resource === 'insurance-plans')
      return [
        {
          label: 'کل طرح‌ها',
          value: summary?.plans.total ?? '—',
          icon: ShieldCheck,
          tone: 'sky',
        },
        {
          label: 'فعال',
          value: summary?.plans.active ?? '—',
          icon: CheckCircle2,
          tone: 'emerald',
        },
        {
          label: 'در حال انقضا',
          value: summary?.plans.expiringSoon ?? '—',
          icon: CalendarClock,
          tone: 'amber',
        },
        {
          label: 'مناطق مقصد',
          value: summary?.plans.destinations ?? '—',
          icon: Globe2,
          tone: 'violet',
        },
      ];
    return [
      {
        label: 'کل پوشش‌ها',
        value: summary?.coverages.total ?? '—',
        icon: ShieldPlus,
        tone: 'sky',
      },
      {
        label: 'فعال',
        value: summary?.coverages.active ?? '—',
        icon: CheckCircle2,
        tone: 'emerald',
      },
      {
        label: 'ارزهای مرجع',
        value: summary?.coverages.currencies ?? '—',
        icon: Banknote,
        tone: 'violet',
      },
      {
        label: 'نیازمند بازبینی',
        value: summary?.coverages.needsReview ?? '—',
        icon: CircleAlert,
        tone: 'amber',
      },
    ];
  }, [resource, summary]);

  const filterOptions =
    resource === 'insurers'
      ? countries
      : resource === 'insurance-plans'
        ? insurers
        : currencies;
  const filterLabel =
    resource === 'insurers'
      ? 'کشور'
      : resource === 'insurance-plans'
        ? 'بیمه‌گر'
        : 'ارز';

  function changeResource(next: InsuranceResource) {
    setResource(next);
    setSearch('');
    setStatus('all');
    setReferenceFilter('all');
    setPage(1);
    setSelected(undefined);
    setProfileOpen(false);
    setFormMode(null);
    setNotice(null);
  }

  function openProfile(record: MasterDataRecord) {
    setSelected(record);
    setProfileOpen(true);
  }

  async function persist(values: Record<string, string>) {
    if (formMode === 'edit' && selected) {
      await masterDataApi.update(resource, selected.id, {
        values,
        version: selected.version,
      });
      setNotice(
        `${definition.singularLabel} با Optimistic Lock و Audit ویرایش شد.`,
      );
    } else {
      await masterDataApi.create(resource, { values });
      setNotice(`${definition.singularLabel} ثبت شد.`);
    }
    setFormMode(null);
    await Promise.all([load(), loadSummary()]);
  }

  async function toggle(record: MasterDataRecord) {
    try {
      await masterDataApi.setStatus(
        resource,
        record.id,
        record.status === 'active' ? 'inactive' : 'active',
        record.version,
      );
      setNotice('وضعیت با کنترل نسخه و Audit به‌روزرسانی شد.');
      await Promise.all([load(), loadSummary()]);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'تغییر وضعیت ناموفق بود.',
      );
    }
  }

  async function downloadExcel() {
    setExporting(true);
    try {
      const response = await masterDataApi.downloadExcel({
        resource,
        format: 'xlsx',
        filters: { search, status, sortBy: 'name', sortDirection: 'asc' },
        columns: [
          'code',
          'name',
          ...definition.fields.map((field) => field.key),
          'status',
          'updatedAt',
        ],
        locale: 'fa-IR',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      const url = URL.createObjectURL(response.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = response.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice('خروجی Excel دریافت شد.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'خروجی ناموفق بود.');
    } finally {
      setExporting(false);
    }
  }

  const actions = (record: MasterDataRecord) => (
    <div className="flex flex-wrap gap-2">
      <Button
        aria-label={`مشاهده ${record.name}`}
        onClick={() => openProfile(record)}
        size="icon"
        variant="outline"
      >
        <Eye className="size-4" />
      </Button>
      <Button
        aria-label={`ویرایش ${record.name}`}
        onClick={() => {
          setSelected(record);
          setFormMode('edit');
        }}
        size="icon"
        variant="outline"
      >
        <FilePenLine className="size-4" />
      </Button>
      <Button onClick={() => void toggle(record)} size="sm" variant="ghost">
        {record.status === 'active' ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
      </Button>
    </div>
  );

  const table = records.length ? (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[72rem] text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          {resource === 'insurers' ? (
            <tr>
              {[
                'لوگو و کد',
                'نام فارسی',
                'نام انگلیسی',
                'سازمان مرتبط',
                'کشور',
                'طرح فعال',
                'آخرین تغییر',
                'وضعیت',
                'عملیات',
              ].map((label) => (
                <th className="p-4 text-start" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          ) : resource === 'insurance-plans' ? (
            <tr>
              {[
                'کد طرح',
                'عنوان',
                'بیمه‌گر',
                'مقصد یا منطقه',
                'گروه سنی',
                'بازه اعتبار',
                'پوشش‌ها',
                'وضعیت',
                'عملیات',
              ].map((label) => (
                <th className="p-4 text-start" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          ) : (
            <tr>
              {[
                'کد پوشش',
                'عنوان',
                'سقف تعهد',
                'ارز',
                'فرانشیز',
                'شرح',
                'استفاده در طرح‌ها',
                'وضعیت',
                'عملیات',
              ].map((label) => (
                <th className="p-4 text-start" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {records.map((record) => (
            <tr
              className="border-t border-border transition hover:bg-muted/30"
              key={record.id}
            >
              {resource === 'insurers' ? (
                <>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-2">
                      <span className="grid size-9 place-items-center rounded-xl bg-cyan-100 text-cyan-700">
                        <Umbrella className="size-4" />
                      </span>
                      <span className="font-mono text-xs" dir="ltr">
                        {record.code}
                      </span>
                    </span>
                  </td>
                  <td className="p-4">
                    <button
                      className="font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => openProfile(record)}
                      type="button"
                    >
                      {record.name}
                    </button>
                  </td>
                  <td className="p-4" dir="ltr">
                    {attribute(record, 'englishName')}
                  </td>
                  <td className="p-4">
                    {attribute(record, 'organizationName')}
                  </td>
                  <td className="p-4">{attribute(record, 'countryName')}</td>
                  <td className="p-4">
                    {Number(attribute(record, 'planCount', '0')).toLocaleString(
                      'fa-IR',
                    )}
                  </td>
                  <td className="p-4">
                    {new Date(record.updatedAt).toLocaleString('fa-IR')}
                  </td>
                </>
              ) : resource === 'insurance-plans' ? (
                <>
                  <td className="p-4 font-mono text-xs" dir="ltr">
                    {record.code}
                  </td>
                  <td className="p-4">
                    <button
                      className="font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => openProfile(record)}
                      type="button"
                    >
                      {record.name}
                    </button>
                  </td>
                  <td className="p-4">{attribute(record, 'insurerName')}</td>
                  <td className="p-4">
                    {attribute(record, 'destinationRegion')}
                  </td>
                  <td className="p-4">
                    {attribute(record, 'minimumAge', '0')} تا{' '}
                    {attribute(record, 'maximumAge', 'بدون سقف')}
                  </td>
                  <td className="p-4">
                    {localDate(attribute(record, 'validFrom'))} تا{' '}
                    {localDate(attribute(record, 'validTo', 'نامحدود'))}
                  </td>
                  <td className="max-w-64 p-4">
                    {attribute(record, 'coverageNames')}
                  </td>
                </>
              ) : (
                <>
                  <td className="p-4 font-mono text-xs" dir="ltr">
                    {record.code}
                  </td>
                  <td className="p-4">
                    <button
                      className="font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => openProfile(record)}
                      type="button"
                    >
                      {record.name}
                    </button>
                  </td>
                  <td className="p-4 font-mono" dir="ltr">
                    {attribute(record, 'coverageLimit')}
                  </td>
                  <td className="p-4 font-mono" dir="ltr">
                    {attribute(record, 'currencyCode')}
                  </td>
                  <td className="p-4 font-mono" dir="ltr">
                    {attribute(record, 'deductibleAmount', '0')}
                  </td>
                  <td className="max-w-72 p-4 text-muted-foreground">
                    {attribute(record, 'description')}
                  </td>
                  <td className="p-4">
                    {Number(attribute(record, 'planCount', '0')).toLocaleString(
                      'fa-IR',
                    )}
                  </td>
                </>
              )}
              <td className="p-4">{statusBadge(record)}</td>
              <td className="p-4">{actions(record)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  ) : (
    <EmptyState
      action={
        <Button onClick={() => setFormMode('create')}>
          افزودن {definition.singularLabel}
        </Button>
      }
      description="با فیلتر فعلی رکوردی پیدا نشد."
      icon={CurrentIcon}
      title={`${definition.label} خالی است`}
    />
  );

  const content =
    requestState === 'loading' ? (
      <div aria-label="در حال بارگذاری" className="space-y-3">
        {[0, 1, 2].map((item) => (
          <Skeleton className="h-16 w-full" key={item} />
        ))}
      </div>
    ) : requestState === 'forbidden' ? (
      <EmptyState
        description="مجوز master_data.read لازم است."
        icon={ShieldCheck}
        title="دسترسی وجود ندارد"
      />
    ) : requestState === 'error' ? (
      <ErrorState
        action={
          <Button onClick={() => void load()} size="sm" variant="outline">
            <RefreshCw className="size-4" /> تلاش دوباره
          </Button>
        }
        description="دریافت اطلاعات بیمه از Backend ناموفق بود."
        title="خطا در دریافت اطلاعات"
      />
    ) : (
      table
    );

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <Link
            className={buttonVariants({ variant: 'outline' })}
            href="/master-data"
          >
            <ArrowRight className="size-4" /> همه بخش‌ها
          </Link>
        }
        description={definition.description}
        eyebrow="اطلاعات پایه / بیمه"
        title={definition.label}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          loading={exporting}
          onClick={() => void downloadExcel()}
          variant="outline"
        >
          <FileSpreadsheet className="size-4" /> خروجی اکسل
        </Button>
        <Button
          onClick={() => {
            setSelected(undefined);
            setFormMode('create');
          }}
        >
          <Plus className="size-4" /> افزودن {definition.singularLabel}
        </Button>
      </div>
      {notice ? <Alert description={notice} title="نتیجه عملیات" /> : null}
      <Card className="overflow-x-auto p-2">
        <nav aria-label="زیرمجموعه‌های بیمه" className="flex min-w-max gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                aria-current={resource === tab.resource ? 'page' : undefined}
                className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-background aria-[current=page]:text-primary aria-[current=page]:shadow-sm"
                key={tab.resource}
                onClick={() => changeResource(tab.resource)}
                type="button"
              >
                <Icon className="size-4" /> {tab.label}
              </button>
            );
          })}
        </nav>
      </Card>
      <MasterDataKpiGrid items={kpis} label={`شاخص‌های ${definition.label}`} />
      <Alert
        description={rules[resource].text}
        title={rules[resource].title}
        tone="warning"
      />
      <FilterBar className="grid sm:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_12rem_14rem_auto]">
        <FormField id="insurance-search" label="جست‌وجو">
          <div className="relative">
            <Search className="absolute end-3 top-3.5 size-4 text-muted-foreground" />
            <Input
              className="pe-10"
              id="insurance-search"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={`جست‌وجو در ${definition.label}`}
              value={search}
            />
          </div>
        </FormField>
        <FormField label="وضعیت">
          <Select
            onValueChange={(value) => {
              setStatus(value as typeof status);
              setPage(1);
            }}
            value={status}
          >
            <SelectTrigger aria-label="فیلتر وضعیت">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه وضعیت‌ها</SelectItem>
              <SelectItem value="active">فعال</SelectItem>
              <SelectItem value="inactive">غیرفعال</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField label={filterLabel}>
          <Select
            onValueChange={(value) => {
              setReferenceFilter(value);
              setPage(1);
            }}
            value={referenceFilter}
          >
            <SelectTrigger aria-label={`فیلتر ${filterLabel}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه {filterLabel}ها</SelectItem>
              {filterOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <Button
          onClick={() => {
            setSearch('');
            setStatus('all');
            setReferenceFilter('all');
            setPage(1);
          }}
          variant="ghost"
        >
          <FilterX className="size-4" /> پاک‌کردن
        </Button>
      </FilterBar>
      {content}
      <div className="flex items-center justify-between gap-3">
        <PaginationShell
          currentPage={page}
          totalLabel={`${total.toLocaleString('fa-IR')} رکورد`}
        />
        <div className="flex gap-2">
          <Button
            disabled={page === 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            size="sm"
            variant="outline"
          >
            قبلی
          </Button>
          <Button
            disabled={page * 25 >= total}
            onClick={() => setPage((value) => value + 1)}
            size="sm"
            variant="outline"
          >
            بعدی
          </Button>
        </div>
      </div>
      {formMode ? (
        <MasterDataLiveForm
          definition={definition}
          key={`${resource}-${formMode}-${selected?.id ?? 'new'}`}
          mode={formMode}
          onOpenChange={(open) => {
            if (!open) setFormMode(null);
          }}
          onPersist={persist}
          open
          {...(selected && formMode === 'edit' ? { record: selected } : {})}
        />
      ) : null}
      {selected ? (
        <MasterDataProfileDialog
          description="جزئیات از فهرست اصلی و بدون سکشن یا مسیر مستقل نمایش داده می‌شود."
          onOpenChange={setProfileOpen}
          open={profileOpen}
          title={`پروفایل ${definition.singularLabel}`}
        >
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div className="grid gap-5 bg-gradient-to-l from-cyan-50 via-background to-sky-50 p-6 dark:from-cyan-950/30 dark:to-sky-950/30 md:grid-cols-[6rem_1fr_auto]">
                <span className="grid size-24 place-items-center rounded-3xl bg-cyan-100 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300">
                  <CurrentIcon className="size-11" />
                </span>
                <div>
                  <h2 className="text-2xl font-black">{selected.name}</h2>
                  <p className="mt-1 font-mono text-muted-foreground" dir="ltr">
                    {selected.code} · {attribute(selected, 'englishName')}
                  </p>
                  <div className="mt-3">{statusBadge(selected)}</div>
                </div>
                <div className="text-center">
                  <small className="text-muted-foreground">Version</small>
                  <strong className="block text-2xl">
                    v{selected.version.toLocaleString('fa-IR')}
                  </strong>
                </div>
              </div>
            </Card>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-5">
                <h3 className="mb-4 flex items-center gap-2 font-black">
                  <Database className="size-5" /> مشخصات مرجع
                </h3>
                <dl className="grid gap-4 sm:grid-cols-2">
                  {profileFields[resource].map((field) => (
                    <div
                      className="border-b border-border/70 pb-3"
                      key={field.key}
                    >
                      <dt className="text-xs text-muted-foreground">
                        {field.label}
                      </dt>
                      <dd className="mt-1 break-words font-semibold">
                        {field.key.startsWith('valid')
                          ? localDate(attribute(selected, field.key))
                          : attribute(selected, field.key)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Card>
              <Card className="p-5">
                <h3 className="mb-4 flex items-center gap-2 font-black">
                  <ShieldCheck className="size-5" /> مرز دامنه
                </h3>
                <EmptyState
                  description={rules[resource].text}
                  icon={Link2}
                  title={rules[resource].title}
                />
              </Card>
            </div>
          </div>
        </MasterDataProfileDialog>
      ) : null}
    </div>
  );
}
