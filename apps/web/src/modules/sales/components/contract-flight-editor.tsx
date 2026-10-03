'use client';
import { Button } from '@/components/ui/button';
import { FormField, Input } from '@/components/ui/form-controls';
import { SalesDatePicker } from './sales-date-picker';
import { SalesThemedSelect } from './sales-themed-select';
import type { ContractFlightDraft } from '../model/sales-form';

export function ContractFlightEditor({
  value,
  onChange,
}: {
  value: ContractFlightDraft | undefined;
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
        افزودن بلیط شناور؛ فقط این قرارداد
      </Button>
    );
  const patch = (next: Partial<ContractFlightDraft>) =>
    onChange({ ...value, ...next });
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
          انتخاب از موجودی شرکت
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        فقط در همین قرارداد ثبت می‌شود؛ ظرفیت شرکت کم نمی‌شود. تأمین و صدور باید
        در رزرواسیون پیگیری شود. ساعت‌ها به وقت تهران هستند.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="ایرلاین" required>
          <Input
            aria-label="ایرلاین بلیط شناور"
            value={value.carrierName}
            maxLength={160}
            onChange={(e) => patch({ carrierName: e.target.value })}
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
        <FormField label="تاریخ و ساعت حرکت" required>
          <SalesDatePicker
            includeTime
            value={value.departureAt}
            onChange={(departureAt) => patch({ departureAt })}
          />
        </FormField>
        <FormField label="تاریخ و ساعت رسیدن" required>
          <SalesDatePicker
            includeTime
            value={value.arrivalAt}
            onChange={(arrivalAt) => patch({ arrivalAt })}
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
    </section>
  );
}
