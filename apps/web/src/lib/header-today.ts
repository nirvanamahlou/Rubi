export const HEADER_DATE_TIME_ZONE = 'Asia/Tehran';

const dayKeyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: HEADER_DATE_TIME_ZONE,
  calendar: 'gregory',
  numberingSystem: 'latn',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const fullDateFormatter = new Intl.DateTimeFormat('fa-IR', {
  timeZone: HEADER_DATE_TIME_ZONE,
  calendar: 'persian',
  numberingSystem: 'arabext',
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

export function headerDateKey(now = new Date()): string {
  const parts = dayKeyFormatter.formatToParts(now);
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function formatHeaderDate(
  day: string,
  options?: {
    calendar: 'persian' | 'gregorian';
    locale: 'en-US' | 'fa-IR';
    numberingSystem: 'arabext' | 'latn';
    timezone: string;
  },
): string {
  const formatter = options
    ? new Intl.DateTimeFormat(options.locale, {
        timeZone: options.timezone,
        calendar: options.calendar === 'gregorian' ? 'gregory' : 'persian',
        numberingSystem: options.numberingSystem,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : fullDateFormatter;
  const date = new Date(`${day}T12:00:00Z`);
  if (options) return formatter.format(date);
  const parts = formatter.formatToParts(date);
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value;
  return `${value('weekday')}، ${value('day')} ${value('month')} ${value('year')}`;
}

// A day-string snapshot avoids re-rendering the shell on every clock tick.
export function subscribeHeaderDate(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const refresh = () => {
    clearTimeout(timer);
    onChange();
    // Align with the minute boundary, including Tehran midnight.
    timer = setTimeout(refresh, 60_000 - (Date.now() % 60_000));
  };
  timer = setTimeout(refresh, 60_000 - (Date.now() % 60_000));
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', refresh);
  return () => {
    clearTimeout(timer);
    window.removeEventListener('focus', refresh);
    document.removeEventListener('visibilitychange', refresh);
  };
}
