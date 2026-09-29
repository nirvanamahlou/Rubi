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
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  required?: boolean;
}) {
  return (
    <Select
      dir="rtl"
      value={'option:' + value}
      onValueChange={(next) => onValueChange(next.slice(7))}
      required={required}
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
