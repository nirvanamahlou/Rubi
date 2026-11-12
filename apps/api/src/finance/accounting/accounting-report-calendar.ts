const persianMonth = new Intl.DateTimeFormat('en-US-u-ca-persian', {
  timeZone: 'UTC',
  year: 'numeric',
  month: '2-digit',
});
export function reportMonth(
  date: string,
  calendar: 'PERSIAN' | 'GREGORIAN' = 'GREGORIAN',
) {
  if (calendar === 'GREGORIAN') return date.slice(0, 7);
  const parts = persianMonth.formatToParts(new Date(`${date}T12:00:00Z`));
  return `${parts.find((part) => part.type === 'year')!.value}-${parts.find((part) => part.type === 'month')!.value}`;
}
