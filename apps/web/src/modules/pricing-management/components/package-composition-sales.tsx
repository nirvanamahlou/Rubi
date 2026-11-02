'use client';
import { useState } from 'react';
import {
  changePackageSale,
  packageRoomTitle,
  packageRoomIdentity,
  type PackageRoomSaleOverrideV1,
} from '@nora/contracts';
import type { PackageSaleRow } from './package-room-sales';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { currencySymbol } from '@/lib/currency-symbol';

export const compositionSelectionKey = (
  hotelRateId: string,
  roomCode: string,
) => JSON.stringify([hotelRateId, roomCode]);
export function PackageCompositionSales({
  rows,
  overrides,
  onChange,
  selectedRoomKeys,
  onSelect,
  disabled = false,
}: {
  rows: readonly PackageSaleRow[];
  overrides: readonly PackageRoomSaleOverrideV1[];
  onChange: (value: PackageRoomSaleOverrideV1[]) => void;
  selectedRoomKeys: readonly string[];
  onSelect: (keys: string[]) => void;
  disabled?: boolean;
}) {
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
  const current = (cell: PackageRoomSaleOverrideV1) =>
    overrides.find(
      (v) =>
        v.hotelRateId === cell.hotelRateId &&
        v.roomCode === cell.roomCode &&
        v.currencyCode === cell.currencyCode,
    )?.amount ?? cell.amount;
  const update = (changes: PackageRoomSaleOverrideV1[]) => {
    const key = (c: PackageRoomSaleOverrideV1) =>
      JSON.stringify([c.hotelRateId, c.roomCode, c.currencyCode]);
    const map = new Map(overrides.map((c) => [key(c), c]));
    changes.forEach((c) => map.set(key(c), c));
    onChange([...map.values()]);
  };
  return (
    <section aria-label="قیمت فروش ترکیب‌های پکیج" className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() =>
            onSelect(
              rows.flatMap((r) =>
                r.prices.map((p) => compositionSelectionKey(r.id, p.roomCode)),
              ),
            )
          }
        >
          انتخاب همه
        </Button>
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() => onSelect([])}
        >
          لغو انتخاب‌ها
        </Button>
        <NativeSearchSelect
          aria-label="نوع تغییر قیمت فروش"
          value={kind}
          disabled={disabled}
          onChange={(e) => setKind(e.target.value as typeof kind)}
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
            onChange={(e) => setDirection(e.target.value as typeof direction)}
          >
            <option value="increase">افزایش</option>
            <option value="decrease">کاهش</option>
          </NativeSearchSelect>
        )}
        <Input
          className="w-28"
          aria-label="مقدار تغییر قیمت فروش"
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button
          disabled={disabled || !selectedRoomKeys.length}
          onClick={() => {
            try {
              const changed = cells
                .filter((c) =>
                  selectedRoomKeys.includes(
                    compositionSelectionKey(c.hotelRateId, c.roomCode),
                  ),
                )
                .map((c) => ({
                  ...c,
                  amount: changePackageSale(
                    current(c),
                    c.currencyCode,
                    kind,
                    value,
                    direction,
                  ),
                }));
              update(changed);
              setError('');
            } catch (e) {
              setError(
                e instanceof Error ? e.message : 'قیمت فروش معتبر نیست.',
              );
            }
          }}
        >
          اعمال روی ترکیب‌های منتخب
        </Button>
      </div>
      {error && <p role="alert">{error}</p>}
      {rows
        .flatMap((row) => {
          const groups = new Map<string, typeof row.prices>();
          for (const price of row.prices) {
            const identity = packageRoomIdentity(price.roomCode);
            const key = JSON.stringify([
              identity?.roomTypeId ?? price.roomTypeName,
              price.board,
            ]);
            groups.set(key, [...(groups.get(key) ?? []), price]);
          }
          return [...groups].map(([roomKey, prices]) => ({
            ...row,
            roomKey,
            prices,
          }));
        })
        .map((row) => (
          <div
            key={row.id + row.roomKey}
            className="overflow-x-auto rounded-xl border"
          >
            <h3 className="bg-muted p-3 font-bold">
              {row.hotelName} · {row.brokerName} · {row.prices[0]?.roomTypeName}{' '}
              · {row.prices[0]?.board}
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th>انتخاب</th>
                  <th>ترکیب اتاق</th>
                  <th>قیمت خرید هتل</th>
                  <th>قیمت فروش</th>
                </tr>
              </thead>
              <tbody>
                {row.prices.map((price) => {
                  const key = compositionSelectionKey(row.id, price.roomCode);
                  return (
                    <tr key={key} className="border-t">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          aria-label={`انتخاب ${row.hotelName} ${price.roomTypeName} ${packageRoomTitle(price.roomCode)}`}
                          disabled={disabled}
                          checked={selectedRoomKeys.includes(key)}
                          onChange={(e) =>
                            onSelect(
                              e.target.checked
                                ? [...selectedRoomKeys, key]
                                : selectedRoomKeys.filter((k) => k !== key),
                            )
                          }
                        />
                      </td>
                      <td>{packageRoomTitle(price.roomCode)}</td>
                      <td>
                        {price.hotelPurchase}{' '}
                        {currencySymbol(price.currencyCode)}
                      </td>
                      <td className="p-2">
                        {price.currencyAmounts.map((p) => {
                          const cell = {
                            hotelRateId: row.id,
                            roomCode: price.roomCode,
                            currencyCode: p.currencyCode,
                            amount: p.sale,
                          };
                          return (
                            <label className="flex gap-2" key={p.currencyCode}>
                              <Input
                                className="w-32"
                                dir="ltr"
                                aria-label={`قیمت فروش ${row.hotelName} ${price.roomTypeName} ${packageRoomTitle(price.roomCode)} ${p.currencyCode}`}
                                disabled={disabled}
                                value={current(cell)}
                                onChange={(e) =>
                                  update([{ ...cell, amount: e.target.value }])
                                }
                              />
                              {currencySymbol(p.currencyCode)}
                            </label>
                          );
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
    </section>
  );
}
