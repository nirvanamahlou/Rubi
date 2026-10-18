'use client';
import { useEffect, useEffectEvent, useState, type FormEvent } from 'react';
import { calculateManualHotelPrices } from '@nora/contracts';
import type {
  HotelOccupancyRateV1,
  HotelSaleAdjustmentV1,
} from '@nora/contracts';
import { SearchCombobox } from '@/components/ui/search-combobox';
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
        />
      )}
      {rows
        .filter((r) => r.selected)
        .map((selected) => (
          <div key={selected.hotel.id} hidden={selected.hotel.id !== hotelId}>
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
  hotelId,
  onChoose,
  disabled = false,
}: {
  rows: readonly ManualHotelRow[];
  hotelId: string;
  onChoose: (id: string) => void;
  disabled?: boolean;
}) {
  const row = rows.find((r) => r.hotel.id === hotelId);
  return (
    <div className={styles.hotelSelector}>
      <label className={styles.field}>
        هتل
        <SearchCombobox
          disabled={disabled}
          label="انتخاب هتل شهر"
          placeholder="جست‌وجوی هتل در شهر انتخاب‌شده"
          value={hotelId}
          selectedLabel={row?.hotel.name}
          options={rows
            .filter((r) => r.inCityList)
            .map((r) => ({
              value: r.hotel.id,
              label: r.hotel.name,
              searchText: r.hotel.englishName ?? '',
            }))}
          onValueChange={onChoose}
        />
      </label>
      {rows.filter((r) => r.selected).length > 0 && (
        <div className={styles.hotelTabs}>
          {rows
            .filter((r) => r.selected)
            .map((r) => (
              <button
                type="button"
                key={r.hotel.id}
                aria-pressed={r.hotel.id === hotelId}
                disabled={disabled}
                onClick={() => onChoose(r.hotel.id)}
              >
                {r.hotel.name}
              </button>
            ))}
        </div>
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
  const first = row.roomRates.find((r) =>
    r.occupancyRates?.some((p) => p.manualPricing),
  );
  const [combinations, setCombinations] = useState(() =>
    combinationsFromRates(first?.occupancyRates ?? []),
  );
  const [bases, setBases] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      row.roomRates.map((r) => [
        r.roomTypeId,
        r.occupancyRates?.[0]?.manualPricing?.baseAmount ?? '',
      ]),
    ),
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
    nextCombinations = combinations,
    nextBases = bases,
    nextAdjustments = adjustments,
  ) {
    const rooms: ManualRoom[] = [];
    let valid = true;
    for (const room of allRooms) {
      if (!nextBases[room.roomTypeId]) continue;
      const rates = buildManualRates(
        nextCombinations,
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
  function changeCombination(index: number, patch: Partial<Combination>) {
    const next = combinations.map((c, i) =>
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
    setCombinations(next);
    update(next);
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
      await onAddRoomType(row.hotel.id, roomTypeName);
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
      <details className={styles.coefficients}>
        <summary>جدول ضرایب هتل</summary>
        <p>این جدول برای همهٔ نوع اتاق‌های همین هتل اعمال می‌شود.</p>
        <div className={styles.tableScroll}>
          <table
            className={styles.coefficientTable}
            aria-label="جدول ضرایب مشترک هتل"
          >
            <thead>
              <tr>
                <th>ترکیب اتاق</th>
                <th>بزرگسال</th>
                <th>کودک</th>
                <th>ردهٔ سنی هر کودک</th>
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
                  </td>
                  <td>
                    <Choice
                      label="تعداد بزرگسال ترکیب"
                      value={String(combination.adults)}
                      onChange={(n) =>
                        changeCombination(index, { adults: Number(n) })
                      }
                      options={countOptions(20, 1)}
                    />
                  </td>
                  <td>
                    <Choice
                      label="تعداد کودک ترکیب"
                      value={String(combination.childAges.length)}
                      onChange={(n) =>
                        changeCombination(index, {
                          childAges: Array.from(
                            { length: Number(n) },
                            (_, i) =>
                              combination.childAges[i] ?? {
                                min: 2,
                                maxExclusive: 15,
                              },
                          ),
                        })
                      }
                      options={countOptions(10)}
                    />
                  </td>
                  <td>
                    {combination.childAges.map((age, i) => (
                      <div key={i} className={styles.childRange}>
                        <span>کودک {i + 1}</span>
                        <Choice
                          label="حداقل سن کودک"
                          value={String(age.min)}
                          options={countOptions(14)}
                          onChange={(n) =>
                            changeCombination(index, {
                              childAges: combination.childAges.map((a, j) =>
                                j === i ? { ...a, min: Number(n) } : a,
                              ),
                            })
                          }
                        />
                        <span>تا کمتر از</span>
                        <Choice
                          label="حد بالای سن کودک"
                          value={String(age.maxExclusive)}
                          options={countOptions(15, 1)}
                          onChange={(n) =>
                            changeCombination(index, {
                              childAges: combination.childAges.map((a, j) =>
                                j === i ? { ...a, maxExclusive: Number(n) } : a,
                              ),
                            })
                          }
                        />
                      </div>
                    ))}
                  </td>
                  <td>
                    <input
                      aria-label="ضریب ترکیب اتاق"
                      inputMode="decimal"
                      value={combination.coefficient}
                      onChange={(e) =>
                        changeCombination(index, {
                          coefficient: e.target.value,
                        })
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => {
                        const next = combinations.filter((_, i) => i !== index);
                        setCombinations(next);
                        update(next);
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
                <td colSpan={6}>
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
                      setCombinations(next);
                      update(next);
                    }}
                  >
                    افزودن ردیف
                  </button>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </details>
      <div className={styles.roomGrid}>
        {allRooms.map((room) => {
          const rates = buildManualRates(
            combinations,
            bases[room.roomTypeId] ?? '',
            row.currency,
            checkIn,
            checkOut,
            adjustments[room.roomTypeId],
          );
          return (
            <section key={room.roomTypeId} className={styles.roomCard}>
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
                      update(combinations, next);
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
                  قیمت پایه، ضریب، ردهٔ سنی یا بازهٔ اقامت این اتاق معتبر نیست؛
                  ثبت بسته تا اصلاح آن انجام نمی‌شود.
                </p>
              )}
            </section>
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
