import { reservationHotelStays, scopeReservationHotel } from '@nora/contracts';
import {
  reservationPassengerPages,
  reservationRoomAppendices,
  type ReservationFormIntake,
  type ReservationFormReferences,
} from './reservation-form';
import { defaultVoucherSettings, voucherFormData } from './voucher-settings';
import { voucherPassengerPageUnits } from './voucher-passenger-services';

/** Read-only hotel documents. Primary voucher overrides never become another hotel's facts. */
export function voucherHotelDocuments(
  intake: ReservationFormIntake,
  refs: ReservationFormReferences,
) {
  const stays = reservationHotelStays(intake.snapshot);
  const saved = intake.workflow.voucherSettings;
  const scopes: ReservationFormIntake[] =
    intake.hotelStayKey || stays.length < 2 || saved?.flags.hotel === false
      ? [intake]
      : stays.map((stay, index) => {
          const scoped: ReservationFormIntake = {
            ...intake,
            hotelStayKey: stay.key,
            hotelStayOrdinal: stay.ordinal,
            snapshot: scopeReservationHotel(intake.snapshot, stay.key),
            workflow: { ...intake.workflow },
          };
          if (!index) return scoped;
          // Additional historical stays may have no room breakdown; never label
          // them with the primary hotel's unrelated room reference.
          scoped.snapshot.hotelSelection!.roomTypeId =
            stay.hotel.rooms?.[0]?.roomTypeId ?? '';
          // These fields belong to the primary hotel's independent form.
          delete scoped.workflow.voucherSettings;
          delete scoped.workflow.supplierFormSettings;
          delete scoped.workflow.sentSupplierFormSettings;
          const defaults = defaultVoucherSettings(scoped, refs);
          if (saved) {
            const { rooms: primaryRooms, ...common } = saved;
            void primaryRooms;
            scoped.workflow.voucherSettings = {
              ...common,
              ...(defaults.rooms ? { rooms: defaults.rooms } : {}),
              numbers: defaults.numbers,
              text: {
                ...saved.text,
                ...Object.fromEntries(
                  [
                    'city',
                    'hotel',
                    'stars',
                    'meal',
                    'roomType',
                    'checkIn',
                    'checkOut',
                  ].map((key) => [
                    key,
                    defaults.text[key as keyof typeof defaults.text],
                  ]),
                ),
              },
              passengers: defaults.passengers.map((person) => ({
                ...person,
                ...saved.passengers.find((item) => item.id === person.id),
              })),
            };
          }
          return scoped;
        });
  let offset = 0;
  const documents = scopes.map((scope) => {
    const data = voucherFormData(scope, refs);
    const settings = scope.workflow.voucherSettings;
    const count =
      reservationPassengerPages(
        data.passengers,
        voucherPassengerPageUnits(settings, data.notes),
      ).length +
      (settings?.flags.hotel === false
        ? 0
        : reservationRoomAppendices(data.roomBreakdown).length);
    const document = { intake: scope, pageOffset: offset, pageCount: count };
    offset += count;
    return document;
  });
  return documents.map((document) => ({ ...document, totalPages: offset }));
}
