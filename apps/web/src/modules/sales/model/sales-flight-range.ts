import type { SalesFormState } from './sales-form';

export function salesFlightRangeReady(range: {
  from: string;
  to: string;
}): boolean {
  const valid = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  return valid(range.from) && valid(range.to) && range.from <= range.to;
}

/** Changing the search range invalidates catalog choices and their price quotes. */
export function resetSalesTicketRange(
  state: SalesFormState,
): Partial<SalesFormState> {
  return {
    outboundOffer: undefined,
    returnOffer: undefined,
    ticket: {
      ...state.ticket,
      outboundOfferId: '',
      returnOfferId: '',
      outboundDepartureAt: '',
      outboundArrivalAt: '',
      returnDepartureAt: '',
      returnArrivalAt: '',
    },
    servicePricing: Object.fromEntries(
      Object.entries(state.servicePricing ?? {}).filter(
        ([key]) => key !== 'flight-outbound' && key !== 'flight-return',
      ),
    ),
  };
}
