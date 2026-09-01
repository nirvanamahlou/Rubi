'use client';
import { useMasterDataColumnFilters } from './master-data-column-filters';
import { MasterDataPowerButton } from './master-data-power-button';

import type {
  MasterDataListQuery,
  MasterDataRecord,
  MasterDataResource,
  MasterDataStatus,
  MasterTerminalType,
} from '@rubi/contracts';
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Eye,
  FilePenLine,
  FileSpreadsheet,
  Globe2,
  History,
  Layers3,
  Link2,
  LockKeyhole,
  MapPin,
  PlaneTakeoff,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  SquareStack,
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
import { loadTourTypeActorNames as loadActorNames } from '../api/tour-type-actors';
import {
  terminalHoursLabel,
  terminalStatusLabel,
  terminalUpdatedLabel,
} from '../model/terminal-form';
import { MasterDataTerminalForm } from './master-data-terminal-form';
import { MasterDataDeleteButton } from './master-data-delete-button';
import {
  getMasterDataDefinition,
  type MasterDataResourceKey,
} from '../model/catalog';
import {
  MasterDataLiveForm,
  type MasterDataFormMode,
} from './master-data-live-form';
import {
  MasterDataKpiGrid,
  type MasterDataKpiItem,
} from './master-data-kpi-grid';

type GeographyResource = Extract<
  MasterDataResourceKey,
  'countries' | 'regions' | 'cities' | 'airports' | 'terminals'
>;
type RequestState = 'loading' | 'ready' | 'error' | 'forbidden';

const geographyTabs: readonly {
  resource: GeographyResource;
  label: string;
  icon: typeof Globe2;
  integrityTitle: string;
  integrityDescription: string;
}[] = [
  {
    resource: 'countries',
    label: 'کشورها',
    icon: Globe2,
    integrityTitle: 'حذف رکورد وابسته مجاز نیست',
    integrityDescription:
      'کشوری که شهر، استان، فرودگاه یا بانک وابسته دارد فقط غیرفعال می‌شود.',
  },
  {
    resource: 'regions',
    label: 'شهرها و استان‌ها',
    icon: MapPin,
    integrityTitle: 'شهر و استان در یک نمای ساختاری مدیریت می‌شوند',
    integrityDescription:
      'استان/ناحیه و شهر از همین بخش مدیریت می‌شوند؛ رابطه‌های مستقل و FKهای واقعی آن‌ها بدون ادغام مخرب داده حفظ شده‌اند.',
  },
  {
    resource: 'airports',
    label: 'فرودگاه‌ها',
    icon: PlaneTakeoff,
    integrityTitle: 'زمان همیشه UTC ذخیره می‌شود',
    integrityDescription:
      'Timezone فقط IANA معتبر است؛ IATA و ICAO در کل سیستم یکتا و مختصات دارای Constraint واقعی هستند.',
  },
  {
    resource: 'terminals',
    label: 'ترمینال‌ها',
    icon: SquareStack,
    integrityTitle: 'ترمینال در محدوده فرودگاه تعریف می‌شود',
    integrityDescription:
      'ترمینال به فرودگاه مرجع متصل است و نوع آن داخلی، بین‌المللی، مشترک یا VIP خواهد بود.',
  },
];

const terminalLabels: Record<string, string> = {
  DOMESTIC: 'داخلی',
  INTERNATIONAL: 'بین‌المللی',
  MIXED: 'مشترک',
  VIP: 'VIP',
};

const regionLabels: Record<string, string> = {
  PROVINCE: 'استان',
  STATE: 'ایالت',
  REGION: 'ناحیه',
  TERRITORY: 'قلمرو',
};

function attribute(record: MasterDataRecord, key: string): string {
  const value = record.attributes[key];
  return value === null || value === undefined || value === ''
    ? '—'
    : String(value);
}

function airportLocalTime(record: MasterDataRecord) {
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      timeZone: attribute(record, 'ianaTimezone'),
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date());
  } catch {
    return '—';
  }
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
      {record.resource === 'terminals'
        ? terminalStatusLabel(record)
        : record.status === 'active'
          ? 'فعال'
          : 'غیرفعال'}
    </Badge>
  );
}

