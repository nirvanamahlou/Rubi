'use client';

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
  Contact,
  Database,
  Eye,
  FilePenLine,
  FileSpreadsheet,
  FilterX,
  LockKeyhole,
  Mail,
  MapPin,
  MessageCircle,
  Network,
  Plug,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldX,
  UserRound,
  Users,
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
import { MasterDataKpiGrid } from './master-data-kpi-grid';

type SupplierTab =
  | 'suppliers'
  | 'supplier-profile'
  | 'brokers'
  | 'broker-profile'
  | 'contacts'
  | 'collaboration';
type RequestState = 'loading' | 'ready' | 'error' | 'forbidden';

const tabs = [
  { id: 'suppliers', label: 'تأمین‌کنندگان', icon: Building2 },
  { id: 'supplier-profile', label: 'پروفایل تأمین‌کننده', icon: Briefcase },
  { id: 'brokers', label: 'کارگزاران', icon: Users },
  { id: 'broker-profile', label: 'پروفایل کارگزار', icon: UserRound },
  { id: 'contacts', label: 'اطلاعات تماس', icon: Contact },
  { id: 'collaboration', label: 'وضعیت همکاری', icon: ShieldCheck },
] as const;

const tabCopy: Record<
  SupplierTab,
  { title: string; description: string; action: string }
