'use client';
import { useEffect, useEffectEvent, useState, type FormEvent } from 'react';
import { calculateManualHotelPrices } from '@nora/contracts';
import type {
  HotelOccupancyRateV1,
  HotelSaleAdjustmentV1,
} from '@nora/contracts';
import { Choice, Lookup, type Option } from './controls';
import {
  buildManualRates,
  combinationKey,
  combinationsFromRates,
  type Combination,
} from './manual-coefficients';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/overlays';
import { Input } from '@/components/ui/form-controls';
import styles from './manual-tables.module.css';

export type ManualRoom = {
  roomTypeId: string;
  roomTypeName: string;
  occupancyRates?: HotelOccupancyRateV1[];
  factor: string;
  maxAdults: string;
  maxChildren2To6: string;
  maxChildren6To12: string;
  maxInfants: string;
};
export type ManualHotelRow = {
  hotel: Option & { englishName?: string; roomTypes?: Option[] };
  selected: boolean;
  broker: Option | null;
  base: string;
  currency: string;
  roomRates: ManualRoom[];
  inCityList: boolean;
};

export function ManualHotelPanel({
  rows,
  hotelId,
  onChoose,
  onChange,
  checkIn,
  checkOut,
  onValidityChange,
  hideSelector = false,
  canAddRoomType = false,
  disabled = false,
  onAddRoomType,
}: {
  rows: readonly ManualHotelRow[];
  hotelId: string;
  onChoose: (id: string) => void;
  onChange: (id: string, patch: Partial<ManualHotelRow>) => void;
  checkIn: string;
  checkOut: string;
  onValidityChange: (id: string, valid: boolean) => void;
  hideSelector?: boolean;
  canAddRoomType?: boolean;
  disabled?: boolean;
  onAddRoomType?: (hotelId: string, name: string) => Promise<Option>;
}) {
  return (
    <div className={styles.panels} aria-label="پنل دستی هتل">
      {!hideSelector && (
        <ManualHotelSelector
          rows={rows}
          hotelId={hotelId}
          onChoose={onChoose}
          onRemove={(id) => onChange(id, { selected: false })}
        />
      )}
      {rows
        .filter((r) => r.selected)
        .map((selected) => (
          <div key={selected.hotel.id}>
            <HotelCoefficients
              key={selected.hotel.id}
              row={selected}
              onChange={(patch) => onChange(selected.hotel.id, patch)}
              checkIn={checkIn}
              checkOut={checkOut}
              onValidityChange={(valid) =>
                onValidityChange(selected.hotel.id, valid)
              }
              canAddRoomType={canAddRoomType}
              disabled={disabled}
              {...(onAddRoomType ? { onAddRoomType } : {})}
            />
          </div>
        ))}
    </div>
  );
}
export function ManualHotelSelector({
  rows,
  onChoose,
  onRemove,
  disabled = false,
}: {
  rows: readonly ManualHotelRow[];
  hotelId: string;
  onChoose: (id: string) => void;
  onRemove?: (id: string) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState('');
  const selected = rows.filter((row) => row.selected);
  const matches = rows.filter(
    (row) =>
      row.inCityList &&
      `${row.hotel.name} ${row.hotel.englishName ?? ''}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <div className={styles.hotelSelector}>
      <label className={styles.field}>
        هتل
        <input
          disabled={disabled}
          aria-label="جست‌وجوی هتل‌های شهر"
          placeholder="جست‌وجوی هتل در شهر انتخاب‌شده"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <div className={styles.hotelChoices} aria-label="انتخاب هتل‌های بسته">
        {matches.map((row) => (
          <label key={row.hotel.id}>
            <input
              type="checkbox"
              checked={row.selected}
              disabled={disabled}
              onChange={(event) =>
                event.target.checked
                  ? onChoose(row.hotel.id)
                  : onRemove?.(row.hotel.id)
              }
            />
            <span>{row.hotel.name}</span>
          </label>
        ))}
        {!matches.length && <p>هتلی با این جست‌وجو پیدا نشد.</p>}
      </div>
      {selected.length > 0 && (
        <table
          className={styles.selectedHotels}
          aria-label="هتل‌های انتخاب‌شده"
        >
          <thead>
            <tr>
              <th>هتل</th>
              <th>نوع اتاق پیش‌فرض</th>
              <th>عملیات</th>
            </tr>
          </thead>
          <tbody>
            {selected.map((row) => (
              <tr key={row.hotel.id}>
                <td>{row.hotel.name}</td>
                <td>{row.hotel.roomTypes?.[0]?.name ?? 'نوع اتاق ثبت نشده'}</td>
                <td>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onRemove?.(row.hotel.id)}
                  >
                    حذف هتل {row.hotel.name}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function HotelCoefficients({
  row,
  onChange,
  checkIn,
  checkOut,
  onValidityChange,
  canAddRoomType = false,
  disabled = false,
  onAddRoomType,
}: {
  row: ManualHotelRow;
  onChange: (patch: Partial<ManualHotelRow>) => void;
  checkIn: string;
  checkOut: string;
  onValidityChange: (valid: boolean) => void;
  canAddRoomType?: boolean;
  disabled?: boolean;
  onAddRoomType?: (hotelId: string, name: string) => Promise<Option>;
}) {
  const allRooms: ManualRoom[] = (row.hotel.roomTypes ?? []).map(
    (room) =>
      row.roomRates.find((r) => r.roomTypeId === room.id) ?? {
        roomTypeId: room.id,
        roomTypeName: room.name,
        factor: '1',
        maxAdults: '2',
        maxChildren2To6: '0',
        maxChildren6To12: '0',
        maxInfants: '0',
      },
  );
  const [roomCombinations, setRoomCombinations] = useState<
    Record<string, Combination[]>
  >(() =>
    Object.fromEntries(
      allRooms.map((room) => [
        room.roomTypeId,
        combinationsFromRates(room.occupancyRates ?? []),
      ]),
    ),
  );
  const combinationsFor = (roomId: string, values = roomCombinations) =>
    values[roomId] ?? combinationsFromRates([]);
  const [bases, setBases] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      row.roomRates.map((r) => [
        r.roomTypeId,
        r.occupancyRates?.[0]?.manualPricing?.baseAmount ?? '',
      ]),
    ),
  );
  const [selectedRooms, setSelectedRooms] = useState<string[]>(() =>
    row.roomRates.some((room) => room.occupancyRates?.length)
      ? row.roomRates
          .filter((room) => room.occupancyRates?.length)
          .map((room) => room.roomTypeId)
      : allRooms.slice(0, 1).map((room) => room.roomTypeId),
  );
  const [adjustments] = useState<
    Record<string, Record<string, HotelSaleAdjustmentV1>>
  >(() =>
    Object.fromEntries(
      row.roomRates.map((r) => [
        r.roomTypeId,
        Object.fromEntries(
          (r.occupancyRates ?? [])
            .filter((rate) => rate.manualPricing)
            .map((rate) => [
              combinationKey(rate),
              rate.manualPricing!.adjustment,
            ]),
        ),
      ]),
    ),
  );
  const [roomTypeDialogOpen, setRoomTypeDialogOpen] = useState(false);
  const [roomTypeName, setRoomTypeName] = useState('');
  const [addingRoomType, setAddingRoomType] = useState(false);
  const [roomTypeError, setRoomTypeError] = useState('');
  const imported = row.roomRates.some((r) =>
    r.occupancyRates?.some((p) => !p.manualPricing),
  );
  function update(
    nextCombinations = roomCombinations,
    nextBases = bases,
    nextAdjustments = adjustments,
    roomIds = selectedRooms,
  ) {
    const rooms: ManualRoom[] = [];
    let valid = true;
    for (const room of allRooms) {
      if (!roomIds.includes(room.roomTypeId)) continue;
      if (!nextBases[room.roomTypeId]) {
        valid = false;
        continue;
      }
      const rates = buildManualRates(
        combinationsFor(room.roomTypeId, nextCombinations),
        nextBases[room.roomTypeId]!,
        row.currency,
        checkIn,
        checkOut,
        nextAdjustments[room.roomTypeId],
      );
      if (!rates) {
        valid = false;
        continue;
      }
      rooms.push({
        ...room,
        factor: '1',
        maxAdults: String(Math.max(...rates.map((r) => r.adults))),
        maxChildren2To6: String(
          Math.max(...rates.map((r) => r.childAges.length)),
        ),
        maxChildren6To12: '0',
        maxInfants: '0',
        occupancyRates: rates,
      });
    }
    onValidityChange(valid && rooms.length > 0);
    // Incomplete form remains invalid, never silently persists older prices.
    onChange({ selected: true, base: '1', roomRates: rooms });
  }
  const synchronize = useEffectEvent(() => {
    if (!imported) update();
  });
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) synchronize();
    });
    return () => {
      active = false;
    };
  }, [checkIn, checkOut, row.currency]);
  function changeCombination(
    roomId: string,
    index: number,
    patch: Partial<Combination>,
  ) {
    const next = combinationsFor(roomId).map((c, i) =>
      i === index
        ? {
            ...c,
            ...patch,
            ...(patch.adults !== undefined || patch.childAges !== undefined
              ? { label: '' }
              : {}),
          }
        : c,
    );
    const values = { ...roomCombinations, [roomId]: next };
    setRoomCombinations(values);
    update(values);
  }
  const countOptions = (max: number, min = 0) =>
    Array.from({ length: max - min + 1 }, (_, i) => ({
      id: String(i + min),
      name: String(i + min),
    }));
  const combinationName = (combination: Combination) =>
    combination.label ||
    `${combination.adults} AD + ${combination.childAges.length} CHD`;
  async function submitRoomType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onAddRoomType || addingRoomType || disabled) return;
    setRoomTypeError('');
    setAddingRoomType(true);
    try {
      const added = await onAddRoomType(row.hotel.id, roomTypeName);
      if (!allRooms.length) setSelectedRooms([added.id]);
      setRoomTypeName('');
      setRoomTypeDialogOpen(false);
    } catch (cause) {
      setRoomTypeError(
        cause instanceof Error ? cause.message : 'افزودن نوع اتاق انجام نشد.',
      );
    } finally {
      setAddingRoomType(false);
    }
  }
  if (imported)
    return (
      <div role="status">
        این هتل نرخ اکسل دارد؛ برای حفظ نرخ‌های واردشده از ویرایش بستهٔ موجود
        استفاده کنید.
      </div>
    );
  return (
    <article className={styles.panel}>
      <div className={styles.hotelHeader}>
        <h2>{row.hotel.name}</h2>
        <div className={styles.hotelActions}>
          {canAddRoomType && onAddRoomType ? (
            <button
              className={styles.addRoomType}
              type="button"
              disabled={disabled}
              onClick={() => {
                setRoomTypeError('');
                setRoomTypeDialogOpen(true);
              }}
            >
              افزودن نوع اتاق
            </button>
          ) : null}
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              onValidityChange(true);
              onChange({ selected: false });
            }}
          >
            کنارگذاشتن هتل از این بسته
          </button>
        </div>
      </div>
      <div className={styles.hotelSettings}>
        <Lookup
          kind="brokers"
          label="کارگزار هتل"
          value={row.broker}
          onChange={(broker) => onChange({ broker })}
        />
        <Choice
          label="ارز نرخ هتل"
          value={row.currency}
          onChange={(currency) => {
            onValidityChange(false);
            onChange({ currency });
          }}
          options={[
            { id: 'EUR', name: 'EUR' },
            { id: 'USD', name: 'USD' },
            { id: 'IRR', name: 'IRR' },
          ]}
        />
      </div>
      <div className={styles.roomPairs}>
        <div
          className={styles.hotelChoices}
          aria-label={`نوع اتاق‌های ${row.hotel.name}`}
        >
          {allRooms.map((room) => (
            <label key={room.roomTypeId}>
              <input
                type="checkbox"
                aria-label={`انتخاب نوع اتاق ${room.roomTypeName}`}
                checked={selectedRooms.includes(room.roomTypeId)}
                disabled={disabled}
                onChange={(event) => {
                  const next = event.target.checked
                    ? [...selectedRooms, room.roomTypeId]
                    : selectedRooms.filter((id) => id !== room.roomTypeId);
                  setSelectedRooms(next);
                  update(roomCombinations, bases, adjustments, next);
                }}
              />
              {room.roomTypeName}
            </label>
          ))}
        </div>
        {allRooms
          .filter((room) => selectedRooms.includes(room.roomTypeId))
          .map((room) => {
            const combinations = combinationsFor(room.roomTypeId);
            const rates = buildManualRates(
              combinations,
              bases[room.roomTypeId] ?? '',
              row.currency,
              checkIn,
              checkOut,
              adjustments[room.roomTypeId],
            );
            return (
              <div
                key={room.roomTypeId}
                className={styles.roomPair}
                data-room-type={room.roomTypeId}
              >
                <section className={styles.roomCard}>
                  <div className={styles.roomHeader}>
                    <h3>{room.roomTypeName}</h3>
                    <label className={styles.baseField}>
                      قیمت پایهٔ اتاق / هر شب
                      <input
                        aria-label={`قیمت پایه ${room.roomTypeName}`}
                        inputMode="decimal"
                        value={bases[room.roomTypeId] ?? ''}
                        onChange={(e) => {
                          const next = {
                            ...bases,
                            [room.roomTypeId]: e.target.value,
                          };
                          setBases(next);
                          update(roomCombinations, next);
                        }}
                      />
                    </label>
                  </div>
                  <div className={styles.tableScroll}>
                    <table
                      className={styles.priceTable}
                      aria-label={`قیمت ترکیب‌های ${room.roomTypeName}`}
                    >
                      <thead>
                        <tr>
                          <th>ترکیب</th>
                          <th>قیمت خرید</th>
                        </tr>
                      </thead>
                      <tbody>
                        {combinations.map((combination) => {
                          const key = `${room.roomTypeId}:${combination.id}`;
                          const calculated = calculateManualHotelPrices(
                            bases[room.roomTypeId] ?? '',
                            combination.coefficient,
                            row.currency,
                            adjustments[room.roomTypeId]?.[
                              combinationKey(combination)
                            ] ?? { kind: 'AMOUNT', value: '0' },
                          );
                          return (
                            <tr key={key}>
                              <td>
                                <bdi
                                  dir={
                                    /[A-Za-z]/.test(
                                      combinationName(combination),
                                    )
                                      ? 'ltr'
                                      : 'rtl'
                                  }
                                  className={
                                    /[A-Za-z]/.test(
                                      combinationName(combination),
                                    )
                                      ? styles.ltrComposition
                                      : undefined
                                  }
                                >
                                  {combinationName(combination)}
                                </bdi>
                                {combination.childAges.map((a, i) => (
                                  <small key={i}>
                                    {' '}
                                    / {a.min} تا کمتر از {a.maxExclusive}
                                  </small>
                                ))}
                              </td>
                              <td dir="ltr">
                                {calculated?.purchase ?? '—'}{' '}
                                <small>{row.currency}</small>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {bases[room.roomTypeId] && checkIn && checkOut && !rates && (
                    <p role="alert">
                      قیمت پایه، ضریب، ردهٔ سنی یا بازهٔ اقامت این اتاق معتبر
                      نیست؛ ثبت بسته تا اصلاح آن انجام نمی‌شود.
                    </p>
                  )}
                </section>
                <section className={styles.roomCoefficients}>
                  <h4>
                    <span>جدول ضرایب هتل</span>
                    {' · '}
                    {room.roomTypeName}
                  </h4>
                  <div className={styles.tableScroll}>
                    <table
                      className={styles.roomCoefficientTable}
                      aria-label={`جدول ضرایب هتل ${room.roomTypeName}`}
                    >
                      <thead>
                        <tr>
                          <th>ترکیب اتاق</th>
                          <th>ضریب</th>
                          <th>عملیات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {combinations.map((combination, index) => (
                          <tr key={combination.id}>
                            <td>
                              <bdi
                                dir={
                                  /[A-Za-z]/.test(combinationName(combination))
                                    ? 'ltr'
                                    : 'rtl'
                                }
                                className={
                                  /[A-Za-z]/.test(combinationName(combination))
                                    ? styles.ltrComposition
                                    : undefined
                                }
                              >
                                {combinationName(combination)}
                              </bdi>
                              <details className={styles.compositionDetails}>
                                <summary>ترکیب اتاق</summary>
                                <label>
                                  بزرگسال
                                  <Choice
                                    label="تعداد بزرگسال ترکیب"
                                    value={String(combination.adults)}
                                    onChange={(n) =>
                                      changeCombination(
                                        room.roomTypeId,
                                        index,
                                        {
                                          adults: Number(n),
                                        },
                                      )
                                    }
                                    options={countOptions(20, 1)}
                                  />
                                </label>
                                <label>
                                  کودک
                                  <Choice
                                    label="تعداد کودک ترکیب"
                                    value={String(combination.childAges.length)}
                                    onChange={(n) =>
                                      changeCombination(
                                        room.roomTypeId,
                                        index,
                                        {
                                          childAges: Array.from(
                                            { length: Number(n) },
                                            (_, i) =>
                                              combination.childAges[i] ?? {
                                                min: 2,
                                                maxExclusive: 15,
                                              },
                                          ),
                                        },
                                      )
                                    }
                                    options={countOptions(10)}
                                  />
                                </label>
                                <span>ردهٔ سنی هر کودک</span>
                                {combination.childAges.map((age, i) => (
                                  <div key={i} className={styles.childRange}>
                                    <span>کودک {i + 1}</span>
                                    <Choice
                                      label="حداقل سن کودک"
                                      value={String(age.min)}
                                      options={countOptions(14)}
                                      onChange={(n) =>
                                        changeCombination(
                                          room.roomTypeId,
                                          index,
                                          {
                                            childAges:
                                              combination.childAges.map(
                                                (a, j) =>
                                                  j === i
                                                    ? { ...a, min: Number(n) }
                                                    : a,
                                              ),
                                          },
                                        )
                                      }
                                    />
                                    <span>تا کمتر از</span>
                                    <Choice
                                      label="حد بالای سن کودک"
                                      value={String(age.maxExclusive)}
                                      options={countOptions(15, 1)}
                                      onChange={(n) =>
                                        changeCombination(
                                          room.roomTypeId,
                                          index,
                                          {
                                            childAges:
                                              combination.childAges.map(
                                                (a, j) =>
                                                  j === i
                                                    ? {
                                                        ...a,
                                                        maxExclusive: Number(n),
                                                      }
                                                    : a,
                                              ),
                                          },
                                        )
                                      }
                                    />
                                  </div>
                                ))}
                              </details>
                            </td>
                            <td>
                              <input
                                aria-label="ضریب ترکیب اتاق"
                                inputMode="decimal"
                                value={combination.coefficient}
                                onChange={(e) =>
                                  changeCombination(room.roomTypeId, index, {
                                    coefficient: e.target.value,
                                  })
                                }
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = combinations.filter(
                                    (_, i) => i !== index,
                                  );
                                  const values = {
                                    ...roomCombinations,
                                    [room.roomTypeId]: next,
                                  };
                                  setRoomCombinations(values);
                                  update(values);
                                }}
                              >
                                حذف ردیف
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={3}>
                            <button
                              type="button"
                              disabled={combinations.length >= 100}
                              onClick={() => {
                                const next = [
                                  ...combinations,
                                  {
                                    id: crypto.randomUUID(),
                                    label: '',
                                    adults: 2,
                                    childAges: [],
                                    coefficient: '',
                                  },
                                ];
                                const values = {
                                  ...roomCombinations,
                                  [room.roomTypeId]: next,
                                };
                                setRoomCombinations(values);
                                update(values);
                              }}
                            >
                              افزودن ردیف
                            </button>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </section>
              </div>
            );
          })}
      </div>
      {!allRooms.length && (
        <p role="alert">برای این هتل ابتدا نوع اتاق را اضافه کنید.</p>
      )}
      <Dialog
        open={roomTypeDialogOpen}
        onOpenChange={(open) => {
          if (!addingRoomType) setRoomTypeDialogOpen(open);
        }}
      >
        <DialogContent dir="rtl">
          <div className={styles.roomTypeDialogHeader}>
            <DialogTitle>افزودن نوع اتاق به هتل</DialogTitle>
            <DialogClose asChild>
              <button type="button" disabled={addingRoomType}>
                بستن
              </button>
            </DialogClose>
          </div>
          <DialogDescription>
            نوع اتاق جدید در اطلاعات پایه تعریف و به این هتل وصل می‌شود. بعد
            می‌توانید ظرفیت و نرخ آن را در همین بسته ثبت کنید.
          </DialogDescription>
          <form className={styles.roomTypeForm} onSubmit={submitRoomType}>
            <label htmlFor={`room-type-name-${row.hotel.id}`}>
              نام نوع اتاق
            </label>
            <Input
              id={`room-type-name-${row.hotel.id}`}
              autoFocus
              maxLength={160}
              required
              value={roomTypeName}
              disabled={addingRoomType}
              onChange={(event) => setRoomTypeName(event.target.value)}
            />
            {roomTypeError ? <p role="alert">{roomTypeError}</p> : null}
            <button
              className={styles.addRoomType}
              type="submit"
              disabled={addingRoomType || disabled || !roomTypeName.trim()}
            >
              {addingRoomType ? 'در حال افزودن…' : 'ثبت و اتصال به هتل'}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </article>
  );
}
