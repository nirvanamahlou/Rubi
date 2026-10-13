'use client';
import { DatePicker, type DatePickerProps } from '@/components/ui/date-picker';

export function SalesDatePicker(
  props: Omit<DatePickerProps, 'gregorianEnglish'>,
) {
  return <DatePicker {...props} gregorianEnglish />;
}
