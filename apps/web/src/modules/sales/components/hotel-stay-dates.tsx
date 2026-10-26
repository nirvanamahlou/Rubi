'use client';
import type { SalesFormState } from '../model/sales-form';
import { salesHotelCalendarSystem } from '../model/sales-form';
import { SalesDatePicker as DatePicker } from './sales-date-picker';
import { FormField } from '@/components/ui/form-controls';
export function HotelStayDates({
  state,
  patchState,
}: {
  state: SalesFormState;
  patchState: (patch: Partial<SalesFormState>) => void;
}) {
  return (
    <section
      className="grid gap-3 rounded-xl border p-4 md:grid-cols-2"
      aria-label="تاریخ اقامت مهمانان"
    >
      <h3 className="font-bold md:col-span-2">جزئیات اقامت هتل</h3>
      {state.hotel.additionalStays?.length ? (
        <p className="md:col-span-2">{state.hotel.name}</p>
      ) : null}
      <FormField label="ورود (چک‌این)" required>
        <DatePicker
          calendarSystem={salesHotelCalendarSystem(state)}
          onCalendarSystemChange={(calendarSystem) =>
            patchState({ hotel: { ...state.hotel, calendarSystem } })
          }
          value={state.hotel.checkIn}
          onChange={(checkIn) =>
            patchState({
              hotel: {
                ...state.hotel,
                checkIn,
                checkInManual: true,
              },
            })
          }
        />
      </FormField>
      <FormField label="خروج (چک‌اوت)" required>
        <DatePicker
          calendarSystem={salesHotelCalendarSystem(state)}
          onCalendarSystemChange={(calendarSystem) =>
            patchState({ hotel: { ...state.hotel, calendarSystem } })
          }
          value={state.hotel.checkOut}
          onChange={(checkOut) =>
            patchState({
              hotel: {
                ...state.hotel,
                checkOut,
                checkOutManual: true,
              },
            })
          }
        />
      </FormField>
      {(state.hotel.additionalStays ?? []).map((stay, index) => (
        <section
          key={`${stay.hotelId}-${index}`}
          className="grid gap-3 rounded-xl border p-3 md:col-span-2 md:grid-cols-2"
        >
          <h4 className="font-bold md:col-span-2">{stay.hotelNameSnapshot}</h4>
          {(['checkInDate', 'checkOutDate'] as const).map((field) => (
            <FormField
              key={field}
              label={
                field === 'checkInDate' ? 'ورود (چک‌این)' : 'خروج (چک‌اوت)'
              }
              required
            >
              <DatePicker
                calendarSystem={salesHotelCalendarSystem(state)}
                value={stay[field]}
                onChange={(value) =>
                  patchState({
                    hotel: {
                      ...state.hotel,
                      additionalStays: state.hotel.additionalStays!.map(
                        (item, position) =>
                          position === index
                            ? { ...item, [field]: value }
                            : item,
                      ),
                    },
                  })
                }
              />
            </FormField>
          ))}
        </section>
      ))}
    </section>
  );
}
