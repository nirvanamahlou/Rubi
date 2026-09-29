'use client';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
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

export {
  Select,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from './search-select-primitives';

interface FormFieldProps {
  id?: string;
  label: string;
  labelClassName?: string;
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
  labelClassName,
  required,
}: FormFieldProps) {
  const helpId = id ? `${id}-help` : undefined;
  const errorId = id ? `${id}-error` : undefined;
  return (
    <div className="grid gap-2">
      <label
        className={cn('text-sm font-semibold text-foreground', labelClassName)}
        htmlFor={id}
      >
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
