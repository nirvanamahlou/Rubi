'use client';

import type {
  IamPermissionCode,
  MasterDataRecord,
  MasterDataStatus,
  MasterDataSortField,
  BranchReference,
} from '@rubi/contracts';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldX,
  Users,
  TriangleAlert,
  Trash2,
  Upload,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
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
  PaginationShell,
  Skeleton,
} from '@/components/ui/surfaces';
import {
  masterDataApi,
  MasterDataApiError,
  type MasterDataLogoChange,
} from '@/modules/master-data/api/client';
import { MasterDataLiveForm } from '@/modules/master-data/components/master-data-live-form';
import { getMasterDataDefinition } from '@/modules/master-data/model/catalog';
import { agencyClient } from '../api/agency-client';
import { AgencyConnectionsPanel } from './agency-connections-panel';
import { AgreementWorkflowPanel } from './agreement-workflow-panel';
import { OrganizationAddressesPanel } from './organization-addresses-panel';
import { AgencyProfilePanel } from './agency-profile-panel';
import { OrganizationSignatoriesPanel } from './organization-signatories-panel';
import { OrganizationUsersPanel } from './organization-users-panel';
import { AgencyDossierSummary } from './agency-dossier-summary';
import { loadCommercialSummary } from '../model/commercial-summary';
import { AgencyRatesPanel } from './agency-rates-panel';
import { cooperationLabel } from '../model/presentation';
import {
  loadOrganizationMetrics,
  type OrganizationMetrics,
} from '../model/organization-metrics';
import { CorporateMetric, CorporateProfile } from './corporate-profile';
import './corporate-design.css';
import { CooperationWizard } from './cooperation-wizard';
import { OrganizationExcelDialog } from './organization-excel-dialog';
import { OrganizationDeleteDialog } from './organization-delete-dialog';
import { OrganizationLogo } from './organization-logo';
import {
  saveOrganizationChanges,
  type OrganizationDeletionTarget,
} from '../model/record-mutations';

type RequestState =
  'loading' | 'ready' | 'empty' | 'unauthorized' | 'forbidden' | 'error';

function attribute(record: MasterDataRecord, key: string, fallback = '—') {
  const value = record.attributes[key];
  return value === null || value === undefined || value === ''
    ? fallback
    : String(value);
}

