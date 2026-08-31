'use client';

import type {
  MasterDataRecord,
  MasterDataResource,
  MasterDataStatus,
} from '@rubi/contracts';
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  CircleX,
  Database,
  Eye,
  FilePenLine,
  FileSpreadsheet,
  FilterX,
  Link2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  Tags,
  UserRoundSearch,
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
  {
    resource: 'acquaintance-methods',
    label: 'نحوه آشنایی',
    icon: UserRoundSearch,
  },
  { resource: 'sales-channels', label: 'کانال فروش', icon: Store },
  { resource: 'lost-reasons', label: 'دلیل از دست رفتن', icon: CircleX },
  { resource: 'tags', label: 'Tag', icon: Tags },
] as const satisfies readonly {
  resource: MasterDataResource;
  label: string;
  icon: typeof Database;
}[];

type SalesReferenceResource = (typeof tabs)[number]['resource'];

const rules: Record<SalesReferenceResource, { title: string; text: string }> = {
  'acquaintance-methods': {
    title: 'نحوه آشنایی یک مرجع مستقل است',
    text: 'این مرجع فقط روش آشنایی را تعریف می‌کند؛ رابطه استفاده در ماژول مصرف‌کننده نگهداری می‌شود و این صفحه به جدول آن ماژول Query مستقیم ندارد.',
  },
  'sales-channels': {
    title: 'کانال استفاده‌شده حذف فیزیکی نمی‌شود',
    text: 'کانال مرجع با Active/Inactive مدیریت می‌شود؛ سفارش و تراکنش فروش در Sales باقی می‌ماند.',
  },
  'lost-reasons': {
    title: 'دلیل از دست رفتن برای پایان ناموفق است',
    text: 'تغییر وضعیت Lead/Opportunity و الزام انتخاب دلیل در ماژول مالک چرخه فروش اجرا می‌شود.',
  },
  tags: {
    title: 'Tag رابطه چندبه‌چند مصرف‌کننده است',
    text: 'هر ماژول مالک رابطه Tag با رکوردهای خودش است و Master Data فقط تعریف، رنگ و وضعیت Tag را نگه می‌دارد.',
  },
};

function attribute(record: MasterDataRecord, key: string, fallback = '—') {
  const value = record.attributes[key];
  return value === null || value === undefined || value === ''
    ? fallback
    : String(value);
}

