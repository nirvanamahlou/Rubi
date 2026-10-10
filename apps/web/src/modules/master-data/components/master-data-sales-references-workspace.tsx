'use client';
import { useMasterDataColumnFilters } from './master-data-column-filters';
import {
  MasterDataDateRangeFilter,
  useMasterDataDateRange,
} from './master-data-date-range-filter';

import type {
  MasterDataRecord,
  MasterDataResource,
  MasterDataStatus,
} from '@nora/contracts';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  FilePenLine,
  FileSpreadsheet,
  Link2,
  Languages,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  UserRoundSearch,
} from 'lucide-react';
import Link from '@/i18n/link';
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
  PageHeader,
  PaginationShell,
  Skeleton,
} from '@/components/ui/surfaces';
import { masterDataApi, MasterDataApiError } from '../api/client';
import { MasterDataDeleteButton } from './master-data-delete-button';
import { MasterDataLogoCell } from './master-data-logo-cell';
import { MasterDataFilterActions } from './master-data-filter-actions';
import { MasterDataFilterBar } from './master-data-filter-bar';
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
import {
  MasterDataDetailItem,
  MasterDataDetailSection,
  MasterDataProfileIdentity,
} from './master-data-profile-details';

type RequestState = 'loading' | 'ready' | 'error' | 'forbidden';

const tabs = [
  {
    resource: 'acquaintance-methods',
    label: 'نحوه آشنایی',
    icon: UserRoundSearch,
  },
  { resource: 'sales-channels', label: 'کانال فروش', icon: Store },
] as const satisfies readonly {
  resource: MasterDataResource;
  label: string;
  icon: typeof UserRoundSearch;
}[];

type SalesReferenceResource = (typeof tabs)[number]['resource'];
export type SalesReferenceSummaryState = 'loading' | 'ready' | 'error';

export function salesReferenceExportColumns(
  fields: readonly { key: string }[],
) {
  return [
    'code',
    ...new Set(fields.map((field) => field.key)),
    'status',
    'updatedAt',
  ];
}

export function countEnglishTitles(records: readonly MasterDataRecord[]) {
  return records.filter((record) => {
    const value = record.attributes.englishName;
    return typeof value === 'string' && value.trim().length > 0;
  }).length;
}

export function hasValidSalesReferenceSummaryProgress(
  pageLength: number,
  collected: number,
  total: number,
) {
  return (
    Number.isSafeInteger(total) &&
    total >= 0 &&
    collected <= total &&
    (collected >= total || pageLength > 0)
  );
}

export function appendUniqueSalesReferenceSummaryPage(
  target: MasterDataRecord[],
  seenIds: Set<string>,
  page: readonly MasterDataRecord[],
) {
  const pageIds = page.map((record) => record.id);
  if (
    pageIds.some((id) => !id || seenIds.has(id)) ||
    new Set(pageIds).size !== pageIds.length
  )
    return false;
  for (const record of page) {
    seenIds.add(record.id);
    target.push(record);
  }
  return true;
}

export function isCurrentSalesReferenceSummaryRequest(
  requestId: number,
  currentRequestId: number,
  requestedResource: SalesReferenceResource,
  currentResource: SalesReferenceResource,
) {
  return (
    requestId === currentRequestId && requestedResource === currentResource
  );
}

