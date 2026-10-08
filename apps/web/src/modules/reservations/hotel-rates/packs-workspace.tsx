'use client';

import { useEffect, useRef, useState } from 'react';
import { ManualHotelPanel, ManualHotelSelector } from './manual-hotel-panel';
import type { LoginResponse } from '@nora/contracts';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { DatePicker } from '@/components/ui/date-picker';
import { PackDestinationFields } from './pack-destination-fields';
import {
  loadPackDestinations,
  preferredPackDestination,
  type DestinationChoice,
} from './pack-destinations';
import { Choice, rateRequest, type Option } from './controls';
import { ExistingPacksBrowser } from './existing-packs-browser';
import { HotelPeriodsPanel } from './hotel-periods-panel';
import { kinds, type Factors } from './model';
import styles from './rates.module.css';
import type { HotelOccupancyRateV1 } from '@nora/contracts';
import { retimeManualRates } from './manual-coefficients';
import { OccupancyRateEditor } from './occupancy-import-panel';
import { OccupancyBulkPanel } from './occupancy-bulk-panel';

type RoomTypeOption = Option & { code?: string };
type HotelOption = Option & {
  englishName?: string;
  roomTypes?: RoomTypeOption[];
};
type RoomRateDraft = {
  occupancyRates?: HotelOccupancyRateV1[];
  roomTypeId: string;
  roomTypeName: string;
  factor: string;
  maxAdults: string;
  maxChildren2To6: string;
  maxChildren6To12: string;
  maxInfants: string;
};
type SavedRoomRate = Omit<
  RoomRateDraft,
  'maxAdults' | 'maxChildren2To6' | 'maxChildren6To12' | 'maxInfants'