export function MasterDataSalesReferencesWorkspace() {
  const [resource, setResource] = useState<SalesReferenceResource>(
    'acquaintance-methods',
  );
  const [records, setRecords] = useState<readonly MasterDataRecord[]>([]);
  const [allRecords, setAllRecords] = useState<readonly MasterDataRecord[]>([]);
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
  }, [page, resource, search, status]);

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
    const needsReview = allRecords.filter(
      (record) =>
        !record.attributes.englishName || !record.attributes.description,
    ).length;
    return [
      {
        label: 'کل موارد',
        value: allRecords.length,
        icon: CurrentIcon,
        tone: 'sky',
      },
      { label: 'فعال', value: active, icon: CheckCircle2, tone: 'emerald' },
      {
        label: 'استفاده‌شده',
        value: '—',
        icon: Link2,
        tone: 'violet',
        hint: 'در انتظار قرارداد Aggregate ماژول مصرف‌کننده',
      },
      {
        label: 'نیازمند بازبینی',
        value: needsReview,
        icon: CircleAlert,
        tone: 'amber',
      },
    ];
  }, [CurrentIcon, allRecords]);

  function changeResource(next: SalesReferenceResource) {
    setResource(next);
    setSearch('');
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
        description="دریافت مراجع فروش از Backend ناموفق بود."
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
        icon={CurrentIcon}
        title={`${definition.label} خالی است`}
      />
    ) : (
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[60rem] text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="p-4 text-start">ردیف</th>
              <th className="p-4 text-start">کد</th>
              <th className="p-4 text-start">عنوان</th>
              <th className="p-4 text-start">توضیحات</th>
              <th className="p-4 text-start">ترتیب نمایش</th>
              <th className="p-4 text-start">استفاده در رکوردها</th>
              <th className="p-4 text-start">آخرین تغییر</th>
              <th className="p-4 text-start">وضعیت</th>
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
                    className="flex items-center gap-2 font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => openProfile(record)}
                    type="button"
                  >
                    {resource === 'tags' &&
                    /^#[0-9A-F]{6}$/.test(attribute(record, 'colorHex', '')) ? (
                      <span
                        aria-hidden="true"
                        className="size-3 rounded-full border border-border"
                        style={{
                          backgroundColor: attribute(record, 'colorHex'),
                        }}
                      />
                    ) : null}
                    {record.name}
                  </button>
                </td>
                <td className="max-w-64 p-4 text-muted-foreground">
                  {attribute(record, 'description')}
                </td>
                <td className="p-4">
                  {Number(
                    attribute(record, 'displayOrder', '0'),
                  ).toLocaleString('fa-IR')}
                </td>
                <td className="p-4 text-muted-foreground">—</td>
                <td className="p-4">
                  {new Date(record.updatedAt).toLocaleString('fa-IR')}
                </td>
                <td className="p-4">
                  <Badge
                    className={
                      record.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                        : 'bg-muted text-muted-foreground'
                    }
                  >
                    {record.status === 'active' ? 'فعال' : 'غیرفعال'}
                  </Badge>
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
                    <MasterDataDeleteButton
                      record={record}
                      onDeleted={afterDelete}
                    />
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
          aria-label="زیرمجموعه‌های مراجع فروش"
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
      <FilterBar className="grid sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1fr)_12rem_auto]">
        <FormField id="sales-reference-search" label="جست‌وجو">
          <div className="relative">
            <Search className="absolute end-3 top-3.5 size-4 text-muted-foreground" />
            <Input
              className="pe-10"
              id="sales-reference-search"
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
              <div className="grid gap-5 bg-gradient-to-l from-purple-50 via-background to-rose-50 p-6 dark:from-purple-950/30 dark:to-rose-950/30 md:grid-cols-[6rem_1fr_auto]">
                <span className="grid size-24 place-items-center rounded-3xl bg-purple-100 text-purple-700 dark:bg-purple-400/15 dark:text-purple-300">
                  <CurrentIcon className="size-11" />
                </span>
                <div>
                  <h2 className="text-2xl font-black">{selected.name}</h2>
                  <p className="mt-1 text-muted-foreground" dir="ltr">
                    {selected.code} · {attribute(selected, 'englishName')}
                  </p>
                  <Badge className="mt-3">
                    {selected.status === 'active' ? 'فعال' : 'غیرفعال'}
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
                  <div className="border-b border-border/70 pb-3">
                    <dt className="text-xs text-muted-foreground">
                      عنوان فارسی
                    </dt>
                    <dd className="mt-1 font-semibold">{selected.name}</dd>
                  </div>
                  <div className="border-b border-border/70 pb-3">
                    <dt className="text-xs text-muted-foreground">
                      عنوان انگلیسی
                    </dt>
                    <dd className="mt-1 font-semibold">
                      {attribute(selected, 'englishName')}
                    </dd>
                  </div>
                  <div className="border-b border-border/70 pb-3">
                    <dt className="text-xs text-muted-foreground">
                      ترتیب نمایش
                    </dt>
                    <dd className="mt-1 font-semibold">
                      {attribute(selected, 'displayOrder', '0')}
                    </dd>
                  </div>
                  {resource === 'tags' ? (
                    <div className="border-b border-border/70 pb-3">
                      <dt className="text-xs text-muted-foreground">رنگ</dt>
                      <dd className="mt-1 font-semibold" dir="ltr">
                        {attribute(selected, 'colorHex')}
                      </dd>
                    </div>
                  ) : null}
                  <div className="border-b border-border/70 pb-3 sm:col-span-2">
                    <dt className="text-xs text-muted-foreground">توضیحات</dt>
                    <dd className="mt-1 font-semibold">
                      {attribute(selected, 'description')}
                    </dd>
                  </div>
                </dl>
              </Card>
              <Card className="p-5">
                <h3 className="mb-4 flex items-center gap-2 font-black">
                  <ShieldCheck className="size-5" /> مصرف در ماژول‌های مالک
                </h3>
                <EmptyState
                  description="تعداد و روابط استفاده پس از قرارداد عمومی همان ماژول نمایش داده می‌شود؛ Query مستقیم به Customers، Sales، Customer Affairs یا Marketing انجام نمی‌شود."
                  icon={Link2}
                  title="در انتظار قرارداد Aggregate"
                />
              </Card>
            </div>
          </div>
        </MasterDataProfileDialog>
      ) : null}
    </div>
  );
}
