import type { ContractFlightDraft } from './sales-form';

/** The Sales calendar provides the civil date; clocks are Tehran local time. */
export function floatingFlightClock(value: string): string {
  if (!value) return '';
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(value))
    return /T(\d{2}:\d{2})/.exec(value)?.[1] ?? '';
  if (!Number.isFinite(Date.parse(value))) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
}

export function floatingFlightTimes(
  date: string,
  value: ContractFlightDraft,
  clocks: { departure?: string; arrival?: string },
): ContractFlightDraft {
  const departure = clocks.departure ?? floatingFlightClock(value.departureAt);
  const arrival = clocks.arrival ?? floatingFlightClock(value.arrivalAt);
  const validClock = (s: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(s);
  const validDate =
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date;
  let arrivalDate = date;
  if (
    validDate &&
    validClock(departure) &&
    validClock(arrival) &&
    arrival <= departure
  ) {
    const next = new Date(date + 'T12:00:00Z');
    next.setUTCDate(next.getUTCDate() + 1);
    arrivalDate = next.toISOString().slice(0, 10);
  }
  return {
    ...value,
    departureAt:
      validDate && validClock(departure) ? `${date}T${departure}` : '',
    arrivalAt:
      validDate && validClock(arrival) ? `${arrivalDate}T${arrival}` : '',
  };
}

/** Confirm only the contract draft; never create inventory or submit a contract. */
export function confirmFloatingFlight(
  date: string,
  value: ContractFlightDraft,
): ContractFlightDraft {
  const normalized = floatingFlightTimes(date, value, {});
  const valid =
    normalized.carrierName.trim().length > 0 &&
    normalized.carrierName.trim().length <= 160 &&
    normalized.serviceNumber.trim().length > 0 &&
    normalized.serviceNumber.trim().length <= 80 &&
    ['ECONOMY', 'BUSINESS', 'FIRST'].includes(normalized.cabinClassCode) &&
    Boolean(normalized.departureAt && normalized.arrivalAt) &&
    Date.parse(normalized.arrivalAt + '+03:30') >
      Date.parse(normalized.departureAt + '+03:30');
  return valid
    ? { ...normalized, confirmation: 'saved' }
    : { ...value, confirmation: 'invalid' };
}

/** Reuse the saved Tehran civil day when a draft is restored without search UI state. */
export function floatingFlightDate(value: string): string {
  if (!value) return '';
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(value))
    return /^(\d{4}-\d{2}-\d{2})T/.exec(value)?.[1] ?? '';
  if (!Number.isFinite(Date.parse(value))) return '';
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}
