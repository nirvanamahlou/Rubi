'use client';

import {
  MASTER_HOTEL_RATE_FACTOR_KEYS,
  type LoginResponse,
  type MasterHotelRateFactorsV1,
  type MasterHotelRateGridRowV1,
  type MasterHotelRatePeriodDetailV1,
  type MasterHotelRatePeriodSummaryV1,
} from '@nora/contracts';
import {
  ArrowRight,
  Building2,
  CalendarRange,
  Check,
  Clock3,
  Hotel,
  Plus,
  RefreshCw,
  Save,
  Search,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/form-controls';
import {
  Alert,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
} from '@/components/ui/surfaces';
import { hotelBaseRateApi, type HotelRateOption } from './client';

const factorLabels: Record<
  (typeof MASTER_HOTEL_RATE_FACTOR_KEYS)[number],
  string
> = {
  double: 'دوتخته',
  single: 'یک‌تخته',
  triple: 'سه‌تخته',
  childWithBed: 'کودک با تخت',
  childWithoutBed: 'کودک بدون تخت',
  infant: 'نوزاد',
};
const defaultFactors: MasterHotelRateFactorsV1 = {
  double: '1',
  single: '1.5',
  triple: '0.85',
  childWithBed: '0.75',
  childWithoutBed: '0.5',
  infant: '0',
};

export function nights(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return 0;
  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    new Date(start).toISOString().slice(0, 10) !== checkIn ||
    new Date(end).toISOString().slice(0, 10) !== checkOut
  )
    return 0;
  return Math.max(0, (end - start) / 86_400_000);
}

