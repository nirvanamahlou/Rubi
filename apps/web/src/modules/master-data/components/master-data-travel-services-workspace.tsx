'use client';

import type {
  MasterDataListQuery,
  MasterDataRecord,
  MasterDataResource,
  MasterDataStatus,
  MasterTravelServicesSummary,
} from '@rubi/contracts';
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Database,
  Eye,
  FilePenLine,
  FileQuestion,
  FileSpreadsheet,
  FileText,
  FilterX,
  Globe2,
  Link2,
  LockKeyhole,
  MapPin,
  Plus,
  RefreshCw,
  Route,
  Search,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
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
import { loadTourTypeActorNames } from '../api/tour-type-actors';
import {
  tourTypeUpdatedLabel,
  tourTypeUsageLabel,
} from '../model/tour-type-form';
import { MasterDataTourTypeForm } from './master-data-tour-type-form';
import { MasterDataTravelReferenceForm } from './master-data-travel-reference-form';
import { transferCapacityLabel, transferUsageLabel, visaValidityLabel } from '../model/travel-reference-form';
import { MasterDataDeleteButton } from './master-data-delete-button';
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
  { resource: 'leaders', label: 'لیدرها', icon: UserRound },
  { resource: 'tour-types', label: 'نوع تور', icon: MapPin },
  { resource: 'transfer-types', label: 'نوع ترانسفر', icon: Route },
  { resource: 'visa-services', label: 'ویزا', icon: FileText },
] as const satisfies readonly {
  resource: MasterDataResource;
  label: string;
  icon: typeof UserRound;
}[];

type TravelResource = (typeof tabs)[number]['resource'];

const rules: Record<TravelResource, { title: string; text: string }> = {
  leaders: {
    title: 'فایل و اطلاعات حساس خارج از Master Data',
    text: 'مدرک، مجوز و نمونه تابلو فقط با قرارداد Documents نگهداری می‌شود؛ تماس‌ها رمزنگاری و ماسک می‌شوند و بانک و دستمزد در ماژول مالک باقی می‌ماند. · Documents Reference',
  },
  'tour-types': {
    title: 'نوع تور از محصول و برنامه سفر جداست',
    text: 'این کاتالوگ فقط طبقه‌بندی مرجع است؛ برنامه، ظرفیت، محصول و قیمت در ماژول‌های مالک نگهداری می‌شوند. · Reference Catalog',
  },
  'transfer-types': {
    title: 'وسیله و شیوه سرویس مستقل‌اند',
    text: 'نوع ترانسفر مرجع است؛ رزرو، تخصیص راننده، ناوگان عملیاتی و قیمت در این Master Data نیست. · Transport Reference',
  },
  'visa-services': {
    title: 'مدرک متقاضی در Master Data ذخیره نمی‌شود',
    text: 'این صفحه فقط تعریف خدمت است؛ پرونده، اسناد مسافر، پرداخت و پیگیری در ماژول‌های مالک نگهداری می‌شوند. · No Passenger Data',
  },
};

const headers: Record<TravelResource, readonly string[]> = {
  leaders: [
    'کد',
    'نام فارسی / انگلیسی',
    'کشور و شهر فعالیت',
    'تماس',
    'زبان‌ها',
    'تخصص و مقصد',
    'مدارک',
    'وضعیت',
    'عملیات',
  ],
  'tour-types': [
    'کد',
    'عنوان فارسی',
    'عنوان انگلیسی',
    'دامنه',
    'شرح',
    'استفاده',
    'آخرین تغییر',
    'وضعیت',
    'عملیات',
  ],
  'transfer-types': [
    'کد',
    'عنوان',
    'وسیله',
    'شیوه سرویس',
    'ظرفیت پیشنهادی',
    'شرح',
    'استفاده',
    'وضعیت',
    'عملیات',
  ],
  'visa-services': [
    'کد',
    'عنوان',
    'کشور مقصد',
    'نوع ویزا',
    'Provider',
    'مدت اعتبار مرجع',
    'مدارک راهنما',
    'وضعیت',
    'عملیات',
  ],
};

