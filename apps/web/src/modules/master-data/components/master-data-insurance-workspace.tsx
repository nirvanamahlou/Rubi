'use client';
import { useMasterDataColumnFilters } from './master-data-column-filters';
import {
  MasterDataDateRangeFilter,
  useMasterDataDateRange,
} from './master-data-date-range-filter';

import type {
  MasterDataListQuery,
  MasterDataRecord,
  MasterDataResource,
  MasterDataStatus,
  MasterInsuranceSummary,
} from '@nora/contracts';
import {
  ArrowRight,
  Banknote,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Eye,
  FilePenLine,
  FileSpreadsheet,
  Globe2,
  Link2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldPlus,
  Umbrella,
} from 'lucide-react';
import Link from 'next/link';
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

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
import {
  masterDataApi,
  MasterDataApiError,
  type MasterDataLogoChange,
} from '../api/client';
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
type InsuranceRelationSummaryState = 'loading' | 'ready' | 'error';

export const INSURER_PLAN_PAGE_SIZE = 10;

export function countRecordsLinkedToPlans(
  records: readonly MasterDataRecord[],
): number | null {
  let linked = 0;
  for (const record of records) {
    const count = record.attributes?.planCount;
    if (!Number.isSafeInteger(count) || Number(count) < 0) return null;
    if (Number(count) > 0) linked += 1;
  }
  return linked;
}

export function insuranceKpiItems(
  resource: InsuranceResource,
  summary: MasterInsuranceSummary | undefined,
  relationRecords: readonly MasterDataRecord[],
  relationState: InsuranceRelationSummaryState,
): readonly MasterDataKpiItem[] {
  const relationValue =
    relationState === 'ready'
      ? (countRecordsLinkedToPlans(relationRecords) ?? '—')
      : '—';
  if (resource === 'insurers')
    return [
      {
        label: 'کل شرکت‌ها',
        value: summary?.insurers.total ?? '—',
        icon: Building2,
        tone: 'sky',
      },
      {
        label: 'فعال',
        value: summary?.insurers.active ?? '—',
        icon: CheckCircle2,
        tone: 'emerald',
      },
      {
        label: 'کشورهای تحت پوشش',
        value: summary?.insurers.countries ?? '—',
        icon: Globe2,
        tone: 'violet',
      },
      {
        label: 'دارای طرح بیمه',
        value: relationValue,
        icon: ShieldCheck,
        tone: 'amber',
      },
    ];
  if (resource === 'insurance-plans')
    return [
      {
        label: 'کل طرح‌ها',
        value: summary?.plans.total ?? '—',
        icon: ShieldCheck,
        tone: 'sky',
      },
      {
        label: 'فعال',
        value: summary?.plans.active ?? '—',
        icon: CheckCircle2,
        tone: 'emerald',
      },
      {
        label: 'در حال انقضا',
        value: summary?.plans.expiringSoon ?? '—',
        icon: CalendarClock,
        tone: 'amber',
      },
      {
        label: 'مناطق مقصد',
        value: summary?.plans.destinations ?? '—',
        icon: Globe2,
        tone: 'violet',
      },
    ];
  return [
    {
      label: 'کل پوشش‌ها',
      value: summary?.coverages.total ?? '—',
      icon: ShieldPlus,
      tone: 'sky',
    },
    {
      label: 'فعال',
      value: summary?.coverages.active ?? '—',
      icon: CheckCircle2,
      tone: 'emerald',
    },
    {
      label: 'ارزهای مرجع',
      value: summary?.coverages.currencies ?? '—',
      icon: Banknote,
      tone: 'violet',
    },
    {
      label: 'متصل به طرح‌ها',
      value: relationValue,
      icon: Link2,
      tone: 'amber',
    },
  ];
}

