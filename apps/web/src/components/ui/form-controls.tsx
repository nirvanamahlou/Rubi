'use client';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

const controlClasses =
  'w-full rounded-xl border border-input bg-surface px-3 text-sm text-foreground shadow-xs outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    className={cn(controlClasses, 'h-11', className)}
    ref={ref}
    {...props}
  />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(controlClasses, 'min-h-28 resize-y py-3', className)}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    className={cn(
      'peer flex size-5 shrink-0 items-center justify-center rounded-md border border-input bg-surface text-primary-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary',
      className,
    )}
    ref={ref}
    {...props}
  >
    <CheckboxPrimitive.Indicator>
      <Check aria-hidden="true" className="size-3.5" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = 'Checkbox';

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ children, className, ...props }, ref) => (
  <SelectPrimitive.Trigger
    className={cn(
      controlClasses,
      'flex h-11 items-center justify-between gap-2',
      className,
    )}
    ref={ref}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon>
      <ChevronDown
        aria-hidden="true"
        className="size-4 text-muted-foreground"
      />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = 'SelectTrigger';

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ children, className, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      className={cn(
        'z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl',
        className,
      )}
      position={position}
      ref={ref}
      {...props}
    >
      <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = 'SelectContent';

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ children, className, ...props }, ref) => (
  <SelectPrimitive.Item
    className={cn(
      'relative flex min-h-9 cursor-default select-none items-center rounded-lg py-2 pe-8 ps-3 text-sm outline-none data-[highlighted]:bg-muted data-[disabled]:opacity-50',
      className,
    )}
    ref={ref}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator className="absolute end-2">
      <Check aria-hidden="true" className="size-4" />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
));
SelectItem.displayName = 'SelectItem';

interface FormFieldProps {
  id?: string;
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

export function FormField({
  children,
  description,
  error,
  id,
  label,
  required,
}: FormFieldProps) {
  const helpId = id ? `${id}-help` : undefined;
  const errorId = id ? `${id}-error` : undefined;
  return (
    <div className="grid gap-2">
      <label className="text-sm font-semibold text-foreground" htmlFor={id}>
        {label}
        {required ? (
          <span className="ms-1 text-destructive" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {description && !error ? (
        <p className="text-xs text-muted-foreground" id={helpId}>
          {description}
        </p>
      ) : null}
      {error ? (
        <p
          aria-live="assertive"
          className="text-xs font-medium text-destructive"
          id={errorId}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
