'use client';
import { useEffect, useState } from 'react';
import type {
  LoginResponse,
  HotelRegisteredPeriodsQueryV1,
  HotelRegisteredPeriodsPageV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { DatePicker } from '@/components/ui/date-picker';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { packagePricingApi } from '../api/client';
import { currencySymbol } from '@/lib/currency-symbol';

export function HotelRegisteredPeriods({
  session,
  initialBranchId = '',
}: {
  session: LoginResponse;
  initialBranchId?: string;
}) {
  const initial = {
    branchId: initialBranchId || session.user.branches[0]?.id || '',
    search: '',
    from: '',
    to: '',
  };
  const [filters, setFilters] = useState(initial);
  const [query, setQuery] = useState<HotelRegisteredPeriodsQueryV1>(() => ({
    ...initial,
    page: 1,
  }));
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    data?: HotelRegisteredPeriodsPageV1;
    error?: string;
  } | null>(null);
  const key = JSON.stringify([
    query,
    refresh,
    session.user.id,
    session.user.branches.map((branch) => branch.id),
    session.user.permissions,
  ]);
  useEffect(() => {
    let active = true;
    const clean = Object.fromEntries(
      Object.entries(query).filter(([, value]) => value !== ''),
    ) as HotelRegisteredPeriodsQueryV1;
    void packagePricingApi
      .hotelRegisteredPeriods(clean, session)
      .then((data) => {
        if (active) setResult({ key, data });
      })
      .catch((cause: unknown) => {
        if (active)
          setResult({
            key,
            error:
              cause instanceof Error
                ? cause.message
                : 'دریافت بازه‌های هتل ناموفق بود.',
          });
      });
    return () => {
      active = false;
    };
  }, [query, refresh, key, session]);
  const current = result?.key === key ? result : null;
  const page = current?.data;
  const loading = !current;
  const invalid = !!(filters.from && filters.to && filters.from > filters.to);
  return (
    <section
      aria-label="بازه‌های ثبت‌شدهٔ هتل‌ها"
      className="grid min-w-0 gap-4"
    >
      <form
        className="grid gap-3 md:grid-cols-2 lg:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!invalid) setQuery({ ...filters, page: 1 });
        }}
      >
        <label className="grid gap-1 text-sm">
          شعبه
          <NativeSearchSelect
            aria-label="شعبهٔ بازه‌های هتل"
            value={filters.branchId}
            onChange={(event) =>
              setFilters((old) => ({ ...old, branchId: event.target.value }))
            }
          >
            <option value="">همهٔ شعب مجاز</option>
            {session.user.branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </NativeSearchSelect>
        </label>
        <label className="grid gap-1 text-sm">
          جست‌وجو
          <Input
            aria-label="جست‌وجوی هتل، شهر یا کارگزار"
            placeholder="هتل، شهر یا کارگزار"
            value={filters.search}
            maxLength={120}
            onChange={(event) =>
              setFilters((old) => ({ ...old, search: event.target.value }))
            }
          />
        </label>
        <label className="grid gap-1 text-sm">
          از تاریخ
          <DatePicker
            aria-label="شروع فیلتر بازه‌های هتل"
            defaultCalendarSystem="gregorian"
            value={filters.from}
            onChange={(value) => setFilters((old) => ({ ...old, from: value }))}
          />
        </label>
        <label className="grid gap-1 text-sm">
          تا تاریخ
          <DatePicker
            aria-label="پایان فیلتر بازه‌های هتل"
            defaultCalendarSystem="gregorian"
            value={filters.to}
            onChange={(value) => setFilters((old) => ({ ...old, to: value }))}
          />
        </label>
        <div className="flex flex-wrap gap-2 md:col-span-2 lg:col-span-4">
          <Button type="submit" disabled={invalid}>
            جست‌وجو
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const empty = {
                branchId: filters.branchId,
                search: '',
                from: '',
                to: '',
              };
              setFilters(empty);
              setQuery({ ...empty, page: 1 });
            }}
          >
            پاک‌کردن فیلترها
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => setRefresh((value) => value + 1)}
          >
            تازه‌سازی
          </Button>
          {invalid && (
            <span role="alert" className="text-sm text-destructive">
              بازه فیلتر نامعتبر است.
            </span>
          )}
        </div>
      </form>
      {loading ? (
        <p role="status">در حال دریافت بازه‌های هتل…</p>
      ) : current.error ? (
        <p role="alert" className="text-sm text-destructive">
          {current.error}
        </p>
      ) : page ? (
        <>
          <p className="text-xs text-muted-foreground">
            {page.total.toLocaleString('fa-IR')} بازهٔ ثبت‌شده
          </p>
          <div className="max-h-[48vh] overflow-auto rounded-xl border border-border">
            <table
              className="w-full min-w-[780px] text-sm"
              aria-label="جدول بازه‌های بسته‌های هتل"
            >
              <thead className="sticky top-0 bg-muted">
                <tr>
                  {[
                    'هتل',
                    'شعبه',
                    'شهر',
                    'کارگزار',
                    'شروع بازه',
                    'پایان بازه (خروج)',
                    'ارز',
                    'نوع بسته',
                    'نسخه',
                  ].map((title) => (
                    <th key={title} scope="col" className="p-2 text-start">
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {page.data.map((row) => (
                  <tr key={row.hotelRateId} className="border-t border-border">
                    <td className="p-2 font-semibold">{row.hotelName}</td>
                    <td className="p-2">
                      {session.user.branches.find(
                        (branch) => branch.id === row.branchId,
                      )?.name ?? row.branchId}
                    </td>
                    <td className="p-2">{row.cityName}</td>
                    <td className="p-2">{row.brokerName}</td>
                    <td className="p-2" dir="ltr">
                      {row.checkIn}
                    </td>
                    <td className="p-2" dir="ltr">
                      {row.checkOut}
                    </td>
                    <td className="p-2">{currencySymbol(row.currencyCode)}</td>
                    <td className="p-2">
                      {row.sharedPeriod
                        ? 'بازهٔ مشترک'
                        : row.tourDepartureId
                          ? 'بستهٔ نوبت تور'
                          : 'نرخ هتل'}
                    </td>
                    <td className="p-2">
                      {row.version.toLocaleString('fa-IR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!page.data.length && (
              <p className="p-4 text-sm">بازه‌ای مطابق فیلترها ثبت نشده است.</p>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <Button
              variant="outline"
              disabled={page.page <= 1}
              onClick={() =>
                setQuery((old) => ({ ...old, page: (old.page ?? 1) - 1 }))
              }
            >
              صفحه قبل
            </Button>
            <span>صفحه {page.page.toLocaleString('fa-IR')}</span>
            <Button
              variant="outline"
              disabled={page.page * page.pageSize >= page.total}
              onClick={() =>
                setQuery((old) => ({ ...old, page: (old.page ?? 1) + 1 }))
              }
            >
              صفحه بعد
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}
