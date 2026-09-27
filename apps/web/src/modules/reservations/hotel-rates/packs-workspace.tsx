'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { LoginResponse } from '@nora/contracts';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { DatePicker } from '@/components/ui/date-picker';
import { masterDataApi } from '@/modules/master-data/api/client';
import { Choice, Lookup, rateRequest, type Option } from './controls';
import { RateHistory } from './history';
import { kinds, labels, price, type FactorKind, type Factors } from './model';
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
type NewRoomDraft = {
  name: string;
  maxAdults: string;
  maxChildren2To6: string;
  maxChildren6To12: string;
  maxInfants: string;
  factor: string;
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
    roomRates: SavedRoomRate[];
  }[];
};
const blankFactors = (): Factors =>
  Object.fromEntries(kinds.map((kind) => [kind, ''])) as Factors;
const defaultFactorKinds: FactorKind[] = ['double', 'single', 'doubleChild'];
const factorLabel = (kind: FactorKind) => labels[kinds.indexOf(kind)]!;
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

export function OccupancyFactorFields({
  hotelName,
  base,
  currency,
  factors,
  visibleKinds = defaultFactorKinds,
  onChange,
}: {
  hotelName: string;
  base: string;
  currency: string;
  factors: Factors;
  visibleKinds?: readonly FactorKind[];
  onChange: (factors: Factors) => void;
}) {
  return (
    <div
      className={styles.occupancyFactors}
      style={{ '--factor-columns': visibleKinds.length } as React.CSSProperties}
    >
      {visibleKinds.map((kind) => (
        <label key={kind}>
          {factorLabel(kind)}
          <input
            aria-label={`ضریب ${factorLabel(kind)} ${hotelName}`}
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
  const [cities, setCities] = useState<HotelOption[]>([]);
  const [citySearch, setCitySearch] = useState('');
  const [cityId, setCityId] = useState('');
  const [hotelSearch, setHotelSearch] = useState('');
  const [hotelLoading, setHotelLoading] = useState(false);
  const [rows, setRows] = useState<GridRow[]>([]);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [stayNights, setStayNights] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [activeFactorKinds, setActiveFactorKinds] =
    useState<FactorKind[]>(defaultFactorKinds);
  const [newRoomDrafts, setNewRoomDrafts] = useState<
    Record<string, NewRoomDraft>
  >({});
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
    setEditorMode('new');
    setCityId('');
    setCitySearch('');
    setHotelSearch('');
    setCheckIn('');
    setCheckOut('');
    setStayNights('');
    setRows([]);
    setCurrency('EUR');
    setActiveFactorKinds(defaultFactorKinds);
    setNewRoomDrafts({});
    setError('');
    setMessage(
      'شهر و بازهٔ اقامت را انتخاب کنید، سپس نرخ و ظرفیت اتاق‌های هتل‌ها را وارد کنید.',
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
      setCityId(item.cityId);
      setCitySearch('');
      setCities((old) =>
        old.some((city) => city.id === item.cityId)
          ? old
          : [{ id: item.cityId, name: item.cityName }, ...old],
      );
      setCheckIn(item.checkIn);
      setCheckOut(item.checkOut);
      setStayNights(String(dayCount(item.checkIn, item.checkOut)));
      setCurrency(item.currency);
      const savedFactorKinds = kinds.filter((kind) =>
        item.rows.some((row) => Boolean(row.factors[kind]?.trim())),
      );
      setActiveFactorKinds(
        savedFactorKinds.length ? savedFactorKinds : defaultFactorKinds,
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
          factors: { ...blankFactors(), ...row.factors },
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
    setError('');
    setMessage('');
    if (
      !branch ||
      !cityId ||
      nights <= 0 ||
      !selected.length ||
      selected.length > 50 ||
      selected.some(
        (row) =>
          !row.broker ||
          !row.base ||
          !Object.values(row.factors).some((value) => Number(value) > 0) ||
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
          .filter((room) => Number(room.factor) > 0)
          .map((room) => ({
            roomTypeId: room.roomTypeId,
            factor: room.factor,
            maxAdults: Number(room.maxAdults),
            maxChildren:
              Number(room.maxChildren2To6) + Number(room.maxChildren6To12),
            maxChildren2To6: Number(room.maxChildren2To6),
            maxChildren6To12: Number(room.maxChildren6To12),
            maxInfants: Number(room.maxInfants),
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

  function changeCheckIn(value: string) {
    setCheckIn(value);
    setCheckOut(automaticCheckOut(value, Number(stayNights)));
    pending.current = null;
  }

  function changeStayNights(value: string) {
    setStayNights(value);
    setCheckOut(automaticCheckOut(checkIn, Number(value)));
    pending.current = null;
  }

  function toggleFactorColumn(kind: FactorKind) {
    setActiveFactorKinds((current) => {
      if (current.includes(kind)) {
        if (current.length === 1) {
          setError('حداقل یک ستون ضریب باید فعال بماند.');
          return current;
        }
        setRows((currentRows) =>
          currentRows.map((row) => ({
            ...row,
            factors: { ...row.factors, [kind]: '' },
          })),
        );
        return current.filter((item) => item !== kind);
      }
      return kinds.filter((item) => [...current, kind].includes(item));
    });
    pending.current = null;
  }

  function changeNewRoomDraft(hotelId: string, patch: Partial<NewRoomDraft>) {
    setNewRoomDrafts((current) => ({
      ...current,
      [hotelId]: {
        name: '',
        maxAdults: '2',
        maxChildren2To6: '0',
        maxChildren6To12: '0',
        maxInfants: '0',
        factor: '1',
        ...current[hotelId],
        ...patch,
      },
    }));
  }

  async function addRoomTypeToHotel(row: GridRow) {
    const draft = newRoomDrafts[row.hotel.id] ?? {
      name: '',
      maxAdults: '2',
      maxChildren2To6: '0',
      maxChildren6To12: '0',
      maxInfants: '0',
      factor: '1',
    };
    const maxAdults = Number(draft.maxAdults);
    const maxChildren2To6 = Number(draft.maxChildren2To6);
    const maxChildren6To12 = Number(draft.maxChildren6To12);
    const maxInfants = Number(draft.maxInfants);
    if (
      !draft.name.trim() ||
      !Number.isSafeInteger(maxAdults) ||
      maxAdults < 1 ||
      maxAdults > 20 ||
      !Number.isSafeInteger(maxChildren2To6) ||
      maxChildren2To6 < 0 ||
      maxChildren2To6 > 20 ||
      !Number.isSafeInteger(maxChildren6To12) ||
      maxChildren6To12 < 0 ||
      maxChildren6To12 > 20 ||
      !Number.isSafeInteger(maxInfants) ||
      maxInfants < 0 ||
      maxInfants > 20 ||
      !/^\d{1,3}(?:\.\d{1,3})?$/.test(draft.factor) ||
      Number(draft.factor) <= 0
    ) {
      setError('نام، ظرفیت و ضریب نوع اتاق جدید را معتبر وارد کنید.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const hotel = await masterDataApi.detail('hotels', row.hotel.id);
      const room = await masterDataApi.create('room-types', {
        values: {
          name: draft.name.trim(),
          referenceCapacity: String(
            maxAdults + maxChildren2To6 + maxChildren6To12 + maxInfants,
          ),
        },
      });
      const currentRoomIds = String(hotel.data.attributes.roomTypeIds ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      await masterDataApi.update('hotels', row.hotel.id, {
        values: {
          roomTypeIds: [...new Set([...currentRoomIds, room.data.id])].join(
            ',',
          ),
        },
        version: hotel.data.version,
      });
      const roomType = { id: room.data.id, name: draft.name.trim() };
      setRows((current) =>
        current.map((item) =>
          item.hotel.id === row.hotel.id
            ? {
                ...item,
                hotel: {
                  ...item.hotel,
                  roomTypes: [...(item.hotel.roomTypes ?? []), roomType],
                },
                roomRates: [
                  ...item.roomRates,
                  {
                    roomTypeId: room.data.id,
                    roomTypeName: roomType.name,
                    factor: draft.factor,
                    maxAdults: draft.maxAdults,
                    maxChildren2To6: draft.maxChildren2To6,
                    maxChildren6To12: draft.maxChildren6To12,
                    maxInfants: draft.maxInfants,
                  },
                ],
              }
            : item,
        ),
      );
      setNewRoomDrafts((current) => {
        const next = { ...current };
        delete next[row.hotel.id];
        return next;
      });
      setMessage(
        `نوع اتاق «${roomType.name}» ساخته و به هتل ${row.hotel.name} متصل شد.`,
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'ساخت یا اتصال نوع اتاق انجام نشد.',
      );
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
            نرخ هتل‌های یک شهر را برای بازهٔ اقامت ثبت کنید. ترکیب تور، بلیط و
            نرخ هتل در مدیریت پکیج انجام می‌شود.
          </p>
        </div>
        <button type="button" onClick={() => newPack()} disabled={!canWrite}>
          + بستهٔ جدید
        </button>
      </header>
      <div className={styles.dashboard} aria-label="داشبورد نرخ هتل">
        <article className={styles.dashboardPrimary}>
          <span>بسته‌های ثبت‌شده</span>
          <strong>{packTotal.toLocaleString('fa-IR')}</strong>
          <small>نسخه‌دار و قابل بازگشایی</small>
        </article>
        <article className={styles.dashboardBlue}>
          <span>هتل‌های بستهٔ باز</span>
          <strong>{selected.length.toLocaleString('fa-IR')}</strong>
          <small>برای شهر و بازهٔ انتخاب‌شده</small>
        </article>
        <article className={styles.dashboardAmber}>
          <span>شب‌های اقامت</span>
          <strong>{nights > 0 ? nights.toLocaleString('fa-IR') : '—'}</strong>
          <small>خروج به‌صورت خودکار محاسبه می‌شود</small>
        </article>
        <article className={styles.dashboardGreen}>
          <span>مبنای نرخ</span>
          <strong>هر نفر / هر شب</strong>
          <small>ثابت برای تمام ردیف‌های این بخش</small>
        </article>
      </div>
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
            packs={packs}
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
                <h2>۱ · شهر و بازهٔ اقامت</h2>
                <p>
                  شهر و روز ورود را انتخاب کنید و تعداد شب را بنویسید؛ تاریخ
                  خروج خودکار محاسبه می‌شود.
                </p>
                <div className={styles.scroll}>
                  <table className={styles.metaTable}>
                    <thead>
                      <tr>
                        <th scope="col">شعبه</th>
                        <th scope="col">شهر</th>
                        <th scope="col">ورود</th>
                        <th scope="col">تعداد شب</th>
                        <th scope="col">خروج خودکار</th>
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
                            placeholder="جست‌وجوی نام شهر"
                          />
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
                            onChange={changeCheckIn}
                            aria-label="ورود به هتل"
                            aria-describedby="hotel-rate-date-help"
                          />
                        </td>
                        <td>
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
                        </td>
                        <td dir="ltr">
                          <strong>{checkOut || '—'}</strong>
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
                          <strong>هر نفر / هر شب</strong>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p id="hotel-rate-date-help">
                  {nights > 0
                    ? `${nights.toLocaleString('fa-IR')} شب اقامت؛ خروج ${checkOut} و روز خروج در تعداد شب محاسبه نمی‌شود.`
                    : 'روز ورود و تعداد شب را وارد کنید.'}
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
                <div className={styles.factorManager}>
                  <div>
                    <strong>ستون‌های ضریب قیمت پکیج</strong>
                    <p>
                      پیش‌فرض: دبل، سینگل و بچه با تخت. ستون حذف‌شده برای
                      قرارداد و قیمت‌گذاری قابل استفاده نیست.
                    </p>
                  </div>
                  <div className={styles.factorButtons}>
                    {kinds.map((kind) => {
                      const active = activeFactorKinds.includes(kind);
                      return (
                        <button
                          key={kind}
                          type="button"
                          aria-pressed={active}
                          className={active ? styles.factorActive : ''}
                          onClick={() => toggleFactorColumn(kind)}
                        >
                          {active ? '−' : '+'} {factorLabel(kind)}
                        </button>
                      );
                    })}
                  </div>
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
                          </tr>
                        </thead>
                        <tbody>
                          {visibleRows.map((row) => (
                            <Fragment key={row.hotel.id}>
                              <tr
                                key={row.hotel.id}
                                className={
                                  row.selected ? styles.selectedRow : ''
                                }
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
                              </tr>
                              {row.selected && (
                                <tr className={styles.selectedRow}>
                                  <td colSpan={5}>
                                    <div className={styles.hotelRateDetails}>
                                      {row.selected ? (
                                        <div className={styles.roomRateEditor}>
                                          <div
                                            className={styles.roomRateHeader}
                                          >
                                            <span>نوع اتاق</span>
                                            <span>بزرگسال</span>
                                            <span>کودک ۲–۶</span>
                                            <span>کودک ۶–۱۲</span>
                                            <span>نوزاد</span>
                                            <span>ظرفیت</span>
                                            <span>ضریب</span>
                                            <span>قیمت پکیج</span>
                                          </div>
                                          {(row.hotel.roomTypes ?? []).map(
                                            (roomType) => {
                                              const value = row.roomRates.find(
                                                (room) =>
                                                  room.roomTypeId ===
                                                  roomType.id,
                                              ) ?? {
                                                roomTypeId: roomType.id,
                                                roomTypeName: roomType.name,
                                                factor: '1',
                                                maxAdults: '2',
                                                maxChildren2To6: '0',
                                                maxChildren6To12: '0',
                                                maxInfants: '0',
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
                                                  className={
                                                    styles.roomRateCard
                                                  }
                                                >
                                                  <legend>
                                                    {roomType.name}
                                                  </legend>
                                                  <label aria-label="ظرفیت بزرگسال">
                                                    <span
                                                      className={
                                                        styles.mobileLabel
                                                      }
                                                    >
                                                      بزرگسال
                                                    </span>
                                                    <input
                                                      aria-label={`ظرفیت بزرگسال ${roomType.name}`}
                                                      type="number"
                                                      required
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
                                                  <label aria-label="ظرفیت کودک ۲ تا ۶ سال">
                                                    <span
                                                      className={
                                                        styles.mobileLabel
                                                      }
                                                    >
                                                      کودک ۲–۶
                                                    </span>
                                                    <input
                                                      aria-label={`ظرفیت کودک ۲ تا ۶ سال ${roomType.name}`}
                                                      type="number"
                                                      required
                                                      min="0"
                                                      max="20"
                                                      value={
                                                        value.maxChildren2To6
                                                      }
                                                      onChange={(event) =>
                                                        update({
                                                          maxChildren2To6:
                                                            event.target.value,
                                                        })
                                                      }
                                                    />
                                                  </label>
                                                  <label aria-label="ظرفیت کودک ۶ تا ۱۲ سال">
                                                    <span
                                                      className={
                                                        styles.mobileLabel
                                                      }
                                                    >
                                                      کودک ۶–۱۲
                                                    </span>
                                                    <input
                                                      aria-label={`ظرفیت کودک ۶ تا ۱۲ سال ${roomType.name}`}
                                                      type="number"
                                                      required
                                                      min="0"
                                                      max="20"
                                                      value={
                                                        value.maxChildren6To12
                                                      }
                                                      onChange={(event) =>
                                                        update({
                                                          maxChildren6To12:
                                                            event.target.value,
                                                        })
                                                      }
                                                    />
                                                  </label>
                                                  <label aria-label="ظرفیت نوزاد">
                                                    <span
                                                      className={
                                                        styles.mobileLabel
                                                      }
                                                    >
                                                      نوزاد
                                                    </span>
                                                    <input
                                                      aria-label={`ظرفیت نوزاد ${roomType.name}`}
                                                      type="number"
                                                      required
                                                      min="0"
                                                      max="20"
                                                      value={value.maxInfants}
                                                      onChange={(event) =>
                                                        update({
                                                          maxInfants:
                                                            event.target.value,
                                                        })
                                                      }
                                                    />
                                                  </label>
                                                  <small dir="ltr">
                                                    {value.maxAdults || '0'} +{' '}
                                                    {value.maxChildren2To6 ||
                                                      '0'}{' '}
                                                    +{' '}
                                                    {value.maxChildren6To12 ||
                                                      '0'}{' '}
                                                    + {value.maxInfants || '0'}
                                                  </small>
                                                  <label aria-label="ضریب نوع اتاق">
                                                    <span
                                                      className={
                                                        styles.mobileLabel
                                                      }
                                                    >
                                                      ضریب
                                                    </span>
                                                    <input
                                                      aria-label={`ضریب نوع اتاق ${roomType.name}`}
                                                      type="number"
                                                      min="0.001"
                                                      max="999.999"
                                                      step="0.001"
                                                      value={value.factor}
                                                      onChange={(event) =>
                                                        update({
                                                          factor:
                                                            event.target.value,
                                                        })
                                                      }
                                                    />
                                                  </label>
                                                  <output dir="ltr">
                                                    {price(
                                                      row.base,
                                                      value.factor,
                                                      row.currency,
                                                    )}{' '}
                                                    {row.currency}
                                                  </output>
                                                </fieldset>
                                              );
                                            },
                                          )}
                                          {!(row.hotel.roomTypes ?? [])
                                            .length && (
                                            <small role="alert">
                                              ابتدا نوع اتاق را برای این هتل در
                                              اطلاعات پایه تعریف کنید.
                                            </small>
                                          )}
                                          {session.user.permissions.includes(
                                            'master_data.create',
                                          ) &&
                                          session.user.permissions.includes(
                                            'master_data.update',
                                          ) ? (
                                            <fieldset
                                              className={styles.newRoomRow}
                                            >
                                              <legend>
                                                افزودن نوع اتاق به همین هتل
                                              </legend>
                                              <input
                                                aria-label={`نام نوع اتاق جدید ${row.hotel.name}`}
                                                placeholder="نام نوع اتاق"
                                                value={
                                                  newRoomDrafts[row.hotel.id]
                                                    ?.name ?? ''
                                                }
                                                onChange={(event) =>
                                                  changeNewRoomDraft(
                                                    row.hotel.id,
                                                    {
                                                      name: event.target.value,
                                                    },
                                                  )
                                                }
                                              />
                                              <input
                                                aria-label={`ظرفیت بزرگسال اتاق جدید ${row.hotel.name}`}
                                                type="number"
                                                min="1"
                                                max="20"
                                                value={
                                                  newRoomDrafts[row.hotel.id]
                                                    ?.maxAdults ?? '2'
                                                }
                                                onChange={(event) =>
                                                  changeNewRoomDraft(
                                                    row.hotel.id,
                                                    {
                                                      maxAdults:
                                                        event.target.value,
                                                    },
                                                  )
                                                }
                                              />
                                              <input
                                                aria-label={`ظرفیت کودک ۲ تا ۶ سال اتاق جدید ${row.hotel.name}`}
                                                type="number"
                                                min="0"
                                                max="20"
                                                value={
                                                  newRoomDrafts[row.hotel.id]
                                                    ?.maxChildren2To6 ?? '0'
                                                }
                                                onChange={(event) =>
                                                  changeNewRoomDraft(
                                                    row.hotel.id,
                                                    {
                                                      maxChildren2To6:
                                                        event.target.value,
                                                    },
                                                  )
                                                }
                                              />
                                              <input
                                                aria-label={`ظرفیت کودک ۶ تا ۱۲ سال اتاق جدید ${row.hotel.name}`}
                                                type="number"
                                                min="0"
                                                max="20"
                                                value={
                                                  newRoomDrafts[row.hotel.id]
                                                    ?.maxChildren6To12 ?? '0'
                                                }
                                                onChange={(event) =>
                                                  changeNewRoomDraft(
                                                    row.hotel.id,
                                                    {
                                                      maxChildren6To12:
                                                        event.target.value,
                                                    },
                                                  )
                                                }
                                              />
                                              <input
                                                aria-label={`ظرفیت نوزاد اتاق جدید ${row.hotel.name}`}
                                                type="number"
                                                min="0"
                                                max="20"
                                                value={
                                                  newRoomDrafts[row.hotel.id]
                                                    ?.maxInfants ?? '0'
                                                }
                                                onChange={(event) =>
                                                  changeNewRoomDraft(
                                                    row.hotel.id,
                                                    {
                                                      maxInfants:
                                                        event.target.value,
                                                    },
                                                  )
                                                }
                                              />
                                              <input
                                                aria-label={`ضریب اتاق جدید ${row.hotel.name}`}
                                                type="number"
                                                min="0.001"
                                                max="999.999"
                                                step="0.001"
                                                value={
                                                  newRoomDrafts[row.hotel.id]
                                                    ?.factor ?? '1'
                                                }
                                                onChange={(event) =>
                                                  changeNewRoomDraft(
                                                    row.hotel.id,
                                                    {
                                                      factor:
                                                        event.target.value,
                                                    },
                                                  )
                                                }
                                              />
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  void addRoomTypeToHotel(row)
                                                }
                                              >
                                                + ساخت و اتصال
                                              </button>
                                            </fieldset>
                                          ) : (
                                            <Link href="/master-data/accommodation">
                                              مدیریت نوع اتاق در اطلاعات پایه
                                            </Link>
                                          )}
                                          <small>
                                            ظرفیت هر نوع اتاق در قرارداد کنترل
                                            می‌شود.
                                          </small>
                                        </div>
                                      ) : (
                                        '—'
                                      )}
                                      <div>
                                        {row.selected ? (
                                          <>
                                            <OccupancyFactorFields
                                              hotelName={row.hotel.name}
                                              base={row.base}
                                              currency={row.currency}
                                              factors={row.factors}
                                              visibleKinds={activeFactorKinds}
                                              onChange={(factors) =>
                                                changeRow(row.hotel.id, {
                                                  factors,
                                                })
                                              }
                                            />
                                            <small>
                                              ضریب خالی یعنی این چیدمان برای هتل
                                              وجود ندارد.
                                            </small>
                                          </>
                                        ) : (
                                          '—'
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
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
