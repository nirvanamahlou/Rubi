'use client';
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import {
  matchingPublishedRooms,
  publishedSaleTotals,
  type PackagePublishedSaleV1,
} from '@nora/contracts';
import { salesApi } from '../api/client';
import {
  salesOutboundHotelCheckIn,
  type SalesFormState,
} from '../model/sales-form';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
import { currencySymbol } from '@/lib/currency-symbol';

export function PublishedPackageSale({
  state,
  onChange,
}: {
  state: SalesFormState;
  onChange: Dispatch<SetStateAction<SalesFormState>>;
}) {
  const [catalog, setCatalog] = useState<readonly PackagePublishedSaleV1[]>([]);
  const [loadedTourId, setLoadedTourId] = useState('');
  const [error, setError] = useState('');
  const [choices, setChoices] = useState<Record<number, string>>({});
  const tourId = state.tour?.id ?? '';
  useEffect(() => {
    let alive = true;
    if (!tourId) return;
    void salesApi
      .publishedPackageSales(tourId)
      .then((r) => {
        if (alive) {
          setCatalog(r.data);
          setLoadedTourId(tourId);
          setError('');
          onChange((current) =>
            current.tour?.id === tourId
              ? {
                  ...current,
                  packageSaleAvailable: r.data.length > 0,
                  serviceKinds:
                    r.data.length && !current.serviceKinds.includes('HOTEL')
                      ? [...current.serviceKinds, 'HOTEL']
                      : current.serviceKinds,
                  ...(r.data[0]
                    ? {
                        hotel: {
                          ...current.hotel,
                          ...(current.hotel.checkInManual === false
                            ? {
                                checkIn:
                                  salesOutboundHotelCheckIn(current) ||
                                  r.data[0].checkIn,
                              }
                            : {}),
                          ...(current.hotel.checkOutManual === false
                            ? { checkOut: r.data[0].checkOut }
                            : {}),
                        },
                      }
                    : {}),
                  publishedPackageHotelIds: r.data.length
                    ? [...new Set(r.data.map((p) => p.hotelId))]
                    : undefined,
                }
              : current,
          );
        }
      })
      .catch((e) => {
        if (alive) {
          setCatalog([]);
          setError(e instanceof Error ? e.message : 'قیمت فروش معتبر نیست.');
        }
      });
    return () => {
      alive = false;
    };
  }, [tourId, onChange]);
  const rooms = state.hotel.rooms ?? [];
  const matches = rooms.map((room) =>
    room.childAges.some((a) => a === null)
      ? []
      : matchingPublishedRooms(loadedTourId === tourId ? catalog : [], {
          ...room,
          childAges: room.childAges as number[],
          hotelId: state.hotel.hotelId,
          checkIn: state.hotel.checkIn,
          checkOut: state.hotel.checkOut,
        }),
  );
  const selected = matches.map((rows, index) =>
    rows.length === 1
      ? rows[0]
      : rows.find(
          (r) =>
            JSON.stringify([r.publicationId, r.roomCode]) === choices[index],
        ),
  );
  const complete = !!tourId && rooms.length > 0 && selected.every(Boolean);
  const snapshot = complete
    ? {
        tourDepartureId: tourId,
        selectionKey: JSON.stringify([
          tourId,
          state.hotel.hotelId,
          state.hotel.checkIn,
          state.hotel.checkOut,
          rooms.map((r) => [r.roomTypeId, r.adults, r.childAges]),
        ]),
        items: selected.map((r) => ({
          publicationId: r!.publicationId,
          roomCode: r!.roomCode,
          prices: [...r!.prices],
        })),
        prices: publishedSaleTotals(selected as PackagePublishedSaleV1[]),
      }
    : undefined;
  const signature = JSON.stringify(snapshot);
  useEffect(() => {
    onChange((current) => {
      if (JSON.stringify(current.packageSaleQuote) === signature)
        return current;
      if (!snapshot) return { ...current, packageSaleQuote: undefined };
      const followed =
        !current.contractPrices?.length ||
        JSON.stringify(current.contractPrices) ===
          JSON.stringify(current.packageSaleQuote?.prices);
      return {
        ...current,
        packageSaleQuote: snapshot,
        automaticComponentPricing: false,
        hotel: {
          ...current.hotel,
          rooms: (current.hotel.rooms ?? []).map((room, index) => {
            const suggested = snapshot.items[index]?.prices.find(
              (p) => p.currencyCode !== 'IRR',
            );
            const before = current.packageSaleQuote?.items[index]?.prices?.find(
              (p) => p.currencyCode === room.agreedPrice?.currencyCode,
            );
            return suggested &&
              (!room.agreedPrice || room.agreedPrice.amount === before?.amount)
              ? { ...room, agreedPrice: suggested }
              : room;
          }),
        },
        ...(followed ? { contractPrices: snapshot.prices } : {}),
      };
    });
    // Snapshot contains every quote input; negotiated values are deliberately independent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, onChange]);
  if (!tourId) return null;
  return (
    <section className="grid gap-2 rounded-xl border p-3">
      <h3 className="font-bold">قیمت منتشرشده پکیج</h3>
      {error && <p role="alert">{error}</p>}
      {matches.map((rows, index) =>
        rows.length > 1 ? (
          <NativeSearchSelect
            key={index}
            aria-label={`قیمت پکیج اتاق ${index + 1}`}
            value={choices[index] ?? ''}
            onChange={(e) =>
              setChoices({ ...choices, [index]: e.target.value })
            }
          >
            <option value="">انتخاب تعرفه پکیج</option>
            {rows.map((row) => (
              <option
                key={JSON.stringify([row.publicationId, row.roomCode])}
                value={JSON.stringify([row.publicationId, row.roomCode])}
              >
                {row.roomTypeName} ·{' '}
                {row.prices
                  .map((p) => p.amount + ' ' + currencySymbol(p.currencyCode))
                  .join(' + ')}
              </option>
            ))}
          </NativeSearchSelect>
        ) : null,
      )}
      {snapshot ? (
        snapshot.prices.map((p) => (
          <p key={p.currencyCode}>
            {p.amount} {currencySymbol(p.currencyCode)}
          </p>
        ))
      ) : (
        <p>برای ترکیب انتخاب‌شده قیمت منتشرشده موجود نیست.</p>
      )}
    </section>
  );
}
