'use client';

import type {
  MasterDataListQuery,
  MasterDataRecord,
  MasterDataResource,
  MasterDataStatus,
} from '@rubi/contracts';
import {
  Ban,
  CheckCircle2,
  Database,
  Eye,
  FilePenLine,
  FileSpreadsheet,
  FileText,
  FilterX,
  Plus,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
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
import {
  getMasterDataDefinition,
  masterDataCatalog,
  type MasterDataResourceKey,
} from '../model/catalog';
import {
  MasterDataLiveForm,
  type MasterDataFormMode,
} from './master-data-live-form';
import { HotelImportPanel } from './hotel-import-panel';

const groups = ['مالی', 'جغرافیا', 'خدمات سفر', 'سازمان‌ها', 'فروش'] as const;
type RequestState = 'loading' | 'ready' | 'error' | 'forbidden';

export function MasterDataWorkspace() {
  const [resource, setResource] = useState<MasterDataResourceKey>('currencies');
  const [records, setRecords] = useState<readonly MasterDataRecord[]>([]);
  const [requestState, setRequestState] = useState<RequestState>('loading');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | MasterDataStatus>('all');
  const [sortBy, setSortBy] = useState<'name' | 'code' | 'updatedAt'>('name');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [formMode, setFormMode] = useState<MasterDataFormMode | null>(null);
  const [selected, setSelected] = useState<MasterDataRecord | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  const definition = getMasterDataDefinition(resource);
  const isCountryCity = resource === 'countries' || resource === 'cities';

  const query: MasterDataListQuery = {
    search,
    status,
    sortBy,
    sortDirection: 'asc',
    page,
    pageSize: 25,
  };

  const load = useCallback(async () => {
    setRequestState('loading');
    try {
      const response = await masterDataApi.list(
        resource as MasterDataResource,
        {
          search,
          status,
          sortBy,
          sortDirection: 'asc',
          page,
          pageSize: 25,
        },
      );
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
  }, [page, resource, search, sortBy, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  function changeResource(next: MasterDataResourceKey) {
    setResource(next);
    setSearch('');
    setStatus('all');
    setSortBy('name');
    setPage(1);
    setSelected(undefined);
    setNotice(null);
  }

  function openForm(mode: MasterDataFormMode, record?: MasterDataRecord) {
    setSelected(record);
    setFormMode(mode);
  }

  function openCountryCityForm(next: 'countries' | 'cities') {
    changeResource(next);
    setFormMode('create');
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
    await load();
  }

  async function toggle(record: MasterDataRecord) {
    try {
      const next: MasterDataStatus =
        record.status === 'active' ? 'inactive' : 'active';
      await masterDataApi.setStatus(resource, record.id, next, record.version);
      setNotice(
        `${definition.singularLabel} ${next === 'active' ? 'فعال' : 'غیرفعال'} شد.`,
      );
      await load();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'تغییر وضعیت ناموفق بود.',
      );
    }
  }

  async function decideRate(
    record: MasterDataRecord,
    action: 'approve' | 'reject',
  ) {
    const reason = window.prompt(
      action === 'approve'
        ? 'دلیل تأیید نرخ را وارد کنید:'
        : 'دلیل رد نرخ را وارد کنید:',
    );
    if (!reason?.trim()) return;
    try {
      await masterDataApi.decideCurrencyRate(
        record.id,
        action,
        record.version,
        reason.trim(),
      );
      setNotice(action === 'approve' ? 'نرخ تأیید شد.' : 'نرخ رد شد.');
      await load();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'تصمیم نرخ ناموفق بود.',
      );
    }
  }
  async function requestExport(format: 'xlsx' | 'pdf') {
    try {
      const response = await masterDataApi.export({
        resource,
        format,
        filters: {
          search: query.search,
          status: query.status,
          sortBy: query.sortBy,
          sortDirection: query.sortDirection,
        },
        columns: ['code', 'name', 'status', 'updatedAt'],
        locale: 'fa-IR',
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tehran',
      });
      setNotice(
        `درخواست خروجی ثبت شد (${response.data.status}). تولید artifact منتظر Documents/Worker است.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'ثبت خروجی ناموفق بود.',
      );
    }
  }

  function renderResourceActions() {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void requestExport('xlsx')} variant="outline">
          <FileSpreadsheet aria-hidden="true" className="size-4" />
          Excel
        </Button>
        <Button onClick={() => void requestExport('pdf')} variant="outline">
          <FileText aria-hidden="true" className="size-4" />
          PDF
        </Button>
        {isCountryCity ? (
          <>
            <Button onClick={() => openCountryCityForm('countries')}>
              <Plus aria-hidden="true" className="size-4" />
              ایجاد کشور
            </Button>
            <Button
              onClick={() => openCountryCityForm('cities')}
              variant="outline"
            >
              <Plus aria-hidden="true" className="size-4" />
              ایجاد شهر
            </Button>
          </>
        ) : (
          <Button onClick={() => openForm('create')}>
            <Plus aria-hidden="true" className="size-4" />
            ایجاد {definition.singularLabel}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        description="مدیریت پایدار Reference Data و Organizationهای مشترک با کنترل دسترسی، Audit و نسخه رکورد."
        eyebrow="MASTER-003 · PC-B"
        title="اطلاعات پایه"
      />

      <Alert
        description="نرخ ارز با گردش Draft، تأیید یا رد، Maker/Checker و تاریخچه واقعی مدیریت می‌شود و همچنان برای ثبت مالی authoritative نیست. خروجی تا آماده‌شدن Documents/Worker در وضعیت انتظار می‌ماند."
        title="Persistence فعال · محدودیت‌های دامنه محفوظ"
      />
      {notice ? <Alert description={notice} title="نتیجه عملیات" /> : null}

      <div className="space-y-5">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 border-b border-border px-2 pb-3">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Database aria-hidden="true" className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-black">Catalog اطلاعات پایه</h2>
              <p className="text-xs text-muted-foreground">
                ۱۱ بخش · ۱۲ منبع پایدار · مشترک بین شرکت‌ها
              </p>
            </div>
          </div>
          <nav
            aria-label="دسته‌های اطلاعات پایه"
            className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
          >
            {groups.map((group) => (
              <section
                className="rounded-xl border border-border/70 bg-muted/20 p-2"
                key={group}
              >
                <h3 className="px-2 py-1 text-[11px] font-bold text-muted-foreground">
                  {group}
                </h3>
                <div className="mt-1 grid gap-1">
                  {masterDataCatalog
                    .filter(
                      (item) => item.group === group && item.key !== 'cities',
                    )
                    .map((item) => (
                      <button
                        aria-current={
                          item.key === 'countries'
                            ? isCountryCity
                              ? 'page'
                              : undefined
                            : item.key === resource
                              ? 'page'
                              : undefined
                        }
                        className="rounded-lg px-3 py-2 text-start text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
                        key={item.key}
                        onClick={() => changeResource(item.key)}
                        type="button"
                      >
                        {item.key === 'countries'
                          ? 'کشورها و شهرها'
                          : item.label}
                      </button>
                    ))}
                </div>
              </section>
            ))}
          </nav>
        </Card>

        <main className="min-w-0 space-y-4">
          <Card className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-black">
                    {isCountryCity ? 'کشورها و شهرها' : definition.label}
                  </h2>
                  <Badge>{definition.group}</Badge>
                  <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                    Backend واقعی
                  </Badge>
                </div>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {isCountryCity
                    ? 'کشورها و شهرهای وابسته در یک بخش مدیریت می‌شوند؛ هر شهر هنگام ثبت به کشور مرجع متصل می‌شود.'
                    : definition.description}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:items-end">
                {isCountryCity ? (
                  <div
                    aria-label="انتخاب فهرست جغرافیا"
                    className="flex rounded-xl bg-muted p-1"
                    role="group"
                  >
                    <Button
                      aria-pressed={resource === 'countries'}
                      onClick={() => changeResource('countries')}
                      size="sm"
                      variant={resource === 'countries' ? 'secondary' : 'ghost'}
                    >
                      کشورها
                    </Button>
                    <Button
                      aria-pressed={resource === 'cities'}
                      onClick={() => changeResource('cities')}
                      size="sm"
                      variant={resource === 'cities' ? 'secondary' : 'ghost'}
                    >
                      شهرها
                    </Button>
                  </div>
                ) : null}
                {renderResourceActions()}
              </div>
            </div>
          </Card>
          {resource === 'hotels' ? (
            <HotelImportPanel onImported={() => void load()} />
          ) : null}

          <FilterBar className="grid sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1fr)_12rem_12rem_auto]">
            <FormField id="master-data-search-live" label="جست‌وجوی سریع">
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="absolute end-3 top-3.5 size-4 text-muted-foreground"
                />
                <Input
                  className="pe-10"
                  id="master-data-search-live"
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
            <FormField label="مرتب‌سازی">
              <Select
                onValueChange={(value) => setSortBy(value as typeof sortBy)}
                value={sortBy}
              >
                <SelectTrigger aria-label="مرتب‌سازی">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">عنوان</SelectItem>
                  <SelectItem value="code">کد سیستمی</SelectItem>
                  <SelectItem value="updatedAt">آخرین تغییر</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <Button
              onClick={() => {
                setSearch('');
                setStatus('all');
                setSortBy('name');
                setPage(1);
              }}
              variant="ghost"
            >
              <FilterX aria-hidden="true" className="size-4" />
              پاک‌کردن
            </Button>
          </FilterBar>

          {requestState === 'loading' ? (
            <div
              aria-label="در حال بارگذاری"
              aria-live="polite"
              className="space-y-3"
            >
              {[0, 1, 2].map((item) => (
                <Skeleton className="h-16 w-full" key={item} />
              ))}
            </div>
          ) : requestState === 'forbidden' ? (
            <EmptyState
              description="مجوز master_data.read برای مشاهده این صفحه لازم است."
              icon={Ban}
              title="دسترسی اطلاعات پایه وجود ندارد"
            />
          ) : requestState === 'error' ? (
            <ErrorState
              action={
                <Button onClick={() => void load()} size="sm" variant="outline">
                  <RefreshCw aria-hidden="true" className="size-4" />
                  تلاش دوباره
                </Button>
              }
              description="اتصال به Backend ناموفق بود. Session و تنظیم NEXT_PUBLIC_API_BASE_URL را بررسی کنید."
              title="دریافت اطلاعات پایه ناموفق بود"
            />
          ) : records.length === 0 ? (
            <EmptyState
              action={
                <Button onClick={() => openForm('create')} size="sm">
                  ایجاد {definition.singularLabel}
                </Button>
              }
              description="با فیلتر فعلی رکوردی پیدا نشد."
              title={`${definition.label} خالی است`}
            />
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="p-4 text-start">کد سیستمی</th>
                    <th className="p-4 text-start">عنوان</th>
                    <th className="p-4 text-start">وضعیت</th>
                    <th className="p-4 text-start">آخرین تغییر</th>
                    <th className="p-4 text-start">عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr className="border-t border-border" key={record.id}>
                      <td className="p-4 font-mono text-xs" dir="ltr">
                        {record.code}
                      </td>
                      <td className="p-4 font-semibold">{record.name}</td>
                      <td className="p-4">
                        <Badge
                          className={
                            record.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-700'
                              : 'bg-muted text-muted-foreground'
                          }
                        >
                          {record.status === 'active' ? 'فعال' : 'غیرفعال'}
                        </Badge>
                      </td>
                      <td className="p-4">
                        {new Date(record.updatedAt).toLocaleString('fa-IR')}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={() => openForm('view', record)}
                            size="sm"
                            variant="outline"
                          >
                            <Eye aria-hidden="true" className="size-4" />
                            مشاهده
                          </Button>
                          <Button
                            onClick={() => openForm('edit', record)}
                            size="sm"
                            variant="outline"
                          >
                            <FilePenLine
                              aria-hidden="true"
                              className="size-4"
                            />
                            ویرایش
                          </Button>
                          <Button
                            onClick={() => void toggle(record)}
                            size="sm"
                            variant="ghost"
                          >
                            {record.status === 'active'
                              ? 'غیرفعال‌سازی'
                              : 'فعال‌سازی'}
                          </Button>{' '}
                          {resource === 'exchange-rates' &&
                          record.attributes.status === 'DRAFT' ? (
                            <>
                              <Button
                                onClick={() =>
                                  void decideRate(record, 'approve')
                                }
                                size="sm"
                                variant="outline"
                              >
                                <CheckCircle2
                                  aria-hidden="true"
                                  className="size-4"
                                />
                                تأیید
                              </Button>
                              <Button
                                onClick={() =>
                                  void decideRate(record, 'reject')
                                }
                                size="sm"
                                variant="ghost"
                              >
                                <XCircle
                                  aria-hidden="true"
                                  className="size-4"
                                />
                                رد
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

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
        </main>
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
          {...(selected ? { record: selected } : {})}
        />
      ) : null}
    </div>
  );
}
