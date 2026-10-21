'use client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
export function WorkbenchSelect({
  label,
  value,
  onValueChange,
  options,
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <Select
      dir="rtl"
      value={value ? 'option:' + value : ''}
      onValueChange={(next) => onValueChange(next.slice(7))}
      required={required}
      disabled={disabled}
    >
      <SelectTrigger aria-label={label} className="w-full min-w-0">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent className="max-h-72 overflow-y-auto">
        {options.map((option) => (
          <SelectItem key={option.value} value={'option:' + option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
