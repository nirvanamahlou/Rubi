'use client';
import { useState } from 'react';
import {
  changePackageSale,
  type PackageRoomSaleOverrideV1,
  type HotelPackageTablePrice,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { currencySymbol } from '@/lib/currency-symbol';

export type PackageSaleRow = {
  id: string;
  hotelName: string;
  brokerName: string;
  prices: readonly HotelPackageTablePrice[];
};
const columns = [
  ['single', 'سینگل · هر نفر'],
  ['double', 'دبل · هر نفر'],
  ['doubleChild', 'کودک با تخت'],
] as const;
const keyOf = (id: string, room: string, currency: string) =>
  JSON.stringify([id, room, currency]);
export function PackageRoomSales({
  rows,
  overrides,
  onChange,
  disabled = false,
}: {
  rows: readonly PackageSaleRow[];
  overrides: readonly PackageRoomSaleOverrideV1[];
  onChange: (value: PackageRoomSaleOverrideV1[]) => void;
  disabled?: boolean;
}) {
  const [selection, setSelection] = useState<string[] | null>(null);
  const [kind, setKind] = useState<'PERCENT' | 'AMOUNT' | 'SET'>('PERCENT');
  const [direction, setDirection] = useState<'increase' | 'decrease'>(
    'increase',
  );
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const cells = rows.flatMap((row) =>
    row.prices.flatMap((price) =>
      price.currencyAmounts.map((part) => ({
        hotelRateId: row.id,
        roomCode: price.roomCode,
        currencyCode: part.currencyCode,
        amount: part.sale,
      })),
    ),
  );
  const keys = cells.map((cell) =>
    keyOf(cell.hotelRateId, cell.roomCode, cell.currencyCode),
  );
  const selected = (selection ?? keys).filter((key) => keys.includes(key));
  const amount = (cell: PackageRoomSaleOverrideV1) =>
    overrides.find(
      (item) =>
        keyOf(item.hotelRateId, item.roomCode, item.currencyCode) ===
        keyOf(cell.hotelRateId, cell.roomCode, cell.currencyCode),
    )?.amount ?? cell.amount;
  function update(changed: PackageRoomSaleOverrideV1[]) {
    const map = new Map(
      overrides.map((item) => [
        keyOf(item.hotelRateId, item.roomCode, item.currencyCode),
        item,
      ]),
    );
    changed.forEach((item) =>
      map.set(keyOf(item.hotelRateId, item.roomCode, item.currencyCode), item),
    );
    onChange([...map.values()]);
  }
  return (
    <section aria-label="قیمت فروش ترکیب‌های پکیج" className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 p-3">
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() => setSelection(keys)}
        >
          انتخاب همه
        </Button>
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() => setSelection([])}
        >
          لغو انتخاب‌ها
        </Button>
        <NativeSearchSelect
          aria-label="انتخاب ترکیب در همه هتل‌ها"
          value=""
          disabled={disabled}
          onChange={(event) =>
            setSelection(
              cells
                .filter((cell) => cell.roomCode === event.target.value)
                .map((cell) =>
                  keyOf(cell.hotelRateId, cell.roomCode, cell.currencyCode),
                ),
            )
          }
        >
          <option value="">انتخاب ترکیب</option>
          {columns.map(([code, title]) => (
            <option key={code} value={code}>
              {title}
            </option>
          ))}
        </NativeSearchSelect>
        <span className="text-xs">{selected.length} ردیف منتخب</span>
        <NativeSearchSelect
          aria-label="نوع تغییر قیمت فروش"
          value={kind}
          disabled={disabled}
          onChange={(event) => setKind(event.target.value as typeof kind)}
        >
          <option value="PERCENT">درصدی</option>
          <option value="AMOUNT">مبلغ ثابت</option>
          <option value="SET">تعیین قیمت فروش</option>
        </NativeSearchSelect>
        {kind !== 'SET' && (
          <NativeSearchSelect
            aria-label="افزایش یا کاهش"
            value={direction}
            disabled={disabled}
            onChange={(event) =>
              setDirection(event.target.value as typeof direction)
            }
          >
            <option value="increase">افزایش</option>
            <option value="decrease">کاهش</option>
          </NativeSearchSelect>
        )}
        <Input
          className="w-28"
          aria-label="مقدار تغییر قیمت فروش"
          inputMode="decimal"
          value={value}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
        />
        <Button
          disabled={disabled || !selected.length}
          onClick={() => {
            try {
              const changed = cells
                .filter((cell) =>
                  selected.includes(
                    keyOf(cell.hotelRateId, cell.roomCode, cell.currencyCode),
                  ),
                )
                .map((cell) => ({
                  ...cell,
                  amount: changePackageSale(
                    amount(cell),
                    cell.currencyCode,
                    kind,
                    value,
                    direction,
                  ),
                }));
              update(changed);
              setError('');
            } catch (cause) {
              setError(
                cause instanceof Error
                  ? cause.message
                  : 'قیمت فروش معتبر نیست.',
              );
            }
          }}
        >
          اعمال روی ترکیب‌های منتخب
        </Button>
        <Button
          variant="outline"
          disabled={disabled || !overrides.length}
          onClick={() => {
            onChange([]);
            setError('');
          }}
        >
          بازنشانی قیمت‌های دستی
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-muted/70">
            <tr>
              <th className="p-2 text-right">هتل / کارگزار</th>
              {columns.map(([code, title]) => (
                <th className="p-2 text-right" key={code}>
                  {title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="p-2">
                  <strong className="block">{row.hotelName}</strong>
                  <span className="text-xs text-muted-foreground">
                    {row.brokerName}
                  </span>
                </td>
                {columns.map(([code, title]) => {
                  const price = row.prices.find(
                    (item) => item.roomCode === code,
                  );
                  return (
                    <td key={code} className="p-2 align-top">
                      {price ? (
                        price.currencyAmounts.map((part) => {
                          const cell = {
                            hotelRateId: row.id,
                            roomCode: code,
                            currencyCode: part.currencyCode,
                            amount: part.sale,
                          };
                          const key = keyOf(row.id, code, part.currencyCode);
                          let valid = true;
                          try {
                            changePackageSale(
                              '0',
                              part.currencyCode,
                              'SET',
                              amount(cell),
                              'increase',
                            );
                          } catch {
                            valid = false;
                          }
                          return (
                            <label
                              key={key}
                              className="mb-1 flex items-center gap-2"
                            >
                              <input
                                type="checkbox"
                                aria-label={`انتخاب ${row.hotelName} ${title} ${part.currencyCode}`}
                                disabled={disabled}
                                checked={selected.includes(key)}
                                onChange={(event) =>
                                  setSelection(
                                    event.target.checked
                                      ? [...selected, key]
                                      : selected.filter((item) => item !== key),
                                  )
                                }
                              />
                              <Input
                                dir="ltr"
                                className="h-9 min-w-24"
                                aria-label={`قیمت فروش ${row.hotelName} ${title} ${part.currencyCode}`}
                                aria-invalid={!valid}
                                value={amount(cell)}
                                inputMode="decimal"
                                disabled={disabled}
                                onChange={(event) =>
                                  update([
                                    { ...cell, amount: event.target.value },
                                  ])
                                }
                              />
                              <small>{currencySymbol(part.currencyCode)}</small>
                            </label>
                          );
                        })
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          تعرفه کامل موجود نیست
                        </span>
                      )}
                      {price && (
                        <small className="text-muted-foreground">
                          {price.roomTypeName} · {price.board}
                        </small>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
