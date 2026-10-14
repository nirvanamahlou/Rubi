'use client';
import { SearchableReference } from './searchable-reference';
import { Input } from '@/components/ui/form-controls';
import type { MasterDataRecord, HotelRoomRateV1 } from '@nora/contracts';
import type { SalesFormState } from '../model/sales-form';
import { salesPassengerCounts } from '../model/sales-form';
export function ServiceParties({
  state,
  patch,
  hotels,
  roomTypes,
  rates,
}: {
  state: SalesFormState;
  patch: (value: Partial<SalesFormState>) => void;
  hotels: readonly MasterDataRecord[];
  roomTypes: readonly (Pick<MasterDataRecord, 'id' | 'name' | 'code'> &
    Partial<MasterDataRecord>)[];
  rates: readonly HotelRoomRateV1[];
}) {
  const rooms = state.hotel.rooms ?? [];
  const changeRooms = (next: typeof rooms) => {
    const ages = next.flatMap((r) => r.childAges);
    const composition = {
      adults:
        next.reduce((n, r) => n + r.adults, 0) +
        ages.filter((a) => a !== null && a >= 12).length,
      children: ages.filter((a) => a !== null && a >= 2 && a < 12).length,
      infants: ages.filter((a) => a !== null && a < 2).length,
    };
    patch({
      hotel: {
        ...state.hotel,
        rooms: next,
        roomCount: next.length,
        roomTypeId: next[0]?.roomTypeId ?? '',
        singleRoomCount: next.filter((r) => r.adults === 1).length,
        doubleRoomCount: next.filter((r) => r.adults >= 2).length,
        extraBedCount: 0,
        occupancy: next.reduce((n, r) => n + r.adults + r.childAges.length, 0),
      },
      ...(!state.serviceKinds.some((k) => k === 'FLIGHT' || k === 'TRANSFER')
        ? {
            passengerComposition: {
              ...composition,
              adults: Math.max(
                composition.adults,
                state.serviceKinds.includes('VISA')
                  ? (state.visaComposition?.adults ?? 0)
                  : 0,
              ),
              children: Math.max(
                composition.children,
                state.serviceKinds.includes('VISA')
                  ? (state.visaComposition?.children ?? 0)
                  : 0,
              ),
            },
            childAges: ages.filter((a) => a !== null && a >= 2 && a < 12),
            infantAges: ages.filter((a) => a !== null && a < 2),
          }
        : {}),
    });
  };
  const visa = state.visaComposition ?? {
    adults: salesPassengerCounts(state).adults,
    children: salesPassengerCounts(state).children,
  };
  const changeVisa = (next: typeof visa) =>
    patch({
      visaComposition: next,
      visaApplicantIds: [],
      visaChildAges: Array.from(
        { length: next.children },
        (_, i) => state.visaChildAges?.[i] ?? null,
      ),
      ...(!state.serviceKinds.some((k) => ['FLIGHT', 'TRANSFER'].includes(k))
        ? {
            passengerComposition: {
              adults: Math.max(
                next.adults,
                state.serviceKinds.includes('HOTEL')
                  ? rooms.reduce(
                      (n, r) =>
                        n +
                        r.adults +
                        r.childAges.filter((a) => a !== null && a >= 12).length,
                      0,
                    )
                  : 0,
              ),
              children: Math.max(
                next.children,
                state.serviceKinds.includes('HOTEL')
                  ? rooms
                      .flatMap((r) => r.childAges)
                      .filter((a) => a !== null && a >= 2 && a < 12).length
                  : 0,
              ),
              infants: state.serviceKinds.includes('HOTEL')
                ? rooms
                    .flatMap((r) => r.childAges)
                    .filter((a) => a !== null && a < 2).length
                : 0,
            },
          }
        : {}),
    });
  return (
    <div className="mt-4 grid gap-4">
      {state.serviceKinds.includes('VISA') && (
        <section className="rounded-xl border p-4">
          <h3 className="font-bold">متقاضیان ویزا</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['adults', 'children'] as const).map((k) => (
              <label key={k}>
                {k === 'adults' ? 'بزرگسال ویزا' : 'کودک ویزا'}
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={visa[k]}
                  onChange={(e) =>
                    changeVisa({
                      ...visa,
                      [k]: Math.max(
                        0,
                        Math.min(100, Number(e.target.value) || 0),
                      ),
                    })
                  }
                />
              </label>
            ))}
          </div>
          {Array.from({ length: visa.children }, (_, i) => (
            <label key={i}>
              سن کودک ویزا {i + 1}
              <Input
                type="number"
                min={2}
                max={11}
                value={state.visaChildAges?.[i] ?? ''}
                onChange={(e) =>
                  patch({
                    visaComposition: visa,
                    visaChildAges: Array.from(
                      { length: visa.children },
                      (_, j) =>
                        i === j
                          ? e.target.value === ''
                            ? null
                            : Number(e.target.value)
                          : (state.visaChildAges?.[j] ?? null),
                    ),
                  })
                }
              />
            </label>
          ))}
        </section>
      )}
      {state.serviceKinds.includes('HOTEL') && (
        <section className="grid gap-3 rounded-xl border p-4">
          <h3 className="font-bold">هتل و ترکیب هر اتاق</h3>
          <SearchableReference
            label="هتل"
            value={state.hotel.hotelId}
            options={hotels}
            showAllOptionsOnOpen
            preferEnglishName
            onChange={(hotelId) =>
              patch({
                hotel: {
                  ...state.hotel,
                  hotelId,
                  name: hotels.find((h) => h.id === hotelId)?.name ?? '',
                  rooms: [],
                  roomTypeId: '',
                  guestCustomerIds: undefined,
                },
              })
            }
          />
          <label>
            تعداد اتاق
            <Input
              type="number"
              min={1}
              max={50}
              value={rooms.length || ''}
              disabled={!state.hotel.hotelId}
              onChange={(e) =>
                changeRooms(
                  Array.from(
                    {
                      length: Math.max(
                        1,
                        Math.min(50, Number(e.target.value) || 1),
                      ),
                    },
                    (_, i) =>
                      rooms[i] ?? {
                        ordinal: i + 1,
                        roomTypeId: '',
                        roomTypeNameSnapshot: '',
                        adults: 1,
                        childAges: [],
                      },
                  ),
                )
              }
            />
          </label>
          <div className="grid gap-3 lg:grid-cols-2">
            {rooms.map((r, i) => {
              const update = (value: Partial<typeof r>) =>
                changeRooms(
                  rooms.map((v, j) => (j === i ? { ...v, ...value } : v)),
                );
              const rate = rates.find((v) => v.roomTypeId === r.roomTypeId);
              return (
                <div
                  className="grid gap-2 rounded-xl border p-3"
                  key={r.ordinal}
                >
                  <b>اتاق {i + 1}</b>
                  <SearchableReference
                    label="نوع اتاق"
                    value={r.roomTypeId}
                    options={roomTypes}
                    showAllOptionsOnOpen
                    preferEnglishName
                    onChange={(roomTypeId) =>
                      update({
                        roomTypeId,
                        roomTypeNameSnapshot:
                          roomTypes.find((t) => t.id === roomTypeId)?.name ??
                          '',
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {rate
                      ? 'ظرفیت بزرگسال: ' +
                        rate.maxAdults +
                        ' · کودک: ' +
                        rate.maxChildren
                      : roomTypes.find((t) => t.id === r.roomTypeId)?.attributes
                            ?.referenceCapacity
                        ? 'ظرفیت اتاق: ' +
                          roomTypes.find((t) => t.id === r.roomTypeId)
                            ?.attributes?.referenceCapacity
                        : 'ظرفیت پس از انتخاب تاریخ و نوع اتاق بررسی می‌شود.'}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <label>
                      بزرگسال اتاق
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={r.adults}
                        onChange={(e) =>
                          update({
                            adults: Math.max(
                              1,
                              Math.min(20, Number(e.target.value) || 1),
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      کودک اتاق
                      <Input
                        type="number"
                        min={0}
                        max={20}
                        value={r.childAges.length}
                        onChange={(e) =>
                          update({
                            childAges: Array.from(
                              {
                                length: Math.max(
                                  0,
                                  Math.min(20, Number(e.target.value) || 0),
                                ),
                              },
                              (_, j) => r.childAges[j] ?? null,
                            ),
                          })
                        }
                      />
                    </label>
                  </div>
                  {r.childAges.map((age, j) => (
                    <label key={j}>
                      سن کودک {j + 1}
                      <Input
                        type="number"
                        min={0}
                        max={14}
                        value={age ?? ''}
                        onChange={(e) =>
                          update({
                            childAges: r.childAges.map((v, k) =>
                              k === j
                                ? e.target.value === ''
                                  ? null
                                  : Number(e.target.value)
                                : v,
                            ),
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
