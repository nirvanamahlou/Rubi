'use client';

import type {
  MasterDataListQuery,
  MasterDataRecord,
  MasterDataResource,
  MasterDataStatus,
} from '@rubi/contracts';
import {
  ArrowRight,
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
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

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
import {
  getMasterDataDefinition,
  type MasterDataResourceKey,
} from '../model/catalog';
import type { MasterDataSectionDefinition } from '../model/sections';
import {
  MasterDataLiveForm,
  type MasterDataFormMode,
} from './master-data-live-form';
import { HotelImportPanel } from './hotel-import-panel';
import { MasterDataAccommodationWorkspace } from './master-data-accommodation-workspace';
import { MasterDataFinanceWorkspace } from './master-data-finance-workspace';
import { MasterDataGeographyWorkspace } from './master-data-geography-workspace';
import { MasterDataInsuranceWorkspace } from './master-data-insurance-workspace';
import { MasterDataKpiGrid } from './master-data-kpi-grid';
import { MasterDataSuppliersWorkspace } from './master-data-suppliers-workspace';
import { MasterDataTransportationWorkspace } from './master-data-transportation-workspace';
import { MasterDataSalesReferencesWorkspace } from './master-data-sales-references-workspace';
import { MasterDataTravelServicesWorkspace } from './master-data-travel-services-workspace';

type RequestState = 'loading' | 'ready' | 'error' | 'forbidden';

function GenericMasterDataWorkspace({
  section,
}: {
  section: MasterDataSectionDefinition;
}) {
  const [resource, setResource] = useState<MasterDataResourceKey>(
    section.resources[0] ?? 'currencies',
  );
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
  const [exportingExcel, setExportingExcel] = useState(false);
  const definition = getMasterDataDefinition(resource);
  const sectionDefinitions = section.resources.map(getMasterDataDefinition);
  const isCountryCity = resource === 'countries' || resource === 'cities';
  const activeCount = records.filter(
    (record) => record.status === 'active',
  ).length;

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
    if (!section.resources.includes(next)) return;
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
    const input = {
      resource,
      format,
      filters: {
        search: query.search,
        status: query.status,
        sortBy: query.sortBy,
        sortDirection: query.sortDirection,
      },
      columns: Array.from(
        new Set([
          'code',
          'name',
          ...definition.fields.map((field) => field.key),
          'status',
          'updatedAt',
        ]),
      ),
      locale: 'fa-IR' as const,
      timezone:
        Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tehran',
    };
    if (format === 'xlsx') setExportingExcel(true);
    try {
      if (format === 'xlsx') {
        const file = await masterDataApi.downloadExcel(input);
        const url = window.URL.createObjectURL(file.blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = file.fileName;
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
        setNotice(`فایل Excel ${definition.label} با موفقیت دانلود شد.`);
        return;
      }
      const response = await masterDataApi.export(input);
      setNotice(
        `درخواست خروجی PDF ثبت شد (${response.data.status}). تولید فایل منتظر Documents/Worker است.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'دریافت خروجی ناموفق بود.',
      );
    } finally {
      if (format === 'xlsx') setExportingExcel(false);
    }
  }

  function renderResourceActions() {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          loading={exportingExcel}
          onClick={() => void requestExport('xlsx')}
          variant="outline"
        >
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
        actions={
          <Link
            className={buttonVariants({ variant: 'outline' })}
            href="/master-data"
          >
            <ArrowRight aria-hidden="true" className="size-4" />
            همه بخش‌ها
          </Link>
        }
        description={section.description}
        eyebrow="اطلاعات پایه"
        title={section.title}
      />

      {notice ? <Alert description={notice} title="نتیجه عملیات" /> : null}

      <div className="space-y-5">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center gap-2 border-b border-border px-2 pb-3">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Database aria-hidden="true" className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-black">
                زیرمجموعه‌های {section.title}
              </h2>
              <p className="text-xs text-muted-foreground">
                {section.resources.length.toLocaleString('fa-IR')} منبع مرجع ·
                مشترک بین شرکت‌ها · بدون فیلتر Legal Entity
              </p>
            </div>
          </div>
          <nav
            aria-label={`زیرمجموعه‌های ${section.title}`}
            className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-2"
          >
            {sectionDefinitions
              .filter((item) => item.key !== 'cities')
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
                  className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-start text-sm font-semibold text-muted-foreground transition hover:border-primary/30 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
                  key={item.key}
                  onClick={() => changeResource(item.key)}
                  type="button"
                >
                  {item.key === 'countries' ? 'کشورها و شهرها' : item.label}
                </button>
              ))}
          </nav>
        </Card>

        <main className="min-w-0 space-y-4">
          <Card className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-black">{definition.label}</h2>
                  <Badge>{section.title}</Badge>
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

          <MasterDataKpiGrid
            items={[
              {
                label: `کل ${definition.label}`,
                value: total,
                icon: Database,
                tone: 'sky',
              },
              {
                label: 'فعال در صفحه',
                value: activeCount,
                icon: CheckCircle2,
                tone: 'emerald',
              },
              {
                label: 'غیرفعال در صفحه',
                value: records.length - activeCount,
                icon: XCircle,
                tone: 'rose',
              },
              {
                label: 'نسخه قرارداد',
                value: 'v6',
                icon: FileText,
                tone: 'violet',
              },
            ]}
            label={`شاخص‌های ${definition.label}`}
          />

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

export function MasterDataWorkspace({
  section,
}: {
  section: MasterDataSectionDefinition;
}) {
  if (section.slug === 'finance')
    return <MasterDataFinanceWorkspace section={section} />;
  if (section.slug === 'geography')
    return <MasterDataGeographyWorkspace section={section} />;
  if (section.slug === 'organizations-suppliers')
    return <MasterDataSuppliersWorkspace />;
  if (section.slug === 'accommodation')
    return <MasterDataAccommodationWorkspace />;
  if (section.slug === 'transportation')
    return <MasterDataTransportationWorkspace />;
  if (section.slug === 'insurance') return <MasterDataInsuranceWorkspace />;
  if (section.slug === 'tours-travel-services')
    return <MasterDataTravelServicesWorkspace />;
  if (section.slug === 'sales-references')
    return <MasterDataSalesReferencesWorkspace />;
  return <GenericMasterDataWorkspace section={section} />;
}
