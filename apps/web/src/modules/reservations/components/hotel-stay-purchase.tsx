'use client';
import { useCallback, useRef, useState } from 'react';
import {
  moneyUnits,
  moneyDecimal,
  hotelNights,
  hotelRoomQuotationTotal,
  reservationHotelStays,
  reservationHotelTransferKeys,
  reservationServicePurchaseTotal,
  type ReservationIntakeV1,
  type TravelWorkflowStateV1,
  type VoucherSettingsV1,
  type ReservationPurchaseBatchInputV1,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { PurchaseFxRate } from '@/modules/finance/purchase-fx/purchase-fx';
import { ContractProfit } from '@/modules/finance/components/contract-profit';
import { useAccessPermissions } from '@/modules/iam/access-context';
import { hotelFormScope } from '../model/hotel-form-scope';
import { defaultSupplierFormSettings } from '../model/voucher-settings';
import { HotelRoomQuotationEditor } from './hotel-room-quotation-editor';
import { ReservationPurchaseBrokerLookup } from './reservation-purchase-broker-lookup';
import { useReservationCurrencies } from './reservation-currencies';
import type { Option } from '../hotel-rates/controls';
type Request = ReservationIntakeV1 & {
  workflow?: TravelWorkflowStateV1 | null;
};
export function HotelStayPurchases({
  request,
  onSaved,
}: {
  request: Request;
  onSaved: () => void;
}) {
  const canProfit = useAccessPermissions()?.includes('finance.read');
  const totals = new Map<string, bigint>();
  for (const purchase of request.servicePurchases ?? []) {
    if (!['HOTEL', 'TRANSFER'].includes(purchase.serviceKind)) continue;
    totals.set(
      purchase.currencyCode,
      (totals.get(purchase.currencyCode) ?? 0n) + moneyUnits(purchase.amount),
    );
  }
  return (
    <div className="grid gap-4">
      {reservationHotelStays(request.snapshot).map((stay) => (
        <HotelStayPurchase
          key={stay.key + ':' + request.purchaseVersion}
          request={request}
          stayKey={stay.key}
          onSaved={onSaved}
        />
      ))}
      {!!totals.size && (
        <section className="rounded-xl border border-border p-3">
          <h3>جمع خریدهای ثبت‌شده هتل‌ها و ترانسفر</h3>
          {[...totals].map(([currency, units]) => (
            <p key={currency}>
              <bdi>
                {moneyDecimal(units)} {currency}
              </bdi>
            </p>
          ))}
        </section>
      )}
      {canProfit && <ContractProfit id={request.contractId} />}
    </div>
  );
}
export function HotelStayPurchase({
  request,
  stayKey,
  onSaved,
}: {
  request: Request;
  stayKey: string;
  onSaved: () => void;
}) {
  const scoped = hotelFormScope(
    {
      ...request,
      workflow:
        request.workflow ??
        ({
          roomOrder: [],
          ageOverrides: {},
          note: '',
        } as unknown as TravelWorkflowStateV1),
    },
    stayKey,
  );
  const quote = defaultSupplierFormSettings(scoped, {});
  const hotel = {
    ...scoped.snapshot.hotelSelection!,
    rooms: quote.rooms?.length
      ? quote.rooms.map((room) => ({ ...room, roomTypeId: '' }))
      : scoped.snapshot.hotelSelection!.rooms,
    checkInDate:
      quote.text.checkIn || scoped.snapshot.hotelSelection!.checkInDate,
    checkOutDate:
      quote.text.checkOut || scoped.snapshot.hotelSelection!.checkOutDate,
  };
  const transferKeys = reservationHotelTransferKeys(request.snapshot, stayKey);
  const purchase = request.servicePurchases?.find(
    (p) => p.serviceClientKey === stayKey,
  );
  const transfer = request.servicePurchases?.find(
    (p) => p.serviceClientKey === transferKeys[0],
  );
  const [draft, setDraft] = useState<VoucherSettingsV1>(() => ({
    ...quote,
    ...(purchase?.roomPrices
      ? {
          hotelRoomPrices: {
            currencyCode: purchase.currencyCode,
            rooms: [...purchase.roomPrices],
          },
        }
      : {}),
    ...(transfer?.pricingCalculation
      ? {
          supplierFormPrices: {
            ...quote.supplierFormPrices,
            transferPp: {
              amount: transfer.pricingCalculation.baseAmount,
              currencyCode: transfer.currencyCode,
            },
          },
          hotelTransferCounts: {
            outbound:
              transfer.hotelTransferCounts?.outbound ??
              transfer.pricingCalculation.chargeablePassengerCount ??
              0,
            returning: transfer.hotelTransferCounts?.returning ?? 0,
          },
        }
      : {}),
  }));
  const [broker, setBroker] = useState<Option | null>(
    purchase
      ? { id: purchase.supplierOrganizationId, name: purchase.supplierName }
      : quote.brokerId
        ? { id: quote.brokerId, name: quote.text.broker }
        : null,
  );
  const [transferBroker, setTransferBroker] = useState<Option | null>(
    transfer
      ? { id: transfer.supplierOrganizationId, name: transfer.supplierName }
      : quote.transferBrokerId
        ? { id: quote.transferBrokerId, name: quote.transferBrokerName ?? '' }
        : null,
  );
  const currencies = useReservationCurrencies(request.id);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const [rates, setRates] = useState<Record<string, string>>({});
  const updateRate = useCallback(
    (code: string, rate: string) =>
      setRates((old) => ({ ...old, [code]: rate })),
    [],
  );
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  let nights = 0;
  try {
    nights = hotelNights(hotel.checkInDate, hotel.checkOutDate);
  } catch {
    /* Validated on save. */
  }
  async function save() {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      if (
        !broker ||
        !draft.hotelRoomPrices ||
        !currencies.currencies.some(
          (c) => c.code === draft.hotelRoomPrices!.currencyCode,
        )
      )
        throw Error('کارگزار، ارز و قیمت همه اتاق‌ها را تکمیل کنید.');
      const count =
        (draft.hotelTransferCounts?.outbound ?? 0) +
        (draft.hotelTransferCounts?.returning ?? 0);
      const trf = draft.supplierFormPrices?.transferPp;
      if (
        !trf ||
        !currencies.currencies.some((c) => c.code === trf.currencyCode) ||
        !Number.isSafeInteger(count) ||
        count < 0
      )
        throw Error(
          'قیمت، ارز و تعداد ترانسفر همین هتل را تکمیل کنید؛ صفر مجاز است.',
        );
      const hotelAmount = hotelRoomQuotationTotal(
        draft.hotelRoomPrices.rooms,
        nights,
        (hotel.rooms ?? []).map((room) => room.ordinal),
      );
      const transferAmount =
        count === 0
          ? '0'
          : reservationServicePurchaseTotal(trf.amount, String(count), 1);
      // A blank rate must never become an invented zero even when count is zero.
      reservationServicePurchaseTotal(trf.amount, '1', 1);
      const fx = (code: string) =>
        rates[code] ? { purchaseRateToIrr: rates[code] } : {};
      const body: ReservationPurchaseBatchInputV1 = {
        version: 1,
        expectedVersion: request.purchaseVersion ?? 0,
        hotelStayKey: stayKey,
        supplierFormVersion: request.workflow?.version ?? 0,
        hotelTransferCounts: draft.hotelTransferCounts ?? {
          outbound: 0,
          returning: 0,
        },
        purchases: [
          {
            serviceClientKey: stayKey,
            coveredServiceClientKeys: [stayKey],
            supplierOrganizationId: broker.id,
            currencyCode: draft.hotelRoomPrices.currencyCode,
            amount: hotelAmount,
            roomPrices: draft.hotelRoomPrices.rooms,
            ...fx(draft.hotelRoomPrices.currencyCode),
          },
          {
            serviceClientKey: transferKeys[0]!,
            coveredServiceClientKeys: transferKeys,
            supplierOrganizationId: (transferBroker ?? broker).id,
            currencyCode: trf.currencyCode,
            amount: transferAmount,
            pricingCalculation: {
              baseAmount: trf.amount,
              factor: count ? String(count) : '1',
              chargeablePassengerCount: count,
            },
            ...fx(trf.currencyCode),
          },
        ],
      };
      const payload = JSON.stringify(body),
        base = getPublicApiBaseUrl();
      if (!base) throw Error('نشانی سرور تنظیم نشده است.');
      if (attempt.current?.payload !== payload)
        attempt.current = { payload, key: crypto.randomUUID() };
      const send = () =>
        fetch(
          base +
            '/reservations/requests/' +
            encodeURIComponent(request.id) +
            '/purchase-batches',
          {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Idempotency-Key': attempt.current!.key,
            },
            body: payload,
          },
        );
      let response = await send();
      if (response.status === 401 && (await refreshAuthenticatedSession(base)))
        response = await send();
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw Error(
          result?.message || result?.error?.message || 'ثبت خرید انجام نشد.',
        );
      }
      setMessage('خرید هتل و ترانسفر آن ثبت شد.');
      onSaved();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'ثبت خرید انجام نشد.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="grid gap-3 rounded-xl border border-border p-4">
      <h3 className="font-bold">خرید اقامت · {hotel.hotelNameSnapshot}</h3>
      <p>
        {hotel.checkInDate} — {hotel.checkOutDate} · {nights} شب
      </p>
      <p>
        قیمت فرم پیشنهاد کارگزار است. تغییر این پیش‌نویس تا ثبت خرید، هزینه‌ای
        ایجاد نمی‌کند.
      </p>
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => {
          setDraft(quote);
          setTransferBroker(
            quote.transferBrokerId
              ? {
                  id: quote.transferBrokerId,
                  name: quote.transferBrokerName ?? '',
                }
              : null,
          );
          setBroker(
            quote.brokerId
              ? { id: quote.brokerId, name: quote.text.broker }
              : null,
          );
        }}
      >
        بارگذاری قیمت پیشنهادی فرم
      </Button>
      <ReservationPurchaseBrokerLookup
        requestId={request.id}
        label="کارگزار خرید هتل"
        value={broker}
        onChange={setBroker}
      />
      <HotelRoomQuotationEditor
        draft={draft}
        update={setDraft}
        currencies={currencies.currencies}
        busy={busy || currencies.loading}
        nights={nights}
      />
      <ReservationPurchaseBrokerLookup
        requestId={request.id}
        label="کارگزار ترانسفر"
        value={transferBroker ?? broker}
        onChange={setTransferBroker}
      />
      {[
        ...new Set(
          [
            draft.hotelRoomPrices?.currencyCode,
            draft.supplierFormPrices?.transferPp?.currencyCode,
          ].filter((code): code is string => !!code),
        ),
      ].map((code) => (
        <PurchaseFxRate
          key={code}
          currencyCode={code}
          value={rates[code] ?? ''}
          onChange={updateRate}
        />
      ))}
      {currencies.error && <p role="alert">{currencies.error}</p>}
      {message && <p role="status">{message}</p>}
      <Button
        disabled={busy || currencies.loading || !!currencies.error}
        onClick={() => void save()}
      >
        ثبت خرید این هتل و ترانسفر
      </Button>
      {purchase?.roomPurchase && (
        <div className="overflow-x-auto">
          <p>
            اقامت خرید ثبت‌شده: {purchase.roomPurchase.checkInDate} —{' '}
            {purchase.roomPurchase.checkOutDate}
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>اتاق</th>
                <th>نوع اتاق</th>
                <th>Hotel P.P</th>
                <th>Ratio</th>
                <th>شب</th>
                <th>خرید ثبت‌شده</th>
              </tr>
            </thead>
            <tbody>
              {purchase.roomPurchase.rooms.map((room) => (
                <tr key={room.roomOrdinal}>
                  <td>{room.roomOrdinal}</td>
                  <td>{room.roomTypeNameSnapshot}</td>
                  <td>{room.baseAmount}</td>
                  <td>{room.factor}</td>
                  <td>{purchase.roomPurchase!.nights}</td>
                  <td>
                    <bdi>
                      {room.totalAmount} {purchase.currencyCode}
                    </bdi>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {purchase && (
        <p>
          خرید ثبت‌شده هتل:{' '}
          <bdi>
            {purchase.amount} {purchase.currencyCode}
          </bdi>{' '}
          · {purchase.finance.status}
        </p>
      )}
      {transfer && (
        <p>
          خرید ثبت‌شده ترانسفر:{' '}
          <bdi>
            {transfer.amount} {transfer.currencyCode}
          </bdi>{' '}
          · {transfer.finance.status}
        </p>
      )}
    </section>
  );
}