> = {
  suppliers: {
    title: 'تأمین‌کنندگان',
    description:
      'مدیریت تأمین‌کنندگان خدمات سفر، پوشش خدمات، اتصال Provider و وضعیت همکاری',
    action: 'افزودن تأمین‌کننده',
  },
  'supplier-profile': {
    title: 'پروفایل تأمین‌کننده',
    description:
      'نمای یکپارچه خدمات، قواعد خرید، شناسه‌های بیرونی و مرز دسترسی ماژول‌ها',
    action: 'ویرایش پروفایل',
  },
  brokers: {
    title: 'کارگزاران',
    description:
      'مدیریت پروفایل یکتای کارگزار، اطلاعات تماس، خدمات و محدودیت خرید',
    action: 'افزودن کارگزار',
  },
  'broker-profile': {
    title: 'پروفایل کارگزار',
    description: 'جزئیات اجرایی کارگزار، پوشش خدمات چندبه‌چند و مخاطبان مرتبط',
    action: 'ویرایش کارگزار',
  },
  contacts: {
    title: 'اطلاعات تماس',
    description:
      'مدیریت چند مخاطب برای هر تأمین‌کننده یا کارگزار با داده‌های ماسک‌شونده',
    action: 'افزودن مخاطب',
  },
  collaboration: {
    title: 'وضعیت همکاری',
    description:
      'پایش وضعیت همکاری، محدودیت خرید، قواعد لغو و مراجع قرارداد بدون تداخل مالکیت',
    action: 'تعریف وضعیت',
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
  if (tab === 'suppliers' || tab === 'supplier-profile') return 'suppliers';
  if (tab === 'brokers' || tab === 'broker-profile') return 'brokers';
  if (tab === 'contacts') return 'organization-contacts';
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

export function MasterDataSuppliersWorkspace() {
  const [tab, setTab] = useState<SupplierTab>('suppliers');
  const [records, setRecords] = useState<readonly MasterDataRecord[]>([]);
  const [collaborationRecords, setCollaborationRecords] = useState<
    readonly MasterDataRecord[]
  >([]);
  const [summary, setSummary] =
    useState<MasterOrganizationSupplierSummary>(emptySummary);
  const [requestState, setRequestState] = useState<RequestState>('loading');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | MasterDataStatus>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<MasterDataRecord>();
  const [formMode, setFormMode] = useState<MasterDataFormMode | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [unmasked, setUnmasked] = useState<
    Record<string, { phone: string | null; email: string | null }>
  >({});
  const copy = tabCopy[tab];
  const resource = resourceFor(tab);
  const definition = getMasterDataDefinition(resource);

  const loadSummary = useCallback(async () => {
    try {
      const response = await masterDataApi.organizationSupplierSummary();
      setSummary(response.data);
    } catch {
      setSummary(emptySummary);
    }
  }, []);

  const load = useCallback(async () => {
    setRequestState('loading');
    try {
      if (tab === 'collaboration') {
        const [suppliers, brokers] = await Promise.all([
          masterDataApi.list('suppliers', {
            search,
            status,
            sortBy: 'name',
            sortDirection: 'asc',
            page: 1,
            pageSize: 100,
          }),
          masterDataApi.list('brokers', {
            search,
            status,
            sortBy: 'name',
            sortDirection: 'asc',
            page: 1,
            pageSize: 100,
          }),
        ]);
        setRecords(suppliers.data);
        setCollaborationRecords(brokers.data);
        setTotal(suppliers.meta.total + brokers.meta.total);
      } else {
        const response = await masterDataApi.list(resource, {
          search,
          status,
          sortBy: 'name',
          sortDirection: 'asc',
          page,
          pageSize: 25,
        });
        setRecords(response.data);
        setCollaborationRecords([]);
        setTotal(response.meta.total);
        if (tab === 'supplier-profile' || tab === 'broker-profile')
          setSelected(
            (current) =>
              response.data.find((record) => record.id === current?.id) ??
              response.data[0],
          );
      }
      setRequestState('ready');
    } catch (error) {
      setRecords([]);
      setCollaborationRecords([]);
      setRequestState(
        error instanceof MasterDataApiError && error.status === 403
          ? 'forbidden'
          : 'error',
      );
    }
  }, [page, resource, search, status, tab]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSummary(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSummary]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  const kpis = useMemo(() => {
    if (tab === 'suppliers' || tab === 'supplier-profile')
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
    if (tab === 'brokers' || tab === 'broker-profile')
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
    if (tab === 'contacts')
      return [
        {
          label: 'کل مخاطبان',
          value: summary.contacts.total,
          icon: Contact,
          tone: 'sky' as const,
        },
        {
          label: 'مخاطب فعال',
          value: summary.contacts.active,
          icon: CheckCircle2,
          tone: 'emerald' as const,
        },
        {
          label: 'دارای WhatsApp',
          value: summary.contacts.whatsapp,
          icon: MessageCircle,
          tone: 'violet' as const,
        },
        {
          label: 'نیازمند تکمیل',
          value: summary.contacts.incomplete,
          icon: Mail,
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
    setTab(next);
    setSearch('');
    setStatus('all');
    setPage(1);
    setNotice(null);
  }

  async function persist(values: Record<string, string>) {
    if (formMode === 'edit' && selected) {
      await masterDataApi.update(resource, selected.id, {
        values,
        version: selected.version,
      });
      setNotice(`${definition.singularLabel} با موفقیت ویرایش شد.`);
    } else {
      await masterDataApi.create(resource, { values });
      setNotice(`${definition.singularLabel} با موفقیت ایجاد شد.`);
    }
    setFormMode(null);
    await Promise.all([load(), loadSummary()]);
  }

  async function toggle(record: MasterDataRecord) {
    try {
      await masterDataApi.setStatus(
        record.resource,
        record.id,
        record.status === 'active' ? 'inactive' : 'active',
        record.version,
      );
      setNotice('وضعیت رکورد با موفقیت تغییر کرد.');
      await Promise.all([load(), loadSummary()]);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'تغییر وضعیت ناموفق بود.',
      );
    }
  }

  async function requestExcel() {
    setExporting(true);
    try {
      const file = await masterDataApi.downloadExcel({
        resource,
        format: 'xlsx',
        filters: {
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

  async function unmaskContact(record: MasterDataRecord) {
    try {
      const response = await masterDataApi.unmaskOrganizationContact(record.id);
      setUnmasked((current) => ({ ...current, [record.id]: response.data }));
      window.setTimeout(
        () =>
          setUnmasked((current) => {
            const next = { ...current };
            delete next[record.id];
            return next;
          }),
        30_000,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'نمایش اطلاعات حساس مجاز نیست.',
      );
    }
  }

  const openCreateOrEdit = () => {
    if ((tab === 'supplier-profile' || tab === 'broker-profile') && selected)
      setFormMode('edit');
    else if (tab !== 'collaboration') {
      setSelected(undefined);
      setFormMode('create');
    }
  };

  const rowActions = (record: MasterDataRecord) => (
    <div className="flex flex-wrap gap-2">
      <Button
        onClick={() => {
          setSelected(record);
          if (record.resource === 'suppliers') setTab('supplier-profile');
          else if (record.resource === 'brokers') setTab('broker-profile');
          else setFormMode('view');
        }}
        size="sm"
        variant="outline"
      >
        <Eye className="size-4" /> مشاهده
      </Button>
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
      <Button onClick={() => void toggle(record)} size="sm" variant="ghost">
        {record.status === 'active' ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
      </Button>
    </div>
  );

  function renderProfile(
    record: MasterDataRecord | undefined,
    kind: 'supplier' | 'broker',
  ) {
    if (!record)
      return (
        <EmptyState
          action={
            <Button onClick={() => setFormMode('create')}>ایجاد پروفایل</Button>
          }
          description="برای این بخش هنوز پروفایل پایداری ثبت نشده است."
          icon={kind === 'supplier' ? Building2 : Users}
          title={
            kind === 'supplier'
              ? 'پروفایل تأمین‌کننده خالی است'
              : 'پروفایل کارگزار خالی است'
          }
        />
      );
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
                value={text(record, 'collaborationStatus', 'UNDER_REVIEW')}
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
                  <td className="p-4 font-semibold">{record.name}</td>
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
                      value={text(
                        record,
                        'collaborationStatus',
                        'UNDER_REVIEW',
                      )}
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
                  <td className="p-4 font-semibold">{record.name}</td>
                  <td className="p-4">
                    {text(record, 'organizationName')} / BROKER
                  </td>
                  <td className="p-4">
                    {text(record, 'countryName')} / {text(record, 'cityName')}
                  </td>
                  <td className="p-4 text-muted-foreground">—</td>
                  <td className="p-4">
                    <ServiceChips value={text(record, 'serviceNames', '')} />
                  </td>
                  <td className="p-4 text-muted-foreground">—</td>
                  <td className="p-4">
                    <CollaborationBadge
                      value={text(
                        record,
                        'collaborationStatus',
                        'UNDER_REVIEW',
                      )}
                    />
                  </td>
                  <td className="p-4">{rowActions(record)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      );
    if (tab === 'contacts')
      return (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[78rem] text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                {[
                  'نام مخاطب',
                  'سمت',
                  'متعلق به',
                  'نوع مالک',
                  'کانال ترجیحی',
                  'تلفن / WhatsApp',
                  'ایمیل',
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
              {records.map((record) => {
                const revealed = unmasked[record.id];
                return (
                  <tr className="border-t border-border" key={record.id}>
                    <td className="p-4 font-semibold">{record.name}</td>
                    <td className="p-4">{text(record, 'jobTitle')}</td>
                    <td className="p-4">{text(record, 'organizationName')}</td>
                    <td className="p-4">Organization</td>
                    <td className="p-4">{text(record, 'preferredChannel')}</td>
                    <td className="p-4 font-mono" dir="ltr">
                      {revealed?.phone ?? text(record, 'phoneMasked')}
                    </td>
                    <td className="p-4 font-mono" dir="ltr">
                      {revealed?.email ?? text(record, 'emailMasked')}
                    </td>
                    <td className="p-4">
                      <Badge>
                        {record.status === 'active' ? 'فعال' : 'غیرفعال'}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => void unmaskContact(record)}
                          size="sm"
                          variant="outline"
                        >
                          <Eye className="size-4" /> نمایش مجاز
                        </Button>
                        {rowActions(record)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      );
    return null;
  }

  function renderCollaboration() {
    const all = [...records, ...collaborationRecords];
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
            const laneRecords = all.filter(
              (record) =>
                text(record, 'collaborationStatus', 'UNDER_REVIEW') ===
                lane.value,
            );
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
                    {summary.collaboration[lane.value].toLocaleString('fa-IR')}
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
                            <h4 className="font-bold">{record.name}</h4>
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
                          خدمات: {text(record, 'serviceNames')}
                        </p>
                        <footer className="mt-3 border-t border-border pt-3">
                          {rowActions(record)}
                        </footer>
                      </article>
                    ))
                  ) : (
                    <p className="py-8 text-center text-xs text-muted-foreground">
                      رکوردی در این وضعیت نیست.
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
    ) : tab === 'supplier-profile' ? (
      renderProfile(selected, 'supplier')
    ) : tab === 'broker-profile' ? (
      renderProfile(selected, 'broker')
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
        eyebrow="اطلاعات پایه / سازمان‌ها و تأمین‌کنندگان"
        title={copy.title}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          loading={exporting}
          onClick={() => void requestExcel()}
          variant="outline"
        >
          <FileSpreadsheet className="size-4" /> خروجی اکسل
        </Button>
        <Button disabled={tab === 'collaboration'} onClick={openCreateOrEdit}>
          <Plus className="size-4" /> {copy.action}
        </Button>
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
      <Alert
        description={
          tab === 'contacts'
            ? 'شماره و ایمیل در Backend با کلید مستقل Master Data رمزنگاری می‌شوند؛ فهرست و Audit فقط مقدار ماسک‌شده دارند و نمایش کامل نیازمند مجوز و Audit است.'
            : 'Organization و Role در Master Data است؛ قرارداد، اعتبار، نرخ خرید و بدهی Provider در B2B، Procurement یا Finance باقی می‌ماند و Credential فقط در Integrations ذخیره می‌شود.'
        }
        title={
          tab === 'contacts' ? 'PII Encryption و Masking' : 'مرز مالکیت داده'
        }
        tone="warning"
      />
      {tab !== 'supplier-profile' && tab !== 'broker-profile' ? (
        <FilterBar className="grid sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1fr)_12rem_auto]">
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
              setStatus('all');
              setPage(1);
            }}
            variant="ghost"
          >
            <FilterX className="size-4" /> پاک‌کردن
          </Button>
        </FilterBar>
      ) : null}
      {content}
      {tab !== 'collaboration' &&
      tab !== 'supplier-profile' &&
      tab !== 'broker-profile' ? (
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
      ) : null}
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
          {...(selected ? { record: selected } : {})}
        />
      ) : null}
    </div>
  );
}
