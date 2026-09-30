'use client';
import { useMasterDataColumnFilters } from './master-data-column-filters';
import { MasterDataPowerButton } from './master-data-power-button';
import {
  MasterDataDateRangeFilter,
  useMasterDataDateRange,
} from './master-data-date-range-filter';

import type {
  MasterDataListQuery,
  MasterDataRecord,
  MasterDataResource,
  MasterDataStatus,
  MasterTerminalType,
} from '@nora/contracts';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
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
import { MasterDataFilterActions } from './master-data-filter-actions';
import { MasterDataFilterBar } from './master-data-filter-bar';
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
}[] = [
  {
    resource: 'countries',
    label: 'کشورها و شهرها',
    icon: Globe2,
  },
  {
    resource: 'airports',
    label: 'فرودگاه‌ها',
    icon: PlaneTakeoff,
  },
  {
    resource: 'terminals',
    label: 'ترمینال‌ها',
    icon: SquareStack,
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
  const [locationRecords, setLocationRecords] = useState<{
    regions: readonly MasterDataRecord[];
    cities: readonly MasterDataRecord[];
  }>({ regions: [], cities: [] });
  const [requestState, setRequestState] = useState<RequestState>('loading');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | MasterDataStatus>('active');
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
  const [expandedCountryId, setExpandedCountryId] = useState<string | null>(
    null,
  );
  const [expandedCityId, setExpandedCityId] = useState<string | null>(null);
  const [expandedAirportId, setExpandedAirportId] = useState<string | null>(
    null,
  );
  const [citiesByCountry, setCitiesByCountry] = useState<
    Record<string, readonly MasterDataRecord[]>
  >({});
  const [airportsByCity, setAirportsByCity] = useState<
    Record<string, readonly MasterDataRecord[]>
  >({});
  const [terminalsByAirport, setTerminalsByAirport] = useState<
    Record<string, readonly MasterDataRecord[]>
  >({});
  const [formInitialValues, setFormInitialValues] =
    useState<Record<string, string>>();
  const [lockedFormFields, setLockedFormFields] = useState<readonly string[]>(
    [],
  );
  const [formParent, setFormParent] = useState<{
    kind: 'country' | 'city' | 'airport';
    id: string;
  }>();
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
  const [formResource, setFormResource] = useState<GeographyResource | null>(
    null,
  );
  const [selected, setSelected] = useState<MasterDataRecord | undefined>();
  const [notice, setNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const definition = getMasterDataDefinition(resource);
  const isLocationView = resource === 'regions' || resource === 'cities';
  const formDefinition = getMasterDataDefinition(formResource ?? resource);

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
  const {
    filters: dateFilters,
    props: dateRangeProps,
    reset: resetDateRange,
  } = useMasterDataDateRange(() => setPage(1));

  const load = useCallback(async () => {
    setRequestState('loading');
    const baseQuery: MasterDataListQuery = {
      ...columnFilters,
      ...dateFilters,
      search,
      status,
      sortBy,
      sortDirection: 'asc',
      page,
      pageSize: 25,
      ...scopedFilters,
    };
    try {
      if (isLocationView) {
        const locationQuery: MasterDataListQuery = {
          ...dateFilters,
          search,
          status,
          sortBy,
          sortDirection: 'asc',
          page: 1,
          pageSize: 100,
          ...(countryId !== 'all' ? { countryId } : {}),
        };
        const [regionsResult, citiesResult, activeRegions, activeCities] =
          await Promise.all([
            masterDataApi.list('regions', locationQuery),
            masterDataApi.list('cities', {
              ...locationQuery,
              ...(regionId !== 'all' ? { regionId } : {}),
            }),
            masterDataApi.listSummary('regions', {
              ...locationQuery,
              search: '',
              status: 'active',
            }),
            masterDataApi.listSummary('cities', {
              ...locationQuery,
              search: '',
              status: 'active',
              ...(regionId !== 'all' ? { regionId } : {}),
            }),
          ]);
        setLocationRecords({
          regions: regionsResult.data,
          cities: citiesResult.data,
        });
        setRecords(regionsResult.data);
        setLocationTotals({
          regions: regionsResult.meta.total,
          activeRegions: activeRegions.meta.total,
          cities: citiesResult.meta.total,
          activeCities: activeCities.meta.total,
        });
        setTotal(regionsResult.meta.total + citiesResult.meta.total);
        setActiveTotal(activeRegions.meta.total + activeCities.meta.total);
        setInternationalTotal(0);
        setRequestState('ready');
        return;
      }
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
      const [listResult, activeResult, internationalResult] =
        (await Promise.all(requests)) as [
          Awaited<ReturnType<typeof masterDataApi.list>>,
          Awaited<ReturnType<typeof masterDataApi.list>>,
          Awaited<ReturnType<typeof masterDataApi.list>> | undefined,
        ];
      setRecords(listResult.data);
      setTotal(listResult.meta.total);
      setActiveTotal(activeResult.meta.total);
      setInternationalTotal(internationalResult?.meta.total ?? 0);
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
    countryId,
    dateFilters,
    isLocationView,
    page,
    regionId,
    resource,
    scopedFilters,
    search,
    sortBy,
    status,
  ]);

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
    setFormResource(null);
    setSearch('');
    resetColumnFilters();
    setStatus('active');
    setSortBy('name');
    setPage(1);
    setCountryId('all');
    setRegionId('all');
    setCityId('all');
    setAirportId('all');
    setTerminalType('all');
    setSelected(undefined);
    setExpandedCountryId(null);
    setExpandedCityId(null);
    setExpandedAirportId(null);
    setNotice(null);
  }

  async function persist(values: Record<string, string>) {
    const target = formResource ?? resource;
    const targetDefinition = getMasterDataDefinition(target);
    if (formMode === 'edit' && selected) {
      await masterDataApi.update(target, selected.id, {
        values,
        version: selected.version,
      });
      setNotice(`${targetDefinition.singularLabel} با موفقیت ویرایش شد.`);
    } else {
      await masterDataApi.create(target, { values });
      setNotice(`${targetDefinition.singularLabel} با موفقیت ایجاد شد.`);
    }
    setFormMode(null);
    setFormResource(null);
    setFormInitialValues(undefined);
    setLockedFormFields([]);
    await load();
    try {
      if (formParent?.kind === 'country')
        await loadCountryCities(formParent.id);
      if (formParent?.kind === 'city') await loadCityAirports(formParent.id);
      if (formParent?.kind === 'airport')
        await loadAirportTerminals(formParent.id);
    } catch {
      setNotice(
        `${targetDefinition.singularLabel} ذخیره شد، اما تازه‌سازی فهرست زیرمجموعه ناموفق بود. از دکمه تازه‌سازی دوباره تلاش کنید.`,
      );
    }
    setFormParent(undefined);
  }

  async function loadCountryCities(id: string) {
    const response = await masterDataApi.list('cities', {
      ...referenceQuery,
      countryId: id,
      status: 'all',
    });
    setCitiesByCountry((current) => ({ ...current, [id]: response.data }));
  }

  async function loadCityAirports(id: string) {
    const response = await masterDataApi.list('airports', {
      ...referenceQuery,
      cityId: id,
      status: 'all',
    });
    setAirportsByCity((current) => ({ ...current, [id]: response.data }));
  }

  async function loadAirportTerminals(id: string) {
    const response = await masterDataApi.list('terminals', {
      ...referenceQuery,
      airportId: id,
      status: 'all',
    });
    setTerminalsByAirport((current) => ({ ...current, [id]: response.data }));
  }

  async function toggleCountry(record: MasterDataRecord) {
    if (expandedCountryId === record.id) {
      setExpandedCountryId(null);
      setExpandedCityId(null);
      setExpandedAirportId(null);
      return;
    }
    setExpandedCountryId(record.id);
    setExpandedCityId(null);
    setExpandedAirportId(null);
    try {
      await loadCountryCities(record.id);
    } catch {
      setNotice('دریافت شهرهای کشور ناموفق بود؛ دوباره تلاش کنید.');
    }
  }

  async function toggleCity(record: MasterDataRecord) {
    if (expandedCityId === record.id) {
      setExpandedCityId(null);
      setExpandedAirportId(null);
      return;
    }
    setExpandedCityId(record.id);
    setExpandedAirportId(null);
    try {
      await loadCityAirports(record.id);
    } catch {
      setNotice('دریافت فرودگاه‌های شهر ناموفق بود؛ دوباره تلاش کنید.');
    }
  }

  async function toggleAirport(record: MasterDataRecord) {
    if (expandedAirportId === record.id) {
      setExpandedAirportId(null);
      return;
    }
    setExpandedAirportId(record.id);
    try {
      await loadAirportTerminals(record.id);
    } catch {
      setNotice('دریافت ترمینال‌های فرودگاه ناموفق بود؛ دوباره تلاش کنید.');
    }
  }

  async function afterDelete() {
    setSelected(undefined);
    setFormMode(null);
    setNotice('رکورد با موفقیت حذف شد.');
    if (records.length === 1 && page > 1) setPage(page - 1);
    else await load();
    await refreshExpandedRelations();
  }

  async function afterStatusChange() {
    setNotice('وضعیت رکورد با موفقیت تغییر کرد.');
    await load();
    await refreshExpandedRelations();
  }

  async function refreshExpandedRelations() {
    const refreshes = [
      ...(expandedCountryId ? [loadCountryCities(expandedCountryId)] : []),
      ...(expandedCityId ? [loadCityAirports(expandedCityId)] : []),
      ...(expandedAirportId ? [loadAirportTerminals(expandedAirportId)] : []),
    ];
    const results = await Promise.allSettled(refreshes);
    if (results.some((result) => result.status === 'rejected'))
      setNotice(
        'وضعیت ذخیره شد، اما تازه‌سازی بخشی از زیرمجموعه‌ها ناموفق بود.',
      );
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const file = await masterDataApi.downloadExcel({
        resource,
        format: 'xlsx',
        filters: {
          ...columnFilters,
          ...dateFilters,
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

  function openCreate(target: GeographyResource) {
    setSelected(undefined);
    setFormInitialValues(undefined);
    setLockedFormFields([]);
    setFormParent(undefined);
    setFormResource(target);
    setFormMode('create');
  }

  function openRelatedCreate(
    target: GeographyResource,
    parent: MasterDataRecord,
  ) {
    setSelected(undefined);
    setFormResource(target);
    setFormMode('create');
    if (target === 'cities') {
      setFormInitialValues({ countryId: parent.id, regionId: '' });
      setLockedFormFields(['countryId']);
      setFormParent({ kind: 'country', id: parent.id });
    } else if (target === 'airports') {
      setFormInitialValues({
        countryId: String(parent.attributes.countryId ?? ''),
        cityId: parent.id,
      });
      setLockedFormFields(['countryId', 'cityId']);
      setFormParent({ kind: 'city', id: parent.id });
    } else {
      setFormInitialValues({ airportId: parent.id });
      setLockedFormFields(['airportId']);
      setFormParent({ kind: 'airport', id: parent.id });
    }
  }

  function openRecord(record: MasterDataRecord, mode: MasterDataFormMode) {
    setSelected(record);
    setFormInitialValues(undefined);
    setLockedFormFields([]);
    setFormParent(undefined);
    setFormResource(record.resource as GeographyResource);
    setFormMode(mode);
  }

  function renderLocationTable(
    target: Extract<GeographyResource, 'regions' | 'cities'>,
    rows: readonly MasterDataRecord[],
  ) {
    const tableColumns = geographyColumns(target);
    const label = target === 'regions' ? 'استان‌ها' : 'شهرهای وابسته';
    const Icon = target === 'regions' ? Layers3 : MapPin;
    return (
      <Card className="overflow-x-auto">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2 font-black">
            <Icon aria-hidden="true" className="size-4 text-sky-600" />
            {label}
          </div>
          <Badge>{rows.length.toLocaleString('fa-IR')} رکورد</Badge>
        </div>
        {rows.length ? (
          <table
            aria-label={`فهرست ${label}`}
            className="w-full min-w-[64rem] text-sm"
          >
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                {tableColumns.map((column) => (
                  <th className="p-4 text-start" key={column}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((record) => (
                <tr
                  className="border-t border-border transition hover:bg-sky-500/[0.035]"
                  key={record.id}
                >
                  {recordCells(target, record, actorNames).map(
                    (cell, index) => (
                      <td className="p-4" key={tableColumns[index]}>
                        {cell}
                      </td>
                    ),
                  )}
                  <td className="p-4">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        aria-label={`مشاهده ${record.name}`}
                        onClick={() => openRecord(record, 'view')}
                        size="icon"
                        title={`مشاهده ${record.name}`}
                        variant="outline"
                      >
                        <Eye aria-hidden="true" className="size-4" />
                      </Button>
                      <Button
                        aria-label={`ویرایش ${record.name}`}
                        onClick={() => openRecord(record, 'edit')}
                        size="icon"
                        title={`ویرایش ${record.name}`}
                        variant="outline"
                      >
                        <FilePenLine aria-hidden="true" className="size-4" />
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
        ) : (
          <div className="p-5 text-sm text-muted-foreground">
            با فیلتر فعلی {label}ی پیدا نشد.
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="min-w-0 max-w-full space-y-5" dir="rtl">
      <PageHeader
        actions={
          <Link
            className={`${buttonVariants({ variant: 'outline' })} ms-auto`}
            href="/master-data"
          >
            <ArrowRight aria-hidden="true" className="size-4" />
            همه بخش‌ها
          </Link>
        }
        title={isLocationView ? 'شهرها و استان‌ها' : definition.label}
      />

      {notice ? <Alert description={notice} title="نتیجه عملیات" /> : null}

      <div className="flex w-full flex-col items-end gap-3 sm:flex-row sm:justify-end">
        <div className="flex flex-wrap justify-end gap-2">
          {isLocationView ? (
            <>
              <Button onClick={() => openCreate('regions')}>
                <Plus aria-hidden="true" className="size-4" /> افزودن استان
              </Button>
              <Button onClick={() => openCreate('cities')} variant="outline">
                <Plus aria-hidden="true" className="size-4" /> افزودن شهر
              </Button>
            </>
          ) : (
            <Button onClick={() => openCreate(resource)}>
              <Plus aria-hidden="true" className="size-4" />
              افزودن {definition.singularLabel}
            </Button>
          )}
          {!['countries', 'regions', 'cities'].includes(resource) ? (
            <Button
              loading={exporting}
              onClick={() => void exportExcel()}
              variant="outline"
            >
              <FileSpreadsheet aria-hidden="true" className="size-4" />
              خروجی اکسل
            </Button>
          ) : null}
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
      </Card>

      <MasterDataKpiGrid
        items={kpis}
        label={`شاخص‌های ${isLocationView ? 'شهرها و استان‌ها' : definition.label}`}
      />

      <MasterDataFilterBar>
        {columnFilterControls}
        <MasterDataDateRangeFilter
          idPrefix="geography-created"
          {...dateRangeProps}
        />
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
        {isLocationView || resource === 'airports' ? (
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
        {isLocationView || resource === 'airports' ? (
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
        <MasterDataFilterActions
          onClear={() => {
            setSearch('');
            resetColumnFilters();
            resetDateRange();
            setStatus('active');
            setSortBy('name');
            setCountryId('all');
            setRegionId('all');
            setCityId('all');
            setAirportId('all');
            setTerminalType('all');
            setPage(1);
          }}
          onRefresh={() => void load()}
        />
      </MasterDataFilterBar>

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
      ) : isLocationView ? (
        <div className="space-y-4">
          {renderLocationTable('regions', locationRecords.regions)}
          {renderLocationTable('cities', locationRecords.cities)}
        </div>
      ) : records.length === 0 ? (
        <EmptyState
          action={
            <Button
              onClick={() => {
                openCreate(resource);
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
          <table
            aria-label={`فهرست ${definition.label}`}
            className="w-full min-w-[64rem] text-sm"
          >
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
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        aria-label={`مشاهده ${record.name}`}
                        onClick={() => openRecord(record, 'view')}
                        size="icon"
                        title={`مشاهده ${record.name}`}
                        variant="outline"
                      >
                        <Eye aria-hidden="true" className="size-4" />
                      </Button>
                      <Button
                        aria-label={`ویرایش ${record.name}`}
                        onClick={() => openRecord(record, 'edit')}
                        size="icon"
                        title={`ویرایش ${record.name}`}
                        variant="outline"
                      >
                        <FilePenLine aria-hidden="true" className="size-4" />
                      </Button>
                      <MasterDataDeleteButton
                        record={record}
                        onDeleted={afterDelete}
                      />
                      <MasterDataPowerButton
                        record={record}
                        onChanged={afterStatusChange}
                      />
                      {resource === 'countries' ? (
                        <Button
                          aria-expanded={expandedCountryId === record.id}
                          aria-label={`${expandedCountryId === record.id ? 'بستن' : 'مدیریت'} شهرهای ${record.name}`}
                          onClick={() => void toggleCountry(record)}
                          size="icon"
                          title="شهرها و فرودگاه‌های کشور"
                          variant="outline"
                        >
                          <ChevronDown
                            aria-hidden="true"
                            className={`size-4 transition-transform ${expandedCountryId === record.id ? 'rotate-180' : ''}`}
                          />
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {resource === 'countries' && expandedCountryId
            ? (() => {
                const country = records.find(
                  (item) => item.id === expandedCountryId,
                );
                if (!country) return null;
                const cities = citiesByCountry[country.id] ?? [];
                return (
                  <section
                    aria-label={`شهرها و فرودگاه‌های ${country.name}`}
                    className="space-y-3 border-t border-border bg-muted/20 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-bold">شهرهای {country.name}</h3>
                      <Button
                        onClick={() => openRelatedCreate('cities', country)}
                        size="sm"
                      >
                        <Plus aria-hidden="true" className="size-4" /> افزودن
                        شهر
                      </Button>
                    </div>
                    {cities.length ? (
                      cities.map((city) => {
                        const airports = airportsByCity[city.id] ?? [];
                        return (
                          <article
                            className="space-y-2 rounded-xl border border-border bg-background p-3"
                            key={city.id}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <MapPin
                                  aria-hidden="true"
                                  className="size-4 text-sky-600"
                                />
                                <span className="font-semibold">
                                  {city.name}
                                </span>
                                <Badge>{city.code}</Badge>
                                {statusBadge(city)}
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  aria-expanded={expandedCityId === city.id}
                                  onClick={() => void toggleCity(city)}
                                  size="sm"
                                  variant="outline"
                                >
                                  <PlaneTakeoff
                                    aria-hidden="true"
                                    className="size-4"
                                  />{' '}
                                  فرودگاه‌ها
                                  {airportsByCity[city.id]
                                    ? ` (${airports.length})`
                                    : ''}
                                </Button>
                                <Button
                                  aria-label={`مشاهده ${city.name}`}
                                  onClick={() => openRecord(city, 'view')}
                                  size="icon"
                                  variant="outline"
                                >
                                  <Eye aria-hidden="true" className="size-4" />
                                </Button>
                                <Button
                                  aria-label={`ویرایش ${city.name}`}
                                  onClick={() => openRecord(city, 'edit')}
                                  size="icon"
                                  variant="outline"
                                >
                                  <FilePenLine
                                    aria-hidden="true"
                                    className="size-4"
                                  />
                                </Button>
                                <MasterDataDeleteButton
                                  onDeleted={afterDelete}
                                  record={city}
                                />
                                <MasterDataPowerButton
                                  onChanged={afterStatusChange}
                                  record={city}
                                />
                              </div>
                            </div>
                            {expandedCityId === city.id ? (
                              <div className="space-y-2 border-s-2 border-sky-200 ps-4">
                                <div className="flex justify-end">
                                  <Button
                                    onClick={() =>
                                      openRelatedCreate('airports', city)
                                    }
                                    size="sm"
                                    variant="outline"
                                  >
                                    <Plus
                                      aria-hidden="true"
                                      className="size-4"
                                    />{' '}
                                    افزودن فرودگاه
                                  </Button>
                                </div>
                                {airports.length ? (
                                  airports.map((airport) => {
                                    const terminals =
                                      terminalsByAirport[airport.id] ?? [];
                                    return (
                                      <div
                                        className="space-y-2 rounded-lg border border-border p-3"
                                        key={airport.id}
                                      >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <div className="flex items-center gap-2">
                                            <PlaneTakeoff
                                              aria-hidden="true"
                                              className="size-4 text-sky-600"
                                            />
                                            <span>{airport.name}</span>
                                            <Badge>{airport.code}</Badge>
                                            {statusBadge(airport)}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Button
                                              aria-expanded={
                                                expandedAirportId === airport.id
                                              }
                                              onClick={() =>
                                                void toggleAirport(airport)
                                              }
                                              size="sm"
                                              variant="outline"
                                            >
                                              ترمینال‌ها
                                              {terminalsByAirport[airport.id]
                                                ? ` (${terminals.length})`
                                                : ''}
                                            </Button>
                                            <Button
                                              aria-label={`مشاهده ${airport.name}`}
                                              onClick={() =>
                                                openRecord(airport, 'view')
                                              }
                                              size="icon"
                                              variant="outline"
                                            >
                                              <Eye
                                                aria-hidden="true"
                                                className="size-4"
                                              />
                                            </Button>
                                            <Button
                                              aria-label={`ویرایش ${airport.name}`}
                                              onClick={() =>
                                                openRecord(airport, 'edit')
                                              }
                                              size="icon"
                                              variant="outline"
                                            >
                                              <FilePenLine
                                                aria-hidden="true"
                                                className="size-4"
                                              />
                                            </Button>
                                            <MasterDataDeleteButton
                                              onDeleted={afterDelete}
                                              record={airport}
                                            />
                                            <MasterDataPowerButton
                                              onChanged={afterStatusChange}
                                              record={airport}
                                            />
                                          </div>
                                        </div>
                                        {expandedAirportId === airport.id ? (
                                          <div className="space-y-2 border-s-2 border-sky-200 ps-4">
                                            <div className="flex justify-end">
                                              <Button
                                                onClick={() =>
                                                  openRelatedCreate(
                                                    'terminals',
                                                    airport,
                                                  )
                                                }
                                                size="sm"
                                                variant="outline"
                                              >
                                                <Plus
                                                  aria-hidden="true"
                                                  className="size-4"
                                                />{' '}
                                                افزودن ترمینال
                                              </Button>
                                            </div>
                                            {terminals.length ? (
                                              terminals.map((terminal) => (
                                                <div
                                                  className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/30 p-2"
                                                  key={terminal.id}
                                                >
                                                  <span>
                                                    {terminal.name} ·{' '}
                                                    {terminalLabels[
                                                      attribute(
                                                        terminal,
                                                        'terminalType',
                                                      )
                                                    ] ??
                                                      attribute(
                                                        terminal,
                                                        'terminalType',
                                                      )}
                                                  </span>
                                                  <div className="flex items-center gap-2">
                                                    <Button
                                                      aria-label={`مشاهده ${terminal.name}`}
                                                      onClick={() =>
                                                        openRecord(
                                                          terminal,
                                                          'view',
                                                        )
                                                      }
                                                      size="icon"
                                                      variant="outline"
                                                    >
                                                      <Eye
                                                        aria-hidden="true"
                                                        className="size-4"
                                                      />
                                                    </Button>
                                                    <Button
                                                      aria-label={`ویرایش ${terminal.name}`}
                                                      onClick={() =>
                                                        openRecord(
                                                          terminal,
                                                          'edit',
                                                        )
                                                      }
                                                      size="icon"
                                                      variant="outline"
                                                    >
                                                      <FilePenLine
                                                        aria-hidden="true"
                                                        className="size-4"
                                                      />
                                                    </Button>
                                                    <MasterDataDeleteButton
                                                      onDeleted={afterDelete}
                                                      record={terminal}
                                                    />
                                                    <MasterDataPowerButton
                                                      onChanged={
                                                        afterStatusChange
                                                      }
                                                      record={terminal}
                                                    />
                                                  </div>
                                                </div>
                                              ))
                                            ) : (
                                              <p className="text-sm text-muted-foreground">
                                                ترمینالی ثبت نشده؛ افزودن
                                                ترمینال اختیاری است.
                                              </p>
                                            )}
                                          </div>
                                        ) : null}
                                      </div>
                                    );
                                  })
                                ) : (
                                  <p className="text-sm text-muted-foreground">
                                    فرودگاهی ثبت نشده؛ افزودن فرودگاه اختیاری
                                    است.
                                  </p>
                                )}
                              </div>
                            ) : null}
                          </article>
                        );
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        شهری ثبت نشده؛ برای این کشور می‌توانید چند شهر اضافه
                        کنید.
                      </p>
                    )}
                  </section>
                );
              })()
            : null}
        </Card>
      )}

      {!isLocationView ? (
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

      {formMode && formDefinition.key === 'terminals' ? (
        <MasterDataTerminalForm
          key={`${formMode}-${selected?.id ?? 'new'}`}
          mode={formMode}
          actorNames={actorNames}
          {...(formInitialValues ? { initialValues: formInitialValues } : {})}
          lockedFields={lockedFormFields}
          onOpenChange={() => {
            setFormMode(null);
            setFormResource(null);
            setFormInitialValues(undefined);
            setLockedFormFields([]);
            setFormParent(undefined);
          }}
          onPersist={persist}
          {...(selected ? { record: selected } : {})}
        />
      ) : formMode ? (
        <MasterDataLiveForm
          definition={formDefinition}
          key={`${formDefinition.key}-${formMode}-${selected?.id ?? 'new'}`}
          mode={formMode}
          onOpenChange={(open) => {
            if (!open) {
              setFormMode(null);
              setFormResource(null);
            }
          }}
          onPersist={persist}
          open
          {...(formInitialValues ? { initialValues: formInitialValues } : {})}
          lockedFields={lockedFormFields}
          {...(selected ? { record: selected } : {})}
        />
      ) : null}
    </div>
  );
}
