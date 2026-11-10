'use client';
import {
  combinedHotelOptions,
  quoteCombinedHotels,
  tourStayPeriods,
  packageRoomTitle,
  type CombinedHotelPackageV1,
  type PackageTourCostGridV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { browserRandomUuid } from '@/lib/browser-random-uuid';

export function CombinedHotelPackages({
  grid,
  value,
  onChange,
  disabled = false,
}: {
  grid: PackageTourCostGridV1;
  value: readonly CombinedHotelPackageV1[];
  onChange: (v: CombinedHotelPackageV1[]) => void;
  disabled?: boolean;
}) {
  const stays = tourStayPeriods(
    grid.tour.package,
    grid.tour.startsOn,
    grid.tour.endsOn,
  );
  const update = (index: number, patch: Partial<CombinedHotelPackageV1>) =>
    onChange(value.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  return (
    <section className="grid gap-4" aria-label="ترکیب هتل‌های مقصدها">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">ترکیب‌های هتل تور</h2>
          <p className="text-sm text-muted-foreground">
            هر باکس یک پکیج کامل است؛ یک هتل از هر مقصد با قیمت مشترک.
          </p>
        </div>
        <Button
          type="button"
          disabled={disabled || value.length >= 50}
          onClick={() =>
            onChange([
              ...value,
              {
                id: browserRandomUuid(),
                rooms: stays.map(() => ({ rateId: '', roomCode: '' })),
              },
            ])
          }
        >
          افزودن ترکیب هتل
        </Button>
      </div>
      {value.map((c, index) => {
        let result;
        let error = '';
        try {
          result = quoteCombinedHotels(grid, [{ ...c, sales: undefined }])[0];
        } catch (e) {
          error = e instanceof Error ? e.message : 'ترکیب را تکمیل کنید.';
        }
        return (
          <fieldset
            key={c.id}
            disabled={disabled}
            className="grid gap-4 rounded-2xl border bg-surface p-4 shadow-sm"
          >
            <div className="flex justify-between">
              <h3 className="font-bold">ترکیب {index + 1}</h3>
              <Button
                type="button"
                variant="outline"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                حذف ترکیب
              </Button>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              {stays.map((stay, i) => {
                const options = combinedHotelOptions(grid, i);
                const selected = options.find(
                  (o) => o.row.id === c.rooms[i]?.rateId,
                );
                return (
                  <div
                    key={i}
                    className="grid content-start gap-3 rounded-xl border bg-secondary/20 p-3"
                  >
                    <strong>
                      {grid.destinationStays?.[i]?.name ?? `مقصد ${i + 1}`} ·{' '}
                      {stay.nights} شب
                    </strong>
                    <span dir="ltr" className="text-xs">
                      {stay.checkIn} — {stay.checkOut}
                    </span>
                    <NativeSearchSelect
                      aria-label={`هتل مقصد ${i + 1} ترکیب ${index + 1}`}
                      value={c.rooms[i]?.rateId ?? ''}
                      onChange={(e) =>
                        update(index, {
                          rooms: stays.map((_, j) =>
                            j === i
                              ? { rateId: e.target.value, roomCode: '' }
                              : (c.rooms[j] ?? { rateId: '', roomCode: '' }),
                          ),
                          sales: undefined,
                        })
                      }
                    >
                      <option value="">انتخاب هتل و منبع نرخ</option>
                      {options.map((o) => (
                        <option key={o.row.id} value={o.row.id}>
                          {o.row.hotelName} · {o.row.brokerName}
                        </option>
                      ))}
                    </NativeSearchSelect>
                    <NativeSearchSelect
                      aria-label={`تعرفه اتاق مقصد ${i + 1} ترکیب ${index + 1}`}
                      disabled={!selected}
                      value={c.rooms[i]?.roomCode ?? ''}
                      onChange={(e) =>
                        update(index, {
                          rooms: c.rooms.map((r, j) =>
                            j === i ? { ...r, roomCode: e.target.value } : r,
                          ),
                          sales: undefined,
                        })
                      }
                    >
                      <option value="">انتخاب نوع اتاق و ترکیب نفرات</option>
                      {selected?.prices.map((p) => (
                        <option key={p.roomCode} value={p.roomCode}>
                          {p.roomTypeName} {p.board ? `· ${p.board}` : ''} ·{' '}
                          {packageRoomTitle(p.roomCode)} · {p.hotelPurchase}{' '}
                          {p.currencyCode}
                        </option>
                      ))}
                    </NativeSearchSelect>
                    {!options.length && (
                      <p className="text-sm text-amber-800">
                        برای این مقصد و شب‌های اقامت نرخ ثبت نشده است.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            {error ? (
              <p className="text-sm text-amber-800">{error}</p>
            ) : result ? (
              <div className="grid gap-3 rounded-xl bg-secondary/40 p-3">
                <strong>قیمت کل ترکیب</strong>
                {result.purchase.map((p) => (
                  <label
                    key={p.currencyCode}
                    className="grid gap-2 sm:grid-cols-2"
                  >
                    <span>
                      خرید مجموع: {p.amount} {p.currencyCode}
                    </span>
                    <span className="flex items-center gap-2">
                      فروش مشترک
                      <Input
                        aria-label={`فروش ترکیب ${index + 1} ${p.currencyCode}`}
                        inputMode="decimal"
                        value={
                          c.sales?.find(
                            (s) => s.currencyCode === p.currencyCode,
                          )?.amount ?? p.amount
                        }
                        onChange={(e) =>
                          update(index, {
                            sales: result!.purchase.map((v) => ({
                              currencyCode: v.currencyCode,
                              amount:
                                v.currencyCode === p.currencyCode
                                  ? e.target.value
                                  : (c.sales?.find(
                                      (s) => s.currencyCode === v.currencyCode,
                                    )?.amount ?? v.amount),
                            })),
                          })
                        }
                      />
                      {p.currencyCode}
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
          </fieldset>
        );
      })}
    </section>
  );
}
