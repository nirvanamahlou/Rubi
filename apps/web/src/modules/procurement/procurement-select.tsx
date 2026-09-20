'use client';

import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/form-controls';

const emptyValue = '__procurement_empty__';
type Option = React.ReactElement<React.OptionHTMLAttributes<HTMLOptionElement>>;

/** Adapts existing option lists to Rubi's shared dropdown theme. */
export function ProcurementSelect({
  id,
  value,
  disabled,
  className,
  children,
  onChange,
}: {
  id: string;
  value: string | undefined;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
  onChange: (event: { target: { value: string } }) => void;
}) {
  const options = React.Children.toArray(children).filter(
    (child): child is Option =>
      React.isValidElement(child) && child.type === 'option',
  );
  const hasEmptyOption = options.some((option) => option.props.value === '');
  const selected = options.find(
    (option) => String(option.props.value) === value,
  );
  return (
    <Select
      dir="rtl"
      value={value || ''}
      disabled={disabled ?? false}
      onValueChange={(next) =>
        onChange({ target: { value: next === emptyValue ? '' : next } })
      }
    >
      <SelectTrigger id={id} className={className}>
        <SelectValue
          placeholder={
            options.find((option) => option.props.value === '')?.props
              .children ?? 'انتخاب کنید'
          }
        >
          {value ? selected?.props.children : undefined}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-72 font-sans">
        {!hasEmptyOption && value === '' && (
          <SelectItem value={emptyValue}>انتخاب کنید</SelectItem>
        )}
        {options.map((option) => (
          <SelectItem
            key={option.key ?? String(option.props.value)}
            value={String(option.props.value || emptyValue)}
            disabled={option.props.disabled ?? false}
          >
            {option.props.children}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
