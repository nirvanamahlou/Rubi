'use client';

import type {
  MasterAccommodationSummary,
  MasterDataRecord,
  MasterDataResource,
  MasterDataStatus,
} from '@rubi/contracts';
import {
  ArrowRight,
  BedDouble,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  Eye,
  FilePenLine,
  FileSpreadsheet,
  FilterX,
  Hotel,
  ImageIcon,
  Layers3,
  Link2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  UtensilsCrossed,
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
import { HotelImportPanel } from './hotel-import-panel';
import {
  MasterDataLiveForm,
  type MasterDataFormMode,
} from './master-data-live-form';
import {
  MasterDataKpiGrid,
  type MasterDataKpiItem,
} from './master-data-kpi-grid';
import { MasterDataProfileDialog } from './master-data-profile-dialog';

type AccommodationTab =
  | 'hotels'
  | 'chains'
  | 'room-types'
  | 'meals'
  | 'facilities'
  | 'import'
  | 'combined';
type RequestState = 'loading' | 'ready' | 'error' | 'forbidden';

const tabs = [
  { id: 'hotels', label: 'هتل‌ها', icon: Hotel },
  { id: 'chains', label: 'زنجیره هتل', icon: Link2 },
  { id: 'room-types', label: 'نوع اتاق', icon: BedDouble },
  { id: 'meals', label: 'وعده و سرویس', icon: UtensilsCrossed },
  { id: 'facilities', label: 'امکانات', icon: Sparkles },
  { id: 'import', label: 'ورود گروهی Excel', icon: Upload },
  { id: 'combined', label: 'هتل ترکیبی', icon: Layers3 },
] as const;

const copy: Record<
  AccommodationTab,
  { title: string; description: string; action: string }
> = {
  hotels: {
    title: 'هتل‌ها',
    description: 'مدیریت مشخصات مرجع، موقعیت، تصاویر و فروش‌پذیری عمومی هتل‌ها',
    action: 'افزودن هتل',
  },
  chains: {
    title: 'زنجیره هتل',
    description: 'گروه‌بندی هتل‌های یک برند با کشور مبدأ و اطلاعات مرجع',
    action: 'افزودن زنجیره',
  },
  'room-types': {
    title: 'نوع اتاق',
    description: 'کاتالوگ استاندارد نوع اتاق با عنوان دوزبانه، ظرفیت و وضعیت',
    action: 'افزودن نوع اتاق',
  },
  meals: {
    title: 'وعده غذایی و سرویس',
    description: 'کاتالوگ مستقل Meal Plan و Service Code با وعده‌های شامل‌شده',
    action: 'افزودن سرویس',
  },
  facilities: {
    title: 'امکانات هتل',
    description:
      'کاتالوگ مستقل امکانات، دسته‌بندی، آیکن و ارتباط چندبه‌چند با هتل',
    action: 'افزودن امکان',
  },
  import: {
    title: 'ورود گروهی هتل از Excel',
    description:
      'Import کنترل‌شده براساس Template رسمی، Mapping، Validation و جلوگیری از ثبت دوباره',
    action: 'Import جدید',
  },
  combined: {
    title: 'هتل ترکیبی',
    description:
      'رکورد نمایشی فروش متشکل از چند هتل واقعی با اولویت و شرایط استفاده',
    action: 'افزودن هتل ترکیبی',
  },
};

const emptySummary: MasterAccommodationSummary = {
  hotels: { total: 0, saleable: 0, countries: 0, cities: 0, incomplete: 0 },
  chains: { total: 0, active: 0, memberHotels: 0, incomplete: 0 },
  roomTypes: {
    total: 0,
    active: 0,
    standardCapacity: 0,
    pendingDomainApproval: 0,
  },
  mealServices: { total: 0, active: 0, mealPlans: 0, needsReview: 0 },
  facilities: { total: 0, active: 0, categories: 0, missingIcon: 0 },
  compositeHotels: {
    total: 0,
    active: 0,
    uniqueMemberHotels: 0,
    needsReview: 0,
  },
};

function resourceFor(tab: AccommodationTab): MasterDataResource {
  if (tab === 'chains') return 'hotel-chains';
  if (tab === 'room-types') return 'room-types';
  if (tab === 'meals') return 'meal-services';
  if (tab === 'facilities') return 'facilities';
  if (tab === 'combined') return 'composite-hotels';
  return 'hotels';
}

function attribute(record: MasterDataRecord, key: string, fallback = '—') {
  const value = record.attributes[key];
  return value === null || value === undefined || value === ''
    ? fallback
    : String(value);
}

function chips(value: string) {
  const values = value.split(',').filter(Boolean);
  return values.length ? (
    <div className="flex max-w-72 flex-wrap gap-1.5">
      {values.slice(0, 4).map((item) => (
        <Badge className="bg-primary/8 text-primary" key={item}>
          {item}
        </Badge>
      ))}
      {values.length > 4 ? <Badge>+{values.length - 4}</Badge> : null}
    </div>
  ) : (
    <span className="text-muted-foreground">—</span>
  );
}

function StatusBadge({
  record,
  saleable = false,
}: {
  record: MasterDataRecord;
  saleable?: boolean;
}) {
  const active = record.status === 'active';
  const isSaleable =
    attribute(record, 'isSaleableReference', 'true') === 'true';
  return (
    <Badge
      className={
        active && (!saleable || isSaleable)
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : active
            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
            : 'bg-muted text-muted-foreground'
      }
    >
      {!active
        ? 'غیرفعال'
        : saleable
          ? isSaleable
            ? 'فروش‌پذیر'
            : 'در حال بررسی'
          : 'فعال'}
    </Badge>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border/70 pb-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}

export function MasterDataAccommodationWorkspace() {
  const [tab, setTab] = useState<AccommodationTab>('hotels');
  const [records, setRecords] = useState<readonly MasterDataRecord[]>([]);
  const [summary, setSummary] =
    useState<MasterAccommodationSummary>(emptySummary);
  const [requestState, setRequestState] = useState<RequestState>('loading');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | MasterDataStatus>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [countries, setCountries] = useState<readonly MasterDataRecord[]>([]);
  const [cities, setCities] = useState<readonly MasterDataRecord[]>([]);
  const [facilityCategories, setFacilityCategories] = useState<
    readonly string[]
  >([]);
  const [countryFilter, setCountryFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [starFilter, setStarFilter] = useState('all');
  const [capacityFilter, setCapacityFilter] = useState('all');
  const [mealCategoryFilter, setMealCategoryFilter] = useState('all');
  const [facilityCategoryFilter, setFacilityCategoryFilter] = useState('all');
  const [selected, setSelected] = useState<MasterDataRecord>();
  const [profileOpen, setProfileOpen] = useState(false);
  const [formMode, setFormMode] = useState<MasterDataFormMode | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const current = copy[tab];
  const resource = resourceFor(tab);
  const definition = getMasterDataDefinition(resource);
  const visibleCities = useMemo(
    () =>
      countryFilter === 'all'
        ? cities
        : cities.filter(
            (city) => attribute(city, 'countryId', '') === countryFilter,
          ),
    [cities, countryFilter],
  );
  const scopedFilters = useMemo(
    () => ({
      ...((tab === 'hotels' || tab === 'chains') && countryFilter !== 'all'
        ? { countryId: countryFilter }
        : {}),
      ...((tab === 'hotels' || tab === 'combined') && cityFilter !== 'all'
        ? { cityId: cityFilter }
        : {}),
      ...(tab === 'hotels' && starFilter !== 'all'
        ? { starRating: Number(starFilter) }
        : {}),
      ...(tab === 'room-types' && capacityFilter !== 'all'
        ? { referenceCapacity: Number(capacityFilter) }
        : {}),
      ...(tab === 'meals' && mealCategoryFilter !== 'all'
        ? {
            mealServiceCategory: mealCategoryFilter as 'MEAL_PLAN' | 'SERVICE',
          }
        : {}),
      ...(tab === 'facilities' && facilityCategoryFilter !== 'all'
        ? { facilityCategory: facilityCategoryFilter }
        : {}),
    }),
    [
      capacityFilter,
      cityFilter,
      countryFilter,
      facilityCategoryFilter,
      mealCategoryFilter,
      starFilter,
      tab,
    ],
  );

  const loadSummary = useCallback(async () => {
    try {
      const response = await masterDataApi.accommodationSummary();
      setSummary(response.data);
    } catch {
      setSummary(emptySummary);
    }
  }, []);

  const load = useCallback(async () => {
    if (tab === 'import') {
      setRequestState('ready');
      return;
    }
    setRequestState('loading');
    try {
      const response = await masterDataApi.list(resource, {
        search,
        status,
        sortBy: 'name',
        sortDirection: 'asc',
        page,
        pageSize: 25,
        ...scopedFilters,
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
  }, [page, resource, scopedFilters, search, status, tab]);

  useEffect(() => {
    let cancelled = false;
    async function loadOptions(optionResource: MasterDataResource) {
      const rows: MasterDataRecord[] = [];
      for (let optionPage = 1; ; optionPage += 1) {
        const response = await masterDataApi.list(optionResource, {
          search: '',
          status: 'active',
          sortBy: 'name',
          sortDirection: 'asc',
          page: optionPage,
          pageSize: 100,
        });
        rows.push(...response.data);
        if (rows.length >= response.meta.total) return rows;
      }
    }
    void Promise.all([
      loadOptions('countries'),
      loadOptions('cities'),
      loadOptions('facilities'),
    ])
      .then(([countryRows, cityRows, facilityRows]) => {
        if (cancelled) return;
        setCountries(countryRows);
        setCities(cityRows);
        setFacilityCategories(
          [
            ...new Set(
              facilityRows
                .map((record) => attribute(record, 'category', ''))
                .filter(Boolean),
            ),
          ].sort((left, right) => left.localeCompare(right, 'fa')),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSummary(), 0);
    return () => window.clearTimeout(timer);
  }, [loadSummary]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 200);
    return () => window.clearTimeout(timer);
  }, [load]);

  const kpis = useMemo<readonly MasterDataKpiItem[]>(() => {
    if (tab === 'hotels')
      return [
        {
          label: 'کل هتل‌ها',
          value: summary.hotels.total,
          icon: Hotel,
          tone: 'sky',
        },
        {
          label: 'فروش‌پذیر',
          value: summary.hotels.saleable,
          icon: CheckCircle2,
          tone: 'emerald',
        },
        {
          label: 'کشورها / شهرها',
          value: `${summary.hotels.countries.toLocaleString('fa-IR')} / ${summary.hotels.cities.toLocaleString('fa-IR')}`,
          icon: MapPin,
          tone: 'violet',
        },
        {
          label: 'نیازمند تکمیل',
          value: summary.hotels.incomplete,
          icon: CircleAlert,
          tone: 'amber',
        },
      ];
    if (tab === 'chains')
      return [
        {
          label: 'کل زنجیره‌ها',
          value: summary.chains.total,
          icon: Link2,
          tone: 'sky',
        },
        {
          label: 'زنجیره فعال',
          value: summary.chains.active,
          icon: CheckCircle2,
          tone: 'emerald',
        },
        {
          label: 'هتل‌های عضو',
          value: summary.chains.memberHotels,
          icon: Hotel,
          tone: 'violet',
        },
        {
          label: 'نیازمند تکمیل',
          value: summary.chains.incomplete,
          icon: CircleAlert,
          tone: 'amber',
        },
      ];
    if (tab === 'room-types')
      return [
        {
          label: 'انواع اتاق',
          value: summary.roomTypes.total,
          icon: BedDouble,
          tone: 'sky',
        },
        {
          label: 'نوع فعال',
          value: summary.roomTypes.active,
          icon: CheckCircle2,
          tone: 'emerald',
        },
        {
          label: 'دارای ظرفیت استاندارد',
          value: summary.roomTypes.standardCapacity,
          icon: Users,
          tone: 'violet',
        },
        {
          label: 'نیازمند تأیید دامنه',
          value: summary.roomTypes.pendingDomainApproval,
          icon: CircleAlert,
          tone: 'amber',
        },
      ];
    if (tab === 'meals')
      return [
        {
          label: 'کدهای سرویس',
          value: summary.mealServices.total,
          icon: UtensilsCrossed,
          tone: 'sky',
        },
        {
          label: 'فعال',
          value: summary.mealServices.active,
          icon: CheckCircle2,
          tone: 'emerald',
        },
        {
          label: 'Meal Plan',
          value: summary.mealServices.mealPlans,
          icon: Layers3,
          tone: 'violet',
        },
        {
          label: 'نیازمند بازبینی',
          value: summary.mealServices.needsReview,
          icon: CircleAlert,
          tone: 'amber',
        },
      ];
    if (tab === 'facilities')
      return [
        {
          label: 'کل امکانات',
          value: summary.facilities.total,
          icon: Sparkles,
          tone: 'sky',
        },
        {
          label: 'امکان فعال',
          value: summary.facilities.active,
          icon: CheckCircle2,
          tone: 'emerald',
        },
        {
          label: 'دسته‌ها',
          value: summary.facilities.categories,
          icon: Layers3,
          tone: 'violet',
        },
        {
          label: 'فاقد آیکن',
          value: summary.facilities.missingIcon,
          icon: ImageIcon,
          tone: 'amber',
        },
      ];
    if (tab === 'combined')
      return [
        {
          label: 'هتل‌های ترکیبی',
          value: summary.compositeHotels.total,
          icon: Layers3,
          tone: 'sky',
        },
        {
          label: 'فعال',
          value: summary.compositeHotels.active,
          icon: CheckCircle2,
          tone: 'emerald',
        },
        {
          label: 'هتل عضو یکتا',
          value: summary.compositeHotels.uniqueMemberHotels,
          icon: Hotel,
          tone: 'violet',
        },
        {
          label: 'نیازمند بازبینی',
          value: summary.compositeHotels.needsReview,
          icon: CircleAlert,
          tone: 'amber',
        },
      ];
    return [];
  }, [summary, tab]);

  function changeTab(next: AccommodationTab) {
    setTab(next);
    setSearch('');
    setStatus('all');
    setPage(1);
    setCountryFilter('all');
    setCityFilter('all');
    setStarFilter('all');
    setCapacityFilter('all');
    setMealCategoryFilter('all');
    setFacilityCategoryFilter('all');
    setSelected(undefined);
    setProfileOpen(false);
    setNotice(null);
    setFormMode(null);
  }

  function selectProfile(record: MasterDataRecord) {
    setSelected(record);
    setProfileOpen(true);
  }

  async function persist(values: Record<string, string>) {
    try {
      if (formMode === 'edit' && selected) {
        await masterDataApi.update(resource, selected.id, {
          values,
          version: selected.version,
        });
        setNotice(
          `${definition.singularLabel} با ثبت Audit و نسخه جدید ویرایش شد.`,
        );
      } else {
        await masterDataApi.create(resource, { values });
        setNotice(`${definition.singularLabel} با کد داخلی خودکار ثبت شد.`);
      }
      setFormMode(null);
      await Promise.all([load(), loadSummary()]);
    } catch (error) {
      throw new Error(
        error instanceof Error ? error.message : 'ذخیره اطلاعات ناموفق بود.',
      );
    }
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

  async function toggleStatus(record: MasterDataRecord) {
    try {
      await masterDataApi.setStatus(
        record.resource,
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
    if (tab === 'import') return;
    setExporting(true);
    try {
      const response = await masterDataApi.downloadExcel({
        resource,
        format: 'xlsx',
        filters: {
          search,
          status,
          sortBy: 'name',
          sortDirection: 'asc',
          ...scopedFilters,
        },
        columns: definition.fields.map((field) => field.key),
        locale: 'fa-IR',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      const url = URL.createObjectURL(response.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = response.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice('خروجی Excel فیلترشده دریافت شد.');
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'خروجی Excel ناموفق بود.',
      );
    } finally {
      setExporting(false);
    }
  }

  function actions(record: MasterDataRecord) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            if (record.resource === 'hotels') selectProfile(record);
            else {
              setSelected(record);
              setFormMode('view');
            }
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
        <MasterDataDeleteButton record={record} onDeleted={afterDelete} />
        <Button
          onClick={() => void toggleStatus(record)}
          size="sm"
          variant="ghost"
        >
          {record.status === 'active' ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
        </Button>
      </div>
    );
  }

  function contextualFilters() {
    const countrySelect =
      tab === 'hotels' || tab === 'chains' ? (
        <FormField label={tab === 'chains' ? 'کشور مبدأ' : 'کشور'}>
          <Select
            onValueChange={(value) => {
              setCountryFilter(value);
              if (
                cityFilter !== 'all' &&
                !cities.some(
                  (city) =>
                    city.id === cityFilter &&
                    attribute(city, 'countryId', '') === value,
                )
              )
                setCityFilter('all');
              setPage(1);
            }}
            value={countryFilter}
          >
            <SelectTrigger aria-label="فیلتر کشور">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه کشورها</SelectItem>
              {countries.map((country) => (
                <SelectItem key={country.id} value={country.id}>
                  {country.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      ) : null;

    const citySelect =
      tab === 'hotels' || tab === 'combined' ? (
        <FormField label="شهر">
          <Select
            onValueChange={(value) => {
              setCityFilter(value);
              setPage(1);
            }}
            value={cityFilter}
          >
            <SelectTrigger aria-label="فیلتر شهر">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه شهرها</SelectItem>
              {visibleCities.map((city) => (
                <SelectItem key={city.id} value={city.id}>
                  {city.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      ) : null;

    if (tab === 'hotels')
      return (
        <>
          {countrySelect}
          {citySelect}
          <FormField label="درجه">
            <Select
              onValueChange={(value) => {
                setStarFilter(value);
                setPage(1);
              }}
              value={starFilter}
            >
              <SelectTrigger aria-label="فیلتر درجه هتل">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه درجات</SelectItem>
                {[5, 4, 3, 2, 1].map((rating) => (
                  <SelectItem key={rating} value={String(rating)}>
                    {rating.toLocaleString('fa-IR')} ستاره
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </>
      );
    if (tab === 'chains') return countrySelect;
    if (tab === 'combined') return citySelect;
    if (tab === 'room-types')
      return (
        <FormField label="ظرفیت استاندارد">
          <Select
            onValueChange={(value) => {
              setCapacityFilter(value);
              setPage(1);
            }}
            value={capacityFilter}
          >
            <SelectTrigger aria-label="فیلتر ظرفیت اتاق">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه ظرفیت‌ها</SelectItem>
              {[1, 2, 3, 4].map((capacity) => (
                <SelectItem key={capacity} value={String(capacity)}>
                  {capacity.toLocaleString('fa-IR')} نفر
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      );
    if (tab === 'meals')
      return (
        <FormField label="دسته">
          <Select
            onValueChange={(value) => {
              setMealCategoryFilter(value);
              setPage(1);
            }}
            value={mealCategoryFilter}
          >
            <SelectTrigger aria-label="فیلتر دسته سرویس">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه دسته‌ها</SelectItem>
              <SelectItem value="MEAL_PLAN">Meal Plan</SelectItem>
              <SelectItem value="SERVICE">Service</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      );
    if (tab === 'facilities')
      return (
        <FormField label="دسته">
          <Select
            onValueChange={(value) => {
              setFacilityCategoryFilter(value);
              setPage(1);
            }}
            value={facilityCategoryFilter}
          >
            <SelectTrigger aria-label="فیلتر دسته امکانات">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه دسته‌ها</SelectItem>
              {facilityCategories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      );
    return null;
  }

  function table() {
    const headers =
      tab === 'hotels'
        ? [
            'کد',
            'هتل',
            'کشور / شهر / منطقه',
            'زنجیره',
            'درجه',
            'امکانات منتخب',
            'تأمین‌کننده HOTEL_PROVIDER',
            'فروش‌پذیری',
            'عملیات',
          ]
        : tab === 'chains'
          ? [
              'کد',
              'نام فارسی',
              'نام انگلیسی',
              'کشور مبدأ',
              'وب‌سایت',
              'تعداد هتل عضو',
              'آخرین تغییر',
              'وضعیت',
              'عملیات',
            ]
          : tab === 'room-types'
            ? [
                'کد',
                'عنوان فارسی',
                'عنوان انگلیسی',
                'ظرفیت استاندارد',
                'توضیح استفاده',
                'مرتبط با رزرو',
                'وضعیت',
                'عملیات',
              ]
            : tab === 'meals'
              ? [
                  'کد',
                  'عنوان فارسی',
                  'عنوان انگلیسی',
                  'دسته',
                  'وعده‌های شامل‌شده',
                  'تعداد هتل مرتبط',
                  'وضعیت',
                  'عملیات',
                ]
              : [
                  'کد',
                  'آیکن',
                  'عنوان فارسی',
                  'عنوان انگلیسی',
                  'دسته',
                  'تعداد هتل مرتبط',
                  'ترتیب نمایش',
                  'وضعیت',
                  'عملیات',
                ];
    return (
      <Card className="overflow-x-auto">
        <div className="border-b border-border p-4 text-lg font-black">
          فهرست {current.title}
        </div>
        <table className="w-full min-w-[76rem] text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              {headers.map((header) => (
                <th className="p-4 text-start" key={header}>
                  {header}
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
                {tab === 'hotels' ? (
                  <>
                    <td className="p-4">
                      <button
                        className="text-start font-bold text-foreground hover:text-primary focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => selectProfile(record)}
                        type="button"
                      >
                        {record.name}
                      </button>
                      <br />
                      <small className="text-muted-foreground">
                        {attribute(record, 'englishName')}
                      </small>
                    </td>
                    <td className="p-4">
                      {attribute(record, 'countryName')} ·{' '}
                      {attribute(record, 'cityName')} ·{' '}
                      {attribute(record, 'regionName')}
                    </td>
                    <td className="p-4">
                      {attribute(record, 'chainName', 'مستقل')}
                    </td>
                    <td className="p-4 text-amber-500">
                      {'★'.repeat(Number(attribute(record, 'starRating', '0')))}
                    </td>
                    <td className="p-4">
                      {chips(attribute(record, 'facilityNames', ''))}
                    </td>
                    <td className="p-4">
                      {attribute(record, 'organizationName')}
                    </td>
                    <td className="p-4">
                      <StatusBadge record={record} saleable />
                    </td>
                  </>
                ) : tab === 'chains' ? (
                  <>
                    <td className="p-4 font-semibold">{record.name}</td>
                    <td className="p-4" dir="ltr">
                      {attribute(record, 'englishName')}
                    </td>
                    <td className="p-4">{attribute(record, 'countryName')}</td>
                    <td className="p-4" dir="ltr">
                      {attribute(record, 'website')}
                    </td>
                    <td className="p-4">
                      {Number(
                        attribute(record, 'hotelCount', '0'),
                      ).toLocaleString('fa-IR')}
                    </td>
                    <td className="p-4">
                      {new Intl.DateTimeFormat('fa-IR').format(
                        new Date(record.updatedAt),
                      )}
                    </td>
                    <td className="p-4">
                      <StatusBadge record={record} />
                    </td>
                  </>
                ) : tab === 'room-types' ? (
                  <>
                    <td className="p-4 font-semibold">{record.name}</td>
                    <td className="p-4" dir="ltr">
                      {attribute(record, 'englishName')}
                    </td>
                    <td className="p-4">
                      {attribute(record, 'referenceCapacity')} نفر
                    </td>
                    <td className="p-4">
                      {attribute(record, 'usageDescription')}
                    </td>
                    <td className="p-4 text-primary">Reservations</td>
                    <td className="p-4">
                      <StatusBadge record={record} />
                    </td>
                  </>
                ) : tab === 'meals' ? (
                  <>
                    <td className="p-4 font-semibold">{record.name}</td>
                    <td className="p-4" dir="ltr">
                      {attribute(record, 'englishName')}
                    </td>
                    <td className="p-4">
                      <Badge>
                        {attribute(record, 'category') === 'MEAL_PLAN'
                          ? 'Meal Plan'
                          : 'Service'}
                      </Badge>
                    </td>
                    <td className="p-4">
                      {chips(attribute(record, 'includedMeals', ''))}
                    </td>
                    <td className="p-4">
                      {Number(
                        attribute(record, 'hotelCount', '0'),
                      ).toLocaleString('fa-IR')}
                    </td>
                    <td className="p-4">
                      <StatusBadge record={record} />
                    </td>
                  </>
                ) : (
                  <>
                    <td className="p-4">
                      <Sparkles className="size-5 text-primary" />
                    </td>
                    <td className="p-4 font-semibold">{record.name}</td>
                    <td className="p-4" dir="ltr">
                      {attribute(record, 'englishName')}
                    </td>
                    <td className="p-4">{attribute(record, 'category')}</td>
                    <td className="p-4">
                      {Number(
                        attribute(record, 'hotelCount', '0'),
                      ).toLocaleString('fa-IR')}
                    </td>
                    <td className="p-4">
                      {attribute(record, 'displayOrder', '0')}
                    </td>
                    <td className="p-4">
                      <StatusBadge record={record} />
                    </td>
                  </>
                )}
                <td className="p-4">{actions(record)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    );
  }

  function profile() {
    if (!selected)
      return (
        <EmptyState
          description="برای مشاهده پروفایل ابتدا یک هتل ثبت یا انتخاب کنید."
          icon={Hotel}
          title="هتلی وجود ندارد"
        />
      );
    const stars = '★'.repeat(Number(attribute(selected, 'starRating', '0')));
    return (
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <div className="grid gap-5 bg-gradient-to-l from-orange-50 via-background to-sky-50 p-6 dark:from-orange-950/30 dark:to-sky-950/30 md:grid-cols-[7rem_1fr_auto]">
            <div className="grid size-28 place-items-center rounded-3xl bg-orange-100 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300">
              <Hotel className="size-12" />
            </div>
            <div>
              <h2 className="text-2xl font-black">{selected.name}</h2>
              <p className="mt-1 text-muted-foreground" dir="ltr">
                {attribute(selected, 'englishName')} · {selected.code}
              </p>
              <p className="mt-2">
                <span className="text-amber-500">{stars}</span> ·{' '}
                {attribute(selected, 'countryName')}،{' '}
                {attribute(selected, 'cityName')}،{' '}
                {attribute(selected, 'regionName')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge record={selected} saleable />
                <Badge>{attribute(selected, 'chainName', 'مستقل')}</Badge>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <small className="text-muted-foreground">Documents</small>
                <strong className="block text-xl">—</strong>
              </div>
              <div>
                <small className="text-muted-foreground">امکانات</small>
                <strong className="block text-xl">
                  {attribute(selected, 'facilityNames', '')
                    .split(',')
                    .filter(Boolean)
                    .length.toLocaleString('fa-IR')}
                </strong>
              </div>
              <div>
                <small className="text-muted-foreground">Version</small>
                <strong className="block text-xl">
                  v{selected.version.toLocaleString('fa-IR')}
                </strong>
              </div>
            </div>
          </div>
        </Card>
        <Alert
          title="منابع فروش در ماژول‌های مالک مدیریت می‌شوند"
          description="رزرو، موجودی، Voucher و تخصیص مسافر در Reservations و قرارداد و نرخ خرید در Procurement هستند."
          tone="warning"
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="mb-4 flex items-center gap-2 font-black">
              <Hotel className="size-5" /> مشخصات پایه
            </h3>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail label="کد" value={selected.code} />
              <Detail label="درجه" value={stars || '—'} />
              <Detail label="نام فارسی" value={selected.name} />
              <Detail
                label="نام انگلیسی"
                value={attribute(selected, 'englishName')}
              />
              <Detail
                label="زنجیره"
                value={attribute(selected, 'chainName', 'مستقل')}
              />
              <Detail label="وب‌سایت" value={attribute(selected, 'website')} />
            </dl>
          </Card>
          <Card className="p-5">
            <h3 className="mb-4 flex items-center gap-2 font-black">
              <MapPin className="size-5" /> موقعیت و آدرس
            </h3>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail
                label="شهر / منطقه"
                value={`${attribute(selected, 'cityName')} · ${attribute(selected, 'regionName')}`}
              />
              <Detail
                label="مختصات"
                value={`${attribute(selected, 'latitude')}, ${attribute(selected, 'longitude')}`}
              />
              <Detail label="آدرس" value={attribute(selected, 'address')} />
            </dl>
          </Card>
          <Card className="p-5">
            <h3 className="mb-4 flex items-center gap-2 font-black">
              <Clock3 className="size-5" /> زمان و سرویس
            </h3>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail
                label="ساعت ورود"
                value={attribute(selected, 'checkInTime')}
              />
              <Detail
                label="ساعت خروج"
                value={attribute(selected, 'checkOutTime')}
              />
              <Detail
                label="وعده و سرویس"
                value={attribute(selected, 'mealServiceNames')}
              />
              <Detail
                label="نوع‌های اتاق"
                value={attribute(selected, 'roomTypeNames')}
              />
            </dl>
          </Card>
          <Card className="p-5">
            <h3 className="mb-4 flex items-center gap-2 font-black">
              <ImageIcon className="size-5" /> لوگو و تصاویر با Documents
              Reference
            </h3>
            <EmptyState
              description="قرارداد واقعی Documents/Worker هنوز آماده نیست؛ آپلود یا شناسه ساختگی نمایش داده نمی‌شود."
              icon={ImageIcon}
              title="در انتظار اتصال Documents"
            />
          </Card>
        </div>
      </div>
    );
  }

  function combined() {
    return (
      <div className="space-y-4">
        {records.map((record) => {
          const names = attribute(record, 'memberHotelNames', '')
            .split(',')
            .filter(Boolean);
          const cities = attribute(record, 'memberCityNames', '').split(',');
          const backups = new Set(
            attribute(record, 'backupMemberIds', '').split(',').filter(Boolean),
          );
          const ids = attribute(record, 'memberHotelIds', '').split(',');
          return (
            <Card className="overflow-hidden" key={record.id}>
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
                <div>
                  <h3 className="text-lg font-black">{record.name}</h3>
                  <p className="text-sm text-muted-foreground" dir="ltr">
                    {attribute(record, 'englishName')} · {record.code}
                  </p>
                </div>
                <div className="flex gap-2">
                  <StatusBadge record={record} saleable />
                  {actions(record)}
                </div>
              </header>
              <p className="p-5 text-sm text-muted-foreground">
                شرط استفاده: {attribute(record, 'usageCondition')}
              </p>
              <div className="overflow-x-auto px-5 pb-5">
                <table className="w-full min-w-[44rem] text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      {[
                        'اولویت',
                        'هتل عضو',
                        'شهر / منطقه',
                        'مرجع قرارداد',
                        'وضعیت',
                      ].map((head) => (
                        <th className="p-3 text-start" key={head}>
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {names.map((name, index) => (
                      <tr
                        className="border-t border-border"
                        key={`${record.id}-${ids[index]}`}
                      >
                        <td className="p-3">
                          <Badge>{(index + 1).toLocaleString('fa-IR')}</Badge>
                        </td>
                        <td className="p-3 font-semibold">{name}</td>
                        <td className="p-3">{cities[index] || '—'}</td>
                        <td className="p-3 text-muted-foreground">
                          — · Procurement
                        </td>
                        <td className="p-3">
                          <Badge>
                            {backups.has(ids[index] ?? '') ? 'پشتیبان' : 'فعال'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          );
        })}
      </div>
    );
  }

  const content =
    requestState === 'loading' ? (
      <div aria-label="در حال بارگذاری" className="space-y-3">
        {[0, 1, 2].map((item) => (
          <Skeleton className="h-20 w-full" key={item} />
        ))}
      </div>
    ) : requestState === 'forbidden' ? (
      <EmptyState
        description="مجوز master_data.read برای این بخش لازم است."
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
        description="دریافت داده‌های اقامت از Backend ناموفق بود."
        title="خطا در دریافت اطلاعات"
      />
    ) : tab === 'import' ? (
      <div id="accommodation-import-panel">
        <HotelImportPanel
          onImported={() => void Promise.all([load(), loadSummary()])}
        />
      </div>
    ) : tab === 'combined' && records.length ? (
      combined()
    ) : records.length ? (
      table()
    ) : (
      <EmptyState
        action={
          <Button onClick={() => setFormMode('create')}>
            {current.action}
          </Button>
        }
        description="با فیلتر فعلی رکوردی پیدا نشد."
        icon={Database}
        title={`${current.title} خالی است`}
      />
    );

  const showFilters = tab !== 'import';
  const boundary =
    tab === 'import'
      ? {
          title: 'محتوای Excel فقط داده است',
          description:
            'هیچ متن داخل فایل به‌عنوان دستور اجرایی تفسیر نمی‌شود؛ ثبت نهایی نیازمند تأیید صریح کاربر است.',
        }
      : tab === 'combined'
        ? {
            title: 'هتل ترکیبی جایگزین هتل واقعی نیست',
            description:
              'رزرو و موجودی روی هتل واقعی یا قرارداد تأییدشده در Reservations و Procurement باقی می‌ماند.',
          }
        : tab === 'facilities'
          ? {
              title: 'امکانات ستون ثابت هتل نیستند',
              description:
                'هر امکان یک رکورد کاتالوگ است و از طریق رابطه چندبه‌چند به هتل متصل می‌شود.',
            }
          : tab === 'meals'
            ? {
                title: 'Meal Plan و Service رکورد کاتالوگ هستند',
                description:
                  'هر سرویس کد، عنوان و وعده‌های شامل‌شده دارد و به هتل‌ها رابطه‌ای متصل می‌شود؛ Checkbox ثابت ساخته نمی‌شود.',
              }
            : {
                title: 'قرارداد، نرخ و موجودی مالکیت این صفحه نیست',
                description:
                  'رزرو و موجودی اتاق در Reservations و قرارداد و نرخ خرید در Procurement باقی می‌ماند.',
              };

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
        description={current.description}
        title={current.title}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={tab === 'import'}
          loading={exporting}
          onClick={() => void downloadExcel()}
          variant="outline"
        >
          <FileSpreadsheet className="size-4" /> خروجی اکسل
        </Button>
        <Button
          onClick={() => {
            if (tab === 'import') {
              document
                .getElementById('accommodation-import-panel')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              return;
            }
            setSelected(undefined);
            setFormMode('create');
          }}
        >
          <Plus className="size-4" /> {current.action}
        </Button>
      </div>
      {notice ? <Alert description={notice} title="نتیجه عملیات" /> : null}
      <Card className="overflow-x-auto p-2">
        <nav
          aria-label="زیرمجموعه‌های اقامت و هتل"
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
      {kpis.length ? (
        <MasterDataKpiGrid items={kpis} label={`شاخص‌های ${current.title}`} />
      ) : null}
      <Alert
        description={boundary.description}
        title={boundary.title}
        tone="warning"
      />
      {showFilters ? (
        <FilterBar className="grid sm:grid-cols-2 xl:grid-cols-6">
          <FormField id="accommodation-search" label="جستجو">
            <div className="relative">
              <Search className="absolute end-3 top-3.5 size-4 text-muted-foreground" />
              <Input
                className="pe-10"
                id="accommodation-search"
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder={`جستجو در ${current.title}`}
                value={search}
              />
            </div>
          </FormField>
          {contextualFilters()}
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
              setCountryFilter('all');
              setCityFilter('all');
              setStarFilter('all');
              setCapacityFilter('all');
              setMealCategoryFilter('all');
              setFacilityCategoryFilter('all');
              setPage(1);
            }}
            variant="ghost"
          >
            <FilterX className="size-4" /> پاک‌کردن
          </Button>
        </FilterBar>
      ) : null}
      {content}
      {showFilters ? (
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
          {...(selected && formMode !== 'create' ? { record: selected } : {})}
        />
      ) : null}
      {selected?.resource === 'hotels' ? (
        <MasterDataProfileDialog
          description="پروفایل هتل از فهرست اصلی و بدون ایجاد سکشن جداگانه نمایش داده می‌شود."
          onOpenChange={setProfileOpen}
          open={profileOpen}
          title="پروفایل هتل"
        >
          {profile()}
        </MasterDataProfileDialog>
      ) : null}
    </div>
  );
}
