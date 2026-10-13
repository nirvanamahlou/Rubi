'use client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/form-controls';

export function SalesThemedSelect({
  label,
  value,
  options,
  onValueChange,
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onValueChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
}) {
  // Encode values so the empty/all option remains a valid Radix item without collisions.
  const encode = (raw: string) => 'option:' + raw;
  return (
    <Select
      dir="rtl"
      value={value ? encode(value) : ''}
      onValueChange={(next) => onValueChange(next.slice(7))}
      required={required}
      disabled={disabled}
    >
      <SelectTrigger aria-label={label} className="min-w-44">
        <SelectValue
          placeholder={
            options.find((option) => option.value === '')?.label ?? label
          }
        />
      </SelectTrigger>
      <SelectContent className="max-h-72 overflow-y-auto">
        {options.map((option) => (
          <SelectItem key={option.value} value={encode(option.value)}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
