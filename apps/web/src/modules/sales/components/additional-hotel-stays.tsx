'use client';
import type { MasterDataRecord } from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Input, FormField } from '@/components/ui/form-controls';
import type { SalesFormState } from '../model/sales-form';
import {
  salesHotelCalendarSystem,
  salesHotelRoomTypes,
} from '../model/sales-form';
import { SearchableReference } from './searchable-reference';
import { SalesDatePicker } from './sales-date-picker';

export function AdditionalHotelStays({
  state,
  patch,
  hotels,
  roomTypes,
}: {
  state: SalesFormState;
  patch: (patch: Partial<SalesFormState>) => void;
  hotels: readonly MasterDataRecord[];
  roomTypes: readonly MasterDataRecord[];
}) {
  if (
    !state.serviceKinds.includes('HOTEL') ||
    state.tour ||
    (!state.hotel.multiHotel && !state.hotel.additionalStays?.length)
  )
    return null;
  const stays = state.hotel.additionalStays ?? [];
  const save = (next: typeof stays) =>
    patch({
      hotel: { ...state.hotel, multiHotel: true, additionalStays: next },
    });
  return (
    <section
      className="grid gap-4 rounded-xl border p-4"
      aria-label="هتل‌های ترکیبی قرارداد"
    >
      <h3 className="font-bold">هتل‌های ترکیبی قرارداد</h3>
      {stays.map((stay, index) => {
        const update = (next: Partial<typeof stay>) =>
          save(
            stays.map((item, i) => (i === index ? { ...item, ...next } : item)),
          );
        const rooms = stay.rooms ?? [];
        const options = salesHotelRoomTypes(stay.hotelId, hotels, roomTypes);
        return (
          <section key={index} className="grid gap-3 rounded-xl border p-3">
            <div className="flex items-center justify-between">
              <b>هتل {index + 2}</b>
              <Button
                type="button"
                variant="outline"
                onClick={() => save(stays.filter((_, i) => i !== index))}
              >
                حذف هتل
              </Button>
            </div>
            <SearchableReference
              label="هتل"
              value={stay.hotelId}
              options={hotels.filter(
                (h) =>
                  h.id !== state.hotel.hotelId &&
                  !stays.some(
                    (other, i) => i !== index && other.hotelId === h.id,
                  ),
              )}
              showAllOptionsOnOpen
              preferEnglishName
              onChange={(id) => {
                const hotel = hotels.find((h) => h.id === id);
                update({
                  hotelId: id,
                  hotelNameSnapshot: hotel?.name ?? '',
                  cityId: String(hotel?.attributes.cityId ?? ''),
                  rooms: [],
                });
              }}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {(['checkInDate', 'checkOutDate'] as const).map((field) => (
                <FormField
                  key={field}
                  label={
                    field === 'checkInDate' ? 'ورود (چک‌این)' : 'خروج (چک‌اوت)'
                  }
                  required
                >
                  <SalesDatePicker
                    calendarSystem={salesHotelCalendarSystem(state)}
                    value={stay[field]}
                    onChange={(value) => update({ [field]: value })}
                  />
                </FormField>
              ))}
            </div>
            {rooms.map((room, roomIndex) => {
              const change = (next: Partial<typeof room>) =>
                update({
                  rooms: rooms.map((r, i) =>
                    i === roomIndex ? { ...r, ...next } : r,
                  ),
                });
              return (
                <div
                  key={room.ordinal}
                  className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2"
                >
                  <SearchableReference
                    label="نوع اتاق"
                    value={room.roomTypeId}
                    options={options}
                    showAllOptionsOnOpen
                    preferEnglishName
                    onChange={(id) =>
                      change({
                        roomTypeId: id,
                        roomTypeNameSnapshot:
                          options.find((r) => r.id === id)?.name ?? '',
                      })
                    }
                  />
                  <FormField label="بزرگسال">
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={room.adults}
                      onChange={(e) =>
                        change({ adults: Number(e.target.value) })
                      }
                    />
                  </FormField>
                  <FormField label="تعداد کودک / نوزاد">
                    <Input
                      type="number"
                      min={0}
                      max={20}
                      value={room.childAges.length}
                      onChange={(e) =>
                        change({
                          childAges: Array.from(
                            {
                              length: Math.max(
                                0,
                                Math.min(20, Number(e.target.value) || 0),
                              ),
                            },
                            (_, i) => room.childAges[i] ?? 0,
                          ),
                        })
                      }
                    />
                  </FormField>
                  {room.childAges.map((age, childIndex) => (
                    <FormField
                      key={childIndex}
                      label={`سن کودک / نوزاد ${childIndex + 1}`}
                    >
                      <Input
                        type="number"
                        min={0}
                        max={14}
                        value={age}
                        onChange={(e) =>
                          change({
                            childAges: room.childAges.map((old, i) =>
                              i === childIndex ? Number(e.target.value) : old,
                            ),
                          })
                        }
                      />
                    </FormField>
                  ))}
                  <p>تعداد نفرات اتاق: {room.adults + room.childAges.length}</p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      update({
                        rooms: rooms
                          .filter((_, i) => i !== roomIndex)
                          .map((r, i) => ({ ...r, ordinal: i + 1 })),
                      })
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
              disabled={!stay.hotelId || rooms.length >= 50}
              onClick={() =>
                update({
                  rooms: [
                    ...rooms,
                    {
                      ordinal: rooms.length + 1,
                      roomTypeId: '',
                      roomTypeNameSnapshot: '',
                      adults: 1,
                      childAges: [],
                    },
                  ],
                })
              }
            >
              افزودن اتاق
            </Button>
            <p>
              مجموع مهمانان هتل:{' '}
              {rooms.reduce(
                (n, room) => n + room.adults + room.childAges.length,
                0,
              )}
            </p>
          </section>
        );
      })}
      <Button
        type="button"
        variant="outline"
        disabled={stays.length >= 49}
        onClick={() =>
          save([
            ...stays,
            {
              hotelId: '',
              hotelNameSnapshot: '',
              cityId: '',
              checkInDate: '',
              checkOutDate: '',
              rooms: [],
            },
          ])
        }
      >
        افزودن هتل
      </Button>
    </section>
  );
}
