'use client';
import {
  packageRoomIdentity,
  type PackagePublishedSaleV1,
} from '@nora/contracts';
import type { Dispatch, SetStateAction } from 'react';
import type { SalesFormState } from '../model/sales-form';
import { NativeSearchSelect } from '@/components/ui/native-search-select';

export function combinedSaleMatchesState(
  price: PackagePublishedSaleV1,
  state: SalesFormState,
) {
  if (!price.stays) return true;
  const stays = [
    {
      hotelId: state.hotel.hotelId,
      checkInDate: state.hotel.checkIn,
      checkOutDate: state.hotel.checkOut,
    },
    ...(state.hotel.additionalStays ?? []),
  ];
  return (
    stays.length === price.stays.length &&
    price.stays.every(
      (s, i) =>
        s.hotelId === stays[i]?.hotelId &&
        s.checkIn === stays[i]?.checkInDate &&
        s.checkOut === stays[i]?.checkOutDate,
    )
  );
}
export function CombinedPublishedPicker({
  catalog,
  state,
  onChange,
}: {
  catalog: readonly PackagePublishedSaleV1[];
  state: SalesFormState;
  onChange: Dispatch<SetStateAction<SalesFormState>>;
}) {
  const rows = catalog.filter((p) => p.stays?.length);
  if (!rows.length) return null;
  return (
    <div className="grid gap-3 rounded-xl border bg-secondary/20 p-3">
      <strong>انتخاب هتل‌های تور ترکیبی</strong>
      <NativeSearchSelect
        aria-label="پکیج هتل‌های تور ترکیبی"
        value={
          rows.find(
            (p) =>
              combinedSaleMatchesState(p, state) &&
              p.stays?.[0]?.roomTypeId === state.hotel.rooms?.[0]?.roomTypeId,
          )?.roomCode ?? ''
        }
        onChange={(e) => {
          const price = rows.find((p) => p.roomCode === e.target.value);
          if (!price?.stays) return;
          onChange((current) => applyCombinedPublishedSale(current, price));
        }}
      >
        <option value="">انتخاب ترکیب کامل هتل‌ها</option>
        {rows.map((p) => (
          <option key={p.publicationId + p.roomCode} value={p.roomCode}>
            {p.stays!.map((s) => s.hotelName).join(' + ')} · {p.roomTypeName} ·{' '}
            {p.prices.map((m) => m.amount + ' ' + m.currencyCode).join(' + ')}
          </option>
        ))}
      </NativeSearchSelect>
      {rows
        .find((p) => combinedSaleMatchesState(p, state))
        ?.stays?.map((s, i) => (
          <p key={i} className="text-sm">
            اقامت {i + 1} · {s.hotelName} ·{' '}
            <bdi>
              {s.checkIn} — {s.checkOut}
            </bdi>
          </p>
        ))}
    </div>
  );
}
export function applyCombinedPublishedSale(
  current: SalesFormState,
  price: PackagePublishedSaleV1,
): SalesFormState {
  const identity = packageRoomIdentity(price.roomCode),
    first = price.stays?.[0];
  if (!identity || !first || !price.stays) return current;
  const source = current.hotel.rooms?.length
    ? current.hotel.rooms
    : [
        {
          ordinal: 1,
          roomTypeId: first.roomTypeId,
          roomTypeNameSnapshot: first.roomTypeName,
          adults: identity.adults,
          childAges: identity.childAges.map(() => null),
        },
      ];
  const rooms = source.map((r) => ({
    ...r,
    roomTypeId: first.roomTypeId,
    roomTypeNameSnapshot: first.roomTypeName,
  }));
  return {
    ...current,
    packageSaleQuote: undefined,
    hotel: {
      ...current.hotel,
      hotelId: first.hotelId,
      name: first.hotelName,
      cityId: first.cityId,
      roomTypeId: first.roomTypeId,
      checkIn: first.checkIn,
      checkOut: first.checkOut,
      checkInManual: true,
      checkOutManual: true,
      multiHotel: true,
      roomCount: rooms.length,
      rooms,
      additionalStays: price.stays.slice(1).map((s) => ({
        hotelId: s.hotelId,
        hotelNameSnapshot: s.hotelName,
        cityId: s.cityId,
        checkInDate: s.checkIn,
        checkOutDate: s.checkOut,
        rooms: rooms.map((r) => ({
          ...r,
          roomTypeId: s.roomTypeId,
          roomTypeNameSnapshot: s.roomTypeName,
        })),
      })),
    },
  };
}
