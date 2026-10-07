'use client';

import { Children, isValidElement } from 'react';
import { Check, Eye, Pencil, Save, X } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { sourceUiText } from '@/i18n/source-text';

/** Reference-page actions share icon-only presentation, including dialog footers. */
export function MarketingActionButton({ children, ...props }: ButtonProps) {
  const parts = Children.toArray(children);
  const label =
    props['aria-label'] ??
    parts
      .map(sourceUiText)
      .filter((child) => child !== null)
      .join(' ')
      .trim();
  const icons = parts.filter(
    (child) => isValidElement(child) && sourceUiText(child) === null,
  );
  const FallbackIcon = /انصراف|بستن/.test(label)
    ? X
    : /ذخیره|ثبت/.test(label)
      ? Save
      : /ویرایش/.test(label)
        ? Pencil
        : /مشاهده|پیش‌نمایش/.test(label)
          ? Eye
          : Check;
  return (
    <Button
      {...props}
      aria-label={label}
      title={props.title ?? label}
      size="icon"
    >
      {icons.length ? (
        icons
      ) : (
        <FallbackIcon aria-hidden="true" className="size-4" />
      )}
    </Button>
  );
}