function geographyColumns(resource: GeographyResource): readonly string[] {
  if (resource === 'countries')
    return [
      'کد ISO-2',
      'نام فارسی',
      'نام انگلیسی',
      'ترتیب',
      'وابستگی‌ها',
      'نسخه',
      'آخرین تغییر',
      'وضعیت',
      'عملیات',
    ];
  if (resource === 'regions')
    return [
      'کد',
      'نام فارسی',
      'نام انگلیسی',
      'کشور',
      'نوع ساختار',
      'تعداد شهر',
      'آخرین تغییر',
      'نسخه',
      'وضعیت',
      'عملیات',
    ];
  if (resource === 'cities')
    return [
      'کد',
      'نام فارسی',
      'نام انگلیسی',
      'کشور',
      'استان/ناحیه',
      'فرودگاه‌ها',
      'برچسب مقصد',
      'نسخه',
      'وضعیت',
      'عملیات',
    ];
  if (resource === 'airports')
    return [
      'IATA',
      'ICAO',
      'نام فارسی',
      'نام انگلیسی',
      'شهر',
      'Timezone',
      'ساعت محلی',
      'ترمینال‌ها',
      'مختصات',
      'وضعیت',
      'عملیات',
    ];
  return [
    'کد/عنوان',
    'فرودگاه',
    'شهر',
    'نوع ترمینال',
    'تعداد گیت',
    'ساعت فعالیت',
    'آخرین تغییر',
    'وضعیت',
    'عملیات',
  ];
}

function recordCells(
  resource: GeographyResource,
  record: MasterDataRecord,
  actorNames: Readonly<Record<string, string>> = {},
): readonly React.ReactNode[] {
  if (resource === 'countries')
    return [
      <span className="font-mono font-black" dir="ltr" key="code">
        {attribute(record, 'iso2Code')}
      </span>,
      record.name,
      attribute(record, 'englishName'),
      attribute(record, 'displayOrder'),
      <span key="dependencies" title="وابستگی‌های مستقیم داخل اطلاعات پایه">
        {attribute(record, 'dependencyCount')} مورد ·{' '}
        {attribute(record, 'citiesCount')} شهر ·{' '}
        {attribute(record, 'regionsCount')} استان ·{' '}
        {attribute(record, 'banksCount')} بانک
      </span>,
      `v${record.version.toLocaleString('fa-IR')}`,
      new Date(record.updatedAt).toLocaleString('fa-IR'),
      statusBadge(record),
    ];
  if (resource === 'regions')
    return [
      <span className="font-mono text-xs font-black" dir="ltr" key="code">
        {record.code}
      </span>,
      record.name,
      attribute(record, 'englishName'),
      attribute(record, 'countryName'),
      regionLabels[attribute(record, 'type')] ?? attribute(record, 'type'),
      attribute(record, 'cityCount'),
      new Date(record.updatedAt).toLocaleString('fa-IR'),
      `v${record.version.toLocaleString('fa-IR')}`,
      statusBadge(record),
    ];
  if (resource === 'cities')
    return [
      <span className="font-mono text-xs font-black" dir="ltr" key="code">
        {record.code}
      </span>,
      record.name,
      attribute(record, 'englishName'),
      attribute(record, 'countryName'),
      attribute(record, 'regionName'),
      attribute(record, 'airportCount'),
      <span
        key="destination-tag"
        title="برچسب مقصد از قرارداد قواعد بازار دریافت می‌شود؛ داده ساختگی نمایش داده نمی‌شود"
      >
        در انتظار اتصال قواعد بازار
      </span>,
      `v${record.version.toLocaleString('fa-IR')}`,
      statusBadge(record),
    ];
  if (resource === 'airports')
    return [
      <span className="font-mono font-black" dir="ltr" key="iata">
        {record.code}
      </span>,
      <span className="font-mono text-xs font-black" dir="ltr" key="icao">
        {attribute(record, 'icaoCode')}
      </span>,
      record.name,
      attribute(record, 'englishName'),
      attribute(record, 'cityName'),
      <span className="font-mono text-xs" dir="ltr" key="timezone">
        {attribute(record, 'ianaTimezone')}
      </span>,
      airportLocalTime(record),
      attribute(record, 'terminalCount'),
      <span className="font-mono text-xs" dir="ltr" key="coordinates">
        {attribute(record, 'latitude')}، {attribute(record, 'longitude')}
      </span>,
      statusBadge(record),
    ];
  return [
    <div key="terminal">
      <p className="font-bold">{record.name}</p>
      <p className="font-mono text-[11px] text-muted-foreground" dir="ltr">
        {record.code}
      </p>
    </div>,
    `${attribute(record, 'airportIataCode')} · ${attribute(record, 'airportIcaoCode')}`,
    attribute(record, 'cityName'),
    terminalLabels[attribute(record, 'terminalType')] ??
      attribute(record, 'terminalType'),
    attribute(record, 'gateCount'),
    terminalHoursLabel(record),
    terminalUpdatedLabel(record, actorNames),
    statusBadge(record),
  ];
}

