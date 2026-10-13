import { Input } from '@/components/ui/form-controls';
export function CustomerBasicFields({
  values,
  onChange,
  disabled = false,
}: {
  values: {
    firstName: string;
    lastName: string;
    phone: string;
    address: string;
  };
  onChange: (field: keyof typeof values, value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2" aria-label="اطلاعات مشتری">
      {(
        [
          ['firstName', 'نام'],
          ['lastName', 'نام خانوادگی'],
          ['phone', 'شماره تماس'],
          ['address', 'نشانی و آدرس'],
        ] as const
      ).map(([field, label]) => (
        <label key={field} className="grid gap-2 text-sm font-medium">
          {label}
          <Input
            id={'customer-basic-' + field}
            aria-label={label}
            disabled={disabled}
            required
            value={values[field]}
            minLength={field === 'address' ? 2 : undefined}
            maxLength={field === 'address' ? 240 : field === 'phone' ? 16 : 120}
            type={field === 'phone' ? 'tel' : 'text'}
            dir={field === 'phone' ? 'ltr' : undefined}
            pattern={field === 'phone' ? '[+]?[0-9]{10,15}' : undefined}
            onChange={(event) => onChange(field, event.target.value)}
          />
        </label>
      ))}
    </div>
  );
}