const profileFields: Record<
  TravelResource,
  readonly { key: string; label: string }[]
> = {
  leaders: [
    { key: 'englishName', label: 'نام انگلیسی' },
    { key: 'countryName', label: 'کشور فعالیت' },
    { key: 'cityName', label: 'شهر فعالیت' },
    { key: 'primaryPhoneMasked', label: 'تلفن اصلی ماسک‌شده' },
    { key: 'roamingPhoneMasked', label: 'تلفن رومینگ ماسک‌شده' },
    { key: 'languages', label: 'زبان‌ها' },
    { key: 'expertise', label: 'تخصص' },
    { key: 'destinations', label: 'مقصدها' },
    { key: 'welcomeSignCode', label: 'کد تابلو استقبال' },
    { key: 'operationalNotes', label: 'توضیحات اجرایی' },
  ],
  'tour-types': [
    { key: 'englishName', label: 'عنوان انگلیسی' },
    { key: 'scope', label: 'دامنه' },
    { key: 'description', label: 'شرح' },
    { key: 'displayOrder', label: 'ترتیب نمایش' },
  ],
  'transfer-types': [
    { key: 'englishName', label: 'عنوان انگلیسی' },
    { key: 'vehicleType', label: 'وسیله' },
    { key: 'serviceMode', label: 'شیوه سرویس' },
    { key: 'suggestedCapacity', label: 'ظرفیت پیشنهادی' },
    { key: 'description', label: 'شرح' },
  ],
  'visa-services': [
    { key: 'englishName', label: 'عنوان انگلیسی' },
    { key: 'countryName', label: 'کشور مقصد' },
    { key: 'visaType', label: 'نوع ویزا' },
    { key: 'supplierName', label: 'Provider' },
    { key: 'referenceValidityDays', label: 'مدت اعتبار مرجع' },
    { key: 'guidanceFileReference', label: 'مدارک راهنما' },
    { key: 'description', label: 'شرح' },
  ],
};

const enumLabels: Record<string, string> = {
  DOMESTIC: 'داخلی',
  INTERNATIONAL: 'خارجی',
  BOTH: 'داخلی / خارجی',
  PRIVATE: 'اختصاصی',
  SHARED: 'اشتراکی',
};

function attribute(record: MasterDataRecord, key: string, fallback = '—') {
  const value = record.attributes[key];
  return value === null || value === undefined || value === ''
    ? fallback
    : String(value);
}

function translated(record: MasterDataRecord, key: string) {
  const value = attribute(record, key);
  return enumLabels[value] ?? value;
}

function chips(value: string) {
  if (value === '—') return value;
  return (
    <span className="flex max-w-72 flex-wrap gap-1">
      {value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => (
          <Badge className="bg-sky-500/10 text-sky-700" key={item}>
            {item}
          </Badge>
        ))}
    </span>
  );
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

