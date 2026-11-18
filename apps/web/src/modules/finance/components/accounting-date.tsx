'use client';

import { useSystemPreferences } from '@/components/system-preferences-provider';
import { formatCalendarValue } from '@/components/ui/date-picker.utils';

/** Presentation only. Native date-only ISO values remain authoritative for edits/filters. */
export function AccountingDate({ value }: { value: string }) {
  const preferences = useSystemPreferences();
  const label = formatCalendarValue(
    value,
    preferences.calendar,
    false,
    preferences.language === 'en',
  );
  return label ? <time dateTime={value}>{label}</time> : <>—</>;
}