> & {
  maxAdults: number;
  /** Legacy aggregate stored by rate packs created before age bands existed. */
  maxChildren: number;
  maxChildren2To6?: number;
  maxChildren6To12?: number;
  maxInfants?: number;
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
export type PackSummary = {
  sharedPeriod?: boolean;
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
export type PackDetail = Omit<PackSummary, 'hotelCount' | 'updatedAt'> & {
  batchId: string;
  rows: {
    hotelId: string;
    hotelName: string;
    brokerId: string;
    brokerName: string;
    base: string;
    currency: string;
    factors: Factors;
    roomRates: SavedRoomRate[];
  }[];
};
const blankFactors = (): Factors =>
  Object.fromEntries(kinds.map((kind) => [kind, ''])) as Factors;
export const automaticCheckOut = (value: string, days: number) => {
  if (!value || !Number.isSafeInteger(days) || days < 1) return '';
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const availableFactors = (factors: Factors) =>
  Object.fromEntries(
    kinds
      .filter((kind) => factors[kind].trim())
      .map((kind) => [kind, factors[kind].trim()]),
  );

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
    maxChildren2To6: '0',
    maxChildren6To12: '0',
    maxInfants: '0',
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
            <td>
              <strong>{pack.cityName}</strong>
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
            <td colSpan={8}>
              هنوز بسته‌ای ثبت نشده است؛ «بستهٔ جدید» را بزنید.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

export function HotelRatePacksWorkspace() {
  const [session, setSession] = useState<LoginResponse | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [branch, setBranch] = useState('');
  const [cities, setCities] = useState<DestinationChoice[]>([]);
  const [countries, setCountries] = useState<DestinationChoice[]>([]);
  const [countryId, setCountryId] = useState('');
  const [destinationChange, setDestinationChange] = useState<{
    kind: 'country' | 'city';
    id: string;
  } | null>(null);
  const [citySearch, setCitySearch] = useState('');
  const [cityId, setCityId] = useState('');
  const [hotelLoading, setHotelLoading] = useState(false);
  const [rows, setRows] = useState<GridRow[]>([]);
  const [manualHotelId, setManualHotelId] = useState('');
  const [manualValidity, setManualValidity] = useState<Record<string, boolean>>(
    {},
  );
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [stayNights, setStayNights] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [editing, setEditing] = useState<{
    id: string;
    version: number;
  } | null>(null);
  const [inputMode, setInputMode] = useState<'manual' | 'excel'>('manual');
  const [draftGeneration, setDraftGeneration] = useState(0);
  const [editorMode, setEditorMode] = useState<'list' | 'new' | 'edit'>('list');
  const editorRef = useRef<HTMLDivElement>(null);
  const destinationRef = useRef<HTMLElement>(null);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [browserLocked, setBrowserLocked] = useState(false);
  const [message, setMessage] = useState('');
  const pending = useRef<{ route: string; body: string; key: string } | null>(
    null,
  );

  useEffect(() => {
    if (editorMode === 'list') return;
    (editorMode === 'new'
      ? destinationRef.current
      : editorRef.current
    )?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [editorMode, draftGeneration]);

  useEffect(() => {
    let active = true;
    refreshAuthenticatedSession(getPublicApiBaseUrl() ?? '')
      .then((value) => {
        if (active) {
          setSession(value);
          if (
            value?.user.permissions.includes(
              'reservations.hotel_purchase.write',
            )
          )
            setEditorMode('new');
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
    loadPackDestinations('countries', rateRequest)
      .then((result) => {
        if (active) {
          setCountries(result);
          if (editorMode === 'new')
            setCountryId(
              (current) =>
                current || preferredPackDestination(result, 'country'),
            );
        }
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : 'کشورها بارگذاری نشدند.');
      });
    return () => {
      active = false;
    };
  }, [session, editorMode]);

  useEffect(() => {
    if (!session || !countryId) return;
    let active = true;
    const timer = setTimeout(() => {
      loadPackDestinations('cities', rateRequest, countryId, citySearch)
        .then((result) => {
          if (active) {
            setCities((old) => {
              const selected = old.find((city) => city.id === cityId);
              return selected && !result.some((city) => city.id === selected.id)
                ? [selected, ...result]
                : result;
            });
            if (
              editorMode === 'new' &&
              !citySearch &&
              countryId === preferredPackDestination(countries, 'country')
            )
              setCityId(
                (current) =>
                  current || preferredPackDestination(result, 'city'),
              );
          }
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
  }, [session, citySearch, cityId, countryId, countries, editorMode]);

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
          roomRates: (hotel.roomTypes ?? []).map(
            (room) =>
              saved
                .get(hotel.id)
                ?.roomRates.find((rate) => rate.roomTypeId === room.id) ?? {
                roomTypeId: room.id,
                roomTypeName: room.name,
                factor: '1',
                maxAdults: '2',
                maxChildren2To6: '0',
                maxChildren6To12: '0',
                maxInfants: '0',
              },
          ),
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
  }, [session, cityId, currency]);

  const nights = dayCount(checkIn, checkOut);
  const selected = rows.filter((row) => row.selected);
  const canWrite =
    session?.user.permissions.includes('reservations.hotel_purchase.write') ??
    false;

  function newPack() {
    if (busy || browserLocked) return;
    setEditing(null);
    setInputMode('manual');
    setDraftGeneration((value) => value + 1);
    setEditorMode('new');
    setCountryId(preferredPackDestination(countries, 'country'));
    setDestinationChange(null);
    setCities((current) =>
      current.filter(
        (city) =>
          city.countryId === preferredPackDestination(countries, 'country'),
      ),
    );
    setCityId('');
    setCitySearch('');
    setCheckIn('');
    setCheckOut('');
    setStayNights('');
    setRows([]);
    setManualHotelId('');
    setManualValidity({});
    setCurrency('EUR');
    setError('');
    setMessage(
      'شهر و بازهٔ اقامت را انتخاب کنید، سپس نرخ و ظرفیت اتاق‌های هتل‌ها را وارد کنید.',
    );
    pending.current = null;
  }
  function closeEditor() {
    if (busy) return;
    setEditorMode('list');
    setEditing(null);
    setError('');
    setMessage('');
    pending.current = null;
  }
  function switchBranch(value: string) {
    if (busy) return;
    if (browserLocked) {
      setError('ابتدا تغییرات قیمت بستهٔ موجود را ذخیره یا کنار بگذارید.');
      return;
    }
    closeEditor();
    setBranch(value);
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
    if (!cities.some((city) => city.id === id && city.countryId === countryId))
      return;
    setCityId(id);
    setManualHotelId('');
    setManualValidity({});
    setRows([]);
    pending.current = null;
  }
  function changeDestination(
    kind: 'country' | 'city',
    id: string,
    confirmed = false,
  ) {
    if ((kind === 'country' ? countryId : cityId) === id) return;
    if (selected.length && !confirmed) {
      setDestinationChange({ kind, id });
      return;
    }
    setDestinationChange(null);
    if (kind === 'city') {
      chooseCity(id);
      return;
    }
    setCountryId(id);
    setCities([]);
    setCitySearch('');
    setCityId('');
    setRows([]);
    pending.current = null;
  }
  async function openPack(id: string, hotelId?: string) {
    if (busy || browserLocked || opening) return;
    setOpening(true);
    setError('');
    setMessage('');
    pending.current = null;
    try {
      const item = await rateRequest<PackDetail>(`/packs/${id}`);
      if (item.tourDepartureId)
        throw new Error(
          'این بسته به تور متصل است؛ ویرایش آن را در مدیریت قیمت پکیج انجام دهید.',
        );
      const destination = await rateRequest<{ data: DestinationChoice[] }>(
        `/pack-options?kind=cities&cityId=${encodeURIComponent(item.cityId)}`,
      );
      const city = destination.data.find((option) => option.id === item.cityId);
      if (!city?.countryId)
        throw new Error('کشور شهر این بسته در اطلاعات پایه مشخص نیست.');
      setCountryId(city.countryId);
      setEditing({ id: item.id, version: item.version });
      setEditorMode('edit');
      setInputMode('manual');
      setDraftGeneration((value) => value + 1);
      setBranch(item.branchId);
      setCityId(item.cityId);
      setCitySearch('');
      setCities((old) =>
        old.some((city) => city.id === item.cityId)
          ? old
          : [
              city,
              ...old.filter((option) => option.countryId === city.countryId),
            ],
      );
      setCheckIn(item.checkIn);
      setCheckOut(item.checkOut);
      setStayNights(String(dayCount(item.checkIn, item.checkOut)));
      setCurrency(item.currency);
      setManualHotelId(
        item.rows.find((row) => row.hotelId === hotelId)?.hotelId ??
          item.rows[0]?.hotelId ??
          '',
      );
      setManualValidity(
        Object.fromEntries(
          item.rows.map((row) => [
            row.hotelId,
            row.roomRates.some((room) => room.occupancyRates?.length),
          ]),
        ),
      );
      setRows(
        item.rows.map((row) => ({
          hotel: {
            id: row.hotelId,
            name: row.hotelName,
            roomTypes: (row.roomRates ?? []).map((room) => ({
              id: room.roomTypeId,
              name: room.roomTypeName,
            })),
          },
          selected: true,
          broker: { id: row.brokerId, name: row.brokerName },
          base: row.base,
          currency: row.currency ?? item.currency,
          factors: row.roomRates.some((room) => room.occupancyRates?.length)
            ? { ...blankFactors(), ...row.factors }
            : blankFactors(),
          roomRates: (row.roomRates ?? []).map((room) => ({
            ...room,
            maxAdults: String(room.maxAdults),
            maxChildren2To6: String(
              room.maxChildren2To6 ?? room.maxChildren ?? 0,
            ),
            maxChildren6To12: String(room.maxChildren6To12 ?? 0),
            maxInfants: String(room.maxInfants ?? 0),
          })),
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
    if (busy || !canWrite || browserLocked) return;
    setError('');
    setMessage('');
    if (
      !branch ||
      !cityId ||
      !Number.isSafeInteger(nights) ||
      nights <= 0 ||
      nights > 365 ||
      !selected.length ||
      selected.length > 50 ||
      selected.some((row) => manualValidity[row.hotel.id] === false) ||
      selected.some(
        (row) =>
          !row.broker ||
          !row.base ||
          (!Object.values(row.factors).some((value) => Number(value) > 0) &&
            !row.roomRates.some((room) => room.occupancyRates?.length)) ||
          !row.inCityList ||
          !row.roomRates.some((room) => Number(room.factor) > 0),
      )
    ) {
      setError(
        'شهر و بازهٔ معتبر را مشخص کنید و برای هر هتل منتخب، کارگزار، قیمت، ظرفیت و حداقل یک ضریب چیدمان را وارد کنید.',
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
      method: 'STAY',
      ...(editing ? { expectedVersion: editing.version } : {}),
      rows: selected.map((row) => ({
        hotelId: row.hotel.id,
        brokerId: row.broker!.id,
        base: row.base,
        currency: row.currency,
        factors: availableFactors(row.factors),
        roomRates: row.roomRates
          .filter(
            (room) =>
              Number(room.factor) > 0 &&
              (!row.roomRates.some((r) =>
                r.occupancyRates?.some((rate) => rate.manualPricing),
              ) ||
                room.occupancyRates?.length),
          )
          .map((room) => ({
            roomTypeId: room.roomTypeId,
            factor: room.factor,
            maxAdults: Number(room.maxAdults),
            maxChildren:
              Number(room.maxChildren2To6) + Number(room.maxChildren6To12),
            maxChildren2To6: Number(room.maxChildren2To6),
            maxChildren6To12: Number(room.maxChildren6To12),
            maxInfants: Number(room.maxInfants),
            ...(room.occupancyRates
              ? { occupancyRates: room.occupancyRates }
              : {}),
          })),
      })),
    });
    if (new TextEncoder().encode(body).byteLength > 90000) {
      setError(
        'حجم بسته زیاد است؛ بازه یا تعداد هتل‌ها را کمتر کنید. چیزی ثبت نشده است.',
      );
      return;
    }
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
      setMessage(
        `بستهٔ ${cities.find((city) => city.id === cityId)?.name ?? 'شهر'} با ${selected.length.toLocaleString('fa-IR')} هتل و نسخهٔ ${result.version.toLocaleString('fa-IR')} ذخیره شد.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ذخیره انجام نشد.');
    } finally {
      setBusy(false);
    }
  }

  function chooseManualHotel(id: string) {
    setManualHotelId(id);
    const found = rows.find((row) => row.hotel.id === id);
    if (found && !found.selected) {
      changeRow(id, { selected: true, factors: blankFactors(), base: '1' });
      setManualValidity((old) => ({ ...old, [id]: false }));
    }
  }

  function changeCheckIn(value: string) {
    setCheckIn(value);
    const end = automaticCheckOut(value, Number(stayNights));
    setCheckOut(end);
    setRows((old) =>
      old.map((row) => ({
        ...row,
        roomRates: row.roomRates.map((room) =>
          room.occupancyRates
            ? {
                ...room,
                occupancyRates: retimeManualRates(
                  room.occupancyRates,
                  value,
                  end,
                ),
              }
            : room,
        ),
      })),
    );
    pending.current = null;
  }

  function changeStayNights(value: string) {
    setStayNights(value);
    const end = automaticCheckOut(checkIn, Number(value));
    setCheckOut(end);
    setRows((old) =>
      old.map((row) => ({
        ...row,
        roomRates: row.roomRates.map((room) =>
          room.occupancyRates
            ? {
                ...room,
                occupancyRates: retimeManualRates(
                  room.occupancyRates,
                  checkIn,
                  end,
                ),
              }
            : room,
        ),
      })),
    );
    pending.current = null;
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
          <p>رزرواسیون / نرخ هتل</p>
          <h1>مدیریت نرخ‌های هتل</h1>
        </div>
        <button
          className={styles.primary}
          type="button"
          onClick={newPack}
          disabled={!canWrite || busy || browserLocked || opening}
        >
          + بستهٔ جدید
        </button>
      </header>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <div className={styles.modeBar} aria-label="روش ورود نرخ">
        <button
          type="button"
          aria-pressed={inputMode === 'manual'}
          disabled={busy || opening || browserLocked}
          onClick={() => setInputMode('manual')}
        >
          ثبت دستی نرخ
        </button>
        <button
          type="button"
          aria-pressed={inputMode === 'excel'}
          disabled={busy || opening || browserLocked || editorMode === 'edit'}
          onClick={() => setInputMode('excel')}
        >
          ورودی اکسل
        </button>
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
      </div>
      {editorMode !== 'list' && (
        <section
          ref={destinationRef}
          className={styles.destinationSetup}
          aria-label="انتخاب مقصد و هتل"
        >
          <PackDestinationFields
            stacked
            countries={countries}
            cities={cities}
            countryId={countryId}
            cityId={cityId}
            disabled={!canWrite || busy || opening || editorMode === 'edit'}
            onCountryChange={(id) => changeDestination('country', id)}
            onCityChange={(id) => changeDestination('city', id)}
            onCitySearch={setCitySearch}
          />
          {inputMode === 'manual' && (
            <div className={styles.destinationHotel}>
              {hotelLoading ? (
                <p role="status">در حال دریافت هتل‌های شهر…</p>
              ) : cityId ? (
                <ManualHotelSelector
                  disabled={busy || opening || !canWrite}
                  rows={rows}
                  hotelId={manualHotelId}
                  onChoose={chooseManualHotel}
                />
              ) : (
                <p>برای نمایش هتل‌ها، شهر را انتخاب کنید.</p>
              )}
            </div>
          )}
          {destinationChange && (
            <div role="alert" className={styles.confirmation}>
              <p>
                با تغییر مقصد، نرخ‌ها و نگاشت‌های ذخیره‌نشدهٔ پیش‌نویس پاک
                می‌شوند. ادامه می‌دهید؟
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  changeDestination(
                    destinationChange.kind,
                    destinationChange.id,
                    true,
                  )
                }
              >
                تأیید تغییر مقصد و پاک‌کردن پیش‌نویس
              </button>
              <button type="button" onClick={() => setDestinationChange(null)}>
                انصراف
              </button>
            </div>
          )}
        </section>
      )}
      {cityId && branch && (
        <HotelPeriodsPanel
          key={`${branch}:${cityId}`}
          branchId={branch}
          cityId={cityId}
          hotelId={manualHotelId}
          revision={revision}
          disabled={busy || opening || browserLocked}
          canWrite={canWrite}
          onEdit={(id, hotelId) => void openPack(id, hotelId)}
          onSaved={() => setRevision((value) => value + 1)}
        />
      )}
      <div hidden={inputMode !== 'manual'}>
        {editorMode !== 'list' && (
          <div
            ref={editorRef}
            className={styles.editor}
            aria-label="ویرایش دستی بستهٔ نرخ"
          >
            <form onSubmit={(event) => void save(event)}>
              <fieldset
                disabled={busy || !canWrite || opening || browserLocked}
              >
                <section className={styles.staySetup}>
                  <h2>بازهٔ نرخ</h2>
                  <div className={styles.stayFields}>
                    <label className={styles.destinationField}>
                      ورود به هتل
                      <DatePicker
                        defaultCalendarSystem="gregorian"
                        gregorianEnglish
                        id="hotel-rate-check-in"
                        name="checkIn"
                        required
                        value={checkIn}
                        onChange={changeCheckIn}
                        aria-label="ورود به هتل"
                      />
                    </label>
                    <label className={styles.destinationField}>
                      تعداد شب اقامت
                      <input
                        aria-label="تعداد شب اقامت"
                        type="number"
                        min="1"
                        max="365"
                        required
                        value={stayNights}
                        onChange={(event) =>
                          changeStayNights(event.target.value)
                        }
                      />
                    </label>
                    <div className={styles.destinationField}>
                      <span>خروج خودکار</span>
                      <output dir="ltr">{checkOut || '—'}</output>
                    </div>
                    <label className={styles.destinationField}>
                      ارز پیش‌فرض ردیف جدید
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
                    </label>
                  </div>
                </section>
                <ManualHotelPanel
                  hideSelector
                  key={`${editing?.id ?? 'new'}:${cityId}:${draftGeneration}`}
                  rows={rows}
                  hotelId={manualHotelId}
                  checkIn={checkIn}
                  checkOut={checkOut}
                  onChoose={chooseManualHotel}
                  onChange={(id, patch) =>
                    changeRow(id, {
                      ...patch,
                      ...(patch.roomRates ? { factors: blankFactors() } : {}),
                    })
                  }
                  onValidityChange={(id, valid) =>
                    setManualValidity((old) => ({ ...old, [id]: valid }))
                  }
                />
                {selected.flatMap((row) =>
                  row.roomRates
                    .filter(
                      (room) =>
                        room.occupancyRates &&
                        !room.occupancyRates.some((rate) => rate.manualPricing),
                    )
                    .map((room) => (
                      <section key={`${row.hotel.id}:${room.roomTypeId}`}>
                        <h3>
                          {row.hotel.name} / {room.roomTypeName}
                        </h3>
                        <OccupancyRateEditor
                          disabled={!canWrite || busy}
                          rates={room.occupancyRates!}
                          onChange={(rates) => {
                            setRows((current) =>
                              current.map((hotelRow) =>
                                hotelRow.hotel.id !== row.hotel.id
                                  ? hotelRow
                                  : {
                                      ...hotelRow,
                                      roomRates: hotelRow.roomRates.map((r) =>
                                        r.roomTypeId === room.roomTypeId
                                          ? { ...r, occupancyRates: rates }
                                          : r,
                                      ),
                                    },
                              ),
                            );
                            pending.current = null;
                          }}
                        />
                      </section>
                    )),
                )}
                <div className={styles.saveBar}>
                  <span>
                    {selected.length.toLocaleString('fa-IR')} هتل منتخب
                  </span>
                  <div>
                    <button type="button" onClick={closeEditor}>
                      بستن جدول ویرایش
                    </button>
                    <button className={styles.primary} type="submit">
                      {busy
                        ? 'در حال ذخیره…'
                        : editing
                          ? 'ذخیرهٔ نسخهٔ جدید'
                          : 'ثبت بستهٔ نرخ'}
                    </button>
                  </div>
                </div>
              </fieldset>
            </form>
          </div>
        )}
      </div>
      {inputMode === 'excel' && (
        <OccupancyBulkPanel
          key={`${branch}:${cityId}:${editorMode}`}
          branchId={branch}
          countryId={countryId}
          cityId={cityId}
          actorId={session.user.id}
          permissions={session.user.permissions}
          disabled={
            !canWrite || editorMode !== 'new' || !cityId || browserLocked
          }
          onBusy={setBusy}
          onSaved={() => setRevision((value) => value + 1)}
        />
      )}
      {!canWrite && (
        <p role="alert">
          مجوز ثبت نرخ خرید ندارید؛ مشاهدهٔ بسته‌ها در دسترس است.
        </p>
      )}
      <details className={styles.savedPackages}>
        <summary>بسته‌های ثبت‌شده و ویرایش نرخ</summary>
        <ExistingPacksBrowser
          key={branch}
          branchId={branch}
          revision={revision}
          canWrite={canWrite && !busy && !opening}
          onEdit={(id) => void openPack(id)}
          onLockChange={setBrowserLocked}
          onSaved={() => setRevision((value) => value + 1)}
        />
      </details>
    </main>
  );
}
