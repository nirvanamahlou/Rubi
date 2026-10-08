'use client';
import { useEffect, useEffectEvent, useState } from 'react';
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
    <section className="grid gap-4" aria-label="پنل دستی هتل">
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
    </section>
  );
}
export function ManualHotelSelector({
  rows,
  hotelId,
  onChoose,
}: {
  rows: readonly ManualHotelRow[];
  hotelId: string;
  onChoose: (id: string) => void;
}) {
  const row = rows.find((r) => r.hotel.id === hotelId);
  return (
    <div className="grid gap-3">
      <label className="grid max-w-xl gap-2">
        هتل
        <SearchCombobox
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
        <div className="flex flex-wrap gap-2">
          {rows
            .filter((r) => r.selected)
            .map((r) => (
              <button
                type="button"
                key={r.hotel.id}
                aria-pressed={r.hotel.id === hotelId}
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
  const manual = row.roomRates
    .flatMap((r) => r.occupancyRates ?? [])
    .filter((r) => r.manualPricing);
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
  if (imported)
    return (
      <div role="status">
        این هتل نرخ اکسل دارد؛ برای حفظ نرخ‌های واردشده از ویرایش بستهٔ موجود
        استفاده کنید.
      </div>
    );
  return (
    <article className="grid gap-5 rounded-xl border p-5">
      <h2>{row.hotel.name}</h2>
      <button type="button" onClick={() => onChange({ selected: false })}>
        کنارگذاشتن هتل از این بسته
      </button>
      <div className="grid max-w-xl gap-3">
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
      <details>
        <summary className="cursor-pointer rounded-lg border p-3 font-semibold">
          جدول ضرایب هتل
        </summary>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 780 }}>
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
                    {combination.label ||
                      `${combination.adults} AD + ${combination.childAges.length} CHD`}
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
                      <div key={i} className="flex gap-2 py-1">
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
                    onClick={() =>
                      setCombinations([
                        ...combinations,
                        {
                          id: crypto.randomUUID(),
                          label: '',
                          adults: 2,
                          childAges: [],
                          coefficient: '',
                        },
                      ])
                    }
                  >
                    افزودن ردیف
                  </button>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </details>
      <p>
        خرید هر شب = قیمت پایهٔ همین اتاق × ضریب ترکیب. تغییر فروش نسبت به قیمت
        خرید است و با تغییر قبلی جمع نمی‌شود. ضریب خالی ثبت نمی‌شود.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            setSelection(
              allRooms.flatMap((room) =>
                bases[room.roomTypeId]
                  ? combinations
                      .filter((c) => c.coefficient)
                      .map((c) => `${room.roomTypeId}:${c.id}`)
                  : [],
              ),
            )
          }
        >
          انتخاب همهٔ ترکیب‌های قیمت‌دار
        </button>
        <button type="button" onClick={() => setSelection([])}>
          لغو انتخاب‌ها
        </button>
        {combinations
          .filter((c) => c.coefficient)
          .map((c) => (
            <button
              type="button"
              key={c.id}
              onClick={() =>
                setSelection(
                  allRooms
                    .filter((room) => bases[room.roomTypeId])
                    .map((room) => `${room.roomTypeId}:${c.id}`),
                )
              }
            >
              انتخاب در همهٔ اتاق‌ها:{' '}
              {c.label || `${c.adults} AD + ${c.childAges.length} CHD`}
            </button>
          ))}
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
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
          disabled={!selection.length}
          onClick={() => {
            if (!/^\d{1,12}(\.\d{1,2})?$/.test(value)) {
              setError('مقدار تغییر قیمت معتبر نیست.');
              return;
            }
            const next = { ...adjustments };
            for (const room of allRooms) {
              next[room.roomTypeId] = { ...next[room.roomTypeId] };
              for (const combination of combinations)
                if (selection.includes(`${room.roomTypeId}:${combination.id}`))
                  next[room.roomTypeId]![combinationKey(combination)] = {
                    kind: operation as HotelSaleAdjustmentV1['kind'],
                    value:
                      direction === 'decrease' && operation !== 'SET'
                        ? `-${value}`
                        : value,
                  };
              if (
                bases[room.roomTypeId] &&
                !buildManualRates(
                  combinations,
                  bases[room.roomTypeId]!,
                  row.currency,
                  checkIn,
                  checkOut,
                  next[room.roomTypeId],
                )
              ) {
                setError('تغییر باعث قیمت منفی یا نرخ نامعتبر می‌شود.');
                return;
              }
            }
            setError('');
            setAdjustments(next);
            update(combinations, bases, next);
          }}
        >
          اعمال روی ترکیب‌های منتخب
        </button>
      </div>
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
          <section
            key={room.roomTypeId}
            className="grid gap-3 rounded-xl border p-4"
          >
            <h3>{room.roomTypeName}</h3>
            <label className="grid max-w-sm gap-2">
              قیمت پایهٔ اتاق / هر شب
              <input
                aria-label={`قیمت پایه ${room.roomTypeName}`}
                inputMode="decimal"
                value={bases[room.roomTypeId] ?? ''}
                onChange={(e) => {
                  const next = { ...bases, [room.roomTypeId]: e.target.value };
                  setBases(next);
                  update(combinations, next);
                }}
              />
            </label>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ minWidth: 600 }}>
                <thead>
                  <tr>
                    <th>انتخاب</th>
                    <th>ترکیب</th>
                    <th>ضریب</th>
                    <th>قیمت خرید</th>
                    <th>قیمت فروش</th>
                  </tr>
                </thead>
                <tbody>
                  {combinations.map((combination) => {
                    const key = `${room.roomTypeId}:${combination.id}`;
                    const rate = rates?.find(
                      (r) => combinationKey(r) === combinationKey(combination),
                    );
                    return (
                      <tr key={key}>
                        <td>
                          <input
                            type="checkbox"
                            className="!w-5 !min-h-5"
                            disabled={!rate}
                            aria-label="انتخاب ترکیب برای تغییر فروش"
                            checked={selection.includes(key)}
                            onChange={(e) =>
                              setSelection(
                                e.target.checked
                                  ? [...selection, key]
                                  : selection.filter((s) => s !== key),
                              )
                            }
                          />
                        </td>
                        <td>
                          {combination.label ||
                            `${combination.adults} AD + ${combination.childAges.length} CHD`}
                          {combination.childAges.map((a, i) => (
                            <small key={i}>
                              {' '}
                              / {a.min} تا کمتر از {a.maxExclusive}
                            </small>
                          ))}
                        </td>
                        <td>{combination.coefficient || '—'}</td>
                        <td dir="ltr">
                          {rate?.amount ?? '—'} {row.currency}
                        </td>
                        <td dir="ltr">
                          {rate?.saleAmount ?? '—'} {row.currency}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {bases[room.roomTypeId] && !rates && (
              <p role="alert">
                قیمت پایه، ضریب، ردهٔ سنی یا بازهٔ اقامت این اتاق معتبر نیست؛
                ثبت بسته تا اصلاح آن انجام نمی‌شود.
              </p>
            )}
          </section>
        );
      })}
      {!manual.length && (
        <p>
          ضرایب دستی قدیمی وارد این جدول نمی‌شوند؛ قیمت پایه و ضریب‌های جدید را
          وارد کنید.
        </p>
      )}
      {!allRooms.length && (
        <p role="alert">
          برای این هتل ابتدا نوع اتاق را در اطلاعات پایه ثبت کنید.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </article>
  );
}