export async function fetchInsuranceRelationSummary(
  list: (
    resource: 'insurers' | 'insurance-coverages',
    query: MasterDataListQuery,
  ) => Promise<{
    data: readonly MasterDataRecord[];
    meta: { total: number };
  }>,
  resource: 'insurers' | 'insurance-coverages',
  generation: number,
  isCurrent: (generation: number, resource: InsuranceResource) => boolean,
): Promise<readonly MasterDataRecord[] | null> {
  const records: MasterDataRecord[] = [];
  const ids = new Set<string>();
  let expectedTotal: number | undefined;
  for (let page = 1; ; page += 1) {
    const response = await list(resource, {
      search: '',
      status: 'all',
      sortBy: 'name',
      sortDirection: 'asc',
      page,
      pageSize: 100,
    });
    if (!isCurrent(generation, resource)) return null;
    if (
      !Number.isSafeInteger(response.meta.total) ||
      response.meta.total < 0 ||
      (expectedTotal !== undefined && response.meta.total !== expectedTotal)
    )
      throw new Error('Invalid insurance relation summary pagination');
    expectedTotal ??= response.meta.total;
    if (response.data.length === 0 && records.length < expectedTotal)
      throw new Error('Incomplete insurance relation summary pagination');
    for (const record of response.data) {
      if (ids.has(record.id))
        throw new Error('Duplicate insurance relation summary record');
      ids.add(record.id);
      records.push(record);
    }
    if (records.length === expectedTotal) return records;
    if (records.length > expectedTotal || response.data.length < 100)
      throw new Error('Incomplete insurance relation summary pagination');
  }
}

export function bindInsurancePlanParent(
  values: Record<string, string>,
  insurerId: string,
) {
  return { ...values, insurerId };
}

export async function fetchInsurerPlanPage(
  list: (
    resource: 'insurance-plans',
    query: MasterDataListQuery,
  ) => Promise<{ data: readonly MasterDataRecord[]; meta: { total: number } }>,
  query: MasterDataListQuery,
  generation: number,
  isCurrent: (generation: number) => boolean,
) {
  const response = await list('insurance-plans', query);
  return isCurrent(generation) ? response : null;
}

export async function refreshInsurancePlanViews(
  load: () => Promise<void>,
  onChanged: () => Promise<void>,
) {
  await Promise.all([load(), onChanged()]);
}

const tabs = [
  { resource: 'insurers', label: 'شرکت‌های بیمه', icon: Umbrella },
  { resource: 'insurance-coverages', label: 'پوشش‌ها', icon: ShieldPlus },
] as const satisfies readonly {
  resource: MasterDataResource;
  label: string;
  icon: typeof Umbrella;
}[];

type InsuranceResource = 'insurers' | 'insurance-plans' | 'insurance-coverages';

const rules: Record<InsuranceResource, { title: string; text: string }> = {
  insurers: {
    title: 'مالکیت سازمانی الزامی است',
    text: 'هر شرکت بیمه به Organization فعال با نقش بیمه‌گر (INSURANCE_PROVIDER) متصل می‌شود؛ قیمت و قرارداد در این صفحه نگهداری نمی‌شود. · Organization Reference',
  },
  'insurance-plans': {
    title: 'طرح، کاتالوگ مرجع محصول است',
    text: 'قیمت و قرارداد در Procurement و صدور، لغو و استرداد در Reservations و Integrations انجام می‌شود. · Domain Boundary',
  },
  'insurance-coverages': {
    title: 'مبلغ با سقف و ارز مستقل ثبت می‌شود',
    text: 'سقف پوشش و فرانشیز جزء تعریف مرجع پوشش‌اند؛ مبلغ فروش و نرخ خرید از Procurement خوانده می‌شود. · Decimal + Currency',
  },
};

const profileFields: Record<
  InsuranceResource,
  readonly { key: string; label: string }[]
