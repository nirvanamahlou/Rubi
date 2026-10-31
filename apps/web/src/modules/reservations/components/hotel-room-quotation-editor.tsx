'use client';
import {
  hotelRoomQuotationTotal,
  reservationServicePurchaseTotal,
  type VoucherSettingsV1,
} from '@nora/contracts';
import { ReservationPurchaseBrokerLookup } from './reservation-purchase-broker-lookup';
import { MoneyInput } from '@/components/ui/money-input';
import { Input } from '@/components/ui/form-controls';
import { ReservationCurrencySelect } from './reservation-currencies';
export function HotelRoomQuotationEditor({
  draft,
  requestId,
  update,
  currencies,
  busy,
  canSplitTransfers = true,
  nights,
}: {
  draft: VoucherSettingsV1;
  requestId: string;
  update: (value: VoucherSettingsV1) => void;
  currencies: readonly { code: string; name: string }[];
  busy: boolean;
  canSplitTransfers?: boolean;
  nights: number;
}) {
  const rooms = draft.rooms ?? [];
  const prices =
    draft.hotelRoomPrices?.rooms ??
    rooms.map((room) => ({
      roomOrdinal: room.ordinal,
      baseAmount: '',
      factor: '1',
    }));
  const currencyCode = draft.hotelRoomPrices?.currencyCode ?? '';
  const transfer = draft.supplierFormPrices?.transferPp ?? {
    amount: '',
    currencyCode: '',
  };
  const counts = draft.hotelTransferCounts ?? { outbound: 0, returning: 0 };
  const total = (base: string, factor: string) => {
    try {
      return reservationServicePurchaseTotal(base, factor, nights);
    } catch {
      return '—';
    }
  };
  let sum = '—';
  try {
    sum = hotelRoomQuotationTotal(
      prices,
      nights,
      rooms.map((room) => room.ordinal),
    );
  } catch {
    /* Incomplete draft. */
  }
  let transferTotal = '—';
  try {
    if (transfer.amount && transfer.currencyCode)
      transferTotal =
        (draft.hotelTransferSplit
          ? counts.outbound
          : counts.outbound + counts.returning) === 0
          ? '0'
          : reservationServicePurchaseTotal(
              transfer.amount,
              String(
                draft.hotelTransferSplit
                  ? counts.outbound
                  : counts.outbound + counts.returning,
              ),
              1,
            );
  } catch {
    /* Incomplete draft. */
  }
  let returnTotal = '—';
  try {
    const price = draft.hotelTransferReturn;
    if (price?.amount && price.currencyCode) {
      reservationServicePurchaseTotal(price.amount, '1', 1);
      returnTotal = counts.returning
        ? reservationServicePurchaseTotal(
            price.amount,
            String(counts.returning),
            1,
          )
        : '0';
    }
  } catch {
    /* Incomplete return draft. */
  }
  return (
    <div className="grid gap-3">
      <ReservationCurrencySelect
        label="ارز خرید هتل"
        value={currencyCode}
        currencies={currencies}
        disabled={busy}
        onChange={(currencyCode) =>
          update({ ...draft, hotelRoomPrices: { currencyCode, rooms: prices } })
        }
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th>اتاق</th>
              <th>نوع اتاق</th>
              <th>Hotel P.P</th>
              <th>Ratio</th>
              <th>تعداد شب</th>
              <th>قیمت پیشنهادی خرید</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => {
              const price = prices.find(
                (price) => price.roomOrdinal === room.ordinal,
              ) ?? { roomOrdinal: room.ordinal, baseAmount: '', factor: '1' };
              const change = (patch: Partial<typeof price>) =>
                update({
                  ...draft,
                  hotelRoomPrices: {
                    currencyCode,
                    rooms: rooms.map((row) =>
                      row.ordinal === room.ordinal
                        ? { ...price, ...patch }
                        : (prices.find(
                            (p) => p.roomOrdinal === row.ordinal,
                          ) ?? {
                            roomOrdinal: row.ordinal,
                            baseAmount: '',
                            factor: '1',
                          }),
                    ),
                  },
                });
              return (
                <tr key={room.ordinal}>
                  <td>{room.ordinal}</td>
                  <td>{room.roomTypeNameSnapshot}</td>
                  <td>
                    <MoneyInput
                      aria-label={'Hotel P.P اتاق ' + room.ordinal}
                      value={price.baseAmount}
                      disabled={busy}
                      onValueChange={(baseAmount) => change({ baseAmount })}
                    />
                  </td>
                  <td>
                    <MoneyInput
                      aria-label={'Ratio اتاق ' + room.ordinal}
                      value={price.factor}
                      disabled={busy}
                      onValueChange={(factor) => change({ factor })}
                    />
                  </td>
                  <td>{nights}</td>
                  <td dir="ltr">
                    {total(price.baseAmount, price.factor)} {currencyCode}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p>
        جمع پیشنهادی خرید هتل:{' '}
        <bdi>
          {sum} {currencyCode}
        </bdi>
      </p>
      <fieldset className="grid gap-2 rounded-xl border border-border p-3">
        <legend>ترانسفر مستقل این هتل</legend>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            disabled={busy}
            checked={draft.hotelTransferSeparate ?? false}
            onChange={(event) =>
              update({
                ...draft,
                hotelTransferSeparate: event.target.checked,
                ...(!event.target.checked ? { hotelTransferSplit: false } : {}),
              })
            }
          />
          ترانسفر از کارگزار دیگر
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            disabled={busy || !canSplitTransfers}
            checked={draft.hotelTransferSplit ?? false}
            onChange={(event) =>
              update({
                ...draft,
                hotelTransferSplit: event.target.checked,
                ...(event.target.checked
                  ? {
                      hotelTransferSeparate: true,
                      hotelTransferReturn: draft.hotelTransferReturn ?? {
                        amount: transfer.amount,
                        currencyCode: transfer.currencyCode,
                      },
                    }
                  : {}),
              })
            }
          />
          کارگزار رفت و برگشت جدا
        </label>
        {(draft.hotelTransferSeparate ?? false) && (
          <ReservationPurchaseBrokerLookup
            requestId={requestId}
            label={
              draft.hotelTransferSplit
                ? 'کارگزار ترانسفر رفت'
                : 'کارگزار ترانسفر'
            }
            value={
              draft.transferBrokerId
                ? {
                    id: draft.transferBrokerId,
                    name: draft.transferBrokerName ?? '',
                  }
                : null
            }
            onChange={(value) => {
              const next = { ...draft };
              if (value) {
                next.transferBrokerId = value.id;
                next.transferBrokerName = value.name;
              } else {
                delete next.transferBrokerId;
                delete next.transferBrokerName;
              }
              update(next);
            }}
          />
        )}

        <MoneyInput
          aria-label="Transfer P.P"
          value={transfer.amount}
          disabled={busy}
          onValueChange={(amount) =>
            update({
              ...draft,
              supplierFormPrices: {
                ...draft.supplierFormPrices,
                transferPp: { ...transfer, amount },
              },
            })
          }
        />
        <ReservationCurrencySelect
          label="ارز ترانسفر"
          value={transfer.currencyCode}
          currencies={currencies}
          disabled={busy}
          onChange={(currencyCode) =>
            update({
              ...draft,
              supplierFormPrices: {
                ...draft.supplierFormPrices,
                transferPp: { ...transfer, currencyCode },
              },
            })
          }
        />
        {(['outbound', 'returning'] as const).map((key) => (
          <label key={key}>
            {key === 'outbound' ? 'تعداد ترانسفر رفت' : 'تعداد ترانسفر برگشت'}
            <Input
              type="number"
              min="0"
              max="500"
              step="1"
              disabled={busy}
              value={counts[key]}
              onChange={(event) =>
                update({
                  ...draft,
                  hotelTransferCounts: {
                    ...counts,
                    [key]: Number(event.target.value),
                  },
                })
              }
            />
          </label>
        ))}

        {draft.hotelTransferSplit && (
          <fieldset className="grid gap-2 rounded-xl border p-3">
            <legend>ترانسفر برگشت</legend>
            <p>
              جمع ترانسفر برگشت:{' '}
              <bdi>
                {returnTotal} {draft.hotelTransferReturn?.currencyCode}
              </bdi>
            </p>
            <ReservationPurchaseBrokerLookup
              requestId={requestId}
              label="کارگزار ترانسفر برگشت"
              value={
                draft.hotelTransferReturn?.brokerId
                  ? {
                      id: draft.hotelTransferReturn.brokerId,
                      name: draft.hotelTransferReturn.brokerName ?? '',
                    }
                  : null
              }
              onChange={(value) => {
                const next = {
                  amount: '',
                  currencyCode: '',
                  ...draft.hotelTransferReturn,
                };
                if (value) {
                  next.brokerId = value.id;
                  next.brokerName = value.name;
                } else {
                  delete next.brokerId;
                  delete next.brokerName;
                }
                update({ ...draft, hotelTransferReturn: next });
              }}
            />
            <MoneyInput
              aria-label="Transfer P.P برگشت"
              value={draft.hotelTransferReturn?.amount ?? ''}
              disabled={busy}
              onValueChange={(amount) =>
                update({
                  ...draft,
                  hotelTransferReturn: {
                    currencyCode: '',
                    ...draft.hotelTransferReturn,
                    amount,
                  },
                })
              }
            />
            <ReservationCurrencySelect
              label="ارز ترانسفر برگشت"
              value={draft.hotelTransferReturn?.currencyCode ?? ''}
              currencies={currencies}
              disabled={busy}
              onChange={(currencyCode) =>
                update({
                  ...draft,
                  hotelTransferReturn: {
                    amount: '',
                    ...draft.hotelTransferReturn,
                    currencyCode,
                  },
                })
              }
            />
          </fieldset>
        )}
        <p>
          {draft.hotelTransferSplit ? 'جمع ترانسفر رفت:' : 'جمع ترانسفر:'}{' '}
          <bdi>
            {transferTotal} {transfer.currencyCode}
          </bdi>
        </p>
        <p>
          مبلغ و تعداد صفر مجاز است؛ ترانسفر در تعداد اتاق و شب ضرب نمی‌شود.
        </p>
      </fieldset>
    </div>
  );
}
