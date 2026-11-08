import { reservationHotelStays, scopeReservationHotel } from '@nora/contracts';
import {
  type ReservationFormIntake,
  type ReservationFormReferences,
} from './reservation-form';
import { defaultVoucherSettings } from './voucher-settings';

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
            hotelJourneySourceSnapshot:
              intake.hotelJourneySourceSnapshot ?? intake.snapshot,
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
    // One continuous document per hotel; the print engine owns physical pages.
    const count = 1;
    const document = { intake: scope, pageOffset: offset, pageCount: count };
    offset += count;
    return document;
  });
  return documents.map((document) => ({ ...document, totalPages: offset }));
}
