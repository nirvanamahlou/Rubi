'use client';

import { useEffect, useRef, useState } from 'react';
import type { LoginResponse } from '@nora/contracts';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { Choice, Lookup, rateRequest, type Option } from './controls';
import { HotelRateStayRange } from './workspace';
import { RateHistory } from './history';
import { initialFactors, kinds, labels, price, type Factors } from './model';
import styles from './rates.module.css';

type HotelOption = Option & { englishName?: string };
type GridRow = {
  hotel: HotelOption;
  selected: boolean;
  broker: Option | null;
  base: string;
  factors: Factors;
  inCityList: boolean;
};
type PackSummary = {
  id: string;
  branchId: string;
  cityId: string;
  cityName: string;
  checkIn: string;
  checkOut: string;
  currency: string;
  method: string;
  version: number;
  hotelCount: number;
  updatedAt: string;
};
type PackDetail = Omit<PackSummary, 'hotelCount' | 'updatedAt'> & {
  batchId: string;
  rows: {
    hotelId: string;
    hotelName: string;
    brokerId: string;
    brokerName: string;
    base: string;
    factors: Factors;
  }[];
};
const blankRow = (hotel: HotelOption): GridRow => ({
  hotel,
  selected: false,
  broker: null,
  base: '',
  factors: { ...initialFactors },
  inCityList: true,
});
const dayCount = (checkIn: string, checkOut: string) =>
  checkIn && checkOut
    ? (Date.parse(checkOut) - Date.parse(checkIn)) / 86400000
    : 0;

