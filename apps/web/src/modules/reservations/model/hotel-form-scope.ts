import { reservationHotelStays, scopeReservationHotel } from '@nora/contracts';
import type { ReservationFormIntake } from './reservation-form';
export function hotelFormScope(
  intake: ReservationFormIntake,
  key: string,
): ReservationFormIntake {
  const stays = reservationHotelStays(intake.snapshot);
  if (!stays.some((stay) => stay.key === key))
    throw Error('اقامت هتل انتخاب‌شده معتبر نیست.');
  const entry = intake.workflow.hotelSupplierForms?.[key];
  const primary = stays[0]?.key === key && (intake.hotelStayOrdinal ?? 1) === 1;
  const workflow = { ...intake.workflow };
  delete workflow.supplierFormSettings;
  delete workflow.sentSupplierFormSettings;
  if (entry?.settings) workflow.supplierFormSettings = entry.settings;
  else if (primary && intake.workflow.supplierFormSettings)
    workflow.supplierFormSettings = intake.workflow.supplierFormSettings;
  if (entry?.sentSettings)
    workflow.sentSupplierFormSettings = entry.sentSettings;
  else if (primary && intake.workflow.sentSupplierFormSettings)
    workflow.sentSupplierFormSettings =
      intake.workflow.sentSupplierFormSettings;
  return {
    ...intake,
    hotelStayKey: key,
    hotelStayOrdinal:
      intake.hotelStayOrdinal ??
      stays.find((stay) => stay.key === key)!.ordinal,
    snapshot: scopeReservationHotel(intake.snapshot, key),
    workflow,
  };
}
