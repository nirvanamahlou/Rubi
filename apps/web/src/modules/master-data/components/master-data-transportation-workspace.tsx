'use client';

import type {
  MasterDataRecord,
  MasterDataResource,
  MasterDataStatus,
} from '@rubi/contracts';
import { isMasterTransportFormResource, type MasterTransportStatus } from '@rubi/contracts';
import { MasterDataTransportMetadata } from './master-data-transport-metadata';
import { MasterDataTransportAudit } from './master-data-transport-audit';
import {
  AlertTriangle,
  ArrowRight,
  Armchair,
  BusFront,
  CheckCircle2,
  CircleAlert,
  Database,
  Eye,
  FilePenLine,
  FileSpreadsheet,
  FilterX,
  Link2,
  Luggage,
  Plane,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  TrainFront,
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
import { getMasterDataFormFields } from '../model/form-fields';
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
  { resource: 'airlines', label: 'ایرلاین‌ها', icon: Plane },
  { resource: 'aircraft-types', label: 'انواع هواپیما', icon: Plane },
  { resource: 'cabin-classes', label: 'کلاس پروازی', icon: Armchair },
  { resource: 'baggage-rules', label: 'قواعد بار', icon: Luggage },
  {
    resource: 'manifest-templates',
    label: 'قالب Manifest',
    icon: FileSpreadsheet,
  },
  { resource: 'rail-companies', label: 'شرکت‌های ریلی', icon: TrainFront },
  { resource: 'train-types', label: 'انواع قطار', icon: TrainFront },
  { resource: 'bus-companies', label: 'شرکت‌های اتوبوس', icon: BusFront },
  { resource: 'bus-types', label: 'انواع اتوبوس', icon: BusFront },
] as const satisfies readonly {
  resource: MasterDataResource;
  label: string;
  icon: typeof Plane;
}[];

type TransportResource = (typeof tabs)[number]['resource'];

const boundaryCopy: Record<TransportResource, { title: string; text: string }> =
  {
    airlines: {
      title: 'Connection و Credential در Integrations است',
      text: 'اینجا فقط مشخصات مرجع ایرلاین و شناسه عمومی نگهداری می‌شود؛ کلید، Token و Secret هرگز در Master Data ثبت نمی‌شود.',
    },
    'aircraft-types': {
      title: 'ناوگان عملیاتی خارج از این کاتالوگ است',
      text: 'این صفحه فقط نوع هواپیما را تعریف می‌کند؛ تخصیص هواپیما به پرواز در عملیات پرواز انجام می‌شود.',
    },
    'cabin-classes': {
      title: 'کلاس مرجع با موجودی صندلی متفاوت است',
      text: 'قیمت، ظرفیت و موجودی در Ticket Catalog و Reservations باقی می‌ماند و این صفحه به جدول آن ماژول‌ها Query مستقیم ندارد.',
    },
    'baggage-rules': {
      title: 'هر تغییر بار یک نسخه مستقل است',
      text: 'قاعده استفاده‌شده حذف فیزیکی یا بازنویسی نمی‌شود و با غیرفعال‌سازی و بازه اعتبار مدیریت می‌شود.',
    },
    'manifest-templates': {
      title: 'فایل فقط با قرارداد واقعی Documents منتشر می‌شود',
      text: 'تا پیش از دریافت Reference معتبر، قالب در حالت پیش‌نویس می‌ماند و هیچ فایل یا شناسه ساختگی ثبت نمی‌شود.',
    },
    'rail-companies': {
      title: 'فروش و اتصال Provider مالکیت این صفحه نیست',
      text: 'شرکت ریلی مرجع به Organization متصل است؛ رزرو، قرارداد و تسویه در ماژول‌های مالک باقی می‌ماند.',
    },
    'train-types': {
      title: 'نوع قطار یک مرجع مشترک است',
      text: 'سرویس اجرایی، ظرفیت و برنامه حرکت در دامنه رزرو و عملیات نگهداری می‌شود.',
    },
    'bus-companies': {
      title: 'شرکت اتوبوس از Organization مشترک استفاده می‌کند',
      text: 'اطلاعات فروش، قرارداد و تسویه در Master Data ذخیره نمی‌شود.',
    },
    'bus-types': {
      title: 'نوع اتوبوس جایگزین سرویس اجرایی نیست',
      text: 'این کاتالوگ فقط مدل و امکانات مرجع را نگهداری می‌کند.',
    },
  };

