'use client';
import { Trash2 } from 'lucide-react';
import { SalesDatePicker } from './sales-date-picker';
import { SalesThemedSelect } from './sales-themed-select';
import { passengerHotelStay } from '../model/contract-guest-stays';
import {
  salesHotelCalendarSystem,
  type SalesFormState,
} from '../model/sales-form';
export function guestStayColumns(
  state: SalesFormState,
  patch: (value: Partial<SalesFormState>) => void,
  resolve: (key: string) => string,
  busy = false,
) {
  const value = (row: { key: string }) => {
    const key = row.key.replace('sales-entry-', '');
    const id = resolve(key);
    const flightOnly = state.flightOnlyPassengers?.some((p) => p.key === key);
    const stay = passengerHotelStay(
      !flightOnly,
      state.hotel,
      state.passengerHotelStays?.[id] ?? state.passengerHotelStays?.[key],
    );
    return { key, id, stay };
  };
  return [
    ...(['checkIn', 'checkOut'] as const).map((field) => ({
      key: field,
      title: field === 'checkIn' ? 'چک‌این هتل' : 'چک‌اوت هتل',
      render: (row: { key: string }) => {
        const { id, stay } = value(row);
        return stay ? (
          <div className="min-w-40">
            <SalesDatePicker
              calendarSystem={salesHotelCalendarSystem(state)}
              onCalendarSystemChange={(calendarSystem) =>
                patch({ hotel: { ...state.hotel, calendarSystem } })
              }
              value={stay[field]}
              disabled={busy || !stay.different}
              onChange={(day) =>
                patch({
                  passengerHotelStays: {
                    ...state.passengerHotelStays,
                    [id]: { ...stay, [field]: day },
                  },
                })
              }
            />
          </div>
        ) : (
          <span>—</span>
        );
      },
    })),
    {
      key: 'differentStay',
      title: 'اقامت متفاوت',
      render: (row: { key: string }) => {
        const { key, id, stay } = value(row);
        if (!stay)
          return (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy}
                aria-label="حذف مسافر فقط پرواز"
                onClick={() =>
                  patch({
                    flightOnlyPassengers: (
                      state.flightOnlyPassengers ?? []
                    ).filter((p) => p.key !== key),
                  })
                }
              >
                <Trash2 className="size-4 text-destructive" />
              </button>
              <SalesThemedSelect
                disabled={busy}
                label="رده سنی مسافر فقط پرواز"
                value={String(
                  state.flightOnlyPassengers?.find((p) => p.key === key)?.age ??
                    18,
                )}
                options={[
                  { value: '18', label: 'بزرگسال' },
                  { value: '6', label: 'کودک' },
                  { value: '1', label: 'نوزاد' },
                ]}
                onValueChange={(age) =>
                  patch({
                    flightOnlyPassengers: (
                      state.flightOnlyPassengers ?? []
                    ).map((p) =>
                      p.key === key ? { ...p, age: Number(age) } : p,
                    ),
                  })
                }
              />
            </div>
          );
        return (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              disabled={busy}
              checked={stay.different}
              onChange={(event) =>
                patch({
                  passengerHotelStays: {
                    ...state.passengerHotelStays,
                    [id]: {
                      ...stay,
                      different: event.target.checked,
                      ...(!event.target.checked
                        ? {
                            checkIn: state.hotel.checkIn,
                            checkOut: state.hotel.checkOut,
                          }
                        : {}),
                    },
                  },
                })
              }
            />
            c.in , cout متفاوت
          </label>
        );
      },
    },
  ].map((column) => ({ ...column, position: 'end' as const }));
}
