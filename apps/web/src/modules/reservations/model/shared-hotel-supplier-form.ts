import { reservationHotelStays } from '@nora/contracts';
import type { ReservationFormIntake } from './reservation-form';
import { hotelFormScope } from './hotel-form-scope';

/** Each hotel keeps its own immutable quotation; only the primary output groups them. */
export function sharedHotelSupplierScopes(
  intake: ReservationFormIntake,
): ReservationFormIntake[] {
  const snapshot = intake.supplierHotelSourceSnapshot ?? intake.snapshot;
  const stays = reservationHotelStays(snapshot);
  if (
    stays.length < 2 ||
    (intake.hotelStayKey && intake.hotelStayKey !== stays[0]!.key) ||
    (intake.supplierDocumentKind && intake.supplierDocumentKind !== 'HOTEL') ||
    intake.workflow.supplierFormSettings?.sharedHotelBroker !== true
  )
    return [intake];
  const sent =
    intake.supplierFormUseSent ??
    intake.workflow.supplierFormSettings ===
      intake.workflow.sentSupplierFormSettings;
  return stays.map((stay, index) => {
    if (!index) return intake;
    const child = hotelFormScope(
      { ...intake, hotelStayOrdinal: stay.ordinal, snapshot },
      stay.key,
    );
    if (sent && child.workflow.sentSupplierFormSettings)
      child.workflow.supplierFormSettings =
        child.workflow.sentSupplierFormSettings;
    return child;
  });
}