> = {
  insurers: [
    { key: 'englishName', label: 'نام انگلیسی' },
    { key: 'organizationName', label: 'سازمان مرتبط' },
    { key: 'countryName', label: 'کشور' },
    { key: 'logoFileReference', label: 'Reference لوگو' },
    { key: 'planCount', label: 'تعداد طرح‌ها' },
  ],
  'insurance-plans': [
    { key: 'englishName', label: 'عنوان انگلیسی' },
    { key: 'insurerName', label: 'بیمه‌گر' },
    { key: 'destinationRegion', label: 'مقصد یا منطقه' },
    { key: 'minimumAge', label: 'حداقل سن' },
    { key: 'maximumAge', label: 'حداکثر سن' },
    { key: 'validFrom', label: 'شروع اعتبار' },
    { key: 'validTo', label: 'پایان اعتبار' },
    { key: 'coverageNames', label: 'پوشش‌ها' },
    { key: 'description', label: 'شرح استفاده' },
  ],
  'insurance-coverages': [
    { key: 'englishName', label: 'عنوان انگلیسی' },
    { key: 'coverageLimit', label: 'سقف تعهد' },
    { key: 'currencyCode', label: 'ارز' },
    { key: 'deductibleAmount', label: 'فرانشیز' },
    { key: 'description', label: 'شرح' },
    { key: 'planCount', label: 'استفاده در طرح‌ها' },
  ],
};

function attribute(record: MasterDataRecord, key: string, fallback = '—') {
  const value = record.attributes[key];
  return value === null || value === undefined || value === ''
    ? fallback
    : String(value);
}

