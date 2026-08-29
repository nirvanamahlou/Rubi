export interface CustomerDateParts {
  year: number;
  month: number;
  day: number;
}

export const persianMonths = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

const persianFormatter = new Intl.DateTimeFormat('en-US-u-ca-persian', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  timeZone: 'UTC',
});

export function persianParts(date: Date): CustomerDateParts {
  const parts = persianFormatter.formatToParts(date);
  const value = (type: 'year' | 'month' | 'day') =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value('year'), month: value('month'), day: value('day') };
}

function isoParts(value: string): CustomerDateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match
    ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
    : null;
}

export function persianDateToIso(parts: CustomerDateParts): string | null {
  const start = Date.UTC(parts.year + 620, 2, 1);
  for (let offset = 0; offset < 430; offset += 1) {
    const date = new Date(start + offset * 86_400_000);
    const candidate = persianParts(date);
    if (
      candidate.year === parts.year &&
      candidate.month === parts.month &&
      candidate.day === parts.day
    )
      return date.toISOString().slice(0, 10);
  }
  return null;
}

export function currentPersianParts(value: string): CustomerDateParts {
  const parsed = isoParts(value);
  return persianParts(
    parsed
      ? new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day))
      : new Date(),
  );
}

export function persianNumber(value: number) {
  return value.toLocaleString('fa-IR', { useGrouping: false });
}

export function formatCustomerDate(
  value: string | null,
  mode: 'persian' | 'gregorian',
) {
  if (!value) return 'ثبت نشده';
  return new Intl.DateTimeFormat(
    mode === 'persian' ? 'fa-IR-u-ca-persian' : 'fa-IR-u-ca-gregory',
    { dateStyle: 'medium', timeZone: 'UTC' },
  ).format(new Date(value));
}
