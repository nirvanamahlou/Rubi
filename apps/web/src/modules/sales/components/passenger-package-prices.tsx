'use client';
import {
  moneyDecimal,
  moneyUnits,
  validatePassengerPackagePrices,
  type SalesMoney,
} from '@rubi/contracts';
import { MoneyInput, formatSalesMoney } from '@/components/ui/money-input';
import { salesPayload, type SalesFormState } from '../model/sales-form';

export function PassengerPackagePrices({
  state,
  onChange,
}: {
  state: SalesFormState;
  onChange: (prices: Record<string, SalesMoney[]>) => void;
}) {
  const expected = new Map<string, bigint>();
  let error = '';
  try {
    const payload = salesPayload(state);
    for (const p of payload.priceComponents)
      expected.set(
        p.currencyCode,
        (expected.get(p.currencyCode) ?? 0n) +
          moneyUnits(p.amount) * (p.type === 'DISCOUNT' ? -1n : 1n),
      );
    validatePassengerPackagePrices(
      payload.passengers,
      payload.priceComponents,
      true,
    );
  } catch (reason) {
    error = reason instanceof Error ? reason.message : 'قیمت‌ها را کامل کنید.';
  }
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h3 className="font-bold">مبلغ کل خدمات هر مسافر</h3>
      <p className="text-sm text-muted-foreground">
        مبلغ توافقی کل پکیج هر نفر را بنویسید، نه فقط بلیت. جمع ردیف‌ها باید با
        مبلغ توافقی خدمات بالا برابر باشد. برای مسافر رایگان صفر وارد کنید.
      </p>
      {!expected.size ? (
        <p className="text-sm">
          ابتدا قیمت خدمات را کامل کنید. خدمات رایگان مبلغی ندارند.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="p-2 text-right">مسافر</th>
                {[...expected.keys()].map((code) => (
                  <th key={code} className="p-2">
                    کل خدمات ({code})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.passengers.map((p, index) => (
                <tr key={p.customerId} className="border-b">
                  <th className="p-2 text-right font-medium">
                    {index + 1}. {p.displayName}
                  </th>
                  {[...expected.keys()].map((code) => (
                    <td key={code} className="min-w-40 p-2">
                      <MoneyInput
                        aria-label={'مبلغ کل ' + p.displayName + ' ' + code}
                        value={
                          state.passengerPrices?.[p.customerId]?.find(
                            (v) => v.currencyCode === code,
                          )?.amount ?? ''
                        }
                        placeholder="مبلغ کل"
                        onValueChange={(amount) => {
                          const current =
                            state.passengerPrices?.[p.customerId] ?? [];
                          onChange({
                            ...state.passengerPrices,
                            [p.customerId]: [
                              ...current.filter(
                                (v) =>
                                  v.currencyCode !== code &&
                                  expected.has(v.currencyCode),
                              ),
                              { currencyCode: code, amount },
                            ],
                          });
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted">
                <th className="p-2 text-right">جمع توافقی قرارداد</th>
                {[...expected].map(([code, amount]) => (
                  <td key={code} className="p-2 text-center">
                    <bdi style={{ fontFamily: 'Arial, sans-serif' }}>
                      {formatSalesMoney(moneyDecimal(amount))}
                    </bdi>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {error ? (
        <p role="status" className="text-sm text-amber-700">
          {error}
        </p>
      ) : (
        <p className="text-sm text-emerald-700">
          جمع مبلغ مسافران با قرارداد مطابقت دارد.
        </p>
      )}
    </section>
  );
}
