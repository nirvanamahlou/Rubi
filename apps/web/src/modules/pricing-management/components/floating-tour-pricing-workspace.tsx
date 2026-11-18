'use client';
import { useEffect, useState } from 'react';
import { getPublicApiBaseUrl } from '@/lib/environment';
import type {
  FloatingTourImportOptions,
  FloatingTourImportPreview,
  FloatingTourSaleRow,
  FloatingTourSaleSet,
  LoginResponse,
  TourPackageV1,
} from '@nora/contracts';
import { moneyUnits } from '@nora/contracts';
import { Button, Card, Input } from '@/components/ui';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { useAccessPermissions } from '@/modules/iam/access-context';
import { packagePricingApi } from '../api/client';
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
const groups = [
  ['double', 'دو تخته'],
  ['single', 'یک تخته'],
  ['extra', 'تخت اضافه'],
  ['childBed', 'کودک با تخت'],
  ['childNoBed', 'کودک بدون تخت'],
  ['infant', 'نوزاد'],
] as const;
function Rows({ rows }: { rows: FloatingTourSaleRow[] }) {
  const amount = (items: { currency: string; amount: string }[] | undefined) =>
    items
      ?.map((m) => {
        const unit = m.currency === 'IRR' ? 100000n : 10000n;
        const rounded = (moneyUnits(m.amount) + unit - 1n) / unit;
        return `${rounded.toLocaleString('en-US')} ${m.currency === 'IRR' ? 'IRT' : m.currency}`;
      })
      .join(' + ') || '—';
  return (
    <div className="overflow-auto">
      <table className="w-full min-w-[1000px] text-sm">
        <thead>
          <tr>
            {[
              'تاریخ حرکت',
              'تاریخ برگشت',
              'تعداد شب',
              'هتل و اتاق',
              ...groups.map((g) => g[1]),
              'کمیسیون',
            ].map((h) => (
              <th className="p-3" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr className="border-t" key={i}>
              <td className="p-3" dir="ltr">
                {row.startsOn ?? '—'}
              </td>
              <td className="p-3" dir="ltr">
                {row.endsOn ?? '—'}
              </td>
              <td>{row.nights}</td>
              <td>
                {row.stays.map((s) => (
                  <div key={s.hotelId}>
                    {s.hotelName} · {s.room} · {s.service} · {s.nights}
                  </div>
                ))}
              </td>
              {groups.map(([g]) => (
                <td className="p-3" dir="ltr" key={g}>
                  {amount(row.prices[g])}
                </td>
              ))}
              <td dir="ltr">{amount(row.commission)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function FloatingTourPricingWorkspace() {
  const permissions = useAccessPermissions();
  const canManage =
    permissions?.includes('package_pricing.period.manage') ?? false;
  const [session, setSession] = useState<LoginResponse | null>(null),
    [tours, setTours] = useState<TourPackageV1[]>([]),
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
  useEffect(() => {
    let active = true;
    packagePricingApi
      .session()
      .then(async (s) => {
        const result = await packagePricingApi.floatingTours(s);
        if (active) {
          setSession(s);
          setTours(result.data);
          const requested = new URLSearchParams(window.location.search).get(
            'tour',
          );
          const selected = result.data.find((tour) => tour.id === requested);
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
    if (!session || !file || !id || busy || !validNights) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await packagePricingApi.floatingImport(
        id,
        file,
        options,
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
            setFile(null);
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
          {tours.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
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
                setPreview(null);
                setMessage('');
              }}
            />
            <Button
              disabled={busy || !canManage || !file || !validNights}
              onClick={() => void run()}
            >
              پیش‌نمایش قیمت فروش
            </Button>
          </>
        )}
        {error && (
          <p role="alert" className="text-red-600">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
      </Card>
      {preview && (
        <Card className="space-y-4 p-4">
          <h2>پیش‌نمایش ورود قیمت</h2>
          <p>
            قیمت تاریخ‌های داخل فایل جایگزین می‌شود؛ تاریخ‌های دیگر حفظ می‌شوند.
            در حالت ویژه ماه، مجموعهٔ ماهانه جایگزین می‌شود.
          </p>
          <Rows rows={preview.rows} />
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
          <Rows
            rows={catalog.dated.filter(
              (row) => !period || `${row.startsOn}/${row.nights}` === period,
            )}
          />
          {catalog.monthly && (
            <>
              <h3>
                ویژه ماه ·{' '}
                {catalog.monthly.calendar === 'PERSIAN' ? 'شمسی' : 'میلادی'} ·{' '}
                {catalog.monthly.months
                  .map((m) => monthNames[catalog.monthly!.calendar][m - 1])
                  .join('، ')}
              </h3>
              <Rows rows={catalog.monthly.rows} />
            </>
          )}
        </>
      )}
    </div>
  );
}
