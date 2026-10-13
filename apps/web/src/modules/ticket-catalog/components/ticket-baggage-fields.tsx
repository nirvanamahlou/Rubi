'use client';
import { FormField, Input } from '@/components/ui';
export function TicketBaggageFields({
  economy,
  business,
  onChange,
  suffix = '',
  readOnly,
  disabled,
}: {
  economy?: string | null | undefined;
  business?: string | null | undefined;
  suffix?: string;
  readOnly?: boolean;
  disabled?: boolean;
  onChange: (
    field: 'economyBaggageKg' | 'businessBaggageKg',
    value: string | null,
  ) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {(['economyBaggageKg', 'businessBaggageKg'] as const).map((field) => (
        <FormField
          key={field}
          label={`${field === 'economyBaggageKg' ? 'بار اکونومی' : 'بار بیزینس (اختیاری)'}${suffix} — کیلوگرم`}
        >
          <Input
            type="number"
            min={0}
            max={9999}
            step="0.01"
            placeholder="مثلاً 20"
            value={(field === 'economyBaggageKg' ? economy : business) ?? ''}
            readOnly={readOnly}
            disabled={disabled}
            onChange={(event) => onChange(field, event.target.value || null)}
          />
        </FormField>
      ))}
    </div>
  );
}
