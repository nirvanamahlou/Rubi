'use client';
import { useEffect, useState } from 'react';
import { getPublicApiBaseUrl } from '@/lib/environment';
import type {
  FloatingTourImportOptions,
  FloatingTourImportPreview,
  FloatingTourSaleSet,
  LoginResponse,
  TourPackageV1,
} from '@nora/contracts';
import { Button, Card, Input } from '@/components/ui';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { useAccessPermissions } from '@/modules/iam/access-context';
import { packagePricingApi } from '../api/client';
import { FloatingPriceRows } from './floating-price-rows';
import { FloatingRegisteredPeriods } from './floating-registered-periods';
import {
  FloatingPackageFlights,
  packageFlightInput,
  type FloatingPackageFlightDrafts,
} from './floating-package-flights';
const monthNames = {
  PERSIAN: [
    'فروردین',
    'اردیبهشت',
    'خرداد',
    'تیر',
    'مرداد',
    'شهریور',
    'مهر',
    'آبان',
    'آذر',
    'دی',
    'بهمن',
    'اسفند',
  ],
  GREGORIAN: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
};
const excelMessage = (message: string) =>
  message.replace(/^Row (?=\d)/gm, 'ردیف ');

export function FloatingTourPricingWorkspace() {
  const permissions = useAccessPermissions();
  const canManage =
    permissions?.includes('package_pricing.period.manage') ?? false;
  const [session, setSession] = useState<LoginResponse | null>(null),
    [tours, setTours] = useState<(TourPackageV1 & { routeNames?: string[] })[]>(
      [],
    ),
    [id, setId] = useState(''),
    [catalog, setCatalog] = useState<FloatingTourSaleSet | null>(null),
    [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState<FloatingTourImportPreview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const [options, setOptions] = useState<FloatingTourImportOptions>({
    nights: 0,
    mode: 'DATED',
    calendar: 'PERSIAN',
    months: [],
    combined: false,
  });
  const [period, setPeriod] = useState('');
  const [flightDrafts, setFlightDrafts] = useState<FloatingPackageFlightDrafts>(
    {},
  );
  const activeTour = tours.find((tour) => tour.id === id);
  const outbound = packageFlightInput(flightDrafts.outbound);
  const inbound = packageFlightInput(flightDrafts.inbound);
  const flightPattern = outbound && inbound ? { outbound, inbound } : undefined;
  const validFlights = options.mode === 'MONTHLY' || Boolean(flightPattern);
  useEffect(() => {
    let active = true;
    packagePricingApi
      .session()
      .then(async (s) => {
        const result = await packagePricingApi.floatingTours(s);
        if (active) {
          const floatingTours = result.data.filter(
            (tour) => tour.details?.isFloating === true,
          );
          setSession(s);
          setTours(floatingTours);
          const requested = new URLSearchParams(window.location.search).get(
            'tour',
          );
          const selected = floatingTours.find((tour) => tour.id === requested);
          if (selected) {
            setId(selected.id);
            setOptions((old) => ({
              ...old,
              combined: !!selected.details?.isCombined,
              destinationNights: selected.details?.isCombined
                ? [0, 0]
                : undefined,
            }));
          }
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!id || !session) return;
    let active = true;
    packagePricingApi
      .floatingPrices(id, session)
      .then((r) => {
        if (active) setCatalog(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, session]);
  const patch = (next: Partial<FloatingTourImportOptions>) => {
    const updated = { ...options, ...next };
    if (updated.combined) {
      updated.destinationNights ??= [0, 0];
      updated.nights = updated.destinationNights.reduce((sum, n) => sum + n, 0);
    } else updated.destinationNights = undefined;
    setOptions(updated);
    setPreview(null);
    setMessage('');
  };
  const validNights =
    Number.isInteger(options.nights) &&
    options.nights >= 1 &&
    options.nights <= 365 &&
    (!options.combined ||
      (!!options.destinationNights &&
        options.destinationNights.length >= 2 &&
        options.destinationNights.every((n) => Number.isInteger(n) && n >= 1)));
  async function run(commit = false) {
    if (!session || !file || !id || busy || !validNights || !validFlights)
      return;
    if (commit && !preview?.digest) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await packagePricingApi.floatingImport(
        id,
        file,
        {
          ...options,
          ...(options.mode === 'DATED' && flightPattern
            ? { flightPattern }
            : {}),
        },
        session,
        commit ? (preview ?? undefined) : undefined,
      );
      if (commit) {
        setCatalog(result as FloatingTourSaleSet);
        setPreview(null);
        setMessage('قیمت‌های فروش ثبت شدند.');
      } else setPreview(result as FloatingTourImportPreview);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ثبت ناموفق بود.');
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">پکیج‌های شناور</h1>
      <Card className="space-y-4 p-5">
        <p>
          قیمت‌های این بخش، فروش نفری هستند و در خرید هتل یا بلیط ثبت نمی‌شوند.
        </p>
        <NativeSearchSelect
          aria-label="انتخاب تور شناور"
          value={id}
          disabled={busy}
          onChange={(e) => {
            const selected = tours.find((t) => t.id === e.target.value);
            setId(e.target.value);
            setFlightDrafts({});
            setFile(null);
            setOptions((current) => ({ ...current, hotelSelections: {} }));
            setError('');
            setCatalog(null);
            setPeriod('');
            patch({
              combined: !!selected?.details?.isCombined,
              nights: 0,
              destinationNights: selected?.details?.isCombined
                ? [0, 0]
                : undefined,
            });
          }}
        >
          <option value="">انتخاب تور شناور</option>
          {tours.map((tour) => {
            const branch = session?.user?.branches?.find(
              (item) => item.id === tour.branchId,
            );
            const details = tour.details;
            const route = tour.routeNames?.every(Boolean)
              ? tour.routeNames.join(' ← ')
              : [details?.originAirportCode, details?.destinationAirportCode]
                  .filter(Boolean)
                  .join(' ← ');
            const duplicate = tours.some(
              (other) => other.id !== tour.id && other.name === tour.name,
            );
            const label = [
              tour.name,
              route,
              branch?.name,
              details?.airlineName,
              details?.durationDays ? `${details.durationDays} روز` : '',
              duplicate ? tour.createdAt?.slice(0, 10) : '',
              duplicate ? tour.id.slice(0, 8) : '',
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <option key={tour.id} value={tour.id}>
                {label}
              </option>
            );
          })}
        </NativeSearchSelect>
        {!tours.length && <p>تور شناور را ابتدا در تعریف تور ثبت کنید.</p>}
        {id && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <label>
                تعداد شب این بازه
                <Input
                  aria-label="تعداد شب این بازه"
                  type="number"
                  min={1}
                  max={365}
                  value={options.nights || ''}
                  readOnly={options.combined}
                  disabled={busy || !canManage}
                  onChange={(e) => patch({ nights: Number(e.target.value) })}
                />
              </label>
              <label>
                نوع بازه
                <NativeSearchSelect
                  aria-label="نوع بازه"
                  value={options.mode}
                  disabled={busy || !canManage}
                  onChange={(e) =>
                    patch({
                      mode: e.target.value as FloatingTourImportOptions['mode'],
                    })
                  }
                >
                  <option value="DATED">تاریخ‌دار</option>
                  <option value="MONTHLY">ویژه ماه</option>
                </NativeSearchSelect>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={options.combined ?? false}
                  disabled={busy || !canManage}
                  onChange={(e) => patch({ combined: e.target.checked })}
                />
                تور ترکیبی با قیمت مشترک اقامت‌ها
              </label>
            </div>
            {options.mode === 'DATED' && activeTour && (
              <FloatingPackageFlights
                tour={activeTour}
                drafts={flightDrafts}
                disabled={busy || !canManage}
                onChange={(direction, value) => {
                  setFlightDrafts((current) => {
                    const next = { ...current };
                    if (value) next[direction] = value;
                    else delete next[direction];
                    return next;
                  });
                  setPreview(null);
                  setMessage('');
                }}
              />
            )}
            {options.mode === 'DATED' && !validFlights && (
              <p className="text-sm text-muted-foreground">
                برای پیش‌نمایش، اطلاعات هر دو پرواز و فرودگاه‌ها را تکمیل کنید.
              </p>
            )}
            {options.combined && (
              <div className="space-y-4 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
                <label className="block max-w-xs">
                  تعداد مقصد
                  <NativeSearchSelect
                    aria-label="تعداد مقصد"
                    value={options.destinationNights?.length ?? 2}
                    disabled={busy || !canManage}
                    onChange={(e) =>
                      patch({
                        destinationNights: Array.from(
                          { length: Number(e.target.value) },
                          (_, i) => options.destinationNights?.[i] ?? 0,
                        ),
                      })
                    }
                  >
                    {Array.from({ length: 9 }, (_, i) => i + 2).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </NativeSearchSelect>
                </label>
                <div className="grid gap-4 sm:grid-cols-3">
                  {(options.destinationNights ?? [0, 0]).map((n, i) => (
                    <label key={i}>
                      تعداد شب مقصد {i + 1}
                      <Input
                        aria-label={`تعداد شب مقصد ${i + 1}`}
                        type="number"
                        min={1}
                        max={365}
                        value={n || ''}
                        disabled={busy || !canManage}
                        onChange={(e) =>
                          patch({
                            destinationNights: (
                              options.destinationNights ?? [0, 0]
                            ).map((old, index) =>
                              index === i ? Number(e.target.value) : old,
                            ),
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                <p className="text-sm text-slate-600">
                  شهر هر مقصد از هتل داخل اکسل خوانده می‌شود؛ ترتیب ردیف‌های هتل
                  باید با ترتیب مقصدها برابر باشد.
                </p>
              </div>
            )}
            {options.mode === 'MONTHLY' && (
              <>
                <NativeSearchSelect
                  aria-label="تقویم ماه‌ها"
                  value={options.calendar}
                  disabled={busy || !canManage}
                  onChange={(e) =>
                    patch({
                      calendar: e.target.value as 'PERSIAN' | 'GREGORIAN',
                    })
                  }
                >
                  <option value="PERSIAN">شمسی</option>
                  <option value="GREGORIAN">میلادی</option>
                </NativeSearchSelect>
                <div className="flex flex-wrap gap-4">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <label key={m}>
                      <input
                        type="checkbox"
                        checked={options.months?.includes(m) ?? false}
                        disabled={busy || !canManage}
                        onChange={(e) =>
                          patch({
                            months: e.target.checked
                              ? [...(options.months ?? []), m]
                              : (options.months ?? []).filter((n) => n !== m),
                          })
                        }
                      />
                      {monthNames[options.calendar ?? 'PERSIAN'][m - 1]}
                    </label>
                  ))}
                </div>
              </>
            )}
            <a
              className="inline-flex w-fit items-center rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-medium text-blue-800 hover:bg-blue-50"
              href={
                options.combined && getPublicApiBaseUrl()
                  ? `${getPublicApiBaseUrl()}/sales/pricing/floating-tours/${encodeURIComponent(id)}/template?destinationCount=${options.destinationNights?.length ?? 2}`
                  : '/templates/floating-tour-price.xlsx'
              }
              download
            >
              دانلود قالب قیمت تور
            </a>
            {options.combined && (
              <p className="text-sm text-slate-600">
                قیمت مشترک را در سلول ادغام‌شده وارد کنید؛ هر ردیف یک اقامت از
                همان ترکیب است.
              </p>
            )}
            <Input
              aria-label="فایل قیمت تور"
              type="file"
              accept=".xlsx"
              disabled={busy || !canManage || !validNights}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setOptions((current) => ({ ...current, hotelSelections: {} }));
                setPreview(null);
                setMessage('');
              }}
            />
            <Button
              disabled={
                busy || !canManage || !file || !validNights || !validFlights
              }
              onClick={() => void run()}
            >
              پیش‌نمایش قیمت فروش
            </Button>
          </>
        )}
        {error && (
          <p role="alert" className="whitespace-pre-line text-red-600">
            {excelMessage(error)}
          </p>
        )}
        {message && <p role="status">{message}</p>}
      </Card>
      {preview?.hotelMatches?.length ? (
        <Card className="space-y-3 p-4">
          <h2>تطبیق نام هتل‌ها</h2>
          {preview.hotelMatches.map((match) => (
            <label key={match.key} className="block space-y-1">
              <span>{excelMessage(`Row ${match.row}: ${match.name}`)}</span>
              <NativeSearchSelect
                disabled={busy || !canManage || !match.candidates.length}
                value={options.hotelSelections?.[match.key] ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  setOptions((current) => {
                    const hotelSelections = { ...current.hotelSelections };
                    if (value) hotelSelections[match.key] = value;
                    else delete hotelSelections[match.key];
                    return { ...current, hotelSelections };
                  });
                }}
              >
                <option value="">انتخاب هتل</option>
                {match.candidates.map((hotel) => (
                  <option key={hotel.id} value={hotel.id}>
                    {hotel.name}
                  </option>
                ))}
              </NativeSearchSelect>
            </label>
          ))}
          <Button
            disabled={
              busy ||
              !canManage ||
              !preview.hotelMatches.every(
                (match) => options.hotelSelections?.[match.key],
              )
            }
            onClick={() => void run()}
          >
            پیش‌نمایش قیمت فروش
          </Button>
        </Card>
      ) : null}
      {preview?.digest && (
        <Card className="space-y-4 p-4">
          <h2>پیش‌نمایش ورود قیمت</h2>
          <p>
            قیمت تاریخ‌های داخل فایل جایگزین می‌شود؛ تاریخ‌های دیگر حفظ می‌شوند.
            در حالت ویژه ماه، مجموعهٔ ماهانه جایگزین می‌شود.
          </p>
          {!!preview.warnings?.length && (
            <section className="rounded-lg border border-amber-500 p-3">
              <h3 className="font-semibold">هشدارها</h3>
              <ul className="list-disc space-y-1 ps-5">
                {preview.warnings.map((warning, index) => (
                  <li key={index}>{excelMessage(warning)}</li>
                ))}
              </ul>
            </section>
          )}
          <FloatingPriceRows rows={preview.rows} showSource />
          <Button disabled={busy || !canManage} onClick={() => void run(true)}>
            ثبت نهایی قیمت فروش
          </Button>
        </Card>
      )}
      {catalog && (
        <>
          <h2>قیمت‌های فروش ثبت‌شده</h2>
          <NativeSearchSelect
            aria-label="انتخاب بازه"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            <option value="">همهٔ بازه‌ها</option>
            {[
              ...new Set(
                catalog.dated.map((row) => `${row.startsOn}/${row.nights}`),
              ),
            ].map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </NativeSearchSelect>
          {session && (
            <FloatingRegisteredPeriods
              catalog={catalog}
              tourId={id}
              session={session}
              canManage={canManage}
              busy={busy}
              periodFilter={period}
              onChange={setCatalog}
            />
          )}
        </>
      )}
    </div>
  );
}
