'use client';
import {
  salesHotelRoomSummary,
  type SalesHotelSelectionInput,
  type SalesHotelStayInput,
  type MasterDataRecord,
} from '@nora/contracts';
import { SalesDatePicker } from '@/modules/sales/components/sales-date-picker';
import { SearchableReference } from '@/modules/sales/components/searchable-reference';
import type { SalesCurrency } from '@/modules/sales/components/sales-currency-select';
import { AmendmentHotelRooms } from './amendment-hotel-rooms';

export function updateAdditionalAmendmentStay(
  hotel: SalesHotelSelectionInput,
  index: number,
  patch: Partial<SalesHotelStayInput>,
): SalesHotelSelectionInput {
  if (!Number.isInteger(index) || index < 0 || !hotel.additionalStays?.[index])
    throw new Error('اقامت هتل انتخاب‌شده معتبر نیست.');
  return {
    ...hotel,
    additionalStays: hotel.additionalStays.map((stay, i) =>
      i === index ? { ...stay, ...patch } : stay,
    ),
  };
}

export function AmendmentAdditionalHotelStays({
  hotel,
  hotels,
  roomTypes,
  currencies,
  onChange,
}: {
  hotel: SalesHotelSelectionInput;
  hotels: readonly MasterDataRecord[];
  roomTypes: readonly MasterDataRecord[];
  currencies: readonly SalesCurrency[];
  onChange: (hotel: SalesHotelSelectionInput) => void;
}) {
  return (
    <>
      {hotel.additionalStays?.map((stay, index) => {
        const change = (patch: Partial<SalesHotelStayInput>) =>
          onChange(updateAdditionalAmendmentStay(hotel, index, patch));
        const rooms = stay.rooms ?? [];
        const selection: SalesHotelSelectionInput = {
          ...stay,
          serviceClientKey: hotel.serviceClientKey,
          inventoryStatus: hotel.inventoryStatus,
          rooms,
          roomTypeId: rooms[0]?.roomTypeId ?? '',
          ...salesHotelRoomSummary(rooms),
        };
        return (
          <fieldset
            key={index}
            className="mt-4 grid gap-3 rounded-xl border border-border p-4 md:grid-cols-3"
          >
            <legend className="px-2 font-bold">
              اقامت {index + 2} · {stay.hotelNameSnapshot}
            </legend>
            <SearchableReference
              label="هتل"
              value={stay.hotelId}
              options={hotels}
              onChange={(hotelId) => {
                const selected = hotels.find((item) => item.id === hotelId);
                if (selected)
                  change({
                    hotelId,
                    hotelNameSnapshot: selected.name,
                    cityId:
                      typeof selected.attributes.cityId === 'string'
                        ? selected.attributes.cityId
                        : stay.cityId,
                  });
              }}
            />
            <AmendmentHotelRooms
              hotel={selection}
              roomTypes={roomTypes}
              currencies={currencies}
              onChange={(next) =>
                change({
                  rooms: (next.rooms ?? []).map(
                    ({
                      ordinal,
                      roomTypeId,
                      roomTypeNameSnapshot,
                      adults,
                      childAges,
                      roomCategory,
                    }) => ({
                      ordinal,
                      roomTypeId,
                      roomTypeNameSnapshot,
                      adults,
                      childAges,
                      roomCategory,
                    }),
                  ),
                })
              }
            />
            <label>
              ورود
              <SalesDatePicker
                calendarSystem="gregorian"
                value={stay.checkInDate.slice(0, 10)}
                onChange={(checkInDate) => change({ checkInDate })}
              />
            </label>
            <label>
              خروج
              <SalesDatePicker
                calendarSystem="gregorian"
                value={stay.checkOutDate.slice(0, 10)}
                onChange={(checkOutDate) => change({ checkOutDate })}
              />
            </label>
          </fieldset>
        );
      })}
    </>
  );
}
