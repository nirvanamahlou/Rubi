'use client';
import { useEffect, useRef, useState } from 'react';
import { loadContractHotels } from '../api/hotel-catalog';
import { withCompositeGuests } from '../model/composite-guests';
import {
  defaultSalesRoomCategory,
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

export function AdditionalHotelStays({
  state: source,
  patch,
  hotels,
  cities = [],
  roomTypes,
}: {
  state: SalesFormState;
  patch: (patch: Partial<SalesFormState>) => void;
  hotels: readonly MasterDataRecord[];
  cities?: readonly MasterDataRecord[];
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
  const save = (next: typeof stays) =>
    patch({
      hotel: withCompositeGuests({
        ...state,
        hotel: { ...state.hotel, multiHotel: true, additionalStays: next },
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
            <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-end gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
              <SearchableReference
                label="هتل"
                value={stay.hotelId}
                options={availableHotels.filter(
                  (h) =>
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
    </section>
  );
}
