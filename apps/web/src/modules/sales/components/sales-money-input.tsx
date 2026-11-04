'use client';

import { useId, type ComponentProps } from 'react';
import { MoneyInput } from '@/components/ui/money-input';
import { useDisplayLanguage } from '@/i18n/locale-context';
import { moneyInWords } from '@/i18n/money-words';

export function SalesMoneyInput({
  currencyCode,
  ...props
}: ComponentProps<typeof MoneyInput> & { currencyCode: string }) {
  const language = useDisplayLanguage();
  const hintId = useId();
  const words = moneyInWords(props.value, currencyCode, language);
  return (
    <div className="min-w-0">
      <MoneyInput
        {...props}
        aria-describedby={
          [props['aria-describedby'], words ? hintId : '']
            .filter(Boolean)
            .join(' ') || undefined
        }
      />
      {words ? (
        <span
          id={hintId}
          lang={language}
          dir={language === 'en' ? 'ltr' : 'rtl'}
          aria-live="polite"
          aria-atomic="true"
          className="mt-1 block whitespace-normal break-words text-start text-[11px] leading-5 text-muted-foreground"
        >
          {words}
        </span>
      ) : null}
    </div>
  );
}
