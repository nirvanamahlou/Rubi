'use client';

import {
  cloneElement,
  isValidElement,
  useId,
  type ReactElement,
  type ReactNode,
} from 'react';

import { FormField } from '@/components/ui/form-controls';

type FieldChildProps = {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
};

export function AffairsFormField({
  children,
  description,
  error,
  id,
  label,
}: {
  children: ReactNode;
  description?: string;
  error?: string;
  id?: string;
  label: string;
}) {
  const generatedId = useId();
  const fieldId = id ?? `customer-affairs-${generatedId}`;
  const descriptionId = error
    ? `${fieldId}-error`
    : description
      ? `${fieldId}-help`
      : undefined;
  const control = isValidElement<FieldChildProps>(children)
    ? cloneElement(children as ReactElement<FieldChildProps>, {
        id: children.props.id ?? fieldId,
        ...(descriptionId && !children.props['aria-describedby']
          ? { 'aria-describedby': descriptionId }
          : {}),
        ...(error ? { 'aria-invalid': true } : {}),
      })
    : children;

  return (
    <FormField
      id={fieldId}
      label={label}
      {...(description ? { description } : {})}
      {...(error ? { error } : {})}
    >
      {control}
    </FormField>
  );
}
