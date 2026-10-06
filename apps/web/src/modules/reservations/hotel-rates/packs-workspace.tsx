'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { LoginResponse } from '@nora/contracts';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { DatePicker } from '@/components/ui/date-picker';
import { SearchCombobox } from '@/components/ui/search-combobox';
import {
  loadPackDestinations,
  type DestinationChoice,
} from './pack-destinations';
import { masterDataApi } from '@/modules/master-data/api/client';
import { Choice, Lookup, rateRequest, type Option } from './controls';
import { RateHistory } from './history';
import { ExistingPacksBrowser } from './existing-packs-browser';
import { kinds, labels, price, type FactorKind, type Factors } from './model';
import styles from './rates.module.css';
import {
  hotelMaximumCombinations,
  type HotelOccupancyRateV1,
} from '@nora/contracts';
import {
  OccupancyImportPanel,
  OccupancyRateEditor,
} from './occupancy-import-panel';

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
export type PackSummary = {
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

export function HotelRoomRatesTable({
  row,
  activeFactorKinds,
  canManageRooms,
  newRoom,
  onChangeRoom,
  onChangeFactors,
  onChangeNewRoom,
  onAddRoom,
}: {
  row: GridRow;
  activeFactorKinds: readonly FactorKind[];
  canManageRooms: boolean;
  newRoom: NewRoomDraft | undefined;
  onChangeRoom: (roomTypeId: string, patch: Partial<RoomRateDraft>) => void;
  onChangeFactors: (factors: Factors) => void;
  onChangeNewRoom: (patch: Partial<NewRoomDraft>) => void;
  onAddRoom: () => void;
}) {
  const roomTypes = row.hotel.roomTypes ?? [];
  const draft = {
    name: '',
    maxAdults: '2',
    maxChildren2To6: '0',
    maxChildren6To12: '0',
    maxInfants: '0',
    factor: '1',
    ...newRoom,
  };

  return (
    <div className={styles.roomRatesPanel}>
      <div className={styles.roomTableIntro}>
        <div>
          <strong>جدول اتاق، ظرفیت و ضریب‌های {row.hotel.name}</strong>
          <p>
            نرخ واردشده کل اتاق / هر شب است و فقط ترکیب‌های صریح خودش معتبرند.
            قیمت پایه دستی هر نفر / هر شب است. ظرفیت‌ها در قرارداد کنترل می‌شوند
            و نوع اتاق بدون ضریب قیمت نیز همچنان در جدول نمایش داده می‌شود.
          </p>
        </div>
        <span className={styles.chip}>{row.currency}</span>
      </div>
      <div className={styles.roomTableScroll}>
        <table className={styles.roomRatesTable}>
          <thead>
            <tr>
              <th>هتل</th>
              <th>نوع اتاق</th>
              <th>بزرگسال</th>
              <th>کودک ۲–۶</th>
              <th>کودک ۶–۱۲</th>
              <th>نوزاد</th>
              <th>ظرفیت کل</th>
              <th>ضریب اتاق</th>
              <th>قیمت اتاق / شب</th>
            </tr>
          </thead>
          <tbody>
            {roomTypes.map((roomType) => {
              const value = row.roomRates.find(
                (room) => room.roomTypeId === roomType.id,
              ) ?? {
                roomTypeId: roomType.id,
                roomTypeName: roomType.name,
                factor: '1',
                maxAdults: '2',
                maxChildren2To6: '0',
                maxChildren6To12: '0',
                maxInfants: '0',
              };
              const capacity = [
                value.maxAdults,
                value.maxChildren2To6,
                value.maxChildren6To12,
                value.maxInfants,
              ].reduce((total, item) => total + (Number(item) || 0), 0);

              return (
                <tr key={roomType.id}>
                  <td>
                    <strong>{row.hotel.name}</strong>
                    <small dir="ltr">{row.currency}</small>
                  </td>
                  <td>
                    <strong>{roomType.name}</strong>
                  </td>
                  {value.occupancyRates ? (
                    <td colSpan={7}>
                      <p dir="ltr">
                        {hotelMaximumCombinations(value.occupancyRates)}
                      </p>
                      <p>
                        {value.occupancyRates.length.toLocaleString('fa-IR')}{' '}
                        نرخ مستقلِ ترکیب / تاریخ؛ جست‌وجو و ویرایش در جدول
                        نرخ‌های ترکیبی بالای صفحه.
                      </p>
                      <p>
                        ضرایب و ظرفیت‌های جمعی قدیمی به این اتاق اعمال نمی‌شوند.
                      </p>
                    </td>
                  ) : (
                    <>
                      <td>
                        <input
                          aria-label={`ظرفیت بزرگسال ${roomType.name}`}
                          type="number"
                          required
                          min="1"
                          max="20"
                          value={value.maxAdults}
                          onChange={(event) =>
                            onChangeRoom(roomType.id, {
                              maxAdults: event.target.value,
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`ظرفیت کودک ۲ تا ۶ سال ${roomType.name}`}
                          type="number"
                          required
                          min="0"
                          max="20"
                          value={value.maxChildren2To6}
                          onChange={(event) =>
                            onChangeRoom(roomType.id, {
                              maxChildren2To6: event.target.value,
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`ظرفیت کودک ۶ تا ۱۲ سال ${roomType.name}`}
                          type="number"
                          required
                          min="0"
                          max="20"
                          value={value.maxChildren6To12}
                          onChange={(event) =>
                            onChangeRoom(roomType.id, {
                              maxChildren6To12: event.target.value,
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`ظرفیت نوزاد ${roomType.name}`}
                          type="number"
                          required
                          min="0"
                          max="20"
                          value={value.maxInfants}
                          onChange={(event) =>
                            onChangeRoom(roomType.id, {
                              maxInfants: event.target.value,
                            })
                          }
                        />
                      </td>
                      <td>
                        <output dir="ltr">
                          {value.maxAdults || '0'} +{' '}
                          {value.maxChildren2To6 || '0'} +{' '}
                          {value.maxChildren6To12 || '0'} +{' '}
                          {value.maxInfants || '0'} = {capacity}
                        </output>
                      </td>
                      <td>
                        <input
                          aria-label={`ضریب نوع اتاق ${roomType.name}`}
                          type="number"
                          min="0.001"
                          max="999.999"
                          step="0.001"
                          value={value.factor}
                          onChange={(event) =>
                            onChangeRoom(roomType.id, {
                              factor: event.target.value,
                            })
                          }
                        />
                      </td>
                      <td>
                        <output dir="ltr">
                          {price(row.base, value.factor, row.currency)}
                        </output>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
            {!roomTypes.length && (
              <tr>
                <td colSpan={9} role="alert">
                  ابتدا نوع اتاق را برای این هتل در اطلاعات پایه تعریف کنید.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className={styles.hotelFactorRow}>
              <th colSpan={3}>ضریب‌های چیدمان پکیجِ هتل</th>
              <td colSpan={6}>
                <div
                  className={styles.factorColumns}
                  style={
                    {
                      '--factor-columns': activeFactorKinds.length,
                    } as React.CSSProperties
                  }
                >
                  {activeFactorKinds.map((kind) => (
                    <label key={kind}>
                      <span>{factorLabel(kind)}</span>
                      <input
                        aria-label={`ضریب ${factorLabel(kind)} ${row.hotel.name}`}
                        type="number"
                        min="0.001"
                        max="999.999"
                        step="0.001"
                        value={row.factors[kind]}
                        placeholder="ندارد"
                        onChange={(event) =>
                          onChangeFactors({
                            ...row.factors,
                            [kind]: event.target.value,
                          })
                        }
                      />
                      <output dir="ltr">
                        {price(row.base, row.factors[kind], row.currency)}
                      </output>
                    </label>
                  ))}
                </div>
                <small>ضریب خالی یعنی این چیدمان برای هتل وجود ندارد.</small>
              </td>
            </tr>
            {canManageRooms ? (
              <tr className={styles.newRoomTableRow}>
                <th colSpan={2}>افزودن نوع اتاق به همین هتل</th>
                <td>
                  <input
                    aria-label={`نام نوع اتاق جدید ${row.hotel.name}`}
                    placeholder="نام اتاق"
                    value={draft.name}
                    onChange={(event) =>
                      onChangeNewRoom({ name: event.target.value })
                    }
                  />
                </td>
                <td>
                  <input
                    aria-label={`ظرفیت بزرگسال اتاق جدید ${row.hotel.name}`}
                    type="number"
                    min="1"
                    max="20"
                    value={draft.maxAdults}
                    onChange={(event) =>
                      onChangeNewRoom({ maxAdults: event.target.value })
                    }
                  />
                </td>
                <td>
                  <input
                    aria-label={`ظرفیت کودک ۲ تا ۶ سال اتاق جدید ${row.hotel.name}`}
                    type="number"
                    min="0"
                    max="20"
                    value={draft.maxChildren2To6}
                    onChange={(event) =>
                      onChangeNewRoom({ maxChildren2To6: event.target.value })
                    }
                  />
                </td>
                <td>
                  <input
                    aria-label={`ظرفیت کودک ۶ تا ۱۲ سال اتاق جدید ${row.hotel.name}`}
                    type="number"
                    min="0"
                    max="20"
                    value={draft.maxChildren6To12}
                    onChange={(event) =>
                      onChangeNewRoom({ maxChildren6To12: event.target.value })
                    }
                  />
                </td>
                <td>
                  <input
                    aria-label={`ظرفیت نوزاد اتاق جدید ${row.hotel.name}`}
                    type="number"
                    min="0"
                    max="20"
                    value={draft.maxInfants}
                    onChange={(event) =>
                      onChangeNewRoom({ maxInfants: event.target.value })
                    }
                  />
                </td>
                <td>
                  <input
                    aria-label={`ضریب اتاق جدید ${row.hotel.name}`}
                    type="number"
                    min="0.001"
                    max="999.999"
                    step="0.001"
                    value={draft.factor}
                    onChange={(event) =>
                      onChangeNewRoom({ factor: event.target.value })
                    }
                  />
                </td>
                <td>
                  <button type="button" onClick={onAddRoom}>
                    + ساخت و اتصال
                  </button>
                </td>
              </tr>
            ) : (
              <tr>
                <td colSpan={9}>
                  <Link href="/master-data/accommodation">
                    مدیریت نوع اتاق در اطلاعات پایه
                  </Link>
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>
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
  const [cities, setCities] = useState<DestinationChoice[]>([]);
  const [countries, setCountries] = useState<DestinationChoice[]>([]);
  const [countryId, setCountryId] = useState('');
  const [destinationChange, setDestinationChange] = useState<{
    kind: 'country' | 'city';
    id: string;
  } | null>(null);
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
  const destinationRef = useRef<HTMLElement>(null);
  const [packs, setPacks] = useState<PackSummary[]>([]);
  const [packTotal, setPackTotal] = useState(0);
  const [packPage, setPackPage] = useState(1);
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
    loadPackDestinations('countries', rateRequest)
      .then((result) => {
        if (active) setCountries(result);
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : 'کشورها بارگذاری نشدند.');
      });
    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    if (!session || !countryId) return;
    let active = true;
    const timer = setTimeout(() => {
      loadPackDestinations('cities', rateRequest, countryId, citySearch)
        .then((result) => {
          if (active)
            setCities((old) => {
              const selected = old.find((city) => city.id === cityId);
              return selected && !result.some((city) => city.id === selected.id)
                ? [selected, ...result]
                : result;
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
  }, [session, citySearch, cityId, countryId]);

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
    setCountryId('');
    setDestinationChange(null);
    setCities([]);
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
    if (browserLocked) {
      setError('ابتدا تغییرات قیمت بستهٔ موجود را ذخیره یا کنار بگذارید.');
      return;
    }
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
    if (!cities.some((city) => city.id === id && city.countryId === countryId))
      return;
    setCityId(id);
    setRows([]);
    setHotelSearch('');
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
      const destination = await rateRequest<{ data: DestinationChoice[] }>(
        `/pack-options?kind=cities&cityId=${encodeURIComponent(item.cityId)}`,
      );
      const city = destination.data.find((option) => option.id === item.cityId);
      if (!city?.countryId)
        throw new Error('کشور شهر این بسته در اطلاعات پایه مشخص نیست.');
      setCountryId(city.countryId);
      setEditing({ id: item.id, version: item.version });
      setEditorMode('edit');
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
      <section
        ref={destinationRef}
        className="space-y-3 rounded-xl border p-4"
        aria-label="مقصد ورودی اکسل"
      >
        <h2>کشور و شهر بستهٔ اکسل</h2>
        <p>
          ابتدا بستهٔ جدید، سپس کشور و شهر را انتخاب کنید؛ فایل فقط برای شهر
          انتخاب‌شده نگاشت می‌شود.
        </p>
        <SearchCombobox
          label="کشور بستهٔ هتل"
          value={countryId}
          disabled={
            !canWrite ||
            busy ||
            opening ||
            editorMode === 'list' ||
            editorMode === 'edit'
          }
          options={countries.map((country) => ({
            value: country.id,
            label: country.name,
          }))}
          onValueChange={(id) => {
            changeDestination('country', id);
          }}
        />
        <SearchCombobox
          label="شهر بستهٔ هتل"
          value={cityId}
          disabled={
            !canWrite ||
            busy ||
            opening ||
            !countryId ||
            editorMode === 'list' ||
            editorMode === 'edit'
          }
          options={cities.map((city) => ({ value: city.id, label: city.name }))}
          onSearchChange={setCitySearch}
          onValueChange={(id) => changeDestination('city', id)}
        />
        {destinationChange && (
          <div role="alert" className="space-y-2 rounded border p-3">
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
            </button>{' '}
            <button type="button" onClick={() => setDestinationChange(null)}>
              انصراف
            </button>
          </div>
        )}
      </section>
      <OccupancyImportPanel
        key={`${branch}:${cityId}:${editorMode}`}
        hotels={rows.map((row) => row.hotel)}
        checkIn={checkIn}
        checkOut={checkOut}
        currency={currency}
        disabled={
          !canWrite || busy || editorMode === 'list' || !cityId || hotelLoading
        }
        onApply={(hotelId, imported) => {
          setRows((current) =>
            current.map((row) =>
              row.hotel.id !== hotelId
                ? row
                : {
                    ...row,
                    selected: true,
                    base: row.base || '1',
                    factors: {
                      ...row.factors,
                      double: row.factors.double || '1',
                    },
                    roomRates: row.roomRates.map((room) => {
                      const selected = imported.find(
                        (item) => item.roomTypeId === room.roomTypeId,
                      );
                      if (!selected) return room;
                      return {
                        ...room,
                        factor: '1',
                        maxAdults: String(
                          Math.max(
                            ...selected.rates.map((rate) => rate.adults),
                          ),
                        ),
                        maxChildren2To6: String(
                          Math.max(
                            ...selected.rates.map(
                              (rate) => rate.childAges.length,
                            ),
                          ),
                        ),
                        maxChildren6To12: '0',
                        maxInfants: '0',
                        occupancyRates: selected.rates,
                      };
                    }),
                  },
            ),
          );
          pending.current = null;
          setMessage(
            'نرخ ترکیبی به پیش‌نویس منتقل شد؛ قیمت واقعی از ترکیب خوانده می‌شود و ضرایب قدیمی به آن اعمال نمی‌شوند.',
          );
        }}
      />
      {selected.flatMap((row) =>
        row.roomRates
          .filter((room) => room.occupancyRates)
          .map((room) => (
            <div key={`${row.hotel.id}:${room.roomTypeId}`}>
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
            </div>
          )),
      )}
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
            onDraftFocus={() =>
              destinationRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              })
            }
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
                          {cities.find((city) => city.id === cityId)?.name ||
                            'کشور و شهر را بالای ورودی اکسل انتخاب کنید.'}
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
                                      <HotelRoomRatesTable
                                        row={row}
                                        activeFactorKinds={activeFactorKinds}
                                        canManageRooms={
                                          session.user.permissions.includes(
                                            'master_data.create',
                                          ) &&
                                          session.user.permissions.includes(
                                            'master_data.update',
                                          )
                                        }
                                        newRoom={newRoomDrafts[row.hotel.id]}
                                        onChangeRoom={(roomTypeId, patch) => {
                                          const current = row.roomRates.find(
                                            (room) =>
                                              room.roomTypeId === roomTypeId,
                                          ) ?? {
                                            roomTypeId,
                                            roomTypeName:
                                              (row.hotel.roomTypes ?? []).find(
                                                (room) =>
                                                  room.id === roomTypeId,
                                              )?.name ?? 'اتاق',
                                            factor: '1',
                                            maxAdults: '2',
                                            maxChildren2To6: '0',
                                            maxChildren6To12: '0',
                                            maxInfants: '0',
                                          };
                                          changeRow(row.hotel.id, {
                                            roomRates: [
                                              ...row.roomRates.filter(
                                                (room) =>
                                                  room.roomTypeId !==
                                                  roomTypeId,
                                              ),
                                              { ...current, ...patch },
                                            ],
                                          });
                                        }}
                                        onChangeFactors={(factors) =>
                                          changeRow(row.hotel.id, { factors })
                                        }
                                        onChangeNewRoom={(patch) =>
                                          changeNewRoomDraft(
                                            row.hotel.id,
                                            patch,
                                          )
                                        }
                                        onAddRoom={() =>
                                          void addRoomTypeToHotel(row)
                                        }
                                      />
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
                      : 'ثبت بستهٔ نرخ'}
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
      <ExistingPacksBrowser
        key={branch}
        branchId={branch}
        revision={revision}
        canWrite={canWrite}
        onLockChange={setBrowserLocked}
        onSaved={() => setRevision((value) => value + 1)}
      />
    </main>
  );
}
