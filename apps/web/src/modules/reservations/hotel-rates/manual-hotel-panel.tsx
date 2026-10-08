'use client';
import { useEffect, useEffectEvent, useState } from 'react';
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
}: {
  rows: readonly ManualHotelRow[];
  hotelId: string;
  onChoose: (id: string) => void;
  onChange: (id: string, patch: Partial<ManualHotelRow>) => void;
  checkIn: string;
  checkOut: string;
  onValidityChange: (id: string, valid: boolean) => void;
  hideSelector?: boolean;
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
}: {
  row: ManualHotelRow;
  onChange: (patch: Partial<ManualHotelRow>) => void;
  checkIn: string;
  checkOut: string;
  onValidityChange: (valid: boolean) => void;
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
  const [adjustments, setAdjustments] = useState<
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
  const [selection, setSelection] = useState<string[]>([]);
  const [operation, setOperation] = useState('PERCENT');
  const [direction, setDirection] = useState('increase');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [saleDrafts, setSaleDrafts] = useState<Record<string, string>>({});
  const imported = row.roomRates.some((r) =>
    r.occupancyRates?.some((p) => !p.manualPricing),
  );
  function update(
    nextCombinations = combinations,
    nextBases = bases,
    nextAdjustments = adjustments,
    nextSaleDrafts = saleDrafts,
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
    const invalidSale = Object.entries(nextSaleDrafts).some(([key, value]) =>
      allRooms.some(
        (room) =>
          nextBases[room.roomTypeId] &&
          nextCombinations.some(
            (c) =>
              c.coefficient &&
              `${room.roomTypeId}:${c.id}` === key &&
              !calculateManualHotelPrices(
                nextBases[room.roomTypeId]!,
                c.coefficient,
                row.currency,
                { kind: 'SET', value },
              ),
          ),
      ),
    );
    onValidityChange(valid && rooms.length > 0 && !invalidSale);
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
  const pricedKeys = allRooms.flatMap((room) =>
    combinations
      .filter((c) =>
        calculateManualHotelPrices(
          bases[room.roomTypeId] ?? '',
          c.coefficient,
          row.currency,
          adjustments[room.roomTypeId]?.[combinationKey(c)] ?? {
            kind: 'AMOUNT',
            value: '0',
          },
        ),
      )
      .map((c) => `${room.roomTypeId}:${c.id}`),
  );
  const selectedKeys = selection.filter((key) => pricedKeys.includes(key));
  function toggle(key: string) {
    setSelection((old) =>
      old.includes(key) ? old.filter((s) => s !== key) : [...old, key],
    );
  }
  function editSale(room: ManualRoom, combination: Combination, value: string) {
    const key = `${room.roomTypeId}:${combination.id}`;
    const rule: HotelSaleAdjustmentV1 = { kind: 'SET', value };
    const nextDrafts = { ...saleDrafts, [key]: value };
    if (
      !calculateManualHotelPrices(
        bases[room.roomTypeId] ?? '',
        combination.coefficient,
        row.currency,
        rule,
      )
    ) {
      setSaleDrafts(nextDrafts);
      onValidityChange(false);
      return;
    }
    // Keep the user's text while typing; formatting after each key moves the
    // caret and turns ordinary typing (e.g. 2 -> 23 -> 235) into another value.
    const next = {
      ...adjustments,
      [room.roomTypeId]: {
        ...adjustments[room.roomTypeId],
        [combinationKey(combination)]: rule,
      },
    };
    setSaleDrafts(nextDrafts);
    setAdjustments(next);
    update(combinations, bases, next, nextDrafts);
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
        <button
          type="button"
          onClick={() => {
            onValidityChange(true);
            onChange({ selected: false });
          }}
        >
          کنارگذاشتن هتل از این بسته
        </button>
      </div>
      <div className={styles.hotelSettings}>
        <Lookup
          kind="organizations"
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
      <div className={styles.selectionTools}>
        <button type="button" onClick={() => setSelection(pricedKeys)}>
          انتخاب همهٔ ترکیب‌های قیمت‌دار
        </button>
        <button type="button" onClick={() => setSelection([])}>
          لغو انتخاب‌ها
        </button>
        <Choice
          label="انتخاب یک ترکیب در همهٔ اتاق‌ها"
          value=""
          options={combinations
            .filter((c) => c.coefficient)
            .map((c) => ({ id: c.id, name: combinationName(c) }))}
          onChange={(id) =>
            setSelection(pricedKeys.filter((key) => key.endsWith(`:${id}`)))
          }
        />
      </div>
      {selectedKeys.length > 0 && (
        <div className={styles.bulkBar} aria-label="تغییر گروهی فروش">
          <span>{selectedKeys.length.toLocaleString('fa-IR')} ردیف منتخب</span>
          <Choice
            label="نوع تغییر قیمت فروش"
            value={operation}
            onChange={setOperation}
            options={[
              { id: 'PERCENT', name: 'درصدی' },
              { id: 'AMOUNT', name: 'مبلغ ثابت' },
              { id: 'SET', name: 'تعیین قیمت فروش' },
            ]}
          />
          {operation !== 'SET' && (
            <Choice
              label="افزایش یا کاهش"
              value={direction}
              onChange={setDirection}
              options={[
                { id: 'increase', name: 'افزایش' },
                { id: 'decrease', name: 'کاهش' },
              ]}
            />
          )}
          <input
            aria-label="مقدار تغییر قیمت فروش"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button
            type="button"
            disabled={!selectedKeys.length}
            onClick={() => {
              if (!/^\d{1,12}(\.\d{1,2})?$/.test(value)) {
                setError('مقدار تغییر قیمت معتبر نیست.');
                return;
              }
              const next = { ...adjustments };
              for (const room of allRooms) {
                next[room.roomTypeId] = { ...next[room.roomTypeId] };
                for (const combination of combinations)
                  if (
                    selectedKeys.includes(
                      `${room.roomTypeId}:${combination.id}`,
                    )
                  )
                    next[room.roomTypeId]![combinationKey(combination)] = {
                      kind: operation as HotelSaleAdjustmentV1['kind'],
                      value:
                        direction === 'decrease' && operation !== 'SET'
                          ? `-${value}`
                          : value,
                    };
                if (
                  combinations.some(
                    (c) =>
                      selectedKeys.includes(`${room.roomTypeId}:${c.id}`) &&
                      !calculateManualHotelPrices(
                        bases[room.roomTypeId] ?? '',
                        c.coefficient,
                        row.currency,
                        next[room.roomTypeId]![combinationKey(c)]!,
                      ),
                  )
                ) {
                  setError('تغییر باعث قیمت منفی یا نرخ نامعتبر می‌شود.');
                  return;
                }
              }
              setError('');
              const nextDrafts = { ...saleDrafts };
              selectedKeys.forEach((key) => delete nextDrafts[key]);
              setSaleDrafts(nextDrafts);
              setAdjustments(next);
              update(combinations, bases, next, nextDrafts);
            }}
          >
            اعمال روی ترکیب‌های منتخب
          </button>
        </div>
      )}
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
                    <th>انتخاب</th>
                    <th>ترکیب</th>
                    <th>قیمت خرید</th>
                    <th>قیمت فروش</th>
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
                    const invalidSale =
                      key in saleDrafts &&
                      !calculateManualHotelPrices(
                        bases[room.roomTypeId] ?? '',
                        combination.coefficient,
                        row.currency,
                        { kind: 'SET', value: saleDrafts[key]! },
                      );
                    return (
                      <tr
                        key={key}
                        className={
                          selectedKeys.includes(key)
                            ? styles.selected
                            : undefined
                        }
                        onClick={() => {
                          if (calculated) toggle(key);
                        }}
                      >
                        <td>
                          <input
                            type="checkbox"
                            disabled={!calculated}
                            aria-label="انتخاب ترکیب برای تغییر فروش"
                            checked={selectedKeys.includes(key)}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => toggle(key)}
                          />
                        </td>
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
                        <td dir="ltr" onClick={(e) => e.stopPropagation()}>
                          <input
                            aria-label={`قیمت فروش ${room.roomTypeName} ${combinationName(combination)}`}
                            className={styles.saleInput}
                            inputMode="decimal"
                            disabled={!calculated}
                            aria-invalid={invalidSale}
                            value={saleDrafts[key] ?? calculated?.sale ?? ''}
                            placeholder="—"
                            onChange={(e) =>
                              editSale(room, combination, e.target.value)
                            }
                            onBlur={() => {
                              if (invalidSale) return;
                              setSaleDrafts((old) => {
                                const next = { ...old };
                                delete next[key];
                                return next;
                              });
                            }}
                          />
                          <small>{row.currency}</small>
                          {invalidSale && (
                            <span role="alert">قیمت فروش معتبر نیست.</span>
                          )}
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
      {!allRooms.length && (
        <p role="alert">
          برای این هتل ابتدا نوع اتاق را در اطلاعات پایه ثبت کنید.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </article>
  );
}
