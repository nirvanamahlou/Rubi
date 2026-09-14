'use client';

import {
  Children,
  isValidElement,
  useState,
  type ReactNode,
  type CSSProperties,
} from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/form-controls';

type OptionProps = {
  value?: string | number;
  disabled?: boolean;
  children?: ReactNode;
};
const EMPTY_OPTION = '__ca_empty_option__';
const labels: Record<string, string> = {
  channel: 'کانال ورود',
  inboundChannel: 'کانال ورود',
  priority: 'اولویت',
  category: 'نوع تیکت',
  currency: 'ارز',
  datePrecision: 'دقت تاریخ سفر',
  impact: 'اثر مسئله',
  urgency: 'فوریت',
  destinationModule: 'واحد مقصد',
  status: 'وضعیت',
  stage: 'مرحله درخواست',
  lossReason: 'دلیل شکست',
  intakeQueue: 'صف مسئول',
};

/** Preserve existing option lists and FormData while using Nora's themed menu. */
export function AffairsSelect({
  children,
  value,
  defaultValue,
  onChange,
  name,
  required,
  disabled,
  className,
  ...labelProps
}: {
  children: ReactNode;
  value?: string;
  defaultValue?: string;
  onChange?: (event: { target: { value: string } }) => void;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string | undefined;
  style?: CSSProperties;
  'aria-label'?: string;
  id?: string;
}) {
  const options = Children.toArray(children)
    .filter(isValidElement<OptionProps>)
    .map((option) => ({
      value: String(option.props.value ?? ''),
      label: option.props.children,
      disabled: option.props.disabled,
    }));
  const [internal, setInternal] = useState(
    defaultValue ?? options.find((option) => !option.disabled)?.value ?? '',
  );
  const selected = value ?? internal;
  const emptyLabel = options.find((option) => option.value === '')?.label;
  return (
    <Select
      dir="rtl"
      {...(name ? { name } : {})}
      required={Boolean(required)}
      disabled={Boolean(disabled)}
      value={selected}
      onValueChange={(next) => {
        const result = next === EMPTY_OPTION ? '' : next;
        setInternal(result);
        onChange?.({ target: { value: result } });
      }}
    >
      <SelectTrigger
        {...labelProps}
        aria-label={
          labelProps['aria-label'] ?? labels[name ?? ''] ?? 'انتخاب گزینه'
        }
        className={`${className ?? ''} min-w-0 text-start`}
      >
        <SelectValue placeholder={emptyLabel ?? 'انتخاب کنید'} />
      </SelectTrigger>
      <SelectContent
        className="z-[100] max-h-[min(20rem,var(--radix-select-content-available-height))] overflow-y-auto"
        sideOffset={5}
      >
        {options.map((option) => (
          <SelectItem
            key={option.value || EMPTY_OPTION}
            value={option.value || EMPTY_OPTION}
            disabled={Boolean(option.disabled)}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
