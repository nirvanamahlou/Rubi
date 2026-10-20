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
      className="grid gap-3 rounded-xl border p-4 md:grid-cols-3"
      aria-label="تاریخ اقامت مهمانان"
    >
      <h3 className="font-bold md:col-span-3">جزئیات اقامت هتل</h3>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={state.hotelArrivesNextDay ?? false}
          onChange={(e) =>
            patchState({
              hotelArrivesNextDay: e.target.checked,
              hotel: { ...state.hotel, checkInManual: false },
            })
          }
        />
        فردا می‌رسد
      </label>
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
    </section>
  );
}
