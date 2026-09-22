'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { LoginResponse, TourDepartureV1 } from '@nora/contracts';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { DatePicker } from '@/components/ui/date-picker';
import { Choice, Lookup, rateRequest, type Option } from './controls';
import { RateHistory } from './history';
import { kinds, labels, price, type Factors } from './model';
import styles from './rates.module.css';

type RoomTypeOption = Option & { code?: string };
type HotelOption = Option & {
  englishName?: string;
  roomTypes?: RoomTypeOption[];
};
type RoomRateDraft = {
  roomTypeId: string;
  roomTypeName: string;
  factor: string;
  maxAdults: string;
  maxChildren: string;
};
type GridRow = {
  hotel: HotelOption;
  selected: boolean;
  broker: Option | null;
  base: string;
  currency: string;
  factors: Factors;
  roomRates: RoomRateDraft[];
  inCityList: boolean;
};
type PackSummary = {
  tourLabel?: string;
  tourDepartureId?: string | null;
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
    currency: string;
    factors: Factors;
    roomRates: RoomRateDraft[];
  }[];
};
const blankFactors = (): Factors =>
  Object.fromEntries(kinds.map((kind) => [kind, ''])) as Factors;

export const availableFactors = (factors: Factors) =>
  Object.fromEntries(
    kinds
      .filter((kind) => factors[kind].trim())
      .map((kind) => [kind, factors[kind].trim()]),
  );

export function OccupancyFactorFields({
  hotelName,
  base,
  currency,
  factors,
  onChange,
}: {
  hotelName: string;
  base: string;
  currency: string;
  factors: Factors;
  onChange: (factors: Factors) => void;
}) {
  return (
    <div className={styles.occupancyFactors}>
      {kinds.map((kind, index) => (
        <label key={kind}>
          {labels[index]}
          <input
            aria-label={`ضریب ${labels[index]} ${hotelName}`}
            type="number"
            min="0.001"
            max="999.999"
            step="0.001"
            value={factors[kind]}
            placeholder="ندارد"
            onChange={(event) =>
              onChange({ ...factors, [kind]: event.target.value })
            }
          />
          <output dir="ltr">{price(base, factors[kind], currency)}</output>
        </label>
      ))}
    </div>
  );
}
const blankRow = (hotel: HotelOption, currency: string): GridRow => ({
  hotel,
  selected: false,
  broker: null,
  base: '',
  currency,
  factors: blankFactors(),
  roomRates: (hotel.roomTypes ?? []).map((room) => ({
    roomTypeId: room.id,
    roomTypeName: room.name,
    factor: '1',
    maxAdults: '2',
    maxChildren: '0',
  })),
  inCityList: true,
});
const dayCount = (checkIn: string, checkOut: string) =>
  checkIn && checkOut
    ? (Date.parse(checkOut) - Date.parse(checkIn)) / 86400000
    : 0;