export function OrganizationsWorkspace() {
  const [records, setRecords] = useState<readonly MasterDataRecord[]>([]);
  const [branches, setBranches] = useState<readonly BranchReference[]>([]);
  const [commercialBranch, setCommercialBranch] = useState('');
  const [commercial, setCommercial] = useState<
    Record<string, Awaited<ReturnType<typeof loadCommercialSummary>>>
  >({});
  const [contacts, setContacts] = useState<readonly MasterDataRecord[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | MasterDataStatus>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [metrics, setMetrics] = useState<OrganizationMetrics>();
  const [metricsState, setMetricsState] = useState<
    'loading' | 'ready' | 'error'
  >('loading');
  const [state, setState] = useState<RequestState>('loading');
  const [selected, setSelected] = useState<MasterDataRecord>();
  const [profileOpen, setProfileOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [excelOpen, setExcelOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [templateDownloading, setTemplateDownloading] = useState(false);
  const [deleteTarget, setDeleteTarget] =
    useState<OrganizationDeletionTarget>();
  const directoryHeading = useRef<HTMLHeadingElement>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [notice, setNotice] = useState<string>();
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState<string>();
  const [contactPage, setContactPage] = useState(1);
  const [contactTotal, setContactTotal] = useState(0);
  const [contactForm, setContactForm] = useState<{
    mode: 'create' | 'edit';
    record?: MasterDataRecord;
  }>();
  const [role, setRole] = useState<'AGENCY' | 'CORPORATE_CUSTOMER'>('AGENCY');
  const [sortBy, setSortBy] = useState<MasterDataSortField>('updatedAt');
  const [permissions, setPermissions] = useState<readonly IamPermissionCode[]>(
    [],
  );
  const requestId = useRef(0);
  const contactRequestId = useRef(0);
  const invalidateRequests = useCallback(() => {
    ++requestId.current;
  }, []);
  const pageSize = 20;

  const load = useCallback(async () => {
    const current = ++requestId.current;
    setState('loading');
    setMetrics(undefined);
    setMetricsState('loading');
    void loadOrganizationMetrics(
      { search, status },
      () => current === requestId.current,
    )
      .then((result) => {
        if (current !== requestId.current) return;
        setMetrics(result);
        setMetricsState('ready');
      })
      .catch(() => {
        if (current !== requestId.current) return;
        setMetricsState('error');
      });
    try {
      const response = await agencyClient.list({
        search,
        status,
        page,
        pageSize,
        role,
        sortBy,
        sortDirection: sortBy === 'updatedAt' ? 'desc' : 'asc',
      });
      if (current !== requestId.current) return;
      setRecords(response.data);
      setTotal(response.meta.total);
      setState(response.data.length ? 'ready' : 'empty');
    } catch (error) {
      if (current !== requestId.current) return;
      setRecords([]);
      setTotal(0);
      if (error instanceof MasterDataApiError && error.status === 401)
        setState('unauthorized');
      else if (error instanceof MasterDataApiError && error.status === 403)
        setState('forbidden');
      else setState('error');
    }
  }, [page, search, status, role, sortBy]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 300);
    return () => {
      window.clearTimeout(timer);
      invalidateRequests();
    };
  }, [load, invalidateRequests]);

  useEffect(() => {
    let cancelled = false;
    void agencyClient
      .session()
      .then((user) => {
        if (!cancelled) {
          setPermissions(user.permissions);
          setBranches(user.branches);
          setCommercialBranch(user.branches[0]?.id ?? '');
        }
      })
      .catch(() => {
        if (!cancelled) setPermissions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let current = true;
    let next = 0;
    const worker = async () => {
      while (current && next < records.length) {
        const record = records[next++];
        if (!record) return;
        const summary = await loadCommercialSummary(
          record.id,
          commercialBranch,
          role,
          permissions,
          () => current,
        );
        if (current)
          setCommercial((previous) => ({ ...previous, [record.id]: summary }));
      }
    };
    const timer = window.setTimeout(() => {
      setCommercial({});
      if (!commercialBranch || state !== 'ready' || profileOpen) return;
      void Promise.all(
        Array.from({ length: Math.min(4, records.length) }, worker),
      );
    }, 0);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [records, commercialBranch, role, permissions, state, profileOpen]);

  async function openProfile(
    record: MasterDataRecord,
    requestedContactPage = 1,
  ) {
    const current = ++contactRequestId.current;
    setSelected(record);
    setProfileOpen(true);
    setContacts([]);
    setContactsError(undefined);
    setContactPage(requestedContactPage);
    setContactTotal(0);
    setContactsLoading(true);
    try {
      const response = await agencyClient.contacts(
        record.id,
        requestedContactPage,
      );
      if (current !== contactRequestId.current) return;
      setContacts(response.data);
      setContactTotal(response.meta.total);
    } catch (error) {
      if (current !== contactRequestId.current) return;
      setContacts([]);
      setContactsError(
        error instanceof Error ? error.message : 'دریافت مخاطبان ناموفق بود.',
      );
    } finally {
      if (current === contactRequestId.current) setContactsLoading(false);
    }
  }

  async function persist(
    values: Record<string, string>,
    logoChange?: MasterDataLogoChange,
  ) {
    const result = await saveOrganizationChanges({
      values,
      permissions,
      defaultRole: role,
      ...(formMode === 'edit' && selected ? { record: selected } : {}),
      ...(logoChange ? { logoChange } : {}),
    });
    setNotice(
      result.warning ??
        `سازمان با موفقیت ${formMode === 'edit' ? 'ویرایش' : 'ایجاد'} شد.`,
    );
    setFormMode(null);
    if (profileOpen && selected) setSelected(result.data);
    else setSelected(undefined);
    await load();
  }

  async function refreshAfterDeletion(
    target: OrganizationDeletionTarget,
    deleted: boolean,
  ) {
    setDeleteTarget(undefined);
    if (deleted)
      setNotice(
        `${target.resource === 'organizations' ? 'سازمان' : 'مخاطب'} «${target.record.name}» برای همیشه حذف شد.`,
      );
    if (target.resource === 'organization-contacts' && selected) {
      await openProfile(
        selected,
        Math.max(
          1,
          Math.min(
            contactPage,
            Math.ceil((contactTotal - Number(deleted)) / 100),
          ),
        ),
      );
      return;
    }
    ++contactRequestId.current;
    setProfileOpen(false);
    setSelected(undefined);
    setContactForm(undefined);
    setContacts([]);
    const nextPage = Math.max(
      1,
      Math.min(page, Math.ceil((total - Number(deleted)) / pageSize)),
    );
    if (nextPage !== page) setPage(nextPage);
    else await load();
    window.requestAnimationFrame(() => directoryHeading.current?.focus());
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const metricValue = (value: number | undefined) =>
    metricsState === 'loading' ? '…' : (value?.toLocaleString('fa-IR') ?? '—');
  const metricNote =
    metricsState === 'error'
      ? 'دریافت آمار ناموفق؛ دوباره تازه‌سازی کنید'
      : 'مطابق جست‌وجو و وضعیت؛ همه صفحات';

  async function downloadImportTemplate() {
    if (templateDownloading) return;
    setTemplateDownloading(true);
    try {
      const [{ downloadOrganizationXlsx }, { organizationHeaders }] =
        await Promise.all([
          import('../model/organization-xlsx'),
          import('../model/organization-import'),
        ]);
      downloadOrganizationXlsx('rubi-organizations-template.xlsx', [
        organizationHeaders,
      ]);
    } catch (caught) {
      setNotice(
        caught instanceof Error ? caught.message : 'دریافت قالب ناموفق بود.',
      );
    } finally {
      setTemplateDownloading(false);
    }
  }

  async function exportExcel() {
    if (exporting) return;
    setExporting(true);
    try {
      const file = await masterDataApi.downloadExcel({
        resource: 'organizations',
        format: 'xlsx',
        filters: {
          search,
          status,
          organizationRole: role,
          sortBy,
          sortDirection: sortBy === 'updatedAt' ? 'desc' : 'asc',
        },
        columns: ['code', 'legalName', 'personType', 'roleCodes'],
        locale: 'fa-IR',
        timezone: 'Asia/Tehran',
      });
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.fileName;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('خروجی اکسل مطابق فیلترهای فعلی دریافت شد.');
    } catch (caught) {
      setNotice(
        caught instanceof Error ? caught.message : 'خروجی اکسل ناموفق بود.',
      );
    } finally {
      setExporting(false);
    }
  }

  async function persistContact(values: Record<string, string>) {
    if (!selected || !contactForm)
      throw new Error('پرونده سازمان انتخاب نشده است.');
    await agencyClient.saveContact(selected.id, values, contactForm.record);
    setContactForm(undefined);
    setNotice('مخاطب سازمان با موفقیت ذخیره شد.');
    await openProfile(selected, contactPage);
  }

  return (
    <div className="b2b-design min-w-0" dir="rtl">
      <div hidden={profileOpen}>
        <div className="page-head">
          <div className="title">
            <h1 ref={directoryHeading} tabIndex={-1}>
              آژانس‌ها و مشتریان سازمانی
            </h1>
            <p>
              مدیریت یکپارچه پرونده همکاری B2B، قرارداد، اعتبار، شرایط تجاری و
              نمای عملیات
            </p>
          </div>
        </div>
        <section className="kpis agencies-kpis">
          <CorporateMetric
            label="نتایج فیلتر فعلی"
            value={
              state === 'ready' || state === 'empty'
                ? total.toLocaleString('fa-IR')
                : '—'
            }
            icon={Building2}
          />
          <CorporateMetric
            label="آژانس همکار"
            value={metricValue(metrics?.agencies)}
            icon={Users}
            tone="purple"
            note={metricNote}
          />
          <CorporateMetric
            label="مشتری سازمانی"
            value={metricValue(metrics?.corporateCustomers)}
            icon={Building2}
            tone="green"
            note={metricNote}
          />
          <CorporateMetric
            label="نیازمند تکمیل هویت"
            value={metricValue(metrics?.incompleteIdentity)}
            icon={TriangleAlert}
            tone="amber"
            note={
              metricsState === 'error'
                ? metricNote
                : 'نوع شخصیت یا شناسه ملی شرکت ثبت نشده'
            }
          />
        </section>

        <Card
          aria-label="ثبت آژانس و مشتری سازمانی"
          className="mb-5 flex flex-col gap-4 border-primary/25 bg-primary/[0.04] p-5 text-foreground xl:flex-row xl:items-center xl:justify-between"
          role="region"
        >
          <div className="min-w-0">
            <p className="text-lg font-bold">ثبت آژانس و مشتری سازمانی</p>
            <p className="mt-1 text-sm text-muted-foreground">
              اطلاعات سازمان، نمایندگان و شرایط همکاری را در یک جریان مرحله‌ای
              وارد کنید.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              disabled={
                exporting || !permissions.includes('master_data.export')
              }
              onClick={() => void exportExcel()}
              size="lg"
              type="button"
              variant="outline"
            >
              <Download aria-hidden="true" className="size-4" />
              {exporting ? 'در حال ساخت خروجی…' : 'خروجی Excel'}
            </Button>
            <Button
              disabled={templateDownloading}
              onClick={() => void downloadImportTemplate()}
              size="lg"
              type="button"
              variant="outline"
            >
              <Download aria-hidden="true" className="size-4" />
              {templateDownloading ? 'در حال دریافت…' : 'دانلود قالب ورود'}
            </Button>
            <Button
              disabled={
                ![
                  'master_data.read',
                  'master_data.create',
                  'master_data.import',
                ].every((permission) =>
                  permissions.includes(permission as IamPermissionCode),
                )
              }
              onClick={() => setExcelOpen(true)}
              size="lg"
              type="button"
              variant="outline"
            >
              <Upload aria-hidden="true" className="size-4" />
              ورود از Excel
            </Button>
            <Button
              disabled={
                !permissions.includes('master_data.read') ||
                (!permissions.includes('master_data.create') &&
                  !permissions.includes('master_data.update'))
              }
              onClick={() => setWizardOpen(true)}
              size="lg"
              type="button"
            >
              <Plus aria-hidden="true" className="size-4" />
              بازکردن فرم ثبت
            </Button>
          </div>
        </Card>

        {notice ? <Alert description={notice} title="نتیجه عملیات" /> : null}

        <div className="directory-filters">
          <FilterBar>
            <label className="min-w-44 space-y-2">
              <span className="text-sm font-bold">نوع همکاری</span>
              <Select
                value={role}
                onValueChange={(value) => {
                  setPage(1);
                  setRole(value as typeof role);
                }}
              >
                <SelectTrigger aria-label="نوع همکاری">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AGENCY">آژانس همکار</SelectItem>
                  <SelectItem value="CORPORATE_CUSTOMER">
                    مشتری سازمانی
                  </SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="min-w-64 flex-1 space-y-2">
              <span className="text-sm font-bold">جست‌وجو</span>
              <span className="relative block">
                <Search className="absolute end-3 top-3 size-4 text-muted-foreground" />
                <Input
                  className="pe-9"
                  onChange={(event) => {
                    setPage(1);
                    setSearch(event.target.value);
                  }}
                  placeholder="نام یا کد سازمان"
                  maxLength={100}
                  value={search}
                />
              </span>
            </label>
            <label className="min-w-44 space-y-2">
              <span className="text-sm font-bold">مرتب‌سازی</span>
              <Select
                value={sortBy}
                onValueChange={(value) => {
                  setPage(1);
                  setSortBy(value as MasterDataSortField);
                }}
              >
                <SelectTrigger aria-label="مرتب‌سازی">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updatedAt">آخرین تغییر</SelectItem>
                  <SelectItem value="name">نام</SelectItem>
                  <SelectItem value="code">کد</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="min-w-48 space-y-2">
              <span className="text-sm font-bold">وضعیت سازمان</span>
              <Select
                onValueChange={(value) => {
                  setPage(1);
                  setStatus(value as 'all' | MasterDataStatus);
                }}
                value={status}
              >
                <SelectTrigger aria-label="وضعیت سازمان">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                  <SelectItem value="active">فعال</SelectItem>
                  <SelectItem value="inactive">غیرفعال</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="min-w-44 space-y-2">
              <span className="text-sm font-bold">شعبه اطلاعات تجاری</span>
              <Select
                value={commercialBranch}
                onValueChange={setCommercialBranch}
              >
                <SelectTrigger aria-label="شعبه اطلاعات تجاری">
                  <SelectValue placeholder="انتخاب شعبه" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <Button onClick={() => void load()} type="button" variant="outline">
              <RefreshCw className="size-4" /> تازه‌سازی
            </Button>
          </FilterBar>
        </div>

        {state === 'loading' ? (
          <div aria-label="در حال بارگذاری آژانس‌ها" className="space-y-3">
            {[0, 1, 2].map((item) => (
              <Skeleton className="h-20 w-full" key={item} />
            ))}
          </div>
        ) : state === 'unauthorized' ? (
          <EmptyState
            description="نشست شما معتبر نیست؛ دوباره وارد سامانه شوید."
            icon={ShieldX}
            title="ورود مجدد لازم است"
          />
        ) : state === 'forbidden' ? (
          <EmptyState
            description="اجازه مشاهده اطلاعات پایه سازمان‌ها را ندارید."
            icon={ShieldX}
            title="دسترسی وجود ندارد"
          />
        ) : state === 'error' ? (
          <ErrorState
            action={<Button onClick={() => void load()}>تلاش دوباره</Button>}
            description="دریافت فهرست سازمان‌ها ناموفق بود."
            title="خطا در دریافت سازمان‌ها"
          />
        ) : state === 'empty' ? (
          <EmptyState
            description="با فیلتر فعلی سازمانی پیدا نشد."
            icon={Building2}
            title="فهرست سازمان‌ها خالی است"
          />
        ) : (
          <>
            <div className="grid gap-3 md:hidden">
              {records.map((record) => (
                <Card key={record.id} className="min-w-0 space-y-3 p-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong className="break-words">{record.name}</strong>
                    <Badge>
                      {record.status === 'active' ? 'فعال' : 'غیرفعال'}
                    </Badge>
                  </div>
                  <p className="break-all text-sm" dir="ltr">
                    {record.code}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {cooperationLabel(record.attributes.roleCodes)}
                  </p>
                  <p className="text-sm">
                    مدیر حساب:{' '}
                    {commercial[record.id]?.manager ?? 'در حال دریافت…'}
                  </p>
                  <p className="text-sm">
                    قرارداد فعال:{' '}
                    {commercial[record.id]?.agreements ?? 'در حال دریافت…'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void openProfile(record)}
                      title="مشاهده پرونده"
                      aria-label={`مشاهده پرونده ${record.name}`}
                      className="size-10 p-0"
                    >
                      <Eye aria-hidden="true" className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!permissions.includes('master_data.update')}
                      onClick={() => {
                        setSelected(record);
                        setFormMode('edit');
                      }}
                      title="ویرایش"
                      aria-label={`ویرایش ${record.name}`}
                      className="size-10 p-0"
                    >
                      <Pencil aria-hidden="true" className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={!permissions.includes('master_data.delete')}
                      onClick={() =>
                        setDeleteTarget({ resource: 'organizations', record })
                      }
                      aria-label={`حذف دائمی ${record.name}`}
                      title="حذف دائمی"
                      className="size-10 p-0"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
            <div className="directory-table hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    {[
                      'سازمان',
                      'نوع طرف',
                      'کد سازمان',
                      'مدیر حساب',
                      'قرارداد فعال',
                      'اعتبار قابل استفاده',
                      'وضعیت',
                      'هشدار',
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
                      <td>
                        <div className="org-cell">
                          <div className="avatar">
                            {record.name.slice(0, 1)}
                          </div>
                          <div>
                            <b>{record.name}</b>
                            <small>
                              {record.attributes.nationalId
                                ? `شناسه ملی: ${record.attributes.nationalId}`
                                : 'شناسه ملی ثبت نشده'}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge purple">
                          {cooperationLabel(record.attributes.roleCodes)}
                        </span>
                      </td>
                      <td>
                        <bdi>{record.code}</bdi>
                      </td>
                      <td>
                        {commercial[record.id]?.manager ??
                          (commercialBranch
                            ? 'در حال دریافت…'
                            : 'شعبه انتخاب نشده')}
                      </td>
                      <td>
                        {commercial[record.id]?.agreements ??
                          (commercialBranch
                            ? 'در حال دریافت…'
                            : 'شعبه انتخاب نشده')}
                      </td>
                      <td className="unavailable-value">در دسترس نیست</td>
                      <td className="p-4">
                        <Badge
                          className={
                            record.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-700'
                          }
                        >
                          {record.status === 'active' ? 'فعال' : 'غیرفعال'}
                        </Badge>
                      </td>
                      <td className="unavailable-value">در دسترس نیست</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => void openProfile(record)}
                            size="icon"
                            variant="outline"
                            title="مشاهده پرونده"
                            aria-label={`مشاهده پرونده ${record.name}`}
                          >
                            <Eye aria-hidden="true" className="size-4" />
                          </Button>
                          <Button
                            disabled={
                              !permissions.includes('master_data.update')
                            }
                            onClick={() => {
                              setSelected(record);
                              setFormMode('edit');
                            }}
                            size="icon"
                            variant="outline"
                            title="ویرایش"
                            aria-label={`ویرایش ${record.name}`}
                          >
                            <Pencil aria-hidden="true" className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="destructive"
                            disabled={
                              !permissions.includes('master_data.delete')
                            }
                            onClick={() =>
                              setDeleteTarget({
                                resource: 'organizations',
                                record,
                              })
                            }
                            aria-label={`حذف دائمی ${record.name}`}
                            title="حذف دائمی"
                          >
                            <Trash2 aria-hidden="true" className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="flex items-center justify-between gap-3">
          <PaginationShell
            currentPage={page}
            totalLabel={`${total.toLocaleString('fa-IR')} سازمان`}
          />
          <div className="flex gap-2">
            <Button
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              size="sm"
              variant="outline"
            >
              <ChevronRight className="size-4" /> قبلی
            </Button>
            <Button
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
              size="sm"
              variant="outline"
            >
              بعدی <ChevronLeft className="size-4" />
            </Button>
          </div>
        </div>
      </div>
      {profileOpen && selected ? (
        <CorporateProfile
          key={selected.id}
          organization={selected}
          overview={
            <AgencyDossierSummary organizationId={selected.id} role={role} />
          }
          logo={
            <OrganizationLogo
              organization={selected}
              permissions={permissions}
              onSaved={(record) => {
                setSelected((current) =>
                  current?.id === record.id ? record : current,
                );
                void load();
              }}
            />
          }
          onClose={() => {
            ++contactRequestId.current;
            setProfileOpen(false);
            setSelected(undefined);
            setContactForm(undefined);
            window.requestAnimationFrame(() => {
              directoryHeading.current?.focus({ preventScroll: true });
              window.scrollTo({ top: 0, behavior: 'instant' });
            });
          }}
          canEdit={permissions.includes('master_data.update')}
          onEdit={() => setFormMode('edit')}
          canDelete={permissions.includes('master_data.delete')}
          onDelete={() =>
            setDeleteTarget({ resource: 'organizations', record: selected })
          }
          contacts={
            <Card className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">نمایندگان و اشخاص سازمان</p>
                <Button
                  size="sm"
                  disabled={!permissions.includes('master_data.create')}
                  onClick={() => setContactForm({ mode: 'create' })}
                >
                  افزودن نماینده
                </Button>
              </div>
              {notice ? (
                <Alert title="نتیجه عملیات" description={notice} />
              ) : null}
              {contactsError ? (
                <Alert
                  title="وضعیت مخاطبان"
                  description={contactsError}
                  tone="warning"
                />
              ) : null}
              {contactsLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : contacts.length ? (
                contacts.map((contact) => (
                  <div
                    className="flex flex-wrap items-center gap-3 rounded-xl border p-3"
                    key={contact.id}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <span className="block font-semibold">
                        {contact.name}
                      </span>
                      <span>
                        {attribute(contact, 'jobTitle') || 'سمت ثبت نشده'}
                      </span>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {['phoneMasked', 'emailMasked'].map((key) => {
                          const value = attribute(contact, key, '').trim();
                          return value && value !== '—' && value !== '-' ? (
                            <span key={key} dir="ltr">
                              {value}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        size="icon"
                        variant="outline"
                        title="ویرایش مخاطب"
                        aria-label={`ویرایش مخاطب ${contact.name}`}
                        disabled={!permissions.includes('master_data.update')}
                        onClick={() =>
                          setContactForm({ mode: 'edit', record: contact })
                        }
                      >
                        <Pencil aria-hidden="true" className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        title="حذف دائمی مخاطب"
                        disabled={!permissions.includes('master_data.delete')}
                        onClick={() =>
                          setDeleteTarget({
                            resource: 'organization-contacts',
                            record: contact,
                            organizationId: selected.id,
                          })
                        }
                        aria-label={`حذف دائمی مخاطب ${contact.name}`}
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : !contactsError ? (
                <p className="text-sm text-muted-foreground">
                  تماس ثبت‌شده‌ای وجود ندارد.
                </p>
              ) : null}
              {contactTotal > 100 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={contactsLoading || contactPage <= 1}
                    onClick={() => void openProfile(selected, contactPage - 1)}
                  >
                    مخاطبان قبلی
                  </Button>
                  <span className="text-xs">
                    صفحه {contactPage.toLocaleString('fa-IR')} از{' '}
                    {Math.ceil(contactTotal / 100).toLocaleString('fa-IR')}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      contactsLoading || contactPage * 100 >= contactTotal
                    }
                    onClick={() => void openProfile(selected, contactPage + 1)}
                  >
                    مخاطبان بعدی
                  </Button>
                </div>
              ) : null}
            </Card>
          }
          signatories={
            <OrganizationSignatoriesPanel
              key={selected.id}
              organizationId={selected.id}
              onAddContact={() => setContactForm({ mode: 'create' })}
            />
          }
          access={(view) => (
            <OrganizationUsersPanel
              key={selected.id + view}
              organizationId={selected.id}
              view={view}
            />
          )}
          operations={(view, onReviewCooperation) =>
            view === 'address' ? (
              <OrganizationAddressesPanel
                key={selected.id}
                organizationId={selected.id}
                permissions={permissions}
                presentation="selector"
              />
            ) : view === 'agreements' ||
              view === 'credit' ||
              view === 'temporary' ||
              view === 'guarantees' ? (
              <AgreementWorkflowPanel
                key={selected.id + role + view}
                organizationId={selected.id}
                role={role}
                view={view}
              />
            ) : String(selected.attributes.roleCodes ?? '').includes(
                'AGENCY',
              ) ? (
              view === 'manager' || view === 'profile' ? (
                <AgencyProfilePanel
                  key={selected.id + view}
                  organizationId={selected.id}
                  onReviewCooperation={onReviewCooperation}
                />
              ) : view === 'rates' ||
                view === 'discounts' ||
                view === 'commission' ? (
                <AgencyRatesPanel
                  key={selected.id + view}
                  organizationId={selected.id}
                  kind={
                    view === 'rates'
                      ? 'FIXED_AMOUNT'
                      : view === 'discounts'
                        ? 'DISCOUNT_PERCENT'
                        : 'COMMISSION_PERCENT'
                  }
                />
              ) : (
                <AgencyConnectionsPanel
                  key={selected.id}
                  organizationId={selected.id}
                  view={view}
                />
              )
            ) : (
              <Alert
                title="پرونده تجاری در انتظار اتصال"
                description="اطلاعات پایه و مخاطبان این مشتری سازمانی قابل مدیریت است. اتصال پروفایل عملیاتی مشتریان سازمانی هنوز آماده نیست."
              />
            )
          }
        />
      ) : null}

      {wizardOpen ? (
        <CooperationWizard
          role={role}
          permissions={permissions}
          onClose={() => setWizardOpen(false)}
          onSaved={(record) => {
            setWizardOpen(false);
            void load();
            void openProfile(record);
          }}
        />
      ) : null}
      {deleteTarget ? (
        <OrganizationDeleteDialog
          key={`${deleteTarget.resource}:${deleteTarget.record.id}`}
          target={deleteTarget}
          permissions={permissions}
          onClose={(refresh) => {
            if (refresh) void refreshAfterDeletion(deleteTarget, false);
            else setDeleteTarget(undefined);
          }}
          onDeleted={() => void refreshAfterDeletion(deleteTarget, true)}
        />
      ) : null}
      {excelOpen ? (
        <OrganizationExcelDialog
          onClose={() => setExcelOpen(false)}
          onImported={() => void load()}
        />
      ) : null}
      {contactForm && selected ? (
        <MasterDataLiveForm
          definition={getMasterDataDefinition('organization-contacts')}
          lockedFields={['organizationId']}
          initialValues={{
            organizationId: selected.id,
            ...(contactForm.mode === 'create'
              ? { preferredChannel: 'PHONE' }
              : {}),
          }}
          mode={contactForm.mode}
          onOpenChange={(open) => {
            if (!open) setContactForm(undefined);
          }}
          onPersist={persistContact}
          open
          {...(contactForm.record ? { record: contactForm.record } : {})}
        />
      ) : null}

      {formMode ? (
        <MasterDataLiveForm
          definition={getMasterDataDefinition('organizations')}
          initialValues={formMode === 'create' ? { roleCodes: role } : {}}
          mode={formMode}
          onOpenChange={(open) => {
            if (!open) {
              setFormMode(null);
              if (!profileOpen) setSelected(undefined);
            }
          }}
          onPersist={persist}
          open
          {...(formMode === 'edit' && selected ? { record: selected } : {})}
        />
      ) : null}
    </div>
  );
}