export function multiply(amount: string | null, factor: string) {
  if (
    !amount ||
    !/^\d+(\.\d{1,4})?$/.test(amount) ||
    !/^\d+(\.\d{1,6})?$/.test(factor)
  )
    return '—';
  const scaled = (value: string, places: number) => {
    const [whole = '0', fraction = ''] = value.split('.');
    return (
      BigInt(whole) * 10n ** BigInt(places) +
      BigInt(fraction.padEnd(places, '0'))
    );
  };
  const result = scaled(amount, 4) * scaled(factor, 6);
  const rounded = (result + 500_000n) / 1_000_000n;
  const whole = rounded / 10_000n;
  const fraction = (rounded % 10_000n)
    .toString()
    .padStart(4, '0')
    .replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function blankRows(
  options: readonly HotelRateOption[],
): MasterHotelRateGridRowV1[] {
  return options.map((hotel) => ({
    hotelId: hotel.id,
    hotelVersion: hotel.version,
    hotelName: hotel.englishName || hotel.name,
    starRating: hotel.starRating ?? null,
    included: false,
    baseAmount: null,
    factors: { ...defaultFactors },
  }));
}

export function HotelBaseRateWorkspace() {
  const [session, setSession] = useState<LoginResponse | null>(null);
  const [cities, setCities] = useState<readonly HotelRateOption[]>([]);
  const [periods, setPeriods] = useState<
    readonly MasterHotelRatePeriodSummaryV1[]
  >([]);
  const [editing, setEditing] = useState<MasterHotelRatePeriodDetailV1 | null>(
    null,
  );
  const [branchId, setBranchId] = useState('');
  const [cityId, setCityId] = useState('');
  const [title, setTitle] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [currencyCode, setCurrencyCode] = useState('EUR');
  const [reason, setReason] = useState('ثبت یا اصلاح نرخ پایه هتل');
  const [rows, setRows] = useState<MasterHotelRateGridRowV1[]>([]);
  const [hotelSearch, setHotelSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const pending = useRef<{ body: string; key: string } | null>(null);

  const loadBase = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const activeSession = await hotelBaseRateApi.session();
      if (!activeSession.user.permissions.includes('master_data.read'))
        throw new Error('مجوز master_data.read برای این بخش لازم است.');
      const selectedBranch =
        branchId || activeSession.user.branches[0]?.id || '';
      const [cityResult, periodResult] = await Promise.all([
        hotelBaseRateApi.options('cities'),
        hotelBaseRateApi.list(selectedBranch || undefined),
      ]);
      setSession(activeSession);
      setBranchId(selectedBranch);
      setCities(cityResult.data);
      setPeriods(periodResult.data);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'دریافت اطلاعات ناموفق بود.',
      );
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => void loadBase(), 0);
    return () => globalThis.clearTimeout(timer);
  }, [loadBase]);

  async function loadHotels(
    nextCityId: string,
    saved?: MasterHotelRateGridRowV1[],
  ) {
    setError('');
    if (!nextCityId) {
      setRows([]);
      return;
    }
    try {
      const result = await hotelBaseRateApi.options('hotels', nextCityId);
      const previous = new Map(saved?.map((row) => [row.hotelId, row]));
      setRows(
        blankRows(result.data).map((row) => previous?.get(row.hotelId) ?? row),
      );
    } catch (cause) {
      setRows([]);
      setError(
        cause instanceof Error
          ? cause.message
          : 'دریافت هتل‌های شهر ناموفق بود.',
      );
    }
  }

  function newPeriod() {
    setEditing(null);
    setCityId('');
    setTitle('');
    setCheckIn('');
    setCheckOut('');
    setCurrencyCode('EUR');
    setRows([]);
    setNotice('');
    pending.current = null;
  }

  async function editPeriod(id: string) {
    setLoading(true);
    setError('');
    try {
      const result = await hotelBaseRateApi.detail(id);
      const item = result.data;
      setEditing(item);
      setBranchId(item.branchId);
      setCityId(item.cityId);
      setTitle(item.title);
      setCheckIn(item.checkIn);
      setCheckOut(item.checkOut);
      setCurrencyCode(item.currencyCode);
      setReason(`اصلاح نسخه ${item.currentVersion.toLocaleString('fa-IR')}`);
      await loadHotels(item.cityId, [...item.rows]);
      pending.current = null;
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'بازکردن بازه ناموفق بود.',
      );
    } finally {
      setLoading(false);
    }
  }

  const visibleRows = useMemo(() => {
    const query = hotelSearch.trim().toLocaleLowerCase('fa-IR');
    return query
      ? rows.filter((row) =>
          row.hotelName.toLocaleLowerCase('fa-IR').includes(query),
        )
      : rows;
  }, [hotelSearch, rows]);
  const stayNights = nights(checkIn, checkOut);
  const includedCount = rows.filter((row) => row.included).length;
  const canSave = Boolean(
    session?.user.permissions.includes(
      editing ? 'master_data.update' : 'master_data.create',
    ),
  );

  function updateRow(
    hotelId: string,
    patch: Partial<MasterHotelRateGridRowV1>,
  ) {
    setRows((current) =>
      current.map((row) =>
        row.hotelId === hotelId ? { ...row, ...patch } : row,
      ),
    );
    setNotice('');
  }

  async function save() {
    setError('');
    setNotice('');
    if (!cityId || !title.trim() || stayNights < 1 || !includedCount) {
      setError('شهر، عنوان، بازه معتبر و حداقل یک هتل را کامل کنید.');
      return;
    }
    if (
      rows.some(
        (row) =>
          row.included &&
          (!row.baseAmount ||
            !/^(?:0*[1-9]\d{0,17}|0*\.\d*[1-9]\d{0,3}|0*[1-9]\d{0,17}\.\d{1,4})$/.test(
              row.baseAmount,
            )),
      )
    ) {
      setError('قیمت پایه تمام هتل‌های انتخاب‌شده باید مثبت باشد.');
      return;
    }
    const input = {
      branchId,
      cityId,
      title: title.trim(),
      checkIn,
      checkOut,
      currencyCode,
      reason: reason.trim(),
      rows,
      ...(editing ? { expectedVersion: editing.currentVersion } : {}),
    };
    const body = JSON.stringify(input);
    if (pending.current?.body !== body)
      pending.current = { body, key: crypto.randomUUID() };
    setSaving(true);
    try {
      const result = await hotelBaseRateApi.save(
        input,
        pending.current.key,
        editing?.id,
      );
      pending.current = null;
      setNotice(
        `بازه با نسخه ${result.data.version.toLocaleString('fa-IR')} ذخیره شد و برای مدیریت پکیج قابل ارجاع است.`,
      );
      const detail = await hotelBaseRateApi.detail(result.data.id);
      setEditing(detail.data);
      setRows([...detail.data.rows]);
      const refreshed = await hotelBaseRateApi.list(branchId);
      setPeriods(refreshed.data);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'ذخیره بازه ناموفق بود.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto grid w-full max-w-[1600px] gap-5" dir="rtl">
      <PageHeader
        eyebrow="اطلاعات پایه · اقامت"
        title="قیمت‌گذاری هتل در بازه"
        description="شهر و تاریخ اقامت را انتخاب کنید؛ هتل‌های همان شهر در جدول قابل‌ویرایش نمایش داده می‌شوند و هر ذخیره یک نسخه مستقل می‌سازد."
        actions={
          <>
            <Link
              className={buttonVariants({ variant: 'outline' })}
              href="/master-data/accommodation"
            >
              <ArrowRight className="size-4" /> بازگشت به اقامت
            </Link>
            <Button onClick={newPeriod}>
              <Plus className="size-4" /> بازه جدید
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="grid gap-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-72" />
        </div>
      ) : null}
      {!loading && error && !session ? (
        <ErrorState
          title="عملیات کامل نشد"
          description={error}
          action={
            <Button onClick={() => void loadBase()} variant="outline">
              <RefreshCw className="size-4" /> تلاش دوباره
            </Button>
          }
        />
      ) : null}
      {error && session ? (
        <Alert tone="error" title="عملیات کامل نشد" description={error} />
      ) : null}
      {notice ? <Alert title="ذخیره انجام شد" description={notice} /> : null}

      {!loading && session ? (
        <>
          <section aria-labelledby="periods-title" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-black" id="periods-title">
                بازه‌های تعریف‌شده
              </h2>
              <Badge>{periods.length.toLocaleString('fa-IR')} بازه</Badge>
            </div>
            {periods.length ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {periods.map((period) => (
                  <button
                    className={`rounded-2xl border p-4 text-start transition hover:border-primary/50 hover:bg-primary/5 ${editing?.id === period.id ? 'border-primary bg-primary/5 ring-2 ring-primary/15' : 'border-border bg-surface'}`}
                    key={period.id}
                    onClick={() => void editPeriod(period.id)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong>{period.title}</strong>
                      <Badge>
                        نسخه {period.currentVersion.toLocaleString('fa-IR')}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {period.cityName} ·{' '}
                      {period.nights.toLocaleString('fa-IR')} شب
                    </p>
                    <p className="mt-2 font-mono text-xs" dir="ltr">
                      {period.checkIn} → {period.checkOut}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {period.includedHotels.toLocaleString('fa-IR')} هتل از{' '}
                      {period.totalHotels.toLocaleString('fa-IR')} ·{' '}
                      {period.currencyCode}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState
                title="هنوز بازه‌ای تعریف نشده است"
                description="روی «بازه جدید» بزنید، شهر و تاریخ را انتخاب و نرخ هتل‌ها را در جدول وارد کنید."
                icon={CalendarRange}
              />
            )}
          </section>

          <Card className="overflow-hidden">
            <div className="border-b border-border bg-gradient-to-l from-primary/10 via-surface to-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-black">
                    {editing ? `ویرایش ${editing.title}` : 'تعریف بازه جدید'}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    مبنای قیمت: هر اتاق در هر شب · هر Save یک Version جدید
                  </p>
                </div>
                {editing ? (
                  <Badge>
                    نسخه فعلی {editing.currentVersion.toLocaleString('fa-IR')}
                  </Badge>
                ) : null}
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
                <label className="text-xs font-bold">
                  شعبه
                  <select
                    className="mt-2 h-11 w-full rounded-xl border border-input bg-surface px-3 disabled:opacity-60"
                    disabled={Boolean(editing)}
                    value={branchId}
                    onChange={(event) => setBranchId(event.target.value)}
                  >
                    {session.user.branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold">
                  شهر
                  <select
                    className="mt-2 h-11 w-full rounded-xl border border-input bg-surface px-3"
                    value={cityId}
                    onChange={(event) => {
                      const value = event.target.value;
                      setCityId(value);
                      if (!editing)
                        setTitle(
                          cities.find((city) => city.id === value)?.name
                            ? `نرخ ${cities.find((city) => city.id === value)!.name}`
                            : '',
                        );
                      void loadHotels(value);
                    }}
                  >
                    <option value="">انتخاب شهر</option>
                    {cities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name}{' '}
                        {city.englishName ? `· ${city.englishName}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold xl:col-span-2">
                  عنوان بازه
                  <Input
                    className="mt-2"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="مثلاً آنتالیا، حرکت ۳۰ مهر"
                  />
                </label>
                <label className="text-xs font-bold">
                  Check-in
                  <DatePicker
                    className="mt-2"
                    defaultCalendarSystem="gregorian"
                    gregorianEnglish
                    value={checkIn}
                    onChange={setCheckIn}
                  />
                </label>
                <label className="text-xs font-bold">
                  Check-out
                  <DatePicker
                    className="mt-2"
                    defaultCalendarSystem="gregorian"
                    gregorianEnglish
                    value={checkOut}
                    onChange={setCheckOut}
                  />
                </label>
                <label className="text-xs font-bold">
                  ارز
                  <select
                    className="mt-2 h-11 w-full rounded-xl border border-input bg-surface px-3"
                    value={currencyCode}
                    onChange={(event) => setCurrencyCode(event.target.value)}
                  >
                    {['EUR', 'USD', 'AED', 'TRY', 'IRR'].map((currency) => (
                      <option key={currency}>{currency}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Badge>
                  <Clock3 className="me-1 size-3" />{' '}
                  {stayNights
                    ? `${stayNights.toLocaleString('fa-IR')} شب`
                    : 'تاریخ را کامل کنید'}
                </Badge>
                <Badge>
                  <Hotel className="me-1 size-3" />{' '}
                  {includedCount.toLocaleString('fa-IR')} هتل انتخاب‌شده
                </Badge>
                <Badge>
                  <Building2 className="me-1 size-3" />{' '}
                  {rows.length.toLocaleString('fa-IR')} هتل شهر
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
              <label className="relative min-w-64 flex-1">
                <Search className="absolute end-3 top-3 size-4 text-muted-foreground" />
                <Input
                  className="pe-10"
                  placeholder="جست‌وجو در هتل‌های همین شهر"
                  value={hotelSearch}
                  onChange={(event) => setHotelSearch(event.target.value)}
                />
              </label>
              <Button
                disabled={!visibleRows.length}
                onClick={() => {
                  const allSelected = visibleRows.every((row) => row.included);
                  const ids = new Set(visibleRows.map((row) => row.hotelId));
                  setRows((current) =>
                    current.map((row) =>
                      ids.has(row.hotelId)
                        ? {
                            ...row,
                            included: !allSelected,
                            baseAmount: allSelected ? null : row.baseAmount,
                          }
                        : row,
                    ),
                  );
                }}
                variant="outline"
              >
                <Check className="size-4" /> انتخاب/لغو همه نتایج
              </Button>
            </div>

            {rows.length ? (
              <div className="max-h-[620px] overflow-auto">
                <table
                  aria-label="فهرست نرخ‌های پایه هتل"
                  className="w-full min-w-[1500px] border-separate border-spacing-0 text-xs"
                >
                  <thead className="sticky top-0 z-20 bg-muted">
                    <tr>
                      <th className="sticky right-0 z-30 min-w-16 border-b border-l border-border bg-muted p-3">
                        تور
                      </th>
                      <th className="sticky right-16 z-30 min-w-60 border-b border-l border-border bg-muted p-3 text-start">
                        هتل
                      </th>
                      <th className="min-w-40 border-b border-l border-border p-3">
                        قیمت پایه / شب
                      </th>
                      {MASTER_HOTEL_RATE_FACTOR_KEYS.map((key) => (
                        <th
                          className="min-w-40 border-b border-l border-border p-3"
                          key={key}
                        >
                          {factorLabels[key]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row, index) => (
                      <tr
                        className={
                          row.included
                            ? 'bg-primary/[0.04]'
                            : index % 2
                              ? 'bg-muted/20'
                              : 'bg-surface'
                        }
                        key={row.hotelId}
                      >
                        <td className="sticky right-0 z-10 border-b border-l border-border bg-inherit p-3 text-center">
                          <input
                            aria-label={`انتخاب ${row.hotelName}`}
                            checked={row.included}
                            className="size-5 accent-primary"
                            onChange={(event) =>
                              updateRow(row.hotelId, {
                                included: event.target.checked,
                                baseAmount: event.target.checked
                                  ? row.baseAmount
                                  : null,
                              })
                            }
                            type="checkbox"
                          />
                        </td>
                        <td className="sticky right-16 z-10 border-b border-l border-border bg-inherit p-3">
                          <strong className="text-sm">{row.hotelName}</strong>
                          <div className="mt-1 text-amber-500">
                            {'★'.repeat(row.starRating ?? 0)}
                          </div>
                        </td>
                        <td className="border-b border-l border-border p-2">
                          <Input
                            aria-label={`قیمت پایه ${row.hotelName}`}
                            className="h-10 bg-background font-mono"
                            dir="ltr"
                            disabled={!row.included}
                            inputMode="decimal"
                            placeholder="0.00"
                            value={row.baseAmount ?? ''}
                            onFocus={(event) => event.currentTarget.select()}
                            onChange={(event) =>
                              updateRow(row.hotelId, {
                                baseAmount: event.target.value || null,
                              })
                            }
                          />
                          <small className="mt-1 block text-center text-muted-foreground">
                            {currencyCode}
                          </small>
                        </td>
                        {MASTER_HOTEL_RATE_FACTOR_KEYS.map((key) => (
                          <td
                            className="border-b border-l border-border p-2"
                            key={key}
                          >
                            <Input
                              aria-label={`ضریب ${factorLabels[key]} ${row.hotelName}`}
                              className="h-9 bg-background font-mono"
                              dir="ltr"
                              disabled={!row.included}
                              inputMode="decimal"
                              value={row.factors[key]}
                              onFocus={(event) => event.currentTarget.select()}
                              onChange={(event) =>
                                updateRow(row.hotelId, {
                                  factors: {
                                    ...row.factors,
                                    [key]: event.target.value,
                                  },
                                })
                              }
                            />
                            <output
                              className="mt-1 block text-center font-mono font-bold text-primary"
                              dir="ltr"
                            >
                              {multiply(row.baseAmount, row.factors[key])}
                            </output>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title={
                  cityId
                    ? 'هتلی در این شهر ثبت نشده است'
                    : 'ابتدا شهر را انتخاب کنید'
                }
                description={
                  cityId
                    ? 'هتل فعال و فروش‌پذیر این شهر را در اطلاعات پایه ثبت کنید.'
                    : 'پس از انتخاب شهر، تمام هتل‌های فعال همان شهر در Grid ظاهر می‌شوند.'
                }
                icon={Sparkles}
              />
            )}

            <div className="grid gap-3 border-t border-border bg-muted/20 p-5 md:grid-cols-[1fr_auto] md:items-end">
              <label className="text-xs font-bold">
                دلیل ثبت یا اصلاح
                <Input
                  className="mt-2"
                  maxLength={500}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              <Button
                disabled={!canSave || !rows.length}
                loading={saving}
                onClick={() => void save()}
                size="lg"
              >
                <Save className="size-4" />{' '}
                {editing ? 'ذخیره نسخه جدید' : 'ذخیره بازه'}
              </Button>
            </div>
            {!canSave ? (
              <Alert
                className="m-4"
                tone="warning"
                title="دسترسی فقط خواندنی"
                description={`برای ذخیره مجوز ${editing ? 'master_data.update' : 'master_data.create'} لازم است.`}
              />
            ) : null}
          </Card>
        </>
      ) : null}
    </main>
  );
}
