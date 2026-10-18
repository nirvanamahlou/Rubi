'use client';
import {
  hotelChildChoices,
  syncHotelChildSelections,
  selectHotelChild,
} from '../model/hotel-child-selection';
import { SalesThemedSelect } from './sales-themed-select';
import { salesHotelRoomSummary } from '@nora/contracts';
import { PassengerAgeField } from './passenger-age-field';
import {
  salesRoomPartyError,
  roomPartyUsage,
} from '../model/sales-room-prices';
import { SearchableReference } from './searchable-reference';
import { Input } from '@/components/ui/form-controls';
import type { MasterDataRecord, HotelRoomRateV1 } from '@nora/contracts';
import type { SalesFormState } from '../model/sales-form';
import { salesPassengerCounts, salesTravelDate } from '../model/sales-form';
export function ServiceParties({
  state: sourceState,
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
  const state = syncHotelChildSelections(
    sourceState,
    salesTravelDate(sourceState),
  );
  const childChoices = hotelChildChoices(state, salesTravelDate(state));
  const rooms = state.hotel.rooms ?? [];
  const limited = state.serviceKinds.includes('FLIGHT');
  const party = salesPassengerCounts(state);
  const partyError = salesRoomPartyError(state);
  const used = roomPartyUsage(rooms, state.hotelChildAssignments);
  const maxRooms = limited
    ? Math.min(
        50,
        Math.max(
          1,
          rooms.length +
            Math.max(
              0,
              Math.min(party.adults - used.adults, party.total - used.total),
            ),
        ),
      )
    : 50;
  const changeRooms = (next: typeof rooms) => {
    const ages = next.flatMap((r) => r.childAges);
    const composition = {
      adults:
        next.reduce((n, r) => n + r.adults, 0) +
        ages.filter((a) => a !== null && a >= 12).length,
      children: ages.filter((a) => a !== null && a >= 2 && a < 12).length,
      infants: ages.filter((a) => a !== null && a < 2).length,
    };
    const linked = syncHotelChildSelections(
      { ...state, hotel: { ...state.hotel, rooms: next } },
      salesTravelDate(state),
    );
    patch({
      hotelChildAssignments: linked.hotelChildAssignments,
      hotel: {
        ...linked.hotel,
        rooms: linked.hotel.rooms ?? next,
        ...salesHotelRoomSummary(next),
        roomTypeId: next[0]?.roomTypeId ?? '',
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
          <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-end gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
            <div className="min-w-0">
              <SearchableReference
                label="هتل"
                value={state.hotel.hotelId}
                options={hotels}
                showAllOptionsOnOpen
                preferEnglishName
                onChange={(hotelId) =>
                  patch({
                    hotelChildAssignments: {},
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
            </div>
            <label className="grid min-w-0 gap-1">
              تعداد اتاق
              <Input
                type="number"
                min={1}
                max={maxRooms}
                value={rooms.length || ''}
                disabled={!state.hotel.hotelId}
                onChange={(e) =>
                  changeRooms(
                    Array.from(
                      {
                        length: Math.max(
                          1,
                          Math.min(maxRooms, Number(e.target.value) || 1),
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
          </div>
          {partyError ? (
            <p role="alert" className="text-sm text-destructive">
              {partyError}
            </p>
          ) : null}
          <div className="grid gap-3 lg:grid-cols-2">
            {rooms.map((r, i) => {
              const update = (value: Partial<typeof r>) =>
                changeRooms(
                  rooms.map((v, j) => (j === i ? { ...v, ...value } : v)),
                );
              const others = rooms.filter((_, j) => j !== i);
              const othersUsed = roomPartyUsage(
                others,
                state.hotelChildAssignments,
              );
              const maxAdults = limited
                ? Math.max(
                    1,
                    Math.min(
                      20,
                      Math.min(
                        party.total - othersUsed.total - r.childAges.length,
                        party.adults -
                          othersUsed.adults -
                          (roomPartyUsage([r], state.hotelChildAssignments)
                            .adults -
                            r.adults),
                      ),
                    ),
                  )
                : 20;
              const maxChildren = limited
                ? Math.max(
                    0,
                    Math.min(20, party.total - othersUsed.total - r.adults),
                  )
                : 20;
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
                        max={maxAdults}
                        value={r.adults}
                        onChange={(e) =>
                          update({
                            adults: Math.max(
                              1,
                              Math.min(maxAdults, Number(e.target.value) || 1),
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
                        max={maxChildren}
                        value={r.childAges.length}
                        onChange={(e) =>
                          update({
                            childAges: Array.from(
                              {
                                length: Math.max(
                                  0,
                                  Math.min(
                                    maxChildren,
                                    Number(e.target.value) || 0,
                                  ),
                                ),
                              },
                              (_, j) => r.childAges[j] ?? null,
                            ),
                          })
                        }
                      />
                    </label>
                  </div>
                  {r.childAges.map((age, j) => {
                    const selected =
                      state.hotelChildAssignments?.[String(r.ordinal)]?.[j] ??
                      '';
                    const unavailable = new Set(
                      Object.entries(state.hotelChildAssignments ?? {}).flatMap(
                        ([ordinal, keys]) =>
                          keys.filter(
                            (_, index) =>
                              Number(ordinal) !== r.ordinal || index !== j,
                          ),
                      ),
                    );
                    return limited ? (
                      <div key={j} className="space-y-2">
                        <label className="text-sm">کودک اتاق {j + 1}</label>
                        <SalesThemedSelect
                          label={'کودک اتاق ' + r.ordinal + ' - ' + (j + 1)}
                          value={selected}
                          options={[
                            { value: '', label: 'انتخاب کودک از مسافران' },
                            ...childChoices
                              .filter(
                                (c) =>
                                  !unavailable.has(c.key) &&
                                  c.age !== null &&
                                  c.age < 15,
                              )
                              .map((c) => ({ value: c.key, label: c.label })),
                            ...(selected === 'adult' ||
                            used.adults < party.adults
                              ? [
                                  {
                                    value: 'adult',
                                    label: 'کودک هتل با ردهٔ بزرگسال پرواز',
                                  },
                                ]
                              : []),
                          ]}
                          onValueChange={(key) => {
                            const next = selectHotelChild(
                              state,
                              salesTravelDate(state),
                              r.ordinal,
                              j,
                              key,
                            );
                            patch({
                              hotel: next.hotel,
                              hotelChildAssignments: next.hotelChildAssignments,
                            });
                          }}
                        />
                        {selected === 'adult' && (
                          <PassengerAgeField
                            label={'سن کودک هتل ' + (j + 1)}
                            value={age}
                            allowedAges={[12, 13, 14]}
                            onChange={(value) =>
                              update({
                                childAges: r.childAges.map((a, index) =>
                                  index === j ? value : a,
                                ),
                              })
                            }
                          />
                        )}
                        {!childChoices.some((c) => c.age !== null) &&
                          selected !== 'adult' && (
                            <p className="text-xs text-muted-foreground">
                              ابتدا سن کودک را در تعداد مسافران انتخاب کنید.
                            </p>
                          )}
                      </div>
                    ) : (
                      <PassengerAgeField
                        key={j}
                        label={'سن کودک ' + (j + 1)}
                        value={age}
                        includeInfants
                        onChange={(value) =>
                          update({
                            childAges: r.childAges.map((a, index) =>
                              index === j ? value : a,
                            ),
                          })
                        }
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
