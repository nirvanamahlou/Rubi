import type { TravelWorkflowStateV1 } from '@nora/contracts';
type Readiness = Pick<
  TravelWorkflowStateV1,
  'supplierStatus' | 'voucherIssued'
> & {
  sentSupplierFormSettings?:
    { brokerId?: string | undefined } | null | undefined;
};

export function hasSentReservationForm(state: Readiness) {
  return (
    Boolean(state.sentSupplierFormSettings?.brokerId) &&
    ['REQUESTED', 'CONFIRMED'].includes(state.supplierStatus)
  );
}

export function voucherActionAvailable(state: Readiness) {
  return state.voucherIssued || hasSentReservationForm(state);
}
