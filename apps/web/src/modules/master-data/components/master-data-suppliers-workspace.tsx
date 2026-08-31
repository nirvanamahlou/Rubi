'use client';
import { useMasterDataColumnFilters } from './master-data-column-filters';
import { MasterDataPowerButton } from './master-data-power-button';

import type {
  MasterDataRecord,
  MasterDataResource,
  MasterDataStatus,
  MasterOrganizationSupplierSummary,
} from '@rubi/contracts';
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock3,
  Database,
  Eye,
  FilePenLine,
  FileSpreadsheet,
  FilterX,
  LockKeyhole,
  MapPin,
  Network,
  Plug,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldX,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
import { MasterDataDeleteButton } from './master-data-delete-button';
import { getMasterDataDefinition } from '../model/catalog';
import {
  groupSupplierCollaborationRecords,
  loadSupplierCollaborationPage,
} from '../model/supplier-collaboration';
import {
  MasterDataLiveForm,
  type MasterDataFormMode,
} from './master-data-live-form';
import { MasterDataKpiGrid } from './master-data-kpi-grid';
import { MasterDataProfileDialog } from './master-data-profile-dialog';

type SupplierTab = 'suppliers' | 'brokers' | 'collaboration';
type RequestState = 'loading' | 'ready' | 'error' | 'forbidden';

const tabs = [
  { id: 'suppliers', label: 'تأمین‌کنندگان', icon: Building2 },
  { id: 'brokers', label: 'کارگزاران', icon: Users },
  { id: 'collaboration', label: 'وضعیت همکاری', icon: ShieldCheck },
] as const;

const tabCopy: Record<
  SupplierTab,
  { title: string; description: string; action: string | null }
> = {
  suppliers: {
    title: 'تأمین‌کنندگان',
    description:
      'مدیریت تأمین‌کنندگان خدمات سفر، پوشش خدمات، اتصال Provider و وضعیت همکاری',
    action: 'افزودن تأمین‌کننده',
  },
  brokers: {
    title: 'کارگزاران',
    description:
      'مدیریت پروفایل یکتای کارگزار، اطلاعات تماس، خدمات و محدودیت خرید',
    action: 'افزودن کارگزار',
  },
  collaboration: {
    title: 'وضعیت همکاری',
    description:
      'نمایش تأمین‌کنندگان و کارگزاران بر اساس وضعیت ثبت‌شده آن‌ها؛ تغییر وضعیت از فرم اصلی هر رکورد انجام می‌شود.',
    action: null,
  },
};

const emptySummary: MasterOrganizationSupplierSummary = {
  suppliers: {
    total: 0,
    activeCollaboration: 0,
    contracted: null,
    providerConnected: 0,
  },
  brokers: { total: 0, active: 0, coveredCities: 0, incomplete: 0 },
  contacts: { total: 0, active: 0, whatsapp: 0, incomplete: 0 },
  collaboration: {
    ACTIVE: 0,
    UNDER_REVIEW: 0,
    PURCHASE_SUSPENDED: 0,
    ENDED: 0,
  },
};

function resourceFor(tab: SupplierTab): MasterDataResource {
  if (tab === 'suppliers') return 'suppliers';
  if (tab === 'brokers') return 'brokers';
  return 'suppliers';
}

function text(record: MasterDataRecord, key: string, fallback = '—') {
  const value = record.attributes[key];
  return value === null || value === undefined || value === ''
    ? fallback
    : String(value);
}

function collaborationLabel(value: string) {
  return (
    {
      ACTIVE: 'همکاری فعال',
      INACTIVE: 'غیرفعال',
      UNDER_REVIEW: 'در حال بررسی',
      PURCHASE_SUSPENDED: 'تعلیق خرید',
      ENDED: 'پایان همکاری',
    }[value] ?? 'در حال بررسی'
  );
}

