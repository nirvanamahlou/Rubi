'use client';
import {
  defaultSalesRoomCategory,
  salesRoomCategories,
  salesRoomCategoryLabel,
  salesHotelRoomSummary,
  type SalesHotelSelectionInput,
  type SalesHotelRoomV1,
  type MasterDataRecord,
} from '@nora/contracts';
import { SearchableReference } from '@/modules/sales/components/searchable-reference';
import { SalesThemedSelect } from '@/modules/sales/components/sales-themed-select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form-controls';
import { MoneyInput } from '@/components/ui/money-input';
import {
  SalesCurrencySelect,
  type SalesCurrency,
} from '@/modules/sales/components/sales-currency-select';

export function updateAmendmentRooms(
  hotel: SalesHotelSelectionInput,
  rooms: readonly SalesHotelRoomV1[],
): SalesHotelSelectionInput {
  const ordered = rooms.map((r, i) => ({
    ...r,
    ordinal: i + 1,
    roomCategory: defaultSalesRoomCategory(r),
  }));
  return {
    ...hotel,
    rooms: ordered,
    ...salesHotelRoomSummary(ordered),
    roomTypeId: ordered[0]?.roomTypeId ?? '',
  };
}

export function AmendmentHotelRooms({
  hotel,
  roomTypes,
  currencies,
  onChange,
}: {
  hotel: SalesHotelSelectionInput;
  roomTypes: readonly MasterDataRecord[];
  currencies: readonly SalesCurrency[];
  onChange: (hotel: SalesHotelSelectionInput) => void;
}) {
  const rooms = hotel.rooms ?? [];
  if (!rooms.length)
    return (
      <div className="grid gap-2">
        <SearchableReference
          label="نوع اتاق"
          value={hotel.roomTypeId}
          options={roomTypes}
          preferEnglishName
          showAllOptionsOnOpen
          onChange={(roomTypeId) => onChange({ ...hotel, roomTypeId })}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange(
              updateAmendmentRooms(
                hotel,
                Array.from(
                  { length: Math.max(1, Math.min(50, hotel.roomCount)) },
                  (_, i) => ({
                    ordinal: i + 1,
                    roomTypeId: hotel.roomTypeId,
                    roomTypeNameSnapshot:
                      roomTypes.find((r) => r.id === hotel.roomTypeId)?.name ??
                      '',
                    adults: 1,
                    childAges: [],
                  }),
                ),
              ),
            )
          }
        >
          تنظیم ترکیب اتاق‌ها
        </Button>
      </div>
    );
  return (
    <div className="grid gap-3 md:col-span-3">
      {rooms.map((room, i) => {
        const update = (patch: Partial<SalesHotelRoomV1>) =>
          onChange(
            updateAmendmentRooms(
              hotel,
              rooms.map((r, index) => (index === i ? { ...r, ...patch } : r)),
            ),
          );
        const options =
          roomTypes.some((r) => r.id === room.roomTypeId) || !room.roomTypeId
            ? roomTypes
            : [
                ...roomTypes,
                {
                  id: room.roomTypeId,
                  name: room.roomTypeNameSnapshot,
                  code: '',
                },
              ];
        return (
          <div
            key={room.ordinal}
            className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2"
          >
            <b className="sm:col-span-2">اتاق {i + 1}</b>
            <SearchableReference
              label="نوع اتاق"
              value={room.roomTypeId}
              options={options}
              preferEnglishName
              showAllOptionsOnOpen
              onChange={(roomTypeId) =>
                update({
                  roomTypeId,
                  roomTypeNameSnapshot:
                    options.find((r) => r.id === roomTypeId)?.name ?? '',
                })
              }
            />
            <label>
              دسته‌بندی اتاق
              <SalesThemedSelect
                label="دسته‌بندی اتاق"
                value={defaultSalesRoomCategory(room) ?? ''}
                options={salesRoomCategories(
                  room.adults,
                  room.childAges.length,
                ).map((value) => ({
                  value,
                  label: salesRoomCategoryLabel(value, room.adults),
                }))}
                onValueChange={(value) =>
                  update({
                    roomCategory: value as SalesHotelRoomV1['roomCategory'],
                  })
                }
              />
            </label>
            <label>
              تعداد بزرگسال اتاق
              <Input
                type="number"
                min={1}
                max={20}
                value={room.adults}
                onChange={(e) => update({ adults: Number(e.target.value) })}
              />
            </label>
            <div className="grid gap-2">
              <span>سن کودکان اتاق</span>
              {room.childAges.map((age, childIndex) => (
                <div className="flex gap-2" key={childIndex}>
                  <Input
                    type="number"
                    min={0}
                    max={14}
                    aria-label={`سن کودک ${childIndex + 1} اتاق ${i + 1}`}
                    value={age}
                    onChange={(e) =>
                      update({
                        childAges: room.childAges.map((v, j) =>
                          j === childIndex ? Number(e.target.value) : v,
                        ),
                      })
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      update({
                        childAges: room.childAges.filter(
                          (_, j) => j !== childIndex,
                        ),
                      })
                    }
                  >
                    حذف کودک
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                disabled={room.childAges.length >= 20}
                onClick={() => update({ childAges: [...room.childAges, 2] })}
              >
                افزودن کودک
              </Button>
            </div>
            {rooms.some((r) => r.agreedPrice) && (
              <>
                <label>
                  قیمت اتاق
                  <MoneyInput
                    value={room.agreedPrice?.amount ?? ''}
                    onValueChange={(amount) =>
                      update({
                        agreedPrice: {
                          amount,
                          currencyCode: room.agreedPrice?.currencyCode ?? '',
                        },
                      })
                    }
                  />
                </label>
                <SalesCurrencySelect
                  label="ارز"
                  currencies={currencies}
                  value={room.agreedPrice?.currencyCode ?? ''}
                  onChange={(currencyCode) =>
                    update({
                      agreedPrice: {
                        currencyCode,
                        amount: room.agreedPrice?.amount ?? '',
                      },
                    })
                  }
                />
              </>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={rooms.length < 2}
              onClick={() =>
                onChange(
                  updateAmendmentRooms(
                    hotel,
                    rooms.filter((_, index) => index !== i),
                  ),
                )
              }
            >
              حذف اتاق
            </Button>
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        disabled={rooms.length >= 50}
        onClick={() =>
          onChange(
            updateAmendmentRooms(hotel, [
              ...rooms,
              {
                ordinal: rooms.length + 1,
                roomTypeId: '',
                roomTypeNameSnapshot: '',
                adults: 1,
                childAges: [],
              },
            ]),
          )
        }
      >
        افزودن اتاق
      </Button>
    </div>
  );
}