export function HotelRatePacksWorkspace() {
  const [session, setSession] = useState<LoginResponse | null>(null);
  const [ready, setReady] = useState(false);
  const [branch, setBranch] = useState('');
  const [cities, setCities] = useState<HotelOption[]>([]);
  const [citySearch, setCitySearch] = useState('');
  const [cityId, setCityId] = useState('');
  const [hotelSearch, setHotelSearch] = useState('');
  const [hotelLoading, setHotelLoading] = useState(false);
  const [rows, setRows] = useState<GridRow[]>([]);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [method, setMethod] = useState('CHECK_IN');
  const [editing, setEditing] = useState<{
    id: string;
    version: number;
  } | null>(null);
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [packTotal, setPackTotal] = useState(0);
  const [packPage, setPackPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const pending = useRef<{ route: string; body: string; key: string } | null>(
    null,
  );

  useEffect(() => {
    let active = true;
    refreshAuthenticatedSession(getPublicApiBaseUrl() ?? '')
      .then((value) => {
        if (active) {
          setSession(value);
          setBranch(value?.user.branches[0]?.id ?? '');
          setReady(true);
        }
      })
      .catch(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    let active = true;
    const timer = setTimeout(() => {
      rateRequest<{ data: HotelOption[] }>(
        `/pack-options?kind=cities&search=${encodeURIComponent(citySearch)}&page=1`,
      )
        .then((result) => {
          if (active)
            setCities((old) => {
              const selected = old.find((city) => city.id === cityId);
              return selected &&
                !result.data.some((city) => city.id === selected.id)
                ? [selected, ...result.data]
                : result.data;
            });
        })
        .catch((e) => {
          if (active)
            setError(e instanceof Error ? e.message : 'شهرها بارگذاری نشدند.');
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [session, citySearch, cityId]);

  useEffect(() => {
    if (!session || !branch) return;
    let active = true;
    rateRequest<{ data: PackSummary[]; total: number }>(
      `/packs?branchId=${encodeURIComponent(branch)}&page=${packPage}`,
    )
      .then((result) => {
        if (active) {
          setPacks(result.data);
          setPackTotal(result.total);
        }
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : 'بسته‌ها بارگذاری نشدند.');
      });
    return () => {
      active = false;
    };
  }, [session, branch, packPage, revision]);

  useEffect(() => {
    if (!session || !cityId) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (active) setHotelLoading(true);
    });
    async function load() {
      const hotels: HotelOption[] = [];
      let page = 1;
      let total = 0;
      do {
        const result = await rateRequest<{
          data: HotelOption[];
          meta: { total: number };
        }>(
          `/pack-options?kind=hotels&cityId=${encodeURIComponent(cityId)}&page=${page}`,
        );
        hotels.push(...result.data);
        total = result.meta.total;
        page += 1;
      } while (hotels.length < total && page <= 10);
      if (!active) return;
      setRows((old) => {
        const saved = new Map(old.map((row) => [row.hotel.id, row]));
        const available = hotels.map((hotel) => ({
          ...(saved.get(hotel.id) ?? blankRow(hotel)),
          hotel,
          inCityList: true,
        }));
        return [
          ...available,
          ...old
            .filter(
              (row) =>
                row.selected &&
                !hotels.some((hotel) => hotel.id === row.hotel.id),
            )
            .map((row) => ({ ...row, inCityList: false })),
        ];
      });
      if (hotels.length < total)
        setError(
          'فهرست هتل‌های شهر بسیار بزرگ است؛ برای هتل‌های بیشتر با مدیر داده هماهنگ کنید.',
        );
    }
    void load()
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : 'هتل‌های شهر بارگذاری نشدند.',
          );
      })
      .finally(() => {
        if (active) setHotelLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session, cityId]);

  const nights = dayCount(checkIn, checkOut);
  const selected = rows.filter((row) => row.selected);
  const visibleRows = rows.filter(
    (row) =>
      !hotelSearch.trim() ||
      [row.hotel.name, row.hotel.englishName].some((name) =>
        name
          ?.toLocaleLowerCase()
          .includes(hotelSearch.trim().toLocaleLowerCase()),
      ),
  );
  const canWrite =
    session?.user.permissions.includes('reservations.hotel_purchase.write') ??
    false;

  function newPack() {
    setEditing(null);
    setCityId('');
    setCitySearch('');
    setHotelSearch('');
    setCheckIn('');
    setCheckOut('');
    setRows([]);
    setCurrency('EUR');
    setMethod('CHECK_IN');
    setError('');
    setMessage('');
    pending.current = null;
  }
  function changeRow(id: string, patch: Partial<GridRow>) {
    setRows((old) =>
      old.map((row) => (row.hotel.id === id ? { ...row, ...patch } : row)),
    );
    pending.current = null;
  }
  function chooseCity(id: string) {
    setCityId(id);
    setRows([]);
    setHotelSearch('');
    pending.current = null;
  }
  async function openPack(id: string) {
    setOpening(true);
    setError('');
    setMessage('');
    pending.current = null;
    try {
      const item = await rateRequest<PackDetail>(`/packs/${id}`);
      setEditing({ id: item.id, version: item.version });
      setBranch(item.branchId);
      setCityId(item.cityId);
      setCitySearch('');
      setCities((old) =>
        old.some((city) => city.id === item.cityId)
          ? old
          : [{ id: item.cityId, name: item.cityName }, ...old],
      );
      setCheckIn(item.checkIn);
      setCheckOut(item.checkOut);
      setCurrency(item.currency);
      setMethod(item.method);
      setRows(
        item.rows.map((row) => ({
          hotel: { id: row.hotelId, name: row.hotelName },
          selected: true,
          broker: { id: row.brokerId, name: row.brokerName },
          base: row.base,
          factors: row.factors,
          inCityList: true,
        })),
      );
      setMessage(
        `بستهٔ ${item.cityName}، نسخهٔ ${item.version.toLocaleString('fa-IR')} برای ویرایش باز شد.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'بسته باز نشد.');
    } finally {
      setOpening(false);
    }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (
      !branch ||
      !cityId ||
      nights <= 0 ||
      !selected.length ||
      selected.length > 50 ||
      selected.some((row) => !row.broker || !row.base || !row.inCityList)
    ) {
      setError(
        'شهر و بازهٔ معتبر را مشخص کنید و برای هر هتل منتخب، کارگزار و قیمت را وارد کنید.',
      );
      return;
    }
    const route = editing ? `/packs/${editing.id}` : '/packs';
    const body = JSON.stringify({
      branchId: branch,
      cityId,
      checkIn,
      checkOut,
      currency,
      method,
      ...(editing ? { expectedVersion: editing.version } : {}),
      rows: selected.map((row) => ({
        hotelId: row.hotel.id,
        brokerId: row.broker!.id,
        base: row.base,
        factors: row.factors,
      })),
    });
    if (pending.current?.body !== body || pending.current.route !== route)
      pending.current = { route, body, key: crypto.randomUUID() };
    setBusy(true);
    try {
      const result = await rateRequest<{ id: string; version: number }>(route, {
        method: editing ? 'PATCH' : 'POST',
        body,
        headers: { 'idempotency-key': pending.current.key },
      });
      pending.current = null;
      setEditing({ id: result.id, version: result.version });
      setRevision((value) => value + 1);
      setPackPage(1);
      setMessage(
        `بستهٔ ${cities.find((city) => city.id === cityId)?.name ?? 'شهر'} با ${selected.length.toLocaleString('fa-IR')} هتل و نسخهٔ ${result.version.toLocaleString('fa-IR')} ذخیره شد.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ذخیره انجام نشد.');
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <p>در حال بارگذاری…</p>;
  if (!session)
    return (
      <p role="alert">
        ورود به سامانه لازم است.{' '}
        <a href="/login?next=%2Freservations%2Fhotel-rates">ورود</a>
      </p>
    );
  if (!session.user.permissions.includes('reservations.read'))
    return <p role="alert">مجوز مشاهدهٔ رزرواسیون ندارید.</p>;

  return (
    <main className={styles.root} dir="rtl">
      <header className={styles.toolbar}>
        <div>
          <p>رزرواسیون / نرخ خرید هتل</p>
          <h1>مدیریت گروهی نرخ‌های هتل‌ها</h1>
          <p>
            هر شهر و بازهٔ اقامت یک بستهٔ مستقل دارد؛ نرخ‌ها را بعداً از همان
            بسته اصلاح کنید.
          </p>
        </div>
        <button type="button" onClick={newPack}>
          + بستهٔ جدید
        </button>
      </header>
      <section aria-labelledby="packs-title">
        <div className={styles.toolbar}>
          <h2 id="packs-title">بسته‌های نرخ ثبت‌شده</h2>
          <span>{packTotal.toLocaleString('fa-IR')} بسته</span>
        </div>
        {packs.length ? (
          <div className={styles.packCards}>
            {packs.map((pack) => (
              <button
                className={`${styles.packCard} ${editing?.id === pack.id ? styles.activePack : ''}`}
                type="button"
                key={pack.id}
                onClick={() => void openPack(pack.id)}
                disabled={opening}
              >
                <strong>{pack.cityName}</strong>
                <span>نسخه {pack.version.toLocaleString('fa-IR')}</span>
                <span dir="ltr">
                  {pack.checkIn} → {pack.checkOut}
                </span>
                <small>
                  {dayCount(pack.checkIn, pack.checkOut).toLocaleString(
                    'fa-IR',
                  )}{' '}
                  شب · {pack.hotelCount.toLocaleString('fa-IR')} هتل ·{' '}
                  {pack.currency}
                </small>
                <small>بازکردن و ویرایش ↗</small>
              </button>
            ))}
          </div>
        ) : (
          <p>هنوز بسته‌ای ثبت نشده است؛ شهر و تاریخ را انتخاب کنید.</p>
        )}
        {packTotal > 50 && (
          <div className={styles.toolbar}>
            <button
              type="button"
              disabled={packPage === 1}
              onClick={() => setPackPage((value) => value - 1)}
            >
              قبلی
            </button>
            <span>صفحه {packPage.toLocaleString('fa-IR')}</span>
            <button
              type="button"
              disabled={packPage * 50 >= packTotal}
              onClick={() => setPackPage((value) => value + 1)}
            >
              بعدی
            </button>
          </div>
        )}
      </section>
      <form onSubmit={(event) => void save(event)}>
        <fieldset disabled={busy || !canWrite}>
          <section>
            <h2>۱ · شهر مقصد</h2>
            <p>
              ابتدا شهر را انتخاب کنید تا فقط هتل‌های فعال و قابل‌فروش همان شهر
              نمایش داده شوند.
            </p>
            <div className={styles.fields}>
              <label>
                شعبه
                <Choice
                  label="شعبه"
                  value={branch}
                  onChange={(value) => {
                    newPack();
                    setBranch(value);
                  }}
                  options={session.user.branches.map((item) => ({
                    id: item.id,
                    name: item.name,
                  }))}
                />
              </label>
              <label>
                جست‌وجوی شهر
                <input
                  aria-label="جست‌وجوی شهر"
                  value={citySearch}
                  onChange={(event) => setCitySearch(event.target.value)}
                  placeholder="نام شهر"
                />
              </label>
              <label>
                شهر
                <Choice
                  label="شهر"
                  value={cityId}
                  onChange={chooseCity}
                  options={cities}
                />
              </label>
            </div>
          </section>
          <section>
            <h2>۲ · بازهٔ اقامت</h2>
            <div className={styles.fields}>
              <HotelRateStayRange
                checkIn={checkIn}
                checkOut={checkOut}
                onCheckIn={setCheckIn}
                onCheckOut={setCheckOut}
              />
              <label>
                ارز نرخ
                <Choice
                  label="ارز نرخ"
                  value={currency}
                  onChange={setCurrency}
                  options={[
                    { id: 'EUR', name: 'یورو · EUR' },
                    { id: 'USD', name: 'دلار · USD' },
                    { id: 'IRR', name: 'ریال · IRR' },
                  ]}
                />
              </label>
              <label>
                مبنای نرخ
                <Choice
                  label="مبنای نرخ"
                  value={method}
                  onChange={setMethod}
                  options={[
                    { id: 'CHECK_IN', name: 'تاریخ ورود' },
                    { id: 'STAY', name: 'شب‌های اقامت' },
                  ]}
                />
              </label>
            </div>
            <p id="hotel-rate-date-help">
              {nights > 0
                ? `${nights.toLocaleString('fa-IR')} شب اقامت؛ روز خروج شمرده نمی‌شود.`
                : 'ورود و خروج را انتخاب کنید.'}
            </p>
          </section>
          <section>
            <div className={styles.toolbar}>
              <div>
                <h2>۳ · انتخاب هتل و نرخ‌ها</h2>
                <p>
                  تیک هر هتل یعنی حضور آن در این بازه را تأیید می‌کنید؛ فهرست
                  اولیه، موجودی قطعی اتاق نیست.
                </p>
              </div>
              <span className={styles.chip}>
                {selected.length.toLocaleString('fa-IR')} هتل منتخب
              </span>
            </div>
            {!cityId || nights <= 0 ? (
              <p>برای دیدن هتل‌ها، شهر و بازهٔ معتبر را مشخص کنید.</p>
            ) : (
              <>
                <label className={styles.searchField}>
                  جست‌وجوی هتل
                  <input
                    aria-label="جست‌وجوی هتل"
                    value={hotelSearch}
                    onChange={(event) => setHotelSearch(event.target.value)}
                    placeholder="نام هتل در این شهر"
                  />
                </label>
                {hotelLoading && <p>در حال دریافت هتل‌های شهر…</p>}
                <div className={styles.scroll}>
                  <table className={styles.sheet}>
                    <thead>
                      <tr>
                        <th>انتخاب</th>
                        <th>هتل شهر</th>
                        <th>کارگزار</th>
                        <th>قیمت پایه / شب</th>
                        {labels.map((label) => (
                          <th key={label}>{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((row) => (
                        <tr
                          key={row.hotel.id}
                          className={row.selected ? styles.selectedRow : ''}
                        >
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`انتخاب هتل ${row.hotel.name}`}
                              checked={row.selected}
                              disabled={
                                !row.inCityList ||
                                (!row.selected && selected.length >= 50)
                              }
                              onChange={(event) =>
                                changeRow(row.hotel.id, {
                                  selected: event.target.checked,
                                })
                              }
                            />
                          </td>
                          <td>
                            <strong>{row.hotel.name}</strong>
                            {row.hotel.englishName && (
                              <small dir="ltr">{row.hotel.englishName}</small>
                            )}
                            {!row.inCityList && (
                              <small role="alert">
                                هتل دیگر فعال/قابل‌فروش نیست؛ تیک آن را بردارید.
                              </small>
                            )}
                          </td>
                          <td>
                            {row.selected ? (
                              <Lookup
                                kind="organizations"
                                label={`کارگزار ${row.hotel.name}`}
                                value={row.broker}
                                onChange={(broker) =>
                                  changeRow(row.hotel.id, { broker })
                                }
                              />
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            {row.selected ? (
                              <>
                                <input
                                  aria-label={`قیمت پایه ${row.hotel.name}`}
                                  type="number"
                                  min={currency === 'IRR' ? '1' : '0.01'}
                                  step={currency === 'IRR' ? '1' : '0.01'}
                                  max="999999999999"
                                  required
                                  value={row.base}
                                  onChange={(event) =>
                                    changeRow(row.hotel.id, {
                                      base: event.target.value,
                                    })
                                  }
                                />
                                <small>{currency}</small>
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                          {kinds.map((kind, index) => (
                            <td key={kind}>
                              {row.selected ? (
                                <>
                                  <input
                                    aria-label={`ضریب ${labels[index]} ${row.hotel.name}`}
                                    type="number"
                                    min="0"
                                    max="999.999"
                                    step="0.001"
                                    required
                                    value={row.factors[kind]}
                                    onChange={(event) =>
                                      changeRow(row.hotel.id, {
                                        factors: {
                                          ...row.factors,
                                          [kind]: event.target.value,
                                        },
                                      })
                                    }
                                  />
                                  <output dir="ltr">
                                    {price(
                                      row.base,
                                      row.factors[kind],
                                      currency,
                                    )}
                                  </output>
                                </>
                              ) : (
                                '—'
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!visibleRows.length && !hotelLoading && (
                  <p>هتل قابل‌فروشی در این شهر پیدا نشد.</p>
                )}
              </>
            )}
          </section>
          <section className={styles.toolbar}>
            <div>
              <h2>۴ · ذخیرهٔ بسته</h2>
              <p>
                ویرایش، نسخهٔ جدید می‌سازد و نسخه‌های قبلی و قیمت‌های منتشرشده
                را بازنویسی نمی‌کند.
              </p>
            </div>
            <button className={styles.primary} type="submit">
              {busy
                ? 'در حال ذخیره…'
                : editing
                  ? 'ذخیرهٔ نسخهٔ جدید'
                  : 'ساخت بستهٔ نرخ'}
            </button>
          </section>
        </fieldset>
      </form>
      {!canWrite && (
        <p role="alert">
          مجوز ثبت نرخ خرید ندارید؛ مشاهدهٔ بسته‌ها در دسترس است.
        </p>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <details>
        <summary>سابقهٔ نرخ‌های ثبت‌شدهٔ قبلی</summary>
        <RateHistory revision={revision} />
      </details>
    </main>
  );
}