const attributeLabels: Record<string, string> = {
  englishName: 'نام انگلیسی',
  icaoCode: 'کد ICAO',
  countryName: 'کشور',
  organizationName: 'سازمان',
  manufacturer: 'سازنده',
  model: 'مدل',
  bodyType: 'نوع بدنه',
  bookingCode: 'کد رزرو',
  cabinType: 'Cabin',
  displayOrder: 'ترتیب نمایش',
  airlineName: 'ایرلاین',
  cabinClassName: 'کلاس پروازی',
  passengerType: 'نوع مسافر',
  routeScope: 'دامنه مسیر',
  allowance: 'مقدار بار',
  unit: 'واحد',
  pieceCount: 'تعداد قطعه',
  validFrom: 'شروع اعتبار',
  validTo: 'پایان اعتبار',
  description: 'توضیحات',
  versionNumber: 'نسخه قالب',
  fileFormat: 'فرمت فایل',
  fileReferenceId: 'Reference سند',
  sheetName: 'نام Sheet',
  headerRow: 'ردیف عنوان',
  dateFormat: 'قالب تاریخ',
  requiredColumns: 'ستون‌های الزامی',
  columnOrder: 'ترتیب ستون‌ها',
  publicationStatus: 'وضعیت انتشار',
  category: 'دسته',
  amenities: 'امکانات',
  serviceClass: 'کلاس خدمات',
  facilityNames: 'امکانات مرجع',
  supplierName: 'تأمین‌کننده',
};

function attribute(record: MasterDataRecord, key: string, fallback = '—') {
  const value = record.attributes[key];
  return value === null || value === undefined || value === ''
    ? fallback
    : String(value);
}

function descriptionFor(record: MasterDataRecord) {
  if (record.resource === 'airlines')
    return `${attribute(record, 'englishName')} · ${attribute(record, 'countryName')}`;
  if (
    record.resource === 'aircraft-types' ||
    record.resource === 'train-types' ||
    record.resource === 'bus-types'
  )
    return `${attribute(record, 'manufacturer')} · ${attribute(record, 'model')}`;
  if (record.resource === 'cabin-classes')
    return `${attribute(record, 'bookingCode')} · ${attribute(record, 'cabinType')}`;
  if (record.resource === 'baggage-rules')
    return `${attribute(record, 'airlineName')} · ${attribute(record, 'allowance')} ${attribute(record, 'unit')}`;
  if (record.resource === 'manifest-templates')
    return `${attribute(record, 'airlineName')} · ${attribute(record, 'fileFormat')}`;
  return `${attribute(record, 'englishName')} · ${attribute(record, 'countryName')}`;
}

function needsCompletion(record: MasterDataRecord) {
  if (
    record.resource === 'airlines' ||
    record.resource === 'rail-companies' ||
    record.resource === 'bus-companies'
  )
    return !record.attributes.englishName || !record.attributes.countryId;
  if (
    record.resource === 'aircraft-types' ||
    record.resource === 'train-types' ||
    record.resource === 'bus-types'
  )
    return !record.attributes.englishName;
  if (record.resource === 'manifest-templates')
    return record.attributes.publicationStatus === 'DRAFT';
  return record.status === 'inactive';
}