function CollaborationBadge({ value }: { value: string }) {
  const label = collaborationLabel(value);
  return (
    <Badge
      className={
        value === 'ACTIVE'
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : value === 'UNDER_REVIEW'
            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
            : value === 'PURCHASE_SUSPENDED'
              ? 'bg-violet-500/10 text-violet-700 dark:text-violet-300'
              : 'bg-slate-500/10 text-slate-700 dark:text-slate-300'
      }
    >
      {label}
    </Badge>
  );
}

function ServiceChips({ value }: { value: string }) {
  const services = value.split(',').filter(Boolean);
  return services.length ? (
    <div className="flex max-w-72 flex-wrap gap-1.5">
      {services.map((service) => (
        <Badge className="bg-primary/8 text-primary" key={service}>
          {service}
        </Badge>
      ))}
    </div>
  ) : (
    <span className="text-muted-foreground">—</span>
  );
}

function ProfileData({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border/70 pb-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}

function partnerPersonType(record: MasterDataRecord) {
  return record.attributes.organizationPersonType === 'NATURAL'
    ? 'حقیقی'
    : record.attributes.organizationPersonType === 'LEGAL'
      ? 'حقوقی'
      : 'ثبت نشده';
}

export function MasterDataSuppliersWorkspace() {
  const [tab, setTab] = useState<SupplierTab>('suppliers');
  const [records, setRecords] = useState<readonly MasterDataRecord[]>([]);
  const [collaborationRecords, setCollaborationRecords] = useState<
    readonly MasterDataRecord[]
  >([]);
  const [collaborationPageCount, setCollaborationPageCount] = useState(1);
  const loadSequence = useRef(0);
  const [summary, setSummary] =
    useState<MasterOrganizationSupplierSummary>(emptySummary);
  const [requestState, setRequestState] = useState<RequestState>('loading');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | MasterDataStatus>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<MasterDataRecord>();
  const [profileOpen, setProfileOpen] = useState(false);
  const [formMode, setFormMode] = useState<MasterDataFormMode | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const copy = tabCopy[tab];
  const resource = resourceFor(tab);
  const definition = getMasterDataDefinition(resource);
  const formDefinition = getMasterDataDefinition(
    formMode && formMode !== 'create' && selected
      ? selected.resource
      : resource,
  );

  const loadSummary = useCallback(async () => {
    try {
      const response = await masterDataApi.organizationSupplierSummary();
      setSummary(response.data);
    } catch {
      setSummary(emptySummary);
    }
  }, []);

  const { columnFilters, columnFilterControls, resetColumnFilters } =
    useMasterDataColumnFilters(resource, () => setPage(1));

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setRequestState('loading');
    try {
      if (tab === 'collaboration') {
        const response = await loadSupplierCollaborationPage(masterDataApi, {
          ...columnFilters,
          search,
          status,
          page,
        });
        if (sequence !== loadSequence.current) return;
        setRecords(response.suppliers);
        setCollaborationRecords(response.brokers);
        setCollaborationPageCount(response.pageCount);
        setTotal(response.total);
      } else {
        const response = await masterDataApi.list(resource, {
          ...columnFilters,
          search,
          status,
          sortBy: 'name',
          sortDirection: 'asc',
          page,
          pageSize: 25,
        });
        if (sequence !== loadSequence.current) return;
        setRecords(response.data);
        setCollaborationRecords([]);
        setTotal(response.meta.total);
      }
      setRequestState('ready');
    } catch (error) {
      if (sequence !== loadSequence.current) return;
      setRecords([]);
      setCollaborationRecords([]);
      setRequestState(
        error instanceof MasterDataApiError && error.status === 403
          ? 'forbidden'
          : 'error',
      );
    }
  }, [columnFilters, page, resource, search, status, tab]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSummary(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSummary]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 200);
    return () => {
      window.clearTimeout(timer);
      loadSequence.current += 1;
    };
  }, [load]);

  const kpis = useMemo(() => {
    if (tab === 'suppliers')
      return [
        {
          label: 'کل تأمین‌کنندگان',
          value: summary.suppliers.total,
          icon: Building2,
          tone: 'sky' as const,
        },
        {
          label: 'همکاری فعال',
          value: summary.suppliers.activeCollaboration,
          icon: CheckCircle2,
          tone: 'emerald' as const,
        },
        {
          label: 'طرف قرارداد',
          value: '—',
          icon: Briefcase,
          tone: 'violet' as const,
        },
        {
          label: 'متصل به Provider/API',
          value: summary.suppliers.providerConnected,
          icon: Plug,
          tone: 'amber' as const,
        },
      ];
    if (tab === 'brokers')
      return [
        {
          label: 'کل کارگزاران',
          value: summary.brokers.total,
          icon: Users,
          tone: 'sky' as const,
        },
        {
          label: 'پروفایل فعال',
          value: summary.brokers.active,
          icon: CheckCircle2,
          tone: 'emerald' as const,
        },
        {
          label: 'شهرهای تحت پوشش',
          value: summary.brokers.coveredCities,
          icon: MapPin,
          tone: 'violet' as const,
        },
        {
          label: 'نیازمند تکمیل',
          value: summary.brokers.incomplete,
          icon: AlertTriangle,
          tone: 'amber' as const,
        },
      ];
    return [
      {
        label: 'همکاری فعال',
        value: summary.collaboration.ACTIVE,
        icon: CheckCircle2,
        tone: 'emerald' as const,
      },
      {
        label: 'در حال بررسی',
        value: summary.collaboration.UNDER_REVIEW,
        icon: Clock3,
        tone: 'amber' as const,
      },
      {
        label: 'تعلیق خرید',
        value: summary.collaboration.PURCHASE_SUSPENDED,
        icon: LockKeyhole,
        tone: 'violet' as const,
      },
      {
        label: 'پایان همکاری',
        value: summary.collaboration.ENDED,
        icon: ShieldX,
        tone: 'rose' as const,
      },
    ];
  }, [summary, tab]);

  function changeTab(next: SupplierTab) {
    if (next === tab) return;
    loadSequence.current += 1;
    setRequestState('loading');
    setTab(next);
    setSearch('');
    resetColumnFilters();
    setStatus('all');
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
    if (tab === 'collaboration') return;
    if (formMode === 'edit' && selected) {
      await masterDataApi.update(selected.resource, selected.id, {
        values,
        version: selected.version,
      });
      setNotice(`${formDefinition.singularLabel} با موفقیت ویرایش شد.`);
    } else {
      await masterDataApi.create(resource, { values });
      setNotice(`${definition.singularLabel} با موفقیت ایجاد شد.`);
    }
    setFormMode(null);
    await Promise.all([load(), loadSummary()]);
  }

  async function afterDelete() {
    setSelected(undefined);
    setFormMode(null);
    setProfileOpen(false);
    setNotice('رکورد با موفقیت حذف شد.');
    if (records.length + collaborationRecords.length === 1 && page > 1)
      setPage(page - 1);
    else await load();
    await loadSummary();
  }

  async function afterStatusChange() {
    setNotice('وضعیت رکورد با موفقیت تغییر کرد.');
    await Promise.all([load(), loadSummary()]);
  }

  async function requestExcel() {
    setExporting(true);
    try {
      const file = await masterDataApi.downloadExcel({
        resource,
        format: 'xlsx',
        filters: {
          ...columnFilters,
          search,
          status,
          sortBy: 'name',
          sortDirection: 'asc',
        },
        columns: [
          'code',
          'name',
          ...definition.fields
            .map((field) => field.key)
            .filter((field) => !['phone', 'email'].includes(field)),
          'status',
          'updatedAt',
        ],
        locale: 'fa-IR',
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tehran',
      });
      const url = window.URL.createObjectURL(file.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.fileName;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'خروجی Excel ناموفق بود.',
      );
    } finally {
      setExporting(false);
    }
  }

  const openCreateOrEdit = () => {
    if (tab !== 'collaboration') {
      setSelected(undefined);
      setFormMode('create');
    }
  };

  const rowActions = (record: MasterDataRecord) => (
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => openProfile(record)} size="sm" variant="outline">
        <Eye className="size-4" /> مشاهده
      </Button>
      <MasterDataPowerButton record={record} onChanged={afterStatusChange} />
      {tab !== 'collaboration' ? (
        <>
          <Button
            onClick={() => {
              setSelected(record);
              setFormMode('edit');
            }}
            size="sm"
            variant="outline"
          >
            <FilePenLine className="size-4" /> ویرایش
          </Button>
          <MasterDataDeleteButton record={record} onDeleted={afterDelete} />
        </>
      ) : null}
    </div>
  );

  function renderProfile(
    record: MasterDataRecord,
    kind: 'supplier' | 'broker',
  ) {
    const serviceNames = text(record, 'serviceNames', '');
    return (
      <div className="space-y-4">
        <Card className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center">
          <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-violet-500/10 text-violet-700">
            {kind === 'supplier' ? (
              <Building2 className="size-8" />
            ) : (
              <Users className="size-8" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black">{record.name}</h2>
              <CollaborationBadge
                value={
                  record.status === 'inactive'
                    ? 'INACTIVE'
                    : text(record, 'collaborationStatus', 'UNDER_REVIEW')
                }
              />
            </div>
            <p
              className="mt-1 font-mono text-xs text-muted-foreground"
              dir="ltr"
            >
              {record.code}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <strong className="block text-lg">
                {serviceNames
                  ? serviceNames.split(',').length.toLocaleString('fa-IR')
                  : '۰'}
              </strong>
              <span className="text-xs text-muted-foreground">خدمات فعال</span>
            </div>
            <div>
              <strong className="block text-lg">—</strong>
              <span className="text-xs text-muted-foreground">مخاطبان</span>
            </div>
            <div>
              <strong className="block text-lg">
                {text(record, 'externalProviderReference') === '—' ? '۰' : '۱'}
              </strong>
              <span className="text-xs text-muted-foreground">Providerها</span>
            </div>
          </div>
        </Card>
        <Alert
          description="قرارداد، نرخ خرید، بدهی و تسویه از قرارداد عمومی Procurement/Finance خوانده می‌شود و در Master Data قابل ویرایش نیست. Credential نیز فقط در Integrations نگهداری می‌شود."
          title="مرز دامنه و امنیت"
          tone="warning"
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="flex items-center gap-2 font-black">
              <Database className="size-4 text-primary" /> مشخصات پایه
            </h3>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <ProfileData label="کد" value={record.code} />
              <ProfileData
                label="نام انگلیسی"
                value={text(record, 'englishName')}
              />
              <ProfileData
                label="نوع شخصیت"
                value={partnerPersonType(record)}
              />
              <ProfileData
                label="مخاطب اصلی"
                value={text(record, 'primaryContactName')}
              />
              <ProfileData
                label="تلفن اصلی"
                value={text(record, 'primaryPhoneMasked')}
              />
              <ProfileData
                label="ایمیل اصلی"
                value={text(record, 'primaryEmailMasked')}
              />
              <ProfileData
                label="سازمان"
                value={text(record, 'organizationName')}
              />
              <ProfileData label="کشور" value={text(record, 'countryName')} />
              <ProfileData label="شهر" value={text(record, 'cityName')} />
              <ProfileData
                label="وضعیت"
                value={record.status === 'active' ? 'فعال' : 'غیرفعال'}
              />
              <ProfileData
                label="نسخه"
                value={record.version.toLocaleString('fa-IR')}
              />
            </dl>
          </Card>
          <Card className="p-5">
            <h3 className="flex items-center gap-2 font-black">
              <Network className="size-4 text-primary" /> خدمات و اتصال
            </h3>
            <div className="mt-5 space-y-5">
              <div>
                <p className="mb-2 text-xs text-muted-foreground">
                  خدمات رابطه‌ای
                </p>
                <ServiceChips value={serviceNames} />
              </div>
              <ProfileData
                label="شناسه عمومی Provider/API"
                value={text(record, 'externalProviderReference')}
              />
              <ProfileData
                label="مرجع قرارداد"
                value="— · متعلق به Procurement/B2B"
              />
              <ProfileData
                label="محدودیت خرید"
                value="— · متعلق به Procurement"
              />
            </div>
          </Card>
        </div>
      </div>
    );
  }

  function renderTable() {
    if (tab === 'suppliers')
      return (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[78rem] text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                {[
                  'کد',
                  'تأمین‌کننده',
                  'کشور / شهر',
                  'خدمات قابل ارائه',
                  'طرف قرارداد',
                  'محدودیت خرید',
                  'Provider ID',
                  'وضعیت همکاری',
                  'عملیات',
                ].map((head) => (
                  <th className="p-4 text-start" key={head}>
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr className="border-t border-border" key={record.id}>
                  <td className="p-4 font-mono" dir="ltr">
                    {record.code}
                  </td>
                  <td className="p-4 font-semibold">
                    <button
                      className="text-start font-semibold text-foreground hover:text-primary focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => openProfile(record)}
                      type="button"
                    >
                      {record.name}
                    </button>
                    <p
                      className="mt-1 text-xs font-normal text-muted-foreground"
                      dir="ltr"
                    >
                      {text(record, 'englishName')}
                    </p>
                  </td>
                  <td className="p-4">
                    {text(record, 'countryName')} / {text(record, 'cityName')}
                  </td>
                  <td className="p-4">
                    <ServiceChips value={text(record, 'serviceNames', '')} />
                  </td>
                  <td className="p-4 text-muted-foreground">—</td>
                  <td className="p-4 text-muted-foreground">—</td>
                  <td className="p-4 font-mono" dir="ltr">
                    {text(record, 'externalProviderReference')}
                  </td>
                  <td className="p-4">
                    <CollaborationBadge
                      value={
                        record.status === 'inactive'
                          ? 'INACTIVE'
                          : text(record, 'collaborationStatus', 'UNDER_REVIEW')
                      }
                    />
                  </td>
                  <td className="p-4">{rowActions(record)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      );
    if (tab === 'brokers')
      return (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[78rem] text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                {[
                  'کد',
                  'کارگزار',
                  'سازمان / نوع',
                  'کشور / شهر',
                  'تماس اصلی',
                  'خدمات',
                  'محدودیت خرید',
                  'وضعیت',
                  'عملیات',
                ].map((head) => (
                  <th className="p-4 text-start" key={head}>
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr className="border-t border-border" key={record.id}>
                  <td className="p-4 font-mono" dir="ltr">
                    {record.code}
                  </td>
                  <td className="p-4 font-semibold">
                    <button
                      className="text-start font-semibold text-foreground hover:text-primary focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => openProfile(record)}
                      type="button"
                    >
                      {record.name}
                    </button>
                    <p
                      className="mt-1 text-xs font-normal text-muted-foreground"
                      dir="ltr"
                    >
                      {text(record, 'englishName')}
                    </p>
                  </td>
                  <td className="p-4">
                    {text(record, 'organizationName')} /{' '}
                    {partnerPersonType(record)}
                  </td>
                  <td className="p-4">
                    {text(record, 'countryName')} / {text(record, 'cityName')}
                  </td>
                  <td className="p-4 text-muted-foreground">
                    <span className="block text-xs">
                      {text(record, 'primaryContactName')}
                    </span>
                    <span dir="ltr">
                      {text(
                        record,
                        'primaryPhoneMasked',
                        text(record, 'primaryEmailMasked'),
                      )}
                    </span>
                  </td>
                  <td className="p-4">
                    <ServiceChips value={text(record, 'serviceNames', '')} />
                  </td>
                  <td className="p-4 text-muted-foreground">—</td>
                  <td className="p-4">
                    <CollaborationBadge
                      value={
                        record.status === 'inactive'
                          ? 'INACTIVE'
                          : text(record, 'collaborationStatus', 'UNDER_REVIEW')
                      }
                    />
                  </td>
                  <td className="p-4">{rowActions(record)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      );
    return null;
  }

  function renderCollaboration() {
    const groups = groupSupplierCollaborationRecords(
      records,
      collaborationRecords,
    );
    const lanes = [
      { value: 'ACTIVE', title: 'همکاری فعال', icon: CheckCircle2 },
      { value: 'UNDER_REVIEW', title: 'در حال بررسی', icon: Clock3 },
      { value: 'PURCHASE_SUSPENDED', title: 'تعلیق خرید', icon: LockKeyhole },
      { value: 'ENDED', title: 'پایان همکاری', icon: ShieldX },
    ] as const;
    return (
      <Card className="overflow-x-auto p-4">
        <div className="grid min-w-[62rem] grid-cols-4 gap-3">
          {lanes.map((lane) => {
            const LaneIcon = lane.icon;
            const laneRecords = groups[lane.value];
            return (
              <section
                className="min-h-80 rounded-2xl border border-border bg-muted/25 p-3"
                key={lane.value}
              >
                <header className="flex items-center justify-between gap-2 border-b border-border pb-3">
                  <h3 className="flex items-center gap-2 font-black">
                    <LaneIcon className="size-4" />
                    {lane.title}
                  </h3>
                  <Badge>
                    {laneRecords.length.toLocaleString('fa-IR')} در این صفحه
                  </Badge>
                </header>
                <div className="mt-3 space-y-2">
                  {laneRecords.length ? (
                    laneRecords.map((record) => (
                      <article
                        className="rounded-xl border border-border bg-card p-4 shadow-sm"
                        key={`${record.resource}-${record.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <button
                              className="text-start font-bold text-foreground hover:text-primary focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={() => openProfile(record)}
                              type="button"
                            >
                              {record.name}
                            </button>
                            <p
                              className="mt-1 font-mono text-xs text-muted-foreground"
                              dir="ltr"
                            >
                              {record.code}
                            </p>
                          </div>
                          <Badge>
                            {record.resource === 'suppliers'
                              ? 'تأمین‌کننده'
                              : 'کارگزار'}
                          </Badge>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                          <Badge>
                            {record.status === 'active'
                              ? 'رکورد فعال'
                              : 'رکورد غیرفعال'}
                          </Badge>{' '}
                          خدمات: {text(record, 'serviceNames')}
                        </p>
                        <footer className="mt-3 border-t border-border pt-3">
                          {rowActions(record)}
                        </footer>
                      </article>
                    ))
                  ) : (
                    <p className="py-8 text-center text-xs text-muted-foreground">
                      در این صفحه رکوردی با این وضعیت نیست.
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </Card>
    );
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
        description="مجوز مشاهده اطلاعات پایه برای این بخش لازم است."
        icon={ShieldX}
        title="دسترسی وجود ندارد"
      />
    ) : requestState === 'error' ? (
      <ErrorState
        action={
          <Button onClick={() => void load()} size="sm" variant="outline">
            <RefreshCw className="size-4" /> تلاش دوباره
          </Button>
        }
        description="دریافت اطلاعات از Backend ناموفق بود."
        title="خطا در دریافت اطلاعات"
      />
    ) : tab === 'collaboration' ? (
      renderCollaboration()
    ) : records.length ? (
      renderTable()
    ) : (
      <EmptyState
        action={
          <Button onClick={() => setFormMode('create')}>{copy.action}</Button>
        }
        description="با فیلتر فعلی رکوردی پیدا نشد."
        icon={Database}
        title={`${copy.title} خالی است`}
      />
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
        description={copy.description}
        title={copy.title}
      />
      <div className="flex flex-wrap gap-2">
        {tab !== 'collaboration' ? (
          <>
            <Button
              loading={exporting}
              onClick={() => void requestExcel()}
              variant="outline"
            >
              <FileSpreadsheet className="size-4" /> خروجی اکسل
            </Button>
            <Button onClick={openCreateOrEdit}>
              <Plus className="size-4" /> {copy.action}
            </Button>
          </>
        ) : (
          <Button
            onClick={() => void Promise.all([load(), loadSummary()])}
            variant="outline"
          >
            <RefreshCw className="size-4" /> تازه‌سازی وضعیت‌ها
          </Button>
        )}
      </div>
      {notice ? <Alert description={notice} title="نتیجه عملیات" /> : null}
      <Card className="overflow-x-auto p-2">
        <nav
          aria-label="زیرمجموعه‌های سازمان‌ها و تأمین‌کنندگان"
          className="flex min-w-max gap-1"
        >
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                aria-current={tab === item.id ? 'page' : undefined}
                className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-background aria-[current=page]:text-primary aria-[current=page]:shadow-sm"
                key={item.id}
                onClick={() => changeTab(item.id)}
                type="button"
              >
                <Icon className="size-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </Card>
      <MasterDataKpiGrid items={kpis} label={`شاخص‌های ${copy.title}`} />
      <FilterBar className="grid sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1fr)_12rem_auto]">
        {columnFilterControls}
        <FormField id="supplier-search" label="جستجو">
          <div className="relative">
            <Search className="absolute end-3 top-3.5 size-4 text-muted-foreground" />
            <Input
              className="pe-10"
              id="supplier-search"
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={`جستجو در ${copy.title}`}
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
        <Button
          onClick={() => {
            setSearch('');
            resetColumnFilters();
            setStatus('all');
            setPage(1);
          }}
          variant="ghost"
        >
          <FilterX className="size-4" /> پاک‌کردن
        </Button>
      </FilterBar>
      {content}
      {tab === 'collaboration' ? (
        <p className="text-sm text-muted-foreground">
          در هر صفحه حداکثر ۲۵ تأمین‌کننده و ۲۵ کارگزار نمایش داده می‌شود؛
          شاخص‌های بالا مربوط به کل رکوردها هستند.
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <PaginationShell
          currentPage={page}
          totalLabel={`${total.toLocaleString('fa-IR')} رکورد`}
        />
        <div className="flex gap-2">
          <Button
            disabled={requestState !== 'ready' || page === 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            size="sm"
            variant="outline"
          >
            قبلی
          </Button>
          <Button
            disabled={
              requestState !== 'ready' ||
              (tab === 'collaboration'
                ? page >= collaborationPageCount
                : page * 25 >= total)
            }
            onClick={() => setPage((value) => value + 1)}
            size="sm"
            variant="outline"
          >
            بعدی
          </Button>
        </div>
      </div>
      {formMode && tab !== 'collaboration' ? (
        <MasterDataLiveForm
          definition={formDefinition}
          key={`${formDefinition.key}-${formMode}-${selected?.id ?? 'new'}`}
          mode={formMode}
          onOpenChange={(open) => {
            if (!open) setFormMode(null);
          }}
          onPersist={persist}
          open
          {...(selected ? { record: selected } : {})}
        />
      ) : null}
      {selected &&
      (selected.resource === 'suppliers' || selected.resource === 'brokers') ? (
        <MasterDataProfileDialog
          description="پروفایل از همان فهرست اصلی باز شده و بدون خروج از بخش قابل مشاهده است."
          onOpenChange={setProfileOpen}
          open={profileOpen}
          title={
            selected.resource === 'suppliers'
              ? 'پروفایل تأمین‌کننده'
              : 'پروفایل کارگزار'
          }
        >
          {renderProfile(
            selected,
            selected.resource === 'suppliers' ? 'supplier' : 'broker',
          )}
        </MasterDataProfileDialog>
      ) : null}
    </div>
  );
}
