'use client';
import type { MasterDataRecord } from '@nora/contracts';
import { SearchCombobox } from '@/components/ui/search-combobox';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form-controls';
import { TimePicker } from '@/components/ui/time-picker';
import {
  confirmFloatingFlight,
  floatingFlightClock,
  floatingFlightDate,
  floatingFlightTimes,
} from '../model/floating-flight-times';
import { SalesThemedSelect } from './sales-themed-select';
import type { ContractFlightDraft } from '../model/sales-form';

export function ContractFlightEditor({
  value,
  flightDate = '',
  airlines = [],
  onChange,
}: {
  value: ContractFlightDraft | undefined;
  international?: boolean;
  flightDate?: string;
  airlines?: readonly MasterDataRecord[];
  onChange: (value: ContractFlightDraft | undefined) => void;
}) {
  if (!value)
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          onChange({
            departureAt: '',
            arrivalAt: '',
            carrierName: '',
            serviceNumber: '',
            cabinClassCode: 'ECONOMY',
          })
        }
      >
        افزودن بلیط شناور
      </Button>
    );
  const date = flightDate || floatingFlightDate(value.departureAt);
  const patch = (next: Partial<ContractFlightDraft>) =>
    onChange({ ...value, ...next, confirmation: undefined });
  return (
    <section
      aria-label="بلیط شناور این قرارداد"
      className="grid gap-3 rounded-xl border border-primary bg-primary/5 p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong>بلیط شناور — خارج از موجودی</strong>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange(undefined)}
        >
          لغو بلیط شناور و انتخاب از موجودی شرکت
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        فقط در همین قرارداد ثبت می‌شود؛ ظرفیت شرکت کم نمی‌شود. تأمین و صدور باید
        در رزرواسیون پیگیری شود. ساعت‌ها به وقت تهران هستند.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="ایرلاین" required>
          <SearchCombobox
            label="ایرلاین بلیط شناور"
            required
            value={value.carrierName}
            placeholder="جست‌وجو و انتخاب ایرلاین…"
            selectedLabel={value.carrierName || undefined}
            options={airlines
              .filter((airline) => airline.status === 'active')
              .map((airline) => ({
                value: airline.name,
                label: airline.name,
                englishLabel: String(airline.attributes.englishName ?? ''),
                searchText:
                  airline.name +
                  ' ' +
                  airline.code +
                  ' ' +
                  String(airline.attributes.englishName ?? ''),
              }))}
            onValueChange={(carrierName) => patch({ carrierName })}
          />
        </FormField>
        <FormField label="شماره پرواز" required>
          <Input
            aria-label="شماره پرواز شناور"
            value={value.serviceNumber}
            maxLength={80}
            dir="ltr"
            onChange={(e) => patch({ serviceNumber: e.target.value })}
          />
        </FormField>
        <FormField label="ساعت حرکت" required>
          <TimePicker
            aria-label="ساعت حرکت بلیط شناور"
            disabled={!date}
            value={floatingFlightClock(value.departureAt)}
            onChange={(e) =>
              onChange(
                floatingFlightTimes(
                  date,
                  { ...value, confirmation: undefined },
                  {
                    departure: e.target.value,
                  },
                ),
              )
            }
          />
        </FormField>
        <FormField label="ساعت رسیدن" required>
          <TimePicker
            aria-label="ساعت رسیدن بلیط شناور"
            disabled={!date}
            value={floatingFlightClock(value.arrivalAt)}
            onChange={(e) =>
              onChange(
                floatingFlightTimes(
                  date,
                  { ...value, confirmation: undefined },
                  {
                    arrival: e.target.value,
                  },
                ),
              )
            }
          />
        </FormField>
        <FormField label="کلاس پرواز" required>
          <SalesThemedSelect
            label="کلاس پرواز شناور"
            value={value.cabinClassCode}
            onValueChange={(cabinClassCode) =>
              patch({
                cabinClassCode:
                  cabinClassCode as ContractFlightDraft['cabinClassCode'],
              })
            }
            options={[
              { value: 'ECONOMY', label: 'اکونومی' },
              { value: 'BUSINESS', label: 'بیزینس' },
              { value: 'FIRST', label: 'فرست کلاس' },
            ]}
          />
        </FormField>
      </div>
      <Button
        type="button"
        aria-label="ثبت بلیط شناور"
        onClick={() => onChange(confirmFloatingFlight(date, value))}
      >
        ثبت بلیط شناور
      </Button>
      {value.confirmation === 'saved' &&
      value.departureAt.startsWith(date + 'T') ? (
        <p role="status">بلیط شناور ثبت شد.</p>
      ) : null}
      {value.confirmation === 'invalid' ? (
        <p role="alert" className="text-sm text-destructive">
          اطلاعات بلیط شناور کامل نیست.
        </p>
      ) : null}
    </section>
  );
}