export function HotelRatePackTable({
  packs,
  draft,
  activeId,
  opening,
  onOpen,
  onDraftFocus,
}: {
  packs: PackSummary[];
  draft: {
    cityName: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    hotelCount: number;
    currency: string;
  } | null;
  activeId: string | null;
  opening: boolean;
  onOpen: (id: string) => void;
  onDraftFocus: () => void;
}) {
  return (
    <table aria-label="جدول بسته‌های نرخ هتل" className={styles.packTable}>
      <thead>
        <tr>
          <th scope="col">تور و نوبت</th>
          <th scope="col">شهر</th>
          <th scope="col">ورود</th>
          <th scope="col">خروج</th>
          <th scope="col">شب</th>
          <th scope="col">هتل منتخب</th>
          <th scope="col">ارز</th>
          <th scope="col">نسخه</th>
          <th scope="col">عملیات</th>
        </tr>
      </thead>
      <tbody>
        {draft && (
          <tr className={styles.draftRow}>
            <td>بستهٔ جدید</td>
            <td>{draft.cityName}</td>
            <td dir="ltr">{draft.checkIn || '—'}</td>
            <td dir="ltr">{draft.checkOut || '—'}</td>
            <td>
              {draft.nights > 0 ? draft.nights.toLocaleString('fa-IR') : '—'}
            </td>
            <td>{draft.hotelCount.toLocaleString('fa-IR')}</td>
            <td>{draft.currency}</td>
            <td>ثبت‌نشده</td>
            <td>
              <button type="button" onClick={onDraftFocus}>
                تکمیل پیش‌نویس
              </button>
            </td>
          </tr>
        )}
        {packs.map((pack) => (
          <tr
            key={pack.id}
            className={activeId === pack.id ? styles.activePack : ''}
          >
            <td>{pack.tourLabel ?? '—'}</td>
            <td>
              <strong>{pack.cityName}</strong>
              <small>
                {pack.tourDepartureId ? '' : ' · نیازمند اتصال به نوبت تور'}
              </small>
            </td>
            <td dir="ltr">{pack.checkIn}</td>
            <td dir="ltr">{pack.checkOut}</td>
            <td>
              {dayCount(pack.checkIn, pack.checkOut).toLocaleString('fa-IR')}
            </td>
            <td>{pack.hotelCount.toLocaleString('fa-IR')}</td>
            <td>{pack.currency}</td>
            <td>{pack.version.toLocaleString('fa-IR')}</td>
            <td>
              <button
                type="button"
                onClick={() => onOpen(pack.id)}
                disabled={opening}
              >
                بازکردن و ویرایش
              </button>
            </td>
          </tr>
        ))}
        {!packs.length && !draft && (
          <tr>
            <td colSpan={9}>
              هنوز بسته‌ای ثبت نشده است؛ «بستهٔ جدید» را بزنید.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

export function HotelRatePacksWorkspace() {
  const requestedTourDepartureId =
    typeof window === 'undefined'
      ? ''
      : (new URLSearchParams(globalThis.location.search).get(
          'tourDepartureId',
        ) ?? '');
  const preselectedDeparture = useRef(false);
  const [departures, setDepartures] = useState<readonly TourDepartureV1[]>([]);
  const [tourPackageId, setTourPackageId] = useState('');
  const [tourDepartureId, setTourDepartureId] = useState('');
  const [session, setSession] = useState<LoginResponse | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
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
  const [editorMode, setEditorMode] = useState<'list' | 'new' | 'edit'>('list');
  const editorRef = useRef<HTMLDivElement>(null);
  const citySearchRef = useRef<HTMLInputElement>(null);
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [packTotal, setPackTotal] = useState(0);
  const [packPage, setPackPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [message, setMessage] = useState('');
  const pending = useRef<{ route: string; body: string; key: string } | null>(
    null,
  );

  useEffect(() => {
    if (!session) return;
    let active = true;
    rateRequest<{ data: TourDepartureV1[] }>('/tour-departures')
      .then((result) => {
        if (!active) return;
        setDepartures(result.data);
        const tour = result.data.find(
          (item) => item.id === requestedTourDepartureId,
        );
        if (!tour || preselectedDeparture.current) return;
        preselectedDeparture.current = true;
        setEditorMode('new');
        setTourPackageId(tour.package.id);
        setTourDepartureId(tour.id);
        setRows([]);
        setCityId(tour.package.destinationId);
        setCheckIn(tour.startsOn);
        setCheckOut(tour.endsOn);
        setBranch(tour.branchId);
        setCities((old) =>
          old.some((city) => city.id === tour.package.destinationId)
            ? old
            : [
                ...old,
                {
                  id: tour.package.destinationId,
                  name: `مقصد ${tour.package.name}`,
                },
              ],
        );
        setMessage(
          'هتل‌های مقصد و بازهٔ این نوبت آماده‌اند؛ هتل، کارگزار و نرخ خرید را انتخاب کنید.',
        );
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : 'دریافت تورها ناموفق بود.',
          );
      });
    return () => {
      active = false;
    };
  }, [session, requestedTourDepartureId]);

  useEffect(() => {
    if (editorMode === 'list') return;
    editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (editorMode === 'new') citySearchRef.current?.focus();
  }, [editorMode]);

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
          ...(saved.get(hotel.id) ?? blankRow(hotel, currency)),
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
  }, [session, cityId, currency, tourDepartureId]);

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
    setTourPackageId('');
    setTourDepartureId('');
    setEditing(null);
    setEditorMode('new');
    setCityId('');
    setCitySearch('');
    setHotelSearch('');
    setCheckIn('');
    setCheckOut('');
    setRows([]);
    setCurrency('EUR');
    setMethod('CHECK_IN');
    setError('');
    setMessage(
      'ابتدا تور و نوبت بلیت را انتخاب کنید، سپس بازه اقامت و نرخ هتل‌ها را وارد کنید.',
    );
    pending.current = null;
  }
  function closeEditor() {
    setEditorMode('list');
    setEditing(null);
    setError('');
    setMessage('');
    pending.current = null;
  }
  function switchBranch(value: string) {
    closeEditor();
    setBranch(value);
    setPackPage(1);
    setCityId('');
    setRows([]);
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
  function chooseDeparture(id: string) {
    const tour = departures.find((item) => item.id === id);
    setTourDepartureId(id);
    setRows([]);
    setCityId(tour?.package.destinationId ?? '');
    setCheckIn(tour?.startsOn ?? '');
    setCheckOut(tour?.endsOn ?? '');
    if (tour) {
      setBranch(tour.branchId);
      setCityId(tour.package.destinationId);
      setCities((old) =>
        old.some((city) => city.id === tour.package.destinationId)
          ? old
          : [
              ...old,
              {
                id: tour.package.destinationId,
                name: `مقصد ${tour.package.name}`,
              },
            ],
      );
    }
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
      setEditorMode('edit');
      setBranch(item.branchId);
      setTourDepartureId(item.tourDepartureId ?? '');
      setTourPackageId(
        departures.find((tour) => tour.id === item.tourDepartureId)?.package
          .id ?? '',
      );
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
          currency: row.currency ?? item.currency,
          factors: { ...blankFactors(), ...row.factors },
          roomRates: row.roomRates ?? [],
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
      !tourDepartureId ||
      !cityId ||
      nights <= 0 ||
      !selected.length ||
      selected.length > 50 ||
      selected.some(
        (row) =>
          !row.broker ||
          !row.base ||
          !row.inCityList ||
          !row.roomRates.some((room) => Number(room.factor) > 0),
      )
    ) {
      setError(
        'تور و نوبت بلیت، شهر و بازهٔ معتبر را مشخص کنید و برای هر هتل منتخب، کارگزار و قیمت را وارد کنید.',
      );
      return;
    }
    const route = editing ? `/packs/${editing.id}` : '/packs';
    const body = JSON.stringify({
      branchId: branch,
      tourDepartureId,
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
        currency: row.currency,
        factors: availableFactors(row.factors),
        roomRates: row.roomRates
          .filter((room) => Number(room.factor) > 0)
          .map((room) => ({
            roomTypeId: room.roomTypeId,
            factor: room.factor,
            maxAdults: Number(room.maxAdults),
            maxChildren: Number(room.maxChildren),
          })),
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
      setEditorMode('edit');
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
            تور و نوبت بلیت را انتخاب کنید؛ نرخ خرید هتل‌های بازه اقامت را ثبت و
            بعداً از همان بسته اصلاح کنید.
          </p>
        </div>
        <button type="button" onClick={() => newPack()} disabled={!canWrite}>
          + بستهٔ جدید
        </button>
      </header>
      <section aria-labelledby="packs-title">
        <div className={styles.toolbar}>
          <h2 id="packs-title">جدول بسته‌های نرخ هتل</h2>
          <label className={styles.branchFilter}>
            شعبه
            <Choice
              label="شعبهٔ جدول نرخ هتل"
              value={branch}
              onChange={switchBranch}
              options={session.user.branches.map((item) => ({
                id: item.id,
                name: item.name,
              }))}
            />
          </label>
          <span>{packTotal.toLocaleString('fa-IR')} بسته</span>
        </div>
        <div className={styles.scroll}>
          <HotelRatePackTable
            packs={packs.map((pack) => {
              const tour = departures.find(
                (item) => item.id === pack.tourDepartureId,
              );
              return {
                ...pack,
                tourLabel: tour
                  ? `${tour.package.name} · ${tour.startsOn} · ${tour.outbound.serviceNumber}`
                  : 'بدون نوبت فعال',
              };
            })}
            draft={
              editorMode === 'new'
                ? {
                    cityName:
                      cities.find((city) => city.id === cityId)?.name ??
                      'بستهٔ جدید',
                    checkIn,
                    checkOut,
                    nights,
                    hotelCount: selected.length,
                    currency,
                  }
                : null
            }
            activeId={editing?.id ?? null}
            opening={opening}
            onOpen={(id) => void openPack(id)}
            onDraftFocus={() => citySearchRef.current?.focus()}
          />
        </div>
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
      {editorMode !== 'list' && (
        <div ref={editorRef} className={styles.editor}>
          <div className={styles.toolbar}>
            <h2>
              {editorMode === 'new'
                ? 'پیش‌نویس بستهٔ جدید — ثبت‌نشده'
                : `ویرایش بستهٔ ${cities.find((city) => city.id === cityId)?.name ?? 'هتل'} · نسخه ${editing?.version.toLocaleString('fa-IR')}`}
            </h2>
            <button type="button" onClick={closeEditor} disabled={busy}>
              بستن جدول ویرایش
            </button>
          </div>
          <form onSubmit={(event) => void save(event)}>
            <fieldset disabled={busy || !canWrite}>
              <section>
                <h2>۱ · انتخاب تور و نوبت بلیت</h2>
                {!departures.some((tour) => tour.branchId === branch) && (
                  <p role="status">
                    برای این شعبه نوبت تور فعالی وجود ندارد. ابتدا در{' '}
                    <Link href="/ticket-management">مدیریت بلیت</Link> تعریف تور
                    را ثبت کنید و نوبتِ متصل به بلیت رفت‌وبرگشت را در{' '}
                    <Link href="/sales/pricing">مدیریت قیمت پکیج</Link> بسازید،
                    سپس این صفحه را تازه‌سازی کنید.
                  </p>
                )}
                <div className={styles.toolbar}>
                  <label>
                    تور
                    <Choice
                      label="تور نرخ خرید هتل"
                      value={tourPackageId}
                      onChange={(id) => {
                        setTourPackageId(id);
                        chooseDeparture('');
                      }}
                      options={[
                        ...Array.from(
                          new Map(
                            departures
                              .filter((tour) => tour.branchId === branch)
                              .map((tour) => [
                                tour.package.id,
                                {
                                  id: tour.package.id,
                                  name: tour.package.name,
                                },
                              ]),
                          ).values(),
                        ),
                      ]}
                    />
                  </label>
                  <label>
                    نوبت و بلیت رفت‌وبرگشت
                    <Choice
                      label="نوبت تور نرخ خرید هتل"
                      value={tourDepartureId}
                      onChange={chooseDeparture}
                      options={[
                        ...departures
                          .filter((tour) => tour.package.id === tourPackageId)
                          .map((tour) => ({
                            id: tour.id,
                            name: `${tour.startsOn} تا ${tour.endsOn} · ${tour.outbound.serviceNumber} / ${tour.returning?.serviceNumber ?? 'بدون برگشت'}`,
                          })),
                      ]}
                    />
                  </label>
                </div>
                {tourDepartureId && (
                  <p>
                    بازه اقامت از تاریخ نوبت پر شده است؛ هتل‌های منتخب این بسته
                    به همین نوبت و بلیت‌ها متصل می‌شوند.
                  </p>
                )}
              </section>
              <section>
                <h2>۲ · جدول شهر و بازهٔ اقامت</h2>
                <p>
                  شهر را انتخاب کنید، سپس ورود و خروج را در همان ردیف تعیین
                  کنید.
                </p>
                <div className={styles.scroll}>
                  <table className={styles.metaTable}>
                    <thead>
                      <tr>
                        <th scope="col">شعبه</th>
                        <th scope="col">جست‌وجوی شهر</th>
                        <th scope="col">شهر</th>
                        <th scope="col">ورود</th>
                        <th scope="col">خروج</th>
                        <th scope="col">شب</th>
                        <th scope="col">ارز پیش‌فرض ردیف جدید</th>
                        <th scope="col">مبنای نرخ</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          {session.user.branches.find(
                            (item) => item.id === branch,
                          )?.name ?? '—'}
                        </td>
                        <td>
                          <input
                            ref={citySearchRef}
                            aria-label="جست‌وجوی شهر"
                            value={citySearch}
                            onChange={(event) =>
                              setCitySearch(event.target.value)
                            }
                            placeholder="نام شهر"
                          />
                        </td>
                        <td>
                          <Choice
                            label="شهر"
                            value={cityId}
                            onChange={chooseCity}
                            options={cities}
                          />
                        </td>
                        <td>
                          <DatePicker
                            defaultCalendarSystem="gregorian"
                            gregorianEnglish
                            id="hotel-rate-check-in"
                            name="checkIn"
                            required
                            value={checkIn}
                            onChange={setCheckIn}
                            aria-label="ورود به هتل"
                            aria-describedby="hotel-rate-date-help"
                          />
                        </td>
                        <td>
                          <DatePicker
                            defaultCalendarSystem="gregorian"
                            gregorianEnglish
                            id="hotel-rate-check-out"
                            name="checkOut"
                            required
                            value={checkOut}
                            onChange={setCheckOut}
                            aria-label="خروج از هتل"
                            aria-describedby="hotel-rate-date-help"
                          />
                        </td>
                        <td>
                          <strong>
                            {nights > 0 ? nights.toLocaleString('fa-IR') : '—'}
                          </strong>
                        </td>
                        <td>
                          <Choice
                            label="ارز پیش‌فرض ردیف جدید"
                            value={currency}
                            onChange={setCurrency}
                            options={[
                              { id: 'EUR', name: 'یورو · EUR' },
                              { id: 'USD', name: 'دلار · USD' },
                              { id: 'IRR', name: 'ریال · IRR' },
                            ]}
                          />
                        </td>
                        <td>
                          <Choice
                            label="مبنای نرخ"
                            value={method}
                            onChange={setMethod}
                            options={[
                              { id: 'CHECK_IN', name: 'تاریخ ورود' },
                              { id: 'STAY', name: 'شب‌های اقامت' },
                            ]}
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
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
                    <h2>۲ · جدول انتخاب هتل و نرخ‌ها</h2>
                    <p>
                      تیک هر هتل یعنی حضور آن در این بازه را تأیید می‌کنید؛
                      فهرست اولیه، موجودی قطعی اتاق نیست.
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
                            <th>ارز</th>
                            <th>قیمت پایه / شب</th>
                            <th>نوع اتاق و ظرفیت</th>
                            <th>ضرایب چیدمان مسافر</th>
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
                                  <small dir="ltr">
                                    {row.hotel.englishName}
                                  </small>
                                )}
                                {!row.inCityList && (
                                  <small role="alert">
                                    هتل دیگر فعال/قابل‌فروش نیست؛ تیک آن را
                                    بردارید.
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
                                  <Choice
                                    label={`ارز نرخ ${row.hotel.name}`}
                                    value={row.currency}
                                    onChange={(value) =>
                                      changeRow(row.hotel.id, {
                                        currency: value,
                                      })
                                    }
                                    options={[
                                      { id: 'EUR', name: 'یورو · EUR' },
                                      { id: 'USD', name: 'دلار · USD' },
                                      { id: 'IRR', name: 'ریال · IRR' },
                                    ]}
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
                                      min={
                                        row.currency === 'IRR' ? '1' : '0.01'
                                      }
                                      step={
                                        row.currency === 'IRR' ? '1' : '0.01'
                                      }
                                      max="999999999999"
                                      required
                                      value={row.base}
                                      onChange={(event) =>
                                        changeRow(row.hotel.id, {
                                          base: event.target.value,
                                        })
                                      }
                                    />
                                    <small>{row.currency}</small>
                                  </>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td>
                                {row.selected ? (
                                  <div className={styles.roomRateEditor}>
                                    {(row.hotel.roomTypes ?? []).map(
                                      (roomType) => {
                                        const value = row.roomRates.find(
                                          (room) =>
                                            room.roomTypeId === roomType.id,
                                        ) ?? {
                                          roomTypeId: roomType.id,
                                          roomTypeName: roomType.name,
                                          factor: '1',
                                          maxAdults: '2',
                                          maxChildren: '0',
                                        };
                                        const update = (
                                          patch: Partial<RoomRateDraft>,
                                        ) =>
                                          changeRow(row.hotel.id, {
                                            roomRates: [
                                              ...row.roomRates.filter(
                                                (room) =>
                                                  room.roomTypeId !==
                                                  roomType.id,
                                              ),
                                              { ...value, ...patch },
                                            ],
                                          });
                                        return (
                                          <fieldset
                                            key={roomType.id}
                                            className={styles.roomRateCard}
                                          >
                                            <legend>{roomType.name}</legend>
                                            <label>
                                              ظرفیت بزرگسال
                                              <input
                                                aria-label={`ظرفیت بزرگسال ${roomType.name}`}
                                                type="number"
                                                min="1"
                                                max="20"
                                                value={value.maxAdults}
                                                onChange={(event) =>
                                                  update({
                                                    maxAdults:
                                                      event.target.value,
                                                  })
                                                }
                                              />
                                            </label>
                                            <label>
                                              ظرفیت کودک
                                              <input
                                                aria-label={`ظرفیت کودک ${roomType.name}`}
                                                type="number"
                                                min="0"
                                                max="20"
                                                value={value.maxChildren}
                                                onChange={(event) =>
                                                  update({
                                                    maxChildren:
                                                      event.target.value,
                                                  })
                                                }
                                              />
                                            </label>
                                            <small dir="ltr">
                                              {value.maxAdults || '0'} +{' '}
                                              {value.maxChildren || '0'}
                                            </small>
                                          </fieldset>
                                        );
                                      },
                                    )}
                                    {!(row.hotel.roomTypes ?? []).length && (
                                      <small role="alert">
                                        ابتدا نوع اتاق را برای این هتل در
                                        اطلاعات پایه تعریف کنید.
                                      </small>
                                    )}
                                    <Link href="/master-data/accommodation?tab=room-types">
                                      افزودن نوع اتاق و اتصال به هتل
                                    </Link>
                                    <small>ظرفیت هر نوع اتاق در قرارداد کنترل می‌شود.</small>
                                  </div>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td>
                                {row.selected ? (
                                  <>
                                    <OccupancyFactorFields
                                      hotelName={row.hotel.name}
                                      base={row.base}
                                      currency={row.currency}
                                      factors={row.factors}
                                      onChange={(factors) =>
                                        changeRow(row.hotel.id, { factors })
                                      }
                                    />
                                    <small>
                                      ضریب خالی یعنی این چیدمان برای هتل وجود ندارد.
                                    </small>
                                  </>
                                ) : (
                                  '—'
                                )}
                              </td>
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
                  <h2>۳ · ذخیرهٔ بسته</h2>
                  <p>
                    ویرایش، نسخهٔ جدید می‌سازد و نسخه‌های قبلی و قیمت‌های
                    منتشرشده را بازنویسی نمی‌کند.
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
        </div>
      )}
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