const referenceQuery: MasterDataListQuery = {
  search: '',
  status: 'active',
  sortBy: 'name',
  sortDirection: 'asc',
  page: 1,
  pageSize: 100,
};

export function MasterDataGeographyWorkspace() {
  const [resource, setResource] = useState<GeographyResource>('countries');
  const [actorNames, setActorNames] = useState<
    Readonly<Record<string, string>>
  >({});
  useEffect(() => {
    if (resource !== 'terminals') return;
    const controller = new AbortController();
    void loadActorNames(controller.signal).then((names) => {
      if (!controller.signal.aborted) setActorNames(names);
    });
    return () => controller.abort();
  }, [resource]);
  const [records, setRecords] = useState<readonly MasterDataRecord[]>([]);
  const [requestState, setRequestState] = useState<RequestState>('loading');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | MasterDataStatus>('all');
  const [sortBy, setSortBy] = useState<'name' | 'code' | 'updatedAt'>('name');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [activeTotal, setActiveTotal] = useState(0);
  const [internationalTotal, setInternationalTotal] = useState(0);
  const [locationTotals, setLocationTotals] = useState({
    regions: 0,
    activeRegions: 0,
    cities: 0,
    activeCities: 0,
  });
  const [countryId, setCountryId] = useState('all');
  const [regionId, setRegionId] = useState('all');
  const [cityId, setCityId] = useState('all');
  const [airportId, setAirportId] = useState('all');
  const [terminalType, setTerminalType] = useState<'all' | MasterTerminalType>(
    'all',
  );
  const [references, setReferences] = useState<
    Readonly<
      Record<
        'countries' | 'regions' | 'cities' | 'airports',
        readonly MasterDataRecord[]
      >
    >
  >({ countries: [], regions: [], cities: [], airports: [] });
  const [formMode, setFormMode] = useState<MasterDataFormMode | null>(null);
  const [selected, setSelected] = useState<MasterDataRecord | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const definition = getMasterDataDefinition(resource);
  const isLocationView = resource === 'regions' || resource === 'cities';
  const currentTab =
    geographyTabs.find((item) =>
      isLocationView ? item.resource === 'regions' : item.resource === resource,
    ) ?? geographyTabs[0];

  const scopedFilters = useMemo(
    () => ({
      ...(resource !== 'countries' && countryId !== 'all' ? { countryId } : {}),
      ...(resource === 'cities' || resource === 'airports'
        ? regionId !== 'all'
          ? { regionId }
          : {}
        : {}),
      ...(resource === 'airports' && cityId !== 'all' ? { cityId } : {}),
      ...(resource === 'terminals' && airportId !== 'all' ? { airportId } : {}),
      ...(resource === 'terminals' && terminalType !== 'all'
        ? { terminalType }
        : {}),
    }),
    [airportId, cityId, countryId, regionId, resource, terminalType],
  );

  const { columnFilters, columnFilterControls, resetColumnFilters } =
    useMasterDataColumnFilters(resource, () => setPage(1));

  const load = useCallback(async () => {
    setRequestState('loading');
    const baseQuery: MasterDataListQuery = {
      ...columnFilters,
      search,
      status,
      sortBy,
      sortDirection: 'asc',
      page,
      pageSize: 25,
      ...scopedFilters,
    };
    try {
      const requests: Promise<unknown>[] = [
        masterDataApi.list(resource as MasterDataResource, baseQuery),
        masterDataApi.listSummary(resource as MasterDataResource, {
          ...baseQuery,
          search: '',
          status: 'active',
        }),
      ];
      if (resource === 'terminals') {
        requests.push(
          masterDataApi.listSummary('terminals', {
            ...baseQuery,
            search: '',
            status: 'all',
            terminalType: 'INTERNATIONAL',
          }),
        );
      } else requests.push(Promise.resolve(undefined));
      if (resource === 'regions' || resource === 'cities') {
        const pairedResource = resource === 'regions' ? 'cities' : 'regions';
        requests.push(
          masterDataApi.listSummary(pairedResource, {
            search: '',
            status: 'all',
            sortBy: 'name',
            sortDirection: 'asc',
          }),
          masterDataApi.listSummary(pairedResource, {
            search: '',
            status: 'active',
            sortBy: 'name',
            sortDirection: 'asc',
          }),
        );
      }
      const [
        listResult,
        activeResult,
        internationalResult,
        pairedResult,
        pairedActiveResult,
      ] = (await Promise.all(requests)) as [
        Awaited<ReturnType<typeof masterDataApi.list>>,
        Awaited<ReturnType<typeof masterDataApi.list>>,
        Awaited<ReturnType<typeof masterDataApi.list>> | undefined,
        Awaited<ReturnType<typeof masterDataApi.list>> | undefined,
        Awaited<ReturnType<typeof masterDataApi.list>> | undefined,
      ];
      setRecords(listResult.data);
      setTotal(listResult.meta.total);
      setActiveTotal(activeResult.meta.total);
      setInternationalTotal(internationalResult?.meta.total ?? 0);
      if (resource === 'regions')
        setLocationTotals({
          regions: listResult.meta.total,
          activeRegions: activeResult.meta.total,
          cities: pairedResult?.meta.total ?? 0,
          activeCities: pairedActiveResult?.meta.total ?? 0,
        });
      else if (resource === 'cities')
        setLocationTotals({
          regions: pairedResult?.meta.total ?? 0,
          activeRegions: pairedActiveResult?.meta.total ?? 0,
          cities: listResult.meta.total,
          activeCities: activeResult.meta.total,
        });
      setRequestState('ready');
    } catch (error) {
      setRecords([]);
      setRequestState(
        error instanceof MasterDataApiError && error.status === 403
          ? 'forbidden'
          : 'error',
      );
    }
  }, [columnFilters, page, resource, scopedFilters, search, sortBy, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      masterDataApi.list('countries', referenceQuery),
      masterDataApi.list('regions', referenceQuery),
      masterDataApi.list('cities', referenceQuery),
      masterDataApi.list('airports', referenceQuery),
    ])
      .then(([countries, regions, cities, airports]) => {
        if (!cancelled)
          setReferences({
            countries: countries.data,
            regions: regions.data,
            cities: cities.data,
            airports: airports.data,
          });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  function changeResource(next: GeographyResource) {
    setResource(next);
    setSearch('');
    resetColumnFilters();
    setStatus('all');
    setSortBy('name');
    setPage(1);
    setCountryId('all');
    setRegionId('all');
    setCityId('all');
    setAirportId('all');
    setTerminalType('all');
    setSelected(undefined);
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
    await load();
  }

  async function afterDelete() {
    setSelected(undefined);
    setFormMode(null);
    setNotice('رکورد با موفقیت حذف شد.');
    if (records.length === 1 && page > 1) setPage(page - 1);
    else await load();
  }

  async function afterStatusChange() {
    setNotice('وضعیت رکورد با موفقیت تغییر کرد.');
    await load();
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const file = await masterDataApi.downloadExcel({
        resource,
        format: 'xlsx',
        filters: {
          ...columnFilters,
          search,
          status,
          sortBy,
          sortDirection: 'asc',
          ...scopedFilters,
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
      setNotice(`خروجی Excel ${definition.label} آماده شد.`);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'خروجی Excel ناموفق بود.',
      );
    } finally {
      setExporting(false);
    }
  }

  const inactiveTotal = Math.max(0, total - activeTotal);
  const coveredCities = new Set(
    records
      .map((record) => record.attributes.cityName)
      .filter((value): value is string => typeof value === 'string' && !!value),
  ).size;

  const kpis: readonly MasterDataKpiItem[] =
    resource === 'countries'
      ? [
          { label: 'کل کشورها', value: total, icon: Globe2, tone: 'sky' },
          {
            label: 'کشور فعال',
            value: activeTotal,
            icon: CheckCircle2,
            tone: 'emerald',
          },
          {
            label: 'کشور دارای مقصد',
            value: '—',
            icon: MapPin,
            tone: 'violet',
            hint: 'پس از اتصال قرارداد مقصد',
          },
          {
            label: 'نیازمند بازبینی',
            value: inactiveTotal,
            icon: History,
            tone: 'amber',
            hint: 'رکوردهای غیرفعال در دامنه فعلی',
          },
        ]
      : resource === 'regions' || resource === 'cities'
        ? [
            {
              label: 'کل شهرها',
              value: locationTotals.cities,
              icon: MapPin,
              tone: 'sky',
            },
            {
              label: 'شهر فعال',
              value: locationTotals.activeCities,
              icon: CheckCircle2,
              tone: 'emerald',
            },
            {
              label: 'کل استان‌ها',
              value: locationTotals.regions,
              icon: Layers3,
              tone: 'violet',
            },
            {
              label: 'استان فعال',
              value: locationTotals.activeRegions,
              icon: CheckCircle2,
              tone: 'amber',
            },
          ]
        : resource === 'airports'
          ? [
              {
                label: 'کل فرودگاه‌ها',
                value: total,
                icon: PlaneTakeoff,
                tone: 'sky',
              },
              {
                label: 'فرودگاه فعال',
                value: activeTotal,
                icon: CheckCircle2,
                tone: 'emerald',
              },
              {
                label: 'شهرهای مرتبط',
                value: coveredCities,
                icon: MapPin,
                tone: 'violet',
                hint: 'در صفحه جاری',
              },
              {
                label: 'ناقص یا نیازمند بررسی',
                value: inactiveTotal,
                icon: CircleAlert,
                tone: 'amber',
                hint: 'رکوردهای غیرفعال در دامنه فعلی',
              },
            ]
          : [
              {
                label: 'کل ترمینال‌ها',
                value: total,
                icon: SquareStack,
                tone: 'sky',
              },
              {
                label: 'ترمینال فعال',
                value: activeTotal,
                icon: CheckCircle2,
                tone: 'emerald',
              },
              {
                label: 'بین‌المللی',
                value: internationalTotal,
                icon: Globe2,
                tone: 'violet',
              },
              {
                label: 'نیازمند بازبینی',
                value: inactiveTotal,
                icon: History,
                tone: 'amber',
                hint: 'رکوردهای غیرفعال در دامنه فعلی',
              },
            ];

  const columns = geographyColumns(resource);

  return (
    <div className="space-y-5" dir="rtl">
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
        description={
          isLocationView
            ? 'مدیریت یکپارچه شهرها و استان‌ها/نواحی با حفظ رابطه ساختاری و کشور مرجع.'
            : definition.description
        }
        title={isLocationView ? 'شهرها و استان‌ها' : definition.label}
      />

      {notice ? <Alert description={notice} title="نتیجه عملیات" /> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              setSelected(undefined);
              setFormMode('create');
            }}
          >
            <Plus aria-hidden="true" className="size-4" />
            افزودن {definition.singularLabel}
          </Button>
          <Button
            loading={exporting}
            onClick={() => void exportExcel()}
            variant="outline"
          >
            <FileSpreadsheet aria-hidden="true" className="size-4" />
            خروجی اکسل
          </Button>
        </div>
      </div>

      <Card className="overflow-x-auto p-2">
        <nav
          aria-label="زیرمجموعه‌های جغرافیا"
          className="flex min-w-max gap-1 rounded-xl bg-sky-500/5 p-1"
        >
          {geographyTabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                aria-current={
                  resource === item.resource ||
                  (item.resource === 'regions' && resource === 'cities')
                    ? 'page'
                    : undefined
                }
                className="flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-bold text-muted-foreground transition hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-background aria-[current=page]:text-sky-700 aria-[current=page]:shadow-sm dark:aria-[current=page]:text-sky-300"
                key={item.resource}
                onClick={() => changeResource(item.resource)}
                type="button"
              >
                <Icon aria-hidden="true" className="size-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
        {isLocationView ? (
          <div
            aria-label="انتخاب نوع داده شهر و استان"
            className="mt-2 flex flex-wrap gap-2 border-t border-border/70 px-2 pt-3"
            role="group"
          >
            <Button
              aria-pressed={resource === 'cities'}
              onClick={() => changeResource('cities')}
              size="sm"
              variant={resource === 'cities' ? 'primary' : 'ghost'}
            >
              <MapPin aria-hidden="true" className="size-4" /> شهرها
            </Button>
            <Button
              aria-pressed={resource === 'regions'}
              onClick={() => changeResource('regions')}
              size="sm"
              variant={resource === 'regions' ? 'primary' : 'ghost'}
            >
              <Layers3 aria-hidden="true" className="size-4" /> استان‌ها و نواحی
            </Button>
            <span className="self-center text-xs text-muted-foreground">
              یک بخش مشترک با دو نوع رکورد ساختاری
            </span>
          </div>
        ) : null}
      </Card>

      <MasterDataKpiGrid
        items={kpis}
        label={`شاخص‌های ${isLocationView ? 'شهرها و استان‌ها' : definition.label}`}
      />

      <Card className="border-sky-200/80 bg-gradient-to-l from-sky-50 to-background p-4 dark:border-sky-400/20 dark:from-sky-950/40">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sky-100 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300">
            <LockKeyhole aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-black">
                {currentTab?.integrityTitle ?? 'قاعده یکپارچگی جغرافیا'}
              </h2>
              <Badge className="bg-sky-500/10 text-sky-700 dark:text-sky-300">
                <ShieldCheck aria-hidden="true" className="me-1 size-3" />
                قاعده یکپارچگی
              </Badge>
            </div>
            <p className="mt-1 text-xs leading-6 text-muted-foreground sm:text-sm">
              {currentTab?.integrityDescription ?? definition.description}
            </p>
          </div>
        </div>
      </Card>

      <FilterBar className="grid sm:grid-cols-2 xl:grid-cols-[minmax(13rem,1fr)_10rem_10rem_repeat(2,minmax(10rem,12rem))_auto]">
        {columnFilterControls}
        <FormField id="geography-search" label="جست‌وجو">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="absolute end-3 top-3.5 size-4 text-muted-foreground"
            />
            <Input
              className="pe-10"
              id="geography-search"
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
              <SelectItem value="code">کد</SelectItem>
              <SelectItem value="updatedAt">آخرین تغییر</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        {resource === 'regions' ||
        resource === 'cities' ||
        resource === 'airports' ? (
          <FormField label="کشور">
            <Select
              onValueChange={(value) => {
                setCountryId(value);
                setRegionId('all');
                setCityId('all');
                setPage(1);
              }}
              value={countryId}
            >
              <SelectTrigger aria-label="فیلتر کشور">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه کشورها</SelectItem>
                {references.countries.map((record) => (
                  <SelectItem key={record.id} value={record.id}>
                    {record.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        ) : null}
        {resource === 'cities' || resource === 'airports' ? (
          <FormField label="استان/ناحیه">
            <Select
              onValueChange={(value) => {
                setRegionId(value);
                setPage(1);
              }}
              value={regionId}
            >
              <SelectTrigger aria-label="فیلتر استان یا ناحیه">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه استان‌ها</SelectItem>
                {references.regions
                  .filter(
                    (record) =>
                      countryId === 'all' ||
                      record.attributes.countryId === countryId,
                  )
                  .map((record) => (
                    <SelectItem key={record.id} value={record.id}>
                      {record.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </FormField>
        ) : null}
        {resource === 'airports' ? (
          <FormField label="شهر">
            <Select
              onValueChange={(value) => {
                setCityId(value);
                setPage(1);
              }}
              value={cityId}
            >
              <SelectTrigger aria-label="فیلتر شهر">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه شهرها</SelectItem>
                {references.cities.map((record) => (
                  <SelectItem key={record.id} value={record.id}>
                    {record.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        ) : null}
        {resource === 'terminals' ? (
          <>
            <FormField label="فرودگاه">
              <Select
                onValueChange={(value) => {
                  setAirportId(value);
                  setPage(1);
                }}
                value={airportId}
              >
                <SelectTrigger aria-label="فیلتر فرودگاه">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه فرودگاه‌ها</SelectItem>
                  {references.airports.map((record) => (
                    <SelectItem key={record.id} value={record.id}>
                      {record.code} · {record.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="نوع ترمینال">
              <Select
                onValueChange={(value) => {
                  setTerminalType(value as typeof terminalType);
                  setPage(1);
                }}
                value={terminalType}
              >
                <SelectTrigger aria-label="فیلتر نوع ترمینال">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه انواع</SelectItem>
                  <SelectItem value="DOMESTIC">داخلی</SelectItem>
                  <SelectItem value="INTERNATIONAL">بین‌المللی</SelectItem>
                  <SelectItem value="MIXED">مشترک</SelectItem>
                  <SelectItem value="VIP">VIP</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </>
        ) : null}
        <Button onClick={() => void load()} variant="ghost">
          <RefreshCw aria-hidden="true" className="size-4" />
          تازه‌سازی
        </Button>
      </FilterBar>

      {requestState === 'loading' ? (
        <div aria-label="در حال بارگذاری" className="space-y-3">
          {[0, 1, 2].map((item) => (
            <Skeleton className="h-16 w-full" key={item} />
          ))}
        </div>
      ) : requestState === 'forbidden' ? (
        <EmptyState
          description="مجوز master_data.read برای مشاهده جغرافیا لازم است."
          icon={LockKeyhole}
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
          description="دریافت اطلاعات جغرافیا از Backend ناموفق بود."
          title="دریافت جغرافیا ناموفق بود"
        />
      ) : records.length === 0 ? (
        <EmptyState
          action={
            <Button
              onClick={() => {
                setSelected(undefined);
                setFormMode('create');
              }}
              size="sm"
            >
              افزودن {definition.singularLabel}
            </Button>
          }
          description="با فیلتر فعلی رکوردی پیدا نشد."
          title={`${definition.label} خالی است`}
        />
      ) : (
        <Card className="overflow-x-auto">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2 font-black">
              <Link2 aria-hidden="true" className="size-4 text-sky-600" />
              فهرست {definition.label}
            </div>
            <Badge>{total.toLocaleString('fa-IR')} رکورد</Badge>
          </div>
          <table className="w-full min-w-[64rem] text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                {columns.map((column) => (
                  <th className="p-4 text-start" key={column}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr
                  className="border-t border-border transition hover:bg-sky-500/[0.035]"
                  key={record.id}
                >
                  {recordCells(resource, record, actorNames).map(
                    (cell, index) => (
                      <td className="p-4" key={columns[index]}>
                        {cell}
                      </td>
                    ),
                  )}
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        aria-label={`مشاهده ${record.name}`}
                        onClick={() => {
                          setSelected(record);
                          setFormMode('view');
                        }}
                        size="sm"
                        variant="outline"
                      >
                        <Eye aria-hidden="true" className="size-4" />
                        مشاهده
                      </Button>
                      <Button
                        aria-label={`ویرایش ${record.name}`}
                        onClick={() => {
                          setSelected(record);
                          setFormMode('edit');
                        }}
                        size="sm"
                        variant="outline"
                      >
                        <FilePenLine aria-hidden="true" className="size-4" />
                        ویرایش
                      </Button>
                      <MasterDataDeleteButton
                        record={record}
                        onDeleted={afterDelete}
                      />
                      <MasterDataPowerButton
                        record={record}
                        onChanged={afterStatusChange}
                      />
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

      {formMode && resource === 'terminals' ? (
        <MasterDataTerminalForm
          key={`${formMode}-${selected?.id ?? 'new'}`}
          mode={formMode}
          actorNames={actorNames}
          onOpenChange={() => setFormMode(null)}
          onPersist={persist}
          {...(selected ? { record: selected } : {})}
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
          {...(selected ? { record: selected } : {})}
        />
      ) : null}
    </div>
  );
}