function localDate(value: string) {
  if (value === '—') return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('fa-IR');
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

function MasterDataInsurerPlans({
  insurer,
  onChanged,
}: {
  insurer: MasterDataRecord;
  onChanged: () => Promise<void>;
}) {
  const [plans, setPlans] = useState<readonly MasterDataRecord[]>([]);
  const [state, setState] = useState<RequestState>('loading');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | MasterDataStatus>('active');
  const [selected, setSelected] = useState<MasterDataRecord>();
  const [formMode, setFormMode] = useState<MasterDataFormMode | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const requestGeneration = useRef(0);
  const definition = getMasterDataDefinition('insurance-plans');

  const load = useCallback(async () => {
    const generation = ++requestGeneration.current;
    setState('loading');
    try {
      const response = await fetchInsurerPlanPage(
        masterDataApi.list,
        {
          insurerId: insurer.id,
          search,
          status,
          sortBy: 'name',
          sortDirection: 'asc',
          page,
          pageSize: INSURER_PLAN_PAGE_SIZE,
        },
        generation,
        (candidate) => candidate === requestGeneration.current,
      );
      if (!response) return;
      setPlans(response.data);
      setTotal(response.meta.total);
      setState('ready');
    } catch (error) {
      if (generation !== requestGeneration.current) return;
      setPlans([]);
      setTotal(0);
      setState(
        error instanceof MasterDataApiError && error.status === 403
          ? 'forbidden'
          : 'error',
      );
    }
  }, [insurer.id, page, search, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => {
      window.clearTimeout(timer);
      requestGeneration.current += 1;
    };
  }, [load]);

  async function refreshAfterChange() {
    await refreshInsurancePlanViews(load, onChanged);
  }

  async function persist(
    values: Record<string, string>,
    logoChange?: MasterDataLogoChange,
  ) {
    await masterDataApi.persistWithLogo({
      resource: 'insurance-plans',
      values: bindInsurancePlanParent(values, insurer.id),
      title: `طرح بیمه ${values.name ?? selected?.name ?? ''}`.trim(),
      ...(formMode === 'edit' && selected ? { existing: selected } : {}),
      ...(logoChange ? { logoChange } : {}),
    });
    setFormMode(null);
    setSelected(undefined);
    await refreshAfterChange();
  }

  const body =
    state === 'loading' ? (
      <div
        aria-label={`در حال بارگذاری طرح‌های ${insurer.name}`}
        className="space-y-2"
      >
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    ) : state === 'forbidden' ? (
      <EmptyState
        description="مجوز master_data.read لازم است."
        icon={ShieldCheck}
        title="دسترسی به طرح‌ها وجود ندارد"
      />
    ) : state === 'error' ? (
      <ErrorState
        action={
          <Button onClick={() => void load()} size="sm" variant="outline">
            تلاش دوباره
          </Button>
        }
        description="دریافت طرح‌های این بیمه‌گر ناموفق بود."
        title="خطا در دریافت طرح‌ها"
      />
    ) : plans.length === 0 ? (
      <EmptyState
        description="برای این بیمه‌گر طرحی با فیلتر فعلی ثبت نشده است."
        icon={ShieldCheck}
        title="طرحی یافت نشد"
      />
    ) : (
      <div className="overflow-x-auto rounded-xl border border-border bg-background">
        <table
          aria-label={`طرح‌های بیمه ${insurer.name}`}
          className="w-full min-w-[58rem] text-sm"
        >
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              {[
                'کد طرح',
                'لوگو',
                'عنوان',
                'مقصد یا منطقه',
                'گروه سنی',
                'بازه اعتبار',
                'پوشش‌ها',
                'وضعیت',
                'عملیات',
              ].map((label) => (
                <th
                  className={
                    label === 'عملیات' ? 'p-3 text-center' : 'p-3 text-start'
                  }
                  key={label}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr className="border-t border-border" key={plan.id}>
                <td className="p-3 font-mono text-xs" dir="ltr">
                  {plan.code}
                </td>
                <MasterDataLogoCell record={plan} />
                <td className="p-3">
                  <button
                    className="font-bold text-primary"
                    onClick={() => {
                      setSelected(plan);
                      setProfileOpen(true);
                    }}
                    type="button"
                  >
                    {plan.name}
                  </button>
                </td>
                <td className="p-3">{attribute(plan, 'destinationRegion')}</td>
                <td className="p-3">
                  {attribute(plan, 'minimumAge', '0')} تا{' '}
                  {attribute(plan, 'maximumAge', 'بدون سقف')}
                </td>
                <td className="p-3">
                  {localDate(attribute(plan, 'validFrom'))} تا{' '}
                  {localDate(attribute(plan, 'validTo', 'نامحدود'))}
                </td>
                <td className="max-w-64 p-3">
                  {attribute(plan, 'coverageNames')}
                </td>
                <td className="p-3">{statusBadge(plan)}</td>
                <td className="p-3 text-center">
                  <div className="flex justify-center gap-2">
                    <Button
                      aria-label={`مشاهده ${plan.name}`}
                      onClick={() => {
                        setSelected(plan);
                        setProfileOpen(true);
                      }}
                      size="icon"
                      title={`مشاهده ${plan.name}`}
                      variant="ghost"
                    >
                      <Eye className="size-4" />
                    </Button>
                    <Button
                      aria-label={`ویرایش ${plan.name}`}
                      onClick={() => {
                        setSelected(plan);
                        setFormMode('edit');
                      }}
                      size="icon"
                      title={`ویرایش ${plan.name}`}
                      variant="outline"
                    >
                      <FilePenLine className="size-4" />
                    </Button>
                    <MasterDataDeleteButton
                      record={plan}
                      onDeleted={async () => {
                        setSelected(undefined);
                        if (plans.length === 1 && page > 1) {
                          setPage((value) => value - 1);
                          await onChanged();
                        } else await refreshAfterChange();
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  return (
    <div className="space-y-3 bg-muted/20 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <FormField id={`plan-search-${insurer.id}`} label="جست‌وجوی طرح">
          <Input
            id={`plan-search-${insurer.id}`}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            value={search}
          />
        </FormField>
        <FormField label="وضعیت طرح">
          <Select
            onValueChange={(value) => {
              setStatus(value as typeof status);
              setPage(1);
            }}
            value={status}
          >
            <SelectTrigger aria-label="فیلتر وضعیت طرح">
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
          className="ms-auto"
          onClick={() => {
            setSelected(undefined);
            setFormMode('create');
          }}
        >
          <Plus className="size-4" /> افزودن طرح
        </Button>
      </div>
      {body}
      <div className="flex items-center justify-between gap-3">
        <PaginationShell
          currentPage={page}
          totalLabel={`${total.toLocaleString('fa-IR')} طرح`}
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
            disabled={page * INSURER_PLAN_PAGE_SIZE >= total}
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
          initialValues={{ insurerId: insurer.id }}
          key={`${formMode}-${selected?.id ?? 'new'}`}
          lockedFields={['insurerId']}
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
          title={`پروفایل طرح بیمه`}
        >
          <div className="space-y-4">
            <MasterDataProfileIdentity
              eyebrow="پروفایل طرح بیمه"
              record={selected}
              title={selected.name}
            />
            <MasterDataDetailSection title="مشخصات طرح">
              {profileFields['insurance-plans'].map((field) => (
                <MasterDataDetailItem
                  key={field.key}
                  label={field.label}
                  value={
                    field.key.startsWith('valid')
                      ? localDate(attribute(selected, field.key))
                      : attribute(selected, field.key)
                  }
                />
              ))}
            </MasterDataDetailSection>
          </div>
        </MasterDataProfileDialog>
      ) : null}
    </div>
  );
}

export function MasterDataInsuranceWorkspace() {
  const [resource, setResource] = useState<InsuranceResource>('insurers');
  const [records, setRecords] = useState<readonly MasterDataRecord[]>([]);
  const [requestState, setRequestState] = useState<RequestState>('loading');
  const [summary, setSummary] = useState<MasterInsuranceSummary>();
  const [relationRecords, setRelationRecords] = useState<
    readonly MasterDataRecord[]
  >([]);
  const [relationSummaryState, setRelationSummaryState] =
    useState<InsuranceRelationSummaryState>('loading');
  const [countries, setCountries] = useState<readonly MasterDataRecord[]>([]);
  const [insurers, setInsurers] = useState<readonly MasterDataRecord[]>([]);
  const [currencies, setCurrencies] = useState<readonly MasterDataRecord[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | MasterDataStatus>('active');
  const [referenceFilter, setReferenceFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<MasterDataRecord>();
  const [profileOpen, setProfileOpen] = useState(false);
  const [formMode, setFormMode] = useState<MasterDataFormMode | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [expandedInsurerId, setExpandedInsurerId] = useState<string | null>(
    null,
  );
  const relationRequestRef = useRef(0);
  const relationResourceRef = useRef<InsuranceResource>('insurers');
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
        ...(resource === 'insurers' && referenceFilter !== 'all'
          ? { countryId: referenceFilter }
          : {}),
        ...(resource === 'insurance-plans' && referenceFilter !== 'all'
          ? { insurerId: referenceFilter }
          : {}),
        ...(resource === 'insurance-coverages' && referenceFilter !== 'all'
          ? { currencyId: referenceFilter }
          : {}),
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
  }, [
    columnFilters,
    dateFilters,
    page,
    referenceFilter,
    resource,
    search,
    status,
  ]);

  const loadSummary = useCallback(async () => {
    try {
      const response = await masterDataApi.insuranceSummary();
      setSummary(response.data);
    } catch {
      setSummary(undefined);
    }
  }, []);

  const loadRelationSummary = useCallback(async () => {
    if (resource === 'insurance-plans') return;
    const requestId = ++relationRequestRef.current;
    relationResourceRef.current = resource;
    setRelationSummaryState('loading');
    try {
      const result = await fetchInsuranceRelationSummary(
        masterDataApi.list,
        resource,
        requestId,
        (candidate, candidateResource) =>
          candidate === relationRequestRef.current &&
          candidateResource === relationResourceRef.current,
      );
      if (!result) return;
      setRelationRecords(result);
      setRelationSummaryState('ready');
    } catch {
      if (
        requestId !== relationRequestRef.current ||
        resource !== relationResourceRef.current
      )
        return;
      setRelationRecords([]);
      setRelationSummaryState('error');
    }
  }, [resource]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSummary();
      void Promise.all(
        [
          ['countries', setCountries],
          ['insurers', setInsurers],
          ['currencies', setCurrencies],
        ].map(async ([target, setter]) => {
          const response = await masterDataApi.list(
            target as MasterDataResource,
            {
              search: '',
              status: 'active',
              sortBy: 'name',
              sortDirection: 'asc',
              page: 1,
              pageSize: 100,
            },
          );
          (setter as (rows: readonly MasterDataRecord[]) => void)(
            response.data,
          );
        }),
      ).catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSummary]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRelationSummary(), 0);
    return () => {
      window.clearTimeout(timer);
      relationRequestRef.current += 1;
    };
  }, [loadRelationSummary]);

  const kpis = useMemo<readonly MasterDataKpiItem[]>(
    () =>
      insuranceKpiItems(
        resource,
        summary,
        relationRecords,
        relationSummaryState,
      ),
    [relationRecords, relationSummaryState, resource, summary],
  );

  const filterOptions =
    resource === 'insurers'
      ? countries
      : resource === 'insurance-plans'
        ? insurers
        : currencies;
  const filterLabel =
    resource === 'insurers'
      ? 'کشور'
      : resource === 'insurance-plans'
        ? 'بیمه‌گر'
        : 'ارز';

  function changeResource(next: InsuranceResource) {
    relationRequestRef.current += 1;
    relationResourceRef.current = next;
    setRelationRecords([]);
    setRelationSummaryState('loading');
    setResource(next);
    setSearch('');
    resetColumnFilters();
    setStatus('active');
    setReferenceFilter('all');
    setPage(1);
    setSelected(undefined);
    setProfileOpen(false);
    setFormMode(null);
    setNotice(null);
    setExpandedInsurerId(null);
  }

  function openProfile(record: MasterDataRecord) {
    setSelected(record);
    setProfileOpen(true);
  }

  async function persist(
    values: Record<string, string>,
    logoChange?: MasterDataLogoChange,
  ) {
    const result = await masterDataApi.persistWithLogo({
      resource,
      values,
      title:
        `${definition.singularLabel} ${values.name ?? selected?.name ?? ''}`.trim(),
      ...(formMode === 'edit' && selected ? { existing: selected } : {}),
      ...(logoChange ? { logoChange } : {}),
    });
    setNotice(
      result.warning ??
        `${definition.singularLabel} با Optimistic Lock و Audit ${formMode === 'edit' ? 'ویرایش' : 'ثبت'} شد.`,
    );
    setFormMode(null);
    await Promise.all([load(), loadSummary(), loadRelationSummary()]);
  }

  async function afterDelete() {
    setSelected(undefined);
    setFormMode(null);
    setProfileOpen(false);
    setNotice('رکورد با موفقیت حذف شد.');
    if (records.length === 1 && page > 1) setPage(page - 1);
    else await load();
    await Promise.all([loadSummary(), loadRelationSummary()]);
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
      downloadFile(response.blob, response.fileName);
      setNotice('خروجی Excel دریافت شد.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'خروجی ناموفق بود.');
    } finally {
      setExporting(false);
    }
  }

  const actions = (record: MasterDataRecord) => (
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
      <MasterDataDeleteButton record={record} onDeleted={afterDelete} />
    </div>
  );

  const table = records.length ? (
    <Card className="overflow-x-auto">
      <table
        aria-label={`فهرست ${definition.label}`}
        className="w-full min-w-[72rem] text-sm"
      >
        <thead className="bg-muted/50 text-muted-foreground">
          {resource === 'insurers' ? (
            <tr>
              {[
                'کد',
                'لوگو',
                'نام فارسی',
                'نام انگلیسی',
                'سازمان مرتبط',
                'کشور',
                'طرح فعال',
                'وضعیت',
                'عملیات',
              ].map((label) => (
                <th
                  className={
                    label === 'عملیات' ? 'p-4 text-center' : 'p-4 text-start'
                  }
                  key={label}
                >
                  {label}
                </th>
              ))}
            </tr>
          ) : resource === 'insurance-plans' ? (
            <tr>
              {[
                'کد طرح',
                'لوگو',
                'عنوان',
                'بیمه‌گر',
                'مقصد یا منطقه',
                'گروه سنی',
                'بازه اعتبار',
                'پوشش‌ها',
                'وضعیت',
                'عملیات',
              ].map((label) => (
                <th
                  className={
                    label === 'عملیات' ? 'p-4 text-center' : 'p-4 text-start'
                  }
                  key={label}
                >
                  {label}
                </th>
              ))}
            </tr>
          ) : (
            <tr>
              {[
                'کد پوشش',
                'لوگو',
                'عنوان',
                'سقف تعهد',
                'ارز',
                'فرانشیز',
                'شرح',
                'استفاده در طرح‌ها',
                'وضعیت',
                'عملیات',
              ].map((label) => (
                <th
                  className={
                    label === 'عملیات' ? 'p-4 text-center' : 'p-4 text-start'
                  }
                  key={label}
                >
                  {label}
                </th>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {records.map((record) => (
            <Fragment key={record.id}>
              <tr className="border-t border-border transition hover:bg-muted/30">
                {resource === 'insurers' ? (
                  <>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-2">
                        <span className="grid size-9 place-items-center rounded-xl bg-cyan-100 text-cyan-700">
                          <Umbrella className="size-4" />
                        </span>
                        <span className="font-mono text-xs" dir="ltr">
                          {record.code}
                        </span>
                      </span>
                    </td>
                    <MasterDataLogoCell record={record} />
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button
                          aria-expanded={expandedInsurerId === record.id}
                          aria-label={`${expandedInsurerId === record.id ? 'بستن' : 'نمایش'} طرح‌های ${record.name}`}
                          className="grid size-8 place-items-center rounded-lg border border-border"
                          onClick={() =>
                            setExpandedInsurerId((current) =>
                              current === record.id ? null : record.id,
                            )
                          }
                          type="button"
                        >
                          <ChevronDown
                            className={`size-4 transition-transform ${expandedInsurerId === record.id ? 'rotate-180' : ''}`}
                          />
                        </button>
                        <button
                          className="font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => openProfile(record)}
                          type="button"
                        >
                          {record.name}
                        </button>
                      </div>
                    </td>
                    <td className="p-4" dir="ltr">
                      {attribute(record, 'englishName')}
                    </td>
                    <td className="p-4">
                      {attribute(record, 'organizationName')}
                    </td>
                    <td className="p-4">{attribute(record, 'countryName')}</td>
                    <td className="p-4">
                      {Number(
                        attribute(record, 'planCount', '0'),
                      ).toLocaleString('fa-IR')}
                    </td>
                  </>
                ) : resource === 'insurance-plans' ? (
                  <>
                    <td className="p-4 font-mono text-xs" dir="ltr">
                      {record.code}
                    </td>
                    <MasterDataLogoCell record={record} />
                    <td className="p-4">
                      <button
                        aria-controls={`insurer-plans-${record.id}`}
                        className="font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => openProfile(record)}
                        type="button"
                      >
                        {record.name}
                      </button>
                    </td>
                    <td className="p-4">{attribute(record, 'insurerName')}</td>
                    <td className="p-4">
                      {attribute(record, 'destinationRegion')}
                    </td>
                    <td className="p-4">
                      {attribute(record, 'minimumAge', '0')} تا{' '}
                      {attribute(record, 'maximumAge', 'بدون سقف')}
                    </td>
                    <td className="p-4">
                      {localDate(attribute(record, 'validFrom'))} تا{' '}
                      {localDate(attribute(record, 'validTo', 'نامحدود'))}
                    </td>
                    <td className="max-w-64 p-4">
                      {attribute(record, 'coverageNames')}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="p-4 font-mono text-xs" dir="ltr">
                      {record.code}
                    </td>
                    <MasterDataLogoCell record={record} />
                    <td className="p-4">
                      <button
                        className="font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => openProfile(record)}
                        type="button"
                      >
                        {record.name}
                      </button>
                    </td>
                    <td className="p-4 font-mono" dir="ltr">
                      {attribute(record, 'coverageLimit')}
                    </td>
                    <td className="p-4 font-mono" dir="ltr">
                      {attribute(record, 'currencyCode')}
                    </td>
                    <td className="p-4 font-mono" dir="ltr">
                      {attribute(record, 'deductibleAmount', '0')}
                    </td>
                    <td className="max-w-72 p-4 text-muted-foreground">
                      {attribute(record, 'description')}
                    </td>
                    <td className="p-4">
                      {Number(
                        attribute(record, 'planCount', '0'),
                      ).toLocaleString('fa-IR')}
                    </td>
                  </>
                )}
                <td className="p-4">{statusBadge(record)}</td>
                <td className="p-4 text-center">{actions(record)}</td>
              </tr>
              {resource === 'insurers' && expandedInsurerId === record.id ? (
                <tr className="border-t border-border">
                  <td className="p-0" colSpan={9}>
                    <div id={`insurer-plans-${record.id}`}>
                      <MasterDataInsurerPlans
                        insurer={record}
                        onChanged={async () => {
                          await Promise.all([
                            load(),
                            loadSummary(),
                            loadRelationSummary(),
                          ]);
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ) : null}
            </Fragment>
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
        description="دریافت اطلاعات بیمه از Backend ناموفق بود."
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
        <nav aria-label="زیرمجموعه‌های بیمه" className="flex min-w-max gap-1">
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
          idPrefix="insurance-created"
          {...dateRangeProps}
        />
        <FormField id="insurance-search" label="جست‌وجو">
          <div className="relative">
            <Search className="absolute end-3 top-3.5 size-4 text-muted-foreground" />
            <Input
              className="pe-10"
              id="insurance-search"
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
        <FormField label={filterLabel}>
          <Select
            onValueChange={(value) => {
              setReferenceFilter(value);
              setPage(1);
            }}
            value={referenceFilter}
          >
            <SelectTrigger aria-label={`فیلتر ${filterLabel}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه {filterLabel}ها</SelectItem>
              {filterOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <MasterDataFilterActions
          onClear={() => {
            setSearch('');
            resetColumnFilters();
            resetDateRange();
            setStatus('active');
            setReferenceFilter('all');
            setPage(1);
          }}
          onRefresh={() =>
            void Promise.all([load(), loadSummary(), loadRelationSummary()])
          }
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
                  label="نسخه"
                  value={selected.version.toLocaleString('fa-IR')}
                />
                {profileFields[resource].map((field) => (
                  <MasterDataDetailItem
                    key={field.key}
                    label={field.label}
                    value={
                      field.key.startsWith('valid')
                        ? localDate(attribute(selected, field.key))
                        : attribute(selected, field.key)
                    }
                  />
                ))}
              </MasterDataDetailSection>
              <Card className="p-5">
                <h3 className="mb-4 flex items-center gap-2 font-black">
                  <ShieldCheck className="size-5" /> مرز دامنه
                </h3>
                <EmptyState
                  description={rules[resource].text}
                  icon={Link2}
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
import { downloadFile } from '../api/download-file';
