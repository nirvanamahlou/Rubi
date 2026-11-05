'use client';
import { useEffect, useRef, useState } from 'react';
import { loadContractHotels } from '../api/hotel-catalog';
import { withCompositeGuests } from '../model/composite-guests';
import {
  defaultSalesRoomCategory,
  retainHotelJourneyRoutes,
  salesRoomCategories,
  salesRoomCategoryLabel,
  type SalesRoomCategory,
  type MasterDataRecord,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-controls';
import type { SalesFormState } from '../model/sales-form';
import {
  salesHotelCalendarSystem,
  salesHotelRoomTypes,
} from '../model/sales-form';
import { SearchableReference } from './searchable-reference';
import { SalesDatePicker } from './sales-date-picker';
import { SalesThemedSelect } from './sales-themed-select';
import { HotelJourneyEditor } from './hotel-journey-editor';
import {
  selectedHotelJourneys,
  salesHotelJourneyError,
} from '../model/hotel-journeys';
import type { HotelJourneyV1 } from '@nora/contracts';

export function AdditionalHotelStays({
  state: source,
  patch,
  hotels,
  cities = [],
  countries = [],
  airlines = [],
  roomTypes,
}: {
  state: SalesFormState;
  patch: (patch: Partial<SalesFormState>) => void;
  hotels: readonly MasterDataRecord[];
  cities?: readonly MasterDataRecord[];
  countries?: readonly MasterDataRecord[];
  airlines?: readonly MasterDataRecord[];
  roomTypes: readonly MasterDataRecord[];
}) {
  const state = withCompositeGuests(source);
  const [catalog, setCatalog] = useState<readonly MasterDataRecord[] | null>(
    null,
  );
  const [catalogError, setCatalogError] = useState('');
  const [catalogBusy, setCatalogBusy] = useState(false);
  const pendingCatalog = useRef<AbortController | null>(null);
  const openHotelRow = useRef<number | null>(null);
  useEffect(() => () => pendingCatalog.current?.abort(), []);
  async function refreshCatalog() {
    pendingCatalog.current?.abort();
    const controller = new AbortController();
    pendingCatalog.current = controller;
    setCatalogBusy(true);
    setCatalogError('');
    try {
      const result = await loadContractHotels(controller.signal);
      if (!controller.signal.aborted) setCatalog(result);
    } catch (error) {
      if (!controller.signal.aborted)
        setCatalogError(
          error instanceof Error
            ? error.message
            : 'دریافت فهرست کامل هتل‌ها انجام نشد.',
        );
    } finally {
      if (!controller.signal.aborted) setCatalogBusy(false);
    }
  }
  const availableHotels = catalog ?? hotels;
  if (
    !state.serviceKinds.includes('HOTEL') ||
    state.tour ||
    (!state.hotel.multiHotel && !state.hotel.additionalStays?.length)
  )
    return null;
  const stays = state.hotel.additionalStays ?? [];
  const journeys = selectedHotelJourneys(state);
  const changeJourney = (
    fromHotelId: string,
    value: HotelJourneyV1 | undefined,
  ) =>
    patch({
      hotel: {
        ...state.hotel,
        journeys: [
          ...journeys.filter((j) => j.fromHotelId !== fromHotelId),
          ...(value ? [value] : []),
        ],
      },
    });
  const journeyError = salesHotelJourneyError(state);
  const last = stays.at(-1);
  const cityName = (id: string) => cities.find((c) => c.id === id)?.name ?? '';
  const save = (next: typeof stays) =>
    patch({
      hotel: withCompositeGuests({
        ...state,
        hotel: {
          ...state.hotel,
          multiHotel: true,
          additionalStays: next,
          journeys: retainHotelJourneyRoutes(journeys, [
            state.hotel.hotelId,
            ...next.map((s) => s.hotelId),
          ]),
        },
      }).hotel,
    });
  return (
    <section
      className="grid gap-4 rounded-xl border p-4"
      aria-label="هتل‌های ترکیبی قرارداد"
    >
      <h3 className="font-bold">هتل‌های ترکیبی قرارداد</h3>
      <p>ترکیب مهمانان اقامت‌های بعدی از اقامت اول خوانده می‌شود.</p>
      {catalogError && (
        <div role="alert">
          <p>{catalogError}</p>
          <Button variant="outline" onClick={() => void refreshCatalog()}>
            دریافت دوباره هتل‌ها
          </Button>
        </div>
      )}
      {stays.map((stay, index) => {
        const update = (next: Partial<typeof stay>) =>
          save(
            stays.map((item, i) => (i === index ? { ...item, ...next } : item)),
          );
        const rooms = stay.rooms ?? [];
        const countryId =
          stay.countryId ||
          String(
            cities.find((c) => c.id === stay.cityId)?.attributes.countryId ??
              '',
          );
        const previous =
          index === 0
            ? {
                hotelId: state.hotel.hotelId,
                hotelNameSnapshot: state.hotel.name,
                cityId: state.hotel.cityId || state.destinationId,
              }
            : stays[index - 1]!;
        const options = salesHotelRoomTypes(
          stay.hotelId,
          availableHotels,
          roomTypes,
        );
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
            <div className="grid gap-3 sm:grid-cols-2">
              <SearchableReference
                label="کشور اقامت بعدی"
                value={countryId}
                options={countries}
                onChange={(countryId) =>
                  update({
                    countryId,
                    cityId: '',
                    hotelId: '',
                    hotelNameSnapshot: '',
                    rooms: rooms.map((r) => ({
                      ...r,
                      roomTypeId: '',
                      roomTypeNameSnapshot: '',
                    })),
                  })
                }
              />
              <SearchableReference
                label="شهر اقامت بعدی"
                value={stay.cityId}
                disabled={!countryId}
                options={cities.filter(
                  (c) => c.attributes.countryId === countryId,
                )}
                onChange={(cityId) =>
                  update({
                    cityId,
                    hotelId: '',
                    hotelNameSnapshot: '',
                    rooms: rooms.map((r) => ({
                      ...r,
                      roomTypeId: '',
                      roomTypeNameSnapshot: '',
                    })),
                  })
                }
              />
            </div>
            <div className="grid gap-3">
              <SearchableReference
                label="هتل"
                value={stay.hotelId}
                disabled={!stay.cityId}
                options={availableHotels.filter(
                  (h) =>
                    !!stay.cityId &&
                    h.attributes.cityId === stay.cityId &&
                    h.id !== state.hotel.hotelId &&
                    !stays.some(
                      (other, i) => i !== index && other.hotelId === h.id,
                    ),
                )}
                showAllOptionsOnOpen
                loading={catalogBusy}
                onOpenChange={(open) => {
                  if (open && openHotelRow.current !== index) {
                    openHotelRow.current = index;
                    void refreshCatalog();
                  } else if (!open && openHotelRow.current === index) {
                    openHotelRow.current = null;
                  }
                }}
                preferEnglishName
                onChange={(id) => {
                  const hotel = availableHotels.find((h) => h.id === id);
                  if (id && !hotel) return;
                  if (id && hotel?.attributes.cityId !== stay.cityId) return;
                  if (
                    id &&
                    (id === state.hotel.hotelId ||
                      stays.some(
                        (other, i) => i !== index && other.hotelId === id,
                      ))
                  )
                    return;
                  update({
                    hotelId: id,
                    hotelNameSnapshot: hotel?.name ?? '',
                    cityId:
                      typeof hotel?.attributes.cityId === 'string'
                        ? hotel.attributes.cityId
                        : '',
                    rooms: rooms.map((room) => ({
                      ...room,
                      roomTypeId: '',
                      roomTypeNameSnapshot: '',
                    })),
                  });
                }}
              />
            </div>
            <p>
              شهر هتل:{' '}
              {String(
                cities.find((c) => c.id === stay.cityId)?.attributes
                  ?.englishName ??
                  cities.find((c) => c.id === stay.cityId)?.name ??
                  '—',
              )}
            </p>
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
            <HotelJourneyEditor
              value={journeys.find(
                (j) =>
                  j.fromHotelId === previous.hotelId &&
                  j.toHotelId === stay.hotelId,
              )}
              onChange={(value) => changeJourney(previous.hotelId, value)}
              fromHotelId={previous.hotelId}
              toHotelId={stay.hotelId}
              fromLabel={
                previous.hotelNameSnapshot + ' · ' + cityName(previous.cityId)
              }
              toLabel={stay.hotelNameSnapshot + ' · ' + cityName(stay.cityId)}
              originCityId={previous.cityId}
              destinationCityId={stay.cityId}
              cities={cities}
              airlines={airlines}
              defaultDate={stay.checkInDate}
            />
            {rooms.map((room, roomIndex) => {
              const change = (next: Partial<typeof room>) =>
                update({
                  rooms: rooms.map((r, i) =>
                    i === roomIndex
                      ? {
                          ...r,
                          ...next,
                          roomCategory: defaultSalesRoomCategory({
                            ...r,
                            ...next,
                          }),
                        }
                      : r,
                  ),
                });
              const category = defaultSalesRoomCategory(room);
              return (
                <div
                  key={room.ordinal}
                  className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2"
                >
                  <b className="sm:col-span-2">اتاق {roomIndex + 1}</b>
                  <SearchableReference
                    label="نوع اتاق"
                    value={room.roomTypeId}
                    options={options}
                    showAllOptionsOnOpen
                    loading={catalogBusy}
                    preferEnglishName
                    onChange={(id) =>
                      change({
                        roomTypeId: id,
                        roomTypeNameSnapshot:
                          options.find((r) => r.id === id)?.name ?? '',
                      })
                    }
                  />
                  <label>
                    دسته‌بندی اتاق
                    <SalesThemedSelect
                      label="دسته‌بندی اتاق"
                      value={category ?? ''}
                      options={salesRoomCategories(
                        room.adults,
                        room.childAges.length,
                      ).map((value) => ({
                        value,
                        label: salesRoomCategoryLabel(value, room.adults),
                      }))}
                      onValueChange={(value) =>
                        change({ roomCategory: value as SalesRoomCategory })
                      }
                    />
                  </label>
                  <p className="sm:col-span-2 text-xs text-muted-foreground">
                    {options.find((item) => item.id === room.roomTypeId)
                      ?.attributes?.referenceCapacity
                      ? 'ظرفیت اتاق: ' +
                        options.find((item) => item.id === room.roomTypeId)
                          ?.attributes?.referenceCapacity
                      : 'ظرفیت پس از انتخاب تاریخ و نوع اتاق بررسی می‌شود.'}
                  </p>
                  <p>تعداد نفرات اتاق: {room.adults + room.childAges.length}</p>
                </div>
              );
            })}
            <p>
              مجموع مهمانان هتل:{' '}
              {rooms.reduce(
                (n, room) => n + room.adults + room.childAges.length,
                0,
              )}
            </p>
            {rooms.reduce(
              (n, room) => n + room.adults + room.childAges.length,
              0,
            ) > state.hotel.occupancy && (
              <p role="alert" className="text-sm text-destructive">
                تعداد مهمانان این هتل از تعداد مسافران اقامت بیشتر است.
              </p>
            )}
            {rooms.some((room) =>
              room.childAges.some((age) => age === null),
            ) && (
              <p role="alert" className="text-sm text-destructive">
                سن همه کودکان هتل را انتخاب کنید.
              </p>
            )}
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
      {last?.hotelId && (
        <HotelJourneyEditor
          value={journeys.find(
            (j) => j.fromHotelId === last.hotelId && j.toHotelId === null,
          )}
          onChange={(value) => changeJourney(last.hotelId, value)}
          fromHotelId={last.hotelId}
          toHotelId={null}
          fromLabel={last.hotelNameSnapshot + ' · ' + cityName(last.cityId)}
          toLabel="فرودگاه بلیت برگشت"
          originCityId={last.cityId}
          destinationCityId={state.returnOffer?.originId || state.destinationId}
          preferredAirportId={state.returnOffer?.originAirportId ?? undefined}
          cities={cities}
          airlines={airlines}
          defaultDate={last.checkOutDate}
        />
      )}
      {journeyError && (
        <p role="alert" className="text-sm text-destructive">
          {journeyError}
        </p>
      )}
    </section>
  );
}
