import { moneyUnits } from '@nora/contracts';
import { salesPassengerCounts, type SalesFormState } from './sales-form';
import { repriceStandaloneTicketSelections } from './standalone-ticket-pricing';

export function isTicketOnlyContract(state: SalesFormState) {
  return (
    !state.tour &&
    state.serviceKinds.length === 1 &&
    state.serviceKinds[0] === 'FLIGHT'
  );
}

/** New-form policy only; never applied to persisted contract edits. */
export function ticketOnlySaleDefaults(state: SalesFormState): SalesFormState {
  if (!isTicketOnlyContract(state)) return state;
  const catalog = repriceStandaloneTicketSelections(
    { ...state, servicePricing: {} },
    salesPassengerCounts(state).seated,
  );
  const servicePricing = { ...state.servicePricing };
  for (const [key, prices] of Object.entries(catalog)) {
    const direction = key === 'flight-outbound' ? 'OUTBOUND' : 'RETURN';
    if (state.contractFlights?.[direction]) {
      delete catalog[key];
      continue;
    }
    servicePricing[key] = prices.map((price) => {
      const previous = state.servicePricing?.[key]?.find(
        (row) => row.currencyCode === price.currencyCode,
      );
      const previousQuote = state.catalogSalePricing?.[key]?.find(
        (row) => row.currencyCode === price.currencyCode,
      )?.daySale;
      const followedDefault =
        previous &&
        previousQuote &&
        previous.agreed.basis === previousQuote.basis &&
        /^\d{1,18}(\.\d{1,4})?$/.test(previous.agreed.amount) &&
        /^\d{1,18}(\.\d{1,4})?$/.test(previousQuote.amount) &&
        moneyUnits(previous.agreed.amount) === moneyUnits(previousQuote.amount);
      return {
        ...price,
        agreed:
          previous && !followedDefault
            ? { ...previous.agreed }
            : { ...price.agreed },
      };
    });
  }
  return { ...state, servicePricing, catalogSalePricing: catalog };
}