export function MasterDataTransportationWorkspace() {
  const [resource, setResource] = useState<TransportResource>('airlines');
  const [records, setRecords] = useState<readonly MasterDataRecord[]>([]);
  const [allRecords, setAllRecords] = useState<readonly MasterDataRecord[]>([]);
  const [requestState, setRequestState] = useState<RequestState>('loading');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | MasterDataStatus>('all');
  const [transportStatus, setTransportStatus] = useState<'all' | MasterTransportStatus>('all');
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
        ...(transportStatus !== 'all' ? { transportStatus } : {}),
        search,
        status,
        sortBy: 'name',
        sortDirection: 'asc',
        page,
        pageSize: 25,
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
  }, [page, resource, search, status, transportStatus]);

  const loadSummary = useCallback(async () => {
    try {
      const rows: MasterDataRecord[] = [];
      for (let summaryPage = 1; ; summaryPage += 1) {
        const response = await masterDataApi.list(resource, {
          search: '',
          status: 'all',
          sortBy: 'name',
          sortDirection: 'asc',
          page: summaryPage,
          pageSize: 100,
        });
        rows.push(...response.data);
        if (rows.length >= response.meta.total) break;
      }
      setAllRecords(rows);
    } catch {
      setAllRecords([]);
    }
  }, [resource]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSummary(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSummary]);

  const kpis = useMemo<readonly MasterDataKpiItem[]>(() => {
    const active = allRecords.filter(
      (record) => record.status === 'active',
    ).length;
    const incomplete = allRecords.filter(needsCompletion).length;
    const distinct = (key: string) =>
      new Set(
        allRecords.map((record) => attribute(record, key, '')).filter(Boolean),
      ).size;
    const common = (
      first: string,
      second: string,
      third: string,
      thirdValue: string | number,
      fourth: string,
      fourthValue: string | number,
    ): readonly MasterDataKpiItem[] => [
      {
        label: first,
        value: allRecords.length,
        icon: currentTab.icon,
        tone: 'sky',
      },
      { label: second, value: active, icon: CheckCircle2, tone: 'emerald' },
      { label: third, value: thirdValue, icon: Link2, tone: 'violet' },
      { label: fourth, value: fourthValue, icon: CircleAlert, tone: 'amber' },
    ];
    if (resource === 'airlines')
      return common(
        'کل ایرلاین‌ها',
        'ایرلاین فعال',
        'Connection فعال',
        '—',
        'نیازمند تکمیل برند',
        incomplete,
      );
    if (resource === 'aircraft-types')
      return common(
        'انواع هواپیما',
        'نوع فعال',
        'سازندگان',
        distinct('manufacturer'),
        'نیازمند تکمیل',
        incomplete,
      );
    if (resource === 'cabin-classes')
      return common(
        'کلاس‌ها',
        'فعال',
        'Cabinها',
        distinct('cabinType'),
        'نیازمند بازبینی',
        incomplete,
      );
    if (resource === 'baggage-rules')
      return common(
        'قواعد فعال',
        'نسخه امروز',
        'ایرلاین‌ها',
        distinct('airlineId'),
        'در انتظار تأیید',
        '—',
      );
    if (resource === 'manifest-templates')
      return common(
        'کل قالب‌ها',
        'نسخه فعال',
        'فرمت‌های فایل',
        distinct('fileFormat'),
        'در انتظار انتشار',
        incomplete,
      );
    if (resource === 'rail-companies')
      return common(
        'شرکت‌های ریلی',
        'فعال',
        'Connection فعال',
        '—',
        'نیازمند تکمیل',
        incomplete,
      );
    if (resource === 'train-types')
      return common(
        'انواع قطار',
        'فعال',
        'سازندگان',
        distinct('manufacturer'),
        'نیازمند تکمیل',
        incomplete,
      );
    if (resource === 'bus-companies')
      return common(
        'شرکت‌های اتوبوس',
        'فعال',
        'Connection فعال',
        '—',
        'نیازمند تکمیل',
        incomplete,
      );
    return common(
      'انواع اتوبوس',
      'فعال',
      'سازندگان',
      distinct('manufacturer'),
      'نیازمند تکمیل',
      incomplete,
    );
  }, [allRecords, currentTab.icon, resource]);

  function changeResource(next: TransportResource) {
    setResource(next);
    setSearch('');
    setStatus('all');
    setTransportStatus('all');
    setPage(1);
    setSelected(undefined);
    setProfileOpen(false);
    setFormMode(null);
    setNotice(null);
  }

  async function persist(values: Record<string, string>) {
    if (formMode === 'edit' && selected) {
      await masterDataApi.update(resource, selected.id, {
        values,
        version: selected.version,
      });
      setNotice(`${definition.singularLabel} با نسخه جدید و Audit ویرایش شد.`);
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
        filters: { search, status, sortBy: 'name', sortDirection: 'asc', ...(transportStatus !== 'all' ? { transportStatus } : {}) },
        columns: [...new Set([
          'code',
          'name',
          ...getMasterDataFormFields(definition).map((field) => field.key),
          'status',
          'updatedAt',
        ])],
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

  function openProfile(record: MasterDataRecord) {
    setSelected(record);
    setProfileOpen(true);
  }

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
        description="دریافت اطلاعات حمل‌ونقل از Backend ناموفق بود."
        title="خطا در دریافت اطلاعات"
      />
    ) : records.length === 0 ? (
      <EmptyState
        action={
          <Button onClick={() => setFormMode('create')}>
            افزودن {definition.singularLabel}
          </Button>
        }
        description="با فیلتر فعلی رکوردی پیدا نشد."
        icon={currentTab.icon}
        title={`${definition.label} خالی است`}
      />
    ) : (
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="p-4 text-start">ردیف</th>
              <th className="p-4 text-start">کد</th>
              <th className="p-4 text-start">عنوان</th>
              <th className="p-4 text-start">مشخصات مرجع</th>
              <th className="p-4 text-start">وضعیت</th>
              <th className="p-4 text-start">آخرین تغییر</th>
              <th className="p-4 text-start">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record, index) => (
              <tr
                className="border-t border-border transition hover:bg-muted/30"
                key={record.id}
              >
                <td className="p-4">
                  {((page - 1) * 25 + index + 1).toLocaleString('fa-IR')}
                </td>
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
                <td className="p-4 text-muted-foreground">
                  {descriptionFor(record)}
                </td>
                <td className="p-4">
                  <Badge
                    className={
                      record.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'bg-muted text-muted-foreground'
                    }
                  >
                    {record.attributes.transportStatus === 'UNDER_REVIEW' ? 'در حال بررسی' : record.status === 'active' ? 'فعال' : 'غیرفعال'}
                  </Badge>
                </td>
                <td className="p-4">
                  {new Date(record.updatedAt).toLocaleString('fa-IR')}
                </td>
                <td className="p-4">
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
                    <Button
                      onClick={() => void toggle(record)}
                      size="sm"
                      variant="ghost"
                    >
                      {record.status === 'active'
                        ? 'غیرفعال‌سازی'
                        : 'فعال‌سازی'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
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
        eyebrow="اطلاعات پایه / حمل‌ونقل"
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
        <nav
          aria-label="زیرمجموعه‌های حمل‌ونقل"
          className="flex min-w-max gap-1"
        >
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
        description={boundaryCopy[resource].text}
        title={boundaryCopy[resource].title}
        tone="warning"
      />
      <FilterBar className="grid sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1fr)_12rem_auto]">
        <FormField id="transport-search" label="جست‌وجو">
          <div className="relative">
            <Search className="absolute end-3 top-3.5 size-4 text-muted-foreground" />
            <Input
              className="pe-10"
              id="transport-search"
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
              if (isMasterTransportFormResource(resource)) setTransportStatus(value as typeof transportStatus);
              else setStatus(value as typeof status);
              setPage(1);
            }}
            value={isMasterTransportFormResource(resource) ? transportStatus : status}
          >
            <SelectTrigger aria-label="فیلتر وضعیت">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه وضعیت‌ها</SelectItem>
              <SelectItem value={isMasterTransportFormResource(resource) ? 'ACTIVE' : 'active'}>فعال</SelectItem>
              <SelectItem value={isMasterTransportFormResource(resource) ? 'INACTIVE' : 'inactive'}>غیرفعال</SelectItem>
              {isMasterTransportFormResource(resource) ? <SelectItem value="UNDER_REVIEW">در حال بررسی</SelectItem> : null}
            </SelectContent>
          </Select>
        </FormField>
        <Button
          onClick={() => {
            setSearch('');
            setStatus('all');
            setTransportStatus('all');
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
          description="پروفایل از فهرست اصلی و بدون سکشن یا مسیر جداگانه نمایش داده می‌شود."
          onOpenChange={setProfileOpen}
          open={profileOpen}
          title={`پروفایل ${definition.singularLabel}`}
        >
          <div className="space-y-4">
            {isMasterTransportFormResource(resource) ? <MasterDataTransportMetadata resource={resource} record={selected} /> : null}
            {profileOpen && isMasterTransportFormResource(resource) ? <MasterDataTransportAudit key={selected.id} record={selected} /> : null}
            <Card className="overflow-hidden">
              <div className="grid gap-5 bg-gradient-to-l from-blue-50 via-background to-cyan-50 p-6 dark:from-blue-950/30 dark:to-cyan-950/30 md:grid-cols-[6rem_1fr_auto]">
                <span className="grid size-24 place-items-center rounded-3xl bg-blue-100 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300">
                  <CurrentIcon className="size-11" />
                </span>
                <div>
                  <h2 className="text-2xl font-black">{selected.name}</h2>
                  <p className="mt-1 text-muted-foreground" dir="ltr">
                    {selected.code} · {attribute(selected, 'englishName')}
                  </p>
                  <Badge className="mt-3">
                    {selected.attributes.transportStatus === 'UNDER_REVIEW' ? 'در حال بررسی' : selected.status === 'active' ? 'فعال' : 'غیرفعال'}
                  </Badge>
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
                  {Object.entries(selected.attributes)
                    .filter(
                      ([key, value]) =>
                        attributeLabels[key] && value !== null && value !== '',
                    )
                    .map(([key, value]) => (
                      <div className="border-b border-border/70 pb-3" key={key}>
                        <dt className="text-xs text-muted-foreground">
                          {attributeLabels[key]}
                        </dt>
                        <dd className="mt-1 break-words font-semibold">
                          {String(value)}
                        </dd>
                      </div>
                    ))}
                </dl>
              </Card>
              <Card className="p-5">
                <h3 className="mb-4 flex items-center gap-2 font-black">
                  <ShieldCheck className="size-5" /> مرز قراردادها
                </h3>
                <EmptyState
                  description="Credential و داده عملیاتی اینجا نمایش داده نمی‌شود. اتصال Integrations و فایل Documents پس از قرارداد عمومی واقعی فعال خواهد شد."
                  icon={AlertTriangle}
                  title="بدون Secret و Reference ساختگی"
                />
              </Card>
            </div>
          </div>
        </MasterDataProfileDialog>
      ) : null}
    </div>
  );
}
