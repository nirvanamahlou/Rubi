'use client';

import type {
  IamPermissionCode,
  MasterDataRecord,
  MasterDataStatus,
  MasterDataSortField,
} from '@rubi/contracts';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldX,
  Users,
  TriangleAlert,
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
import { cooperationLabel } from '../model/presentation';
import { CorporateMetric, CorporateProfile } from './corporate-profile';
import './corporate-design.css';

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
  const [contacts, setContacts] = useState<readonly MasterDataRecord[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | MasterDataStatus>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<RequestState>('loading');
  const [selected, setSelected] = useState<MasterDataRecord>();
  const [profileOpen, setProfileOpen] = useState(false);
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
        if (!cancelled) setPermissions(user.permissions);
      })
      .catch(() => {
        if (!cancelled) setPermissions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    const roleCodes = new Set(
      (values.roleCodes ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    );
    if (!roleCodes.has('AGENCY') && !roleCodes.has('CORPORATE_CUSTOMER'))
      roleCodes.add(role);
    const result = await masterDataApi.persistWithLogo({
      resource: 'organizations',
      values: { ...values, roleCodes: [...roleCodes].join(',') },
      title: `لوگوی سازمان ${values.legalName ?? selected?.name ?? ''}`.trim(),
      ...(formMode === 'edit' && selected ? { existing: selected } : {}),
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

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
        <div className="crumb">
          خانه <span>‹</span> آژانس‌ها و مشتریان سازمانی
        </div>
        <div className="page-head">
          <div className="title">
            <h1>آژانس‌ها و مشتریان سازمانی</h1>
            <p>
              مدیریت یکپارچه پرونده همکاری B2B، قرارداد، اعتبار، شرایط تجاری و
              نمای عملیات
            </p>
          </div>
          <div className="actions">
            <button
              className="btn"
              disabled
              title="خروجی مجاز سازمان‌ها هنوز در دسترس نیست"
            >
              خروجی مجاز
            </button>
            <button
              className="btn primary"
              disabled={!permissions.includes('master_data.create')}
              onClick={() => {
                setSelected(undefined);
                setFormMode('create');
              }}
            >
              <Plus size={18} />
              همکاری جدید
            </button>
          </div>
        </div>
        <section className="kpis">
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
            icon={Users}
            tone="purple"
            note="آمار کل در دسترس نیست"
          />
          <CorporateMetric
            label="مشتری سازمانی"
            icon={Building2}
            tone="green"
            note="آمار کل در دسترس نیست"
          />
          <CorporateMetric
            label="نیازمند اقدام"
            icon={TriangleAlert}
            tone="amber"
            note="در انتظار اتصال"
          />
        </section>

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
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void openProfile(record)}
                    >
                      مشاهده پرونده
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!permissions.includes('master_data.update')}
                      onClick={() => {
                        setSelected(record);
                        setFormMode('edit');
                      }}
                    >
                      ویرایش
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
                            <small>شناسه ملی در دسترس نیست</small>
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
                      <td className="unavailable-value">در دسترس نیست</td>
                      <td className="unavailable-value">در دسترس نیست</td>
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
                        <div className="flex gap-2">
                          <Button
                            onClick={() => void openProfile(record)}
                            size="sm"
                            variant="outline"
                          >
                            <Eye className="size-4" /> مشاهده پرونده
                          </Button>
                          <Button
                            disabled={
                              !permissions.includes('master_data.update')
                            }
                            onClick={() => {
                              setSelected(record);
                              setFormMode('edit');
                            }}
                            size="sm"
                            variant="outline"
                          >
                            <Pencil className="size-4" /> ویرایش
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
          onClose={() => {
            ++contactRequestId.current;
            setProfileOpen(false);
            setSelected(undefined);
            setContactForm(undefined);
          }}
          canEdit={permissions.includes('master_data.update')}
          onEdit={() => setFormMode('edit')}
          contacts={
            <Card className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">تماس‌های سازمان</p>
                <Button
                  size="sm"
                  disabled={!permissions.includes('master_data.create')}
                  onClick={() => setContactForm({ mode: 'create' })}
                >
                  افزودن مخاطب
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
                    className="grid gap-1 rounded-xl border p-3 sm:grid-cols-3"
                    key={contact.id}
                  >
                    <span className="font-semibold">{contact.name}</span>
                    <span dir="ltr">{attribute(contact, 'phoneMasked')}</span>
                    <span dir="ltr">{attribute(contact, 'emailMasked')}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!permissions.includes('master_data.update')}
                      onClick={() =>
                        setContactForm({ mode: 'edit', record: contact })
                      }
                    >
                      ویرایش مخاطب
                    </Button>
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
          operations={(view) =>
            String(selected.attributes.roleCodes ?? '').includes('AGENCY') ? (
              <AgencyConnectionsPanel
                key={selected.id}
                organizationId={selected.id}
                view={view}
              />
            ) : (
              <Alert
                title="پرونده تجاری در انتظار اتصال"
                description="اطلاعات پایه و مخاطبان این مشتری سازمانی قابل مدیریت است. اتصال پروفایل عملیاتی مشتریان سازمانی هنوز آماده نیست."
              />
            )
          }
        />
      ) : null}

      {contactForm && selected ? (
        <MasterDataLiveForm
          definition={getMasterDataDefinition('organization-contacts')}
          lockedFields={['organizationId']}
          initialValues={{ organizationId: selected.id }}
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
