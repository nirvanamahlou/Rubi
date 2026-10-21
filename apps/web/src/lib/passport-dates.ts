export function tehranToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function passportExpiryWarning(expiry: string, today = tehranToday()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiry)) return false;
  const date = new Date(today + 'T00:00:00Z');
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 6);
  const last = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return expiry >= today && expiry < date.toISOString().slice(0, 10);
}