export function MasterDataTravelServicesWorkspace() {
  const [resource, setResource] = useState<TravelResource>('leaders');
  const [tourActorNames, setTourActorNames] = useState<Record<string, string>>(
    {},
  );
  useEffect(() => {
    if (resource !== 'tour-types') return;
    const controller = new AbortController();
    void loadTourTypeActorNames(controller.signal).then((names) => {
      if (!controller.signal.aborted) setTourActorNames(names);
    });
    return () => controller.abort();
  }, [resource]);
  const [records, setRecords] = useState<readonly MasterDataRecord[]>([]);
  const [requestState, setRequestState] = useState<RequestState>('loading');
  const [summary, setSummary] = useState<MasterTravelServicesSummary>();
  const [countries, setCountries] = useState<readonly MasterDataRecord[]>([]);
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
    const query: MasterDataListQuery = {
      search,
      status,
      sortBy: 'name',
      sortDirection: 'asc',
      page,
      pageSize: 25,
      ...(referenceFilter !== 'all' && resource === 'leaders'
        ? { countryId: referenceFilter }
        : {}),
      ...(referenceFilter !== 'all' && resource === 'tour-types'
        ? {
            tourScope: referenceFilter as 'DOMESTIC' | 'INTERNATIONAL' | 'BOTH',
          }
        : {}),
      ...(referenceFilter !== 'all' && resource === 'transfer-types'
        ? { transferServiceMode: referenceFilter as 'PRIVATE' | 'SHARED' }
        : {}),
      ...(referenceFilter !== 'all' && resource === 'visa-services'
        ? { countryId: referenceFilter }
        : {}),
    };
    try {
      const response = await masterDataApi.list(resource, query);
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
      const response = await masterDataApi.travelServicesSummary();
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
      void masterDataApi
        .list('countries', {
          search: '',
          status: 'active',
          sortBy: 'name',
          sortDirection: 'asc',
          page: 1,
          pageSize: 100,
        })
        .then((response) => setCountries(response.data))
        .catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSummary]);

  const kpis = useMemo<readonly MasterDataKpiItem[]>(() => {
    const common = (input: {
      total: number | undefined;
      active: number | undefined;
      thirdLabel: string;
      thirdValue: number | null | undefined;
      fourthLabel: string;
      fourthValue: number | null | undefined;
      thirdIcon?: typeof Globe2;
      fourthIcon?: typeof CircleAlert;
    }): readonly MasterDataKpiItem[] => [
      {
        label:
          resource === 'leaders'
            ? 'کل لیدرها'
            : resource === 'tour-types' || resource === 'transfer-types'
              ? 'کل انواع'
              : 'کل خدمات',
        value: input.total ?? '—',
        icon: CurrentIcon,
        tone: 'sky',
      },
      {
        label: 'فعال',
        value: input.active ?? '—',
        icon: CheckCircle2,
        tone: 'emerald',
      },
      {
        label: input.thirdLabel,
        value: input.thirdValue ?? '—',
        icon: input.thirdIcon ?? Globe2,
        tone: 'violet',
      },
      {
        label: input.fourthLabel,
        value: input.fourthValue ?? '—',
        icon: input.fourthIcon ?? CircleAlert,
        tone: 'amber',
      },
    ];
    if (resource === 'leaders')
      return common({
        total: summary?.leaders.total,
        active: summary?.leaders.active,
        thirdLabel: 'مقصدها',
        thirdValue: summary?.leaders.destinations,
        fourthLabel: 'مدرک ناقص',
        fourthValue: summary?.leaders.incompleteDocuments,
      });
    if (resource === 'tour-types')
      return common({
        total: summary?.tourTypes.total,
        active: summary?.tourTypes.active,
        thirdLabel: 'داخلی',
        thirdValue: summary?.tourTypes.domestic,
        fourthLabel: 'خارجی',
        fourthValue: summary?.tourTypes.international,
      });
    if (resource === 'transfer-types')
      return common({
        total: summary?.transferTypes.total,
        active: summary?.transferTypes.active,
        thirdLabel: 'اختصاصی',
        thirdValue: summary?.transferTypes.private,
        fourthLabel: 'اشتراکی',
        fourthValue: summary?.transferTypes.shared,
        thirdIcon: UserRound,
        fourthIcon: Users,
      });
    return common({
      total: summary?.visaServices.total,
      active: summary?.visaServices.active,
      thirdLabel: 'کشورها',
      thirdValue: summary?.visaServices.countries,
      fourthLabel: 'مدرک ناقص',
      fourthValue: summary?.visaServices.incompleteGuidance,
      fourthIcon: FileQuestion,
    });
  }, [CurrentIcon, resource, summary]);

  const filter = useMemo(() => {
    if (resource === 'leaders' || resource === 'visa-services')
      return { label: 'کشور', options: countries };
    if (resource === 'tour-types')
      return {
        label: 'دامنه',
        options: [
          { id: 'DOMESTIC', name: 'داخلی' },
          { id: 'INTERNATIONAL', name: 'خارجی' },
          { id: 'BOTH', name: 'داخلی / خارجی' },
        ],
      };
    return {
      label: 'شیوه سرویس',
      options: [
        { id: 'PRIVATE', name: 'اختصاصی' },
        { id: 'SHARED', name: 'اشتراکی' },
      ],
    };
  }, [countries, resource]);

  function changeResource(next: TravelResource) {
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
      const safeValues = { ...values };
      if (resource === 'leaders') {
        if (!safeValues.primaryPhone) delete safeValues.primaryPhone;
        if (!safeValues.roamingPhone) delete safeValues.roamingPhone;
      }
      await masterDataApi.update(resource, selected.id, {
        values: safeValues,
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

  async function afterDelete() {
    setSelected(undefined);
    setFormMode(null);
    setProfileOpen(false);
    setNotice('رکورد با موفقیت حذف شد.');
    if (records.length === 1 && page > 1) setPage(page - 1);
    else await load();
    await loadSummary();
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
      const filters: Omit<MasterDataListQuery, 'page' | 'pageSize'> = {
        search,
        status,
        sortBy: 'name',
        sortDirection: 'asc',
        ...(referenceFilter !== 'all' && resource === 'leaders'
          ? { countryId: referenceFilter }
          : {}),
        ...(referenceFilter !== 'all' && resource === 'tour-types'
          ? {
              tourScope: referenceFilter as
                'DOMESTIC' | 'INTERNATIONAL' | 'BOTH',
            }
          : {}),
        ...(referenceFilter !== 'all' && resource === 'transfer-types'
          ? {
              transferServiceMode: referenceFilter as 'PRIVATE' | 'SHARED',
            }
          : {}),
        ...(referenceFilter !== 'all' && resource === 'visa-services'
          ? { countryId: referenceFilter }
          : {}),
      };
      const response = await masterDataApi.downloadExcel({
        resource,
        format: 'xlsx',
        filters,
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
      <MasterDataDeleteButton record={record} onDeleted={afterDelete} />
      <Button onClick={() => void toggle(record)} size="sm" variant="ghost">
        {record.status === 'active' ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
      </Button>
    </div>
  );

  function cells(record: MasterDataRecord): readonly ReactNode[] {
    const nameButton = (
      <button
        className="font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => openProfile(record)}
        type="button"
      >
        {record.name}
      </button>
    );
    const code = (
      <span className="font-mono text-xs" dir="ltr">
        {record.code}
      </span>
    );
    if (resource === 'leaders')
      return [
        code,
        <span key="name">
          {nameButton}
          <small className="block text-muted-foreground" dir="ltr">
            {attribute(record, 'englishName')}
          </small>
        </span>,
        `${attribute(record, 'countryName')} · ${attribute(record, 'cityName')}`,
        <span className="font-mono" dir="ltr" key="phone">
          {attribute(record, 'primaryPhoneMasked')}
        </span>,
        chips(attribute(record, 'languages')),
        `${attribute(record, 'expertise')} · ${attribute(record, 'destinations')}`,
        <Badge className="bg-muted text-muted-foreground" key="docs">
          —
        </Badge>,
      ];
    if (resource === 'tour-types')
      return [
        code,
        nameButton,
        <span dir="ltr" key="english">
          {attribute(record, 'englishName')}
        </span>,
        <Badge key="scope">{translated(record, 'scope')}</Badge>,
        attribute(record, 'description'),
        tourTypeUsageLabel(record),
        tourTypeUpdatedLabel(record, tourActorNames),
      ];
    if (resource === 'transfer-types')
      return [
        code,
        nameButton,
        attribute(record, 'vehicleType'),
        <Badge key="mode">{translated(record, 'serviceMode')}</Badge>,
        transferCapacityLabel(record),
        attribute(record, 'description'),
        transferUsageLabel(record),
      ];
    return [
      code,
      nameButton,
      attribute(record, 'countryName'),
      <Badge key="visa">{attribute(record, 'visaType')}</Badge>,
      attribute(record, 'supplierName'),
      visaValidityLabel(record),
      attribute(record, 'guidanceFileReference'),
    ];
  }

  const table = records.length ? (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[76rem] text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            {headers[resource].map((label) => (
              <th className="p-4 text-start" key={label}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr
              className="border-t border-border transition hover:bg-muted/30"
              key={record.id}
            >
              {cells(record).map((cell, index) => (
                <td className="max-w-72 p-4" key={`${record.id}-${index}`}>
                  {cell}
                </td>
              ))}
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
        description="دریافت خدمات سفر از Backend ناموفق بود."
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
          aria-label="زیرمجموعه‌های تور و خدمات سفر"
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
        description={rules[resource].text}
        title={rules[resource].title}
        tone="warning"
      />
      <FilterBar className="grid sm:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_12rem_14rem_auto]">
        <FormField id="travel-search" label="جست‌وجو">
          <div className="relative">
            <Search className="absolute end-3 top-3.5 size-4 text-muted-foreground" />
            <Input
              className="pe-10"
              id="travel-search"
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
        <FormField label={filter.label}>
          <Select
            onValueChange={(value) => {
              setReferenceFilter(value);
              setPage(1);
            }}
            value={referenceFilter}
          >
            <SelectTrigger aria-label={`فیلتر ${filter.label}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه {filter.label}ها</SelectItem>
              {filter.options.map((option) => (
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
      {formMode && resource === 'tour-types' && formMode !== 'view' ? (
        <MasterDataTourTypeForm
          key={`tour-${formMode}-${selected?.id ?? 'new'}`}
          actorNames={tourActorNames}
          onOpenChange={(open) => {
            if (!open) setFormMode(null);
          }}
          onPersist={persist}
          {...(selected && formMode === 'edit' ? { record: selected } : {})}
        />
      ) : formMode && (resource === 'transfer-types' || resource === 'visa-services') && formMode !== 'view' ? (
        <MasterDataTravelReferenceForm
          key={`${resource}-${formMode}-${selected?.id ?? 'new'}`}
          resource={resource}
          onOpenChange={(open) => { if (!open) setFormMode(null); }}
          onPersist={persist}
          {...(selected && formMode === 'edit' ? { record: selected } : {})}
        />
      ) : formMode ? (
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
          description="پروفایل از فهرست اصلی و بدون سکشن یا مسیر مستقل نمایش داده می‌شود."
          onOpenChange={setProfileOpen}
          open={profileOpen}
          title={`پروفایل ${definition.singularLabel}`}
        >
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div className="grid gap-5 bg-gradient-to-l from-rose-50 via-background to-sky-50 p-6 dark:from-rose-950/30 dark:to-sky-950/30 md:grid-cols-[6rem_1fr_auto]">
                <span className="grid size-24 place-items-center rounded-3xl bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300">
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
            {resource === 'leaders' ? (
              <Alert
                description="شماره‌ها فقط به‌صورت ماسک‌شده نمایش داده می‌شوند؛ سند، آدرس، حساب بانکی و دستمزد در این Aggregate ذخیره نشده‌اند."
                title="اطلاعات حساس محافظت‌شده"
                tone="warning"
              />
            ) : null}
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
                        {resource === 'transfer-types' && field.key === 'suggestedCapacity'
                          ? transferCapacityLabel(selected)
                          : resource === 'visa-services' && field.key === 'referenceValidityDays'
                            ? visaValidityLabel(selected)
                            : translated(selected, field.key)}
                      </dd>
                    </div>
                  ))}
                  {resource === 'tour-types' ? (
                    <>
                      <div>
                        <dt className="text-xs text-muted-foreground">استفاده</dt>
                        <dd className="mt-1 font-semibold">
                          {tourTypeUsageLabel(selected)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">آخرین تغییر</dt>
                        <dd className="mt-1 break-words font-semibold">
                          {tourTypeUpdatedLabel(selected, tourActorNames)}
                        </dd>
                      </div>
                    </>
                  ) : null}
                </dl>
              </Card>
              <Card className="p-5">
                <h3 className="mb-4 flex items-center gap-2 font-black">
                  {resource === 'leaders' ? (
                    <LockKeyhole className="size-5" />
                  ) : (
                    <ShieldCheck className="size-5" />
                  )}{' '}
                  مرز دامنه
                </h3>
                <EmptyState
                  description={rules[resource].text}
                  icon={resource === 'leaders' ? FileQuestion : Link2}
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