export function salesReferenceKpiItems(
  resource: SalesReferenceResource,
  allRecords: readonly MasterDataRecord[],
  summaryState: SalesReferenceSummaryState,
): readonly MasterDataKpiItem[] {
  const currentTab = tabs.find((tab) => tab.resource === resource) ?? tabs[0];
  const active = allRecords.filter(
    (record) => record.status === 'active',
  ).length;
  return [
    {
      label: 'کل موارد',
      value: allRecords.length,
      icon: currentTab.icon,
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
      label: 'دارای عنوان انگلیسی',
      value: summaryState === 'ready' ? countEnglishTitles(allRecords) : '—',
      icon: Languages,
      tone: 'amber',
      hint: 'در کل اطلاعات پایه',
    },
  ];
}

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
  const [summaryState, setSummaryState] =
    useState<SalesReferenceSummaryState>('loading');
  const summaryRequestRef = useRef(0);
  const summaryResourceRef = useRef(resource);
  const [requestState, setRequestState] = useState<RequestState>('loading');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | MasterDataStatus>('active');
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

  const { columnFilters, columnFilterControls, resetColumnFilters } =
    useMasterDataColumnFilters(resource, () => setPage(1));
  const {
    filters: dateFilters,
    props: dateRangeProps,
    reset: resetDateRange,
  } = useMasterDataDateRange(() => setPage(1));

  const load = useCallback(async () => {
    setRequestState('loading');
    try {
      const response = await masterDataApi.list(resource, {
        ...columnFilters,
        ...dateFilters,
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
  }, [columnFilters, dateFilters, page, resource, search, status]);

  const loadSummary = useCallback(async () => {
    const requestId = ++summaryRequestRef.current;
    const requestedResource = resource;
    setSummaryState('loading');
    try {
      const rows: MasterDataRecord[] = [];
      const seenIds = new Set<string>();
      for (let summaryPage = 1; ; summaryPage += 1) {
        const response = await masterDataApi.list(resource, {
          search: '',
          status: 'all',
          sortBy: 'name',
          sortDirection: 'asc',
          page: summaryPage,
          pageSize: 100,
        });
        if (
          !isCurrentSalesReferenceSummaryRequest(
            requestId,
            summaryRequestRef.current,
            requestedResource,
            summaryResourceRef.current,
          )
        )
          return;
        if (
          !appendUniqueSalesReferenceSummaryPage(rows, seenIds, response.data)
        )
          throw new Error('Duplicate sales reference summary records');
        if (
          !hasValidSalesReferenceSummaryProgress(
            response.data.length,
            rows.length,
            response.meta.total,
          )
        )
          throw new Error('Invalid sales reference summary pagination');
        if (rows.length >= response.meta.total) break;
      }
      if (
        !isCurrentSalesReferenceSummaryRequest(
          requestId,
          summaryRequestRef.current,
          requestedResource,
          summaryResourceRef.current,
        )
      )
        return;
      setAllRecords(rows);
      setSummaryState('ready');
    } catch {
      if (
        !isCurrentSalesReferenceSummaryRequest(
          requestId,
          summaryRequestRef.current,
          requestedResource,
          summaryResourceRef.current,
        )
      )
        return;
      setAllRecords([]);
      setSummaryState('error');
    }
  }, [resource]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSummary(), 0);
    return () => {
      window.clearTimeout(timer);
      summaryRequestRef.current += 1;
    };
  }, [loadSummary]);

  const kpis = useMemo(
    () => salesReferenceKpiItems(resource, allRecords, summaryState),
    [allRecords, resource, summaryState],
  );

  function changeResource(next: SalesReferenceResource) {
    summaryRequestRef.current += 1;
    summaryResourceRef.current = next;
    setResource(next);
    setAllRecords([]);
    setSummaryState('loading');
    setSearch('');
    resetColumnFilters();
    setStatus('active');
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

  async function downloadExcel() {
    setExporting(true);
    try {
      const response = await masterDataApi.downloadExcel({
        resource,
        format: 'xlsx',
        filters: {
          ...columnFilters,
          ...dateFilters,
          search,
          status,
          sortBy: 'name',
          sortDirection: 'asc',
        },
        columns: salesReferenceExportColumns(definition.fields),
        locale: 'fa-IR',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      downloadFile(response.blob, response.fileName);
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
        <table
          aria-label={`فهرست ${definition.label}`}
          className="w-full min-w-[60rem] text-sm"
        >
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="p-4 text-start">ردیف</th>
              <th className="p-4 text-center">کد</th>
              <th className="p-4 text-start">لوگو</th>
              <th className="p-4 text-start">عنوان</th>
              <th className="p-4 text-start">توضیحات</th>
              <th className="p-4 text-start">وضعیت</th>
              <th className="p-4 text-center">عملیات</th>
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
                <td className="p-4 text-center font-mono text-xs" dir="ltr">
                  {record.code}
                </td>
                <MasterDataLogoCell record={record} />
                <td className="p-4">
                  <button
                    className="flex items-center gap-2 font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => openProfile(record)}
                    type="button"
                  >
                    {record.name}
                  </button>
                </td>
                <td className="max-w-64 p-4 text-muted-foreground">
                  {attribute(record, 'description')}
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
                <td className="p-4 text-center">
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      aria-label={`مشاهده ${record.name}`}
                      onClick={() => openProfile(record)}
                      size="icon"
                      title={`مشاهده ${record.name}`}
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
                      title={`ویرایش ${record.name}`}
                      variant="outline"
                    >
                      <FilePenLine className="size-4" />
                    </Button>
                    <MasterDataDeleteButton
                      record={record}
                      onDeleted={afterDelete}
                    />
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
            className={`${buttonVariants({ variant: 'outline' })} ms-auto`}
            href="/master-data"
          >
            <ArrowRight className="size-4" /> همه بخش‌ها
          </Link>
        }
        title={definition.label}
      />
      <div className="flex w-full flex-wrap justify-end gap-2">
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
      <MasterDataFilterBar>
        {columnFilterControls}
        <MasterDataDateRangeFilter
          idPrefix="sales-references-created"
          {...dateRangeProps}
        />
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
        <MasterDataFilterActions
          onClear={() => {
            setSearch('');
            resetColumnFilters();
            resetDateRange();
            setStatus('active');
            setPage(1);
          }}
          onRefresh={() => void Promise.all([load(), loadSummary()])}
        />
      </MasterDataFilterBar>
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
          onOpenChange={setProfileOpen}
          open={profileOpen}
          title={`پروفایل ${definition.singularLabel}`}
        >
          <div className="space-y-4">
            <MasterDataProfileIdentity
              eyebrow={`پروفایل ${definition.singularLabel}`}
              record={selected}
              title={selected.name}
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <MasterDataDetailSection title="مشخصات مرجع">
                <MasterDataDetailItem
                  label="عنوان انگلیسی"
                  ltr
                  value={attribute(selected, 'englishName')}
                />
                <MasterDataDetailItem
                  label="ترتیب نمایش"
                  value={attribute(selected, 'displayOrder', '0')}
                />
                <MasterDataDetailItem
                  label="توضیحات"
                  value={attribute(selected, 'description')}
                />
              </MasterDataDetailSection>
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
import { downloadFile } from '../api/download-file';
