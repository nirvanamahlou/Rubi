'use client';
import {
  HOTEL_JOURNEY_MODES,
  hotelJourneyError,
  type HotelJourneyV1,
  type MasterDataRecord,
} from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form-controls';
import { TimePicker } from '@/components/ui/time-picker';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { SalesDatePicker } from './sales-date-picker';
import { SalesThemedSelect } from './sales-themed-select';
import { FloatingFlightAirport } from './floating-flight-airport';

export function HotelJourneyEditor({
  value,
  onChange,
  fromHotelId,
  toHotelId,
  fromLabel,
  toLabel,
  originCityId,
  destinationCityId,
  cities,
  airlines = [],
  defaultDate,
  preferredAirportId,
  workflow = 'sales',
}: {
  value?: HotelJourneyV1 | undefined;
  onChange: (value: HotelJourneyV1 | undefined) => void;
  fromHotelId: string;
  toHotelId: string | null;
  fromLabel: string;
  toLabel: string;
  originCityId: string;
  destinationCityId: string;
  cities: readonly MasterDataRecord[];
  airlines?: readonly MasterDataRecord[];
  defaultDate: string;
  preferredAirportId?: string | undefined;
  workflow?: 'sales' | 'reservations';
}) {
  if (!value)
    return (
      <Button
        type="button"
        variant="outline"
        className="w-full border-dashed"
        disabled={!fromHotelId || toHotelId === ''}
        onClick={() =>
          onChange({
            fromHotelId,
            toHotelId,
            mode: 'BUS',
            departureDate: defaultDate.slice(0, 10),
            arrivalDate: defaultDate.slice(0, 10),
            departureTime: '',
            arrivalTime: '',
          })
        }
      >
        {toHotelId === null
          ? 'افزودن مسیر تا فرودگاه برگشت'
          : 'افزودن جابه‌جایی به این هتل'}
      </Button>
    );
  const patch = (next: Partial<HotelJourneyV1>) =>
    onChange({ ...value, ...next });
  const flight = value.flight ?? {
    airline: '',
    number: '',
    cabinClass: 'ECONOMY' as const,
  };
  const flightPatch = (next: Partial<typeof flight>) =>
    patch({ flight: { ...flight, ...next } });
  const country = (id: string) =>
    String(cities.find((c) => c.id === id)?.attributes.countryId ?? '');
  const error = hotelJourneyError(value);
  return (
    <section
      className="grid gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4"
      aria-label="جابه‌جایی اختیاری اقامت"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong>
          {fromLabel} ← {toLabel}
        </strong>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(undefined)}
        >
          حذف جابه‌جایی
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={toHotelId === null ? '' : 'sm:col-span-2'}>
          <FormField label="روش جابه‌جایی" required>
            <SalesThemedSelect
              label="روش جابه‌جایی"
              value={value.mode}
              options={Object.entries(HOTEL_JOURNEY_MODES).map(
                ([v, label]) => ({
                  value: v,
                  label,
                }),
              )}
              onValueChange={(mode) => {
                const { flight: oldFlight, ...rest } = value;
                onChange({
                  ...rest,
                  mode: mode as HotelJourneyV1['mode'],
                  ...(mode === 'FLIGHT'
                    ? {
                        flight: oldFlight ?? {
                          ...flight,
                          ...(value.toHotelId === null && value.airport
                            ? { destinationAirport: value.airport }
                            : {}),
                        },
                      }
                    : {}),
                });
              }}
            />
          </FormField>
        </div>
        {toHotelId === null && (
          <FormField label="فرودگاه بلیت برگشت" required>
            <FloatingFlightAirport
              label="فرودگاه بلیت برگشت"
              cityId={destinationCityId}
              countryId={country(destinationCityId)}
              workflow={workflow}
              preferredId={preferredAirportId}
              value={value.airport}
              onChange={(airport) => {
                const { airport: _old, ...rest } = value;
                void _old;
                onChange({
                  ...rest,
                  ...(airport ? { airport } : {}),
                  ...(value.mode === 'FLIGHT'
                    ? { flight: { ...flight, destinationAirport: airport } }
                    : {}),
                });
              }}
            />
          </FormField>
        )}
        <FormField label="تاریخ حرکت جابه‌جایی" required>
          <SalesDatePicker
            calendarSystem="gregorian"
            value={value.departureDate}
            onChange={(departureDate) =>
              patch({
                departureDate,
                ...(value.arrivalDate === value.departureDate
                  ? { arrivalDate: departureDate }
                  : {}),
              })
            }
          />
        </FormField>
        <FormField label="تاریخ رسیدن جابه‌جایی" required>
          <SalesDatePicker
            calendarSystem="gregorian"
            value={value.arrivalDate}
            onChange={(arrivalDate) => patch({ arrivalDate })}
          />
        </FormField>
        <FormField label="ساعت حرکت جابه‌جایی" required>
          <TimePicker
            aria-label="ساعت حرکت جابه‌جایی"
            value={value.departureTime}
            onChange={(e) => patch({ departureTime: e.target.value })}
          />
        </FormField>
        <FormField label="ساعت رسیدن جابه‌جایی" required>
          <TimePicker
            aria-label="ساعت رسیدن جابه‌جایی"
            value={value.arrivalTime}
            onChange={(e) => patch({ arrivalTime: e.target.value })}
          />
        </FormField>
        {value.mode === 'FLIGHT' && (
          <>
            <FormField label="ایرلاین جابه‌جایی" required>
              <SearchCombobox
                label="ایرلاین جابه‌جایی"
                value={flight.airline}
                selectedLabel={flight.airline || undefined}
                options={airlines
                  .filter((a) => a.status === 'active')
                  .map((a) => ({
                    value: a.name,
                    label: a.name,
                    searchText:
                      a.name +
                      ' ' +
                      a.code +
                      ' ' +
                      String(a.attributes.englishName ?? ''),
                  }))}
                onValueChange={(airline) => flightPatch({ airline })}
              />
            </FormField>
            <FormField label="شماره پرواز جابه‌جایی" required>
              <Input
                aria-label="شماره پرواز جابه‌جایی"
                dir="ltr"
                maxLength={80}
                value={flight.number}
                onChange={(e) => flightPatch({ number: e.target.value })}
              />
            </FormField>
            <div className={toHotelId === null ? '' : 'sm:col-span-2'}>
              <FormField label="کلاس پرواز جابه‌جایی" required>
                <SalesThemedSelect
                  label="کلاس پرواز جابه‌جایی"
                  value={flight.cabinClass}
                  options={[
                    { value: 'ECONOMY', label: 'اکونومی' },
                    { value: 'BUSINESS', label: 'بیزینس' },
                    { value: 'FIRST', label: 'فرست کلاس' },
                  ]}
                  onValueChange={(cabinClass) =>
                    flightPatch({
                      cabinClass: cabinClass as typeof flight.cabinClass,
                    })
                  }
                />
              </FormField>
            </div>
            <FormField label="فرودگاه مبدأ جابه‌جایی" required>
              <FloatingFlightAirport
                label="فرودگاه مبدأ جابه‌جایی"
                cityId={originCityId}
                countryId={country(originCityId)}
                workflow={workflow}
                value={flight.originAirport}
                onChange={(originAirport) => flightPatch({ originAirport })}
              />
            </FormField>
            {toHotelId !== null && (
              <FormField label="فرودگاه مقصد جابه‌جایی" required>
                <FloatingFlightAirport
                  label="فرودگاه مقصد جابه‌جایی"
                  cityId={destinationCityId}
                  countryId={country(destinationCityId)}
                  workflow={workflow}
                  value={flight.destinationAirport}
                  onChange={(destinationAirport) =>
                    flightPatch({ destinationAirport })
                  }
                />
              </FormField>
            )}
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        تاریخ جابه‌جایی مستقل از اقامت قابل تغییر است. ساعت‌ها به وقت تهران
        هستند؛ برای رسیدن روز بعد، تاریخ رسیدن را تغییر دهید.
      </p>
      {error && (
        <p role="status" className="text-sm text-amber-700">
          {error}
        </p>
      )}
    </section>
  );
}
