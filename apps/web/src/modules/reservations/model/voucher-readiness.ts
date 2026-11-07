import type { TravelWorkflowStateV1 } from '@nora/contracts';
type Readiness = Pick<
  TravelWorkflowStateV1,
  'supplierStatus' | 'voucherIssued'
> & {
  sentSupplierFormVersion?: number | undefined;
  hotelSupplierForms?: TravelWorkflowStateV1['hotelSupplierForms'] | undefined;
  sentSupplierFormSettings?:
    { brokerId?: string | undefined } | null | undefined;
};

export function hasSentReservationForm(state: Readiness) {
  return (
    ((Number.isSafeInteger(state.sentSupplierFormVersion) &&
      (state.sentSupplierFormVersion ?? 0) > 0) ||
      Boolean(state.sentSupplierFormSettings?.brokerId) ||
      Object.values(state.hotelSupplierForms ?? {}).some(
        (entry) => (entry.sentVersion ?? 0) > 0 || entry.sentSettings?.brokerId,
      )) &&
    ['REQUESTED', 'CONFIRMED'].includes(state.supplierStatus)
  );
}

export function voucherActionAvailable(state: Readiness) {
  return state.voucherIssued || hasSentReservationForm(state);
}
