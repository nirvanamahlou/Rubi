export function persianBirthDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    return null;
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(date);
}

export function PersianBirthDateHint({ value }: { value: string }) {
  const date = persianBirthDate(value);
  return date ? (
    <p
      className="pointer-events-none absolute inset-x-0 top-full m-0 whitespace-nowrap text-[9px] leading-[10px] text-muted-foreground"
      aria-live="polite"
    >
      <span>شمسی</span>{' '}
      <time dateTime={value} dir="ltr" className="inline-block">
        {date}
      </time>
    </p>
  ) : null;
}
