import { emptySalesForm, type SalesFormState } from './sales-form';

/** A browser draft is an unfinished new contract, not a historical contract. */
export function restoreContractDraft(
  parsed: Partial<SalesFormState>,
): SalesFormState {
  return {
    ...emptySalesForm,
    ...parsed,
    roomDrivenGuests: true,
    passengerComposition: {
      ...emptySalesForm.passengerComposition,
      ...parsed.passengerComposition,
    },
    hotel: { ...emptySalesForm.hotel, ...parsed.hotel },
  } as SalesFormState;
}
